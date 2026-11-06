import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Settings2,
  Upload,
  Check,
  RotateCcw,
  Plus,
  Layout,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Grid,
  Image as ImageIcon,
  FileText,
  Sliders,
  ChevronDown,
  Sparkles,
  Layers,
  Eye
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { jsPDF } from 'jspdf';

export type FleetFormType = 'service' | 'washing' | 'procurement';

export interface TemplateFieldConfig {
  id: string;
  defaultLabel: string;
  nama: string;
  layar: boolean;
  cetak: boolean;
  urut?: number;
  subLabel?: string;
}

export interface CompanyInfoConfig {
  cetakNamaPerusahaan: boolean;
  cetakAlamatPerusahaan: boolean;
  pakaiLogo: boolean;
  namaPerusahaan: string;
  alamatPerusahaan: string;
  customLogoDataUrl: string | null;
}

export interface OtherTemplateConfig {
  ukuranKertas: 'A4' | 'F4' | 'Letter';
  orientasi: 'portrait' | 'landscape';
  tampilkanGarisDotted: boolean;
  tampilkanBagianPenyelesaianService: boolean;
  jumlahBarisKosong: number;
}

export interface FleetFormTemplateConfig {
  formType: FleetFormType;
  namaRancangan: string;
  kepala: TemplateFieldConfig[];
  kepalaTambahan: TemplateFieldConfig[];
  detil: TemplateFieldConfig[];
  kaki: TemplateFieldConfig[];
  lain: OtherTemplateConfig;
  infoPerusahaan: CompanyInfoConfig;
}

export interface FormPrintHistoryItem {
  id: string;
  formType: FleetFormType;
  docType: string;
  nomorDokumen: string;
  timestamp: string;
  userId: string;
  summary: string;
}

const STORAGE_KEY_TEMPLATES = 'akk_fleet_form_templates_v3';
const STORAGE_KEY_PRINT_LOGS = 'akk_fleet_form_print_logs_v3';

export const DEFAULT_AKK_LOGO_PATH = '/assets/aistudio/image_c8ea86e5.png';

export const FORM_TYPE_OPTIONS: Array<{ value: FleetFormType; label: string }> = [
  { value: 'service', label: 'FORMULIR SERVICE ARMADA' },
  { value: 'washing', label: 'FORMULIR CUCI ARMADA' },
  { value: 'procurement', label: 'FORMULIR PENGADAAN ARMADA' }
];

export const DEFAULT_TEMPLATES: Record<FleetFormType, FleetFormTemplateConfig> = {
  service: {
    formType: 'service',
    namaRancangan: 'FORMULIR SERVICE ARMADA',
    kepala: [
      { id: 'judul', defaultLabel: 'Judul', nama: 'PERMOHONAN SERVICE DAN PEMELIHARAAN', layar: true, cetak: true },
      { id: 'kepada_yth', defaultLabel: 'Kepada Yth', nama: 'Kepada Yth', layar: true, cetak: true },
      { id: 'dari_depart', defaultLabel: 'Dari Departemen', nama: 'Dari Depart', layar: true, cetak: true },
      { id: 'bagian', defaultLabel: 'Bagian', nama: 'Bagian', layar: true, cetak: true },
      { id: 'tanggal', defaultLabel: 'Tgl Formulir', nama: 'Tanggal', layar: true, cetak: true },
      { id: 'nomor', defaultLabel: 'No. Formulir', nama: 'Nomor', layar: true, cetak: true }
    ],
    kepalaTambahan: [
      { id: 'tgl_selesai', defaultLabel: 'Tgl Selesai Dikerjakan', nama: 'Tanggal selesai dikerjakan', layar: true, cetak: true },
      { id: 'pernyataan_1', defaultLabel: 'Teks Pernyataan Aktiva', nama: 'Dengan ini aktiva tetap di bawah ini telah dilakukan perbaikan sehingga kini dalam kondisi yang baik', layar: true, cetak: true },
      { id: 'pernyataan_2', defaultLabel: 'Sub-Teks Rincian', nama: 'Rincian service dan pemeliharaan beserta pemakaian barangnya adalah sebagai berikut:', layar: true, cetak: true },
      { id: 'nopol_armada', defaultLabel: 'No. Polisi Armada', nama: 'No. Polisi / Armada', layar: false, cetak: false },
      { id: 'km_terakhir', defaultLabel: 'KM Odometer', nama: 'KM Terakhir', layar: false, cetak: false },
      { id: 'nama_mekanik', defaultLabel: 'Mekanik / Bengkel', nama: 'Vendor / Bengkel', layar: false, cetak: false }
    ],
    detil: [
      { id: 'kerusakan', defaultLabel: 'Blok Kerusakan (Atas)', nama: 'KERUSAKAN', layar: true, cetak: true, urut: 1 },
      { id: 'jenis_aktiva', defaultLabel: 'Kolom Jenis / Aktiva', nama: 'Jenis / Aktiva', layar: true, cetak: true, urut: 2 },
      { id: 'no_aktiva', defaultLabel: 'Kolom Nomor Aktiva Tetap', nama: 'Nomor Aktiva Tetap*', layar: true, cetak: true, urut: 3 },
      { id: 'departemen_aktiva', defaultLabel: 'Kolom Departemen', nama: 'Departemen', layar: true, cetak: true, urut: 4 },
      { id: 'bagian_aktiva', defaultLabel: 'Kolom Bagian', nama: 'Bagian', layar: true, cetak: true, urut: 5 },
      { id: 'perbaikan_dilakukan', defaultLabel: 'Blok Perbaikan Dilakukan', nama: 'Perbaikan yang dilakukan :', layar: true, cetak: true, urut: 6 },
      { id: 'rincian_barang_judul', defaultLabel: 'Judul Tabel Pemakaian Barang', nama: 'Rincian pemakaian barang :', layar: true, cetak: true, urut: 7 },
      { id: 'nama_barang', defaultLabel: 'Kolom Nama Barang', nama: 'NAMA BARANG', layar: true, cetak: true, urut: 8 },
      { id: 'jumlah_barang', defaultLabel: 'Kolom Jumlah Barang', nama: 'JUMLAH', layar: true, cetak: true, urut: 9 },
      { id: 'satuan', defaultLabel: 'Satuan', nama: 'SATUAN', layar: false, cetak: false, urut: 10 },
      { id: 'harga_estimasi', defaultLabel: 'Biaya / Harga', nama: 'BIAYA', layar: false, cetak: false, urut: 11 }
    ],
    kaki: [
      { id: 'ttd_menerima_atas', defaultLabel: 'TTD Atas 1 (Kiri)', nama: 'Yang Menerima,', subLabel: 'VENDOR', layar: true, cetak: true },
      { id: 'ttd_menyetujui_atas', defaultLabel: 'TTD Atas 2 (Tengah)', nama: 'Menyetujui,', subLabel: 'SPV FINANCE', layar: true, cetak: true },
      { id: 'ttd_mengajukan_atas', defaultLabel: 'TTD Atas 3 (Kanan)', nama: 'Yang Mengajukan,', subLabel: 'SPV DEPARTEMEN', layar: true, cetak: true },
      { id: 'ttd_menyerahkan_bawah', defaultLabel: 'TTD Bawah 1 (Atas)', nama: 'Yang Menyerahkan,', subLabel: 'HR & GA', layar: true, cetak: true },
      { id: 'ttd_menerima_bawah', defaultLabel: 'TTD Bawah 2 (Bawah)', nama: 'Yang Menerima,', subLabel: '............ Mgr/SPV', layar: true, cetak: true }
    ],
    lain: {
      ukuranKertas: 'A4',
      orientasi: 'portrait',
      tampilkanGarisDotted: false,
      tampilkanBagianPenyelesaianService: true,
      jumlahBarisKosong: 7
    },
    infoPerusahaan: {
      cetakNamaPerusahaan: false,
      cetakAlamatPerusahaan: false,
      pakaiLogo: false,
      namaPerusahaan: 'PT ANUGRAH KEMASAN KREATIF',
      alamatPerusahaan: 'BANYUWANGI',
      customLogoDataUrl: null
    }
  },
  washing: {
    formType: 'washing',
    namaRancangan: 'FORMULIR CUCI ARMADA',
    kepala: [
      { id: 'judul', defaultLabel: 'Judul Formulir', nama: 'FORM KEGIATAN DRIVER', layar: true, cetak: true },
      { id: 'kepada', defaultLabel: 'Kepada Yth', nama: 'KEPADA : PRODUKSI', layar: true, cetak: true },
      { id: 'di_tempat', defaultLabel: 'Sub Tujuan', nama: 'DI TEMPAT', layar: true, cetak: true },
      { id: 'tanggal', defaultLabel: 'Tanggal Kegiatan', nama: 'TANGGAL :', layar: true, cetak: true }
    ],
    kepalaTambahan: [
      { id: 'shift', defaultLabel: 'Shift Operasional', nama: 'SHIFT :', layar: false, cetak: false },
      { id: 'lokasi_cuci', defaultLabel: 'Area Pencucian / Pool', nama: 'POOL / GARASI :', layar: false, cetak: false },
      { id: 'petugas_checker', defaultLabel: 'Checker Kebersihan', nama: 'CHECKER :', layar: false, cetak: false }
    ],
    detil: [
      { id: 'nama_driver', defaultLabel: 'Nama Driver', nama: 'NAMA DRIVER', layar: true, cetak: true, urut: 1 },
      { id: 'no_urut', defaultLabel: 'No Urut', nama: 'NO', layar: true, cetak: true, urut: 2 },
      { id: 'keterangan', defaultLabel: 'Keterangan Cuci / Kegiatan', nama: 'KETERANGAN', layar: true, cetak: true, urut: 3 },
      { id: 'mulai', defaultLabel: 'Waktu Mulai', nama: 'MULAI', layar: true, cetak: true, urut: 4 },
      { id: 'selesai', defaultLabel: 'Waktu Selesai', nama: 'SELESAI', layar: true, cetak: true, urut: 5 },
      { id: 'nopol', defaultLabel: 'No. Polisi Armada', nama: 'NO. POLISI', layar: false, cetak: false, urut: 6 },
      { id: 'status_bersih', defaultLabel: 'Status Ceklist', nama: 'STATUS', layar: false, cetak: false, urut: 7 }
    ],
    kaki: [
      { id: 'ttd_dibuat', defaultLabel: 'TTD 1 (Kiri)', nama: 'DIBUAT', subLabel: '', layar: true, cetak: true },
      { id: 'ttd_acc', defaultLabel: 'TTD 2 (Tengah Kiri)', nama: 'ACC', subLabel: '', layar: true, cetak: true },
      { id: 'ttd_mengetahui', defaultLabel: 'TTD 3 (Tengah Kanan)', nama: 'MENGETAHUI', subLabel: '', layar: true, cetak: true },
      { id: 'ttd_driver', defaultLabel: 'TTD 4 (Kanan)', nama: 'DRIVER', subLabel: '', layar: true, cetak: true }
    ],
    lain: {
      ukuranKertas: 'A4',
      orientasi: 'portrait',
      tampilkanGarisDotted: false,
      tampilkanBagianPenyelesaianService: false,
      jumlahBarisKosong: 10
    },
    infoPerusahaan: {
      cetakNamaPerusahaan: true,
      cetakAlamatPerusahaan: true,
      pakaiLogo: true,
      namaPerusahaan: 'PT ANUGRAH KEMASAN KREATIF',
      alamatPerusahaan: 'BANYUWANGI',
      customLogoDataUrl: null
    }
  },
  procurement: {
    formType: 'procurement',
    namaRancangan: 'FORMULIR PENGADAAN ARMADA',
    kepala: [
      { id: 'judul', defaultLabel: 'Judul', nama: 'FORM PERMINTAAN PENGADAAN BARANG DISTRIBUSI', layar: true, cetak: true },
      { id: 'nama_pemohon', defaultLabel: 'Nama Pemohon', nama: 'Nama', layar: true, cetak: true },
      { id: 'tanggal', defaultLabel: 'Tgl Permintaan', nama: 'Tanggal', layar: true, cetak: true },
      { id: 'nomor', defaultLabel: 'No. Dokumen RO', nama: 'Nomor', layar: true, cetak: true }
    ],
    kepalaTambahan: [
      { id: 'departemen', defaultLabel: 'Departemen', nama: 'Departemen', layar: false, cetak: false },
      { id: 'gudang', defaultLabel: 'Gudang Tujuan', nama: 'Gudang', layar: false, cetak: false },
      { id: 'no_so', defaultLabel: 'No. Referensi SO/PO', nama: 'No. Ref', layar: false, cetak: false },
      { id: 'prioritas', defaultLabel: 'Prioritas Pengadaan', nama: 'Urgensi', layar: false, cetak: false }
    ],
    detil: [
      { id: 'no', defaultLabel: 'No Urut', nama: 'NO', layar: true, cetak: true, urut: 1 },
      { id: 'nama_barang', defaultLabel: 'Deskripsi / Nama Barang', nama: 'NAMA BARANG', layar: true, cetak: true, urut: 2 },
      { id: 'di_tangan', defaultLabel: 'Stok Di Tangan', nama: 'DI TANGAN', layar: true, cetak: true, urut: 3 },
      { id: 'req_order', defaultLabel: 'Kuantitas Req Order', nama: 'REQ ORDER', layar: true, cetak: true, urut: 4 },
      { id: 'tgl_diperlukan', defaultLabel: 'Tanggal Diperlukan', nama: 'TANGGAL DIPERLUKAN', layar: true, cetak: true, urut: 5 },
      { id: 'untuk_keperluan', defaultLabel: 'Untuk Keperluan', nama: 'UNTUK KEPERLUAN', layar: true, cetak: true, urut: 6 },
      { id: 'satuan', defaultLabel: 'Satuan', nama: 'SATUAN', layar: false, cetak: false, urut: 7 },
      { id: 'estimasi_harga', defaultLabel: 'Harga Satuan', nama: 'HARGA', layar: false, cetak: false, urut: 8 }
    ],
    kaki: [
      { id: 'keterangan_kaki', defaultLabel: 'Baris Keterangan', nama: 'KETERANGAN :', subLabel: '', layar: true, cetak: true },
      { id: 'ttd_mengetahui', defaultLabel: 'TTD 1 (Mengetahui)', nama: 'Mengetahui', subLabel: 'HRGA', layar: true, cetak: true },
      { id: 'ttd_keuangan', defaultLabel: 'TTD 2 (Keuangan)', nama: 'Keuangan', subLabel: '', layar: true, cetak: true },
      { id: 'ttd_disetujui', defaultLabel: 'TTD 3 (Disetujui)', nama: 'Disetujui', subLabel: '', layar: true, cetak: true },
      { id: 'ttd_pemohon', defaultLabel: 'TTD 4 (Pemohon)', nama: 'Pemohon', subLabel: '', layar: true, cetak: true }
    ],
    lain: {
      ukuranKertas: 'A4',
      orientasi: 'portrait',
      tampilkanGarisDotted: true,
      tampilkanBagianPenyelesaianService: false,
      jumlahBarisKosong: 7
    },
    infoPerusahaan: {
      cetakNamaPerusahaan: false,
      cetakAlamatPerusahaan: false,
      pakaiLogo: true,
      namaPerusahaan: 'PT ANUGRAH KEMASAN KREATIF',
      alamatPerusahaan: 'BANYUWANGI',
      customLogoDataUrl: null
    }
  }
};

export function loadAllFleetFormTemplates(): Record<FleetFormType, FleetFormTemplateConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    return {
      service: { ...DEFAULT_TEMPLATES.service, ...(parsed.service || {}) },
      washing: { ...DEFAULT_TEMPLATES.washing, ...(parsed.washing || {}) },
      procurement: { ...DEFAULT_TEMPLATES.procurement, ...(parsed.procurement || {}) }
    };
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveFleetFormTemplate(formType: FleetFormType, config: FleetFormTemplateConfig) {
  const current = loadAllFleetFormTemplates();
  const updated = { ...current, [formType]: config };
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(updated));
}

export function loadFormPrintLogs(): FormPrintHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRINT_LOGS);
    if (!raw) {
      return [
        {
          id: 'log-1',
          formType: 'service',
          docType: 'Formulir Service Armada',
          nomorDokumen: '01/LOG-MTC/XI-2026',
          timestamp: '2026-11-05 09:15',
          userId: 'BayuN791',
          summary: 'Permohonan Service & Pemeliharaan Armada P 8848 U'
        },
        {
          id: 'log-2',
          formType: 'washing',
          docType: 'Formulir Cuci Armada',
          nomorDokumen: 'CUCI/LOG/XI-2026/01',
          timestamp: '2026-11-05 08:30',
          userId: 'BayuN791',
          summary: 'Form Kegiatan Driver & Pencucian Armada Rutin'
        },
        {
          id: 'log-3',
          formType: 'procurement',
          docType: 'Formulir Pengadaan Armada',
          nomorDokumen: '2/RO/LOG/XI-2026',
          timestamp: '2026-11-04 16:20',
          userId: 'BayuN791',
          summary: 'Permintaan Pengadaan Barang Distribusi & Suku Cadang'
        }
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function appendFormPrintLog(item: Omit<FormPrintHistoryItem, 'id' | 'timestamp'>): FormPrintHistoryItem[] {
  const existing = loadFormPrintLogs();
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const newItem: FormPrintHistoryItem = {
    ...item,
    id: `log-${Date.now()}`,
    timestamp
  };
  const updated = [newItem, ...existing];
  localStorage.setItem(STORAGE_KEY_PRINT_LOGS, JSON.stringify(updated));
  return updated;
}

/**
 * Official PT Anugrah Kemasan Kreatif Logo Component (Matches Image 4: /assets/aistudio/image_c8ea86e5.png)
 */
export const AkkCircularLogo: React.FC<{
  customLogoUrl?: string | null;
  size?: number;
}> = ({ customLogoUrl, size = 76 }) => {
  const src = customLogoUrl || DEFAULT_AKK_LOGO_PATH;
  return (
    <img
      src={src}
      alt="PT Anugrah Kemasan Kreatif"
      style={{ width: size, height: size }}
      className="object-contain shrink-0 select-none"
    />
  );
};

// ============================================================================
// 1. MODERN WEB UI/UX RANCANGAN FORMULIR MODAL
// ============================================================================
interface RancanganFormulirModalProps {
  isOpen: boolean;
  initialFormType: FleetFormType;
  onClose: () => void;
  onSaveTemplate: (formType: FleetFormType, config: FleetFormTemplateConfig) => void;
  onOpenVisualDesigner: (formType: FleetFormType, config: FleetFormTemplateConfig) => void;
}

export const RancanganFormulirModal: React.FC<RancanganFormulirModalProps> = ({
  isOpen,
  initialFormType,
  onClose,
  onSaveTemplate,
  onOpenVisualDesigner
}) => {
  const [selectedFormType, setSelectedFormType] = useState<FleetFormType>(initialFormType);
  const [activeTab, setActiveTab] = useState<'kepala' | 'kepala_tambahan' | 'detil' | 'kaki' | 'lain' | 'info_perusahaan'>('kepala');
  const [templatesMap, setTemplatesMap] = useState<Record<FleetFormType, FleetFormTemplateConfig>>(() =>
    loadAllFleetFormTemplates()
  );

  const importInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFormType(initialFormType);
      setTemplatesMap(loadAllFleetFormTemplates());
    }
  }, [isOpen, initialFormType]);

  if (!isOpen) return null;

  const currentConfig = templatesMap[selectedFormType];

  const updateCurrentConfig = (updater: (prev: FleetFormTemplateConfig) => FleetFormTemplateConfig) => {
    setTemplatesMap(prev => ({
      ...prev,
      [selectedFormType]: updater(prev[selectedFormType])
    }));
  };

  const handleSelectFormTypeDropdown = (newFormType: FleetFormType) => {
    setSelectedFormType(newFormType);
    const labelObj = FORM_TYPE_OPTIONS.find(o => o.value === newFormType);
    if (labelObj) {
      setTemplatesMap(prev => ({
        ...prev,
        [newFormType]: {
          ...prev[newFormType],
          namaRancangan: labelObj.label
        }
      }));
    }
  };

  const handleFieldChange = (
    section: 'kepala' | 'kepalaTambahan' | 'detil' | 'kaki',
    id: string,
    patch: Partial<TemplateFieldConfig>
  ) => {
    updateCurrentConfig(prev => ({
      ...prev,
      [section]: prev[section].map(item => (item.id === id ? { ...item, ...patch } : item))
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateCurrentConfig(prev => ({
        ...prev,
        infoPerusahaan: {
          ...prev.infoPerusahaan,
          pakaiLogo: true,
          customLogoDataUrl: reader.result as string
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleImportTemplateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed && parsed.namaRancangan && parsed.kepala && parsed.detil) {
          updateCurrentConfig(() => ({
            ...parsed,
            formType: selectedFormType
          }));
        }
      } catch {
        // Ignore invalid JSON file
      }
    };
    reader.readAsText(file);
  };

  const handleClickOk = () => {
    saveFleetFormTemplate(selectedFormType, currentConfig);
    onSaveTemplate(selectedFormType, currentConfig);
    onClose();
  };

  const handleResetDefault = () => {
    const def = DEFAULT_TEMPLATES[selectedFormType];
    updateCurrentConfig(() => JSON.parse(JSON.stringify(def)));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 select-none">
      {/* Modern Web Dark UI Container matching the application theme */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl text-slate-100 overflow-hidden flex flex-col">
        {/* Modern Header Bar (No form selector dropdown next to close button) */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  Rancangan Formulir
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold">
                  Konfigurasi Template
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sesuaikan visibilitas layar, cetak, urutan kolom, dan identitas perusahaan untuk masing-masing formulir armada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Body: Left Configuration + Right Modern Action Panel */}
        <div className="p-6 flex flex-col md:flex-row gap-6">
          {/* Left Panel: Nama Rancangan Dropdown + Modern Tabs */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Nama Rancangan as Dropdown List of Forms (Requirement #2) */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-bold text-slate-300 whitespace-nowrap sm:w-36 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Nama Rancangan:</span>
              </label>
              <div className="relative flex-1">
                <select
                  value={selectedFormType}
                  onChange={(e) => handleSelectFormTypeDropdown(e.target.value as FleetFormType)}
                  className="w-full appearance-none bg-slate-900 border border-slate-700 hover:border-amber-500/60 focus:border-amber-500 rounded-xl px-3.5 py-2.5 pr-9 text-xs font-black text-white tracking-wide focus:outline-none transition cursor-pointer shadow-inner"
                >
                  {FORM_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value} className="bg-slate-900 text-white font-bold">
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 6 Modern Segmented Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {[
                { id: 'kepala', label: 'Kepala' },
                { id: 'kepala_tambahan', label: 'Kepala Tambahan' },
                { id: 'detil', label: 'Detil' },
                { id: 'kaki', label: 'Kaki' },
                { id: 'lain', label: 'Lain' },
                { id: 'info_perusahaan', label: 'Info Perusahaan' }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content Container */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 min-h-[340px] max-h-[400px] overflow-y-auto">
              {/* TAB 1: KEPALA */}
              {activeTab === 'kepala' && (
                <div>
                  <div className="grid grid-cols-12 gap-3 pb-2.5 mb-2.5 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-4">Atribut Kepala</div>
                    <div className="col-span-1 text-center">Layar</div>
                    <div className="col-span-1 text-center">Cetak</div>
                    <div className="col-span-6">Nama Label</div>
                  </div>
                  <div className="space-y-2">
                    {currentConfig.kepala.map(field => (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 gap-3 items-center text-xs bg-slate-900/70 hover:bg-slate-900 border border-slate-800/70 rounded-xl px-3 py-2 transition"
                      >
                        <div className="col-span-4 text-slate-200 font-medium truncate">{field.defaultLabel}</div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.layar}
                            onChange={(e) => handleFieldChange('kepala', field.id, { layar: e.target.checked })}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.cetak}
                            onChange={(e) => handleFieldChange('kepala', field.id, { cetak: e.target.checked })}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            value={field.nama}
                            onChange={(e) => handleFieldChange('kepala', field.id, { nama: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: KEPALA TAMBAHAN */}
              {activeTab === 'kepala_tambahan' && (
                <div>
                  <div className="grid grid-cols-12 gap-3 pb-2.5 mb-2.5 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-4">Atribut Tambahan</div>
                    <div className="col-span-1 text-center">Layar</div>
                    <div className="col-span-1 text-center">Cetak</div>
                    <div className="col-span-6">Nama / Teks Label</div>
                  </div>
                  <div className="space-y-2">
                    {currentConfig.kepalaTambahan.map(field => (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 gap-3 items-center text-xs bg-slate-900/70 hover:bg-slate-900 border border-slate-800/70 rounded-xl px-3 py-2 transition"
                      >
                        <div className="col-span-4 text-slate-200 font-medium truncate">{field.defaultLabel}</div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.layar}
                            onChange={(e) =>
                              handleFieldChange('kepalaTambahan', field.id, { layar: e.target.checked })
                            }
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.cetak}
                            onChange={(e) =>
                              handleFieldChange('kepalaTambahan', field.id, { cetak: e.target.checked })
                            }
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            value={field.nama}
                            onChange={(e) =>
                              handleFieldChange('kepalaTambahan', field.id, { nama: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: DETIL */}
              {activeTab === 'detil' && (
                <div>
                  <div className="grid grid-cols-12 gap-3 pb-2.5 mb-2.5 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-4">Kolom / Bagian Detil</div>
                    <div className="col-span-1 text-center">Layar</div>
                    <div className="col-span-1 text-center">Cetak</div>
                    <div className="col-span-2 text-center">Urut</div>
                    <div className="col-span-4">Judul Kolom Cetak</div>
                  </div>
                  <div className="space-y-2">
                    {currentConfig.detil.map(field => (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 gap-3 items-center text-xs bg-slate-900/70 hover:bg-slate-900 border border-slate-800/70 rounded-xl px-3 py-2 transition"
                      >
                        <div className="col-span-4 text-slate-200 font-medium truncate">{field.defaultLabel}</div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.layar}
                            onChange={(e) => handleFieldChange('detil', field.id, { layar: e.target.checked })}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.cetak}
                            onChange={(e) => handleFieldChange('detil', field.id, { cetak: e.target.checked })}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <input
                            type="number"
                            value={field.urut ?? 0}
                            onChange={(e) =>
                              handleFieldChange('detil', field.id, { urut: parseInt(e.target.value || '0', 10) })
                            }
                            className="w-16 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-lg px-2 py-1 text-xs text-center font-mono text-amber-400 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={field.nama}
                            onChange={(e) => handleFieldChange('detil', field.id, { nama: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: KAKI */}
              {activeTab === 'kaki' && (
                <div>
                  <div className="grid grid-cols-12 gap-3 pb-2.5 mb-2.5 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-3">Bagian Kaki / TTD</div>
                    <div className="col-span-1 text-center">Layar</div>
                    <div className="col-span-1 text-center">Cetak</div>
                    <div className="col-span-4">Judul Baris / TTD</div>
                    <div className="col-span-3">Jabatan / Sub-Label</div>
                  </div>
                  <div className="space-y-2">
                    {currentConfig.kaki.map(field => (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 gap-3 items-center text-xs bg-slate-900/70 hover:bg-slate-900 border border-slate-800/70 rounded-xl px-3 py-2 transition"
                      >
                        <div className="col-span-3 text-slate-200 font-medium truncate">{field.defaultLabel}</div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.layar}
                            onChange={(e) => handleFieldChange('kaki', field.id, { layar: e.target.checked })}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <input
                            type="checkbox"
                            checked={field.cetak}
                            onChange={(e) => handleFieldChange('kaki', field.id, { cetak: e.target.checked })}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={field.nama}
                            onChange={(e) => handleFieldChange('kaki', field.id, { nama: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={field.subLabel || ''}
                            placeholder="(Opsional)"
                            onChange={(e) => handleFieldChange('kaki', field.id, { subLabel: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: LAIN */}
              {activeTab === 'lain' && (
                <div className="space-y-4 text-xs text-slate-200 p-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
                      <label className="block font-bold text-slate-300 mb-1.5">Ukuran Kertas Cetak</label>
                      <select
                        value={currentConfig.lain.ukuranKertas}
                        onChange={(e) =>
                          updateCurrentConfig(prev => ({
                            ...prev,
                            lain: { ...prev.lain, ukuranKertas: e.target.value as 'A4' | 'F4' | 'Letter' }
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="A4">A4 (210mm x 297mm)</option>
                        <option value="F4">F4 / Folio (215mm x 330mm)</option>
                        <option value="Letter">Letter (216mm x 279mm)</option>
                      </select>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
                      <label className="block font-bold text-slate-300 mb-1.5">Orientasi Halaman</label>
                      <select
                        value={currentConfig.lain.orientasi}
                        onChange={(e) =>
                          updateCurrentConfig(prev => ({
                            ...prev,
                            lain: { ...prev.lain, orientasi: e.target.value as 'portrait' | 'landscape' }
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="portrait">Portrait (Tegak)</option>
                        <option value="landscape">Landscape (Mendatar)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentConfig.lain.tampilkanGarisDotted}
                        onChange={(e) =>
                          updateCurrentConfig(prev => ({
                            ...prev,
                            lain: { ...prev.lain, tampilkanGarisDotted: e.target.checked }
                          }))
                        }
                        className="w-4 h-4 rounded accent-amber-500"
                      />
                      <span className="text-slate-200">
                        Gunakan garis pemisah baris titik-titik (Dotted Row Line) pada tabel detil
                      </span>
                    </label>

                    {selectedFormType === 'service' && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentConfig.lain.tampilkanBagianPenyelesaianService}
                          onChange={(e) =>
                            updateCurrentConfig(prev => ({
                              ...prev,
                              lain: { ...prev.lain, tampilkanBagianPenyelesaianService: e.target.checked }
                            }))
                          }
                          className="w-4 h-4 rounded accent-amber-500"
                        />
                        <span className="text-slate-200">
                          Tampilkan Bagian Kedua (Realisasi Penyelesaian Service &amp; Rincian Pemakaian Barang)
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: INFO PERUSAHAAN */}
              {activeTab === 'info_perusahaan' && (
                <div className="space-y-4 text-xs text-slate-200 p-1">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    <div className="sm:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-semibold text-slate-200">Cetak Nama Perusahaan</span>
                        <input
                          type="checkbox"
                          checked={currentConfig.infoPerusahaan.cetakNamaPerusahaan}
                          onChange={(e) =>
                            updateCurrentConfig(prev => ({
                              ...prev,
                              infoPerusahaan: {
                                ...prev.infoPerusahaan,
                                cetakNamaPerusahaan: e.target.checked
                              }
                            }))
                          }
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-semibold text-slate-200">Cetak Alamat Perusahaan</span>
                        <input
                          type="checkbox"
                          checked={currentConfig.infoPerusahaan.cetakAlamatPerusahaan}
                          onChange={(e) =>
                            updateCurrentConfig(prev => ({
                              ...prev,
                              infoPerusahaan: {
                                ...prev.infoPerusahaan,
                                cetakAlamatPerusahaan: e.target.checked
                              }
                            }))
                          }
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-semibold text-slate-200">Pakai Logo Perusahaan</span>
                        <input
                          type="checkbox"
                          checked={currentConfig.infoPerusahaan.pakaiLogo}
                          onChange={(e) =>
                            updateCurrentConfig(prev => ({
                              ...prev,
                              infoPerusahaan: {
                                ...prev.infoPerusahaan,
                                pakaiLogo: e.target.checked
                              }
                            }))
                          }
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        />
                      </label>

                      <div className="pt-2 border-t border-slate-800 space-y-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">
                            Nama Perusahaan:
                          </label>
                          <input
                            type="text"
                            value={currentConfig.infoPerusahaan.namaPerusahaan}
                            onChange={(e) =>
                              updateCurrentConfig(prev => ({
                                ...prev,
                                infoPerusahaan: {
                                  ...prev.infoPerusahaan,
                                  namaPerusahaan: e.target.value
                                }
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">
                            Kota / Alamat Perusahaan:
                          </label>
                          <input
                            type="text"
                            value={currentConfig.infoPerusahaan.alamatPerusahaan}
                            onChange={(e) =>
                              updateCurrentConfig(prev => ({
                                ...prev,
                                infoPerusahaan: {
                                  ...prev.infoPerusahaan,
                                  alamatPerusahaan: e.target.value
                                }
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Official Logo Preview & Upload Card */}
                    <div className="sm:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-between text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Logo Resmi Perusahaan
                      </span>
                      <div className="my-3 p-3 bg-white rounded-2xl shadow-md border border-slate-200 flex items-center justify-center">
                        <AkkCircularLogo
                          customLogoUrl={currentConfig.infoPerusahaan.customLogoDataUrl}
                          size={84}
                        />
                      </div>

                      <div className="w-full space-y-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs transition cursor-pointer"
                        >
                          Ambil Logo Baru
                        </button>
                        {currentConfig.infoPerusahaan.customLogoDataUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              updateCurrentConfig(prev => ({
                                ...prev,
                                infoPerusahaan: { ...prev.infoPerusahaan, customLogoDataUrl: null }
                              }))
                            }
                            className="w-full py-1.5 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[11px] transition cursor-pointer"
                          >
                            Gunakan Logo Standar PT AKK
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Column: Modern Web Buttons (Desain, Impor, Reset Standar, OK, Batal — No Desain sbg FRF) */}
          <div className="w-full md:w-52 flex flex-col justify-between bg-slate-950/60 border border-slate-800 rounded-2xl p-4 gap-4">
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                Tindakan Template
              </div>

              <button
                type="button"
                onClick={() => {
                  saveFleetFormTemplate(selectedFormType, currentConfig);
                  onSaveTemplate(selectedFormType, currentConfig);
                  onOpenVisualDesigner(selectedFormType, currentConfig);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Layout className="w-4 h-4 text-indigo-400" />
                <span>Desain</span>
              </button>

              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImportTemplateFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Impor</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefault}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                title="Kembalikan ke pengaturan standar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Standar</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleClickOk}
                className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>OK</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Batal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. MODERN WEB UI/UX VISUAL DESIGNER MODAL (Replaces Legacy Gray Window)
// ============================================================================
interface VisualReportDesignerModalProps {
  isOpen: boolean;
  formType: FleetFormType;
  config: FleetFormTemplateConfig;
  onClose: () => void;
  onUpdateConfig: (config: FleetFormTemplateConfig) => void;
  onOpenLiveForm: (formType: FleetFormType) => void;
  onOpenRancangan: (formType: FleetFormType) => void;
}

export const VisualReportDesignerModal: React.FC<VisualReportDesignerModalProps> = ({
  isOpen,
  formType,
  config,
  onClose,
  onUpdateConfig,
  onOpenLiveForm,
  onOpenRancangan
}) => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>('judul');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState('10');

  if (!isOpen) return null;

  const activeKepala = config.kepala.filter(f => f.cetak || f.layar);
  const activeDetil = [...config.detil]
    .filter(f => f.cetak || f.layar)
    .sort((a, b) => (a.urut ?? 0) - (b.urut ?? 0));
  const activeKaki = config.kaki.filter(f => f.cetak || f.layar);

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col text-slate-100 shadow-2xl overflow-hidden">
        {/* Modern Dark Web Header Bar */}
        <div className="bg-slate-950 border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layout className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white tracking-wide">
                  Visual Designer — {config.namaRancangan}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  Live Canvas
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pratinjau tata letak komponen formulir secara langsung sesuai pengaturan Rancangan Formulir.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRancangan(formType);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Ubah Rancangan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                saveFleetFormTemplate(formType, config);
                onUpdateConfig(config);
                onOpenLiveForm(formType);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Isi &amp; Cetak Formulir Ini</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer"
              title="Tutup Designer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modern Web Formatting Toolbar */}
        <div className="bg-slate-900/95 border-b border-slate-800 px-5 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold">Font:</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="Arial">Arial</option>
              <option value="Inter">Inter</option>
              <option value="Tahoma">Tahoma</option>
              <option value="Courier New">Courier New</option>
            </select>

            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono focus:border-amber-500 focus:outline-none"
            >
              <option value="8">8 pt</option>
              <option value="9">9 pt</option>
              <option value="10">10 pt</option>
              <option value="11">11 pt</option>
              <option value="12">12 pt</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition cursor-pointer">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition cursor-pointer">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition cursor-pointer">
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition cursor-pointer">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition cursor-pointer">
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition cursor-pointer">
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-[11px]">
              Halaman 1 • {config.lain.ukuranKertas} ({config.lain.orientasi.toUpperCase()})
            </span>
          </div>
        </div>

        {/* Main Workspace: Modern Left Tool Strip + Dotted Paper Canvas */}
        <div className="flex-1 flex min-h-0 bg-slate-950/90 overflow-hidden">
          {/* Left Modern Vertical Tool Strip */}
          <div className="w-14 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-3 shrink-0">
            <div
              className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xs font-bold shadow-xs"
              title="Pilih Elemen"
            >
              ↖
            </div>
            <div
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center text-[11px] font-mono"
              title="Blok Teks"
            >
              [ab]
            </div>
            <div
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center"
              title="Pengaturan Seksi"
            >
              <Sliders className="w-4 h-4" />
            </div>
            <div
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center"
              title="Logo Perusahaan"
            >
              <ImageIcon className="w-4 h-4" />
            </div>
            <div
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center"
              title="Tabel Detil"
            >
              <Grid className="w-4 h-4" />
            </div>
          </div>

          {/* Scrollable Dark Canvas Container with Dotted White Paper */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
            <div
              style={{
                fontFamily,
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '14px 14px'
              }}
              className="w-full max-w-[820px] min-h-[760px] bg-white rounded-xl shadow-2xl border border-slate-300 p-6 text-black space-y-3.5 relative"
            >
              {/* Modern Section Band Badge: PageHeader */}
              <div className="bg-slate-900 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold flex items-center justify-between shadow-xs">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>SEGMEN KEPALA FORMULIR — {config.namaRancangan}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-300">Pratinjau Komponen Desain</span>
              </div>

              {/* DESIGNER PREVIEW FOR SERVICE ARMADA (Image 9 structure) */}
              {formType === 'service' && (
                <div className="space-y-2.5 text-xs">
                  <div
                    onClick={() => setSelectedElementId('judul')}
                    className={`border border-black bg-white p-2 rounded text-center font-bold cursor-pointer ${
                      selectedElementId === 'judul' ? 'ring-2 ring-indigo-600' : ''
                    }`}
                  >
                    [{config.kepala.find(k => k.id === 'judul')?.nama || 'PERMOHONAN SERVICE DAN PEMELIHARAAN'}]
                  </div>

                  <div className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-6 border border-black bg-white p-2.5 space-y-1">
                      <div className="flex justify-between border-b border-dotted border-slate-400 pb-0.5">
                        <span className="font-semibold">{config.kepala.find(k => k.id === 'kepada_yth')?.nama} :</span>
                        <span className="font-mono">[HRGA]</span>
                      </div>
                      <div className="flex justify-between border-b border-dotted border-slate-400 pb-0.5">
                        <span className="font-semibold">{config.kepala.find(k => k.id === 'dari_depart')?.nama} :</span>
                        <span className="font-mono">[LOGISTIK]</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">{config.kepala.find(k => k.id === 'bagian')?.nama} :</span>
                        <span className="font-mono">[Bagian]</span>
                      </div>
                    </div>

                    <div className="col-span-6 p-1 space-y-1.5">
                      <div className="border border-black bg-white px-2.5 py-1 flex justify-between">
                        <span className="font-semibold">{config.kepala.find(k => k.id === 'tanggal')?.nama} :</span>
                        <span className="font-mono">[Tgl. Service]</span>
                      </div>
                      <div className="border border-black bg-white px-2.5 py-1 flex justify-between">
                        <span className="font-semibold">{config.kepala.find(k => k.id === 'nomor')?.nama} :</span>
                        <span className="font-mono">[01/LOG-MTC/....-20...]</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-black bg-white p-2.5 space-y-1.5">
                    <div className="font-bold underline">
                      [{config.detil.find(d => d.id === 'kerusakan')?.nama || 'KERUSAKAN'}]
                    </div>
                    {[1, 2, 3, 4].map(line => (
                      <div key={line} className="border-b border-black h-4 text-[10px] text-slate-500 font-mono">
                        [Baris_Kerusakan_{line}]
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <div className="w-3/4 grid grid-cols-3 border border-black bg-white text-center">
                      {config.kaki.slice(0, 3).map(sig => (
                        <div key={sig.id} className="border-r last:border-r-0 border-black p-1.5">
                          <div className="font-semibold border-b border-black pb-0.5">{sig.nama}</div>
                          <div className="h-9 flex items-center justify-center text-[10px] text-slate-400 font-mono">[TTD]</div>
                          <div className="text-[10px]">( ................ )</div>
                          <div className="font-bold text-[10px] border-t border-black pt-0.5">{sig.subLabel}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-lg px-3 py-1 text-[10px] font-bold">
                    SEGMEN PENYELESAIAN PERBAIKAN &amp; RINCIAN PEMAKAIAN BARANG
                  </div>

                  <div className="border border-black bg-white p-2 space-y-1">
                    <div className="font-semibold">
                      [{config.kepalaTambahan.find(k => k.id === 'tgl_selesai')?.nama} : ....................]
                    </div>
                    <div className="text-[11px] italic text-slate-700">
                      {config.kepalaTambahan.find(k => k.id === 'pernyataan_1')?.nama}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 border border-black bg-white text-center font-bold text-[11px]">
                    <div className="border-r border-black p-1">[{config.detil.find(d => d.id === 'jenis_aktiva')?.nama}]</div>
                    <div className="border-r border-black p-1">[{config.detil.find(d => d.id === 'no_aktiva')?.nama}]</div>
                    <div className="border-r border-black p-1">[{config.detil.find(d => d.id === 'departemen_aktiva')?.nama}]</div>
                    <div className="p-1">[{config.detil.find(d => d.id === 'bagian_aktiva')?.nama}]</div>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-8 border border-black bg-white">
                      <div className="grid grid-cols-12 border-b border-black font-bold text-center text-[11px]">
                        <div className="col-span-8 border-r border-black p-1">
                          [{config.detil.find(d => d.id === 'nama_barang')?.nama}]
                        </div>
                        <div className="col-span-4 p-1">
                          [{config.detil.find(d => d.id === 'jumlah_barang')?.nama}]
                        </div>
                      </div>
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className="grid grid-cols-12 border-b last:border-b-0 border-black text-[10px] font-mono">
                          <div className="col-span-8 border-r border-black px-2 py-0.5">{n}. [Nama_Barang_{n}]</div>
                          <div className="col-span-4 px-2 py-0.5 text-center">[Qty_{n}]</div>
                        </div>
                      ))}
                    </div>
                    <div className="col-span-4 border border-black bg-white flex flex-col justify-between text-center text-[11px]">
                      {config.kaki.slice(3, 5).map(sig => (
                        <div key={sig.id} className="border-b last:border-b-0 border-black p-1.5">
                          <div className="font-semibold border-b border-black pb-0.5">{sig.nama}</div>
                          <div className="h-7 flex items-center justify-center text-[10px] text-slate-400 font-mono">[TTD]</div>
                          <div className="text-[10px]">( ................ )</div>
                          <div className="font-bold text-[10px]">{sig.subLabel}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* DESIGNER PREVIEW FOR CUCI ARMADA (Image 10 structure) */}
              {formType === 'washing' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-12 gap-2 items-center border border-black bg-white p-3">
                    <div className="col-span-2 flex justify-center">
                      {config.infoPerusahaan.pakaiLogo && (
                        <AkkCircularLogo customLogoUrl={config.infoPerusahaan.customLogoDataUrl} size={64} />
                      )}
                    </div>
                    <div className="col-span-5 text-center font-bold">
                      <div className="border border-dotted border-slate-400 p-1">[{config.infoPerusahaan.namaPerusahaan}]</div>
                      <div className="border border-dotted border-slate-400 p-1 mt-1">[{config.infoPerusahaan.alamatPerusahaan}]</div>
                    </div>
                    <div className="col-span-5 text-right space-y-1">
                      <div className="border border-black px-2 py-0.5 font-bold">[{config.kepala.find(k => k.id === 'kepada')?.nama}]</div>
                      <div className="border border-black px-2 py-0.5 font-bold">[{config.kepala.find(k => k.id === 'di_tempat')?.nama}]</div>
                      <div className="border border-black px-2 py-1 font-black text-sm">[{config.kepala.find(k => k.id === 'judul')?.nama}]</div>
                    </div>
                  </div>

                  <div className="border border-black bg-white py-1.5 text-center font-bold">
                    [{config.kepala.find(k => k.id === 'tanggal')?.nama} ........................]
                  </div>

                  <div className="bg-slate-900 text-white rounded-lg px-3 py-1 text-[10px] font-bold">
                    SEGMEN TABEL DETIL KEGIATAN / PENCUCIAN ARMADA
                  </div>

                  <div className="border border-black bg-white">
                    <div
                      className="grid border-b border-black font-bold text-center bg-slate-50"
                      style={{ gridTemplateColumns: `repeat(${activeDetil.length}, minmax(0, 1fr))` }}
                    >
                      {activeDetil.map(col => (
                        <div key={col.id} className="border-r last:border-r-0 border-black p-1.5">
                          [{col.nama}]
                        </div>
                      ))}
                    </div>
                    {[1, 2, 3, 4, 5, 6].map(row => (
                      <div
                        key={row}
                        className="grid border-b last:border-b-0 border-black text-center font-mono text-[11px] text-slate-600"
                        style={{ gridTemplateColumns: `repeat(${activeDetil.length}, minmax(0, 1fr))` }}
                      >
                        {activeDetil.map(col => (
                          <div key={col.id} className="border-r last:border-r-0 border-black p-1.5">
                            [{col.id}_{row}]
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-900 text-white rounded-lg px-3 py-1 text-[10px] font-bold">
                    SEGMEN KAKI &amp; PENGESAHAN TANDA TANGAN
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-1">
                    {activeKaki.map(sig => (
                      <div key={sig.id} className="border border-black bg-white p-2 text-center">
                        <div className="font-bold">[{sig.nama}]</div>
                        <div className="h-12 flex items-center justify-center text-[10px] text-slate-400 font-mono">[TTD]</div>
                        <div>( .................... )</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DESIGNER PREVIEW FOR PENGADAAN ARMADA (Image 11 structure) */}
              {formType === 'procurement' && (
                <div className="space-y-3 text-xs">
                  <div className="border border-black bg-white p-2 text-center font-bold text-sm">
                    [{config.kepala.find(k => k.id === 'judul')?.nama}]
                  </div>

                  <div className="grid grid-cols-12 gap-3 items-center border border-black bg-white p-3">
                    <div className="col-span-3 flex justify-center">
                      {config.infoPerusahaan.pakaiLogo && (
                        <AkkCircularLogo customLogoUrl={config.infoPerusahaan.customLogoDataUrl} size={68} />
                      )}
                    </div>
                    <div className="col-span-4" />
                    <div className="col-span-5 space-y-1">
                      {activeKepala
                        .filter(k => k.id !== 'judul')
                        .map(k => (
                          <div key={k.id} className="border border-black px-2 py-0.5 flex justify-between">
                            <span className="font-semibold">{k.nama} :</span>
                            <span className="font-mono">[{k.id}]</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-lg px-3 py-1 text-[10px] font-bold">
                    SEGMEN TABEL PERMINTAAN PENGADAAN BARANG DISTRIBUSI (BARIS 1 - 7)
                  </div>

                  <div className="border border-black bg-white">
                    <div
                      className="grid border-b border-black font-bold text-center bg-slate-50 text-[11px]"
                      style={{ gridTemplateColumns: `repeat(${activeDetil.length}, minmax(0, 1fr))` }}
                    >
                      {activeDetil.map(col => (
                        <div key={col.id} className="border-r last:border-r-0 border-black p-1.5">
                          [{col.nama}]
                        </div>
                      ))}
                    </div>
                    {[1, 2, 3, 4, 5, 6, 7].map(row => (
                      <div
                        key={row}
                        className="grid border-b last:border-b-0 border-dotted border-black text-center font-mono text-[11px] text-slate-600"
                        style={{ gridTemplateColumns: `repeat(${activeDetil.length}, minmax(0, 1fr))` }}
                      >
                        {activeDetil.map(col => (
                          <div key={col.id} className="border-r last:border-r-0 border-black p-1">
                            {col.id === 'no' ? row : `[${col.id}_${row}]`}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="border border-black bg-white p-2 space-y-1">
                    <div className="font-bold">
                      [{config.kaki.find(k => k.id === 'keterangan_kaki')?.nama || 'KETERANGAN :'}]
                    </div>
                    {[1, 2, 3].map(n => (
                      <div key={n} className="border-b border-black h-4 text-[10px] font-mono text-slate-400">
                        [Baris_Keterangan_{n}]
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-1">
                    {activeKaki
                      .filter(k => k.id !== 'keterangan_kaki')
                      .map(sig => (
                        <div key={sig.id} className="border border-black bg-white p-2 text-center">
                          <div className="font-bold">[{sig.nama}]</div>
                          <div className="h-11 flex items-center justify-center text-[10px] text-slate-400 font-mono">[TTD]</div>
                          <div>(____________________)</div>
                          {sig.subLabel && <div className="font-bold text-[11px] mt-0.5">{sig.subLabel}</div>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modern Footer Status Bar */}
        <div className="bg-slate-950 border-t border-slate-800 px-5 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <span>
            Rancangan Aktif: <strong className="text-white">{config.namaRancangan}</strong> • Ukuran Kertas: {config.lain.ukuranKertas} ({config.lain.orientasi})
          </span>
          <span className="text-amber-400 font-semibold">PT Anugrah Kemasan Kreatif — Banyuwangi</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. INTERACTIVE FORM FILL & EXACT PAPER TEMPLATES (Matches Images 9, 10, 11)
// ============================================================================
interface FleetFormInteractiveModalProps {
  isOpen: boolean;
  formType: FleetFormType | null;
  templateConfig: FleetFormTemplateConfig | null;
  onClose: () => void;
  onOpenRancanganSetup: (formType: FleetFormType) => void;
  onOpenVisualDesigner: (formType: FleetFormType) => void;
  onRecordPrintLog: (log: Omit<FormPrintHistoryItem, 'id' | 'timestamp'>) => void;
}

export const FleetFormInteractiveModal: React.FC<FleetFormInteractiveModalProps> = ({
  isOpen,
  formType,
  templateConfig,
  onClose,
  onOpenRancanganSetup,
  onOpenVisualDesigner,
  onRecordPrintLog
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printAreaRef
  });

  const [previewMode, setPreviewMode] = useState<'screen' | 'print'>('screen');

  // --- STATE FOR FORM 1: SERVICE ARMADA (Image 9) ---
  const [serviceState, setServiceState] = useState({
    kepadaYth: 'HRGA',
    dariDepart: 'LOGISTIK',
    bagian: 'ARMADA DISTRIBUSI',
    tanggal: '05/11/2026',
    nomor: '01/LOG-MTC/XI-2026',
    kerusakanLines: [
      'Pengecekan sistem pengereman & kampas rem armada P 8848 U',
      'Penggantian oli mesin berkala & filter solar',
      '',
      '',
      ''
    ],
    ttdVendor: '',
    ttdSpvFinance: '',
    ttdSpvDepartemen: '',
    tanggalSelesai: '05/11/2026',
    aktivaRows: [
      {
        jenisAktiva: 'Truk Box Mitsubishi Canter',
        nomorAktiva: 'AKT-ARM-P8848U',
        departemen: 'LOGISTIK',
        bagian: 'DISTRIBUSI'
      }
    ],
    perbaikanLines: [
      'Telah dilakukan penggantian kampas rem depan & belakang serta servis berkala',
      'Kondisi armada siap beroperasi kembali dengan normal',
      '',
      ''
    ],
    pemakaianBarang: [
      { no: 1, namaBarang: 'Kampas Rem Canter Original', jumlah: '1 Set' },
      { no: 2, namaBarang: 'Oli Mesin Meditran SX 15W-40', jumlah: '10 Ltr' },
      { no: 3, namaBarang: 'Filter Solar Mitsubishi', jumlah: '1 Pcs' },
      { no: 4, namaBarang: '', jumlah: '' },
      { no: 5, namaBarang: '', jumlah: '' },
      { no: 6, namaBarang: '', jumlah: '' },
      { no: 7, namaBarang: '', jumlah: '' }
    ],
    ttdHrga: '',
    ttdMgrSpv: ''
  });

  // --- STATE FOR FORM 2: CUCI ARMADA (Image 10) ---
  const [washingState, setWashingState] = useState({
    kepada: 'KEPADA : PRODUKSI',
    diTempat: 'DI TEMPAT',
    tanggal: '05/11/2026',
    rows: [
      { namaDriver: 'SLAMET RIYADI', no: '1', keterangan: 'Cuci Eksterior & Box Dalam Armada P 8848 U', mulai: '07:30', selesai: '08:15' },
      { namaDriver: 'AGUS SANTOSO', no: '2', keterangan: 'Cuci Sasis & Kabin Armada P 9102 UV', mulai: '08:20', selesai: '09:05' },
      { namaDriver: 'HENDRA WIJAYA', no: '3', keterangan: 'Cuci Armada & Semprot Disinfektan Box P 8014 KL', mulai: '09:15', selesai: '10:00' },
      { namaDriver: '', no: '4', keterangan: '', mulai: '', selesai: '' },
      { namaDriver: '', no: '5', keterangan: '', mulai: '', selesai: '' },
      { namaDriver: '', no: '6', keterangan: '', mulai: '', selesai: '' },
      { namaDriver: '', no: '7', keterangan: '', mulai: '', selesai: '' },
      { namaDriver: '', no: '8', keterangan: '', mulai: '', selesai: '' },
      { namaDriver: '', no: '9', keterangan: '', mulai: '', selesai: '' },
      { namaDriver: '', no: '10', keterangan: '', mulai: '', selesai: '' }
    ],
    ttdDibuat: '',
    ttdAcc: '',
    ttdMengetahui: '',
    ttdDriver: ''
  });

  // --- STATE FOR FORM 3: PENGADAAN ARMADA (Image 11) ---
  const [procurementState, setProcurementState] = useState({
    nama: 'DIVISI LOGISTIK & ARMADA',
    tanggal: '05/11/2026',
    nomor: '2/RO/LOG/XI-2026',
    rows: [
      { no: 1, namaBarang: 'Ban Luar Truk Bridgestone 7.50-16', diTangan: '0', reqOrder: '4 Pcs', tglDiperlukan: '07/11/2026', untukKeperluan: 'Armada P 8848 U' },
      { no: 2, namaBarang: 'Aki Yuasa N70Z 12V 75Ah', diTangan: '1', reqOrder: '2 Unit', tglDiperlukan: '07/11/2026', untukKeperluan: 'Cadangan Armada Distribusi' },
      { no: 3, namaBarang: 'Sabuk Pengikat Muatan (Ratchet Tie Down)', diTangan: '2', reqOrder: '6 Set', tglDiperlukan: '08/11/2026', untukKeperluan: 'Pengaman Muatan Ram 1 - 3' },
      { no: 4, namaBarang: '', diTangan: '', reqOrder: '', tglDiperlukan: '', untukKeperluan: '' },
      { no: 5, namaBarang: '', diTangan: '', reqOrder: '', tglDiperlukan: '', untukKeperluan: '' },
      { no: 6, namaBarang: '', diTangan: '', reqOrder: '', tglDiperlukan: '', untukKeperluan: '' },
      { no: 7, namaBarang: '', diTangan: '', reqOrder: '', tglDiperlukan: '', untukKeperluan: '' }
    ],
    keteranganLines: [
      'Pengadaan suku cadang prioritas untuk menjaga kesiapan operasional armada distribusi.',
      '',
      '',
      ''
    ],
    ttdMengetahui: '',
    ttdKeuangan: '',
    ttdDisetujui: '',
    ttdPemohon: ''
  });

  if (!isOpen || !formType || !templateConfig) return null;

  const isFieldVisible = (section: 'kepala' | 'kepalaTambahan' | 'detil' | 'kaki', id: string) => {
    const found = templateConfig[section].find(item => item.id === id);
    if (!found) return true;
    return previewMode === 'print' ? found.cetak : found.layar;
  };

  const getFieldLabel = (section: 'kepala' | 'kepalaTambahan' | 'detil' | 'kaki', id: string, fallback: string) => {
    const found = templateConfig[section].find(item => item.id === id);
    return found ? found.nama : fallback;
  };

  const getFieldSubLabel = (section: 'kaki', id: string, fallback: string) => {
    const found = templateConfig[section].find(item => item.id === id);
    return found && found.subLabel !== undefined ? found.subLabel : fallback;
  };

  const handleSaveAndPrint = () => {
    const docNum =
      formType === 'service'
        ? serviceState.nomor
        : formType === 'washing'
        ? `CUCI/${washingState.tanggal}`
        : procurementState.nomor;

    const summary =
      formType === 'service'
        ? serviceState.kerusakanLines.find(Boolean) || 'Permohonan Service Armada'
        : formType === 'washing'
        ? `Kegiatan Cuci Armada (${washingState.rows.filter(r => r.namaDriver).length} Driver)`
        : `Permintaan Pengadaan (${procurementState.rows.filter(r => r.namaBarang).length} Item)`;

    onRecordPrintLog({
      formType,
      docType: templateConfig.namaRancangan,
      nomorDokumen: docNum,
      userId: 'BayuN791',
      summary
    });

    try {
      handlePrint();
    } catch {
      // Fallback if print dialog blocked in iframe
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: templateConfig.lain.orientasi,
      unit: 'mm',
      format: templateConfig.lain.ukuranKertas.toLowerCase() === 'letter' ? 'letter' : 'a4'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(templateConfig.namaRancangan, 105, 16, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${templateConfig.infoPerusahaan.namaPerusahaan} - ${templateConfig.infoPerusahaan.alamatPerusahaan}`, 105, 22, { align: 'center' });

    if (formType === 'service') {
      doc.text(`Kepada Yth: ${serviceState.kepadaYth} | Dari: ${serviceState.dariDepart} (${serviceState.bagian})`, 14, 32);
      doc.text(`Tanggal: ${serviceState.tanggal} | Nomor: ${serviceState.nomor}`, 14, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('KERUSAKAN:', 14, 46);
      doc.setFont('helvetica', 'normal');
      serviceState.kerusakanLines.forEach((line, idx) => {
        doc.text(`${idx + 1}. ${line || '-'}`, 16, 52 + idx * 6);
      });
      doc.setFont('helvetica', 'bold');
      doc.text(`Tanggal Selesai Dikerjakan: ${serviceState.tanggalSelesai}`, 14, 90);
      doc.text('Rincian Pemakaian Barang:', 14, 98);
      doc.setFont('helvetica', 'normal');
      serviceState.pemakaianBarang.forEach((item, idx) => {
        doc.text(`${item.no}. ${item.namaBarang || '-'}   (${item.jumlah || '-'})`, 16, 104 + idx * 6);
      });
    } else if (formType === 'washing') {
      doc.text(`${washingState.kepada} - ${washingState.diTempat} | Tanggal: ${washingState.tanggal}`, 14, 32);
      washingState.rows.filter(r => r.namaDriver || r.keterangan).forEach((row, idx) => {
        doc.text(`${row.no}. ${row.namaDriver} | ${row.keterangan} (${row.mulai} - ${row.selesai})`, 14, 42 + idx * 7);
      });
    } else {
      doc.text(`Nama: ${procurementState.nama} | Tanggal: ${procurementState.tanggal} | Nomor: ${procurementState.nomor}`, 14, 32);
      procurementState.rows.filter(r => r.namaBarang).forEach((row, idx) => {
        doc.text(
          `${row.no}. ${row.namaBarang} | Di Tangan: ${row.diTangan} | Req: ${row.reqOrder} | Tgl: ${row.tglDiperlukan} | ${row.untukKeperluan}`,
          14,
          42 + idx * 7
        );
      });
    }

    doc.save(`${templateConfig.namaRancangan.replace(/\s+/g, '_')}.pdf`);
  };

  const sortedWashingCols = [...templateConfig.detil]
    .filter(c => (previewMode === 'print' ? c.cetak : c.layar))
    .sort((a, b) => (a.urut ?? 0) - (b.urut ?? 0));

  const sortedProcurementCols = [...templateConfig.detil]
    .filter(c => (previewMode === 'print' ? c.cetak : c.layar))
    .sort((a, b) => (a.urut ?? 0) - (b.urut ?? 0));

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top Action Bar */}
        <div className="bg-slate-950 border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>{templateConfig.namaRancangan}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                  Template Resmi PT AKK
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Klik langsung pada baris/kolom di lembar formulir untuk mengisi data, atau sesuaikan di Rancangan Formulir.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Layar vs Cetak */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode('screen')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  previewMode === 'screen' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mode Layar
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('print')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  previewMode === 'print' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mode Cetak
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenRancanganSetup(formType)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Rancangan Formulir</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenVisualDesigner(formType)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Desain</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Paper Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/60 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-[840px] bg-white text-black rounded-xl shadow-2xl border border-slate-300 p-6 sm:p-8 font-sans print:shadow-none print:border-none"
          >
            {/* =====================================================================
                TEMPLATE 1: FORMULIR SERVICE ARMADA (Exact match to Image 9)
               ===================================================================== */}
            {formType === 'service' && (
              <div className="text-black text-[12px] leading-snug space-y-3">
                {(templateConfig.infoPerusahaan.pakaiLogo ||
                  templateConfig.infoPerusahaan.cetakNamaPerusahaan ||
                  templateConfig.infoPerusahaan.cetakAlamatPerusahaan) && (
                  <div className="flex items-center gap-4 pb-2 border-b border-black">
                    {templateConfig.infoPerusahaan.pakaiLogo && (
                      <AkkCircularLogo customLogoUrl={templateConfig.infoPerusahaan.customLogoDataUrl} size={64} />
                    )}
                    <div>
                      {templateConfig.infoPerusahaan.cetakNamaPerusahaan && (
                        <div className="font-bold text-sm">{templateConfig.infoPerusahaan.namaPerusahaan}</div>
                      )}
                      {templateConfig.infoPerusahaan.cetakAlamatPerusahaan && (
                        <div className="text-xs font-semibold">{templateConfig.infoPerusahaan.alamatPerusahaan}</div>
                      )}
                    </div>
                  </div>
                )}

                {isFieldVisible('kepala', 'judul') && (
                  <h1 className="text-center font-bold text-[15px] tracking-wide uppercase py-1">
                    {getFieldLabel('kepala', 'judul', 'PERMOHONAN SERVICE DAN PEMELIHARAAN')}
                  </h1>
                )}

                <div className="grid grid-cols-12 gap-4 items-start pt-1">
                  <div className="col-span-6 border border-black p-2.5 space-y-1.5">
                    {isFieldVisible('kepala', 'kepada_yth') && (
                      <div className="flex items-center">
                        <span className="w-28 font-semibold">{getFieldLabel('kepala', 'kepada_yth', 'Kepada Yth')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={serviceState.kepadaYth}
                          onChange={(e) => setServiceState({ ...serviceState, kepadaYth: e.target.value })}
                          className="flex-1 font-bold text-black bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none"
                        />
                      </div>
                    )}
                    {isFieldVisible('kepala', 'dari_depart') && (
                      <div className="flex items-center">
                        <span className="w-28 font-semibold">{getFieldLabel('kepala', 'dari_depart', 'Dari Depart')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={serviceState.dariDepart}
                          onChange={(e) => setServiceState({ ...serviceState, dariDepart: e.target.value })}
                          className="flex-1 font-bold text-black bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none"
                        />
                      </div>
                    )}
                    {isFieldVisible('kepala', 'bagian') && (
                      <div className="flex items-center">
                        <span className="w-28 font-semibold">{getFieldLabel('kepala', 'bagian', 'Bagian')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={serviceState.bagian}
                          onChange={(e) => setServiceState({ ...serviceState, bagian: e.target.value })}
                          className="flex-1 text-black bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="col-span-6 pl-4 pt-1 space-y-2">
                    {isFieldVisible('kepala', 'tanggal') && (
                      <div className="flex items-center">
                        <span className="w-20 font-semibold">{getFieldLabel('kepala', 'tanggal', 'Tanggal')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={serviceState.tanggal}
                          onChange={(e) => setServiceState({ ...serviceState, tanggal: e.target.value })}
                          className="flex-1 border-b border-dotted border-black bg-transparent focus:outline-none"
                        />
                      </div>
                    )}
                    {isFieldVisible('kepala', 'nomor') && (
                      <div className="flex items-center">
                        <span className="w-20 font-semibold">{getFieldLabel('kepala', 'nomor', 'Nomor')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={serviceState.nomor}
                          onChange={(e) => setServiceState({ ...serviceState, nomor: e.target.value })}
                          className="flex-1 font-semibold border-b border-dotted border-black bg-transparent focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {isFieldVisible('detil', 'kerusakan') && (
                  <div className="pt-2">
                    <div className="border-t-2 border-b border-black py-1 font-bold uppercase tracking-wide">
                      {getFieldLabel('detil', 'kerusakan', 'KERUSAKAN')}
                    </div>
                    <div className="space-y-1 pt-1">
                      {serviceState.kerusakanLines.map((line, idx) => (
                        <div key={idx} className="border-b border-black py-0.5">
                          <input
                            type="text"
                            value={line}
                            placeholder={idx === 0 ? 'Ketik rincian kerusakan armada di sini...' : ''}
                            onChange={(e) => {
                              const next = [...serviceState.kerusakanLines];
                              next[idx] = e.target.value;
                              setServiceState({ ...serviceState, kerusakanLines: next });
                            }}
                            className="w-full bg-transparent text-black focus:outline-none text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <div className="w-full sm:w-8/12 grid grid-cols-3 border border-black text-center text-[11px]">
                    {isFieldVisible('kaki', 'ttd_menerima_atas') && (
                      <div className="border-r border-black flex flex-col justify-between">
                        <div className="border-b border-black py-1 font-semibold">
                          {getFieldLabel('kaki', 'ttd_menerima_atas', 'Yang Menerima,')}
                        </div>
                        <div className="h-14 flex items-end justify-center pb-1 px-1">
                          <input
                            type="text"
                            value={serviceState.ttdVendor}
                            placeholder="( ................ )"
                            onChange={(e) => setServiceState({ ...serviceState, ttdVendor: e.target.value })}
                            className="w-full text-center bg-transparent text-[11px] focus:outline-none"
                          />
                        </div>
                        <div className="border-t border-black py-0.5 font-bold">
                          {getFieldSubLabel('kaki', 'ttd_menerima_atas', 'VENDOR')}
                        </div>
                      </div>
                    )}

                    {isFieldVisible('kaki', 'ttd_menyetujui_atas') && (
                      <div className="border-r border-black flex flex-col justify-between">
                        <div className="border-b border-black py-1 font-semibold">
                          {getFieldLabel('kaki', 'ttd_menyetujui_atas', 'Menyetujui,')}
                        </div>
                        <div className="h-14 flex items-end justify-center pb-1 px-1">
                          <input
                            type="text"
                            value={serviceState.ttdSpvFinance}
                            placeholder="( ................ )"
                            onChange={(e) => setServiceState({ ...serviceState, ttdSpvFinance: e.target.value })}
                            className="w-full text-center bg-transparent text-[11px] focus:outline-none"
                          />
                        </div>
                        <div className="border-t border-black py-0.5 font-bold">
                          {getFieldSubLabel('kaki', 'ttd_menyetujui_atas', 'SPV FINANCE')}
                        </div>
                      </div>
                    )}

                    {isFieldVisible('kaki', 'ttd_mengajukan_atas') && (
                      <div className="flex flex-col justify-between">
                        <div className="border-b border-black py-1 font-semibold">
                          {getFieldLabel('kaki', 'ttd_mengajukan_atas', 'Yang Mengajukan,')}
                        </div>
                        <div className="h-14 flex items-end justify-center pb-1 px-1">
                          <input
                            type="text"
                            value={serviceState.ttdSpvDepartemen}
                            placeholder="( ................ )"
                            onChange={(e) => setServiceState({ ...serviceState, ttdSpvDepartemen: e.target.value })}
                            className="w-full text-center bg-transparent text-[11px] focus:outline-none"
                          />
                        </div>
                        <div className="border-t border-black py-0.5 font-bold">
                          {getFieldSubLabel('kaki', 'ttd_mengajukan_atas', 'SPV DEPARTEMEN')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {templateConfig.lain.tampilkanBagianPenyelesaianService && (
                  <div className="pt-3 mt-3 border-t-2 border-black space-y-2.5">
                    {isFieldVisible('kepalaTambahan', 'tgl_selesai') && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {getFieldLabel('kepalaTambahan', 'tgl_selesai', 'Tanggal selesai dikerjakan')} :
                        </span>
                        <input
                          type="text"
                          value={serviceState.tanggalSelesai}
                          onChange={(e) => setServiceState({ ...serviceState, tanggalSelesai: e.target.value })}
                          className="border-b border-dotted border-black bg-transparent px-1 font-semibold focus:outline-none"
                        />
                      </div>
                    )}

                    {isFieldVisible('kepalaTambahan', 'pernyataan_1') && (
                      <p className="text-[11.5px]">
                        {getFieldLabel(
                          'kepalaTambahan',
                          'pernyataan_1',
                          'Dengan ini aktiva tetap di bawah ini telah dilakukan perbaikan sehingga kini dalam kondisi yang baik'
                        )}
                      </p>
                    )}

                    {isFieldVisible('kepalaTambahan', 'pernyataan_2') && (
                      <p className="text-[11.5px]">
                        {getFieldLabel(
                          'kepalaTambahan',
                          'pernyataan_2',
                          'Rincian service dan pemeliharaan beserta pemakaian barangnya adalah sebagai berikut:'
                        )}
                      </p>
                    )}

                    <table className="w-full border-collapse border border-black text-xs">
                      <thead>
                        <tr className="text-center font-bold">
                          {isFieldVisible('detil', 'jenis_aktiva') && (
                            <th className="border border-black p-1.5">
                              {getFieldLabel('detil', 'jenis_aktiva', 'Jenis / Aktiva')}
                            </th>
                          )}
                          {isFieldVisible('detil', 'no_aktiva') && (
                            <th className="border border-black p-1.5">
                              {getFieldLabel('detil', 'no_aktiva', 'Nomor Aktiva Tetap*')}
                            </th>
                          )}
                          {isFieldVisible('detil', 'departemen_aktiva') && (
                            <th className="border border-black p-1.5">
                              {getFieldLabel('detil', 'departemen_aktiva', 'Departemen')}
                            </th>
                          )}
                          {isFieldVisible('detil', 'bagian_aktiva') && (
                            <th className="border border-black p-1.5">
                              {getFieldLabel('detil', 'bagian_aktiva', 'Bagian')}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {serviceState.aktivaRows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {isFieldVisible('detil', 'jenis_aktiva') && (
                              <td className="border border-black p-1">
                                <input
                                  type="text"
                                  value={row.jenisAktiva}
                                  onChange={(e) => {
                                    const next = [...serviceState.aktivaRows];
                                    next[rIdx] = { ...next[rIdx], jenisAktiva: e.target.value };
                                    setServiceState({ ...serviceState, aktivaRows: next });
                                  }}
                                  className="w-full bg-transparent text-center focus:outline-none"
                                />
                              </td>
                            )}
                            {isFieldVisible('detil', 'no_aktiva') && (
                              <td className="border border-black p-1">
                                <input
                                  type="text"
                                  value={row.nomorAktiva}
                                  onChange={(e) => {
                                    const next = [...serviceState.aktivaRows];
                                    next[rIdx] = { ...next[rIdx], nomorAktiva: e.target.value };
                                    setServiceState({ ...serviceState, aktivaRows: next });
                                  }}
                                  className="w-full bg-transparent text-center font-semibold focus:outline-none"
                                />
                              </td>
                            )}
                            {isFieldVisible('detil', 'departemen_aktiva') && (
                              <td className="border border-black p-1">
                                <input
                                  type="text"
                                  value={row.departemen}
                                  onChange={(e) => {
                                    const next = [...serviceState.aktivaRows];
                                    next[rIdx] = { ...next[rIdx], departemen: e.target.value };
                                    setServiceState({ ...serviceState, aktivaRows: next });
                                  }}
                                  className="w-full bg-transparent text-center focus:outline-none"
                                />
                              </td>
                            )}
                            {isFieldVisible('detil', 'bagian_aktiva') && (
                              <td className="border border-black p-1">
                                <input
                                  type="text"
                                  value={row.bagian}
                                  onChange={(e) => {
                                    const next = [...serviceState.aktivaRows];
                                    next[rIdx] = { ...next[rIdx], bagian: e.target.value };
                                    setServiceState({ ...serviceState, aktivaRows: next });
                                  }}
                                  className="w-full bg-transparent text-center focus:outline-none"
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {isFieldVisible('detil', 'perbaikan_dilakukan') && (
                      <div className="pt-1">
                        <div className="font-semibold">
                          {getFieldLabel('detil', 'perbaikan_dilakukan', 'Perbaikan yang dilakukan :')}
                        </div>
                        <div className="space-y-1">
                          {serviceState.perbaikanLines.map((line, idx) => (
                            <div key={idx} className="border-b border-black py-0.5">
                              <input
                                type="text"
                                value={line}
                                onChange={(e) => {
                                  const next = [...serviceState.perbaikanLines];
                                  next[idx] = e.target.value;
                                  setServiceState({ ...serviceState, perbaikanLines: next });
                                }}
                                className="w-full bg-transparent text-xs focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-12 gap-4 pt-2 items-start">
                      <div className="col-span-7">
                        {isFieldVisible('detil', 'rincian_barang_judul') && (
                          <div className="font-semibold mb-1">
                            {getFieldLabel('detil', 'rincian_barang_judul', 'Rincian pemakaian barang :')}
                          </div>
                        )}
                        <table className="w-full border-collapse border border-black text-xs">
                          <thead>
                            <tr className="font-bold text-center">
                              {isFieldVisible('detil', 'nama_barang') && (
                                <th className="border border-black p-1 w-8/12">
                                  {getFieldLabel('detil', 'nama_barang', 'NAMA BARANG')}
                                </th>
                              )}
                              {isFieldVisible('detil', 'jumlah_barang') && (
                                <th className="border border-black p-1 w-4/12">
                                  {getFieldLabel('detil', 'jumlah_barang', 'JUMLAH')}
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {serviceState.pemakaianBarang.map((item, idx) => (
                              <tr key={item.no}>
                                {isFieldVisible('detil', 'nama_barang') && (
                                  <td className="border border-black px-2 py-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span>{item.no}.</span>
                                      <input
                                        type="text"
                                        value={item.namaBarang}
                                        onChange={(e) => {
                                          const next = [...serviceState.pemakaianBarang];
                                          next[idx] = { ...next[idx], namaBarang: e.target.value };
                                          setServiceState({ ...serviceState, pemakaianBarang: next });
                                        }}
                                        className="flex-1 bg-transparent focus:outline-none"
                                      />
                                    </div>
                                  </td>
                                )}
                                {isFieldVisible('detil', 'jumlah_barang') && (
                                  <td className="border border-black px-2 py-0.5">
                                    <input
                                      type="text"
                                      value={item.jumlah}
                                      onChange={(e) => {
                                        const next = [...serviceState.pemakaianBarang];
                                        next[idx] = { ...next[idx], jumlah: e.target.value };
                                        setServiceState({ ...serviceState, pemakaianBarang: next });
                                      }}
                                      className="w-full text-center bg-transparent focus:outline-none"
                                    />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="col-span-5 flex justify-end pt-5">
                        <div className="w-48 border border-black text-center text-[11px]">
                          {isFieldVisible('kaki', 'ttd_menyerahkan_bawah') && (
                            <div className="border-b border-black">
                              <div className="border-b border-black py-1 font-semibold">
                                {getFieldLabel('kaki', 'ttd_menyerahkan_bawah', 'Yang Menyerahkan,')}
                              </div>
                              <div className="h-12 flex items-end justify-center pb-0.5 px-1">
                                <input
                                  type="text"
                                  value={serviceState.ttdHrga}
                                  placeholder="( ................ )"
                                  onChange={(e) => setServiceState({ ...serviceState, ttdHrga: e.target.value })}
                                  className="w-full text-center bg-transparent text-[11px] focus:outline-none"
                                />
                              </div>
                              <div className="py-0.5 font-bold">
                                {getFieldSubLabel('kaki', 'ttd_menyerahkan_bawah', 'HR & GA')}
                              </div>
                            </div>
                          )}

                          {isFieldVisible('kaki', 'ttd_menerima_bawah') && (
                            <div>
                              <div className="border-b border-black py-1 font-semibold">
                                {getFieldLabel('kaki', 'ttd_menerima_bawah', 'Yang Menerima,')}
                              </div>
                              <div className="h-12 flex items-end justify-center pb-0.5 px-1">
                                <input
                                  type="text"
                                  value={serviceState.ttdMgrSpv}
                                  placeholder="( ................ )"
                                  onChange={(e) => setServiceState({ ...serviceState, ttdMgrSpv: e.target.value })}
                                  className="w-full text-center bg-transparent text-[11px] focus:outline-none"
                                />
                              </div>
                              <div className="py-0.5 font-bold">
                                {getFieldSubLabel('kaki', 'ttd_menerima_bawah', '............ Mgr/SPV')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                TEMPLATE 2: FORMULIR CUCI ARMADA (Exact match to Image 10 + Official Logo)
               ===================================================================== */}
            {formType === 'washing' && (
              <div className="text-black text-[12px] leading-snug space-y-4">
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-2 flex justify-start">
                    {templateConfig.infoPerusahaan.pakaiLogo && (
                      <AkkCircularLogo
                        customLogoUrl={templateConfig.infoPerusahaan.customLogoDataUrl}
                        size={78}
                      />
                    )}
                  </div>

                  <div className="col-span-5 text-center">
                    {templateConfig.infoPerusahaan.cetakNamaPerusahaan && (
                      <div className="font-bold text-[13px] tracking-wide uppercase">
                        {templateConfig.infoPerusahaan.namaPerusahaan}
                      </div>
                    )}
                    {templateConfig.infoPerusahaan.cetakAlamatPerusahaan && (
                      <div className="font-bold text-[13px] tracking-wide uppercase">
                        {templateConfig.infoPerusahaan.alamatPerusahaan}
                      </div>
                    )}
                  </div>

                  <div className="col-span-5 text-right flex flex-col items-end space-y-0.5">
                    {isFieldVisible('kepala', 'kepada') && (
                      <input
                        type="text"
                        value={washingState.kepada}
                        onChange={(e) => setWashingState({ ...washingState, kepada: e.target.value })}
                        className="text-right font-bold text-xs bg-transparent focus:outline-none"
                      />
                    )}
                    {isFieldVisible('kepala', 'di_tempat') && (
                      <input
                        type="text"
                        value={washingState.diTempat}
                        onChange={(e) => setWashingState({ ...washingState, diTempat: e.target.value })}
                        className="text-right font-bold text-xs bg-transparent focus:outline-none"
                      />
                    )}
                    {isFieldVisible('kepala', 'judul') && (
                      <div className="font-black text-[14px] tracking-wide uppercase pt-1">
                        {getFieldLabel('kepala', 'judul', 'FORM KEGIATAN DRIVER')}
                      </div>
                    )}
                  </div>
                </div>

                {isFieldVisible('kepala', 'tanggal') && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="font-bold text-xs uppercase">
                      {getFieldLabel('kepala', 'tanggal', 'TANGGAL :')}
                    </span>
                    <input
                      type="text"
                      value={washingState.tanggal}
                      onChange={(e) => setWashingState({ ...washingState, tanggal: e.target.value })}
                      className="w-36 border-b border-dotted border-black text-center font-semibold bg-transparent focus:outline-none"
                    />
                  </div>
                )}

                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="font-bold text-center border-b-2 border-black">
                      {sortedWashingCols.map(col => (
                        <th
                          key={col.id}
                          className={`border border-black py-2 px-2 ${
                            col.id === 'no_urut'
                              ? 'w-12'
                              : col.id === 'mulai' || col.id === 'selesai'
                              ? 'w-24'
                              : col.id === 'nama_driver'
                              ? 'w-44'
                              : ''
                          }`}
                        >
                          {col.nama}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {washingState.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          templateConfig.lain.tampilkanGarisDotted
                            ? 'border-b border-dotted border-black'
                            : 'border-b border-black'
                        }
                      >
                        {sortedWashingCols.map(col => {
                          if (col.id === 'nama_driver') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5">
                                <input
                                  type="text"
                                  value={row.namaDriver}
                                  onChange={(e) => {
                                    const next = [...washingState.rows];
                                    next[rIdx] = { ...next[rIdx], namaDriver: e.target.value };
                                    setWashingState({ ...washingState, rows: next });
                                  }}
                                  className="w-full bg-transparent font-semibold focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'no_urut') {
                            return (
                              <td key={col.id} className="border-r border-black px-1 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.no}
                                  onChange={(e) => {
                                    const next = [...washingState.rows];
                                    next[rIdx] = { ...next[rIdx], no: e.target.value };
                                    setWashingState({ ...washingState, rows: next });
                                  }}
                                  className="w-full text-center bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'keterangan') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5">
                                <input
                                  type="text"
                                  value={row.keterangan}
                                  onChange={(e) => {
                                    const next = [...washingState.rows];
                                    next[rIdx] = { ...next[rIdx], keterangan: e.target.value };
                                    setWashingState({ ...washingState, rows: next });
                                  }}
                                  className="w-full bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'mulai') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.mulai}
                                  onChange={(e) => {
                                    const next = [...washingState.rows];
                                    next[rIdx] = { ...next[rIdx], mulai: e.target.value };
                                    setWashingState({ ...washingState, rows: next });
                                  }}
                                  className="w-full text-center bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'selesai') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.selesai}
                                  onChange={(e) => {
                                    const next = [...washingState.rows];
                                    next[rIdx] = { ...next[rIdx], selesai: e.target.value };
                                    setWashingState({ ...washingState, rows: next });
                                  }}
                                  className="w-full text-center bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          return (
                            <td key={col.id} className="border-r border-black px-2 py-1.5 text-center">
                              <input type="text" className="w-full bg-transparent focus:outline-none" />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setWashingState(prev => ({
                        ...prev,
                        rows: [
                          ...prev.rows,
                          {
                            namaDriver: '',
                            no: String(prev.rows.length + 1),
                            keterangan: '',
                            mulai: '',
                            selesai: ''
                          }
                        ]
                      }))
                    }
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Tambah Baris
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 pt-6 text-center text-xs">
                  {isFieldVisible('kaki', 'ttd_dibuat') && (
                    <div className="space-y-14">
                      <div className="font-bold uppercase">{getFieldLabel('kaki', 'ttd_dibuat', 'DIBUAT')}</div>
                      <div>
                        <input
                          type="text"
                          value={washingState.ttdDibuat}
                          placeholder="( .................... )"
                          onChange={(e) => setWashingState({ ...washingState, ttdDibuat: e.target.value })}
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {isFieldVisible('kaki', 'ttd_acc') && (
                    <div className="space-y-14">
                      <div className="font-bold uppercase">{getFieldLabel('kaki', 'ttd_acc', 'ACC')}</div>
                      <div>
                        <input
                          type="text"
                          value={washingState.ttdAcc}
                          placeholder="( .................... )"
                          onChange={(e) => setWashingState({ ...washingState, ttdAcc: e.target.value })}
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {isFieldVisible('kaki', 'ttd_mengetahui') && (
                    <div className="space-y-14">
                      <div className="font-bold uppercase">{getFieldLabel('kaki', 'ttd_mengetahui', 'MENGETAHUI')}</div>
                      <div>
                        <input
                          type="text"
                          value={washingState.ttdMengetahui}
                          placeholder="( .................... )"
                          onChange={(e) => setWashingState({ ...washingState, ttdMengetahui: e.target.value })}
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {isFieldVisible('kaki', 'ttd_driver') && (
                    <div className="space-y-14">
                      <div className="font-bold uppercase">{getFieldLabel('kaki', 'ttd_driver', 'DRIVER')}</div>
                      <div>
                        <input
                          type="text"
                          value={washingState.ttdDriver}
                          placeholder="( .................... )"
                          onChange={(e) => setWashingState({ ...washingState, ttdDriver: e.target.value })}
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =====================================================================
                TEMPLATE 3: FORMULIR PENGADAAN ARMADA (Exact match to Image 11 + Official Logo)
               ===================================================================== */}
            {formType === 'procurement' && (
              <div className="text-black text-[12px] leading-snug space-y-4">
                {isFieldVisible('kepala', 'judul') && (
                  <h1 className="text-center font-bold text-[15px] tracking-wide uppercase">
                    {getFieldLabel('kepala', 'judul', 'FORM PERMINTAAN PENGADAAN BARANG DISTRIBUSI')}
                  </h1>
                )}

                <div className="grid grid-cols-12 items-center pt-1">
                  <div className="col-span-4 flex items-center gap-3">
                    {templateConfig.infoPerusahaan.pakaiLogo && (
                      <AkkCircularLogo
                        customLogoUrl={templateConfig.infoPerusahaan.customLogoDataUrl}
                        size={80}
                      />
                    )}
                    {(templateConfig.infoPerusahaan.cetakNamaPerusahaan ||
                      templateConfig.infoPerusahaan.cetakAlamatPerusahaan) && (
                      <div>
                        {templateConfig.infoPerusahaan.cetakNamaPerusahaan && (
                          <div className="font-bold text-xs">{templateConfig.infoPerusahaan.namaPerusahaan}</div>
                        )}
                        {templateConfig.infoPerusahaan.cetakAlamatPerusahaan && (
                          <div className="text-xs">{templateConfig.infoPerusahaan.alamatPerusahaan}</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-3" />

                  <div className="col-span-5 space-y-1.5 text-xs">
                    {isFieldVisible('kepala', 'nama_pemohon') && (
                      <div className="flex items-center">
                        <span className="w-20 font-semibold">{getFieldLabel('kepala', 'nama_pemohon', 'Nama')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={procurementState.nama}
                          onChange={(e) => setProcurementState({ ...procurementState, nama: e.target.value })}
                          className="flex-1 border-b border-dotted border-black bg-transparent font-semibold focus:outline-none"
                        />
                      </div>
                    )}
                    {isFieldVisible('kepala', 'tanggal') && (
                      <div className="flex items-center">
                        <span className="w-20 font-semibold">{getFieldLabel('kepala', 'tanggal', 'Tanggal')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={procurementState.tanggal}
                          onChange={(e) => setProcurementState({ ...procurementState, tanggal: e.target.value })}
                          className="flex-1 border-b border-dotted border-black bg-transparent focus:outline-none"
                        />
                      </div>
                    )}
                    {isFieldVisible('kepala', 'nomor') && (
                      <div className="flex items-center">
                        <span className="w-20 font-semibold">{getFieldLabel('kepala', 'nomor', 'Nomor')}</span>
                        <span className="mr-2">:</span>
                        <input
                          type="text"
                          value={procurementState.nomor}
                          onChange={(e) => setProcurementState({ ...procurementState, nomor: e.target.value })}
                          className="flex-1 border-b border-dotted border-black bg-transparent font-semibold focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="border-b-2 border-black font-bold text-center">
                      {sortedProcurementCols.map(col => (
                        <th
                          key={col.id}
                          className={`border border-black py-2 px-1.5 ${
                            col.id === 'no'
                              ? 'w-10'
                              : col.id === 'di_tangan' || col.id === 'req_order'
                              ? 'w-24'
                              : col.id === 'tgl_diperlukan'
                              ? 'w-36'
                              : ''
                          }`}
                        >
                          {col.nama}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {procurementState.rows.map((row, rIdx) => (
                      <tr
                        key={row.no}
                        className={
                          templateConfig.lain.tampilkanGarisDotted
                            ? 'border-b border-dotted border-black last:border-b-2 last:border-solid'
                            : 'border-b border-black'
                        }
                      >
                        {sortedProcurementCols.map(col => {
                          if (col.id === 'no') {
                            return (
                              <td key={col.id} className="border-r border-black py-1.5 text-center font-semibold">
                                {row.no}
                              </td>
                            );
                          }
                          if (col.id === 'nama_barang') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5">
                                <input
                                  type="text"
                                  value={row.namaBarang}
                                  onChange={(e) => {
                                    const next = [...procurementState.rows];
                                    next[rIdx] = { ...next[rIdx], namaBarang: e.target.value };
                                    setProcurementState({ ...procurementState, rows: next });
                                  }}
                                  className="w-full bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'di_tangan') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.diTangan}
                                  onChange={(e) => {
                                    const next = [...procurementState.rows];
                                    next[rIdx] = { ...next[rIdx], diTangan: e.target.value };
                                    setProcurementState({ ...procurementState, rows: next });
                                  }}
                                  className="w-full text-center bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'req_order') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.reqOrder}
                                  onChange={(e) => {
                                    const next = [...procurementState.rows];
                                    next[rIdx] = { ...next[rIdx], reqOrder: e.target.value };
                                    setProcurementState({ ...procurementState, rows: next });
                                  }}
                                  className="w-full text-center font-semibold bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'tgl_diperlukan') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={row.tglDiperlukan}
                                  onChange={(e) => {
                                    const next = [...procurementState.rows];
                                    next[rIdx] = { ...next[rIdx], tglDiperlukan: e.target.value };
                                    setProcurementState({ ...procurementState, rows: next });
                                  }}
                                  className="w-full text-center bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          if (col.id === 'untuk_keperluan') {
                            return (
                              <td key={col.id} className="border-r border-black px-2 py-1.5">
                                <input
                                  type="text"
                                  value={row.untukKeperluan}
                                  onChange={(e) => {
                                    const next = [...procurementState.rows];
                                    next[rIdx] = { ...next[rIdx], untukKeperluan: e.target.value };
                                    setProcurementState({ ...procurementState, rows: next });
                                  }}
                                  className="w-full bg-transparent focus:outline-none"
                                />
                              </td>
                            );
                          }
                          return (
                            <td key={col.id} className="border-r border-black px-2 py-1.5">
                              <input type="text" className="w-full bg-transparent focus:outline-none" />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {isFieldVisible('kaki', 'keterangan_kaki') && (
                  <div className="pt-1 space-y-1">
                    <div className="font-bold uppercase">
                      {getFieldLabel('kaki', 'keterangan_kaki', 'KETERANGAN :')}
                    </div>
                    {procurementState.keteranganLines.map((line, idx) => (
                      <div key={idx} className="border-b border-black py-0.5">
                        <input
                          type="text"
                          value={line}
                          onChange={(e) => {
                            const next = [...procurementState.keteranganLines];
                            next[idx] = e.target.value;
                            setProcurementState({ ...procurementState, keteranganLines: next });
                          }}
                          className="w-full bg-transparent text-xs focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 pt-6 text-center text-xs">
                  {isFieldVisible('kaki', 'ttd_mengetahui') && (
                    <div>
                      <div className="font-semibold mb-14">
                        {getFieldLabel('kaki', 'ttd_mengetahui', 'Mengetahui')}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={procurementState.ttdMengetahui}
                          placeholder="(________________)"
                          onChange={(e) =>
                            setProcurementState({ ...procurementState, ttdMengetahui: e.target.value })
                          }
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className="font-bold mt-0.5">
                        {getFieldSubLabel('kaki', 'ttd_mengetahui', 'HRGA')}
                      </div>
                    </div>
                  )}

                  {isFieldVisible('kaki', 'ttd_keuangan') && (
                    <div>
                      <div className="font-semibold mb-14">
                        {getFieldLabel('kaki', 'ttd_keuangan', 'Keuangan')}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={procurementState.ttdKeuangan}
                          placeholder="(________________)"
                          onChange={(e) =>
                            setProcurementState({ ...procurementState, ttdKeuangan: e.target.value })
                          }
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className="font-bold mt-0.5">
                        {getFieldSubLabel('kaki', 'ttd_keuangan', '')}
                      </div>
                    </div>
                  )}

                  {isFieldVisible('kaki', 'ttd_disetujui') && (
                    <div>
                      <div className="font-semibold mb-14">
                        {getFieldLabel('kaki', 'ttd_disetujui', 'Disetujui')}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={procurementState.ttdDisetujui}
                          placeholder="(________________)"
                          onChange={(e) =>
                            setProcurementState({ ...procurementState, ttdDisetujui: e.target.value })
                          }
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className="font-bold mt-0.5">
                        {getFieldSubLabel('kaki', 'ttd_disetujui', '')}
                      </div>
                    </div>
                  )}

                  {isFieldVisible('kaki', 'ttd_pemohon') && (
                    <div>
                      <div className="font-semibold mb-14">
                        {getFieldLabel('kaki', 'ttd_pemohon', 'Pemohon')}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={procurementState.ttdPemohon}
                          placeholder="(________________)"
                          onChange={(e) =>
                            setProcurementState({ ...procurementState, ttdPemohon: e.target.value })
                          }
                          className="w-full text-center bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className="font-bold mt-0.5">
                        {getFieldSubLabel('kaki', 'ttd_pemohon', '')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="bg-slate-950 border-t border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            Rancangan Aktif: <strong className="text-white">{templateConfig.namaRancangan}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAndPrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Simpan &amp; Cetak Formulir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
