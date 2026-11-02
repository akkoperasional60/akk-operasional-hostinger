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
  // 1. MESIN & CAIRAN FLUIDA
  {
    id: 'rule-oli-mesin',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Oli Mesin & Indikator Dipstick',
    standardInterval: 'Ganti tiap 7.500 - 10.000 KM (atau maksimal 3 bulan)',
    maximumLifespan: '10.000 KM / 3 Bulan',
    issueTriggerCondition: 'Level oli di bawah batas MIN pada dipstick, warna hitam pekat berkerak, atau tercium bau gosong terbakar.',
    urgencyLevel: 'kritis',
    immediateAction: 'TAMBAH OLI DARURAT SAE 15W-40 segera jika di bawah MIN. Jika warna hitam pekat berkerak, WAJIB ganti oli mesin dan filter oli baru dalam 1x24 jam sebelum jalan rute antar-kota untuk mencegah mesin macet (engine lock).',
    safetyImpact: 'Resiko piston macet, keausan metal duduk/jalan, dan biaya turun mesin total puluhan juta rupiah.',
    sparepartType: 'Oli Mesin Diesel SAE 15W-40 & Filter Oli'
  },
  {
    id: 'rule-air-radiator',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Air Radiator (Coolant) & Reservoir',
    standardInterval: 'Kuras dan ganti cairan radiator coolant tiap 30.000 - 40.000 KM (1 tahun sekali)',
    maximumLifespan: '40.000 KM / 12 Bulan',
    issueTriggerCondition: 'Tabung reservoir cadangan kosong / di bawah batas MIN, ada tetesan bocor di kisi radiator, atau air keruh kecoklatan berkarat.',
    urgencyLevel: 'kritis',
    immediateAction: 'DILARANG BUKA TUTUP RADIATOR SAAT MESIN PANAS! Isi air coolant khusus sampai batas MAX reservoir. Jika ada kebocoran selang atau radiator, segera perbaiki di bengkel pool sebelum armada diberangkatkan demi mencegah overheat.',
    safetyImpact: 'Overheating mesin di jalan pantura/tanjakan, cylinder head melengkung, mesin mati mendadak di tengah rute.',
    sparepartType: 'Radiator Coolant Concentrate & Tutup Radiator 0.9 Bar'
  },
  {
    id: 'rule-minyak-rem',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Minyak Rem & Minyak Kopling',
    standardInterval: 'Ganti & kuras total (bleeding) minyak rem tiap 20.000 KM (atau 1 tahun)',
    maximumLifespan: '25.000 KM / 1 Tahun',
    issueTriggerCondition: 'Level minyak rem di tabung master silinder turun drastis di bawah batas MIN, warna minyak keruh kehitaman, atau pedal rem terasa kenyal/ambles.',
    urgencyLevel: 'kritis',
    immediateAction: 'KONDISI KRITIS - DILARANG JALAN! Bahaya rem blong. Segera isi minyak rem DOT 3/DOT 4 dan lakukan inspeksi kebocoran pada master rem atas, kaliper, dan selang fleksibel. Ganti seal atau selang yang bocor hari ini juga.',
    safetyImpact: 'Kegagalan pengereman total (rem blong) yang berpotensi fatal pada muatan berat.',
    sparepartType: 'Minyak Rem DOT 3 / DOT 4 & Master Rem Kit'
  },
  {
    id: 'rule-air-wiper',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Air Wiper Washer & Nozzle',
    standardInterval: 'Pemeriksaan tiap minggu, isi ulang air washer tiap kali berkurang',
    maximumLifespan: 'Fleksibel (Isi ulang rutin)',
    issueTriggerCondition: 'Air tabung washer kosong atau lubang semprotan nozzle tersumbat kerak kapur.',
    urgencyLevel: 'waspada',
    immediateAction: 'Isi tabung washer dengan air bersih dicampur shampoo wiper khusus. Tusuk lubang nozzle jarum peniti jika tersumbat untuk menyetel arah semprotan tepat ke tengah kaca.',
    safetyImpact: 'Visibilitas terganggu saat hujan lebat atau cipratan lumpur jalanan.',
    sparepartType: 'Cairan Konsentrat Wiper Washer'
  },
  {
    id: 'rule-bocor-kolong',
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Pemeriksaan Kolong Mesin (Kebocoran)',
    standardInterval: 'Inspeksi fisik harian sebelum start mesin',
    maximumLifespan: 'Pemeriksaan harian',
    issueTriggerCondition: 'Terdapat genangan tetesan oli hitam, minyak solar, atau cairan pendingin di lantai bawah mesin/transmisi.',
    urgencyLevel: 'kritis',
    immediateAction: 'Lacak sumber tetesan (karter oli, seal kruk as, packing silinder, atau selang solar). Bawa ke pit bengkel pool DC untuk pengencangan baut tap karter atau penggantian gasket karter hari ini.',
    safetyImpact: 'Kehabisan pelumas di perjalanan yang menyebabkan mesin macet tiba-tiba.',
    sparepartType: 'Gasket Karter Oli & Seal Kruk As'
  },

  // 2. REM & RODA (KAKI-KAKI)
  {
    id: 'rule-rem-kaki',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Rem Kaki (Pedal Rem Utama)',
    standardInterval: 'Pembersihan & setel rem tiap 10.000 KM; Ganti kampas rem tiap 25.000 - 35.000 KM',
    maximumLifespan: '35.000 KM / Ketebalan kampas < 2.0 mm',
    issueTriggerCondition: 'Pedal rem bergetar, terdengar decitan tajam gesekan besi dengan tromol, atau pengereman tidak seimbang (menarik ke kiri/kanan).',
    urgencyLevel: 'kritis',
    immediateAction: 'DILARANG JALAN UNTUK MUATAN BERAT! Buka roda, cek sisa ketebalan kampas rem (brake shoe/pad). Jika sisa kurang dari 2 mm atau beradu paku keling, langsung ganti kampas rem baru dan bubut tromol rem.',
    safetyImpact: 'Rem blong, pengereman jarak jauh molor, tromol pecah karena panas berlebih.',
    sparepartType: 'Brake Shoe / Kampas Rem Depan & Belakang'
  },
  {
    id: 'rule-rem-parkir',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Rem Parkir / Handbrake',
    standardInterval: 'Setel jarak tuas klik rem tangan tiap 10.000 KM (standar 5 - 7 klik)',
    maximumLifespan: 'Kabel rem tangan 50.000 KM',
    issueTriggerCondition: 'Tuas handbrake ditarik tinggi (> 9 klik) tetapi roda masih berputar atau kendaraan bergeser pada jalan menurun.',
    urgencyLevel: 'kritis',
    immediateAction: 'Setel baud penyetel kabel rem tangan di bawah gardan tengah. Bila kampas tromol rem tangan aus, segera lakukan penggantian kampas sebelum armada parkir di gudang miring.',
    safetyImpact: 'Kendaraan meluncur mundur tanpa kendali saat parkir bongkar muat.',
    sparepartType: 'Kabel Handbrake & Kampas Rem Tangan'
  },
  {
    id: 'rule-ban-depan',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Tekanan & Kondisi Ban Depan',
    standardInterval: 'Rotasi posisi ban tiap 10.000 KM; Ganti ban baru tiap 40.000 - 50.000 KM',
    maximumLifespan: '45.000 KM / Indikator TWI Rata (Alur < 1.6 mm)',
    issueTriggerCondition: 'Alur kembang ban gundul, benjol pada dinding samping (side-wall), kawat ban keluar, atau tekanan angin kempes (< 55 PSI).',
    urgencyLevel: 'kritis',
    immediateAction: 'BAN DEPAN BENJOL / GUNDUL WAJIB LANGSUNG DIGANTI HARI INI! Dilarang keras memakai ban vulkanisir untuk posisi roda kemudi depan. Pompa tekanan ban standar 65 - 70 PSI.',
    safetyImpact: 'Pecah ban depan pada kecepatan tinggi menyebabkan truk terguling atau oleng.',
    sparepartType: 'Ban Luar Standar Truk 7.50-16 / 7.00-15'
  },
  {
    id: 'rule-ban-belakang',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Tekanan & Kondisi Ban Belakang / Gandar',
    standardInterval: 'Pemeriksaan tekanan angin & baut roda tiap hari; Rotasi ban tiap 10.000 KM',
    maximumLifespan: '50.000 KM',
    issueTriggerCondition: 'Tekanan ban belakang tidak seimbang pada roda ganda, ada batu terselip di sela ban ganda, atau baut roda longgar/patah.',
    urgencyLevel: 'kritis',
    immediateAction: 'Cungkil batu yang terselip di sela ban ganda agar tidak merobek dinding ban. Kencangkan seluruh baut roda dengan kunci torsi. Sesuaikan tekanan angin ban belakang (80 - 85 PSI).',
    safetyImpact: 'Roda lepas di jalan tol, gesekan panas antar ban ganda menyebabkan kebakaran ban.',
    sparepartType: 'Baut Mur Roda Grade 10.9 & Ban Gandar Belakang'
  },
  {
    id: 'rule-ban-serep',
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Ban Serep & Tekanan Udara',
    standardInterval: 'Pemeriksaan tekanan angin ban serep tiap 2 minggu (isi 85 PSI)',
    maximumLifespan: '5 Tahun dari tahun produksi ban',
    issueTriggerCondition: 'Ban serep kempis, gundul, atau rantai engsel bracket penurun ban serep macet berkarat.',
    urgencyLevel: 'waspada',
    immediateAction: 'Pompa ban serep hingga 85 PSI. Lumasi tuas pengait dan rantai penurun ban cadangan dengan cairan penetran pelumas agar tidak macet saat darurat.',
    safetyImpact: 'Armada mogok terlantar berjam-jam di jalan sepi jika ban utama pecah.',
    sparepartType: 'Dudukan Ban Serep & Ban Cadangan'
  },

  // 3. LAMPU & KELISTRIKAN
  {
    id: 'rule-lampu-utama',
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Lampu Utama (Dekat & Jauh)',
    standardInterval: 'Ganti bohlam halogen sesuai masa pakai (rata-rata 1.000 jam operasi)',
    maximumLifespan: '1 - 2 Tahun',
    issueTriggerCondition: 'Lampu utama mati salah satu atau kedua sisi, sorot lampu redup, mika headlamp pecah kemasukan air.',
    urgencyLevel: 'kritis',
    immediateAction: 'SEGERA GANTI BOHLAM H4 24V / 12V dalam waktu 1 jam sebelum jadwal berangkat malam. Periksa soket keramik dari resiko terbakar atau sekring 15A yang putus.',
    safetyImpact: 'Kecelakaan tabrakan di jalan minim penerangan, tilang polisi lalu lintas.',
    sparepartType: 'Bohlam Halogen H4 24V/12V & Soket Keramik'
  },
  {
    id: 'rule-lampu-sein-hazard',
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Lampu Sein (L/R) & Hazard',
    standardInterval: 'Pemeriksaan rutin kelistrikan tiap servis berkala',
    maximumLifespan: 'Fleksibel',
    issueTriggerCondition: 'Lampu sein tidak berkedip (mati), kedip terlalu cepat (ada bohlam putus), atau saklar hazard tidak aktif.',
    urgencyLevel: 'waspada',
    immediateAction: 'Ganti bohlam sein kuning atau relay flasher sein di box sekring. Pastikan lampu sein samping kabin juga ikut menyala.',
    safetyImpact: 'Kendaraan lain tidak mengetahui arah manuver belok armada di pertigaan padat.',
    sparepartType: 'Bohlam Putar 24V 21W & Flasher Relay'
  },
  {
    id: 'rule-lampu-rem-mundur',
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Lampu Rem & Lampu Mundur',
    standardInterval: 'Pemeriksaan switch pedal rem & switch mundur tiap 10.000 KM',
    maximumLifespan: 'Fleksibel',
    issueTriggerCondition: 'Lampu rem tidak menyala saat pedal diinjak, lampu mundur mati, atau sirine buzzer mundur hening.',
    urgencyLevel: 'kritis',
    immediateAction: 'Ganti bohlam rem ganda (bayonet kaki 2). Jika tidak menyala, cek switch rem di atas pedal rem atau sekring STOP LAMP. Wajib aktif sebelum keluar gerbang DC.',
    safetyImpact: 'Tertabrak dari belakang oleh kendaraan lain saat melakukan pengereman mendadak.',
    sparepartType: 'Bohlam Kaki Dua 24V & Switch Rem'
  },
  {
    id: 'rule-aki-baterai',
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Baterai / Aki & Indikator Dashboard',
    standardInterval: 'Pemeriksaan air aki tiap 2 minggu; Bersihkan klem kutub tiap 1 bulan',
    maximumLifespan: 'Umur pakai aki rata-rata 1.5 - 2 Tahun',
    issueTriggerCondition: 'Starter mesin terasa berat dan panjang, tegangan aki < 12.2 Volt, kepala aki berkerak putih tebal, atau lampu indikator aki merah menyala.',
    urgencyLevel: 'kritis',
    immediateAction: 'Siram kerak putih kutub aki dengan air panas mendidih dan kencangkan klem. Tambah air aki botol biru jika sel surut. Jika usia aki > 1.5 tahun dan cell drop, SEGERA GANTI AKI BARU agar tidak mogok di area bongkar pelanggan.',
    safetyImpact: 'Truk mati total tidak bisa starter di jalan tol atau saat antre bongkar muat.',
    sparepartType: 'Aki Truk 12V 70Ah - 100Ah & Klem Kutub Kuningan'
  },

  // 4. FISIK, BODI & LEGALITAS DOKUMEN
  {
    id: 'rule-buku-kir',
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'Buku Uji KIR Dishub Aktif',
    standardInterval: 'Uji berkala KIR Dishub wajib tiap 6 Bulan sekali',
    maximumLifespan: '6 Bulan',
    issueTriggerCondition: 'Masa berlaku buku uji KIR tersisa kurang dari 14 hari atau sudah lewat tanggal jatuh tempo.',
    urgencyLevel: 'kritis',
    immediateAction: 'SEGERA JADWALKAN UJI KIR KE DISHUB BANYUWANGI maksimal 7 hari sebelum jatuh tempo. Lakukan pra-uji (rem, emisi asap, lampu) di bengkel pool terlebih dahulu.',
    safetyImpact: 'Tilang penindakan Dishub, penyitaan buku KIR, dan armada dilarang beroperasi melintasi jembatan timbang.',
    sparepartType: 'Sertifikat & Plat Uji KIR Dishub'
  },
  {
    id: 'rule-pajak-stnk',
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'STNK Asli & Masa Pajak Aktif',
    standardInterval: 'Perpanjangan Pajak Tahunan tiap 1 Tahun; Ganti Plat STNK tiap 5 Tahun',
    maximumLifespan: '1 Tahun (Pajak) / 5 Tahun (STNK)',
    issueTriggerCondition: 'STNK asli tidak ada di dashboard kabin, atau tanggal pajak PKB sudah lewat tempo.',
    urgencyLevel: 'waspada',
    immediateAction: 'Hubungi bagian Adm. Legal & Pajak AKK untuk proses perpanjangan di kantor Samsat. Pastikan lembar STNK asli selalu tersimpan dalam dompet dokumen kendaraan di kabin.',
    safetyImpact: 'Tilang kepolisian dan penyitaan unit kendaraan saat razia operasi gabungan.',
    sparepartType: 'Pengesahan PKB Samsat'
  },
  {
    id: 'rule-pintu-boks',
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'Pintu Boks & Engsel Pengunci',
    standardInterval: 'Pelumasan engsel & karet pintu boks tiap 1 bulan',
    maximumLifespan: 'Karet pintu boks 2 Tahun',
    issueTriggerCondition: 'Karet penutup pintu boks robek, air hujan rembes masuk ke dalam boks, tuas grendel pengunci patah atau longgar.',
    urgencyLevel: 'kritis',
    immediateAction: 'SEGERA GANTI KARET PINTU BOKS DAN LAS PERBAIKAN ENGSEL HARI INI! Jangan berangkat saat cuaca mendung jika karet boks bocor, karena produk kemasan karton sensitif air.',
    safetyImpact: 'Produk karton kemasan basah/rusak (klaim kerugian toko), pintu boks terbuka sendiri di jalan raya membahayakan pengendara lain.',
    sparepartType: 'Karet Pintu Boks Kontainer & Handle Grendel Boks'
  },

  // 5. PERLENGKAPAN DARURAT & K3
  {
    id: 'rule-apar',
    category: 'darurat_k3',
    categoryLabel: 'Perlengkapan K3 & Darurat',
    name: 'APAR (Alat Pemadam Api Ringan)',
    standardInterval: 'Refill ulang serbuk dry chemical powder tiap 1 Tahun sekali; Cek manometer tiap bulan',
    maximumLifespan: '1 Tahun per pengisian',
    issueTriggerCondition: 'Jarum indikator tekanan manometer berada di zona merah (tekanan drop), segel pin pengaman putus, atau nozzle selang sobek.',
    urgencyLevel: 'kritis',
    immediateAction: 'Kirim tabung APAR ke rekanan isi ulang Damkar hari ini. Sediakan tabung APAR cadangan 3 kg di kabin supir sebelum jalan.',
    safetyImpact: 'Tidak dapat memadamkan korsleting percikan api kabel di ruang mesin.',
    sparepartType: 'Tabung APAR Dry Chemical Powder 3 Kg'
  },
  {
    id: 'rule-dongkrak-kunci-roda',
    category: 'darurat_k3',
    categoryLabel: 'Perlengkapan K3 & Darurat',
    name: 'Dongkrak Hidrolik & Kunci Roda',
    standardInterval: 'Cek oli hidrolik dongkrak tiap 3 bulan; Uji fungsi angkat beban',
    maximumLifespan: 'Fleksibel',
    issueTriggerCondition: 'Dongkrak bocor oli (tidak bisa menahan beban), stang pemutar hilang, atau kunci roda kendor / aus drat.',
    urgencyLevel: 'kritis',
    immediateAction: 'Ganti dengan dongkrak hidrolik botol minimal kapasitas 5 ton (untuk Engkel) atau 10 ton (untuk Double). Lengkapi stang sambungan dongkrak dan kunci roda pipa panjang.',
    safetyImpact: 'Tidak bisa mengganti ban pecah saat perjalanan darurat.',
    sparepartType: 'Dongkrak Botol Hidrolik 5T/10T & Kunci Roda Palang'
  }
];

export const getMaintenanceRuleForItem = (itemName: string): MaintenanceComponentRule | undefined => {
  const cleanName = itemName.toLowerCase();
  return MAINTENANCE_COMPONENT_RULES.find(rule => 
    cleanName.includes(rule.name.toLowerCase()) || 
    rule.name.toLowerCase().includes(cleanName)
  );
};
