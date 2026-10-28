export type UserRole = 'super_admin' | 'dispatcher' | 'spv_logistik' | 'operasional' | 'pengiriman' | 'security' | 'driver' | 'crew_helper' | 'sales_admin' | 'purchasing_admin' | 'hr_admin' | 'finance_tax_admin' | 'warehouse_admin' | 'marketing_online' | 'marketing_offline' | 'unassigned';
export type UserApprovalStatus = 'approved' | 'pending' | 'rejected' | 'inactive';

export type FleetStatus = 'available' | 'on-duty' | 'maintenance';
export type CrewStatus = 'available' | 'on-duty' | 'off';
export type ShipmentStatus = 'scheduled' | 'picked_up' | 'in_transit' | 'delivered' | 'delayed';
export type VehicleType = 'Pick Up Box' | 'Engkel STD' | 'Engkel Long' | 'Double STD';

export interface UserPermissions {
  modules: Record<string, {
    enabled: boolean;
    subMenus: Record<string, 'read_only' | 'full_access' | 'none'>;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  department: string;
  status: UserApprovalStatus;
  createdAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
  permissions?: UserPermissions;
  password?: string;
}

export interface Fleet {
  id: string;
  plateNumber: string;
  vehicleType: VehicleType;
  status: FleetStatus;
  initialCode?: string; // Inisial Mobil (e.g. WB-01, DS-1, N08)
  driverId?: string;
  gpsImei?: string;
  lastMaintenance?: string;
  year?: number;
  brand?: string;
  engineCc?: string;
  boxCapacityM3?: number; // Kubikasi Box Luar (Gross m³)
  boxDimensions?: string; // Dimensi Box Luar P x L x T (Meter)
  boxInnerMultiplierPercent?: number; // Persentase Pengali Ukuran Dalam (contoh: 90% karena ketebalan dinding boks)
  boxInnerCapacityM3?: number; // Hasil Kubikasi Efektif Dalam (Net m³ = Gross * Multiplier %)
  boxInnerDimensions?: string; // Dimensi Box Dalam (P x L x T Bersih)
  kirDocUrl?: string; // Bukti File / Foto Dokumen KIR Dishub
  kirDocFileName?: string; // Nama File Dokumen KIR
  kirDocUploadedAt?: string; // Tanggal Upload File Bukti KIR
  taxDueDate?: string; // Tanggal Jatuh Tempo Pajak (Tahunan)
  stnkExpiryDate?: string; // Masa Berlaku STNK / Plat (5 Tahunan)
  kirExpiryDate?: string; // Masa Berlaku Uji KIR Dishub (6 Bulanan / Berkala)
  // Optional backwards compatibility fields
  tonnageCapacity?: number;
  currentTonnage?: number;
  fuelLevelPercent?: number;
  odometerKm?: number;
}

export type TaxKirType = 'tax' | 'stnk' | 'kir';
export type TaxKirUrgency = 'expired' | 'critical' | 'warning' | 'safe';

export interface TaxKirReminderItem {
  id: string; // `${fleetId}-${type}`
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: VehicleType;
  brand?: string;
  type: TaxKirType;
  typeLabel: string; // 'Pajak Tahunan', 'STNK / Plat (5 Thn)', 'Uji KIR Dishub'
  dueDate: string;
  daysRemaining: number;
  urgency: TaxKirUrgency;
  statusLabel: string;
  badgeColor: string;
  cycleIntervalLabel: string; // '1 Tahun', '5 Tahun', '6 Bulan'
}

export interface Crew {
  id: string;
  name: string;
  phone: string;
  role: 'Driver Utama' | 'Driver Cadangan' | 'Kernet / Helper';
  licenseNumber: string;
  licenseType: 'SIM B2 Umum' | 'SIM B1 Umum' | 'SIM A' | '-' | string;
  status: CrewStatus;
  currentFleetId?: string;
  tripsCompleted: number;
  rating: number; // e.g. 4.8 / 5
  certifications?: string[];
  routeExperience?: string[];
  allowOutofTown?: boolean; // false = Banyuwangi local only, unless urgent override
  forbiddenPairCrewIds?: string[]; // IDs of crew members they cannot be paired with
}

export interface RetailStore {
  id: string;
  nomor?: number | string;
  storeCode: string;
  storeName: string;
  kecamatan?: string;
  kabupaten?: string;
  island: 'Jawa' | 'Sumatera' | 'Bali & Nusa Tenggara' | 'Kalimantan' | 'Sulawesi' | 'Papua & Maluku';
  province: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPerson: string;
  phone: string;
  deliveryWindow: string; // e.g. "08:00 - 17:00"
  storeCategory: 'Hypermarket' | 'Supermarket' | 'Distribution Hub' | 'Minimarket Cluster' | 'Toko Kelontong / Minimarket' | 'Horeca & Corporate' | 'Mitra Distributor' | 'Needs Correction';
  priorityLevel?: 'High' | 'Medium' | 'Low';
}

export interface Schedule {
  id: string;
  trackingNumber: string;
  originName: string;
  originCoords: [number, number];
  storeId: string;
  store?: RetailStore;
  fleetId: string;
  fleet?: Fleet;
  crewId: string;
  crewHelperId?: string; // Kernet / Helper 1
  crewHelper2Id?: string; // Kernet / Helper 2 (Tambahan)
  crew?: Crew;
  crewHelper?: Crew;
  crewHelper2?: Crew;
  status: ShipmentStatus;
  departureDate: string;
  estimatedArrival: string;
  actualArrival?: string;
  cargoDescription: string;
  cargoWeightTon: number;
  isInterIsland: boolean;
  ferryBookingCode?: string;
  transitPort?: string;
  notes?: string;
  createdAt: string;
  areaApprovalStatus?: 'approved' | 'pending' | 'not_required';
  areaTripCount?: number;
  areaName?: string;
  isUrgentOverride?: boolean; // Override flag for local-only crew assigned to out-of-town routes
  isManuallyEdited?: boolean; // Flag to indicate user made manual edits, preventing automatic overwrite
  podPhotoUrl?: string; // Data URL or URL of the captured photo of delivered goods
  podPhotoTimestamp?: string;
  podReceiverName?: string;
  podConditionNote?: string;
  transferRequest?: {
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
    requestedByDriverId: string;
    requestedByDriverName: string;
    reason: string;
    transferType: string;
    notes?: string;
    gpsPhotoUrl?: string;
    constraintNote?: string;
  };
  leaveRequest?: {
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
    person: 'driver' | 'helper' | 'keduanya';
    personName: string;
    leaveType: string;
    notes?: string;
  };
}

export interface CrewDeliveryHistory {
  id: string;
  crewId: string;
  crewName: string;
  scheduleId: string;
  trackingNumber: string;
  storeName: string;
  area: string; // e.g. "Sumatera (Lampung)", "Jawa Barat (Bandung)", "Jawa Timur (Surabaya)", "Bali"
  areaName?: string;
  city: string;
  island: string;
  vehiclePlate: string;
  plateNumber?: string;
  initialCode?: string; // Inisial Mobil (e.g. DS1, DS3, NS2, NL1, N20)
  vehicleType: VehicleType;
  crewRole?: string;
  cargoWeightTon: number;
  cargoDescription: string;
  completionDate: string;
  deliveryDate?: string;
  status: 'delivered' | 'returned' | 'partial';
  onTimeStatus: 'Tepat Waktu' | 'Terlambat' | 'Lebih Cepat';
  delayReason?: string;
  ratingReceived: number; // 1-5
  notes?: string;
  podPhotoUrl?: string; // Proof of delivery photo
  podReceiverName?: string;
  requiresAreaApproval?: boolean;
  areaTripSequenceNumber?: number; // Pengiriman ke-X di area yang sama oleh kru ini
  totalAreaTrips?: number; // Total frekuensi pengiriman ke area ini secara keseluruhan
  areaApprovalStatus?: 'approved' | 'pending' | 'not_required';
  approvedBy?: string;
  approvedAt?: string;
}

export interface AreaDeliveryStat {
  area: string;
  island: string;
  totalTrips: number;
  lastTripDate: string;
  requiresApproval: boolean;
}

export interface AreaApprovalRequest {
  id: string;
  crewId: string;
  crewName: string;
  scheduleId?: string;
  targetArea: string;
  currentTripsInArea: number;
  thresholdLimit: number;
  storeName: string;
  plateNumber: string;
  departureDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reasonPolicy: string;
  notes?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface TrackingPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  engineStatus: 'RUNNING' | 'STOP' | 'IDLE';
  locationName?: string;
  odometerKm?: number;
}

export interface RouteStop {
  stopNumber: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  locationName: string;
  reason: 'Port Transit / Ferry Queue' | 'Driver Rest / Meals' | 'Traffic Congestion' | 'Retail Unloading' | 'Toll Gate Inspection' | 'Berhenti Lama Non-Mitra';
  isCustomerStore?: boolean;
  isLongNonCustomerStop?: boolean;
  matchedStoreName?: string;
  matchedStoreRegion?: 'dalam_kota' | 'luar_kota' | 'luar_pulau';
  fleetPlate?: string;
}

export interface TracksolidTripLeg {
  legNumber: number;
  dateGroup: string;
  startTime: string;
  startLocation: string;
  endTime: string;
  endLocation: string;
  mileageKm: number;
  travelTime: string;
  travelMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  fuelPer100Km: number;
  totalFuelLiters: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  // Computed stop before/after this leg
  stopBeforeMinutes?: number;
  stopBeforeStart?: string;
  stopBeforeEnd?: string;
  matchedStoreId?: string;
  matchedStoreName?: string;
  matchedStoreKecamatan?: string;
  matchedStoreKabupaten?: string;
}

export interface TracksolidDateSubtotal {
  dateGroup: string;
  tripCount: number;
  totalMileageKm: number;
  travelTime: string;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  fuelPer100Km: number;
  totalFuelLiters: number;
}

export interface TracksolidBottomSummary {
  trips: number;
  totalMileageKm: number;
  duration: string;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  totalFuelConsumptionLiters: number;
  reportTitle?: string;
}

export interface TrackingEvaluation {
  fileName: string;
  scheduleId?: string;
  fleetId?: string;
  plateNumber?: string;
  initialCode?: string;
  driverName?: string;
  helperName?: string;
  gpsPlatform?: 'tracksolid' | 'wanway';
  uploadedMonth?: string;
  uploadedYear?: string;
  totalPoints: number;
  totalDistanceKm: number;
  durationHours: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  totalIdleMinutes: number;
  routeDeviationKm: number;
  isWithinRouteTolerance: boolean;
  onTimeStatus: 'On-Time' | 'Early' | 'Delayed';
  delayMinutes: number;
  stops: RouteStop[];
  points: TrackingPoint[];
  tripLegs?: TracksolidTripLeg[];
  dateSubtotals?: TracksolidDateSubtotal[];
  bottomSummary?: TracksolidBottomSummary;
}

export interface TrackingLog {
  id: string;
  schedule_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number; // in km/h
  engine_status: 'RUNNING' | 'STOP' | 'IDLE';
  location_name?: string;
  created_at?: string;
}

export interface FleetPerformanceMetric {
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: string;
  brand?: string;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  idleTimeMinutes: number;
  runningTimeMinutes: number;
  stopTimeMinutes: number;
  totalOperationMinutes: number;
  idlePercentage: number;
  totalSchedules: number;
  completedDeliveries: number;
  inTransitDeliveries: number;
  delayedDeliveries: number;
  onTimeCount: number;
  onTimePercentage: number;
  avgDelayMinutes: number;
  cargoWeightTotalTon: number;
  fuelUsedEstimatedLiters: number;
  fuelEfficiencyKmPerLiter: number;
}

export interface CrewPerformanceMetric {
  crewId: string;
  name: string;
  role: string;
  phone: string;
  rating: number;
  tripsCompletedTotal: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  idleTimeMinutes: number;
  runningTimeMinutes: number;
  idlePercentage: number;
  totalSchedules: number;
  completedDeliveries: number;
  inTransitDeliveries: number;
  delayedDeliveries: number;
  onTimeCount: number;
  onTimePercentage: number;
  avgDelayMinutes: number;
  punctualityScore: number;
  topDestinationArea?: string;
}

export interface OverallAnalyticsSummary {
  totalDistanceKm: number;
  avgFleetSpeedKmh: number;
  overallIdlePercentage: number;
  totalCompletedDeliveries: number;
  totalScheduledDeliveries: number;
  overallOnTimePercentage: number;
  totalCargoTon: number;
  totalTrackingPoints: number;
  activeFleetsCount: number;
  activeCrewsCount: number;
  averageDeliveryDurationHours: number;
}

export interface TracksolidDevice {
  imei: string;
  vehiclePlate: string;
  vehicleName?: string;
  driverName: string;
  model: string;
  status: 'Online' | 'Offline' | 'Sleeping';
  accStatus: 'ON' | 'OFF';
  currentSpeedKmh: number;
  batteryPercent: number;
  signalGsm: number; // 1-5
  satellites: number;
  lastUpdate: string;
  latitude: number;
  longitude: number;
  address: string;
  stopDuration?: string;
  todayMileageKm?: number;
  lastFix?: string;
  coordinatesDms?: string;
  voltage?: string;
}

// ==========================================
// SALES ADMIN (ADMIN PENJUALAN) DATA SCHEMAS
// ==========================================

export interface SalesOrder {
  id: string;
  poNumber: string;
  clientName: string;
  orderDate: string;
  productType: 'Karton Box Corrugated (A1)' | 'Die-Cut Box E-Commerce' | 'Sheet Corrugated Board' | 'Offset Printing Packaging' | 'Heavy Duty Box';
  quantityPcs: number;
  totalAmount: number; // IDR
  paymentStatus: 'Lunas' | 'TOP 30 Hari' | 'TOP 14 Hari' | 'Menunggu DP';
  orderStatus: 'Draft' | 'PO Masuk' | 'SPK Produksi' | 'Siap Muat' | 'Terkirim';
  deliveryDestination: string;
  adminPic: string;
}

export interface AdminActivity {
  id: string;
  adminName: string;
  actionType: 'Input PO' | 'Follow Up Pembayaran' | 'Terbitkan DO' | 'Koordinasi Sampel' | 'Approval Diskon' | 'Update Resi Logistik';
  clientName: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'pending';
  notes: string;
  durationMinutes: number;
}

export interface AdminSchedule {
  id: string;
  adminName: string;
  date: string;
  timeSlot: string;
  taskTitle: string;
  category: 'Order Processing' | 'Client Meeting / Visit' | 'Stock & Loading Coordination' | 'Invoice & AR Follow-up';
  priority: 'high' | 'medium' | 'low';
  status: 'completed' | 'scheduled' | 'rescheduled';
  locationOrChannel: string;
}

export interface LoadingDurationRecord {
  id: string;
  doNumber: string;
  clientName: string;
  fleetPlate: string;
  adminPic: string;
  cargoType: string;
  quantityBoxes: number;
  startQueueTime: string;
  startLoadingTime: string;
  finishLoadingTime: string;
  totalDurationMinutes: number;
  targetSlaMinutes: number;
  status: 'on_time' | 'delayed' | 'fast';
  delayReason?: string;
}

export interface SkillCategoryScore {
  skillName: string;
  level: 1 | 2 | 3 | 4 | 5; // 1: Beginner, 2: Developing, 3: Competent, 4: Advanced, 5: Master
  category: 'Teknis Kemasan' | 'Sistem & ERP' | 'Pelayanan Klien' | 'Logistik & Regulasi';
  certified: boolean;
}

export interface AdminSkillProfile {
  id: string;
  adminName: string;
  avatarUrl?: string;
  roleTitle: string;
  experienceYears: number;
  overallScore: number; // 0 - 100
  recentTraining: string;
  skills: SkillCategoryScore[];
}

export interface JobdeskConfig {
  id: string;
  roleName: string;
  assignedAdminNames: string[];
  territory: string;
  dailyTasks: string[];
  weeklyTasks: string[];
  kpiTargets: { name: string; target: string; weight: number }[];
  approvalLimits: string;
  slaCommitment: string;
}

export interface SystemActivity {
  id: string;
  timestamp: string;
  userFullName: string;
  department: string;
  action: string;
  target: string;
  details: string;
}

export type SparePartCategory = 'oli' | 'ban' | 'aki' | 'filter' | 'rem' | 'lainnya';

export interface SparePart {
  id: string;
  name: string;
  category: SparePartCategory;
  partNumber: string;
  unit: string;
  stock: number;
  minStock: number;
  costPerUnit: number;
  compatibleVehicles: string;
  storageLocation: string;
  lastRestockDate: string;
  notes?: string;
}

export interface SparePartUsage {
  id: string;
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  partId: string;
  partName: string;
  category: SparePartCategory;
  quantity: number;
  unit: string;
  replacementDate: string; // YYYY-MM-DD
  odometerKm: number; // KM saat penggantian
  nextReplacementKm?: number; // Target KM penggantian berikutnya
  nextReplacementDate?: string; // Target tanggal penggantian berikutnya
  mechanicOrWorkshop: string; // Nama bengkel / teknisi
  totalCost: number;
  notes?: string;
  performedBy: string;
}

export type FuelType = 'BioSolar' | 'Dexlite' | 'Pertamina Dex' | 'Pertalite' | 'Pertamax';
export type EfficiencyStatus = 'Sangat Efisien' | 'Efisien / Normal' | 'Boros' | 'Kritis / Potensi Anomali';

export interface FuelLog {
  id: string;
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: VehicleType;
  driverId?: string;
  driverName: string;
  date: string; // YYYY-MM-DD
  fuelType: FuelType;
  liters: number;
  costPerLiter: number;
  totalCost: number;
  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  ratioKmPerLiter: number; // distanceKm / liters
  costPerKm: number; // totalCost / distanceKm
  targetRatio: number; // KM per liter standar sesuai jenis kendaraan
  literPerKm?: number; // Konsumsi liter per kilometer (liters / distanceKm)
  literPer100Km?: number; // Konsumsi liter per 100 kilometer
  efficiencyStatus: EfficiencyStatus;
  gasStation: string; // Nama / Lokasi SPBU
  receiptNumber?: string; // Nomor struk / nota SPBU
  routeTrip?: string; // Rute perjalanan pengiriman
  cargoLoadTon?: number; // Beban muatan saat perjalanan
  notes?: string;
  createdAt: string;
  verifiedBy?: string;
}

export interface FleetFuelSummary {
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: VehicleType;
  totalLogs: number;
  totalLiters: number;
  totalCost: number;
  totalDistanceKm: number;
  avgKmPerLiter: number; // KM per Liter
  avgLiterPerKm: number; // Liter per KM (Liters / DistanceKm)
  avgLiterPer100Km: number; // Liter per 100 KM
  targetRatio: number; // Target KM per Liter
  targetLiterPerKm: number; // Target Liter per KM (1 / targetRatio)
  targetLiterPer100Km: number; // Target Liter per 100 KM
  avgCostPerKm?: number; // Biaya per KM
  efficiencyScore: number; // Persentase terhadap target
  status: EfficiencyStatus;
  anomaliesCount: number;
}

export interface DriverFuelScore {
  driverId: string;
  driverName: string;
  totalTrips: number;
  totalDistanceKm: number;
  totalLiters: number;
  avgKmPerLiter: number;
  ecoDrivingScore: number; // 0 - 100
  ranking: number;
  badge: 'Master Eco-Driver' | 'Driver Efisien' | 'Perlu Pembinaan';
  recommendation: string;
}

export interface AttendanceRecord {
  id: string;
  crewId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'sick' | 'leave';
  reason?: string;
}

// ==========================================
// DRIVER SHIFT CHECK-IN (PRESENSI SHIFT SUPIR)
// ==========================================
export type ShiftVerificationMethod = 'biometric' | 'pin';
export type DriverShiftStatus = 'checked_in' | 'on_duty' | 'break' | 'checked_out';

export interface DriverShiftCheckin {
  id: string; // e.g. 'SHIFT-20261008-001'
  driverId: string;
  driverName: string;
  fleetId?: string;
  plateNumber?: string;
  vehicleType?: string;
  date: string; // YYYY-MM-DD
  checkinTime: string; // ISO string
  checkinTimeFormatted: string; // e.g. "07:15 WIB"
  checkoutTime?: string;
  checkoutTimeFormatted?: string;
  verificationMethod: ShiftVerificationMethod; // 'biometric' | 'pin'
  biometricType?: 'fingerprint' | 'face_id';
  locationName: string; // e.g. 'DC PT. Anugrah Kemasan Kreatif - Banyuwangi'
  latitude?: number;
  longitude?: number;
  status: DriverShiftStatus;
  shiftName: string; // 'Shift Pagi (06:00 - 15:00 WIB)' | 'Shift Siang' | 'Shift Khusus Antar-Kota'
  odometerStartKm?: number;
  notes?: string;
  synced: boolean;
  createdAt: string;
}

export interface SwapShiftRequest {
  id: string;
  requesterCrewId: string;
  requesterCrewName?: string;
  targetCrewId: string;
  targetCrewName?: string;
  scheduleId?: string;
  shiftDate?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

export type TirePosition = 'Depan Kiri' | 'Depan Kanan' | 'Belakang Kiri Luar' | 'Belakang Kiri Dalam' | 'Belakang Kanan Luar' | 'Belakang Kanan Dalam' | 'Serep';
export type TireConditionStatus = 'Optimal' | 'Waspada' | 'Kritis';

export interface ImageRecord {
  id: string;
  entityId: string;
  entityType: 'schedule' | 'fleet' | 'fuel' | 'crew' | 'manifest' | 'general';
  imageUrl: string;
  category: 'proof_of_delivery' | 'manifest' | 'fuel_receipt' | 'vehicle_condition' | 'driver_photo' | 'damage_report' | 'other';
  title?: string;
  notes?: string;
  uploadedBy?: string;
  timestamp: string;
  syncedToCloud?: boolean;
  fileSizeKb?: number;
}

export interface AutoSyncStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncedCount: number;
  pendingQueue: number;
  lastError?: string | null;
  lastSyncedEntity?: string | null;
}

export interface FleetTireWearPrediction {
  fleetId: string;
  plateNumber: string;
  initialCode?: string;
  vehicleType: VehicleType;
  brand: string;
  currentOdometerKm: number;
  todayMileageKm: number;
  trackedImei?: string;
  isGpsOnline: boolean;
  tireBrandModel: string;
  tireSize: string;
  initialTreadDepthMm: number; // e.g. 14.0 mm for commercial truck tires
  currentTreadDepthMm: number; // e.g. 6.8 mm
  minTreadDepthLegalMm: number; // 1.6 mm or safety 3.0 mm
  installedAtKm: number; // Kilometer when tire was installed
  accumulatedKm: number; // Total km driven on this tire set
  maxLifespanKm: number; // Standard lifespan (e.g. 50,000 - 60,000 km)
  remainingKm: number; // Remaining usable km
  wearPercentage: number; // 0% (new) to 100% (completely worn)
  healthScore: number; // 100% down to 0%
  dailyWearRateMm: number; // mm wear per day based on tracksolid mileage
  estimatedDaysRemaining: number; // Estimated days until replacement needed
  projectedReplacementDate: string; // YYYY-MM-DD
  status: TireConditionStatus;
  statusLabel: string;
  recommendation: string;
  rotationDueKm: number; // Next tire rotation mileage
  isRotationNeeded: boolean;
  pressurePsi: number; // Sensor / inspection PSI
  recommendedPressurePsi: number;
}

export type ScannedDocumentType = 'delivery_slip' | 'inspection_form' | 'service_order' | 'fuel_receipt' | 'other';

export interface ScannedDocumentLog {
  id: string; // e.g. 'DOC-SCAN-1728392100'
  documentType: ScannedDocumentType;
  documentTypeLabel: string; // 'Surat Jalan (Delivery Slip)', 'Formulir Inspeksi Armada', etc.
  documentNumber: string; // No. Surat Jalan / No. Form
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO String
  capturedBy: string; // Petugas / User
  vehiclePlate?: string; // Plat armada
  driverName?: string; // Nama pengemudi / checker
  destinationOrStore?: string; // Outlet / Lokasi tujuan
  status: 'verified' | 'pending_review' | 'flagged';
  cargoOrItemsSummary?: string; // Deskripsi muatan atau poin checklist
  quantityOrWeight?: string; // e.g. "350 Box (4.2 Ton)"
  inspectionScore?: string; // e.g. "Lulus (18/18)"
  notes?: string; // Catatan temuan / kendala
  signaturesDetected?: boolean; // Tanda tangan terdeteksi
  rawExtractedText: string; // Teks lengkap untuk pencarian cepat
  confidenceScore: number; // 0.0 - 1.0
  photoDataUrl: string; // Foto dokumen (Base64)
  source: 'camera' | 'upload';
}

// ==========================================
// DRIVER VEHICLE CHECKLIST (INSPEKSI ARMADA)
// ==========================================
export type ChecklistItemCategory = 'mesin_fluida' | 'rem_roda' | 'lampu_listrik' | 'fisik_dokumen' | 'darurat_k3';
export type ChecklistItemStatus = 'ok' | 'issue' | 'na';
export type OverallChecklistStatus = 'passed' | 'warning' | 'failed';

export interface VehicleChecklistItem {
  id: string;
  category: ChecklistItemCategory;
  categoryLabel: string;
  name: string;
  description: string;
  status: ChecklistItemStatus;
  note?: string;
  photoUrl?: string;
}

export interface DriverVehicleChecklist {
  id: string;
  driverId: string;
  driverName: string;
  fleetId: string;
  plateNumber: string;
  vehicleType: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  odometerKm: number;
  fuelLevelPercent: number;
  inspectionType: 'pre_trip' | 'post_trip';
  overallStatus: OverallChecklistStatus;
  passedCount: number;
  issueCount: number;
  items: VehicleChecklistItem[];
  notes?: string;
  photoEvidenceUrl?: string;
  driverSignature?: string; // Tanda tangan digital
  checkerName?: string; // Nama checker/supervisor yang memverifikasi
  checkerSigned?: boolean;
  synced: boolean;
  createdAt: string;
}

// ========================================================
// SURAT JALAN KELUAR (OUTBOUND DELIVERY WAYBILL / SJ KELUAR)
// ========================================================
export type OutboundWaybillStatus = 'draft' | 'loading' | 'sealed' | 'checker_verified' | 'gate_out' | 'in_transit' | 'delivered';

export interface OutboundWaybillCargoItem {
  id: string;
  itemCode: string;
  description: string;
  boxDimensions?: string; // e.g. "40 x 30 x 25 cm"
  quantity: number;
  unit: string; // 'Koli', 'Box', 'Bundle'
  weightKg: number;
  notes?: string;
}

export interface OutboundWaybill {
  id: string;
  waybillNumber: string; // e.g. "SJ-OUT/AKK/2026/10/08-0142"
  scheduleId: string;
  trackingNumber: string;
  poNumber?: string;
  date: string; // YYYY-MM-DD
  gateOutTime?: string; // Jam keluar gerbang DC
  estimatedArrival?: string;
  originWarehouse: {
    name: string;
    address: string;
    phone: string;
    gateNumber?: string;
  };
  destination: {
    storeName: string;
    areaName: string;
    city: string;
    province: string;
    address: string;
    contactPerson: string;
    phone: string;
  };
  fleet: {
    id: string;
    plateNumber: string;
    vehicleType: string;
    initialCode?: string;
  };
  crew: {
    driverId: string;
    driverName: string;
    driverPhone: string;
    licenseType?: string;
    helperName?: string;
    helper2Name?: string;
  };
  cargoItems: OutboundWaybillCargoItem[];
  totalKoli: number;
  totalWeightKg: number;
  securitySealNumber: string; // e.g. "SEAL-AKK-9841"
  status: OutboundWaybillStatus;
  statusLabel: string;
  checkerName: string; // Checker Gudang DC
  checkerNotes?: string;
  driverNotes?: string;
  signedByDriver: boolean;
  signedByDriverAt?: string;
  signedByChecker: boolean;
  signedByCheckerAt?: string;
  // 4 Roles Digital Signature Details
  preparedByName?: string; // SPV Logistik
  preparedBySigned?: boolean;
  preparedBySignedAt?: string;
  preparedBySignatureSvg?: string;
  acknowledgedByName?: string; // Operasional
  acknowledgedBySigned?: boolean;
  acknowledgedBySignedAt?: string;
  acknowledgedBySignatureSvg?: string;
  securityOfficerName?: string; // Security
  securitySigned?: boolean;
  securitySignedAt?: string;
  securitySignatureSvg?: string;
  driverSigned?: boolean; // Driver / Helper
  driverSignedAt?: string;
  driverSignatureSvg?: string;
  qrCodeData: string;
  synced: boolean;
  createdAt: string;
}

// ==========================================
// GA: SECURITY GATE LOG (POS SATPAM & GUDANG)
// ==========================================
export interface SecurityGateLog {
  id: string; // e.g. 'SEC-101'
  timestamp: string; // ISO String
  time: string; // '08:15 WIB'
  type: 'Kendaraan Masuk' | 'Kendaraan Keluar' | 'Tamu Rekanan' | 'Patroli Satpam';
  entity: string; // Kendaraan / Pihak
  driver: string; // Pengemudi / Petugas
  purpose: string; // Keperluan / Muatan
  status: 'Gate-Out' | 'Diizinkan' | 'Tiba di Gudang' | 'Selesai' | 'Aman';
  scheduleId?: string;
  plateNumber?: string;
  initialCode?: string;
  securityOfficer?: string;
  notes?: string;
}



