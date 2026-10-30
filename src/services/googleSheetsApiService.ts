import { logisticsStore } from './store';
import { Schedule, ShipmentStatus, RetailStore } from '../types';
import { 
  scheduleImportValidator, 
  ValidatedImportItem, 
  ValidationSummaryReport, 
  ImportSyncOptions 
} from './scheduleImportValidator';
import { standardizeAreaName } from '../utils/areaNormalizer';
import { getAccessToken } from './googleAuthService';

export interface GoogleSpreadsheetMetadata {
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
    rowCount?: number;
    columnCount?: number;
  }>;
}

export interface ParsedSheetTrip {
  poNumber?: string;
  driver: string;
  helper?: string;
  helper2?: string;
  rawArea?: string;
  area: string;
  armada: string;
  dateStr?: string;
  dayName?: string;
  target?: string;
  departureTime?: string;
  targetReturnTime?: string;
  departureDateIso?: string;
  returnDateIso?: string;
  notes?: string;
  backup?: string;
}

export interface GoogleSheetsSyncConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  selectedSheetTitle: string;
  range: string;
  isAutoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number; // 5, 15, 30, 60
  lastSyncTimestamp: string | null;
  lastSyncStatus: 'success' | 'error' | 'idle' | 'in_progress';
  lastSyncMessage: string | null;
  totalSyncedCount: number;
}

const STORAGE_KEY = 'akk_google_sheets_schedule_sync_config';

export const googleSheetsApiService = {
  /**
   * Extract spreadsheet ID from various URL formats or returns raw ID.
   * e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
   */
  extractSpreadsheetId(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Return clean input if already an ID
    return trimmed.split('/')[0].split('?')[0];
  },

  /**
   * Get default or stored configuration
   */
  getConfig(): GoogleSheetsSyncConfig {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('Failed to load Google Sheets config:', e);
    }

    return {
      spreadsheetId: '',
      spreadsheetUrl: '',
      selectedSheetTitle: 'ALL',
      range: 'A1:Z100',
      isAutoSyncEnabled: false,
      autoSyncIntervalMinutes: 15,
      lastSyncTimestamp: null,
      lastSyncStatus: 'idle',
      lastSyncMessage: null,
      totalSyncedCount: 0
    };
  },

  /**
   * Save configuration
   */
  saveConfig(config: GoogleSheetsSyncConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save Google Sheets config:', e);
    }
  },

  /**
   * Parse CSV text into a 2D matrix of strings
   */
  parseCsvToMatrix(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const nextCh = csvText[i + 1];

      if (inQuotes) {
        if (ch === '"') {
          if (nextCh === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentCell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (ch === '\r') {
          // ignore carriage return
        } else if (ch === '\n') {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
        } else {
          currentCell += ch;
        }
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
    }

    return rows;
  },

  /**
   * Fetch spreadsheet metadata using Google Sheets v4 API with fallback to proxy
   */
  async getSpreadsheetMetadata(spreadsheetId: string, accessToken?: string | null): Promise<GoogleSpreadsheetMetadata> {
    const cleanId = this.extractSpreadsheetId(spreadsheetId);
    if (!cleanId) throw new Error('ID Spreadsheet tidak valid.');

    let scopeIssue = false;

    // 1. Try Google Sheets v4 API if access token is available
    if (accessToken) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          return {
            title: data.properties?.title || 'Google Spreadsheet',
            sheets: (data.sheets || []).map((s: any) => ({
              sheetId: s.properties?.sheetId,
              title: s.properties?.title,
              rowCount: s.properties?.gridProperties?.rowCount,
              columnCount: s.properties?.gridProperties?.columnCount
            }))
          };
        } else if (response.status === 403) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson.error?.message || '';
          if (errMsg.includes('insufficient authentication scopes') || errMsg.includes('PERMISSION_DENIED')) {
            scopeIssue = true;
          }
        }
      } catch (err: any) {
        console.warn('API metadata fetch warning:', err?.message || err);
      }
    }

    // 2. Try proxy sheet fetch if API call failed or had scope issues
    try {
      const proxyUrl = `/api/proxy-sheet?url=https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        const text = await proxyRes.text();
        if (text && text.trim().length > 10) {
          return {
            title: 'Google Spreadsheet (Tautan Publik / Proxy)',
            sheets: [
              { sheetId: 0, title: 'ALL' },
              { sheetId: 1, title: 'Sheet1' }
            ]
          };
        }
      }
    } catch {
      // proxy fallback failed
    }

    if (scopeIssue) {
      throw new Error('Izin akses spreadsheet Google diperlukan (insufficient scopes). Silakan klik tombol "Login Ulang dengan Izin Spreadsheet" untuk mengizinkan sinkronisasi.');
    }

    throw new Error('Gagal mengambil metadata spreadsheet. Pastikan spreadsheet ada dan dapat diakses.');
  },

  /**
   * Fetch cell values from a specified range with proxy fallback
   */
  async getSheetValues(spreadsheetId: string, range: string, accessToken?: string | null): Promise<any[][]> {
    const cleanId = this.extractSpreadsheetId(spreadsheetId);
    if (!cleanId) throw new Error('ID Spreadsheet tidak valid.');

    // Auto-acquire token from Google Auth if not explicitly passed
    let effectiveToken = accessToken;
    if (!effectiveToken) {
      try {
        effectiveToken = await getAccessToken();
      } catch {
        effectiveToken = null;
      }
    }

    // 1. Try Google Sheets v4 API if access token is available
    if (effectiveToken) {
      try {
        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedRange}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.values && data.values.length > 0) {
            return data.values;
          }
        }
      } catch (err: any) {
        console.warn('API getSheetValues warning, attempting proxy fallback:', err?.message || err);
      }
    }

    // 2. Fallback to proxy fetch (public sheet or authenticated proxy)
    try {
      const sheetTitle = range.includes('!') ? range.split('!')[0].trim().replace(/^'|'$/g, '') : '';
      const targetUrl = sheetTitle 
        ? `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetTitle)}`
        : `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv`;

      const headers: Record<string, string> = {};
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }

      const proxyRes = await fetch(`/api/proxy-sheet?url=${encodeURIComponent(targetUrl)}`, { headers });
      if (proxyRes.ok) {
        const csvText = await proxyRes.text();
        const matrix = this.parseCsvToMatrix(csvText);
        if (matrix.length > 0) {
          return matrix;
        }
      }
    } catch {
      // Fallback failed
    }

    throw new Error('Gagal membaca isi sel spreadsheet. Pastikan izin akses telah diberikan atau tautan spreadsheet dibagikan ke publik.');
  },

  /**
   * Append rows to a spreadsheet range via Google Sheets API or backend proxy
   */
  async appendSheetValues(spreadsheetId: string, range: string, values: any[][], accessToken?: string | null): Promise<boolean> {
    const cleanId = this.extractSpreadsheetId(spreadsheetId);
    if (!cleanId || !values || values.length === 0) return false;

    let effectiveToken = accessToken;
    if (!effectiveToken) {
      try {
        effectiveToken = await getAccessToken();
      } catch {
        effectiveToken = null;
      }
    }

    if (effectiveToken) {
      try {
        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values })
        });
        if (res.ok) return true;
      } catch (e) {
        console.warn('appendSheetValues API error:', e);
      }
    }

    // Try backend proxy sync if API token is missing or failed
    try {
      const res = await fetch('/api/sync-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sheet_append',
          spreadsheetId: cleanId,
          range,
          values
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Update specific cells in a spreadsheet via Google Sheets API or backend proxy
   */
  async updateSheetValues(spreadsheetId: string, range: string, values: any[][], accessToken?: string | null): Promise<boolean> {
    const cleanId = this.extractSpreadsheetId(spreadsheetId);
    if (!cleanId || !values || values.length === 0) return false;

    let effectiveToken = accessToken;
    if (!effectiveToken) {
      try {
        effectiveToken = await getAccessToken();
      } catch {
        effectiveToken = null;
      }
    }

    if (effectiveToken) {
      try {
        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values })
        });
        if (res.ok) return true;
      } catch (e) {
        console.warn('updateSheetValues API error:', e);
      }
    }

    // Try backend proxy sync
    try {
      const res = await fetch('/api/sync-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sheet_update',
          spreadsheetId: cleanId,
          range,
          values
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Automatically write / append a schedule item to Google Sheets
   */
  async writeScheduleToGoogleSheets(schedule: Schedule, action: 'create' | 'update' | 'delete'): Promise<boolean> {
    const conf = this.getConfig();
    const cleanId = this.extractSpreadsheetId(conf.spreadsheetId || conf.spreadsheetUrl);
    if (!cleanId) return false;

    const sheetTitle = conf.selectedSheetTitle || 'ALL';
    const depDate = schedule.departureDate ? new Date(schedule.departureDate) : new Date();
    const dateFormatted = `${String(depDate.getDate()).padStart(2, '0')}/${String(depDate.getMonth() + 1).padStart(2, '0')}/${depDate.getFullYear()}`;
    const driverName = schedule.crew?.name || schedule.crewId || 'Driver';
    const helperName = schedule.crewHelper?.name || schedule.crewHelperId || '-';
    const areaName = schedule.areaName || schedule.store?.storeName || 'Area Kirim';
    const armadaName = schedule.fleet?.initialCode || schedule.fleet?.plateNumber || schedule.fleetId || 'DS3';
    const targetDesc = schedule.notes || schedule.cargoDescription || 'Gudang Pusat AKK Banyuwangi DC';

    const rowData = [
      dateFormatted,
      schedule.trackingNumber || `PO-AKK-${Date.now().toString().slice(-4)}`,
      driverName,
      helperName,
      '',
      areaName,
      armadaName,
      targetDesc,
      action.toUpperCase(),
      new Date().toISOString()
    ];

    return this.appendSheetValues(cleanId, `${sheetTitle}!A:J`, [rowData]);
  },

  /**
   * Automatically write fleet status update to Google Sheets or backend
   */
  async writeFleetStatusToGoogleSheets(fleetId: string, status: string, payload?: any): Promise<boolean> {
    const conf = this.getConfig();
    const cleanId = this.extractSpreadsheetId(conf.spreadsheetId || conf.spreadsheetUrl);
    if (!cleanId) return false;

    const rowData = [
      new Date().toISOString().substring(0, 10),
      fleetId,
      status.toUpperCase(),
      payload?.cargoWeightTon || 0,
      payload?.currentOdometerKm || 0,
      new Date().toISOString()
    ];

    return this.appendSheetValues(cleanId, `FleetStatus!A:F`, [rowData]).catch(() => false);
  },

  /**
   * Automatically write image upload / proof of delivery attachment to backend & Google Sheets
   */
  async writeImageAttachmentToBackend(scheduleId: string, imageUrl: string, imageType: string, notes?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/sync-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image_attachment',
          scheduleId,
          imageUrl,
          imageType,
          notes,
          timestamp: new Date().toISOString()
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Parse rows from Sheet "ALL" or general tabular schedule
   */
  /**
   * Parse rows from Sheet "ALL" or general tabular schedule
   */
  parseScheduleRows(rows: any[][], customAreaMapping?: Record<string, string>): ParsedSheetTrip[] {
    const trips: ParsedSheetTrip[] = [];
    if (!rows || rows.length === 0) return trips;

    // Check if format is raw Sheet "ALL" (column headers like DRIVER, HELPER 1, HELPER 2, AREA, ARMADA)
    // Or standard 2D table
    let driverCol = -1;
    let helperCol = -1;
    let helper2Col = -1;
    let areaCol = -1;
    let armadaCol = -1;
    let dateCol = -1;
    let noCol = -1;
    let targetCol = -1;
    let poCol = -1;
    let headerRowIdx = -1;

    // Regex definitions for robust header detection (normalized whitespace & case-insensitive)
    const RE_NO = /^(NO|NO\.|NOMOR|NO[_\s.-]*URUT|URUT|#)(\b|$)/i;
    const RE_DRIVER = /^(DRIVER|SUPIR|PENGEMUDI|SOPIR)(\b|$)/i;
    const RE_HELPER_2 = /^(HELPER|KERNET|KENEK)[_\s/.-]*(2|II|B|DUA|KEDUA)(\b|$)/i;
    const RE_HELPER_1 = /^(HELPER|KERNET|KENEK)[_\s/.-]*(1|I|A|SATU|PERTAMA)?(\b|$)/i;
    const RE_HELPER_GENERIC = /^(HELPER|KERNET|KENEK)(\b|$)/i;
    const RE_AREA = /^(AREA|TUJUAN|KIRIM[_\s.-]*AREA|RUTE|WILAYAH|DESTINASI)(\b|$)/i;
    const RE_ARMADA = /^(ARMADA|MOBIL|PLAT|TRUK|NOPOL|NO[_\s.-]*POL|KENDARAAN)(\b|$)/i;
    const RE_DATE = /^(TANGGAL|TGL|DATE|HARI)(\b|$)/i;
    const RE_TARGET = /^(TARGET|CATATAN|NOTES|KETERANGAN|JAM|PO|NO[_\s.-]*PO|RESI|SJ)(\b|$)/i;

    // Search header row across first 10 rows
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;

      const nextRow = r + 1 < rows.length ? rows[r + 1] : null;

      for (let c = 0; c < row.length; c++) {
        const rawVal = String(row[c] || '').replace(/\s+/g, ' ').trim();
        const nextRowVal = nextRow && nextRow[c] !== undefined ? String(nextRow[c] || '').replace(/\s+/g, ' ').trim() : '';

        // Combined header if subheader exists (e.g. Row 0: "HELPER", Row 1: "1" -> "HELPER 1")
        const combinedVal = `${rawVal} ${nextRowVal}`.trim();

        if (RE_NO.test(rawVal)) noCol = c;
        if (RE_DRIVER.test(rawVal)) driverCol = c;

        // Specific Helper 2 check first
        if (RE_HELPER_2.test(combinedVal) || RE_HELPER_2.test(rawVal) || (nextRowVal === '2' && c > 1)) {
          helper2Col = c;
        } else if (RE_HELPER_1.test(combinedVal) || RE_HELPER_1.test(rawVal) || (nextRowVal === '1' && c > 1)) {
          if (helperCol === -1) {
            helperCol = c;
          } else if (helper2Col === -1 && c > helperCol) {
            helper2Col = c;
          }
        } else if (RE_HELPER_GENERIC.test(rawVal)) {
          if (helperCol === -1) {
            helperCol = c;
            // Check if column immediately to the right is sub-labeled "2" or "HELPER"
            if (c + 1 < row.length) {
              const rightVal = String(row[c + 1] || '').replace(/\s+/g, ' ').trim();
              const rightNextVal = nextRow && nextRow[c + 1] !== undefined ? String(nextRow[c + 1] || '').replace(/\s+/g, ' ').trim() : '';
              if (rightVal === '2' || rightNextVal === '2' || RE_HELPER_2.test(rightVal) || RE_HELPER_GENERIC.test(rightVal)) {
                helper2Col = c + 1;
              }
            }
          } else if (helper2Col === -1) {
            helper2Col = c;
          }
        }

        if (RE_AREA.test(rawVal) || rawVal.toUpperCase().includes('AREA') || rawVal.toUpperCase().includes('TUJUAN')) areaCol = c;
        if (RE_ARMADA.test(rawVal) || rawVal.toUpperCase().includes('ARMADA') || rawVal.toUpperCase().includes('PLAT')) armadaCol = c;
        if (RE_DATE.test(rawVal) || rawVal.toUpperCase().includes('TANGGAL') || rawVal.toUpperCase().includes('DATE')) dateCol = c;
        if (RE_TARGET.test(rawVal)) targetCol = c;
      }

      if (driverCol !== -1 && areaCol !== -1) {
        headerRowIdx = r;
        if (noCol === -1 && driverCol > 0) noCol = driverCol - 1;

        // Resolve dateCol if not on header row
        if (dateCol === -1) {
          for (let pr = 0; pr < r; pr++) {
            const prevRow = rows[pr];
            if (!prevRow) continue;
            for (let pc = 0; pc < prevRow.length; pc++) {
              const pVal = String(prevRow[pc] || '').replace(/\s+/g, ' ').trim().toUpperCase();
              if (RE_DATE.test(pVal) || pVal.includes('TANGGAL') || pVal.includes('DATE')) {
                dateCol = pc;
                break;
              }
            }
          }
          if (dateCol === -1 && noCol !== 0) {
            dateCol = 0;
          }
        }
        if (dateCol === noCol) {
          dateCol = -1;
        }

        // Positional fallback for Helper 1 and Helper 2 between Driver and Area columns
        // e.g. DRIVER is col 2, AREA is col 5 -> col 3 is Helper 1, col 4 is Helper 2!
        if (helperCol === -1 && areaCol > driverCol + 1) {
          helperCol = driverCol + 1;
        }
        if (helper2Col === -1 && helperCol !== -1 && areaCol > helperCol + 1) {
          helper2Col = helperCol + 1;
        }

        break;
      }
    }

    if (driverCol !== -1 && areaCol !== -1 && headerRowIdx !== -1) {
      // Helper function to scan a row for embedded date banners or date strings
      const scanRowForDate = (row: any[]): string | null => {
        if (!row || row.length === 0) return null;
        
        // 1. Check explicit dateCol if defined
        if (dateCol !== -1 && row[dateCol] !== undefined && row[dateCol] !== null) {
          const rawCell = row[dateCol];
          const val = String(rawCell).trim();
          if (val && val !== '-' && val !== '0') {
            const p = scheduleImportValidator.parseDate(rawCell, new Date(2026, 0, 5));
            if (p.date && !p.error) return val;
          }
        }

        // 2. Check candidate date cells in the row (exclude No, Driver, Helper, Area, Armada)
        for (let c = 0; c < row.length; c++) {
          if (c === noCol || c === driverCol || c === helperCol || c === helper2Col || c === areaCol || c === armadaCol) {
            continue;
          }
          const val = String(row[c] || '').trim();
          if (!val || val === '-' || val === '0' || /^\d+$/.test(val)) continue;
          
          const p = scheduleImportValidator.parseDate(val);
          if (p.date && !p.error) {
            return val;
          }
        }

        // 3. Test combined row text for multi-cell date banners like ["TANGGAL", "06", "JANUARI", "2026"]
        const rowText = row.map(cell => String(cell || '').trim()).filter(Boolean).join(' ');
        if (rowText.length >= 3 && rowText.length <= 100) {
          const p = scheduleImportValidator.parseDate(rowText);
          if (p.date && !p.error) {
            return rowText;
          }
        }

        return null;
      };

      // Check if a row represents a black line separator / day boundary
      const isSeparatorRow = (row: any[]): boolean => {
        if (!row || row.length === 0) return true;
        const nonEmpty = row.map(c => String(c || '').trim()).filter(Boolean);
        if (nonEmpty.length === 0) return true;

        const joined = nonEmpty.join(' ').toUpperCase();
        if (
          joined.includes('BLACK_ROW') || 
          joined.includes('SEPARATOR') || 
          /^[\-_=*#\s]+$/.test(joined)
        ) {
          return true;
        }

        const driverVal = driverCol !== -1 ? String(row[driverCol] || '').trim() : '';
        const areaVal = areaCol !== -1 ? String(row[areaCol] || '').trim() : '';
        if (!driverVal && !areaVal) return true;

        return false;
      };

      // Group rows into Day Blocks (Setiap hari dibatasi oleh garis hitam)
      interface RawDayBlock {
        explicitDate?: string;
        rows: Array<{
          driver: string;
          helper1?: string;
          helper2?: string;
          area: string;
          armada: string;
          target?: string;
          poNumber?: string;
          rawRow: any[];
          rowIdx: number;
          no?: number;
        }>;
      }

      const dayBlocks: RawDayBlock[] = [];
      let currentBlock: RawDayBlock = { rows: [] };

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const rowData = rows[i];
        if (!rowData) {
          if (currentBlock.rows.length > 0) {
            dayBlocks.push(currentBlock);
            currentBlock = { rows: [] };
          }
          continue;
        }

        // Check if row is an explicit date banner (e.g. "TANGGAL 5 BULAN 1", "SENIN, 05/01/2026", "05 Januari 2026")
        const dateBannerInRow = scanRowForDate(rowData);
        if (dateBannerInRow) {
          const dVal = driverCol !== -1 ? String(rowData[driverCol] || '').trim() : '';
          const aVal = areaCol !== -1 ? String(rowData[areaCol] || '').trim() : '';
          const isPureBanner = (!dVal || dVal === '-' || dVal === '0') && (!aVal || aVal === '-' || aVal === '0');

          if (currentBlock.rows.length > 0) {
            dayBlocks.push(currentBlock);
            currentBlock = { rows: [], explicitDate: dateBannerInRow };
          } else {
            currentBlock.explicitDate = dateBannerInRow;
          }

          if (isPureBanner) {
            continue;
          }
        }

        // Check if row is a black line separator
        if (isSeparatorRow(rowData)) {
          if (currentBlock.rows.length > 0) {
            dayBlocks.push(currentBlock);
            currentBlock = { rows: [] };
          }
          continue;
        }

        const driver = String(rowData[driverCol] || '').trim();
        const area = String(rowData[areaCol] || '').trim();
        const armada = armadaCol !== -1 ? String(rowData[armadaCol] || '').trim() : '-';
        const noStr = noCol !== -1 ? String(rowData[noCol] || '').trim() : '';
        const noNum = parseInt(noStr, 10);

        // Skip subheaders or non-assignment text
        if (
          driver.toUpperCase() === 'DRIVER' || 
          driver.toUpperCase() === 'SUPIR' || 
          area.toUpperCase() === 'AREA' || 
          area.toUpperCase() === 'AREA KIRIM' ||
          driver === '1' || 
          driver === '2'
        ) {
          continue;
        }

        // If "No" resets to 1 and current block already has items, that also marks a new day block!
        if (noNum === 1 && currentBlock.rows.length > 0) {
          dayBlocks.push(currentBlock);
          currentBlock = { rows: [] };
        }

        // Helper 1 and Helper 2
        let rawHelper1 = helperCol !== -1 ? String(rowData[helperCol] || '').trim() : undefined;
        let rawHelper2 = helper2Col !== -1 ? String(rowData[helper2Col] || '').trim() : undefined;

        // If rawHelper1 contains a comma/ampersand and rawHelper2 is empty, split it
        if (rawHelper1 && (rawHelper1.includes(',') || rawHelper1.includes('&') || rawHelper1.includes('/')) && (!rawHelper2 || rawHelper2 === '-' || rawHelper2 === '0')) {
          const splitParts = rawHelper1.split(/[,&/]+/);
          if (splitParts.length > 1) {
            rawHelper1 = splitParts[0].trim();
            rawHelper2 = splitParts.slice(1).join(', ').trim();
          }
        }

        const helper1Clean = (rawHelper1 && rawHelper1 !== '-' && rawHelper1 !== '0') ? rawHelper1 : '-';
        const helper2Clean = (rawHelper2 && rawHelper2 !== '-' && rawHelper2 !== '0') ? rawHelper2 : '-';

        const target = targetCol !== -1 ? String(rowData[targetCol] || '').trim() : undefined;
        const poNumber = poCol !== -1 ? String(rowData[poCol] || '').trim() : undefined;

        if (driver && driver !== '-' && area && area !== '-') {
          currentBlock.rows.push({
            driver,
            helper1: helper1Clean,
            helper2: helper2Clean,
            area,
            armada: armada || 'Truk Reguler',
            target,
            poNumber: poNumber && poNumber !== '-' ? poNumber : undefined,
            rawRow: rowData,
            rowIdx: i,
            no: !isNaN(noNum) ? noNum : undefined
          });
        }
      }

      if (currentBlock.rows.length > 0) {
        dayBlocks.push(currentBlock);
      }

      // Process each Day Block and assign the single block date to ALL rows in that block
      let lastKnownDate = new Date(2026, 0, 5); // Default start 5 Jan 2026
      let hasFoundExplicitDate = false;

      dayBlocks.forEach((block, blockIdx) => {
        let blockDateStr: string | null = block.explicitDate || null;

        // 1. Scan Column A (dateCol) across all rows of this block
        if (dateCol !== -1) {
          for (const item of block.rows) {
            const rawDateVal = String(item.rawRow[dateCol] || '').trim();
            if (rawDateVal && rawDateVal !== '-' && rawDateVal !== '0') {
              const test = scheduleImportValidator.parseDate(rawDateVal, lastKnownDate);
              if (test.date && !test.error) {
                blockDateStr = rawDateVal;
                break;
              }
            }
          }
        }

        // 2. Scan all cells across rows of this block if not found in dateCol
        if (!blockDateStr) {
          for (const item of block.rows) {
            const detected = scanRowForDate(item.rawRow);
            if (detected) {
              blockDateStr = detected;
              break;
            }
          }
        }

        // 3. Resolve to date object
        let blockDateObj: Date;
        if (blockDateStr) {
          const parsed = scheduleImportValidator.parseDate(blockDateStr, lastKnownDate);
          blockDateObj = parsed.date || lastKnownDate;
          lastKnownDate = new Date(blockDateObj.getTime());
          hasFoundExplicitDate = true;
        } else {
          // If no date written in this block, increment 1 day from previous block (skip Sunday)
          if (hasFoundExplicitDate) {
            const nextDate = new Date(lastKnownDate.getTime() + 24 * 60 * 60 * 1000);
            if (nextDate.getDay() === 0) { // Skip Sunday
              nextDate.setDate(nextDate.getDate() + 1);
            }
            blockDateObj = nextDate;
            lastKnownDate = new Date(blockDateObj.getTime());
          } else {
            blockDateObj = new Date(2026, 0, 5 + blockIdx);
            lastKnownDate = new Date(blockDateObj.getTime());
          }
        }

        const daysArr = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
        const dayName = daysArr[blockDateObj.getDay()] || 'SENIN';
        const normalizedDateStr = blockDateObj.toISOString().substring(0, 10);

        // Assign the block date to all rows within this day block
        block.rows.forEach(item => {
          const combinedHelper = item.helper1 && item.helper2 
            ? `${item.helper1}, ${item.helper2}` 
            : (item.helper1 || item.helper2 || undefined);

          const standardizedArea = (customAreaMapping && customAreaMapping[item.area]) || standardizeAreaName(item.area);

          trips.push({
            driver: item.driver,
            helper: item.helper1 && item.helper1 !== '-' ? item.helper1 : '-',
            helper2: item.helper2 && item.helper2 !== '-' ? item.helper2 : '-',
            rawArea: item.area,
            area: standardizedArea,
            armada: item.armada,
            target: item.target,
            dateStr: normalizedDateStr,
            dayName,
            poNumber: item.poNumber
          });
        });
      });

      return trips;
    }

    // Fallback: Scan every row for lines that look like delivery assignments (has driver + area + armada)
    rows.forEach((row, rowIdx) => {
      if (!row || row.length < 3) return;
      const rowStr = row.join(' ').toUpperCase();
      if (rowStr.includes('CHECKER SO') || rowStr.includes('FORMASI GUDANG') || rowStr.includes('PENGIRIMAN OFF')) {
        return;
      }

      // Check first 8 columns
      for (let c = 0; c < row.length - 2; c++) {
        const potentialDriver = String(row[c] || '').trim();
        const potentialHelper1 = String(row[c + 1] || '').trim();
        const col2 = String(row[c + 2] || '').trim();
        const col3 = c + 3 < row.length ? String(row[c + 3] || '').trim() : '';
        const col4 = c + 4 < row.length ? String(row[c + 4] || '').trim() : '';

        if (
          potentialDriver.length >= 3 && 
          !potentialDriver.includes('MINGGU') && 
          !potentialDriver.includes('JANUARI') &&
          !potentialDriver.toUpperCase().includes('DRIVER')
        ) {
          let helper1 = potentialHelper1;
          let helper2 = '-';
          let potentialArea = '';
          let potentialArmada = '';

          if (col3.length >= 3 && col4.length >= 2) {
            // 5-column: Driver, Helper 1, Helper 2, Area, Armada
            helper2 = col2;
            potentialArea = col3;
            potentialArmada = col4;
          } else if (col2.length >= 3 && col3.length >= 2) {
            // 4-column: Driver, Helper 1, Area, Armada
            potentialArea = col2;
            potentialArmada = col3;
          }

          if (potentialArea.length >= 3 && potentialArmada.length >= 2) {
            const standardizedArea = (customAreaMapping && customAreaMapping[potentialArea]) || standardizeAreaName(potentialArea);
            trips.push({
              driver: potentialDriver,
              helper: helper1 && helper1 !== '-' ? helper1 : '-',
              helper2: helper2 && helper2 !== '-' ? helper2 : '-',
              rawArea: potentialArea,
              area: standardizedArea,
              armada: potentialArmada,
              dateStr: '2026-01-05',
              dayName: 'SENIN',
              notes: `Row ${rowIdx + 1}`
            });
            break;
          }
        }
      }
    });

    return trips;
  },

  /**
   * Validate trips batch with duplicate and format checks
   */
  validateTrips(trips: ParsedSheetTrip[], defaultDate?: Date, customAreaMapping?: Record<string, string>): ValidationSummaryReport {
    return scheduleImportValidator.validateImportBatch(trips, defaultDate, customAreaMapping);
  },

  /**
   * Sync live Google Sheet data directly to logisticsStore with full validation
   */
  async syncToOperationalSchedule(
    spreadsheetId: string,
    sheetTitle: string,
    accessToken?: string | null,
    options: ImportSyncOptions = { skipDuplicates: false, overwriteDuplicates: true, skipInvalid: true }
  ): Promise<{ 
    syncedCount: number; 
    skippedDuplicateCount: number;
    skippedInvalidCount: number;
    overwrittenCount: number;
    message: string;
    validationReport: ValidationSummaryReport;
  }> {
    const range = `${sheetTitle}!A:Z`;
    const rows = await this.getSheetValues(spreadsheetId, range, accessToken);
    const trips = this.parseScheduleRows(rows, options.customAreaMapping);

    if (trips.length === 0) {
      throw new Error(`Tidak ditemukan data baris pengiriman yang valid pada Sheet "${sheetTitle}". Pastikan kolom DRIVER, HELPER, AREA, dan ARMADA tersedia.`);
    }

    // Ensure overwrite duplicates is enabled to apply latest changes from Google Sheets
    const effectiveOptions: ImportSyncOptions = {
      skipDuplicates: false,
      overwriteDuplicates: true,
      skipInvalid: true,
      ...options
    };

    // Run validation mechanism
    const validationReport = scheduleImportValidator.validateImportBatch(trips, effectiveOptions.defaultDate || new Date(), effectiveOptions.customAreaMapping);

    // Execute sync using validated items
    const syncResult = scheduleImportValidator.syncValidatedItems(validationReport.items, effectiveOptions);

    // Update config sync status
    const currentConfig = this.getConfig();
    const summaryMsg = `Berhasil menyinkronkan data Google Sheets (${syncResult.overwrittenCount} jadwal diperbarui, ${syncResult.syncedCount} ritase baru ditambahkan)`;
    
    this.saveConfig({
      ...currentConfig,
      lastSyncTimestamp: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncMessage: summaryMsg,
      totalSyncedCount: currentConfig.totalSyncedCount + syncResult.syncedCount + syncResult.overwrittenCount
    });

    return {
      syncedCount: syncResult.syncedCount,
      skippedDuplicateCount: syncResult.skippedDuplicateCount,
      skippedInvalidCount: syncResult.skippedInvalidCount,
      overwrittenCount: syncResult.overwrittenCount,
      message: summaryMsg,
      validationReport
    };
  }
};
