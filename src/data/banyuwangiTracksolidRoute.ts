import { TrackingPoint, RouteStop } from '../types';

// High-fidelity sequential GPS points strictly following the Banyuwangi - Rogojampi - Singojuruh - Genteng road network
// as seen in the official Tracksolid telematics console screenshot (Image 2)
export const BANYUWANGI_TRACKSOLID_POINTS: TrackingPoint[] = [
  // 1. Departure from Warehouse Flag 'F' (Klatak / Tirtopuro)
  { timestamp: '2026-09-30 07:40:24', latitude: -8.1750, longitude: 114.3685, speed: 0, engineStatus: 'RUNNING', locationName: 'Gudang Pusat Banyuwangi DC (Klatak)' },
  { timestamp: '2026-09-30 07:44:10', latitude: -8.1810, longitude: 114.3690, speed: 36, engineStatus: 'RUNNING', locationName: 'Jl. Gatot Subroto Klatak' },
  { timestamp: '2026-09-30 07:48:48', latitude: -8.1885, longitude: 114.3698, speed: 40, engineStatus: 'RUNNING', locationName: 'Sukowidi Utara' },
  { timestamp: '2026-09-30 07:52:15', latitude: -8.1982, longitude: 114.3685, speed: 38, engineStatus: 'RUNNING', locationName: 'Simpang Sukowidi' },
  
  // 2. Banyuwangi Kota Highway Corridor
  { timestamp: '2026-09-30 07:56:11', latitude: -8.2040, longitude: 114.3678, speed: 35, engineStatus: 'RUNNING', locationName: 'Jl. Basuki Rahmat' },
  { timestamp: '2026-09-30 08:02:40', latitude: -8.2105, longitude: 114.3670, speed: 30, engineStatus: 'RUNNING', locationName: 'Lateng (Banyuwangi Kota)' },
  { timestamp: '2026-09-30 08:08:12', latitude: -8.2160, longitude: 114.3662, speed: 28, engineStatus: 'RUNNING', locationName: 'Taman Blambangan' },
  { timestamp: '2026-09-30 08:14:20', latitude: -8.2220, longitude: 114.3650, speed: 32, engineStatus: 'RUNNING', locationName: 'Jl. PB Sudirman' },
  { timestamp: '2026-09-30 08:19:05', latitude: -8.2275, longitude: 114.3625, speed: 35, engineStatus: 'RUNNING', locationName: 'Simpang Lima Banyuwangi Kota' },
  { timestamp: '2026-09-30 08:24:30', latitude: -8.2340, longitude: 114.3595, speed: 42, engineStatus: 'RUNNING', locationName: 'Sobo' },
  { timestamp: '2026-09-30 08:29:45', latitude: -8.2420, longitude: 114.3540, speed: 45, engineStatus: 'RUNNING', locationName: 'Kebalenan' },
  { timestamp: '2026-09-30 08:35:10', latitude: -8.2490, longitude: 114.3495, speed: 48, engineStatus: 'RUNNING', locationName: 'Sumberejo' },
  
  // 3. Dadapan & Kabat
  { timestamp: '2026-09-30 08:41:20', latitude: -8.2580, longitude: 114.3425, speed: 52, engineStatus: 'RUNNING', locationName: 'Dadapan Utara' },
  { timestamp: '2026-09-30 08:48:33', latitude: -8.2660, longitude: 114.3355, speed: 54, engineStatus: 'RUNNING', locationName: 'Jl. Raya Jember - Banyuwangi' },
  { timestamp: '2026-09-30 08:55:00', latitude: -8.2750, longitude: 114.3290, speed: 50, engineStatus: 'RUNNING', locationName: 'Dadapan Selatan' },
  { timestamp: '2026-09-30 09:02:15', latitude: -8.2862, longitude: 114.3218, speed: 40, engineStatus: 'RUNNING', locationName: 'Kabat Pusat' },
  { timestamp: '2026-09-30 09:08:40', latitude: -8.2910, longitude: 114.3160, speed: 44, engineStatus: 'RUNNING', locationName: 'Kaotan' },
  
  // 4. Benelan Lor Loop & Rogojampi (clearly visible in Image 2)
  { timestamp: '2026-09-30 09:14:10', latitude: -8.2940, longitude: 114.3080, speed: 36, engineStatus: 'RUNNING', locationName: 'Simpang Benelan Lor' },
  { timestamp: '2026-09-30 09:18:25', latitude: -8.2880, longitude: 114.3020, speed: 30, engineStatus: 'RUNNING', locationName: 'Masuk Benelan Lor' },
  { timestamp: '2026-09-30 09:23:40', latitude: -8.2820, longitude: 114.2960, speed: 28, engineStatus: 'RUNNING', locationName: 'Krajan Benelan Lor' },
  { timestamp: '2026-09-30 09:26:40', latitude: -8.2710, longitude: 114.2880, speed: 0, engineStatus: 'IDLE', locationName: 'TK RAJA MAKMUR PLASTIK (Krajan)' },
  { timestamp: '2026-09-30 09:37:05', latitude: -8.2750, longitude: 114.2880, speed: 25, engineStatus: 'RUNNING', locationName: 'Benelan Lor Utara' },
  { timestamp: '2026-09-30 09:42:00', latitude: -8.2810, longitude: 114.2840, speed: 28, engineStatus: 'RUNNING', locationName: 'Jalan Lingkar Benelan' },
  { timestamp: '2026-09-30 09:47:00', latitude: -8.2890, longitude: 114.2880, speed: 32, engineStatus: 'RUNNING', locationName: 'Benelan Kidul' },
  { timestamp: '2026-09-30 09:52:15', latitude: -8.2960, longitude: 114.2930, speed: 35, engineStatus: 'RUNNING', locationName: 'Kebondalem' },
  { timestamp: '2026-09-30 09:58:30', latitude: -8.3032, longitude: 114.2982, speed: 28, engineStatus: 'RUNNING', locationName: 'Gitik Rogojampi' },
  { timestamp: '2026-09-30 10:05:10', latitude: -8.3075, longitude: 114.2975, speed: 0, engineStatus: 'IDLE', locationName: 'Pasar Rogojampi (TK SANTOSO)' },
  { timestamp: '2026-09-30 10:20:40', latitude: -8.3120, longitude: 114.2950, speed: 32, engineStatus: 'RUNNING', locationName: 'Prejengan' },
  
  // 5. Gladag & Parijatah (Blue Highway Corridor)
  { timestamp: '2026-09-30 10:26:20', latitude: -8.3160, longitude: 114.2890, speed: 45, engineStatus: 'RUNNING', locationName: 'Jl. Rogojampi - Genteng' },
  { timestamp: '2026-09-30 10:32:15', latitude: -8.3220, longitude: 114.2810, speed: 48, engineStatus: 'RUNNING', locationName: 'Lugjag / Pengantigan' },
  { timestamp: '2026-09-30 10:38:00', latitude: -8.3265, longitude: 114.2745, speed: 44, engineStatus: 'RUNNING', locationName: 'Gladag' },
  { timestamp: '2026-09-30 10:44:30', latitude: -8.3320, longitude: 114.2680, speed: 42, engineStatus: 'RUNNING', locationName: 'Aliyan' },
  { timestamp: '2026-09-30 10:50:45', latitude: -8.3375, longitude: 114.2615, speed: 0, engineStatus: 'IDLE', locationName: 'Parijatah Wetan (BP SYAIFUL BAHRI)' },
  { timestamp: '2026-09-30 11:05:00', latitude: -8.3410, longitude: 114.2540, speed: 38, engineStatus: 'RUNNING', locationName: 'Parijatah Kulon' },
  { timestamp: '2026-09-30 11:11:12', latitude: -8.3460, longitude: 114.2460, speed: 35, engineStatus: 'RUNNING', locationName: 'Sumbersari Timur' },
  { timestamp: '2026-09-30 11:16:30', latitude: -8.3510, longitude: 114.2380, speed: 25, engineStatus: 'RUNNING', locationName: 'Sumbersari (Posisi Navigasi Terkini)' },
  
  // 6. Singojuruh & Cantuk to Kembiritan (Cyan Distribution Segment)
  { timestamp: '2026-09-30 11:22:15', latitude: -8.3350, longitude: 114.2440, speed: 38, engineStatus: 'RUNNING', locationName: 'Percabangan Singojuruh' },
  { timestamp: '2026-09-30 11:28:00', latitude: -8.3201, longitude: 114.2405, speed: 30, engineStatus: 'RUNNING', locationName: 'Singojuruh Kota' },
  { timestamp: '2026-09-30 11:34:40', latitude: -8.3240, longitude: 114.2330, speed: 34, engineStatus: 'RUNNING', locationName: 'Kemiri' },
  { timestamp: '2026-09-30 11:40:15', latitude: -8.3280, longitude: 114.2250, speed: 36, engineStatus: 'RUNNING', locationName: 'Bedewang' },
  { timestamp: '2026-09-30 11:46:30', latitude: -8.3320, longitude: 114.2180, speed: 38, engineStatus: 'RUNNING', locationName: 'Cantuk' },
  { timestamp: '2026-09-30 11:52:45', latitude: -8.3380, longitude: 114.2100, speed: 40, engineStatus: 'RUNNING', locationName: 'Temuasri' },
  { timestamp: '2026-09-30 11:59:00', latitude: -8.3480, longitude: 114.1950, speed: 42, engineStatus: 'RUNNING', locationName: 'Temurejo Wetan' },
  { timestamp: '2026-09-30 12:06:15', latitude: -8.3582, longitude: 114.1820, speed: 0, engineStatus: 'IDLE', locationName: 'Kembiritan (TK BERKAH MULIA)' },
  { timestamp: '2026-09-30 12:22:00', latitude: -8.3610, longitude: 114.1720, speed: 35, engineStatus: 'RUNNING', locationName: 'Pandansari' },
  { timestamp: '2026-09-30 12:28:30', latitude: -8.3620, longitude: 114.1650, speed: 30, engineStatus: 'RUNNING', locationName: 'Cangakan (TK MAKMUR GNTG)' },
  
  // 7. Genteng Outlet Network (Cyan Branches in Image 2)
  { timestamp: '2026-09-30 12:35:15', latitude: -8.3645, longitude: 114.1560, speed: 26, engineStatus: 'RUNNING', locationName: 'Genteng Timur' },
  { timestamp: '2026-09-30 12:41:00', latitude: -8.3650, longitude: 114.1530, speed: 0, engineStatus: 'IDLE', locationName: 'Pasar Daerah Genteng 1 (TK USAHA JAYA)' },
  { timestamp: '2026-09-30 13:05:20', latitude: -8.3625, longitude: 114.1515, speed: 20, engineStatus: 'RUNNING', locationName: 'Sawahan / Genteng Kulon' },
  { timestamp: '2026-09-30 13:12:00', latitude: -8.3640, longitude: 114.1590, speed: 0, engineStatus: 'IDLE', locationName: 'Pasar Hewan Genteng (TK HOLLY)' },
  { timestamp: '2026-09-30 13:30:10', latitude: -8.3680, longitude: 114.1420, speed: 25, engineStatus: 'RUNNING', locationName: 'Jalen Kilen (TK AZA)' },
  { timestamp: '2026-09-30 13:42:40', latitude: -8.3720, longitude: 114.1380, speed: 0, engineStatus: 'IDLE', locationName: 'Resomulyo (TK RAME GENTENG)' },
  
  // 8. Gambiran & Tegalsari (Southward Extension in Image 2)
  { timestamp: '2026-09-30 14:02:15', latitude: -8.3820, longitude: 114.1375, speed: 40, engineStatus: 'RUNNING', locationName: 'Gambiran' },
  { timestamp: '2026-09-30 14:15:30', latitude: -8.3950, longitude: 114.1365, speed: 38, engineStatus: 'RUNNING', locationName: 'Tegalsari' },
  { timestamp: '2026-09-30 14:28:00', latitude: -8.4120, longitude: 114.1350, speed: 0, engineStatus: 'IDLE', locationName: 'Andongsari (TK WIJAYA FROZEN)' },
  
  // 9. Northbound Return Trip to Banyuwangi DC (Image 2 Return Highway)
  { timestamp: '2026-09-30 14:55:00', latitude: -8.3950, longitude: 114.1365, speed: 46, engineStatus: 'RUNNING', locationName: 'Kembali - Tegalsari' },
  { timestamp: '2026-09-30 15:08:00', latitude: -8.3650, longitude: 114.1530, speed: 42, engineStatus: 'RUNNING', locationName: 'Kembali - Genteng' },
  { timestamp: '2026-09-30 15:20:00', latitude: -8.3582, longitude: 114.1820, speed: 45, engineStatus: 'RUNNING', locationName: 'Kembali - Kembiritan' },
  { timestamp: '2026-09-30 15:32:00', latitude: -8.3201, longitude: 114.2405, speed: 48, engineStatus: 'RUNNING', locationName: 'Kembali - Singojuruh' },
  { timestamp: '2026-09-30 15:45:00', latitude: -8.3032, longitude: 114.2982, speed: 50, engineStatus: 'RUNNING', locationName: 'Kembali - Rogojampi' },
  { timestamp: '2026-09-30 15:58:00', latitude: -8.2862, longitude: 114.3218, speed: 52, engineStatus: 'RUNNING', locationName: 'Kembali - Kabat' },
  { timestamp: '2026-09-30 16:10:00', latitude: -8.2420, longitude: 114.3540, speed: 48, engineStatus: 'RUNNING', locationName: 'Kembali - Kebalenan' },
  { timestamp: '2026-09-30 16:22:00', latitude: -8.2105, longitude: 114.3670, speed: 42, engineStatus: 'RUNNING', locationName: 'Kembali - Banyuwangi Kota' },
  { timestamp: '2026-09-30 16:32:00', latitude: -8.1982, longitude: 114.3685, speed: 38, engineStatus: 'RUNNING', locationName: 'Kembali - Sukowidi' },
  { timestamp: '2026-09-30 16:45:00', latitude: -8.1750, longitude: 114.3685, speed: 0, engineStatus: 'STOP', locationName: 'Gudang Banyuwangi DC (Klatak)' }
];

export const BANYUWANGI_TRACKSOLID_STOPS: RouteStop[] = [
  { stopNumber: 1, startTime: '2026-09-30 09:26:40', endTime: '2026-09-30 09:37:05', durationMinutes: 11, latitude: -8.2710, longitude: 114.2880, locationName: 'Krajan, Benelan Lor (TK RAJA MAKMUR)', reason: 'Retail Unloading' },
  { stopNumber: 2, startTime: '2026-09-30 10:05:10', endTime: '2026-09-30 10:20:40', durationMinutes: 15, latitude: -8.3075, longitude: 114.2975, locationName: 'Pasar Rogojampi (TK SANTOSO)', reason: 'Retail Unloading' },
  { stopNumber: 3, startTime: '2026-09-30 10:50:45', endTime: '2026-09-30 11:05:00', durationMinutes: 15, latitude: -8.3375, longitude: 114.2615, locationName: 'Parijatah Wetan (BP SYAIFUL BAHRI)', reason: 'Retail Unloading' },
  { stopNumber: 4, startTime: '2026-09-30 12:06:15', endTime: '2026-09-30 12:22:00', durationMinutes: 16, latitude: -8.3582, longitude: 114.1820, locationName: 'Kembiritan (TK BERKAH MULIA)', reason: 'Retail Unloading' },
  { stopNumber: 5, startTime: '2026-09-30 12:41:00', endTime: '2026-09-30 13:05:20', durationMinutes: 24, latitude: -8.3650, longitude: 114.1530, locationName: 'Pasar Daerah Genteng 1 (TK USAHA JAYA)', reason: 'Retail Unloading' },
  { stopNumber: 6, startTime: '2026-09-30 13:12:00', endTime: '2026-09-30 13:30:10', durationMinutes: 18, latitude: -8.3640, longitude: 114.1590, locationName: 'Pasar Hewan Genteng (TK HOLLY)', reason: 'Retail Unloading' },
  { stopNumber: 7, startTime: '2026-09-30 13:42:40', endTime: '2026-09-30 14:02:15', durationMinutes: 20, latitude: -8.3720, longitude: 114.1380, locationName: 'Resomulyo (TK RAME GENTENG)', reason: 'Retail Unloading' },
  { stopNumber: 8, startTime: '2026-09-30 14:28:00', endTime: '2026-09-30 14:55:00', durationMinutes: 27, latitude: -8.4120, longitude: 114.1350, locationName: 'Andongsari (TK WIJAYA FROZEN)', reason: 'Retail Unloading' }
];
