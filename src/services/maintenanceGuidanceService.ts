export interface MaintenanceComponentRule {
  id: string;
  category: 'mesin_fluida' | 'rem_roda' | 'lampu_listrik' | 'fisik_dokumen' | 'darurat_k3';
  categoryLabel: string;
  name: string;
  standardInterval: string; // Kapan harus diservis / diganti rutin
  maximumLifespan: string; // Batas usia pakai maksimal
  issueTriggerCondition: string; // Kondisi kendala saat pengisian checklist
  urgencyLevel: 'kritis' | 'waspada' | 'rutin'; // Urgensi perbaikan
  immediateAction: string; // Tindakan penanganan segera
  safetyImpact: string; // Dampak terhadap keselamatan jika diabaikan
  sparepartType?: string; // Sparepart terkait
}

export const MAINTENANCE_COMPONENT_RULES: MaintenanceComponentRule[] = [
  // 1. OLI MESIN
  {
    id: 'rule-oli-mesin',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Oli Mesin',
    standardInterval: 'Ganti tiap 7.500 - 10.000 KM (atau maksimal 3 bulan)',
    maximumLifespan: '10.000 KM / 3 Bulan',
    issueTriggerCondition: 'Level oli di bawah batas MIN pada dipstick, warna hitam pekat berkerak, atau tercium bau gosong terbakar.',
    urgencyLevel: 'kritis',
    immediateAction: 'TAMBAH OLI DARURAT SAE 15W-40 segera jika di bawah MIN. Jika warna hitam pekat berkerak, WAJIB ganti oli mesin dan filter oli baru dalam 1x24 jam sebelum jalan rute antar-kota untuk mencegah mesin macet (engine lock).',
    safetyImpact: 'Resiko piston macet, keausan metal duduk/jalan, dan biaya turun mesin total puluhan juta rupiah.',
    sparepartType: 'Oli Mesin Diesel SAE 15W-40 & Filter Oli'
  },
  // 2. AIR RADIATOR
  {
    id: 'rule-air-radiator',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Air Radiator',
    standardInterval: 'Kuras dan ganti cairan radiator coolant tiap 30.000 - 40.000 KM (1 tahun sekali)',
    maximumLifespan: '40.000 KM / 12 Bulan',
    issueTriggerCondition: 'Tabung reservoir cadangan kosong / di bawah batas MIN, ada tetesan bocor di kisi radiator, atau air keruh kecoklatan berkarat.',
    urgencyLevel: 'kritis',
    immediateAction: 'DILARANG BUKA TUTUP RADIATOR SAAT MESIN PANAS! Isi air coolant khusus sampai batas MAX reservoir. Jika ada kebocoran selang atau radiator, segera perbaiki di bengkel pool sebelum armada diberangkatkan demi mencegah overheat.',
    safetyImpact: 'Overheating mesin di jalan pantura/tanjakan, cylinder head melengkung, mesin mati mendadak di tengah rute.',
    sparepartType: 'Radiator Coolant Concentrate & Tutup Radiator 0.9 Bar'
  },
  // 3. FOTO OLI MESIN & AIR RADIATOR
  {
    id: 'rule-foto-oli-radiator',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Foto Oli Mesin & Air Radiator',
    standardInterval: 'Dokumentasi foto wajib setiap Pra-Jalan (Pagi) & Pasca-Jalan (Pulang)',
    maximumLifespan: 'Wajib tiap keberangkatan & kepulangan',
    issueTriggerCondition: 'Foto tidak jelas, terlewat diambil, atau pada foto terlihat kebocoran/level cairan di bawah standar.',
    urgencyLevel: 'waspada',
    immediateAction: 'Ambil foto ulang kondisi dipstick oli mesin dan tabung air radiator secara jelas menggunakan kamera langsung sebelum armada keluar gudang.',
    safetyImpact: 'Memastikan bukti verifikasi visual kondisi fluida mesin tercatat akurat untuk audit mekanik.',
    sparepartType: 'Inspeksi Visual Oli & Coolant'
  },
  // 4. AIR ACCU
  {
    id: 'rule-air-accu',
    category: 'lampu_listrik',
    categoryLabel: 'Kelistrikan & Accu',
    name: 'Air Accu',
    standardInterval: 'Pemeriksaan level air accu tiap minggu; Bersihkan klem kutub tiap 1 bulan',
    maximumLifespan: 'Umur pakai aki rata-rata 1.5 - 2 Tahun',
    issueTriggerCondition: 'Level cairan air accu di bawah garis LOWER, starter mesin berat, tegangan aki < 12.2 Volt, atau kepala aki berkerak putih.',
    urgencyLevel: 'kritis',
    immediateAction: 'Tambahkan air accu (botol biru) hingga batas garis UPPER. Bersihkan kerak putih pada kutub aki dan kencangkan klem. Jika sel aki drop, segera ganti aki baru sebelum keberangkatan.',
    safetyImpact: 'Truk mati total tidak bisa starter di lokasi pelanggan atau di tengah perjalanan.',
    sparepartType: 'Air Accu & Aki Truk 12V/24V 70Ah - 100Ah'
  },
  // 5. REM MOBIL & MINYAK REM
  {
    id: 'rule-rem-mobil-minyak-rem',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda',
    name: 'Rem Mobil & Minyak Rem',
    standardInterval: 'Cek minyak rem harian; Setel kampas rem tiap 10.000 KM; Kuras minyak rem tiap 20.000 KM',
    maximumLifespan: '25.000 KM / Ketebalan kampas < 2.0 mm',
    issueTriggerCondition: 'Level minyak rem di bawah batas MIN, warna minyak keruh kehitaman, pedal rem terasa dalam/ambles, atau terdengar bunyi gesekan kampas rem.',
    urgencyLevel: 'kritis',
    immediateAction: 'KONDISI KRITIS - DILARANG JALAN! Segera isi minyak rem DOT 3/DOT 4 dan periksa kebocoran master rem, kaliper, serta ketebalan kampas rem di bengkel pool hari ini juga.',
    safetyImpact: 'Kegagalan pengereman total (rem blong) yang berpotensi fatal pada muatan berat.',
    sparepartType: 'Minyak Rem DOT 3/DOT 4 & Kampas Rem Depan/Belakang'
  },
  // 6. FOTO MINYAK REM
  {
    id: 'rule-foto-minyak-rem',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda',
    name: 'Foto Minyak Rem',
    standardInterval: 'Dokumentasi foto wajib setiap Pra-Jalan (Pagi) & Pasca-Jalan (Pulang)',
    maximumLifespan: 'Wajib tiap keberangkatan & kepulangan',
    issueTriggerCondition: 'Foto tabung minyak rem belum dilampirkan atau memperlihatkan level minyak rem di bawah garis batas aman.',
    urgencyLevel: 'waspada',
    immediateAction: 'Ambil foto langsung tabung reservoir minyak rem secara jelas untuk verifikasi keamanannya oleh SPV/Checker.',
    safetyImpact: 'Validasi bukti visual sistem hidrolik pengereman sebelum dan sesudah operasional.',
    sparepartType: 'Inspeksi Visual Tabung Master Rem'
  },
  // 7. KEBERSIHAN KABIN
  {
    id: 'rule-kebersihan-kabin',
    category: 'fisik_dokumen',
    categoryLabel: 'Kabin & Inventaris',
    name: 'Kebersihan Kabin',
    standardInterval: 'Pembersihan kabin harian setiap selesai pengiriman (Pasca-Jalan)',
    maximumLifespan: 'Pemeriksaan harian',
    issueTriggerCondition: 'Ruang kabin kotor, banyak sampah sisa makanan/kemasan, dashboard berdebu tebal, atau kaca depan buram.',
    urgencyLevel: 'rutin',
    immediateAction: 'Bersihkan sampah di kabin, sapu karpet lantai, dan lap kaca depan serta dashboard sebelum/sesudah operasional.',
    safetyImpact: 'Kenyamanan dan konsentrasi pengemudi terjaga serta mencegah botol/benda menggelinding ke bawah pedal rem.',
    sparepartType: 'Perlengkapan Kebersihan Kabin'
  },
  // 8. INVENTARIS MOBIL
  {
    id: 'rule-inventaris-mobil',
    category: 'fisik_dokumen',
    categoryLabel: 'Kabin & Inventaris',
    name: 'Inventaris Mobil',
    standardInterval: 'Pengecekan kelengkapan inventaris wajib setiap hari sebelum berangkat',
    maximumLifespan: 'Pemeriksaan harian',
    issueTriggerCondition: 'Dongkrak hidrolik, kunci roda, segitiga pengaman, APAR, atau dokumen jalan (STNK/KIR) tidak lengkap di dalam kabin.',
    urgencyLevel: 'kritis',
    immediateAction: 'Lengkapi seluruh inventaris wajib mobil (dongkrak, kunci roda, stang dongkrak, segitiga pengaman, dan dokumen STNK/KIR) sebelum truk Gate-Out.',
    safetyImpact: 'Kendala penanganan darurat di jalan raya (seperti ganti ban) atau kendala pemeriksaan dokumen.',
    sparepartType: 'Dongkrak Hidrolik, Kunci Roda & Dokumen Armada'
  },
  // 9. BAN CADANGAN
  {
    id: 'rule-ban-cadangan',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda',
    name: 'Ban Cadangan',
    standardInterval: 'Pemeriksaan tekanan angin ban cadangan tiap minggu (isi 80 - 85 PSI)',
    maximumLifespan: '5 Tahun dari tahun produksi ban',
    issueTriggerCondition: 'Ban cadangan kempes, alur ban gundul, atau pengait/rantai bracket dudukan ban cadangan kendor/macet.',
    urgencyLevel: 'waspada',
    immediateAction: 'Pompa ban cadangan hingga tekanan standar (80 - 85 PSI) dan pastikan rantai pengunci bracket terpasang kuat serta tidak macet.',
    safetyImpact: 'Armada terlantar berjam-jam di rute pengiriman apabila ban utama mengalami kebocoran/pecah.',
    sparepartType: 'Ban Cadangan & Bracket Pengunci Roda Serep'
  }
];

export const getMaintenanceRuleForItem = (itemName: string): MaintenanceComponentRule | undefined => {
  const cleanName = itemName.toLowerCase().trim();
  return (
    MAINTENANCE_COMPONENT_RULES.find(rule => rule.name.toLowerCase() === cleanName) ||
    MAINTENANCE_COMPONENT_RULES.find(rule =>
      cleanName.includes(rule.name.toLowerCase()) ||
      rule.name.toLowerCase().includes(cleanName)
    )
  );
};

