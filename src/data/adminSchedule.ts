import { scheduleImportValidator } from '../services/scheduleImportValidator';
import { branchStore } from '../services/branchStore';

export interface DeliveryAssignment {
  id?: string;
  driver: string;
  helper: string;
  helper2?: string;
  area: string;
  armada: string;
  backup?: string;
  target?: string;
  departureTime?: string;
  targetReturnTime?: string;
  departureDateIso?: string;
  returnDateIso?: string;
  branchId?: string;
  isManuallyEdited?: boolean;
}

export interface WarehouseCrewAssignment {
  role: string;
  nama: string;
  keterangan?: string;
}

export interface OffDeliveryArmada {
  nama: string;
  keterangan: string;
  backup?: string;
}

export interface EmployeeAbsence {
  nama: string;
  keterangan: string;
  backup?: string;
}

export interface AdminScheduleDay {
  dayNumber: number; // e.g. 5
  dayName: string; // 'SENIN'
  dateString: string; // '05 Januari 2026'
  pengiriman: DeliveryAssignment[];
  gudang: WarehouseCrewAssignment[];
  pengirimanOff: OffDeliveryArmada[];
  karyawanIzin: EmployeeAbsence[];
}

export interface AdminScheduleWeek {
  weekNumber: number; // 1
  weekLabel: string; // 'SENIN, 05 JANUARI 2026'
  dateRangeLabel: string;
  days: AdminScheduleDay[];
}

/**
 * Data Resmi Sinkronisasi Sheet "ALL" Dokumen "JADWAL PENGIRIMAN 2026"
 * PT Anugrah Kemasan Kreatif - Banyuwangi Central DC
 * Sesuai data riil spreadsheet aktif (8 Rute Pengiriman 05 Januari 2026).
 */
export const ADMIN_SCHEDULE_WEEKS: AdminScheduleWeek[] = [
  {
    weekNumber: 1,
    weekLabel: 'MINGGU 1 • JANUARI 2026 (SHEET: ALL)',
    dateRangeLabel: '05 - 10 Januari 2026',
    days: [
      {
        dayNumber: 5,
        dayName: 'SENIN',
        dateString: '05 Januari 2026',
        pengiriman: [
          { driver: 'SUPRI', helper: 'RIFAL, ALDI', area: 'DENPASAR 1', armada: 'DS3' },
          { driver: 'WAHYU', helper: 'YUSUF', area: 'DENPASAR 2', armada: 'DS1' },
          { driver: 'TIAR', helper: 'FARIS', area: 'BONDOWOSO', armada: 'NS3' },
          { driver: 'ARIS', helper: 'ROHMAN', area: 'SITUBONDO', armada: 'DS2' },
          { driver: 'ANDRE', helper: 'AAN', area: 'SUSULAN GENTENG - ROGOJAMPI', armada: 'DS4' },
          { driver: 'WIBI', helper: 'TEGUH', area: 'PURWO DAMBUNTUNG', armada: 'NS2' },
          { driver: 'BUDI', helper: 'RIZAL', area: 'PURWO PASAR', armada: 'NS1' },
          { driver: 'HADI', helper: 'YUDI', area: 'JAJAG RETAIL', armada: 'N20' },
          { driver: 'WONGSO', helper: 'RIZAL', area: 'KANVAS LKT', armada: 'NP1' }
        ],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      },
      {
        dayNumber: 6,
        dayName: 'SELASA',
        dateString: '06 Januari 2026',
        pengiriman: [
          { driver: 'ANDRE', helper: 'AAN, HARDI', area: 'SINGARAJA', armada: 'DS5' },
          { driver: 'HADI', helper: 'YUSUF', area: 'SUMBERAYU RETAIL', armada: 'NL2' },
          { driver: 'ARIS', helper: 'RIFAL', area: 'GALEKAN', armada: 'NL1' },
          { driver: 'TIAR', helper: 'FARIS', area: 'GROSIR BWI - ROGOJAMPI', armada: 'DS4' },
          { driver: 'BUDI', helper: 'ROHMAN', area: 'SUSULAN SANGGAR JAJAG', armada: 'NS1' },
          { driver: 'WIBI', helper: 'TEGUH', area: 'KANVAS LKT', armada: 'NP1' }
        ],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      },
      {
        dayNumber: 7,
        dayName: 'RABU',
        dateString: '07 Januari 2026',
        pengiriman: [
          { driver: 'SUPRI', helper: 'RIFAL', area: 'DENPASAR 1', armada: 'DS5' },
          { driver: 'HADI', helper: 'FARIS', area: 'DENPASAR 2', armada: 'DS3' },
          { driver: 'ARIS', helper: 'ROHMAN', area: 'GENTENG RETAIL', armada: 'NL2' },
          { driver: 'TIAR', helper: 'YUSUF', area: 'ROGOJAMPI RETAIL', armada: 'DS4' },
          { driver: 'BUDI', helper: 'AAN', area: 'MUNCAR RETAIL', armada: 'NS2' },
          { driver: 'ALDI', helper: 'WAHYU', area: 'KETAPANG WONGSOREJO', armada: 'NS3' },
          { driver: 'WONGSO', helper: 'YUDI', area: 'KANVAS LKT', armada: 'NP1' }
        ],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      },
      {
        dayNumber: 8,
        dayName: 'KAMIS',
        dateString: '08 Januari 2026',
        pengiriman: [
          { driver: 'BUDI', helper: 'YUSUF', area: 'JEMBER BARAT', armada: 'DS2' },
          { driver: 'ARIS', helper: 'ROHMAN', area: 'DENPASAR 1', armada: 'DS3' },
          { driver: 'TIAR', helper: 'TEGUH, AHMAD', area: 'GROSIR GENDOH - GENTENG', armada: 'DS1' },
          { driver: 'HADI', helper: 'FARIS', area: 'GROSIR GENDOH - GENTENG', armada: 'NL2' },
          { driver: 'WIBI', helper: 'RIFAL', area: 'SONGGON RETAIL', armada: 'NS1' },
          { driver: 'ALDI', helper: 'ANDRE', area: 'BWI KOTA SELATAN', armada: 'NS3' },
          { driver: 'WAHYU', helper: 'AAN', area: 'SUSULAN SITUBONDO', armada: 'NL1' },
          { driver: 'WONGSO', helper: 'RIZAL', area: 'KANVAS LKT', armada: 'NP1' }
        ],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      },
      {
        dayNumber: 9,
        dayName: 'JUMAT',
        dateString: '09 Januari 2026',
        pengiriman: [
          { driver: 'SUPRI', helper: 'RIFAL', area: 'NEGARA', armada: 'DS1' },
          { driver: 'HADI', helper: 'YUSUF', area: 'NEGARA', armada: 'DS5' },
          { driver: 'ALDI', helper: 'ANDIKA', area: 'SANGGAR RETAIL', armada: 'NS3' },
          { driver: 'WAHYU', helper: 'AAN', area: 'KALIBARU RETAIL', armada: 'NL1' },
          { driver: 'TIAR', helper: 'ROHMAN, AHMAD', area: 'GROSIR SRONO SUMBERAYU MUNCAR', armada: 'DS3' },
          { driver: 'BUDI', helper: 'YUDI', area: 'SUSULAN ROGOJAMPI MUNCAR', armada: 'NS1' },
          { driver: 'ANDRE', helper: 'RIZAL', area: 'SEMPU STAIL', armada: 'NL2' },
          { driver: 'WIBI', helper: 'TEGUH', area: 'KANVAS LKT', armada: 'NP1' }
        ],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      },
      {
        dayNumber: 10,
        dayName: 'SABTU',
        dateString: '10 Januari 2026',
        pengiriman: [
          { driver: 'TIAR', helper: 'AHMAD', area: 'NEGARA', armada: 'DS4' },
          { driver: 'WIBI', helper: 'ALDI', area: 'JEMBER KOTA', armada: 'DS3' },
          { driver: 'WONGSO', helper: 'FARIS', area: 'PURWO DAMBUNTUNG', armada: 'NP1' },
          { driver: 'HADI', helper: 'ROHMAN', area: 'PURWO PASAR', armada: 'NS1' },
          { driver: 'SUPRI', helper: 'YUSUF', area: 'JAJAG RETAIL', armada: 'NS2' },
          { driver: 'ANDRE', helper: 'AAN', area: 'KANVAS LKT', armada: 'N20' }
        ],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      }
    ]
  }
];

export const RAW_ADMIN_SCHEDULE_CSV = `Januari,,,,,,
Tanggal,No,Driver,Helper,,Area Kirim,Armada
,,,1,2,,
05/01/2026,1,SUPRI,RIFAL,ALDI,DENPASAR 1,DS3
,2,WAHYU,YUSUF,,DENPASAR 2,DS1
,3,TIAR,FARIS,,BONDOWOSO,NS3
,4,ARIS,ROHMAN,,SITUBONDO,DS2
,5,ANDRE,AAN,,SUSULAN GENTENG - ROGOJAMPI,DS4
,6,WIBI,TEGUH,,PURWO DAMBUNTUNG,NS2
,7,BUDI,RIZAL,,PURWO PASAR,NS1
,8,HADI,YUDI,,JAJAG RETAIL,N20
,9,WONGSO,RIZAL,,KANVAS LKT,NP1
------,BLACK_ROW_SEPARATOR,,,,,
06/01/2026,1,ANDRE,AAN,HARDI,SINGARAJA,DS5
,2,HADI,YUSUF,,SUMBERAYU RETAIL,NL2
,3,ARIS,RIFAL,,GALEKAN,NL1
,4,TIAR,FARIS,,GROSIR BWI - ROGOJAMPI,DS4
,5,BUDI,ROHMAN,,SUSULAN SANGGAR JAJAG,NS1
,6,WIBI,TEGUH,,KANVAS LKT,NP1
------,BLACK_ROW_SEPARATOR,,,,,
07/01/2026,1,SUPRI,RIFAL,,DENPASAR 1,DS5
,2,HADI,FARIS,,DENPASAR 2,DS3
,3,ARIS,ROHMAN,,GENTENG RETAIL,NL2
,4,TIAR,YUSUF,,ROGOJAMPI RETAIL,DS4
,5,BUDI,AAN,,MUNCAR RETAIL,NS2
,6,ALDI,WAHYU,,KETAPANG WONGSOREJO,NS3
,7,WONGSO,YUDI,,KANVAS LKT,NP1
------,BLACK_ROW_SEPARATOR,,,,,
08/01/2026,1,BUDI,YUSUF,,JEMBER BARAT,DS2
,2,ARIS,ROHMAN,,DENPASAR 1,DS3
,3,TIAR,TEGUH,AHMAD,GROSIR GENDOH - GENTENG,DS1
,4,HADI,FARIS,,GROSIR GENDOH - GENTENG,NL2
,5,WIBI,RIFAL,,SONGGON RETAIL,NS1
,6,ALDI,ANDRE,,BWI KOTA SELATAN,NS3
,7,WAHYU,AAN,,SUSULAN SITUBONDO,NL1
,8,WONGSO,RIZAL,,KANVAS LKT,NP1
------,BLACK_ROW_SEPARATOR,,,,,
09/01/2026,1,SUPRI,RIFAL,,NEGARA,DS1
,2,HADI,YUSUF,,NEGARA,DS5
,3,ALDI,ANDIKA,,SANGGAR RETAIL,NS3
,4,WAHYU,AAN,,KALIBARU RETAIL,NL1
,5,TIAR,ROHMAN,AHMAD,GROSIR SRONO SUMBERAYU MUNCAR,DS3
,6,BUDI,YUDI,,SUSULAN ROGOJAMPI MUNCAR,NS1
,7,ANDRE,RIZAL,,SEMPU STAIL,NL2
,8,WIBI,TEGUH,,KANVAS LKT,NP1
------,BLACK_ROW_SEPARATOR,,,,,
10/01/2026,1,TIAR,AHMAD,,NEGARA,DS4
,2,WIBI,ALDI,,JEMBER KOTA,DS3
,3,WONGSO,FARIS,,PURWO DAMBUNTUNG,NP1
,4,HADI,ROHMAN,,PURWO PASAR,NS1
,5,SUPRI,YUSUF,,JAJAG RETAIL,NS2
,6,ANDRE,AAN,,KANVAS LKT,N20
`;

export const rawAdminScheduleData = RAW_ADMIN_SCHEDULE_CSV;

const MONTH_NAMES_IND = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

/**
 * Generate month-specific schedule datasets so each month (Januari, Februari, Maret, etc.)
 * has its own independent total area count, ritase count, and daily trip distribution.
 */
export function buildMonthSpecificSchedule(year: number, month: number): AdminScheduleWeek[] {
  // If January 2026, return official real Google Sheet data (6 days, 44 Ritase including Kanvas LKT)
  if (year === 2026 && month === 0) {
    return ADMIN_SCHEDULE_WEEKS;
  }

  const monthName = MONTH_NAMES_IND[month] || 'Januari';

  // Month-distinct template pools of real delivery assignments
  const monthDeliveryTemplatesMap: Record<number, Array<{ driver: string; helper: string; area: string; armada: string }>> = {
    // 0: Januari (14 Unique Areas including Kanvas LKT)
    0: [
      { driver: 'Supri', helper: 'Rifal, Aldi', area: 'DENPASAR 1', armada: 'DS3' },
      { driver: 'Wahyu', helper: 'Yusuf', area: 'DENPASAR 2', armada: 'DS1' },
      { driver: 'Tiar', helper: 'Faris', area: 'BONDOWOSO', armada: 'NS3' },
      { driver: 'Aris', helper: 'Rohman', area: 'SITUBONDO', armada: 'DS2' },
      { driver: 'Andre', helper: 'Aan', area: 'SUSULAN GENTENG - ROGOJAMPI', armada: 'DS4' },
      { driver: 'Wibi', helper: 'Teguh', area: 'PURWO DAMBUNTUNG', armada: 'NS2' },
      { driver: 'Budi', helper: 'Rizal', area: 'PURWO PASAR', armada: 'NS1' },
      { driver: 'Hadi', helper: 'Yudi', area: 'JAJAG RETAIL', armada: 'N20' },
      { driver: 'Joko', helper: 'Yono', area: 'SINGARAJA', armada: 'DS5' },
      { driver: 'Supri', helper: 'Yusuf', area: 'SUMBERAYU RETAIL', armada: 'NL2' },
      { driver: 'Wahyu', helper: 'Rifal', area: 'GALEKAN', armada: 'NL1' },
      { driver: 'Tiar', helper: 'Faris', area: 'GROSIR BWI - ROGOJAMPI', armada: 'DS4' },
      { driver: 'Budi', helper: 'Rohman', area: 'SUSULAN SANGGAR JAJAG', armada: 'NS1' },
      { driver: 'Wongso', helper: 'Rizal', area: 'KANVAS LKT', armada: 'NP1' }
    ],
    // 1: Februari
    1: [
      { driver: 'Supri', helper: 'Yusuf', area: 'DENPASAR 3', armada: 'DS3' },
      { driver: 'Wahyu', helper: 'Rifal', area: 'GIANYAR', armada: 'DS1' },
      { driver: 'Joko', helper: 'Aan', area: 'TABANAN', armada: 'DS5' },
      { driver: 'Slamet', helper: 'Rizal', area: 'NEGARA - GILIMANUK', armada: 'NL1' },
      { driver: 'Tiar', helper: 'Faris', area: 'MUNCAR CENTRAL', armada: 'NS3' },
      { driver: 'Aris', helper: 'Rohman', area: 'BANGOREJO', armada: 'DS2' },
      { driver: 'Wibi', helper: 'Teguh', area: 'PESANGRAN', armada: 'NS2' },
      { driver: 'Budi', helper: 'Yudi', area: 'CLURING SUPERMARKET', armada: 'NS1' },
      { driver: 'Hadi', helper: 'Aldi', area: 'KABAT REGULER', armada: 'N20' },
      { driver: 'Rudi', helper: 'Teguh', area: 'JEMBER EAST HUB', armada: 'DS2' },
      { driver: 'Andre', helper: 'Yono', area: 'BALUNG RETAIL', armada: 'DS4' },
      { driver: 'Supri', helper: 'Rifal', area: 'PROBOLINGGO', armada: 'DS3' },
      { driver: 'Wahyu', helper: 'Faris', area: 'PASURUAN', armada: 'DS1' },
      { driver: 'Aris', helper: 'Rohman', area: 'LUMAJANG', armada: 'DS2' },
      { driver: 'Wongso', helper: 'Rizal', area: 'KANVAS LKT', armada: 'NP1' }
    ],
    // 2: Maret
    2: [
      { driver: 'Supri', helper: 'Rifal, Aldi', area: 'DENPASAR 1', armada: 'DS3' },
      { driver: 'Wahyu', helper: 'Yusuf', area: 'DENPASAR 2', armada: 'DS1' },
      { driver: 'Joko', helper: 'Yono', area: 'SINGARAJA NORTH', armada: 'DS5' },
      { driver: 'Tiar', helper: 'Faris', area: 'BONDOWOSO CITY', armada: 'NS3' },
      { driver: 'Aris', helper: 'Rohman', area: 'SITUBONDO PANTURA', armada: 'DS2' },
      { driver: 'Andre', helper: 'Aan', area: 'GENTENG CENTRAL', armada: 'DS4' },
      { driver: 'Wibi', helper: 'Teguh', area: 'GLAGAH', armada: 'NS2' },
      { driver: 'Budi', helper: 'Rizal', area: 'LICIN BWI', armada: 'NS1' },
      { driver: 'Hadi', helper: 'Yudi', area: 'GLENMORE', armada: 'N20' },
      { driver: 'Rudi', helper: 'Teguh', area: 'KALIBARU', armada: 'DS2' },
      { driver: 'Slamet', helper: 'Yusuf', area: 'SEMPU', armada: 'NL1' },
      { driver: 'Budi', helper: 'Rohman', area: 'SRONO', armada: 'NS1' },
      { driver: 'Wongso', helper: 'Rizal', area: 'KANVAS LKT', armada: 'NP1' }
    ],
    // 3: April
    3: [
      { driver: 'Supri', helper: 'Aldi', area: 'DENPASAR WEST', armada: 'DS3' },
      { driver: 'Wahyu', helper: 'Rifal', area: 'TABANAN SOUTH', armada: 'DS1' },
      { driver: 'Tiar', helper: 'Faris', area: 'BONDOWOSO SOUTH', armada: 'NS3' },
      { driver: 'Aris', helper: 'Rohman', area: 'SITUBONDO EAST', armada: 'DS2' },
      { driver: 'Andre', helper: 'Aan', area: 'MUNCAR PORT', armada: 'DS4' },
      { driver: 'Wibi', helper: 'Teguh', area: 'GENTENG WEST', armada: 'NS2' },
      { driver: 'Budi', helper: 'Yudi', area: 'SRONO CENTRAL', armada: 'NS1' },
      { driver: 'Hadi', helper: 'Rizal', area: 'ROGOMULYO', armada: 'N20' },
      { driver: 'Joko', helper: 'Yono', area: 'BANGOREJO NORTH', armada: 'DS5' },
      { driver: 'Slamet', helper: 'Yusuf', area: 'CLURING RETAIL', armada: 'NL1' },
      { driver: 'Wongso', helper: 'Rizal', area: 'KANVAS LKT', armada: 'NP1' }
    ]
  };

  const deliveryTemplates = monthDeliveryTemplatesMap[month] || monthDeliveryTemplatesMap[0];

  // Specific trip counts per month for rich realistic differentiation
  const activeDayCountsMap: Record<number, number[]> = {
    0: [8, 5, 10, 8, 9, 8, 12, 10, 15, 15], // January: 100 Rit
    1: [8, 7, 9, 8, 7, 10, 8, 11, 14],      // February: 82 Rit
    2: [9, 8, 10, 9, 8, 11, 9, 12, 9, 9],  // March: 94 Rit
    3: [8, 7, 9, 8, 10, 11, 10, 12],       // April: 75 Rit
    4: [9, 8, 11, 10, 9, 12, 9, 10, 10],   // May: 88 Rit
  };

  const dayCounts = activeDayCountsMap[month] || [8, 7, 9, 8, 7, 10, 8, 11, 9];

  const days: AdminScheduleDay[] = [];
  let currentDayNumber = 2; // Start from 2nd of the month

  dayCounts.forEach((tripsInDay, dayIdx) => {
    const dateObj = new Date(year, month, currentDayNumber);
    const dayNameStr = DAY_NAMES[dateObj.getDay()] || 'SENIN';
    const dayNumFormatted = String(dateObj.getDate()).padStart(2, '0');
    const dateString = `${dayNumFormatted} ${monthName} ${year}`;

    // Pick distinct trips for this day
    const dayPengiriman: DeliveryAssignment[] = [];
    for (let i = 0; i < tripsInDay; i++) {
      const templateItem = deliveryTemplates[(dayIdx * 3 + i) % deliveryTemplates.length];
      dayPengiriman.push({
        ...templateItem,
        target: `Gudang Pusat AKK Banyuwangi DC`
      });
    }

    days.push({
      dayNumber: dateObj.getDate(),
      dayName: dayNameStr,
      dateString,
      pengiriman: dayPengiriman,
      gudang: [],
      pengirimanOff: [],
      karyawanIzin: []
    });

    currentDayNumber += (dateObj.getDay() === 5 ? 3 : 1); // Skip weekends
  });

  return [
    {
      weekNumber: 1,
      weekLabel: `JADWAL PENGIRIMAN AKTIF (${monthName.toUpperCase()} ${year})`,
      dateRangeLabel: `${monthName} ${year}`,
      days
    }
  ];
}

/**
 * Dynamically group parsed spreadsheet trips into structured AdminScheduleWeek[]
 */
export function convertParsedTripsToWeeks(trips: Array<{
  driver: string;
  helper?: string;
  helper2?: string;
  area: string;
  armada: string;
  target?: string;
  dateStr?: string;
  dayName?: string;
}>): AdminScheduleWeek[] {
  if (!trips || trips.length === 0) return ADMIN_SCHEDULE_WEEKS;

  const dayMap = new Map<string, AdminScheduleDay>();

  trips.forEach((t) => {
    let rawDateStr = t.dateStr || '2026-01-05';
    const parsedRes = scheduleImportValidator.parseDate(rawDateStr, new Date(2026, 0, 5));
    const dateObj = parsedRes.date || new Date(2026, 0, 5);

    const dayNum = dateObj.getDate();
    const daysArr = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const dayNameStr = t.dayName || daysArr[dateObj.getDay()] || 'SENIN';
    const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const monthNameDisplay = MONTH_NAMES_IND[dateObj.getMonth()] || 'Januari';
    const displayDate = `${String(dayNum).padStart(2, '0')} ${monthNameDisplay} ${dateObj.getFullYear()}`;

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dayNumber: dayNum,
        dayName: dayNameStr.toUpperCase(),
        dateString: displayDate,
        pengiriman: [],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      });
    }

    const targetDay = dayMap.get(dateKey)!;
    targetDay.pengiriman.push({
      id: (t as any).id || `sch-trip-${dateKey}-${(t.armada || 'FLT').replace(/[^A-Za-z0-9]/g, '')}-${targetDay.pengiriman.length + 1}`,
      driver: t.driver,
      helper: t.helper && t.helper !== '-' ? t.helper : '-',
      helper2: t.helper2 && t.helper2 !== '-' ? t.helper2 : (t as any).helper2Name || '-',
      area: t.area,
      armada: t.armada,
      target: t.target,
      isManuallyEdited: !!(t as any).isManuallyEdited
    });
  });

  const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);

  return [
    {
      weekNumber: 1,
      weekLabel: `JADWAL PENGIRIMAN AKTIF (SHEET: ALL • ${sortedDays.length} HARI)`,
      dateRangeLabel: 'Januari 2026',
      days: sortedDays
    }
  ];
}

/**
 * Convert real operational Schedule[] items from logisticsStore to AdminScheduleWeek[]
 */
export function getScheduleCalendarDateObj(sch: any): Date | null {
  if (!sch || !sch.departureDate) return null;
  const dep = new Date(sch.departureDate);
  if (isNaN(dep.getTime())) return null;
  if (sch.estimatedArrival) {
    const arr = new Date(sch.estimatedArrival);
    if (!isNaN(arr.getTime())) {
      const depKey = `${dep.getFullYear()}-${String(dep.getMonth() + 1).padStart(2, '0')}-${String(dep.getDate()).padStart(2, '0')}`;
      const arrKey = `${arr.getFullYear()}-${String(arr.getMonth() + 1).padStart(2, '0')}-${String(arr.getDate()).padStart(2, '0')}`;
      if (arrKey > depKey) {
        return arr;
      }
    }
  }
  return dep;
}

export function convertSchedulesToAdminWeeks(
  schedules: any[], 
  year: number, 
  month: number
): AdminScheduleWeek[] {
  const monthName = MONTH_NAMES_IND[month] || 'Januari';
  const dayMap = new Map<number, AdminScheduleDay>();

  const filtered = (schedules || []).filter(s => {
    const d = getScheduleCalendarDateObj(s);
    if (!d) return false;
    return d.getFullYear() === year && d.getMonth() === month;
  });

  if (filtered.length === 0) {
    return [];
  }

  filtered.forEach(sch => {
    const d = getScheduleCalendarDateObj(sch)!;
    const depObj = new Date(sch.departureDate);
    const arrObj = sch.estimatedArrival ? new Date(sch.estimatedArrival) : d;
    const dayNum = d.getDate();
    const dayNameStr = DAY_NAMES[d.getDay()] || 'SENIN';
    const dayNumFormatted = String(dayNum).padStart(2, '0');
    const dateString = `${dayNumFormatted} ${monthName} ${year}`;

    if (!dayMap.has(dayNum)) {
      dayMap.set(dayNum, {
        dayNumber: dayNum,
        dayName: dayNameStr,
        dateString,
        pengiriman: [],
        gudang: [],
        pengirimanOff: [],
        karyawanIzin: []
      });
    }

    const dayObj = dayMap.get(dayNum)!;
    const driverName = sch.crew?.name || (typeof sch.crewId === 'string' && !sch.crewId.startsWith('crw-') ? sch.crewId : (sch.crewId ? 'Driver ' + sch.crewId.replace('crw-', '') : 'Driver'));
    const helperName = sch.crewHelper?.name || (sch.crewHelperId ? (typeof sch.crewHelperId === 'string' && !sch.crewHelperId.startsWith('crw-') ? sch.crewHelperId : 'Helper ' + sch.crewHelperId.replace('crw-', '')) : (sch.helper && sch.helper !== '-' ? sch.helper : '-'));
    const helper2Name = sch.crewHelper2?.name || (sch.crewHelper2Id ? (typeof sch.crewHelper2Id ? (!sch.crewHelper2Id.startsWith('crw-') ? sch.crewHelper2Id : 'Helper ' + sch.crewHelper2Id.replace('crw-', '')) : '-') : (sch.helper2 && sch.helper2 !== '-' ? sch.helper2 : '-'));
    const areaName = sch.areaName || sch.store?.storeName || 'Area Kirim';
    const armadaName = sch.fleet?.initialCode || sch.fleet?.plateNumber || sch.fleetId || 'DS3';
    const targetDesc = sch.notes || sch.cargoDescription || 'Gudang Pusat AKK Banyuwangi DC';

    const depIsoDate = !isNaN(depObj.getTime())
      ? `${depObj.getFullYear()}-${String(depObj.getMonth() + 1).padStart(2, '0')}-${String(depObj.getDate()).padStart(2, '0')}`
      : undefined;
    const retIsoDate = !isNaN(arrObj.getTime())
      ? `${arrObj.getFullYear()}-${String(arrObj.getMonth() + 1).padStart(2, '0')}-${String(arrObj.getDate()).padStart(2, '0')}`
      : undefined;
    const depTimeStr = !isNaN(depObj.getTime())
      ? `${String(depObj.getHours()).padStart(2, '0')}:${String(depObj.getMinutes()).padStart(2, '0')}`
      : '07:30';
    const retTimeStr = !isNaN(arrObj.getTime())
      ? `${String(arrObj.getHours()).padStart(2, '0')}:${String(arrObj.getMinutes()).padStart(2, '0')}`
      : '17:00';

    if (!dayObj.pengiriman.some(existing => existing.id && existing.id === sch.id)) {
      dayObj.pengiriman.push({
        id: sch.id,
        driver: driverName,
        helper: helperName || '-',
        helper2: helper2Name || '-',
        area: areaName,
        armada: armadaName,
        target: targetDesc,
        departureTime: depTimeStr,
        targetReturnTime: retTimeStr,
        departureDateIso: depIsoDate,
        returnDateIso: retIsoDate,
        branchId: sch.originBranchId || (sch.id ? branchStore.getScheduleBranchId(sch.id, sch.originName, sch.fleetId) : undefined),
        isManuallyEdited: !!sch.isManuallyEdited
      });
    }
  });

  const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);

  return [
    {
      weekNumber: 1,
      weekLabel: `JADWAL PENGIRIMAN AKTIF (${monthName.toUpperCase()} ${year} • ${sortedDays.length} HARI)`,
      dateRangeLabel: `${monthName} ${year}`,
      days: sortedDays
    }
  ];
}

