import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { RetailStore, UserRole } from '../types';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { LeafletMap } from './LeafletMap';
import { logisticsStore } from '../services/store';
import {
  extractCoordinatesFromObject,
  getStoreLocationType,
  StoreLocationType
} from '../utils/coordinateParser';
import {
  MapPin,
  Search,
  Building2,
  Phone,
  Clock,
  Navigation,
  Plus,
  Layers,
  Globe,
  Warehouse,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Sliders,
  Download,
  Upload,
  Filter,
  Trash2
} from 'lucide-react';

interface CustomerMappingProps {
  stores?: RetailStore[];
  onCreateScheduleForStore?: (storeId: string) => void;
  onScheduleForStore?: (store: RetailStore) => void;
  onAddStore?: (store: Omit<RetailStore, 'id'>) => void;
  currentRole?: UserRole;
}

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const CustomerMapping: React.FC<CustomerMappingProps> = ({
  stores: propStores,
  onCreateScheduleForStore,
  onScheduleForStore,
  onAddStore,
  currentRole = 'super_admin'
}) => {
  const [storeList, setStoreList] = useState<RetailStore[]>(propStores || logisticsStore.getStores());

  React.useEffect(() => {
    if (propStores) {
      setStoreList(propStores);
    } else {
      const unsub = logisticsStore.subscribe(() => {
        setStoreList(logisticsStore.getStores());
      });
      return unsub;
    }
  }, [propStores]);

  const stores = storeList;

  const handleTriggerSchedule = (targetStore: RetailStore) => {
    if (onScheduleForStore) {
      onScheduleForStore(targetStore);
    } else if (onCreateScheduleForStore) {
      onCreateScheduleForStore(targetStore.id);
    }
  };

  const canEdit =
    currentRole === 'super_admin' ||
    currentRole === 'spv_logistik' ||
    currentRole === 'operasional' ||
    currentRole === 'dispatcher';
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedRegionType, setSelectedRegionType] = useState<'all' | StoreLocationType>('all');
  const [selectedKabupaten, setSelectedKabupaten] = useState<string>('all');
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<RetailStore | null>(stores[0] || null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadStorePageOpen, setIsUploadStorePageOpen] = useState(false);
  const [selectedUploadFileName, setSelectedUploadFileName] = useState('');
  const [parsedUploadStores, setParsedUploadStores] = useState<RetailStore[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [importBanner, setImportBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Radius Search States
  const [isRadiusMode, setIsRadiusMode] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [radiusPivotType, setRadiusPivotType] = useState<'warehouse' | 'selected_store' | 'map_click'>('warehouse');
  const [customCenter, setCustomCenter] = useState<[number, number]>(CENTRAL_WAREHOUSE.coordinates);

  // Add Store Form State (matching exact Excel template columns: Nomor, Nama Toko, Kecamatan, Kabupaten, Latitude, Longitude)
  const [nomorInput, setNomorInput] = useState<string>(String(stores.length + 1));
  const [storeName, setStoreName] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kabupaten, setKabupaten] = useState('Banyuwangi');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState('08:00 - 16:00');

  const activeRadiusCenter: [number, number] = useMemo(() => {
    if (radiusPivotType === 'warehouse') {
      return CENTRAL_WAREHOUSE.coordinates;
    }
    if (radiusPivotType === 'selected_store' && selectedStore) {
      const c = extractCoordinatesFromObject(selectedStore, 0);
      return [c.latitude, c.longitude];
    }
    return customCenter;
  }, [radiusPivotType, selectedStore, customCenter]);

  const normalizedStores = useMemo(() => {
    return stores
      .filter(st => {
        const nameLower = (st.storeName || '').trim().toLowerCase();
        if (!nameLower) return false;
        if (/^toko\s+ritel\b/i.test(nameLower)) return false;
        if (/indomar(e|ke)t|alfamart/i.test(nameLower)) return false;
        return true;
      })
      .map((st, idx) => {
        const coords = extractCoordinatesFromObject(st, idx);
        const locType = getStoreLocationType({ ...st, latitude: coords.latitude, longitude: coords.longitude });
        const resolvedKabupaten =
          (st.kabupaten || st.city || (locType === 'dalam_kota' ? 'Banyuwangi' : locType === 'luar_kota' ? 'Jember' : 'Denpasar'))
            .replace(/\s*\(.*?\)/g, '')
            .replace(/^Kota\s+/i, '')
            .trim() || 'Banyuwangi';
        const resolvedKecamatan =
          (st.kecamatan || ((st.city || '').match(/\((.*?)\)/)?.[1]) || '-')
            .trim();

        return {
          ...st,
          nomor: st.nomor ?? idx + 1,
          kecamatan: resolvedKecamatan,
          kabupaten: resolvedKabupaten,
          latitude: coords.latitude,
          longitude: coords.longitude,
          locType
        };
      });
  }, [stores]);

  // Counts by 3 Region Types
  const regionStats = useMemo(() => {
    const dalamKota = normalizedStores.filter(s => s.locType === 'dalam_kota').length;
    const luarKota = normalizedStores.filter(s => s.locType === 'luar_kota').length;
    const luarPulau = normalizedStores.filter(s => s.locType === 'luar_pulau').length;
    return { dalamKota, luarKota, luarPulau, total: normalizedStores.length };
  }, [normalizedStores]);

  // Unique Kabupaten list with their region type & count
  const kabupatenList = useMemo(() => {
    const map = new Map<string, { name: string; count: number; locType: StoreLocationType }>();
    normalizedStores.forEach(s => {
      const kab = s.kabupaten || 'Banyuwangi';
      const key = kab.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { name: kab, count: 1, locType: s.locType });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const order: Record<StoreLocationType, number> = { dalam_kota: 1, luar_kota: 2, luar_pulau: 3 };
      if (order[a.locType] !== order[b.locType]) return order[a.locType] - order[b.locType];
      return b.count - a.count;
    });
  }, [normalizedStores]);

  // Unique Kecamatan list for the currently selected Kabupaten / Region
  const kecamatanList = useMemo(() => {
    const set = new Set<string>();
    normalizedStores.forEach(s => {
      if (selectedRegionType !== 'all' && s.locType !== selectedRegionType) return;
      if (selectedKabupaten !== 'all' && (s.kabupaten || '').toLowerCase() !== selectedKabupaten.toLowerCase()) return;
      if (s.kecamatan && s.kecamatan !== '-') {
        set.add(s.kecamatan);
      }
    });
    return Array.from(set).sort();
  }, [normalizedStores, selectedRegionType, selectedKabupaten]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return normalizedStores
      .map(st => {
        const distFromPivot = calculateHaversineDistanceKm(
          activeRadiusCenter[0],
          activeRadiusCenter[1],
          st.latitude,
          st.longitude
        );
        return {
          ...st,
          distanceFromPivotKm: distFromPivot
        };
      })
      .filter(st => {
        if (selectedRegionType !== 'all' && st.locType !== selectedRegionType) {
          return false;
        }
        if (selectedKabupaten !== 'all' && (st.kabupaten || '').toLowerCase() !== selectedKabupaten.toLowerCase()) {
          return false;
        }
        if (selectedKecamatan !== 'all' && (st.kecamatan || '').toLowerCase() !== selectedKecamatan.toLowerCase()) {
          return false;
        }
        if (isRadiusMode && st.distanceFromPivotKm > radiusKm) {
          return false;
        }
        if (!q) return true;
        return (
          String(st.nomor || '').toLowerCase().includes(q) ||
          (st.storeName || '').toLowerCase().includes(q) ||
          (st.kecamatan || '').toLowerCase().includes(q) ||
          (st.kabupaten || '').toLowerCase().includes(q) ||
          (st.storeCode || '').toLowerCase().includes(q) ||
          (st.address || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (isRadiusMode) return a.distanceFromPivotKm - b.distanceFromPivotKm;
        return Number(a.nomor || 0) - Number(b.nomor || 0);
      });
  }, [normalizedStores, selectedRegionType, selectedKabupaten, selectedKecamatan, searchQuery, isRadiusMode, radiusKm, activeRadiusCenter]);

  const getRegionBadgeClasses = (locType: StoreLocationType) => {
    if (locType === 'dalam_kota') {
      // BIRU = Dalam Kota
      return {
        label: 'Dalam Kota',
        badge: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
        dot: 'bg-blue-500',
        chipActive: 'bg-blue-600 text-white border-blue-400 shadow-md',
        chipIdle: 'bg-blue-950/30 text-blue-300 border-blue-500/30 hover:bg-blue-900/40'
      };
    }
    if (locType === 'luar_kota') {
      // KUNING = Luar Kota
      return {
        label: 'Luar Kota',
        badge: 'bg-amber-400/20 text-amber-300 border-amber-400/50',
        dot: 'bg-amber-400',
        chipActive: 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-md',
        chipIdle: 'bg-amber-950/30 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
      };
    }
    // HIJAU = Luar Pulau
    return {
      label: 'Luar Pulau',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      dot: 'bg-emerald-500',
      chipActive: 'bg-emerald-600 text-white border-emerald-400 shadow-md',
      chipIdle: 'bg-emerald-950/30 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
    };
  };

  // Unduh Template Excel (.XLSX) dengan kolom persis: No, Nama Toko, Latitude, Longitude
  const handleDownloadTemplateExcel = () => {
    const templateRows = [
      {
        No: 1,
        'Nama Toko': 'TK HOLLY GENTENG',
        Latitude: -8.364532,
        Longitude: 114.193750
      },
      {
        No: 2,
        'Nama Toko': 'BU TIWI GENTENG',
        Latitude: -8.365165,
        Longitude: 114.145370
      },
      {
        No: 3,
        'Nama Toko': 'TOKO SUMBER PLASTIK JEMBER',
        Latitude: -8.168950,
        Longitude: 113.714820
      },
      {
        No: 4,
        'Nama Toko': 'TOKO MAJU JAYA SITUBONDO',
        Latitude: -7.714850,
        Longitude: 114.034920
      },
      {
        No: 5,
        'Nama Toko': 'UD KEMASAN MAKMUR BONDOWOSO',
        Latitude: -7.913480,
        Longitude: 113.821450
      },
      {
        No: 6,
        'Nama Toko': 'WARUNG JAWA MUSLIM RENA PULAU BUNGIN',
        Latitude: -8.676800,
        Longitude: 115.204500
      },
      {
        No: 7,
        'Nama Toko': 'DISTRIBUSI KEMASAN SAMSAM TABANAN',
        Latitude: -8.532500,
        Longitude: 115.098500
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Pelanggan');
    XLSX.writeFile(wb, 'Template_Data_Pelanggan_AKK.xlsx');
  };

  // Ekspor seluruh data pelanggan saat ini ke file Excel (.XLSX)
  const handleExportCurrentStoresExcel = () => {
    const rows = filteredStores.map((st, idx) => ({
      No: st.nomor ?? idx + 1,
      'Nama Toko': st.storeName,
      Latitude: st.latitude,
      Longitude: st.longitude,
      'Kategori Wilayah':
        st.locType === 'dalam_kota'
          ? 'Dalam Kota (Biru)'
          : st.locType === 'luar_kota'
          ? 'Luar Kota (Kuning)'
          : 'Luar Pulau (Hijau)'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Pelanggan_AKK');
    XLSX.writeFile(wb, `Data_Pelanggan_Mitra_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Helper inferensi Kabupaten dari koordinat GPS apabila kolom Kabupaten tidak ada di Excel
  const inferKabupatenFromCoords = (lat: number, lng: number, rawName: string): string => {
    const upper = rawName.toUpperCase();
    if (upper.includes('JEMBER')) return 'Jember';
    if (upper.includes('SITUBONDO') || upper.includes('ASEMBAGUS')) return 'Situbondo';
    if (upper.includes('BONDOWOSO')) return 'Bondowoso';
    if (upper.includes('DENPASAR')) return 'Denpasar';
    if (upper.includes('BADUNG') || upper.includes('KUTA') || upper.includes('MENGWI')) return 'Badung';
    if (upper.includes('TABANAN')) return 'Tabanan';
    if (upper.includes('JEMBRANA') || upper.includes('GILIMANUK') || upper.includes('NEGARA')) return 'Jembrana';
    if (upper.includes('SINGARAJA') || upper.includes('BULELENG')) return 'Buleleng';
    if (lng >= 114.42) {
      if (lng < 114.85) return 'Jembrana';
      if (lat < -8.68) return 'Badung';
      if (lng < 115.16) return 'Tabanan';
      return 'Denpasar';
    }
    if (lat > -7.85 && lng < 114.3) return 'Situbondo';
    if (lng < 113.95 && lat > -8.02) return 'Bondowoso';
    if (lng < 113.98) return 'Jember';
    return 'Banyuwangi';
  };

  // Baca file Excel pada halaman Upload Data Pelanggan (Kolom otomatis: No, Nama Toko, Latitude, Longitude)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedUploadFileName(file.name);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          setImportBanner({
            type: 'error',
            message: 'File Excel kosong atau tidak memiliki baris data pelanggan.'
          });
          return;
        }

        const parsedStores: RetailStore[] = [];
        let skippedInvalidCoords = 0;

        rawRows.forEach((row, index) => {
          const keys = Object.keys(row);
          const findVal = (patterns: string[]) => {
            const matchedKey = keys.find(k => {
              const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return patterns.some(p => clean === p || clean.includes(p));
            });
            return matchedKey ? row[matchedKey] : '';
          };

          const rawNomor = findVal(['no', 'nomor', 'urut', 'id']);
          const rawNamaToko = String(
            findVal(['namatoko', 'namaoutlet', 'namapelanggan', 'toko', 'pelanggan', 'storename', 'customer', 'mitra', 'nama']) || ''
          ).trim();

          if (!rawNamaToko || rawNamaToko.toLowerCase() === 'nama toko') return;
          if (/^toko\s+ritel\b/i.test(rawNamaToko)) return;
          if (/indomar(e|ke)t|alfamart/i.test(rawNamaToko)) return;

          const rawLat = findVal(['latitude', 'lat', 'lintang', 'koordinatlat']);
          const rawLng = findVal(['longitude', 'lng', 'lon', 'long', 'bujur', 'koordinatlng']);

          const tempObj = {
            storeName: rawNamaToko,
            latitude: rawLat,
            longitude: rawLng
          };

          const coords = extractCoordinatesFromObject(tempObj, index);
          if (!coords.isValid) {
            skippedInvalidCoords += 1;
            return;
          }

          const rawKecamatan = String(findVal(['kecamatan', 'kec', 'district', 'subdistrict']) || '-').trim();
          const rawKabFromSheet = String(findVal(['kabupaten', 'kab', 'kota', 'city', 'regency', 'daerah']) || '').trim();
          const resolvedKabupaten = rawKabFromSheet || inferKabupatenFromCoords(coords.latitude, coords.longitude, rawNamaToko);

          const locType = getStoreLocationType({
            storeName: rawNamaToko,
            kecamatan: rawKecamatan,
            kabupaten: resolvedKabupaten,
            city: resolvedKabupaten,
            latitude: coords.latitude,
            longitude: coords.longitude
          });

          const island: RetailStore['island'] =
            locType === 'luar_pulau' ? 'Bali & Nusa Tenggara' : 'Jawa';
          const province = locType === 'luar_pulau' ? 'Bali' : 'Jawa Timur';
          const kabPrefix = resolvedKabupaten.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'BWI';
          const nomorVal = rawNomor !== '' ? rawNomor : parsedStores.length + 1;

          parsedStores.push({
            id: `str-xls-${Date.now()}-${index}`,
            nomor: nomorVal,
            storeCode: `RET-${kabPrefix}-${String(nomorVal).padStart(3, '0')}`,
            storeName: rawNamaToko,
            kecamatan: rawKecamatan || '-',
            kabupaten: resolvedKabupaten,
            island,
            province,
            city: resolvedKabupaten,
            address: resolvedKabupaten,
            latitude: coords.latitude,
            longitude: coords.longitude,
            contactPerson: 'PIC Toko',
            phone: '-',
            deliveryWindow: '08:00 - 16:00',
            storeCategory: 'Mitra Distributor'
          });
        });

        if (parsedStores.length === 0) {
          setParsedUploadStores([]);
          setShowUploadPreview(false);
          setImportBanner({
            type: 'error',
            message:
              skippedInvalidCoords > 0
                ? `Seluruh baris (${skippedInvalidCoords} baris) dilewati karena koordinat Latitude/Longitude kosong atau tidak valid.`
                : 'Tidak ditemukan kolom "No, Nama Toko, Latitude, Longitude" yang valid. Gunakan Template Excel yang telah disediakan.'
          });
          return;
        }

        setParsedUploadStores(parsedStores);
        setShowUploadPreview(true);
        setImportBanner({
          type: 'success',
          message: `File "${file.name}" berhasil dibaca (${parsedStores.length} toko valid${
            skippedInvalidCoords > 0 ? `, ${skippedInvalidCoords} baris dilewati` : ''
          }). Klik "Simpan Data Pelanggan" untuk menerapkan ke peta.`
        });
      } catch (err: any) {
        setImportBanner({
          type: 'error',
          message: `Gagal membaca file Excel: ${err?.message || 'Format tidak dikenali'}`
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveUploadedStores = () => {
    if (parsedUploadStores.length === 0) {
      setImportBanner({
        type: 'error',
        message: 'Silakan pilih file Excel yang berisi data pelanggan terlebih dahulu.'
      });
      return;
    }

    logisticsStore.setStores(parsedUploadStores);
    setSelectedStore(parsedUploadStores[0] || null);
    setIsUploadStorePageOpen(false);
    setShowUploadPreview(false);
    setImportBanner({
      type: 'success',
      message: `Data berhasil disimpan! Menampilkan ${parsedUploadStores.length} toko pelanggan sesuai unggahan Excel.`
    });
  };

  const handleAddStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    const coords = extractCoordinatesFromObject(
      {
        storeName,
        kecamatan,
        kabupaten,
        latitude,
        longitude
      },
      stores.length
    );

    if (!coords.isValid) {
      setImportBanner({
        type: 'error',
        message: 'Koordinat Latitude dan Longitude wajib diisi dengan angka koordinat GPS yang valid.'
      });
      return;
    }

    const locType = getStoreLocationType({
      storeName,
      kecamatan,
      kabupaten,
      city: kabupaten,
      latitude: coords.latitude,
      longitude: coords.longitude
    });

    const island: RetailStore['island'] =
      locType === 'luar_pulau' ? 'Bali & Nusa Tenggara' : 'Jawa';
    const province = locType === 'luar_pulau' ? 'Bali' : 'Jawa Timur';
    const kabPrefix = kabupaten.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'BWI';
    const cleanNomor = nomorInput.trim() || String(stores.length + 1);

    const newStorePayload: Omit<RetailStore, 'id'> = {
      nomor: cleanNomor,
      storeCode: `RET-${kabPrefix}-${String(cleanNomor).padStart(3, '0')}`,
      storeName: storeName.trim(),
      kecamatan: kecamatan.trim() || '-',
      kabupaten: kabupaten.trim() || 'Banyuwangi',
      island,
      province,
      city: kabupaten.trim() || 'Banyuwangi',
      address: address.trim() || `Kec. ${kecamatan.trim() || '-'}, Kab. ${kabupaten.trim() || 'Banyuwangi'}`,
      latitude: coords.latitude,
      longitude: coords.longitude,
      contactPerson: contactPerson.trim() || 'PIC Toko',
      phone: phone.trim() || '-',
      deliveryWindow: deliveryWindow || '08:00 - 16:00',
      storeCategory: 'Mitra Distributor'
    };

    if (onAddStore) {
      onAddStore(newStorePayload);
    } else {
      logisticsStore.addStore(newStorePayload);
    }

    setStoreName('');
    setAddress('');
    setContactPerson('');
    setPhone('');
    setNomorInput(String(stores.length + 2));
    setIsAddModalOpen(false);
  };

  if (isUploadStorePageOpen) {
    return (
      <div className="space-y-6 pb-8">
        <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
          {/* Green Header matching WMS Upload style */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white">
              <FileSpreadsheet className="w-6 h-6 shrink-0" />
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Upload Data Pelanggan (Excel)</h2>
                <p className="text-xs text-emerald-50/90">
                  Unggah file Excel daftar pelanggan untuk diperbarui ke peta distribusi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplateExcel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-bold text-xs shadow transition cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template Excel</span>
            </button>
          </div>

          <div className="p-6 space-y-5 bg-slate-900 text-slate-100">
            {importBanner && (
              <div
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs ${
                  importBanner.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importBanner.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportBanner(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Pilih File Excel */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
                PILIH FILE EXCEL (.XLSX, .XLS, .CSV)
              </label>
              <div className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileUpload}
                  className="text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer w-full"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Kolom yang dibaca otomatis: <strong className="text-slate-200">No, Nama Toko, Latitude, Longitude</strong>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsUploadStorePageOpen(false);
                  setShowUploadPreview(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition cursor-pointer"
              >
                ← Kembali
              </button>

              <button
                type="button"
                onClick={() => {
                  if (parsedUploadStores.length === 0) {
                    setImportBanner({
                      type: 'error',
                      message: 'Silakan pilih file Excel terlebih dahulu untuk melihat Preview Data.'
                    });
                    return;
                  }
                  setShowUploadPreview(prev => !prev);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition cursor-pointer shadow"
              >
                🔍 Preview Data {parsedUploadStores.length > 0 ? `(${parsedUploadStores.length})` : ''}
              </button>

              <button
                type="button"
                onClick={handleSaveUploadedStores}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Simpan Data Pelanggan</span>
              </button>
            </div>

            {/* Preview Table */}
            {showUploadPreview && parsedUploadStores.length > 0 && (
              <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400">
                    Preview File: {selectedUploadFileName} ({parsedUploadStores.length} Baris Valid)
                  </span>
                  <span className="text-slate-400">Kolom: No, Nama Toko, Latitude, Longitude</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-4">No</th>
                        <th className="py-2.5 px-4">Nama Toko</th>
                        <th className="py-2.5 px-4 text-right">Latitude</th>
                        <th className="py-2.5 px-4 text-right">Longitude</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parsedUploadStores.slice(0, 100).map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-4 font-mono font-bold text-blue-400">{item.nomor}</td>
                          <td className="py-2 px-4 text-slate-200 font-semibold">{item.storeName}</td>
                          <td className="py-2 px-4 text-right font-mono text-emerald-400">{Number(item.latitude).toFixed(6)}</td>
                          <td className="py-2 px-4 text-right font-mono text-emerald-400">{Number(item.longitude).toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Excel Upload Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>Database Jaringan Toko & Mitra Pelanggan (Integrasi Excel & Rute Armada)</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Peta Jaringan Toko & Mitra Pelanggan ({normalizedStores.length} Outlet)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Unggah data pelanggan dari Excel (<strong className="text-slate-200">No, Nama Toko, Latitude, Longitude</strong>). Terintegrasi langsung dengan Evaluasi Rute Armada Tracksolid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setImportBanner(null);
                setIsUploadStorePageOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Unggah Excel Pelanggan</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCurrentStoresExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Ekspor .XLSX</span>
          </button>
        </div>
      </div>

      {/* Import Feedback Banner */}
      {importBanner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs ${
            importBanner.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{importBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportBanner(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Kartu Ringkasan Wilayah dengan Warna Standar: Biru (Dalam Kota), Kuning (Luar Kota), Hijau (Luar Pulau) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
            <Warehouse className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Titik Keberangkatan Utama</div>
            <div className="text-sm font-bold text-white truncate">Gudang Banyuwangi DC</div>
            <div className="text-[11px] text-slate-500 font-mono">-8.1906, 114.3708 (Klatak)</div>
          </div>
        </div>

        {/* DALAM KOTA = BIRU */}
        <button
          type="button"
          onClick={() => {
            setSelectedRegionType(selectedRegionType === 'dalam_kota' ? 'all' : 'dalam_kota');
            setSelectedKabupaten('all');
            setSelectedKecamatan('all');
          }}
          className={`text-left p-4 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
            selectedRegionType === 'dalam_kota'
              ? 'bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-slate-900 border-blue-500/30 hover:border-blue-500/60'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
              <span className="w-3.5 h-3.5 rounded-full bg-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-blue-400 uppercase font-extrabold tracking-wider">Dalam Kota (Biru)</span>
              </div>
              <div className="text-lg font-black text-white">{regionStats.dalamKota} Outlet</div>
              <div className="text-[11px] text-slate-400">Kabupaten Banyuwangi</div>
            </div>
          </div>
        </button>

        {/* LUAR KOTA = KUNING */}
        <button
          type="button"
          onClick={() => {
            setSelectedRegionType(selectedRegionType === 'luar_kota' ? 'all' : 'luar_kota');
            setSelectedKabupaten('all');
            setSelectedKecamatan('all');
          }}
          className={`text-left p-4 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
            selectedRegionType === 'luar_kota'
              ? 'bg-amber-950/50 border-amber-400 ring-2 ring-amber-400/30'
              : 'bg-slate-900 border-amber-500/30 hover:border-amber-400/60'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-amber-300 uppercase font-extrabold tracking-wider">Luar Kota (Kuning)</span>
              </div>
              <div className="text-lg font-black text-white">{regionStats.luarKota} Outlet</div>
              <div className="text-[11px] text-slate-400">Jember, Situbondo, Bondowoso</div>
            </div>
          </div>
        </button>

        {/* LUAR PULAU = HIJAU */}
        <button
          type="button"
          onClick={() => {
            setSelectedRegionType(selectedRegionType === 'luar_pulau' ? 'all' : 'luar_pulau');
            setSelectedKabupaten('all');
            setSelectedKecamatan('all');
          }}
          className={`text-left p-4 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
            selectedRegionType === 'luar_pulau'
              ? 'bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-slate-900 border-emerald-500/30 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-md shrink-0">
              <span className="w-3.5 h-3.5 rounded-full bg-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-emerald-400 uppercase font-extrabold tracking-wider">Luar Pulau (Hijau)</span>
              </div>
              <div className="text-lg font-black text-white">{regionStats.luarPulau} Outlet</div>
              <div className="text-[11px] text-slate-400">Bali (Denpasar, Badung, Tabanan, Jembrana)</div>
            </div>
          </div>
        </button>
      </div>

      {/* Panel Pemfilteran Kabupaten & Kecamatan (Biru = Dalam Kota, Kuning = Luar Kota, Hijau = Luar Pulau) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Filter className="w-4 h-4 text-blue-400" />
            <span>Filter Wilayah & Kabupaten Pelanggan:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Dalam Kota = Biru
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Luar Kota = Kuning
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Luar Pulau = Hijau
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dropdown Filter Kecamatan */}
            <select
              value={selectedKecamatan}
              onChange={e => setSelectedKecamatan(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Kecamatan ({kecamatanList.length})</option>
              {kecamatanList.map(kec => (
                <option key={kec} value={kec}>
                  Kec. {kec}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nomor, nama toko, kecamatan, kabupaten..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Tombol Filter Kabupaten Berwarna (Biru / Kuning / Hijau) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedRegionType('all');
              setSelectedKabupaten('all');
              setSelectedKecamatan('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
              selectedRegionType === 'all' && selectedKabupaten === 'all'
                ? 'bg-slate-100 text-slate-900 border-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            Semua Kabupaten ({normalizedStores.length})
          </button>

          {kabupatenList.map(kab => {
            const isSelected = selectedKabupaten.toLowerCase() === kab.name.toLowerCase();
            const meta = getRegionBadgeClasses(kab.locType);
            return (
              <button
                key={kab.name}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedKabupaten('all');
                  } else {
                    setSelectedKabupaten(kab.name);
                    setSelectedRegionType('all');
                    setSelectedKecamatan('all');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border flex items-center gap-1.5 cursor-pointer ${
                  isSelected ? meta.chipActive : meta.chipIdle
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSelected && kab.locType === 'luar_kota' ? 'bg-slate-950' : meta.dot
                  }`}
                />
                <span>Kab. {kab.name}</span>
                <span className="opacity-80 font-mono text-[10px]">({kab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Radius Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRadiusMode(!isRadiusMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition border cursor-pointer ${
                isRadiusMode
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/25'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isRadiusMode ? 'Filter Radius Aktif' : 'Aktifkan Pencarian Radius Jarak'}</span>
            </button>

            {isRadiusMode && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">Pusat:</span>
                <button
                  type="button"
                  onClick={() => setRadiusPivotType('warehouse')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border transition ${
                    radiusPivotType === 'warehouse'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Gudang Banyuwangi DC
                </button>
                <button
                  type="button"
                  onClick={() => setRadiusPivotType('selected_store')}
                  disabled={!selectedStore}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border transition ${
                    radiusPivotType === 'selected_store'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white disabled:opacity-40'
                  }`}
                >
                  Toko Terpilih
                </button>
                <button
                  type="button"
                  onClick={() => setRadiusPivotType('map_click')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border transition ${
                    radiusPivotType === 'map_click'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Klik Titik di Peta
                </button>
              </div>
            )}
          </div>

          {isRadiusMode && (
            <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Jarak Maks:</span>
                <span className="text-sm font-extrabold text-blue-400 font-mono min-w-[60px]">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min={2}
                max={250}
                step={2}
                value={radiusKm}
                onChange={e => setRadiusKm(Number(e.target.value))}
                className="w-36 sm:w-48 accent-blue-500 cursor-pointer"
              />
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold">
                {filteredStores.length} Toko
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Split View: Map + Store Directory & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Interactive Map (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[620px]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">
                Visualisasi Spasial Jaringan Toko & Mitra ({filteredStores.length} Titik)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900"></span> Hub Gudang DC
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-blue-300">
                <span className="w-3 h-3 rounded-full bg-blue-600 border border-white"></span> Dalam Kota (Biru)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                <span className="w-3 h-3 rounded-full bg-amber-400 border border-slate-900"></span> Luar Kota (Kuning)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white"></span> Luar Pulau (Hijau)
              </span>
            </div>
          </div>

          <div className="flex-1 rounded-xl overflow-hidden relative">
            <LeafletMap
              stores={filteredStores}
              selectedStoreId={selectedStore?.id}
              onSelectStore={st => setSelectedStore(st)}
              onSchedule={st => handleTriggerSchedule(st)}
              showWarehouse={true}
              enableClustering={true}
              isRadiusMode={isRadiusMode}
              radiusCenter={activeRadiusCenter}
              radiusKm={radiusKm}
              onMapClickForRadius={coords => {
                if (isRadiusMode && radiusPivotType === 'map_click') {
                  setCustomCenter(coords);
                }
              }}
            />
          </div>
        </div>

        {/* Right: Store List & Selected Store Inspector (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-[620px]">
          {/* Store List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Daftar Pelanggan ({filteredStores.length} Toko)
              </h3>
              <span className="text-[11px] text-slate-500">Klik baris untuk detail & jadwal</span>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              {filteredStores.map(store => {
                const isSelected = selectedStore?.id === store.id;
                const badgeMeta = getRegionBadgeClasses(store.locType);
                return (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStore(store)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/60 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                            No. {store.nomor}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{store.storeName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          Lat: {store.latitude.toFixed(6)} | Lng: {store.longitude.toFixed(6)}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap border flex items-center gap-1 ${badgeMeta.badge}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${badgeMeta.dot}`} />
                        {badgeMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredStores.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Tidak ditemukan pelanggan untuk filter kabupaten/pencarian ini.
                </div>
              )}
            </div>
          </div>

          {/* Selected Store Inspector Card */}
          {selectedStore && (() => {
            const normSel = normalizedStores.find(s => s.id === selectedStore.id) || {
              ...selectedStore,
              nomor: selectedStore.nomor ?? '-',
              kecamatan: selectedStore.kecamatan || '-',
              kabupaten: selectedStore.kabupaten || selectedStore.city || 'Banyuwangi',
              locType: getStoreLocationType(selectedStore)
            };
            const badgeMeta = getRegionBadgeClasses(normSel.locType);

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shrink-0">
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                        Nomor: {normSel.nomor}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${badgeMeta.badge}`}>
                        <span className={`w-2 h-2 rounded-full ${badgeMeta.dot}`} />
                        {badgeMeta.label} • Kab. {normSel.kabupaten}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1.5">{normSel.storeName}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          logisticsStore.deleteStore(normSel.id);
                          setSelectedStore(filteredStores.find(s => s.id !== normSel.id) || null);
                        }}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                        title="Hapus Data Pelanggan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTriggerSchedule(normSel as any)}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition shrink-0 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Jadwalkan Kirim</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-3 text-xs">
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 block">Latitude</span>
                    <strong className="text-blue-300 font-mono">{Number(normSel.latitude).toFixed(6)}</strong>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-500 block">Longitude</span>
                    <strong className="text-blue-300 font-mono">{Number(normSel.longitude).toFixed(6)}</strong>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Add Customer Store Modal (matching Excel columns) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Tambah Data Pelanggan Baru</h3>
                  <p className="text-xs text-slate-400">Format standar sesuai Template Excel Pelanggan AKK</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStoreSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Nomor *</label>
                  <input
                    type="text"
                    required
                    value={nomorInput}
                    onChange={e => setNomorInput(e.target.value)}
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Nama Toko / Pelanggan *</label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder="Contoh: TK HOLLY GENTENG"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Kecamatan *</label>
                  <input
                    type="text"
                    required
                    value={kecamatan}
                    onChange={e => setKecamatan(e.target.value)}
                    placeholder="Contoh: Genteng / Kuta / Sumbersari"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Kabupaten / Kota *</label>
                  <input
                    type="text"
                    required
                    value={kabupaten}
                    onChange={e => setKabupaten(e.target.value)}
                    placeholder="Contoh: Banyuwangi / Jember / Denpasar"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Latitude (Garis Lintang) *</label>
                  <input
                    type="text"
                    required
                    value={latitude}
                    onChange={e => setLatitude(e.target.value)}
                    placeholder="-8.364532"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Longitude (Garis Bujur) *</label>
                  <input
                    type="text"
                    required
                    value={longitude}
                    onChange={e => setLongitude(e.target.value)}
                    placeholder="114.193750"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Alamat Lengkap (Opsional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Jl. Raya..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Data Pelanggan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
