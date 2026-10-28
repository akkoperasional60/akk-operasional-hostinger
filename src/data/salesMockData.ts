import {
  SalesOrder,
  AdminActivity,
  AdminSchedule,
  LoadingDurationRecord,
  AdminSkillProfile,
  JobdeskConfig
} from '../types';

export const INITIAL_SALES_ORDERS: SalesOrder[] = [
  {
    id: 'so-001',
    poNumber: 'PO/INDM/2026/09/104',
    clientName: 'PT Indomarco Prismatama (DC Ancol)',
    orderDate: '2026-09-15',
    productType: 'Karton Box Corrugated (A1)',
    quantityPcs: 25000,
    totalAmount: 187500000,
    paymentStatus: 'TOP 30 Hari',
    orderStatus: 'Siap Muat',
    deliveryDestination: 'Jakarta Utara, DKI Jakarta',
    adminPic: 'Siti Rahmawati, S.E.'
  },
  {
    id: 'so-002',
    poNumber: 'PO/ALFA/2026/09/882',
    clientName: 'PT Sumber Alfaria Trijaya (DC Balaraja)',
    orderDate: '2026-09-16',
    productType: 'Die-Cut Box E-Commerce',
    quantityPcs: 18000,
    totalAmount: 153000000,
    paymentStatus: 'TOP 30 Hari',
    orderStatus: 'SPK Produksi',
    deliveryDestination: 'Tangerang, Banten',
    adminPic: 'Budi Santoso'
  },
  {
    id: 'so-003',
    poNumber: 'PO/WINGS/2026/09/312',
    clientName: 'Wings Surya Group (DC Surabaya)',
    orderDate: '2026-09-14',
    productType: 'Heavy Duty Box',
    quantityPcs: 12000,
    totalAmount: 216000000,
    paymentStatus: 'Lunas',
    orderStatus: 'Terkirim',
    deliveryDestination: 'Rungkut Industri, Surabaya',
    adminPic: 'Lestari Putri, S.Kom'
  },
  {
    id: 'so-004',
    poNumber: 'PO/MYOR/2026/09/401',
    clientName: 'PT Mayora Indah Tbk (Pabrik Cikupa)',
    orderDate: '2026-09-17',
    productType: 'Sheet Corrugated Board',
    quantityPcs: 30000,
    totalAmount: 165000000,
    paymentStatus: 'TOP 14 Hari',
    orderStatus: 'PO Masuk',
    deliveryDestination: 'Cikupa, Tangerang',
    adminPic: 'Siti Rahmawati, S.E.'
  },
  {
    id: 'so-005',
    poNumber: 'PO/UNLV/2026/09/789',
    clientName: 'PT Unilever Indonesia (Ritel Medan)',
    orderDate: '2026-09-13',
    productType: 'Offset Printing Packaging',
    quantityPcs: 40000,
    totalAmount: 380000000,
    paymentStatus: 'TOP 30 Hari',
    orderStatus: 'Siap Muat',
    deliveryDestination: 'KIM II, Medan, Sumatera Utara',
    adminPic: 'Rian Hidayat'
  },
  {
    id: 'so-006',
    poNumber: 'PO/LION/2026/09/551',
    clientName: 'Lion Superindo (DC Cikarang)',
    orderDate: '2026-09-17',
    productType: 'Karton Box Corrugated (A1)',
    quantityPcs: 15000,
    totalAmount: 112500000,
    paymentStatus: 'Menunggu DP',
    orderStatus: 'PO Masuk',
    deliveryDestination: 'Cikarang Barat, Bekasi',
    adminPic: 'Budi Santoso'
  }
];

export const INITIAL_ADMIN_ACTIVITIES: AdminActivity[] = [
  {
    id: 'act-001',
    adminName: 'Siti Rahmawati, S.E.',
    actionType: 'Input PO',
    clientName: 'PT Mayora Indah Tbk',
    timestamp: '2026-09-17T08:15:00Z',
    status: 'completed',
    notes: 'Verifikasi spesifikasi Karton Box Flute C K200/M150/K200 toleransi ukuran +/- 2mm.',
    durationMinutes: 25
  },
  {
    id: 'act-002',
    adminName: 'Budi Santoso',
    actionType: 'Terbitkan DO',
    clientName: 'PT Indomarco Prismatama (DC Ancol)',
    timestamp: '2026-09-17T09:30:00Z',
    status: 'completed',
    notes: 'Surat Jalan DO/AKK/2026/09/1402 diterbitkan untuk armada P 8125 VC (25.000 pcs box).',
    durationMinutes: 15
  },
  {
    id: 'act-003',
    adminName: 'Lestari Putri, S.Kom',
    actionType: 'Follow Up Pembayaran',
    clientName: 'Wings Surya Group',
    timestamp: '2026-09-17T10:45:00Z',
    status: 'completed',
    notes: 'Konfirmasi bukti transfer pelunasan invoice INV/AKK/2026/08/901 senilai Rp 216.000.000.',
    durationMinutes: 20
  },
  {
    id: 'act-004',
    adminName: 'Rian Hidayat',
    actionType: 'Koordinasi Sampel',
    clientName: 'PT Unilever Indonesia (Ritel Medan)',
    timestamp: '2026-09-17T11:20:00Z',
    status: 'in_progress',
    notes: 'Pengiriman 10 pcs sample mock-up kemasan sabun cuci printing 4-warna CMYK via kurir ekspres.',
    durationMinutes: 40
  },
  {
    id: 'act-005',
    adminName: 'Siti Rahmawati, S.E.',
    actionType: 'Approval Diskon',
    clientName: 'Lion Superindo',
    timestamp: '2026-09-17T13:10:00Z',
    status: 'pending',
    notes: 'Pengajuan diskon volume 2.5% untuk pesanan repeat order 100.000 pcs kuartal IV.',
    durationMinutes: 15
  },
  {
    id: 'act-006',
    adminName: 'Budi Santoso',
    actionType: 'Update Resi Logistik',
    clientName: 'PT Sumber Alfaria Trijaya (Balaraja)',
    timestamp: '2026-09-17T14:00:00Z',
    status: 'completed',
    notes: 'Sinkronisasi nomor resi manifest TRK-20260917-104 dan link GPS Tracksolid kepada PIC logistik Alfamart.',
    durationMinutes: 10
  }
];

export const INITIAL_ADMIN_SCHEDULES: AdminSchedule[] = [
  {
    id: 'sch-001',
    adminName: 'Siti Rahmawati, S.E.',
    date: '2026-09-17',
    timeSlot: '08:30 - 09:30 WIB',
    taskTitle: 'Daily Morning Standup & Rekap PO Masuk Pabrik',
    category: 'Order Processing',
    priority: 'high',
    status: 'completed',
    locationOrChannel: 'Ruang Rapat Sales AKK Banyuwangi'
  },
  {
    id: 'sch-002',
    adminName: 'Budi Santoso',
    date: '2026-09-17',
    timeSlot: '10:00 - 11:30 WIB',
    taskTitle: 'Inspeksi & Pengawalan Muat Wingbox Indomaret',
    category: 'Stock & Loading Coordination',
    priority: 'high',
    status: 'completed',
    locationOrChannel: 'Loading Bay 3, Gudang Pusat Banyuwangi'
  },
  {
    id: 'sch-003',
    adminName: 'Lestari Putri, S.Kom',
    date: '2026-09-17',
    timeSlot: '13:30 - 15:00 WIB',
    taskTitle: 'Rekonsiliasi Faktur Pajak & Aging Piutang TOP 30 Hari',
    category: 'Invoice & AR Follow-up',
    priority: 'medium',
    status: 'scheduled',
    locationOrChannel: 'Finance & Sales ERP Workstation'
  },
  {
    id: 'sch-004',
    adminName: 'Rian Hidayat',
    date: '2026-09-17',
    timeSlot: '15:30 - 16:30 WIB',
    taskTitle: 'Meeting Koordinasi Booking Ro-Ro Ekspedisi Medan',
    category: 'Client Meeting / Visit',
    priority: 'high',
    status: 'scheduled',
    locationOrChannel: 'Google Meet dengan Agen Pelayaran'
  },
  {
    id: 'sch-005',
    adminName: 'Siti Rahmawati, S.E.',
    date: '2026-09-18',
    timeSlot: '09:00 - 11:00 WIB',
    taskTitle: 'Presentasi Sampel Karton Box Ramah Lingkungan ke Klien Retail',
    category: 'Client Meeting / Visit',
    priority: 'medium',
    status: 'scheduled',
    locationOrChannel: 'Kantor Pusat Klien - Menara Thamrin'
  }
];

export const INITIAL_LOADING_RECORDS: LoadingDurationRecord[] = [
  {
    id: 'load-001',
    doNumber: 'DO/AKK/2026/09/1401',
    clientName: 'PT Indomarco Prismatama',
    fleetPlate: 'P 8125 VC',
    adminPic: 'Budi Santoso',
    cargoType: 'Karton Box Corrugated (A1) 5-Ply',
    quantityBoxes: 25000,
    startQueueTime: '08:00',
    startLoadingTime: '08:15',
    finishLoadingTime: '08:52',
    totalDurationMinutes: 37,
    targetSlaMinutes: 45,
    status: 'fast'
  },
  {
    id: 'load-002',
    doNumber: 'DO/AKK/2026/09/1402',
    clientName: 'Wings Surya Surabaya',
    fleetPlate: 'B 9188 SXZ',
    adminPic: 'Rian Hidayat',
    cargoType: 'Heavy Duty Box Export Palletized',
    quantityBoxes: 12000,
    startQueueTime: '09:30',
    startLoadingTime: '09:45',
    finishLoadingTime: '10:28',
    totalDurationMinutes: 43,
    targetSlaMinutes: 45,
    status: 'on_time'
  },
  {
    id: 'load-003',
    doNumber: 'DO/AKK/2026/09/1403',
    clientName: 'PT Unilever Indonesia (Medan Ro-Ro)',
    fleetPlate: 'B 9655 KYZ',
    adminPic: 'Siti Rahmawati, S.E.',
    cargoType: 'Offset Box Kemasan Skala Besar',
    quantityBoxes: 40000,
    startQueueTime: '11:00',
    startLoadingTime: '11:20',
    finishLoadingTime: '12:25',
    totalDurationMinutes: 65,
    targetSlaMinutes: 50,
    status: 'delayed',
    delayReason: 'Kendala verifikasi barcode strapping band & pergantian pallet rusak.'
  },
  {
    id: 'load-004',
    doNumber: 'DO/AKK/2026/09/1404',
    clientName: 'PT Sumber Alfaria Trijaya',
    fleetPlate: 'B 9802 WXZ',
    adminPic: 'Lestari Putri, S.Kom',
    cargoType: 'Die-Cut Box E-Commerce Custom Logo',
    quantityBoxes: 18000,
    startQueueTime: '13:00',
    startLoadingTime: '13:10',
    finishLoadingTime: '13:48',
    totalDurationMinutes: 38,
    targetSlaMinutes: 45,
    status: 'fast'
  },
  {
    id: 'load-005',
    doNumber: 'DO/AKK/2026/09/1405',
    clientName: 'PT Mayora Indah Tbk',
    fleetPlate: 'B 9044 PXT',
    adminPic: 'Budi Santoso',
    cargoType: 'Sheet Corrugated Board Flute B',
    quantityBoxes: 30000,
    startQueueTime: '14:30',
    startLoadingTime: '14:40',
    finishLoadingTime: '15:24',
    totalDurationMinutes: 44,
    targetSlaMinutes: 45,
    status: 'on_time'
  }
];

export const INITIAL_SKILL_PROFILES: AdminSkillProfile[] = [
  {
    id: 'sk-001',
    adminName: 'Siti Rahmawati, S.E.',
    roleTitle: 'Senior B2B Sales Admin & Key Account Lead',
    experienceYears: 6,
    overallScore: 94,
    recentTraining: 'Pelatihan Sertifikasi Supply Chain Packaging & B2B Negotiation (Agustus 2026)',
    skills: [
      { skillName: 'Kalkulasi Flute & Gramatur Karton', level: 5, category: 'Teknis Kemasan', certified: true },
      { skillName: 'Operasional SAP & Sales Order AKK', level: 5, category: 'Sistem & ERP', certified: true },
      { skillName: 'Negosiasi & Service Level Klien', level: 5, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Pengendalian SLA Muat Gudang', level: 4, category: 'Logistik & Regulasi', certified: true },
      { skillName: 'Penanganan Komplain & Klaim Retur', level: 4, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Manajemen AR & Penagihan Faktur', level: 5, category: 'Sistem & ERP', certified: true }
    ]
  },
  {
    id: 'sk-002',
    adminName: 'Budi Santoso',
    roleTitle: 'Sales Order & Warehouse Loading SPV Logistik',
    experienceYears: 4,
    overallScore: 88,
    recentTraining: 'SOP Keselamatan Pergudangan & Loading Bay Management (Juli 2026)',
    skills: [
      { skillName: 'Kalkulasi Flute & Gramatur Karton', level: 4, category: 'Teknis Kemasan', certified: true },
      { skillName: 'Operasional SAP & Sales Order AKK', level: 4, category: 'Sistem & ERP', certified: true },
      { skillName: 'Negosiasi & Service Level Klien', level: 4, category: 'Pelayanan Klien', certified: false },
      { skillName: 'Pengendalian SLA Muat Gudang', level: 5, category: 'Logistik & Regulasi', certified: true },
      { skillName: 'Penanganan Komplain & Klaim Retur', level: 4, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Manajemen AR & Penagihan Faktur', level: 3, category: 'Sistem & ERP', certified: false }
    ]
  },
  {
    id: 'sk-003',
    adminName: 'Lestari Putri, S.Kom',
    roleTitle: 'Billing, Invoicing & System Analyst Admin',
    experienceYears: 3,
    overallScore: 86,
    recentTraining: 'Advanced Database & E-Faktur Pajak Integrasi (Juni 2026)',
    skills: [
      { skillName: 'Kalkulasi Flute & Gramatur Karton', level: 3, category: 'Teknis Kemasan', certified: false },
      { skillName: 'Operasional SAP & Sales Order AKK', level: 5, category: 'Sistem & ERP', certified: true },
      { skillName: 'Negosiasi & Service Level Klien', level: 4, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Pengendalian SLA Muat Gudang', level: 3, category: 'Logistik & Regulasi', certified: false },
      { skillName: 'Penanganan Komplain & Klaim Retur', level: 4, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Manajemen AR & Penagihan Faktur', level: 5, category: 'Sistem & ERP', certified: true }
    ]
  },
  {
    id: 'sk-004',
    adminName: 'Rian Hidayat',
    roleTitle: 'Inter-Island Customer Service & Sample Specialist',
    experienceYears: 3,
    overallScore: 85,
    recentTraining: 'Pelayaran Antarpulau & Ro-Ro Shipping Documentation (Mei 2026)',
    skills: [
      { skillName: 'Kalkulasi Flute & Gramatur Karton', level: 4, category: 'Teknis Kemasan', certified: true },
      { skillName: 'Operasional SAP & Sales Order AKK', level: 4, category: 'Sistem & ERP', certified: true },
      { skillName: 'Negosiasi & Service Level Klien', level: 4, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Pengendalian SLA Muat Gudang', level: 4, category: 'Logistik & Regulasi', certified: true },
      { skillName: 'Penanganan Komplain & Klaim Retur', level: 4, category: 'Pelayanan Klien', certified: true },
      { skillName: 'Manajemen AR & Penagihan Faktur', level: 3, category: 'Sistem & ERP', certified: false }
    ]
  }
];

export const INITIAL_JOBDESK_CONFIGS: JobdeskConfig[] = [
  {
    id: 'job-001',
    roleName: 'Admin Penjualan Wilayah 1 (Jawa Barat, DKI Jakarta & Banten)',
    assignedAdminNames: ['Siti Rahmawati, S.E.', 'Budi Santoso'],
    territory: 'Jabodetabek, Karawang, Cikarang, Banten, Bandung Raya',
    dailyTasks: [
      'Pukul 08:00 WIB: Download & validasi PO masuk dari portal B2B Indomaret & Alfamart.',
      'Pukul 09:30 WIB: Koordinasi dengan Planner Produksi untuk jadwal potong flute & printing box.',
      'Pukul 11:00 WIB: Penerbitan Surat Jalan DO dan verifikasi nomor plat armada sebelum antri di Bay Gudang.',
      'Pukul 14:00 WIB: Pengawalan checklist kelengkapan barang muat (segel pengaman, plastik wrapping box).',
      'Pukul 16:30 WIB: Pengiriman laporan rekap pengiriman harian kepada Head of Sales.'
    ],
    weeklyTasks: [
      'Senin: Rekonsiliasi target omset mingguan vs realisasi pengiriman.',
      'Rabu: Audit stok karton box jadi di Gudang Banyuwangi.',
      'Jumat: Follow-up jadwal pelunasan invoice jatuh tempo bersama tim Finance.'
    ],
    kpiTargets: [
      { name: 'Kecepatan Konversi PO ke Surat Jalan DO', target: '< 3 Jam Kerja', weight: 30 },
      { name: 'Kepatuhan SLA Durasi Muat (< 45 Menit)', target: '>= 95%', weight: 25 },
      { name: 'Akurasi Spesifikasi Box (Nol Retur Akibat Salah Spek)', target: '100%', weight: 25 },
      { name: 'Tingkat Kepuasan & Retensi Klien B2B', target: '>= 4.8 / 5.0', weight: 20 }
    ],
    approvalLimits: 'Wewenang diskon harga s/d 3% untuk order > 20.000 pcs; Wewenang penundaan jadwal muat maks 2 jam.',
    slaCommitment: 'Penerbitan DO maksimal 30 menit setelah barang dinyatakan QC Pass di buffer warehouse.'
  },
  {
    id: 'job-002',
    roleName: 'Admin Penjualan Wilayah 2 (Jawa Tengah & Jawa Timur)',
    assignedAdminNames: ['Lestari Putri, S.Kom'],
    territory: 'Semarang, Solo, Yogyakarta, Surabaya, Sidoarjo, Malang',
    dailyTasks: [
      'Pukul 08:15 WIB: Monitoring estimasi kedatangan truk Tronton Wingbox ke DC Jawa Timur.',
      'Pukul 10:00 WIB: Konfirmasi jadwal buka gudang penerima pabrik FMCG (Wings, Mayora).',
      'Pukul 13:00 WIB: Input data invoice ke sistem e-faktur & pengiriman berkas via ekspedisi khusus.',
      'Pukul 15:30 WIB: Penanganan kebutuhan sampel packaging inovasi baru dari customer setia.'
    ],
    weeklyTasks: [
      'Selasa: Review kapasitas muatan rute Tol Trans-Jawa.',
      'Kamis: Update database harga kompetitor karton box regional Jawa Timur.'
    ],
    kpiTargets: [
      { name: 'Respon Pertanyaan & Permintaan Penawaran Klien', target: '< 15 Menit', weight: 30 },
      { name: 'Penyelesaian Klaim Komplain Kemasan', target: '< 24 Jam', weight: 30 },
      { name: 'Kelengkapan Dokumen POD (Bukti Terima Barang)', target: '100%', weight: 20 },
      { name: 'Aging Piutang Lancar (< 30 Hari)', target: '>= 92%', weight: 20 }
    ],
    approvalLimits: 'Wewenang diskon harga s/d 2.5%; Wewenang pembuatan sample gratis s/d 15 pcs per project.',
    slaCommitment: 'POD fisik diterima dan divalidasi paling lambat 2 hari kerja setelah barang sampai.'
  },
  {
    id: 'job-003',
    roleName: 'Admin Penjualan Luar Pulau (Sumatera, Kalimantan, Bali & Sulawesi)',
    assignedAdminNames: ['Rian Hidayat'],
    territory: 'Sumatera (Medan, Palembang), Bali, Kalimantan (Banjarmasin), Sulawesi (Makassar)',
    dailyTasks: [
      'Pukul 08:30 WIB: Koordinasi manifes Ro-Ro dengan ekspedisi kapal di Pelabuhan Merak & Tanjung Perak.',
      'Pukul 11:30 WIB: Pemeriksaan pengemasan ekstra tahan lembap (waterproof plastic wrap) untuk kargo laut.',
      'Pukul 14:30 WIB: Update posisi kapal ferry dan estimasi sandar kepada retailer penerima.',
      'Pukul 16:00 WIB: Verifikasi dokumen karantina dan asuransi pengiriman laut.'
    ],
    weeklyTasks: [
      'Rabu: Evaluasi jadwal pelayaran armada mingguan.',
      'Jumat: Rekap klaim asuransi kargo jika terjadi kerusakan akibat goncangan laut.'
    ],
    kpiTargets: [
      { name: 'Ketepatan Dokumen Penyeberangan Kapal', target: '100%', weight: 35 },
      { name: 'Kepatuhan Standar Packing Anti-Lembap', target: '100%', weight: 25 },
      { name: 'Kecepatan Update Status Kapal Ro-Ro ke Klien', target: '< 1 Jam', weight: 20 },
      { name: 'Tingkat Keterlambatan Kirim Luar Pulau', target: '< 5%', weight: 20 }
    ],
    approvalLimits: 'Wewenang penyesuaian biaya kargo Ro-Ro s/d Rp 1.500.000 untuk pengiriman darurat.',
    slaCommitment: 'Dokumen pelayaran diterbitkan 24 jam sebelum jadwal keberangkatan kapal ferry.'
  }
];
