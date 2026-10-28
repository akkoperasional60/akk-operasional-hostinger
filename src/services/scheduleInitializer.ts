import { Schedule, RetailStore, Fleet, Crew, ShipmentStatus } from '../types';
import { logisticsStore } from './store';
import { calculateScheduleTimestamps, getAreaScheduleTiming } from '../utils/areaScheduleRules';

export interface FixedDailyRouteConfig {
  dayName: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  dayOffset: number; // 0 for Monday, 1 for Tuesday, ..., 5 for Saturday
  storeName: string;
  category: 'Inter-Island' | 'Reguler' | 'Susulan' | 'Grosir';
  isLuarKota: boolean;
  city: string;
  province: string;
  island: 'Jawa' | 'Bali & Nusa Tenggara' | 'Sumatera' | 'Kalimantan' | 'Sulawesi' | 'Papua & Maluku';
  distanceKm: number;
  estimatedHours: number;
  defaultCargoWeight: number;
  cargoDesc: string;
}

export const FIXED_WEEKLY_ROUTES_CONFIG: FixedDailyRouteConfig[] = [
  // 1. HARI SENIN (5 Rute: 4 Luar Kota + 1 Lokal)
  { dayName: 'Senin', dayOffset: 0, storeName: 'Denpasar 1 Retail Utama', category: 'Inter-Island', isLuarKota: true, city: 'Denpasar', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 145, estimatedHours: 10, defaultCargoWeight: 14.5, cargoDesc: 'FMCG, Minyak Goreng & Beras Premium (Palet Standar)' },
  { dayName: 'Senin', dayOffset: 0, storeName: 'Denpasar 2 Supermarket Hub', category: 'Inter-Island', isLuarKota: true, city: 'Denpasar', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 150, estimatedHours: 11, defaultCargoWeight: 15.0, cargoDesc: 'Gula Pasir, Tepung Terigu & Sembako Grosir' },
  { dayName: 'Senin', dayOffset: 0, storeName: 'Situbondo Retail Cluster', category: 'Reguler', isLuarKota: true, city: 'Situbondo', province: 'Jawa Timur', island: 'Jawa', distanceKm: 95, estimatedHours: 3.5, defaultCargoWeight: 10.0, cargoDesc: 'Minuman Kemasan, Sabun & Detergen' },
  { dayName: 'Senin', dayOffset: 0, storeName: 'Bondowoso Distribution Hub', category: 'Reguler', isLuarKota: true, city: 'Bondowoso', province: 'Jawa Timur', island: 'Jawa', distanceKm: 110, estimatedHours: 4, defaultCargoWeight: 12.0, cargoDesc: 'Consumer Goods & Makanan Ringan' },
  { dayName: 'Senin', dayOffset: 0, storeName: 'Susulan Genteng - Rogojampi', category: 'Susulan', isLuarKota: false, city: 'Banyuwangi', province: 'Jawa Timur', island: 'Jawa', distanceKm: 35, estimatedHours: 2, defaultCargoWeight: 5.5, cargoDesc: 'Restok Cepat Toko Genteng & Rogojampi' },

  // 2. HARI SELASA (6 Rute: 2 Luar Kota + 4 Lokal)
  { dayName: 'Selasa', dayOffset: 1, storeName: 'Jember Selatan Retail Hub', category: 'Reguler', isLuarKota: true, city: 'Jember', province: 'Jawa Timur', island: 'Jawa', distanceKm: 125, estimatedHours: 4.5, defaultCargoWeight: 14.0, cargoDesc: 'Sembako, Susu Kemasan & Minyak Goreng' },
  { dayName: 'Selasa', dayOffset: 1, storeName: 'Singaraja Bali Distribution', category: 'Inter-Island', isLuarKota: true, city: 'Buleleng / Singaraja', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 135, estimatedHours: 9, defaultCargoWeight: 13.5, cargoDesc: 'Bahan Pokok & Makanan Kering Bali Utara' },
  { dayName: 'Selasa', dayOffset: 1, storeName: 'Sumberayu Retail Store', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Sumberayu)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 45, estimatedHours: 2.5, defaultCargoWeight: 7.5, cargoDesc: 'Produk Segar, Biskuit & Minuman' },
  { dayName: 'Selasa', dayOffset: 1, storeName: 'Galekan Retail Mart', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Galekan)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 40, estimatedHours: 2, defaultCargoWeight: 6.0, cargoDesc: 'Personal Care & Household Supplies' },
  { dayName: 'Selasa', dayOffset: 1, storeName: 'Grosir 1 Banyuwangi Kota', category: 'Grosir', isLuarKota: false, city: 'Banyuwangi Kota', province: 'Jawa Timur', island: 'Jawa', distanceKm: 15, estimatedHours: 1.5, defaultCargoWeight: 16.0, cargoDesc: 'Beras Bulog, Gula Industri & Tepung' },
  { dayName: 'Selasa', dayOffset: 1, storeName: 'Susulan Sanggar - Jajag', category: 'Susulan', isLuarKota: false, city: 'Banyuwangi (Sanggar-Jajag)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 50, estimatedHours: 2.5, defaultCargoWeight: 5.0, cargoDesc: 'Tambahan Order Urgent Jajag Cluster' },

  // 3. HARI RABU (6 Rute: 2 Luar Kota + 4 Lokal)
  { dayName: 'Rabu', dayOffset: 2, storeName: 'Denpasar 1 Retail Utama', category: 'Inter-Island', isLuarKota: true, city: 'Denpasar', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 145, estimatedHours: 10, defaultCargoWeight: 14.0, cargoDesc: 'Restok Mingguan Denpasar 1' },
  { dayName: 'Rabu', dayOffset: 2, storeName: 'Denpasar 2 Supermarket Hub', category: 'Inter-Island', isLuarKota: true, city: 'Denpasar', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 150, estimatedHours: 11, defaultCargoWeight: 15.0, cargoDesc: 'Produk Kemasan & Minuman Kaleng' },
  { dayName: 'Rabu', dayOffset: 2, storeName: 'Genteng Retail Store', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Genteng)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 38, estimatedHours: 2, defaultCargoWeight: 8.5, cargoDesc: 'Snack, Mie Instan & Bumbu Dapur' },
  { dayName: 'Rabu', dayOffset: 2, storeName: 'Rogojampi Retail Store', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Rogojampi)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 22, estimatedHours: 1.5, defaultCargoWeight: 7.0, cargoDesc: 'Kebutuhan Harian & Sabun Mandi' },
  { dayName: 'Rabu', dayOffset: 2, storeName: 'Muncar Pasar Central', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Muncar)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 42, estimatedHours: 2.5, defaultCargoWeight: 9.0, cargoDesc: 'Grosir Pasar Muncar Assorted' },
  { dayName: 'Rabu', dayOffset: 2, storeName: 'Muncar Pinggir Retail', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Muncar Pesisir)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 46, estimatedHours: 2.5, defaultCargoWeight: 6.5, cargoDesc: 'Sembako Retail Pesisir Muncar' },

  // 4. HARI KAMIS (6 Rute: 3 Luar Kota + 3 Lokal)
  { dayName: 'Kamis', dayOffset: 3, storeName: 'Susulan Singaraja Bali', category: 'Susulan', isLuarKota: true, city: 'Buleleng / Singaraja', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 135, estimatedHours: 9, defaultCargoWeight: 6.5, cargoDesc: 'Muatan Tambahan Retail Singaraja' },
  { dayName: 'Kamis', dayOffset: 3, storeName: 'Susulan Situbondo - Bondowoso', category: 'Susulan', isLuarKota: true, city: 'Situbondo - Bondowoso', province: 'Jawa Timur', island: 'Jawa', distanceKm: 105, estimatedHours: 4, defaultCargoWeight: 7.0, cargoDesc: 'Order Susulan Wilayah Pantura Jatim' },
  { dayName: 'Kamis', dayOffset: 3, storeName: 'Jember Barat Distribution', category: 'Reguler', isLuarKota: true, city: 'Jember Barat', province: 'Jawa Timur', island: 'Jawa', distanceKm: 130, estimatedHours: 5, defaultCargoWeight: 13.5, cargoDesc: 'Pasokan Sembako & Minyak Jember Barat' },
  { dayName: 'Kamis', dayOffset: 3, storeName: 'Grosir 2 Retail Hub', category: 'Grosir', isLuarKota: false, city: 'Banyuwangi (Grosir 2)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 25, estimatedHours: 2, defaultCargoWeight: 15.5, cargoDesc: 'Gula Pasir & Beras Sak 50kg' },
  { dayName: 'Kamis', dayOffset: 3, storeName: 'Songgon Retail Mart', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Songgon)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 32, estimatedHours: 2, defaultCargoWeight: 6.0, cargoDesc: 'Produk Rumah Tangga & Minuman' },
  { dayName: 'Kamis', dayOffset: 3, storeName: 'BWI Kota Selatan Retail', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi Selatan', province: 'Jawa Timur', island: 'Jawa', distanceKm: 18, estimatedHours: 1.5, defaultCargoWeight: 8.0, cargoDesc: 'Snack, Kopi & Teh Kemasan' },

  // 5. HARI JUMAT (6 Rute: 0 Luar Kota [Recovery Day] + 6 Lokal)
  { dayName: 'Jumat', dayOffset: 4, storeName: 'Ketapang - Wongsorejo Store', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi Utara', province: 'Jawa Timur', island: 'Jawa', distanceKm: 30, estimatedHours: 2, defaultCargoWeight: 9.0, cargoDesc: 'Distribusi Jalur Pelabuhan Ketapang & Wongsorejo' },
  { dayName: 'Jumat', dayOffset: 4, storeName: 'Sanggar Retail Mart', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Sanggar)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 52, estimatedHours: 2.5, defaultCargoWeight: 6.5, cargoDesc: 'Kebutuhan Pokok & Sabun Cuci' },
  { dayName: 'Jumat', dayOffset: 4, storeName: 'Kalibaru Retail Hub', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Kalibaru)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 60, estimatedHours: 3, defaultCargoWeight: 10.5, cargoDesc: 'Pasokan Retail Kalibaru & Gumitir' },
  { dayName: 'Jumat', dayOffset: 4, storeName: 'Grosir 3 Distribution', category: 'Grosir', isLuarKota: false, city: 'Banyuwangi (Grosir 3)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 30, estimatedHours: 2, defaultCargoWeight: 16.0, cargoDesc: 'Beras Premium, Tepung & Minyak Goreng' },
  { dayName: 'Jumat', dayOffset: 4, storeName: 'Susulan Rogojampi - Muncar', category: 'Susulan', isLuarKota: false, city: 'Rogojampi - Muncar', province: 'Jawa Timur', island: 'Jawa', distanceKm: 40, estimatedHours: 2.5, defaultCargoWeight: 5.5, cargoDesc: 'Susulan Akhir Pekan Rogojampi Muncar' },
  { dayName: 'Jumat', dayOffset: 4, storeName: 'Sempu Stail Retail Store', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Sempu Stail)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 36, estimatedHours: 2, defaultCargoWeight: 7.0, cargoDesc: 'Makanan Ringan & Sembako Sempu' },

  // 6. HARI SABTU (7 Rute: 2 Luar Kota + 5 Lokal)
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Negara Bali Barat Mart', category: 'Inter-Island', isLuarKota: true, city: 'Jembrana / Negara', province: 'Bali', island: 'Bali & Nusa Tenggara', distanceKm: 90, estimatedHours: 6.5, defaultCargoWeight: 12.0, cargoDesc: 'Sembako & FMCG Toko Utama Negara Bali' },
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Jember Kota Central Mall Hub', category: 'Reguler', isLuarKota: true, city: 'Jember Kota', province: 'Jawa Timur', island: 'Jawa', distanceKm: 115, estimatedHours: 4.5, defaultCargoWeight: 14.0, cargoDesc: 'Pasokan Weekend Hypermart & Retail Jember Kota' },
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Purwo Pasar Central', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Purwoharjo)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 55, estimatedHours: 2.5, defaultCargoWeight: 8.5, cargoDesc: 'Sembako Pasar Purwoharjo' },
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Purwo Dambuntung Retail', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Dambuntung)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 58, estimatedHours: 3, defaultCargoWeight: 7.5, cargoDesc: 'Produk Retail Dambuntung' },
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Jajag Retail Hub', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Jajag)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 48, estimatedHours: 2.5, defaultCargoWeight: 11.0, cargoDesc: 'Grosir & Retail Jajag Komplit' },
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Srono Retail Store', category: 'Reguler', isLuarKota: false, city: 'Banyuwangi (Srono)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 34, estimatedHours: 2, defaultCargoWeight: 8.0, cargoDesc: 'Consumer Goods & Minyak Srono' },
  { dayName: 'Sabtu', dayOffset: 5, storeName: 'Grosir 4 Hub Banyuwangi', category: 'Grosir', isLuarKota: false, city: 'Banyuwangi (Grosir 4)', province: 'Jawa Timur', island: 'Jawa', distanceKm: 35, estimatedHours: 2, defaultCargoWeight: 16.5, cargoDesc: 'Gula Pasir & Beras Stok Weekend' },
];

export interface SmartFillOptions {
  weekOffset?: number; // 0 for current week, 1 for next week, etc.
  startDate?: Date; // Custom Monday start date
  mode?: 'full_priority' | 'outbound_only' | 'local_only' | 'custom_days';
  selectedDays?: ('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu')[];
  overwriteExisting?: boolean;
  autoAssignFerryTicket?: boolean;
  enforce24hGap?: boolean;
  isUrgent?: boolean; // Override flag for out-of-town restriction on local-only crew
}

export interface SmartFillValidationConflict {
  dayName: string;
  nextDayName: string;
  driverId: string;
  driverName: string;
  currentTrip: {
    destination: string;
    departure: string;
    isLuarKota: boolean;
  };
  nextTrip: {
    destination: string;
    departure: string;
    isLuarKota: boolean;
  };
  gapHours: number;
  severity: 'critical' | 'warning';
  message: string;
}

export interface SmartFillResult {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  outboundCount: number;
  localCount: number;
  conflicts: SmartFillValidationConflict[];
  isFullyCompliant: boolean;
  schedules: Schedule[];
}

export class ScheduleInitializerService {
  /**
   * Helper to validate cross-day conflicts (H to H+1) across a given list of schedules
   */
  public static validateCrossDayConflicts(schedulesList: Schedule[]): SmartFillValidationConflict[] {
    const conflicts: SmartFillValidationConflict[] = [];
    
    // Group schedules by driver
    const driverTripsMap = new Map<string, Schedule[]>();
    schedulesList.forEach(s => {
      if (s.crewId) {
        const list = driverTripsMap.get(s.crewId) || [];
        list.push(s);
        driverTripsMap.set(s.crewId, list);
      }
    });

    driverTripsMap.forEach((trips, driverId) => {
      const sorted = [...trips].sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
      
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];

        const curIsOutbound = cur.isInterIsland || 
          (cur.store?.island && cur.store.island !== 'Jawa') ||
          (cur.notes && cur.notes.toLowerCase().includes('luar kota')) ||
          (cur.store?.city && ['denpasar', 'singaraja', 'negara', 'situbondo', 'bondowoso', 'jember'].some(c => cur.store!.city.toLowerCase().includes(c)));

        const nextIsOutbound = next.isInterIsland || 
          (next.store?.island && next.store.island !== 'Jawa') ||
          (next.notes && next.notes.toLowerCase().includes('luar kota')) ||
          (next.store?.city && ['denpasar', 'singaraja', 'negara', 'situbondo', 'bondowoso', 'jember'].some(c => next.store!.city.toLowerCase().includes(c)));

        const curTime = new Date(cur.departureDate).getTime();
        const nextTime = new Date(next.departureDate).getTime();
        const gapHours = Math.round(((nextTime - curTime) / (1000 * 60 * 60)) * 10) / 10;

        // Check cross-day constraint: Luar kota trips must have >= 24h gap
        if ((curIsOutbound || nextIsOutbound) && gapHours < 24) {
          const curDay = new Date(cur.departureDate).toLocaleDateString('id-ID', { weekday: 'long' });
          const nextDay = new Date(next.departureDate).toLocaleDateString('id-ID', { weekday: 'long' });

          conflicts.push({
            dayName: curDay,
            nextDayName: nextDay,
            driverId,
            driverName: cur.crew?.name || 'Supir',
            currentTrip: {
              destination: cur.store?.storeName || cur.storeId,
              departure: cur.departureDate,
              isLuarKota: Boolean(curIsOutbound)
            },
            nextTrip: {
              destination: next.store?.storeName || next.storeId,
              departure: next.departureDate,
              isLuarKota: Boolean(nextIsOutbound)
            },
            gapHours,
            severity: curIsOutbound && nextIsOutbound ? 'critical' : 'warning',
            message: `Supir ${cur.crew?.name || 'Supir'} ditugaskan rute Luar Kota berturut-turut pada ${curDay} & ${nextDay} dengan jeda hanya ${gapHours} jam (< 24 jam).`
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Smart Fill Engine:
   * Fills weekly recurring schedules automatically following the agreed priority patterns
   * (Senin-Sabtu) with automated cross-day rest gap validation.
   */
  public static runSmartFill(options: SmartFillOptions = {}): SmartFillResult {
    const existingStores = logisticsStore.getStores();
    const existingFleets = logisticsStore.getFleets();
    const existingCrews = logisticsStore.getCrews();
    const currentSchedules = logisticsStore.getSchedules();

    const drivers = existingCrews.filter(c => !c.role.includes('Helper') && c.role !== 'Kernet / Helper');
    const helpers = existingCrews.filter(c => c.role.includes('Helper') || c.role === 'Kernet / Helper');

    // Calculate Target Monday
    const now = options.startDate ? new Date(options.startDate) : new Date();
    const currentDayOfWeek = now.getDay();
    const distanceToMonday = (currentDayOfWeek === 0 ? -6 : 1) - currentDayOfWeek;
    
    const targetMonday = new Date(now);
    targetMonday.setDate(now.getDate() + distanceToMonday + ((options.weekOffset || 0) * 7));
    targetMonday.setHours(7, 0, 0, 0);

    const mode = options.mode || 'full_priority';
    const selectedDays = options.selectedDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const overwriteExisting = Boolean(options.overwriteExisting);

    // Filter which routes to process based on mode and selected days
    const routesToProcess = FIXED_WEEKLY_ROUTES_CONFIG.filter(cfg => {
      if (!selectedDays.includes(cfg.dayName)) return false;
      if (mode === 'outbound_only' && !cfg.isLuarKota) return false;
      if (mode === 'local_only' && cfg.isLuarKota) return false;
      return true;
    });

    const createdStoresMap = new Map<string, RetailStore>();
    const newlyCreatedSchedules: Schedule[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let outboundCount = 0;
    let localCount = 0;

    // Intelligent Driver Scheduling Matrix to ensure >= 24h rest on Luar Kota trips
    // Day 0 (Senin): Drivers 0, 1, 2, 3 (4 Outbound)
    // Day 1 (Selasa): Drivers 4, 5 (2 Outbound) -> 0..3 rest from LK
    // Day 2 (Rabu): Drivers 0, 1 (2 Outbound) -> Rested Tuesday
    // Day 3 (Kamis): Drivers 2, 3, 4 (3 Outbound) -> Rested Wednesday
    // Day 4 (Jumat): 0 Outbound (All Drivers recover/local)
    // Day 5 (Sabtu): Drivers 0, 5 (2 Outbound) -> Rested Friday

    routesToProcess.forEach((config, idx) => {
      if (config.isLuarKota) {
        outboundCount++;
      } else {
        localCount++;
      }

      // Ensure Store exists
      let matchedStore = existingStores.find(s => 
        s.storeName.toLowerCase().includes(config.storeName.toLowerCase()) ||
        config.storeName.toLowerCase().includes(s.storeName.toLowerCase()) ||
        (s.city.toLowerCase() === config.city.toLowerCase() && s.island === config.island)
      );

      if (!matchedStore) {
        if (!createdStoresMap.has(config.storeName)) {
          const areaDestination: RetailStore = {
            id: 'area-dest-' + config.dayName.toLowerCase() + '-' + idx,
            storeCode: 'AREA-' + config.city.substring(0, 3).toUpperCase(),
            storeName: config.storeName,
            island: config.island,
            province: config.province,
            city: config.city,
            address: `Area Koridor Distribusi & Rute ${config.storeName}`,
            latitude: -8.2192 + (Math.random() - 0.5) * 0.4,
            longitude: 114.3692 + (Math.random() - 0.5) * 0.5,
            contactPerson: `PIC Logistik Area ${config.city}`,
            phone: '0812-3456-7890',
            deliveryWindow: '08:00 - 17:00',
            storeCategory: config.category === 'Grosir' ? 'Distribution Hub' : (config.category === 'Inter-Island' ? 'Hypermarket' : 'Supermarket')
          };
          createdStoresMap.set(config.storeName, areaDestination);
          // Do not add to retail stores collection since this is a delivery route area, not a retail customer store
          matchedStore = areaDestination;
        } else {
          matchedStore = createdStoresMap.get(config.storeName)!;
        }
      }

      // Calculate departure and arrival date according to PT AKK Area Timing Rules
      const routeDate = new Date(targetMonday);
      routeDate.setDate(targetMonday.getDate() + config.dayOffset);
      
      const timingResult = calculateScheduleTimestamps(
        routeDate,
        config.storeName,
        config.storeName,
        config.city
      );
      routeDate.setHours(timingResult.timing.departureHour, timingResult.timing.departureMinute, 0, 0);
      const arrivalDate = new Date(timingResult.estimatedArrival);

      // Ferry Ticket Logistics
      const isInterIsland = config.island !== 'Jawa';
      let defaultTransit = '';
      let defaultBooking = '';
      if (isInterIsland && (options.autoAssignFerryTicket !== false)) {
        if (config.island === 'Bali & Nusa Tenggara') {
          defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
          defaultBooking = 'ASDP-KTP-GLM-' + (20260000 + idx);
        } else if (config.island === 'Sumatera') {
          defaultTransit = 'Pelabuhan Merak (Eksekutif) -> Pelabuhan Bakauheni';
          defaultBooking = 'ASDP-MRK-BKU-' + (20260000 + idx);
        }
      }

      // Crew Assignment Anti-Fatigue logic with Out-of-Town & Forbidden Pairing constraints
      let eligibleDrivers = drivers;
      if (config.isLuarKota && !options.isUrgent) {
        // Exclude drivers restricted to local Banyuwangi only
        const allowed = drivers.filter(d => d.allowOutofTown !== false);
        if (allowed.length > 0) eligibleDrivers = allowed;
      }

      let driverIdx = 0;
      if (config.isLuarKota) {
        if (config.dayName === 'Senin') {
          const lkOrder = idx % 4;
          driverIdx = lkOrder % (eligibleDrivers.length || 1);
        } else if (config.dayName === 'Selasa') {
          const lkOrder = idx % 2;
          driverIdx = (4 + lkOrder) % (eligibleDrivers.length || 1);
        } else if (config.dayName === 'Rabu') {
          const lkOrder = idx % 2;
          driverIdx = lkOrder % (eligibleDrivers.length || 1);
        } else if (config.dayName === 'Kamis') {
          const lkOrder = idx % 3;
          driverIdx = (2 + lkOrder) % (eligibleDrivers.length || 1);
        } else if (config.dayName === 'Sabtu') {
          const lkOrder = idx % 2;
          driverIdx = (lkOrder === 0 ? 0 : 5) % (eligibleDrivers.length || 1);
        }
      } else {
        driverIdx = (idx * 2 + 1) % (eligibleDrivers.length || 1);
      }

      const driver = eligibleDrivers[driverIdx] || drivers[0];

      // Helper assignment with out-of-town & forbidden pairing checks
      let eligibleHelpers = helpers;
      if (config.isLuarKota && !options.isUrgent) {
        eligibleHelpers = helpers.filter(h => h.allowOutofTown !== false);
        if (eligibleHelpers.length === 0) eligibleHelpers = helpers;
      }

      // Exclude helpers forbidden to pair with this driver
      const compatibleHelpers = eligibleHelpers.filter(h => {
        const driverForbidden = driver.forbiddenPairCrewIds && driver.forbiddenPairCrewIds.includes(h.id);
        const helperForbidden = h.forbiddenPairCrewIds && h.forbiddenPairCrewIds.includes(driver.id);
        return !driverForbidden && !helperForbidden;
      });

      const activeHelpers = compatibleHelpers.length > 0 ? compatibleHelpers : eligibleHelpers;
      const helperIdx = (driverIdx * 3 + 2) % (activeHelpers.length || 1);
      const helper = activeHelpers[helperIdx] || helpers[0];

      // Fleet Allocation by Cargo Weight
      const suitableFleet = existingFleets.find(f => {
        if (config.defaultCargoWeight > 12) return f.vehicleType === 'Double STD';
        if (config.defaultCargoWeight > 7) return f.vehicleType === 'Engkel Long' || f.vehicleType === 'Double STD';
        return true;
      }) || existingFleets[idx % (existingFleets.length || 1)] || existingFleets[0];

      // Formulate unique tracking number
      const dateStr = routeDate.toISOString().substring(0, 10).replace(/-/g, '');
      const trackingNumber = `TRK-${dateStr}-${config.dayName.substring(0, 3).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`;

      const existingIndex = currentSchedules.findIndex(s => s.trackingNumber === trackingNumber);

      const scheduleData: Omit<Schedule, 'id' | 'createdAt'> = {
        trackingNumber,
        originName: 'Gudang Pusat Banyuwangi DC',
        originCoords: [-8.2192, 114.3692],
        storeId: matchedStore.id,
        store: matchedStore,
        fleetId: suitableFleet ? suitableFleet.id : '',
        fleet: suitableFleet,
        crewId: driver ? driver.id : '',
        crewHelperId: helper ? helper.id : '',
        crew: driver,
        crewHelper: helper,
        status: 'scheduled' as ShipmentStatus,
        departureDate: routeDate.toISOString().substring(0, 16),
        estimatedArrival: arrivalDate.toISOString().substring(0, 16),
        cargoDescription: config.cargoDesc,
        cargoWeightTon: config.defaultCargoWeight,
        isInterIsland,
        ferryBookingCode: defaultBooking,
        transitPort: defaultTransit,
        notes: `${config.isLuarKota ? '⭐ Prioritas Luar Kota' : '📦 Distribusi Lokal'} - ${config.dayName} (${config.category}) - ${config.storeName}. Jadwal: Berangkat ${timingResult.timing.departureLabel} • Pulang ${timingResult.timing.isNextDayReturn ? 'Besok ' : ''}${timingResult.timing.returnLabel}.`
      };

      if (existingIndex >= 0) {
        if (overwriteExisting) {
          const existingId = currentSchedules[existingIndex].id;
          logisticsStore.updateSchedule(existingId, scheduleData);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        const created = logisticsStore.addSchedule(scheduleData);
        newlyCreatedSchedules.push(created);
        addedCount++;
      }
    });

    const allCurrentSchedules = logisticsStore.getSchedules();
    const conflicts = ScheduleInitializerService.validateCrossDayConflicts(allCurrentSchedules);

    logisticsStore.logActivity(
      'Smart Fill Jadwal Mingguan (Pola Prioritas)',
      `Target: ${targetMonday.toLocaleDateString('id-ID')}`,
      `Smart Fill mengeksekusi ${addedCount} rute baru (${outboundCount} Luar Kota & ${localCount} Lokal). Status bentrok keesokan hari: ${conflicts.length === 0 ? '100% AMAN' : `${conflicts.length} Perlu Penyesuaian`}.`
    );

    return {
      addedCount,
      updatedCount,
      skippedCount,
      outboundCount,
      localCount,
      conflicts,
      isFullyCompliant: conflicts.length === 0,
      schedules: allCurrentSchedules
    };
  }

  /**
   * Generates or ensures that the 36 structured weekly recurring routes (Senin-Sabtu)
   * are initialized in the logistics database for a given week with intelligent
   * Outbound Priority & 24-Hour Minimum Gap Enforcement.
   */
  public static initializeWeeklySchedules(
    options: {
      weekOffset?: number; // 0 = current week, 1 = next week, etc.
      startDate?: Date; // Custom Monday start date
      targetMonthName?: string;
      clearExistingForPeriod?: boolean;
    } = {}
  ): { addedCount: number; schedules: Schedule[]; outboundCount: number; localCount: number } {
    const result = ScheduleInitializerService.runSmartFill({
      weekOffset: options.weekOffset,
      startDate: options.startDate,
      mode: 'full_priority',
      overwriteExisting: options.clearExistingForPeriod,
      autoAssignFerryTicket: true,
      enforce24hGap: true
    });

    return {
      addedCount: result.addedCount,
      schedules: result.schedules,
      outboundCount: result.outboundCount,
      localCount: result.localCount
    };
  }

  /**
   * Re-balances existing active schedules to eliminate any consecutive Luar Kota
   * assignments (<24 hours gap) by rotating drivers with rested alternatives.
   */
  public static rebalanceExistingSchedulesWithGapRule(): {
    rebalancedCount: number;
    violationsResolved: number;
    schedules: Schedule[];
  } {
    const schedules = logisticsStore.getSchedules();
    const crews = logisticsStore.getCrews();
    const drivers = crews.filter(c => !c.role.includes('Helper') && c.role !== 'Kernet / Helper');

    if (drivers.length < 2 || schedules.length === 0) {
      return { rebalancedCount: 0, violationsResolved: 0, schedules };
    }

    // Sort schedules by departureDate
    const sorted = [...schedules].sort((a, b) => 
      new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
    );

    let violationsResolved = 0;
    let rebalancedCount = 0;

    // Track when each driver was last assigned to a Luar Kota trip (timestamp)
    const driverLastOutboundMap = new Map<string, number>();

    sorted.forEach((sched) => {
      const isOutbound = sched.isInterIsland || 
        (sched.store?.island && sched.store.island !== 'Jawa') ||
        (sched.notes && sched.notes.toLowerCase().includes('luar kota')) ||
        (sched.store?.city && ['denpasar', 'singaraja', 'negara', 'situbondo', 'bondowoso', 'jember'].some(c => sched.store!.city.toLowerCase().includes(c)));

      if (isOutbound && sched.crewId) {
        const depTime = new Date(sched.departureDate).getTime();
        const lastDep = driverLastOutboundMap.get(sched.crewId);

        // Check if conflict (< 24 hours)
        if (lastDep !== undefined && (depTime - lastDep) < 24 * 3600000) {
          // Find alternative driver who has NOT driven Luar Kota within 24 hours of this depTime
          const candidate = drivers.find(d => {
            if (d.id === sched.crewId) return false;
            const candLast = driverLastOutboundMap.get(d.id);
            if (candLast === undefined) return true;
            return Math.abs(depTime - candLast) >= 24 * 3600000;
          }) || drivers.find(d => d.id !== sched.crewId);

          if (candidate) {
            logisticsStore.updateSchedule(sched.id, {
              crewId: candidate.id,
              crew: candidate,
              notes: (sched.notes || '') + ' [Auto-Rebalanced: Jeda 24 Jam]'
            });
            driverLastOutboundMap.set(candidate.id, depTime);
            violationsResolved++;
            rebalancedCount++;
            return;
          }
        }

        driverLastOutboundMap.set(sched.crewId, depTime);
      }
    });

    if (violationsResolved > 0) {
      logisticsStore.logActivity(
        'Penyeimbangan Jeda 24 Jam Otomatis',
        'Audit & Resolusi Konflik',
        `Berhasil menyelesaikan ${violationsResolved} konflik jeda istirahat supir luar kota.`
      );
    }

    return {
      rebalancedCount,
      violationsResolved,
      schedules: logisticsStore.getSchedules()
    };
  }

  /**
   * Helper to check if the current active schedule list has initialized weekly routes
   */
  public static isWeeklyScheduleInitialized(): boolean {
    const schedules = logisticsStore.getSchedules();
    if (schedules && schedules.length > 5) {
      return true; // Already populated with real/synced schedules
    }
    try {
      if (localStorage.getItem('akk_weekly_schedule_initialized') === 'true') {
        return true;
      }
    } catch {}

    const hasInitialized = schedules.some(s => s.trackingNumber.startsWith('TRK-') && (
      s.notes?.includes('Rute Rutin') || 
      s.notes?.includes('Prioritas Luar Kota') ||
      s.trackingNumber.includes('SEN') ||
      s.trackingNumber.includes('SEL') ||
      s.trackingNumber.includes('RAB') ||
      s.trackingNumber.includes('KAM') ||
      s.trackingNumber.includes('JUM') ||
      s.trackingNumber.includes('SAB')
    ));

    if (hasInitialized) {
      try {
        localStorage.setItem('akk_weekly_schedule_initialized', 'true');
      } catch {}
    }

    return hasInitialized;
  }
}
