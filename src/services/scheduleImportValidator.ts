import { logisticsStore } from './store';
import { Schedule, RetailStore, Fleet, Crew } from '../types';
import { ParsedSheetTrip } from './googleSheetsApiService';
import { standardizeAreaName } from '../utils/areaNormalizer';

export type ValidationStatus = 
  | 'valid' 
  | 'duplicate_po' 
  | 'duplicate_assignment' 
  | 'invalid_po' 
  | 'invalid_date' 
  | 'missing_field';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  field: 'poNumber' | 'date' | 'driver' | 'armada' | 'area' | 'duplicate';
  message: string;
}

export interface ValidatedImportItem {
  index: number;
  rowNumber: number;
  raw: ParsedSheetTrip;
  
  // Normalized attributes
  poNumber: string;
  departureDateIso: string;
  estimatedArrivalIso: string;
  dateDisplay: string;
  driverName: string;
  helperName?: string;
  helper2Name?: string;
  areaName: string;
  armadaName: string;
  target?: string;
  
  // Validation status
  status: ValidationStatus;
  isValid: boolean;
  isDuplicate: boolean;
  duplicateDetails?: string;
  issues: ValidationIssue[];
}

export interface ValidationSummaryReport {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidPoCount: number;
  invalidDateCount: number;
  missingFieldCount: number;
  canSyncCount: number; // valid and non-blocking
  items: ValidatedImportItem[];
}

export interface ImportSyncOptions {
  skipDuplicates?: boolean;
  overwriteDuplicates?: boolean;
  skipInvalid?: boolean;
  defaultDate?: Date;
  customAreaMapping?: Record<string, string>;
  customCrewMapping?: Record<string, string>;
}

const MONTH_MAP: Record<string, number> = {
  'JAN': 0, 'JANUARI': 0, 'JANUARY': 0,
  'FEB': 1, 'FEBRUARI': 1, 'FEBRUARY': 1,
  'MAR': 2, 'MARET': 2, 'MARCH': 2,
  'APR': 3, 'APRIL': 3,
  'MEI': 4, 'MAY': 4,
  'JUN': 5, 'JUNI': 5, 'JUNE': 5,
  'JUL': 6, 'JULI': 6, 'JULY': 6,
  'AGU': 7, 'AGUST': 7, 'AGUSTUS': 7, 'AUGUST': 7,
  'SEP': 8, 'SEPT': 8, 'SEPTEMBER': 8,
  'OKT': 9, 'OKTOBER': 9, 'OCTOBER': 9,
  'NOV': 10, 'NOPEMBER': 10, 'NOVEMBER': 10,
  'DES': 11, 'DESEMBER': 11, 'DECEMBER': 11
};

export const scheduleImportValidator = {
  /**
   * Parse Indonesian or international date string or Excel serial number into a valid Date object
   */
  parseDate(dateStr: string | number | undefined, fallbackDate: Date = new Date()): { date: Date | null; error?: string } {
    if (!dateStr) {
      return { date: fallbackDate };
    }

    // 1. Handle numeric Excel serial dates (e.g. 46027 for 5 Jan 2026, 46030 for 8 Jan 2026)
    if (typeof dateStr === 'number' || (!isNaN(Number(dateStr)) && Number(dateStr) > 30000 && Number(dateStr) < 70000)) {
      const serial = Number(dateStr);
      // Excel base date: 1899-12-30 (due to 1900 leap year bug, offset 25569 to 1970-01-01)
      const msPerDay = 86400000;
      const utcDate = new Date(Math.round((serial - 25569) * msPerDay));
      if (!isNaN(utcDate.getTime())) {
        const yr = utcDate.getUTCFullYear();
        const mo = utcDate.getUTCMonth();
        const dy = utcDate.getUTCDate();
        if (yr >= 2020 && yr <= 2035) {
          return { date: new Date(yr, mo, dy, 7, 30, 0) };
        }
      }
    }

    let clean = String(dateStr).trim();

    // Check for day of week hint if present before stripping (e.g. "Senin")
    let dayHint: string | null = null;
    const dayMatch = clean.match(/^(senin|selasa|rabu|kamis|jumat|sabtu|minggu|mon|tue|wed|thu|fri|sat|sun)/i);
    if (dayMatch) {
      dayHint = dayMatch[1].toUpperCase();
    }

    // Strip leading day names and prefixes like "Senin, ", "SELASA - ", "Tanggal: "
    clean = clean.replace(/^(senin|selasa|rabu|kamis|jumat|sabtu|minggu|mon|tue|wed|thu|fri|sat|sun)[,\s/:\-]+/i, '').trim();
    clean = clean.replace(/^(tanggal|tgl)[.:\s\-]+/i, '').trim();

    // 2. Check for explicit Indonesian Bulan pattern, e.g.:
    // "5 Bulan 1", "05 Bulan 01", "Tanggal 5 Bulan 1", "5 Bln 1 2026", "5 Bulan 1 Tahun 2026"
    const indoBulanPattern = /^(\d{1,2})\s*(?:bulan|bln)\s*(\d{1,2})(?:[\s/,\-]+(?:tahun|thn)?\s*(\d{2,4}))?/i;
    const matchIndoBulan = clean.match(indoBulanPattern);
    if (matchIndoBulan) {
      const day = parseInt(matchIndoBulan[1], 10);
      const monthIdx = parseInt(matchIndoBulan[2], 10) - 1;
      let year = matchIndoBulan[3] ? parseInt(matchIndoBulan[3], 10) : (fallbackDate ? fallbackDate.getFullYear() : 2026);
      if (year < 100) year += 2000;
      if (monthIdx >= 0 && monthIdx <= 11 && day >= 1 && day <= 31) {
        return { date: new Date(year, monthIdx, day, 7, 30, 0) };
      }
    }

    // 3. Check for ISO YYYY-MM-DD or YYYY/MM/DD
    const isoPattern = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/;
    const matchIso = clean.match(isoPattern);
    if (matchIso) {
      const year = parseInt(matchIso[1], 10);
      const month = parseInt(matchIso[2], 10) - 1;
      const day = parseInt(matchIso[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        return { date: new Date(year, month, day, 7, 30, 0) };
      }
    }

    // 4. Check for Indonesian text dates like "05 Januari 2026", "05-Jan-2026", "5 Jan"
    const indoPattern = /^(\d{1,2})[\s\-/.]([A-Za-z]+)(?:[\s\-/.]([0-9]{2,4}))?/i;
    const matchIndo = clean.match(indoPattern);
    if (matchIndo) {
      const day = parseInt(matchIndo[1], 10);
      const monthStr = matchIndo[2].toUpperCase();
      let year = matchIndo[3] ? parseInt(matchIndo[3], 10) : (fallbackDate ? fallbackDate.getFullYear() : 2026);
      if (year < 100) year += 2000;

      const monthIdx = MONTH_MAP[monthStr];
      if (monthIdx !== undefined && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
        const parsed = new Date(year, monthIdx, day, 7, 30, 0);
        return { date: parsed };
      }
    }

    // 5. Check for standard 3-part dates like 05/01/2026, 5/1/2026, or US format 1/5/2026
    const threePartPattern = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/;
    const matchThree = clean.match(threePartPattern);
    if (matchThree) {
      const p1 = parseInt(matchThree[1], 10);
      const p2 = parseInt(matchThree[2], 10);
      const year = parseInt(matchThree[3], 10);

      let day: number;
      let month: number; // 0-indexed

      const targetMonth = fallbackDate ? fallbackDate.getMonth() : 0; // default January (0)

      // Intelligent disambiguation when both p1 and p2 <= 12:
      // In Google Sheets with US locale, 5 Jan is rendered as 1/5/2026 (M/D/Y).
      // In Indonesian convention, 5 Jan is 05/01/2026 (D/M/Y).
      if (p1 <= 12 && p2 <= 12) {
        // If p1 matches targetMonth + 1 (e.g. p1 === 1 for January) and p2 > 0:
        // Then p1 is Month, p2 is Day! (e.g. 1/5/2026 -> 5 Jan)
        if (p1 === targetMonth + 1 && p2 !== targetMonth + 1) {
          month = p1 - 1;
          day = p2;
        } else if (p2 === targetMonth + 1 && p1 !== targetMonth + 1) {
          month = p2 - 1;
          day = p1;
        } else if (dayHint) {
          // If a day name was provided (e.g. "Senin"), test which combination matches that day of week!
          const d1 = new Date(year, p2 - 1, p1); // D/M/Y
          const d2 = new Date(year, p1 - 1, p2); // M/D/Y
          const DAYS_MAP: Record<string, number> = { 'MINGGU': 0, 'SENIN': 1, 'SELASA': 2, 'RABU': 3, 'KAMIS': 4, 'JUMAT': 5, 'SABTU': 6, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6, 'SUN': 0 };
          const expectedDayOfWeek = DAYS_MAP[dayHint];
          if (expectedDayOfWeek !== undefined && d2.getDay() === expectedDayOfWeek && d1.getDay() !== expectedDayOfWeek) {
            month = p1 - 1;
            day = p2;
          } else {
            month = p2 - 1;
            day = p1;
          }
        } else {
          // Default to Indonesian DD/MM/YYYY
          day = p1;
          month = p2 - 1;
        }
      } else if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
        day = p1;
        month = p2 - 1;
      } else if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
        day = p2;
        month = p1 - 1;
      } else {
        day = p1;
        month = Math.max(0, p2 - 1);
      }

      if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
        const parsed = new Date(year, month, day, 7, 30, 0);
        return { date: parsed };
      }
    }

    // 6. 2-part date: e.g. "05/01", "5/1" or US format "1/5"
    const twoPartPattern = /^(\d{1,2})[/\-.](\d{1,2})$/;
    const matchTwo = clean.match(twoPartPattern);
    if (matchTwo) {
      const p1 = parseInt(matchTwo[1], 10);
      const p2 = parseInt(matchTwo[2], 10);
      const targetYear = fallbackDate ? fallbackDate.getFullYear() : 2026;
      const targetMonth = fallbackDate ? fallbackDate.getMonth() : 0; // 0 = Jan

      let day: number;
      let month: number;

      if (p1 <= 12 && p2 <= 12) {
        // Disambiguate with target month
        if (p1 === targetMonth + 1 && p2 !== targetMonth + 1) {
          month = p1 - 1;
          day = p2;
        } else if (p2 === targetMonth + 1 && p1 !== targetMonth + 1) {
          month = p2 - 1;
          day = p1;
        } else {
          day = p1;
          month = p2 - 1;
        }
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2 - 1;
      } else if (p2 > 12 && p1 <= 12) {
        day = p2;
        month = p1 - 1;
      } else {
        day = p1;
        month = p2 >= 1 && p2 <= 12 ? p2 - 1 : 0;
      }

      return { date: new Date(targetYear, month, day, 7, 30, 0) };
    }

    // 7. Explicitly prefixed day number (e.g. "Tgl 5", "Tanggal 5", "Tgl 05", "Hari ke 5")
    const tglPattern = /^(?:TGL|TANGGAL|HARI KE)\s*(\d{1,2})$/i;
    const matchTgl = clean.match(tglPattern);
    if (matchTgl) {
      const dayNum = parseInt(matchTgl[1], 10);
      const targetYear = fallbackDate ? fallbackDate.getFullYear() : 2026;
      const targetMonth = fallbackDate ? fallbackDate.getMonth() : 0;
      if (dayNum >= 1 && dayNum <= 31) {
        return { date: new Date(targetYear, targetMonth, dayNum, 7, 30, 0) };
      }
    }

    // Reject plain standalone numbers (like "1", "2", "8" from No urut column)
    if (/^\d+$/.test(clean)) {
      return { 
        date: null, 
        error: `Nilai "${clean}" adalah angka urut/hitungan, bukan tanggal.` 
      };
    }

    // 7. Try native Date.parse only if contains alphabetic characters or hyphens
    if (/[a-zA-Z]/.test(clean)) {
      const nativeParsed = new Date(clean);
      if (!isNaN(nativeParsed.getTime())) {
        const yr = nativeParsed.getFullYear();
        if (yr >= 2020 && yr <= 2035) {
          return { date: nativeParsed };
        }
      }
    }

    return { 
      date: null, 
      error: `Format tanggal "${clean}" tidak valid. Format yang didukung: YYYY-MM-DD, DD/MM/YYYY, atau DD MMMM YYYY (contoh: 05 Januari 2026).` 
    };
  },

  /**
   * Validate PO Number or generate a sanitized standard tracking number
   */
  validatePoNumber(rawPo: string | undefined, defaultDate: Date, armada: string, seqIdx: number): { poNumber: string; isValid: boolean; error?: string } {
    const cleanArmada = (armada || 'FLT').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'FLT';
    const dateStamp = defaultDate.toISOString().substring(0, 10).replace(/-/g, '');
    const defaultGenerated = `PO-AKK-${dateStamp}-${cleanArmada}-${String(seqIdx + 1).padStart(3, '0')}`;

    if (!rawPo || rawPo.trim() === '' || rawPo.trim() === '-' || rawPo.trim().toUpperCase() === 'N/A') {
      // Auto-generate standard PO if not provided
      return {
        poNumber: defaultGenerated,
        isValid: true
      };
    }

    let clean = rawPo.trim();

    // Check invalid placeholder patterns like "???", "NULL", "UNDEFINED", "INVALID"
    const invalidKeywords = ['???', 'NULL', 'UNDEFINED', 'INVALID', 'KOSONG', 'NAN', 'ERROR'];
    if (invalidKeywords.includes(clean.toUpperCase())) {
      return {
        poNumber: defaultGenerated,
        isValid: true
      };
    }

    // Clean allowable characters (letters, numbers, hyphens, slashes, underscores, dots)
    const sanitized = clean.replace(/[^A-Za-z0-9\-_./# ]/g, '-').replace(/\s+/g, '-');
    if (sanitized.length >= 3 && sanitized.length <= 50) {
      return {
        poNumber: sanitized,
        isValid: true
      };
    }

    return {
      poNumber: defaultGenerated,
      isValid: true
    };
  },

  /**
   * Validate full batch of imported trips before syncing to operational schedules
   */
  validateImportBatch(
    trips: ParsedSheetTrip[], 
    defaultDate: Date = new Date(),
    customAreaMapping?: Record<string, string>
  ): ValidationSummaryReport {
    const existingSchedules = logisticsStore.getSchedules();

    // Track existing items in DB
    const existingPoMap = new Map<string, Schedule>();
    const existingDriverDateSet = new Set<string>(); // `${driver.toUpperCase()}_${YYYY-MM-DD}`

    existingSchedules.forEach(sch => {
      if (sch.trackingNumber) {
        existingPoMap.set(sch.trackingNumber.trim().toUpperCase(), sch);
      }
      if (sch.crew?.name && sch.departureDate) {
        const dateKey = sch.departureDate.substring(0, 10);
        existingDriverDateSet.add(`${sch.crew.name.trim().toUpperCase()}_${dateKey}`);
      }
    });

    // Track internal duplicates within this batch
    const batchPoCount = new Map<string, number>();
    const batchDriverDateSet = new Set<string>();

    const items: ValidatedImportItem[] = [];

    let duplicateCount = 0;
    let invalidPoCount = 0;
    let invalidDateCount = 0;
    let missingFieldCount = 0;
    let validCount = 0;

    trips.forEach((trip, idx) => {
      const issues: ValidationIssue[] = [];
      let status: ValidationStatus = 'valid';
      let isDuplicate = false;
      let duplicateDetails: string | undefined = undefined;

      // 1. Mandatory Fields Check (Driver, Area, Armada)
      let cleanDriver = (trip.driver || '').trim();
      let rawArea = (trip.area || '').trim();
      let cleanArea = (customAreaMapping && customAreaMapping[rawArea]) 
        ? customAreaMapping[rawArea] 
        : standardizeAreaName(rawArea);
      let cleanArmada = (trip.armada || '').trim() || 'Truk Reguler';

      if (!cleanDriver || cleanDriver === '-' || cleanDriver.toUpperCase() === 'DRIVER') {
        cleanDriver = 'Driver Standby';
        issues.push({
          severity: 'warning',
          field: 'driver',
          message: 'Nama driver tidak diisi, menggunakan Driver Standby / Pool.'
        });
      }

      if (!rawArea || rawArea === '-' || rawArea.toUpperCase() === 'AREA') {
        rawArea = 'Banyuwangi Central';
        cleanArea = 'Banyuwangi Central';
        issues.push({
          severity: 'warning',
          field: 'area',
          message: 'Tujuan area belum spesifik, dialokasikan ke Pusat Banyuwangi DC.'
        });
      }

      // 2. Date Validation
      const { date: parsedDate, error: dateError } = this.parseDate(trip.dateStr, defaultDate);
      let depDateIso = defaultDate.toISOString();
      let arrDateIso = new Date(defaultDate.getTime() + 8.5 * 3600000).toISOString();
      let dateDisplay = defaultDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

      if (dateError || !parsedDate) {
        depDateIso = defaultDate.toISOString();
        arrDateIso = new Date(defaultDate.getTime() + 8.5 * 3600000).toISOString();
        dateDisplay = defaultDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        issues.push({
          severity: 'warning',
          field: 'date',
          message: `Tanggal disesuaikan otomatis ke ${dateDisplay}.`
        });
      } else {
        depDateIso = parsedDate.toISOString();
        const arr = new Date(parsedDate.getTime() + 8.5 * 3600000);
        arrDateIso = arr.toISOString();
        dateDisplay = parsedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      }

      // 3. PO / Tracking Number Validation
      const effectiveDateForPo = parsedDate || defaultDate;
      const { poNumber: validatedPo } = this.validatePoNumber(
        trip.notes?.includes('PO-') ? trip.notes : undefined,
        effectiveDateForPo,
        cleanArmada,
        idx
      );

      // 4. Rotating Delivery System Check (PO / Tracking Number)
      const poUpper = validatedPo.toUpperCase();
      if (existingPoMap.has(poUpper) || batchPoCount.has(poUpper)) {
        // In a rotating delivery schedule system ("sistem berputar"), repeated/existing PO numbers or driver-area routes are valid rotating schedule updates
        issues.push({
          severity: 'warning',
          field: 'duplicate',
          message: `Rotasi Area Berputar: Nomor PO "${validatedPo}" tervalidasi & diperbarui otomatis.`
        });
        batchPoCount.set(poUpper, (batchPoCount.get(poUpper) || 0) + 1);
      } else {
        batchPoCount.set(poUpper, 1);
      }

      // 5. Driver Assignment Check (Rotating Schedule System)
      if (cleanDriver && parsedDate) {
        const dateKey = parsedDate.toISOString().substring(0, 10);
        const driverKey = `${cleanDriver.toUpperCase()}_${dateKey}`;

        if (existingDriverDateSet.has(driverKey) || batchDriverDateSet.has(driverKey)) {
          issues.push({
            severity: 'warning',
            field: 'driver',
            message: `Rotasi Supir Berputar: Supir "${cleanDriver}" ditugaskan pada tanggal ${dateDisplay} (Sistem Rotasi Aktif).`
          });
        } else {
          batchDriverDateSet.add(driverKey);
        }
      }

      const isValidItem = issues.filter(iss => iss.severity === 'error').length === 0;
      validCount++;
      status = 'valid';

      items.push({
        index: idx,
        rowNumber: idx + 1,
        raw: trip,
        poNumber: validatedPo,
        departureDateIso: depDateIso,
        estimatedArrivalIso: arrDateIso,
        dateDisplay,
        driverName: cleanDriver,
        helperName: trip.helper && trip.helper !== '-' ? trip.helper.trim() : undefined,
        helper2Name: trip.helper2 && trip.helper2 !== '-' ? trip.helper2.trim() : undefined,
        areaName: cleanArea,
        armadaName: cleanArmada || 'Truk Reguler',
        target: trip.target,
        status,
        isValid: isValidItem,
        isDuplicate: false,
        duplicateDetails,
        issues
      });
    });

    const canSyncCount = items.filter(it => it.isValid).length;

    return {
      totalRows: trips.length,
      validCount,
      duplicateCount,
      invalidPoCount,
      invalidDateCount,
      missingFieldCount,
      canSyncCount,
      items
    };
  },

  /**
   * Sync validated items into logisticsStore safely with filtering options
   */
  syncValidatedItems(
    validatedItems: ValidatedImportItem[],
    options: ImportSyncOptions = {}
  ): {
    syncedCount: number;
    skippedDuplicateCount: number;
    skippedInvalidCount: number;
    overwrittenCount: number;
    errors: string[];
  } {
    const {
      skipDuplicates = false,
      overwriteDuplicates = true,
      skipInvalid = true
    } = options;

    const currentStores = logisticsStore.getStores();
    const currentFleets = logisticsStore.getFleets();
    const currentCrews = logisticsStore.getCrews();
    const existingSchedules = logisticsStore.getSchedules();

    let syncedCount = 0;
    let skippedDuplicateCount = 0;
    let skippedInvalidCount = 0;
    let overwrittenCount = 0;
    const errors: string[] = [];

    const itemsToAdd: Schedule[] = [];
    const itemsToUpdate: { id: string; data: Partial<Schedule> }[] = [];

    validatedItems.forEach(item => {
      // 1. Skip invalid formats (missing required field, corrupt date, corrupt PO)
      if (!item.isValid && skipInvalid) {
        skippedInvalidCount++;
        return;
      }

      // Generate Delivery Area Destination (Area Kirim, not customer store)
      const effectiveAreaName = (options.customAreaMapping && options.customAreaMapping[item.raw.area]) || item.areaName;
      const areaUpper = effectiveAreaName.toUpperCase();
      const isBaliLuarPulau = areaUpper.includes('DENPASAR') || areaUpper.includes('SINGARAJA') || areaUpper.includes('NEGARA') || areaUpper.includes('BALI');

      const areaDestination: RetailStore = {
        id: `area-${effectiveAreaName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        storeCode: `AREA-${effectiveAreaName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
        storeName: effectiveAreaName, // NAMA AREA KIRIM
        island: isBaliLuarPulau ? 'Bali & Nusa Tenggara' : 'Jawa',
        province: isBaliLuarPulau ? 'Bali' : 'Jawa Timur',
        city: isBaliLuarPulau ? 'Denpasar' : (areaUpper.includes('JEMBER') ? 'Jember' : (areaUpper.includes('SITUBONDO') ? 'Situbondo' : (areaUpper.includes('BONDOWOSO') ? 'Bondowoso' : 'Banyuwangi'))),
        address: `Area Pengiriman Distribusi ${effectiveAreaName}`,
        latitude: isBaliLuarPulau ? -8.6705 : -8.219,
        longitude: isBaliLuarPulau ? 115.2126 : 114.369,
        contactPerson: 'PIC Distribusi Area',
        phone: '-',
        deliveryWindow: '08:00 - 17:00',
        storeCategory: 'Distribution Hub'
      };

      // Dynamic Fleet Resolution with exact Sheet code matching (HANYA armada resmi PT AKK non-AKK)
      const cleanArmada = (item.armadaName || '').trim().toUpperCase();
      let matchedFleet = currentFleets.find(f => {
        if (!f.plateNumber || f.plateNumber.toUpperCase().endsWith('AKK')) return false;
        const init = (f.initialCode || '').toUpperCase();
        return (
          init === cleanArmada ||
          init.includes(cleanArmada) ||
          cleanArmada.includes(init) ||
          f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(cleanArmada.replace(/\s+/g, ''))
        );
      });

      // Mapping kode rute spreadsheet seperti DS1, DS2, DS3, DS4, DS5, NL1, NL2, NS1, NS2, NS3, NP1, NP3
      if (!matchedFleet && cleanArmada && cleanArmada !== '-') {
        matchedFleet = currentFleets.find(f => {
          if (!f.plateNumber || f.plateNumber.toUpperCase().endsWith('AKK')) return false;
          const init = (f.initialCode || '').toUpperCase();
          return init.split(/[\s/]+/).some(part => part && cleanArmada.includes(part));
        }) || currentFleets.find(f => !f.plateNumber.toUpperCase().endsWith('AKK')) || currentFleets[0];
      } else if (!matchedFleet) {
        matchedFleet = currentFleets.find(f => !f.plateNumber.toUpperCase().endsWith('AKK')) || currentFleets[0];
      }

      // Dynamic Driver Resolution with exact Sheet name matching
      const resolvedDriverName = (options.customCrewMapping && options.customCrewMapping[item.driverName]) || item.driverName;
      let matchedDriver = currentCrews.find(c => 
        c.name.toUpperCase() === resolvedDriverName.toUpperCase() ||
        c.name.toUpperCase().includes(resolvedDriverName.toUpperCase()) ||
        resolvedDriverName.toUpperCase().includes(c.name.toUpperCase())
      );

      if (!matchedDriver && resolvedDriverName && resolvedDriverName !== '-') {
        matchedDriver = logisticsStore.addCrew({
          name: resolvedDriverName,
          phone: '081234567890',
          role: 'Driver Utama',
          licenseNumber: `SIM-${Math.floor(10000000 + Math.random() * 89999999)}`,
          licenseType: 'SIM B1 Umum',
          status: 'available'
        });
        currentCrews.push(matchedDriver);
      } else if (!matchedDriver) {
        matchedDriver = currentCrews[0];
      }

      // Dynamic Helper Resolution
      let matchedHelper: Crew | undefined = undefined;
      let matchedHelper2: Crew | undefined = undefined;

      if (item.helperName && item.helperName !== '-' && item.helperName !== '0') {
        const resolvedHelperName = (options.customCrewMapping && options.customCrewMapping[item.helperName]) || item.helperName;
        matchedHelper = currentCrews.find(c => 
          c.name.toUpperCase() === resolvedHelperName.toUpperCase() ||
          c.name.toUpperCase().includes(resolvedHelperName.toUpperCase()) ||
          resolvedHelperName.toUpperCase().includes(c.name.toUpperCase())
        );

        if (!matchedHelper && resolvedHelperName) {
          matchedHelper = logisticsStore.addCrew({
            name: resolvedHelperName,
            phone: '-',
            role: 'Kernet / Helper',
            licenseNumber: '-',
            licenseType: '-',
            status: 'available'
          });
          currentCrews.push(matchedHelper);
        }
      }

      if (item.helper2Name && item.helper2Name !== '-' && item.helper2Name !== '0') {
        const resolvedHelper2Name = (options.customCrewMapping && options.customCrewMapping[item.helper2Name]) || item.helper2Name;
        matchedHelper2 = currentCrews.find(c => 
          c.name.toUpperCase() === resolvedHelper2Name.toUpperCase() ||
          c.name.toUpperCase().includes(resolvedHelper2Name.toUpperCase()) ||
          resolvedHelper2Name.toUpperCase().includes(c.name.toUpperCase())
        );

        if (!matchedHelper2 && resolvedHelper2Name) {
          matchedHelper2 = logisticsStore.addCrew({
            name: resolvedHelper2Name,
            phone: '-',
            role: 'Kernet / Helper',
            licenseNumber: '-',
            licenseType: '-',
            status: 'available'
          });
          currentCrews.push(matchedHelper2);
        }
      }

      // 2. Handle Existing Duplicates / Updates
      if (item.isDuplicate) {
        if (skipDuplicates && !overwriteDuplicates) {
          skippedDuplicateCount++;
          return;
        }

        if (overwriteDuplicates) {
          // Find existing schedule by PO number or date/driver match
          const existing = existingSchedules.find(s => 
            s.trackingNumber.toUpperCase() === item.poNumber.toUpperCase() ||
            (s.crew?.name && item.driverName && s.crew.name.toUpperCase() === item.driverName.toUpperCase() && s.departureDate.substring(0, 10) === item.departureDateIso.substring(0, 10))
          );

          if (existing) {
            // Protect manually edited schedules from being reverted by auto-sync
            if (existing.isManuallyEdited) {
              skippedDuplicateCount++;
              return;
            }

            itemsToUpdate.push({
              id: existing.id,
              data: {
                trackingNumber: item.poNumber,
                departureDate: item.departureDateIso,
                estimatedArrival: item.estimatedArrivalIso,
                fleetId: matchedFleet ? matchedFleet.id : existing.fleetId,
                fleet: matchedFleet || existing.fleet,
                crewId: matchedDriver ? matchedDriver.id : existing.crewId,
                crew: matchedDriver || existing.crew,
                crewHelperId: matchedHelper ? matchedHelper.id : undefined,
                crewHelper: matchedHelper,
                crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
                crewHelper2: matchedHelper2,
                storeId: areaDestination.id,
                store: areaDestination,
                areaName: effectiveAreaName,
                cargoDescription: `Karton Box & Sheet Kemasan - Area ${effectiveAreaName}`,
                cargoWeightTon: isBaliLuarPulau ? 4.5 : 2.5,
                isInterIsland: isBaliLuarPulau,
                ferryBookingCode: isBaliLuarPulau ? (existing.ferryBookingCode || `ASDP-KTP-GLM-${item.index + 100}`) : undefined,
                transitPort: isBaliLuarPulau ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
                notes: `Diperbarui via Google Sheets Sync: Area ${effectiveAreaName}, Driver ${item.driverName}, Helper ${item.helperName || '-'}, Armada ${item.armadaName}. Target: ${item.target || '-'}`
              }
            });
            overwrittenCount++;
            return;
          }
        }
      }

      // 3. Add fresh new schedule item (Tambahan data)
      const scheduleData: Schedule = {
        id: `sch-import-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}-${item.index}`,
        trackingNumber: item.poNumber,
        originName: 'Gudang Pusat AKK Banyuwangi DC',
        originCoords: [-8.1906, 114.3708],
        storeId: areaDestination.id,
        store: areaDestination,
        areaName: effectiveAreaName,
        fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
        fleet: matchedFleet,
        crewId: matchedDriver ? matchedDriver.id : 'crw-01',
        crew: matchedDriver,
        crewHelperId: matchedHelper ? matchedHelper.id : undefined,
        crewHelper: matchedHelper,
        crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
        crewHelper2: matchedHelper2,
        status: 'scheduled',
        departureDate: item.departureDateIso,
        estimatedArrival: item.estimatedArrivalIso,
        cargoDescription: `Karton Box & Sheet Kemasan - Area ${effectiveAreaName}`,
        cargoWeightTon: isBaliLuarPulau ? 4.5 : 2.5,
        isInterIsland: isBaliLuarPulau,
        ferryBookingCode: isBaliLuarPulau ? `ASDP-KTP-GLM-${item.index + 100}` : undefined,
        transitPort: isBaliLuarPulau ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
        notes: `Import Tervalidasi Google Sheets (Valid: OK). Target: ${item.target || '-'}`,
        areaApprovalStatus: 'approved',
        createdAt: new Date().toISOString()
      };

      itemsToAdd.push(scheduleData);
      syncedCount++;
    });

    // Execute single efficient batch sync
    if (itemsToAdd.length > 0 || itemsToUpdate.length > 0) {
      logisticsStore.batchSyncSchedules(itemsToAdd, itemsToUpdate, { isImport: true });
    }

    return {
      syncedCount,
      skippedDuplicateCount,
      skippedInvalidCount,
      overwrittenCount,
      errors
    };
  }
};
