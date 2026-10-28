import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sparkles, 
  Link, 
  Check, 
  Clock, 
  LogOut, 
  ShieldCheck, 
  Truck, 
  Database,
  Filter,
  ShieldAlert,
  Ban,
  Calendar,
  Layers,
  Info,
  MapPin,
  Plus,
  Users
} from 'lucide-react';
import { 
  googleSignIn, 
  logoutGoogle, 
  getAccessToken, 
  getCachedGoogleUser, 
  initAuth 
} from '../services/googleAuthService';
import { 
  googleSheetsApiService, 
  GoogleSpreadsheetMetadata, 
  ParsedSheetTrip, 
  GoogleSheetsSyncConfig 
} from '../services/googleSheetsApiService';
import { 
  scheduleImportValidator, 
  ValidatedImportItem, 
  ValidationSummaryReport, 
  ImportSyncOptions 
} from '../services/scheduleImportValidator';
import { areaAutoMapper, AreaMappingEntry, OfficialAreaItem } from '../services/areaAutoMapper';
import { crewAutoMapper, CrewMappingEntry, OfficialCrewItem } from '../services/crewAutoMapper';
import { AreaAutoMappingSection } from './AreaAutoMappingSection';
import { CrewAutoMappingSection } from './CrewAutoMappingSection';
import { QuickCreateAreaModal } from './QuickCreateAreaModal';
import { QuickCreateCrewModal } from './QuickCreateCrewModal';
import { User } from 'firebase/auth';

interface GoogleSheetsApiSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (count: number) => void;
}

export const GoogleSheetsApiSyncModal: React.FC<GoogleSheetsApiSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete
}) => {
  const [googleUser, setGoogleUser] = useState<User | null>(getCachedGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Configuration state
  const [config, setConfig] = useState<GoogleSheetsSyncConfig>(googleSheetsApiService.getConfig());
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(config.spreadsheetUrl || config.spreadsheetId);
  const [metadata, setMetadata] = useState<GoogleSpreadsheetMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Preview state
  const [previewTrips, setPreviewTrips] = useState<ParsedSheetTrip[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Validation options state
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(false);
  const [skipInvalid, setSkipInvalid] = useState<boolean>(true);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState<boolean>(true);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  const [activeSyncTab, setActiveSyncTab] = useState<'validation' | 'area_mapping' | 'crew_mapping'>('validation');

  // Intelligent Area & Crew Auto-Mapping State
  const [detectedAreaMappings, setDetectedAreaMappings] = useState<Record<string, AreaMappingEntry>>({});
  const [officialAreasList, setOfficialAreasList] = useState<OfficialAreaItem[]>(() => areaAutoMapper.getOfficialAreaList());
  const [quickCreateAreaTarget, setQuickCreateAreaTarget] = useState<string | null>(null);

  const [detectedCrewMappings, setDetectedCrewMappings] = useState<Record<string, CrewMappingEntry>>({});
  const [officialCrewsList, setOfficialCrewsList] = useState<OfficialCrewItem[]>(() => crewAutoMapper.getOfficialCrewList());
  const [quickCreateCrewTarget, setQuickCreateCrewTarget] = useState<{ name: string; roleHint?: 'Driver' | 'Helper' } | null>(null);

  // Auto-detect areas and crews from previewTrips
  useEffect(() => {
    if (previewTrips.length > 0) {
      const rawAreas = previewTrips.map(t => t.rawArea || t.area).filter(Boolean);
      const mappings = areaAutoMapper.processRawAreaBatch(rawAreas);
      setDetectedAreaMappings(prev => {
        const updated = { ...mappings };
        Object.keys(prev).forEach(k => {
          if (prev[k].isUserOverridden && updated[k]) {
            updated[k] = prev[k];
          }
        });
        return updated;
      });

      // Extract raw crew names (drivers and helpers)
      const rawCrews: Array<{ name: string; roleHint?: 'Driver' | 'Helper' }> = [];
      previewTrips.forEach(t => {
        if (t.driver) rawCrews.push({ name: t.driver, roleHint: 'Driver' });
        if (t.helper) {
          t.helper.split(/[,&/]+/).forEach(h => {
            const cleanH = h.trim();
            if (cleanH && cleanH !== '-' && cleanH !== '0') {
              rawCrews.push({ name: cleanH, roleHint: 'Helper' });
            }
          });
        }
      });

      const crewMappings = crewAutoMapper.processRawCrewBatch(rawCrews);
      setDetectedCrewMappings(prev => {
        const updated = { ...crewMappings };
        Object.keys(prev).forEach(k => {
          if (prev[k].isUserOverridden && updated[k]) {
            updated[k] = prev[k];
          }
        });
        return updated;
      });
    }
  }, [previewTrips]);

  const mappingDict: Record<string, string> = useMemo(() => {
    const dict: Record<string, string> = {};
    Object.entries(detectedAreaMappings).forEach(([k, v]) => {
      if (v.matchedOfficialArea) dict[k] = v.matchedOfficialArea;
    });
    return dict;
  }, [detectedAreaMappings]);

  const crewMappingDict: Record<string, string> = useMemo(() => {
    const dict: Record<string, string> = {};
    Object.entries(detectedCrewMappings).forEach(([k, v]) => {
      if (v.matchedCrewName) dict[k] = v.matchedCrewName;
    });
    return dict;
  }, [detectedCrewMappings]);

  const handleMappingChange = (rawArea: string, targetOfficialArea: string) => {
    const foundOfficial = officialAreasList.find(a => a.name.toUpperCase() === targetOfficialArea.toUpperCase());
    setDetectedAreaMappings(prev => {
      const current = prev[rawArea];
      const updated: AreaMappingEntry = {
        rawArea,
        occurrenceCount: current?.occurrenceCount || 1,
        matchedOfficialArea: targetOfficialArea,
        matchedStoreId: foundOfficial?.id || null,
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: `Dipetakan manual oleh pengguna ke '${targetOfficialArea}'`,
        isUserOverridden: true
      };
      areaAutoMapper.saveUserMappingPreference(rawArea, targetOfficialArea);
      return { ...prev, [rawArea]: updated };
    });
  };

  const handleCrewMappingChange = (rawName: string, targetCrewName: string) => {
    const foundCrew = officialCrewsList.find(c => c.name.toUpperCase() === targetCrewName.toUpperCase());
    setDetectedCrewMappings(prev => {
      const current = prev[rawName];
      const updated: CrewMappingEntry = {
        rawName,
        roleHint: current?.roleHint || 'Driver',
        occurrenceCount: current?.occurrenceCount || 1,
        matchedCrewId: foundCrew?.id || null,
        matchedCrewName: targetCrewName,
        matchedCrewRole: foundCrew?.role || 'Driver',
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: `Dipetakan manual oleh pengguna ke '${targetCrewName}'`,
        isUserOverridden: true
      };
      crewAutoMapper.saveMappingPreference(rawName, targetCrewName);
      return { ...prev, [rawName]: updated };
    });
  };

  const handleAreaCreated = (newArea: OfficialAreaItem, rawAreaKey: string) => {
    const updatedList = areaAutoMapper.getOfficialAreaList();
    setOfficialAreasList(updatedList);

    setDetectedAreaMappings(prev => {
      const current = prev[rawAreaKey];
      return {
        ...prev,
        [rawAreaKey]: {
          rawArea: rawAreaKey,
          occurrenceCount: current?.occurrenceCount || 1,
          matchedOfficialArea: newArea.name,
          matchedStoreId: newArea.id,
          confidence: 'exact',
          confidenceScore: 100,
          similarityReason: `Area baru '${newArea.name}' berhasil dibuat dan didaftarkan ke Jadwal Pengiriman & Muat`,
          isUserOverridden: true,
          isNewlyCreated: true
        }
      };
    });
  };

  const handleCrewCreated = (newCrew: OfficialCrewItem) => {
    const updatedList = crewAutoMapper.getOfficialCrewList();
    setOfficialCrewsList(updatedList);

    setDetectedCrewMappings(prev => {
      const current = prev[newCrew.name];
      return {
        ...prev,
        [newCrew.name]: {
          rawName: newCrew.name,
          roleHint: newCrew.role as any,
          occurrenceCount: current?.occurrenceCount || 1,
          matchedCrewId: newCrew.id,
          matchedCrewName: newCrew.name,
          matchedCrewRole: newCrew.role,
          confidence: 'exact',
          confidenceScore: 100,
          similarityReason: `Kru baru '${newCrew.name}' berhasil didaftarkan ke database resmi AKK`,
          isUserOverridden: true,
          isNewlyCreated: true
        }
      };
    });
  };

  // Sync state & Confirmation Dialog
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ 
    success: boolean; 
    message: string; 
    count?: number; 
    skippedDuplicate?: number;
    skippedInvalid?: number;
    overwritten?: number;
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Update access token if available
  useEffect(() => {
    getAccessToken().then(tok => setAccessToken(tok));
  }, [googleUser]);

  // Compute validation report automatically whenever previewTrips changes (using active mappingDict)
  const validationReport: ValidationSummaryReport = useMemo(() => {
    return scheduleImportValidator.validateImportBatch(previewTrips, new Date(), mappingDict);
  }, [previewTrips, mappingDict]);

  // Filtered preview items based on current tab
  const filteredPreviewItems = useMemo(() => {
    if (previewFilter === 'valid') {
      return validationReport.items.filter(it => it.isValid && !it.isDuplicate);
    }
    if (previewFilter === 'duplicate') {
      return validationReport.items.filter(it => it.isDuplicate || it.status === 'duplicate_po' || it.status === 'duplicate_assignment');
    }
    if (previewFilter === 'invalid') {
      return validationReport.items.filter(it => !it.isValid);
    }
    return validationReport.items;
  }, [validationReport, previewFilter]);

  // Calculate effective count to be synced based on active toggles
  const effectiveSyncCount = useMemo(() => {
    return validationReport.items.filter(it => {
      if (!it.isValid && skipInvalid) return false;
      if (it.isDuplicate && skipDuplicates && !overwriteDuplicates) return false;
      return true;
    }).length;
  }, [validationReport, skipDuplicates, skipInvalid, overwriteDuplicates]);

  if (!isOpen) return null;

  // Handle Google Sign In
  const handleGoogleLogin = async (forceConsent: boolean = false) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await googleSignIn(forceConsent);
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        if (spreadsheetInput) {
          // Re-attempt metadata fetch with newly acquired token
          setTimeout(() => {
            handleConnectSpreadsheet();
          }, 200);
        }
      }
    } catch (err: any) {
      console.warn('Google Sign In Notice:', err?.message || err);
      setAuthError(err.message || 'Gagal login ke akun Google.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setAccessToken(null);
    setMetadata(null);
    setPreviewTrips([]);
  };

  // Connect & Fetch Metadata
  const handleConnectSpreadsheet = async () => {
    const sheetId = googleSheetsApiService.extractSpreadsheetId(spreadsheetInput);
    if (!sheetId) {
      setPreviewError('Harap masukkan URL atau ID spreadsheet yang valid.');
      return;
    }

    setIsLoadingMetadata(true);
    setPreviewError(null);
    try {
      const meta = await googleSheetsApiService.getSpreadsheetMetadata(sheetId, accessToken);
      setMetadata(meta);

      // Default to sheet "ALL" if found, otherwise first sheet
      const defaultSheet = meta.sheets.find(s => s.title.toUpperCase() === 'ALL')?.title || meta.sheets[0]?.title || 'Sheet1';
      
      const newConfig = {
        ...config,
        spreadsheetId: sheetId,
        spreadsheetUrl: spreadsheetInput,
        selectedSheetTitle: defaultSheet
      };
      setConfig(newConfig);
      googleSheetsApiService.saveConfig(newConfig);

      // Load preview for this sheet
      await loadPreviewData(sheetId, defaultSheet, accessToken);
    } catch (err: any) {
      console.warn('Metadata fetch notice:', err?.message || err);
      const isScopeErr = err?.message?.includes('insufficient authentication scopes') || err?.message?.includes('insufficient scopes') || err?.message?.includes('PERMISSION_DENIED');
      if (isScopeErr) {
        setPreviewError('Izin akses spreadsheet Google diperlukan. Silakan klik tombol "Login Ulang dengan Izin Spreadsheet" di bawah untuk memberikan izin membaca Google Sheets.');
      } else {
        setPreviewError(err?.message || 'Gagal menghubungkan ke Google Sheets.');
      }
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Load Preview Data
  const loadPreviewData = async (sheetId: string, sheetTitle: string, token?: string | null) => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const range = `${sheetTitle}!A:Z`;
      const rows = await googleSheetsApiService.getSheetValues(sheetId, range, token);
      const trips = googleSheetsApiService.parseScheduleRows(rows);
      setPreviewTrips(trips);
    } catch (err: any) {
      console.warn('Preview notice:', err?.message || err);
      setPreviewError(err?.message || 'Gagal membaca isi sel spreadsheet.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle Sheet Tab Change
  const handleSheetChange = (newTitle: string) => {
    const newConfig = { ...config, selectedSheetTitle: newTitle };
    setConfig(newConfig);
    googleSheetsApiService.saveConfig(newConfig);
    if (config.spreadsheetId) {
      loadPreviewData(config.spreadsheetId, newTitle, accessToken);
    }
  };

  // Execute Sync after validation & user confirmation
  const handleExecuteSync = async () => {
    if (!config.spreadsheetId || !config.selectedSheetTitle) {
      setPreviewError('Harap tentukan spreadsheet dan sheet sebelum sinkronisasi.');
      return;
    }

    setShowConfirmDialog(false);
    setIsSyncing(true);
    setSyncResult(null);

    // Yield control to let React render the loading animation
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const syncOptions: ImportSyncOptions = {
        skipDuplicates,
        skipInvalid,
        overwriteDuplicates,
        customAreaMapping: mappingDict,
        customCrewMapping: crewMappingDict
      };

      const res = await googleSheetsApiService.syncToOperationalSchedule(
        config.spreadsheetId,
        config.selectedSheetTitle,
        accessToken || undefined,
        syncOptions
      );

      setSyncResult({
        success: true,
        message: res.message,
        count: res.syncedCount,
        skippedDuplicate: res.skippedDuplicateCount,
        skippedInvalid: res.skippedInvalidCount,
        overwritten: res.overwrittenCount
      });

      if (onSyncComplete) {
        onSyncComplete(res.syncedCount + res.overwrittenCount);
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      setSyncResult({
        success: false,
        message: err.message || 'Terjadi kesalahan saat menyinkronkan data.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Integrasi & Validasi Google Sheets API</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Proteksi Duplikat & Format Aktif
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mekanisme validasi ketat untuk mencegah entri ganda, bentrok jadwal supir, dan format tanggal/PO tidak valid masuk ke sistem operasional.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* 1. Google Authentication Section */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status Otorisasi Akun Google</span>
                {googleUser ? (
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <img 
                      src={googleUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(googleUser.displayName || 'Google User')}&background=0D8ABC&color=fff`} 
                      alt="Avatar" 
                      className="w-7 h-7 rounded-full border border-emerald-500/40"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{googleUser.displayName || 'Pengguna Google'}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[10px] text-slate-400">{googleUser.email}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Hubungkan akun Google Anda dengan izin akses baca spreadsheet (Google Sheets API).
                  </p>
                )}
              </div>

              {googleUser ? (
                <button
                  onClick={handleGoogleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer self-start sm:self-center"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Putuskan Akun</span>
                </button>
              ) : (
                <button
                  onClick={() => handleGoogleLogin(false)}
                  disabled={isAuthenticating}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-md transition cursor-pointer border border-slate-300 self-start sm:self-center"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isAuthenticating ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>

            {authError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
          </div>

          {/* 2. Spreadsheet Link & Sheet Target */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-blue-400" />
              <span>Target File Google Spreadsheet</span>
            </h4>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Paste URL Google Sheets (contoh: https://docs.google.com/spreadsheets/d/.../edit)"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                disabled={!googleUser}
                className="flex-1 bg-slate-950 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:border-emerald-500 focus:outline-hidden placeholder:text-slate-500 disabled:opacity-50"
              />
              <button
                onClick={handleConnectSpreadsheet}
                disabled={!googleUser || isLoadingMetadata || !spreadsheetInput}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMetadata ? 'animate-spin' : ''}`} />
                <span>{isLoadingMetadata ? 'Memeriksa...' : 'Hubungkan & Periksa'}</span>
              </button>
            </div>

            {metadata && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="text-slate-400">Judul Dokumen: </span>
                    <strong className="text-white">{metadata.title}</strong>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ID: {config.spreadsheetId.substring(0, 16)}...
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 whitespace-nowrap">Pilih Sheet / Tab:</label>
                  <select
                    value={config.selectedSheetTitle}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:border-emerald-500 focus:outline-hidden"
                  >
                    {metadata.sheets.map((s) => (
                      <option key={s.sheetId} value={s.title}>
                        {s.title} {s.title.toUpperCase() === 'ALL' ? '(Roster Admin Lengkap)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {previewError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{previewError}</span>
                </div>
                {(previewError.toLowerCase().includes('izin') || previewError.toLowerCase().includes('scope')) && (
                  <button
                    type="button"
                    onClick={() => handleGoogleLogin(true)}
                    disabled={isAuthenticating}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition cursor-pointer whitespace-nowrap self-start sm:self-center"
                  >
                    {isAuthenticating ? 'Menghubungkan...' : 'Login Ulang dengan Izin Spreadsheet'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Validation Summary Report & Prevention Toggles / Intelligent Area Mapping */}
          {previewTrips.length > 0 && (
            <div className="space-y-4">
              {/* Tab Switcher: Audit vs Area Mapping vs Crew Mapping */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveSyncTab('validation')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    activeSyncTab === 'validation'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Audit &amp; Validasi Data ({effectiveSyncCount}/{validationReport.totalRows})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSyncTab('area_mapping')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer relative ${
                    activeSyncTab === 'area_mapping'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pemetaan Area Cerdas</span>
                  {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                      {Object.values(detectedAreaMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                      {Object.keys(detectedAreaMappings).length} Area
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSyncTab('crew_mapping')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer relative ${
                    activeSyncTab === 'crew_mapping'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-blue-300" />
                  <span>Pemetaan Kru Pengirim</span>
                  {Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                      {Object.values(detectedCrewMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                      {Object.keys(detectedCrewMappings).length} Kru
                    </span>
                  )}
                </button>
              </div>

              {activeSyncTab === 'area_mapping' ? (
                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  <AreaAutoMappingSection
                    areaMappings={detectedAreaMappings}
                    officialAreas={officialAreasList}
                    onMappingChange={handleMappingChange}
                    onRequestCreateArea={(rawArea) => setQuickCreateAreaTarget(rawArea)}
                  />
                </div>
              ) : activeSyncTab === 'crew_mapping' ? (
                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  <CrewAutoMappingSection
                    crewMappings={detectedCrewMappings}
                    officialCrews={officialCrewsList}
                    onMappingChange={handleCrewMappingChange}
                    onRequestCreateCrew={(rawCrew, roleHint) => setQuickCreateCrewTarget({ name: rawCrew, roleHint })}
                  />
                </div>
              ) : (
                <>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Laporan Audit Validasi Data ({validationReport.totalRows} Baris)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Siap Disinkronkan: <strong className="text-emerald-400">{effectiveSyncCount}</strong> dari {validationReport.totalRows}
                  </span>
                </div>

                {/* KPI Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold block">Total Baris</span>
                    <span className="text-lg font-bold text-white">{validationReport.totalRows}</span>
                  </div>

                  <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 font-semibold block">🟢 Lolos Validasi</span>
                    <span className="text-lg font-bold text-emerald-300">{validationReport.validCount}</span>
                  </div>

                  <div className="bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/30">
                    <span className="text-[10px] text-amber-400 font-semibold block">🟡 Duplikat Terdeteksi</span>
                    <span className="text-lg font-bold text-amber-300">{validationReport.duplicateCount}</span>
                  </div>

                  <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/30">
                    <span className="text-[10px] text-rose-400 font-semibold block">🔴 Format Tidak Valid</span>
                    <span className="text-lg font-bold text-rose-300">
                      {validationReport.invalidDateCount + validationReport.invalidPoCount + validationReport.missingFieldCount}
                    </span>
                  </div>
                </div>

                {/* Validation Policy Toggles */}
                <div className="pt-3 border-t border-slate-850 space-y-2.5 text-xs">
                  <span className="text-[11px] font-bold text-slate-300 block">Kebijakan Proteksi Data:</span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-start gap-2 text-slate-300 cursor-pointer select-none bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-semibold text-white block">Cegah Entri Duplikat</span>
                        <span className="text-[10px] text-slate-400">Lewati entri jika nomor PO sudah ada di sistem atau supir sudah bertugas pada hari yang sama.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 text-slate-300 cursor-pointer select-none bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                      <input
                        type="checkbox"
                        checked={skipInvalid}
                        onChange={(e) => setSkipInvalid(e.target.checked)}
                        className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-semibold text-white block">Tolak Format Tidak Valid</span>
                        <span className="text-[10px] text-slate-400">Blokir tanggal salah, nomor PO rusak, atau baris yang kehilangan field supir/tujuan.</span>
                      </div>
                    </label>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 text-slate-400 hover:text-slate-300 cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={overwriteDuplicates}
                        disabled={!skipDuplicates}
                        onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                      />
                      <span>Jika nomor PO sudah terdaftar, perbarui (*overwrite*) data jadwal yang ada daripada melewatinya.</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 4. Detailed Validation Table with Filters */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    <button
                      onClick={() => setPreviewFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        previewFilter === 'all' 
                          ? 'bg-slate-700 text-white' 
                          : 'bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      Semua ({validationReport.totalRows})
                    </button>

                    <button
                      onClick={() => setPreviewFilter('valid')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                        previewFilter === 'valid' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-950 text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      <span>Lolos</span>
                      <span className="text-[10px] bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                        {validationReport.canSyncCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewFilter('duplicate')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                        previewFilter === 'duplicate' 
                          ? 'bg-amber-600 text-white' 
                          : 'bg-slate-950 text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span>Duplikat</span>
                      <span className="text-[10px] bg-amber-950/80 px-1.5 py-0.2 rounded-full border border-amber-500/30">
                        {validationReport.duplicateCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                        previewFilter === 'invalid' 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-slate-950 text-rose-400 hover:text-rose-300'
                      }`}
                    >
                      <span>Tidak Valid</span>
                      <span className="text-[10px] bg-rose-950/80 px-1.5 py-0.2 rounded-full border border-rose-500/30">
                        {validationReport.invalidDateCount + validationReport.invalidPoCount + validationReport.missingFieldCount}
                      </span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Menampilkan {filteredPreviewItems.length} entri
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800 sticky top-0 z-10">
                        <th className="p-2.5 w-10 text-center">NO</th>
                        <th className="p-2.5">NOMOR PO / RESI</th>
                        <th className="p-2.5">TANGGAL</th>
                        <th className="p-2.5">DRIVER & HELPER</th>
                        <th className="p-2.5">AREA & ARMADA</th>
                        <th className="p-2.5">STATUS VALIDASI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredPreviewItems.map((item) => {
                        const hasErrors = item.issues.some(i => i.severity === 'error');
                        const hasWarnings = item.issues.some(i => i.severity === 'warning');

                        return (
                          <tr 
                            key={item.index} 
                            className={`transition hover:bg-slate-850/40 ${
                              hasErrors 
                                ? 'bg-rose-950/15' 
                                : item.isDuplicate 
                                ? 'bg-amber-950/15' 
                                : ''
                            }`}
                          >
                            <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">
                              {item.rowNumber}
                            </td>

                            <td className="p-2.5 font-mono font-semibold text-slate-200">
                              <div className="flex items-center gap-1.5">
                                <span>{item.poNumber}</span>
                                {item.status === 'invalid_po' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    PO Salah
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2.5 text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                <span>{item.dateDisplay}</span>
                                {item.status === 'invalid_date' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    Tanggal Error
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2.5">
                              <div className="font-bold text-white">{item.driverName || '-'}</div>
                              {item.helperName && (
                                <div className="text-[10px] text-slate-400">Helper: {item.helperName}</div>
                              )}
                            </td>

                            <td className="p-2.5">
                              <div className="text-slate-200 font-semibold">{item.areaName}</div>
                              <div className="text-[10px] font-mono text-amber-400 font-bold">{item.armadaName}</div>
                            </td>

                            <td className="p-2.5">
                              {item.isValid && !item.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Lolos Validasi</span>
                                </span>
                              ) : item.isDuplicate ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{item.status === 'duplicate_assignment' ? 'Bentrok Supir' : 'Duplikat PO'}</span>
                                  </span>
                                  <p className="text-[10px] text-amber-400/80 mt-0.5 max-w-[200px] truncate" title={item.issues[0]?.message}>
                                    {item.issues[0]?.message}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    <Ban className="w-3 h-3" />
                                    <span>Format Ditolak</span>
                                  </span>
                                  <p className="text-[10px] text-rose-400/80 mt-0.5 max-w-[200px] truncate" title={item.issues[0]?.message}>
                                    {item.issues[0]?.message}
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* Sync Result Banner */}
          {syncResult && (
            <div className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              syncResult.success 
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center gap-2.5">
                {syncResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <span className="font-semibold block">{syncResult.message}</span>
                  {syncResult.success && (
                    <span className="text-[10px] text-emerald-400 block mt-0.5">
                      {syncResult.count} jadwal masuk &bull; {syncResult.skippedDuplicate} duplikat diabaikan &bull; {syncResult.skippedInvalid} baris salah dicegah
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>Target: Tabel Jadwal Pengiriman & Muat</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>

            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!googleUser || !config.spreadsheetId || previewTrips.length === 0 || effectiveSyncCount === 0 || isSyncing}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Sparkles className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing 
                  ? 'Menyinkronkan...' 
                  : `⚡ Sinkronkan ${effectiveSyncCount} Jadwal Tervalidasi`}
              </span>
            </button>
          </div>
        </div>

        {/* Confirmation Dialog with Detailed Validation Breakdown */}
        {showConfirmDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-emerald-400">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Konfirmasi Sinkronisasi Tervalidasi</h4>
                  <p className="text-xs text-slate-400">Proteksi database operasional logistik</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Sistem akan memproses <strong className="text-white font-bold">{effectiveSyncCount} rute pengiriman valid</strong> dari Sheet <strong className="text-emerald-400">&quot;{config.selectedSheetTitle}&quot;</strong>:
              </p>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] space-y-2">
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span>🟢 Jadwal Masuk Operasional:</span>
                  <span>{effectiveSyncCount} entri</span>
                </div>

                {validationReport.duplicateCount > 0 && (
                  <div className="flex items-center justify-between text-amber-400">
                    <span>🟡 Duplikat Dicegah (Dilewati):</span>
                    <span>{skipDuplicates && !overwriteDuplicates ? validationReport.duplicateCount : 0} entri</span>
                  </div>
                )}

                {(validationReport.invalidDateCount + validationReport.invalidPoCount + validationReport.missingFieldCount) > 0 && (
                  <div className="flex items-center justify-between text-rose-400">
                    <span>🔴 Format Tidak Valid (Ditolak):</span>
                    <span>{skipInvalid ? (validationReport.invalidDateCount + validationReport.invalidPoCount + validationReport.missingFieldCount) : 0} entri</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleExecuteSync}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Konfirmasi & Sinkronkan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Create Area Dialog */}
        <QuickCreateAreaModal
          isOpen={quickCreateAreaTarget !== null}
          onClose={() => setQuickCreateAreaTarget(null)}
          rawAreaName={quickCreateAreaTarget || ''}
          onAreaCreated={handleAreaCreated}
        />

        {/* Quick Create Crew Dialog */}
        <QuickCreateCrewModal
          isOpen={quickCreateCrewTarget !== null}
          onClose={() => setQuickCreateCrewTarget(null)}
          rawCrewName={quickCreateCrewTarget?.name || ''}
          roleHint={quickCreateCrewTarget?.roleHint || 'Driver'}
          onCrewCreated={handleCrewCreated}
        />

      </div>
    </div>
  );
};
