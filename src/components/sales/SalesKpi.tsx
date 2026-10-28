import React, { useState, useEffect } from 'react';
import { Award, ShieldAlert, TrendingUp, Percent, User, RefreshCw, AlertTriangle, Building, FileText, CheckCircle, Download, ShoppingBag, Calendar, ArrowRight, UserCheck, Star, Users, ChevronRight, Upload, FileSpreadsheet } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { logisticsStore } from '../../services/store';
import * as XLSX from 'xlsx';
import { useToast } from '../../context/ToastContext';

interface AdminKpi {
  name: string;
  speed: number;
  accuracy: number;
  attendance: number;
  taskCompletion: number;
  totalOrders: number;
  rating: number;
  avatarColor: string;
}

const ADMIN_KPIS: AdminKpi[] = [
  { name: 'Sindi Rahmawati', speed: 92, accuracy: 98, attendance: 95, taskCompletion: 94, totalOrders: 420, rating: 4.8, avatarColor: 'bg-indigo-500/10 text-indigo-400' },
  { name: 'Rina Wijaya', speed: 88, accuracy: 96, attendance: 100, taskCompletion: 90, totalOrders: 380, rating: 4.6, avatarColor: 'bg-emerald-500/10 text-emerald-400' },
  { name: 'Devi Lestari', speed: 95, accuracy: 94, attendance: 98, taskCompletion: 97, totalOrders: 460, rating: 4.9, avatarColor: 'bg-amber-500/10 text-amber-400' },
  { name: 'Budi Santoso', speed: 85, accuracy: 99, attendance: 92, taskCompletion: 88, totalOrders: 310, rating: 4.5, avatarColor: 'bg-cyan-500/10 text-cyan-400' },
];

interface DendaChecker {
  id: string;
  adminName: string;
  incidentDate: string;
  reason: string;
  amount: number;
  status: 'Dipotong' | 'Banding';
  severity: 'Rendah' | 'Sedang' | 'Tinggi';
}

const FINES_DATA: DendaChecker[] = [
  { id: 'DC-001', adminName: 'Rina Wijaya', incidentDate: '2026-09-04', reason: 'Keterlambatan input invoice ke sistem (>2 jam)', amount: 50000, status: 'Dipotong', severity: 'Rendah' },
  { id: 'DC-002', adminName: 'Budi Santoso', incidentDate: '2026-09-08', reason: 'Kesalahan entri nomor PO pada surat jalan', amount: 100000, status: 'Dipotong', severity: 'Sedang' },
  { id: 'DC-003', adminName: 'Sindi Rahmawati', incidentDate: '2026-09-12', reason: 'Dokumen pendukung pengiriman tidak lengkap', amount: 50000, status: 'Dipotong', severity: 'Rendah' },
  { id: 'DC-004', adminName: 'Rina Wijaya', incidentDate: '2026-09-15', reason: 'Salah koordinasi armada truk muat', amount: 150000, status: 'Banding', severity: 'Tinggi' },
  { id: 'DC-005', adminName: 'Devi Lestari', incidentDate: '2026-09-18', reason: 'Tidak verifikasi timbangan barang keluar', amount: 50000, status: 'Dipotong', severity: 'Rendah' },
];

const REVENUE_BREAKDOWN = [
  { month: 'Mei 2026', omset: 1.25, target: 1.20, poCount: 380 }, // in Billion Rupiah
  { month: 'Jun 2026', omset: 1.42, target: 1.30, poCount: 410 },
  { month: 'Jul 2026', omset: 1.68, target: 1.50, poCount: 450 },
  { month: 'Agu 2026', omset: 1.85, target: 1.70, poCount: 490 },
  { month: 'Sep 2026', omset: 2.10, target: 2.00, poCount: 520 },
];

// Nusantara performance data over last months
const NUSANTARA_TRENDS = [
  { month: 'Mei', soetomo: 80, expand: 65 },
  { month: 'Jun', soetomo: 82, expand: 68 },
  { month: 'Jul', soetomo: 85, expand: 70 },
  { month: 'Agu', soetomo: 83, expand: 71 },
  { month: 'Sep', soetomo: 84, expand: 72 },
];

interface SalesKpiProps {
  defaultTab?: string;
  onChangeTab?: (tab: string) => void;
}

export const SalesKpi: React.FC<SalesKpiProps> = ({ defaultTab = 'sales_kpi', onChangeTab }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isExporting, setIsExporting] = useState(false);
  const [users, setUsers] = useState(logisticsStore.getUsers());

  useEffect(() => {
    const sub = logisticsStore.subscribe(() => {
      setUsers(logisticsStore.getUsers());
    });
    return sub;
  }, []);

  // Resolve admin members dynamically from user management!
  const salesAdminUsers = users.filter(u => u.role === 'sales_admin' && u.status === 'approved');

  const dynamicAdminKpis = salesAdminUsers.map((user, idx) => {
    const fallbackKpi = ADMIN_KPIS.find(k => k.name.toLowerCase() === user.fullName.toLowerCase());
    
    if (fallbackKpi) {
      return {
        ...fallbackKpi,
        name: user.fullName
      };
    }
    
    const seed = user.fullName.charCodeAt(0) + user.fullName.charCodeAt(user.fullName.length - 1);
    const speed = 80 + (seed % 16); 
    const accuracy = 85 + ((seed * 3) % 15); 
    const attendance = 90 + ((seed * 7) % 11); 
    const taskCompletion = 85 + ((seed * 13) % 13); 
    const totalOrders = 250 + ((seed * 19) % 250); 
    const rating = Number((4.0 + ((seed % 10) / 10)).toFixed(1)); 
    
    const colors = [
      'bg-indigo-500/10 text-indigo-400',
      'bg-emerald-500/10 text-emerald-400',
      'bg-amber-500/10 text-amber-400',
      'bg-cyan-500/10 text-cyan-400',
      'bg-rose-500/10 text-rose-400',
      'bg-violet-500/10 text-violet-400'
    ];
    const avatarColor = colors[idx % colors.length];

    return {
      name: user.fullName,
      speed,
      accuracy,
      attendance,
      taskCompletion,
      totalOrders,
      rating,
      avatarColor
    };
  });

  const activeAdminKpis = dynamicAdminKpis.length > 0 ? dynamicAdminKpis : ADMIN_KPIS;
  const adminA = activeAdminKpis[0] || { name: 'Sindi Rahmawati' };
  const adminB = activeAdminKpis[1] || { name: 'Rina Wijaya' };

  // File Import state variables & handlers for Omset Admin
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string | null }>({ type: null, message: null });
  const [isDragging, setIsDragging] = useState(false);
  
  // Interactive manual form states for adding new month data
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [newOmset, setNewOmset] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newPoCount, setNewPoCount] = useState('');
  const [newAdminAVal, setNewAdminAVal] = useState('');
  const [newAdminBVal, setNewAdminBVal] = useState('');

  // Interactive manual form states for adding new fine data
  const [isAddFineOpen, setIsAddFineOpen] = useState(false);
  const [newFineAdmin, setNewFineAdmin] = useState('');
  const [newFineReason, setNewFineReason] = useState('');
  const [newFineAmount, setNewFineAmount] = useState('');
  const [newFineSeverity, setNewFineSeverity] = useState<'Rendah' | 'Sedang' | 'Tinggi'>('Rendah');
  const [newFineStatus, setNewFineStatus] = useState<'Dipotong' | 'Banding'>('Dipotong');

  // Excel and file parsing handler
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const parsedData = XLSX.utils.sheet_to_json(worksheet) as any[];

          if (!Array.isArray(parsedData) || parsedData.length === 0) {
            throw new Error('Berkas Excel kosong atau tidak memiliki baris data.');
          }

          // Validate and normalize Excel rows
          const validatedData = parsedData.map((row, i) => {
            if (!row.month) {
              throw new Error(`Baris ke-${i + 1} tidak memiliki kolom 'month'.`);
            }
            return {
              month: String(row.month).trim(),
              omset: parseFloat(row.omset) || 0,
              target: parseFloat(row.target) || 0,
              poCount: parseInt(row.poCount) || 0,
              [adminA.name]: parseFloat(row[adminA.name]) || parseFloat(row['Admin A']) || 0,
              [adminB.name]: parseFloat(row[adminB.name]) || parseFloat(row['Admin B']) || 0,
            };
          });

          setRevenueBreakdown(validatedData);
          setHasImportedData(true);
          setImportStatus({
            type: 'success',
            message: `Berhasil mengimpor ${validatedData.length} data omset bulanan dari file Excel!`
          });

          setTimeout(() => {
            setImportStatus({ type: null, message: null });
          }, 5000);

        } catch (err: any) {
          setImportStatus({
            type: 'error',
            message: `Gagal membaca file Excel: ${err.message}`
          });
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // JSON fallback
    if (file.name.endsWith('.json')) {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsedData = JSON.parse(text);
          if (!Array.isArray(parsedData) || parsedData.length === 0) {
            throw new Error('Data harus berupa array objek JSON.');
          }
          const validatedData = parsedData.map((row, i) => {
            if (!row.month) {
              throw new Error(`Baris ke-${i + 1} tidak memiliki kolom 'month'.`);
            }
            return {
              month: String(row.month).trim(),
              omset: parseFloat(row.omset) || 0,
              target: parseFloat(row.target) || 0,
              poCount: parseInt(row.poCount) || 0,
              [adminA.name]: parseFloat(row[adminA.name]) || 0,
              [adminB.name]: parseFloat(row[adminB.name]) || 0,
            };
          });

          setRevenueBreakdown(validatedData);
          setHasImportedData(true);
          setImportStatus({
            type: 'success',
            message: `Berhasil mengimpor ${validatedData.length} data omset dari file JSON!`
          });
          setTimeout(() => {
            setImportStatus({ type: null, message: null });
          }, 5000);
        } catch (err: any) {
          setImportStatus({
            type: 'error',
            message: `Gagal membaca file JSON: ${err.message}`
          });
        }
      };
      reader.readAsText(file);
      return;
    }

    setImportStatus({
      type: 'error',
      message: 'Format file tidak didukung. Silakan gunakan file Excel (.xlsx, .xls) atau JSON.'
    });
  };

  // Download Excel template with current dynamic admin names
  const downloadExcelTemplate = () => {
    const templateData = [
      { month: 'Mei 2026', omset: 1.25, target: 1.20, poCount: 380, [adminA.name]: 0.65, [adminB.name]: 0.60 },
      { month: 'Jun 2026', omset: 1.42, target: 1.30, poCount: 410, [adminA.name]: 0.75, [adminB.name]: 0.67 },
      { month: 'Jul 2026', omset: 1.68, target: 1.50, poCount: 450, [adminA.name]: 0.88, [adminB.name]: 0.80 },
      { month: 'Agu 2026', omset: 1.85, target: 1.70, poCount: 490, [adminA.name]: 0.95, [adminB.name]: 0.90 },
      { month: 'Sep 2026', omset: 2.10, target: 2.00, poCount: 520, [adminA.name]: 1.15, [adminB.name]: 0.95 },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Omset");
    XLSX.writeFile(workbook, "template_omset_admin.xlsx");
  };

  // Handler to add a new month entry via user form input
  const handleAddManualData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonth.trim()) {
      alert('Mohon masukkan nama bulan/tahun (contoh: Okt 2026)');
      return;
    }

    const omsetVal = parseFloat(newOmset) || 0;
    const targetVal = parseFloat(newTarget) || 0;
    const poVal = parseInt(newPoCount) || 0;
    const adminAVal = parseFloat(newAdminAVal) || 0;
    const adminBVal = parseFloat(newAdminBVal) || 0;

    // Warning validation if sum of individual admin contributions is wildly different from total omset
    if (omsetVal > 0 && Math.abs((adminAVal + adminBVal) - omsetVal) > 0.1) {
      if (!confirm(`Peringatan: Total omset (Rp ${omsetVal} M) tidak sama dengan jumlah kontribusi ${adminA.name} & ${adminB.name} (Rp ${(adminAVal + adminBVal).toFixed(2)} M). Apakah Anda yakin ingin menyimpan?`)) {
        return;
      }
    }

    const newRow = {
      month: newMonth.trim(),
      omset: omsetVal,
      target: targetVal,
      poCount: poVal,
      [adminA.name]: adminAVal,
      [adminB.name]: adminBVal,
    };

    setRevenueBreakdown(prev => {
      // Remove if month already exists to replace, then append
      const filtered = prev.filter(d => d.month.toLowerCase() !== newMonth.trim().toLowerCase());
      return [...filtered, newRow];
    });

    setHasImportedData(true);
    setSelectedRevenueMonth(newMonth.trim());
    setImportStatus({
      type: 'success',
      message: `Berhasil menambahkan data omset baru untuk bulan ${newMonth.trim()}!`
    });

    // Reset fields
    setNewMonth('');
    setNewOmset('');
    setNewTarget('');
    setNewPoCount('');
    setNewAdminAVal('');
    setNewAdminBVal('');
    setIsManualInputOpen(false);

    setTimeout(() => {
      setImportStatus({ type: null, message: null });
    }, 5000);
  };

  const { addNotification } = useToast();

  const [finesData, setFinesData] = useState<DendaChecker[]>(() => {
    try {
      const saved = localStorage.getItem('akk_fines_data_v2');
      return saved ? JSON.parse(saved) : FINES_DATA;
    } catch {
      return FINES_DATA;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('akk_fines_data_v2', JSON.stringify(finesData));
    } catch {}
  }, [finesData]);

  // Find top performer based on rating in activeAdminKpis dynamically
  const topPerformer = [...activeAdminKpis].sort((a, b) => b.rating - a.rating)[0] || {
    name: 'Devi Lestari',
    rating: 4.9
  };

  // Map fines data dynamically to current active admin team members from user accounts
  const activeFinesData = finesData.map((fine, idx) => {
    const targetAdmin = activeAdminKpis[idx % activeAdminKpis.length];
    return {
      ...fine,
      adminName: fine.adminName || (targetAdmin ? targetAdmin.name : 'Rina Wijaya')
    };
  });

  // Stateful revenue breakdown to support instant updates via imported files
  const [revenueBreakdown, setRevenueBreakdown] = useState<any[]>(() => [
    { month: 'Mei 2026', omset: 1.25, target: 1.20, poCount: 380, [adminA.name]: 0.65, [adminB.name]: 0.60 },
    { month: 'Jun 2026', omset: 1.42, target: 1.30, poCount: 410, [adminA.name]: 0.75, [adminB.name]: 0.67 },
    { month: 'Jul 2026', omset: 1.68, target: 1.50, poCount: 450, [adminA.name]: 0.88, [adminB.name]: 0.80 },
    { month: 'Agu 2026', omset: 1.85, target: 1.70, poCount: 490, [adminA.name]: 0.95, [adminB.name]: 0.90 },
    { month: 'Sep 2026', omset: 2.10, target: 2.00, poCount: 520, [adminA.name]: 1.15, [adminB.name]: 0.95 },
  ]);

  const [hasImportedData, setHasImportedData] = useState(false);

  // Sync initial dataset with active admin names if no custom import has occurred yet
  useEffect(() => {
    if (!hasImportedData) {
      setRevenueBreakdown([
        { month: 'Mei 2026', omset: 1.25, target: 1.20, poCount: 380, [adminA.name]: 0.65, [adminB.name]: 0.60 },
        { month: 'Jun 2026', omset: 1.42, target: 1.30, poCount: 410, [adminA.name]: 0.75, [adminB.name]: 0.67 },
        { month: 'Jul 2026', omset: 1.68, target: 1.50, poCount: 450, [adminA.name]: 0.88, [adminB.name]: 0.80 },
        { month: 'Agu 2026', omset: 1.85, target: 1.70, poCount: 490, [adminA.name]: 0.95, [adminB.name]: 0.90 },
        { month: 'Sep 2026', omset: 2.10, target: 2.00, poCount: 520, [adminA.name]: 1.15, [adminB.name]: 0.95 },
      ]);
    }
  }, [adminA.name, adminB.name, hasImportedData]);

  const dynamicRevenueBreakdown = revenueBreakdown;

  const [selectedRevenueMonth, setSelectedRevenueMonth] = useState('Sep 2026');
  const selectedMonthData = dynamicRevenueBreakdown.find(d => d.month === selectedRevenueMonth) || dynamicRevenueBreakdown[dynamicRevenueBreakdown.length - 1] || { month: 'Sep 2026', omset: 2.10, target: 2.00, poCount: 520, [adminA.name]: 1.15, [adminB.name]: 0.95 };

  const monthlyComparisonData = [
    { name: adminA.name, omset: selectedMonthData ? (selectedMonthData as any)[adminA.name] || 0 : 0 },
    { name: adminB.name, omset: selectedMonthData ? (selectedMonthData as any)[adminB.name] || 0 : 0 }
  ];

  const monthlyPieData = [
    { name: adminA.name, value: selectedMonthData ? (selectedMonthData as any)[adminA.name] || 0 : 0 },
    { name: adminB.name, value: selectedMonthData ? (selectedMonthData as any)[adminB.name] || 0 : 0 }
  ];

  const [selectedAdmin, setSelectedAdmin] = useState<AdminKpi>(() => {
    const defaultDevi = activeAdminKpis.find(a => a.name === 'Devi Lestari');
    return defaultDevi || activeAdminKpis[0] || ADMIN_KPIS[2];
  });

  const [highlightedMonth, setHighlightedMonth] = useState('Sep 2026');

  // Generate monthly admin performance scores reactively
  const monthlyAdminPerformanceData = [
    { month: 'Mei 2026' },
    { month: 'Jun 2026' },
    { month: 'Jul 2026' },
    { month: 'Agu 2026' },
    { month: 'Sep 2026' }
  ].map((m, mIdx) => {
    const row: any = { month: m.month };
    activeAdminKpis.forEach((admin, aIdx) => {
      // Base score is determined by rating (e.g. 4.8 out of 5.0 is 96) and task completion
      const baseScore = Math.round((admin.rating / 5.0) * 82 + admin.taskCompletion * 0.18);
      // Let's add minor deterministic monthly fluctuation based on admin indices and month index
      const variance = Math.sin(mIdx + aIdx * 1.5) * 5;
      const score = Math.max(70, Math.min(100, Math.round(baseScore + variance)));
      row[admin.name] = score;
    });
    return row;
  });

  // Calculate best & worst performer for the selected month
  const highlightedMonthRow = monthlyAdminPerformanceData.find(d => d.month === highlightedMonth) || monthlyAdminPerformanceData[monthlyAdminPerformanceData.length - 1];
  
  let bestPerformer = { name: '-', score: 0 };
  let worstPerformer = { name: '-', score: 100 };

  if (highlightedMonthRow) {
    activeAdminKpis.forEach(admin => {
      const score = highlightedMonthRow[admin.name];
      if (score > bestPerformer.score) {
        bestPerformer = { name: admin.name, score };
      }
      if (score < worstPerformer.score) {
        worstPerformer = { name: admin.name, score };
      }
    });
  }

  useEffect(() => {
    const isStillValid = activeAdminKpis.some(a => a.name === selectedAdmin.name);
    if (!isStillValid && activeAdminKpis.length > 0) {
      setSelectedAdmin(activeAdminKpis[0]);
    }
  }, [activeAdminKpis, selectedAdmin.name]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onChangeTab) {
      onChangeTab(tab);
    }
  };

  useEffect(() => {
    // Keep internal tab synchronized when sidebar updates
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const radarData = [
    { subject: 'Kecepatan', A: selectedAdmin.speed, fullMark: 100 },
    { subject: 'Akurasi', A: selectedAdmin.accuracy, fullMark: 100 },
    { subject: 'Kehadiran', A: selectedAdmin.attendance, fullMark: 100 },
    { subject: 'Pencapaian SOP', A: selectedAdmin.taskCompletion, fullMark: 100 },
  ];

  const soetomoPerformance = 84; // %
  const expandPerformance = 72; // %
  const totalFines = activeFinesData.reduce((acc, curr) => curr.status === 'Dipotong' ? acc + curr.amount : acc, 0);
  const totalBanding = activeFinesData.reduce((acc, curr) => curr.status === 'Banding' ? acc + curr.amount : acc, 0);

  const exportKpiToPdf = async () => {
    setIsExporting(true);
    const element = document.getElementById('sales-kpi-print-area');
    if (!element) {
      setIsExporting(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#020617', // Consistent rich dark background
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const formattedDate = new Date().toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      pdf.save(`Laporan_KPI_Admin_${activeTab}_${formattedDate.replace(/ /g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const renderProgressCircle = (percent: number, colorClass: string, label: string, title: string) => {
    const data = [
      { name: 'Selesai', value: percent },
      { name: 'Sisa', value: 100 - percent }
    ];
    const COLORS = [colorClass, '#1e293b'];

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
        <span className="text-xs font-black uppercase text-slate-400 text-center tracking-wider">{title}</span>
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={60}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white">{percent}%</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-semibold text-center leading-relaxed">{label}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Control Bar (Allows seamless dashboard switching directly on page too) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Dashboard Data KPI</h2>
          <p className="text-[11px] text-slate-400 font-bold mt-0.5">Pantau metriks kinerja, denda checker, target nusantara, dan laporan penjualan.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTabChange('sales_kpi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sales_kpi' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Semua Rangkuman
          </button>
          <button
            onClick={() => handleTabChange('sales_kpi_individual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sales_kpi_individual' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            1. KPI Individu
          </button>
          <button
            onClick={() => handleTabChange('sales_kpi_fines')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sales_kpi_fines' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            2. Denda Checker
          </button>
          <button
            onClick={() => handleTabChange('sales_kpi_nusantara')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sales_kpi_nusantara' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            3. Kiriman Nusantara
          </button>
          <button
            onClick={() => handleTabChange('sales_kpi_omset')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sales_kpi_omset' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            4. Omset Admin
          </button>
          
          <button
            onClick={exportKpiToPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Ekspor PDF</span>
          </button>
        </div>
      </div>

      {/* Target Print Area containing actual Dashboard Layout */}
      <div id="sales-kpi-print-area" className="p-4 rounded-2xl bg-slate-950/20 space-y-6">
        
        {/* PDF Header (Only visible inside printed documents) */}
        <div className="hidden print:block pb-4 mb-4 border-b border-slate-800">
          <h1 className="text-xl font-black text-white">LAPORAN KPI & KINERJA DEPARTEMEN PENJUALAN</h1>
          <p className="text-xs text-slate-400 mt-1">Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: KPI INDIVIDU DASHBOARD                                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'sales_kpi_individual' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Stat Cards for Individuals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Top Performer Sept</span>
                  <div className="text-lg font-black text-white mt-1">{topPerformer.name}</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold">Rating Kinerja: {topPerformer.rating}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Star className="w-5 h-5 fill-amber-400" />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rerata Kecepatan Input</span>
                  <div className="text-lg font-black text-emerald-400 mt-1">90.5% SLA</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold">Kenaikan +2% dari Agt</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rerata Akurasi Berkas</span>
                  <div className="text-lg font-black text-indigo-400 mt-1">96.8% Akurat</div>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold">Target manajemen min 95%</p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* In-depth individual profile selector & comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Profile Card Selector list */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Daftar Anggota Tim</h3>
                <p className="text-[10px] text-slate-400 font-semibold mb-2">Pilih personil untuk memuat data analisis KPI radar.</p>
                <div className="space-y-2">
                  {activeAdminKpis.map(admin => (
                    <button
                      key={admin.name}
                      onClick={() => setSelectedAdmin(admin)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left border cursor-pointer transition-all ${
                        selectedAdmin.name === admin.name 
                          ? 'bg-indigo-600/10 border-indigo-500 text-white' 
                          : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-white hover:bg-slate-850/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${admin.avatarColor}`}>
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{admin.name}</div>
                          <div className="text-[9px] text-slate-500 font-bold">Total {admin.totalOrders} PO</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific analysis dashboard for Selected Admin */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Analis Radar Kinerja - {selectedAdmin.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold">Visualisasi pemenuhan target KPI bulanan</p>
                  </div>
                  <span className="text-[10px] font-black bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-500/25">
                    Rating {selectedAdmin.rating} / 5.0
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="h-[220px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} />
                        <Radar name={selectedAdmin.name} dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Quantitative numbers */}
                  <div className="space-y-3">
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>KECEPATAN INPUT PO</span>
                        <span className="text-white">{selectedAdmin.speed}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${selectedAdmin.speed}%` }}></div>
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>AKURASI BERKAS & SURAT JALAN</span>
                        <span className="text-white">{selectedAdmin.accuracy}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedAdmin.accuracy}%` }}></div>
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>PRESENSI & KEHADIRAN</span>
                        <span className="text-white">{selectedAdmin.attendance}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${selectedAdmin.attendance}%` }}></div>
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>PENCAPAIAN TARGET SOP</span>
                        <span className="text-white">{selectedAdmin.taskCompletion}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${selectedAdmin.taskCompletion}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: AKUMULASI DENDA CHECKER DASHBOARD                    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'sales_kpi_fines' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-sm font-black text-white">Akumulasi Sanksi & Denda Checker</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">Tabel transparansi denda akibat kelalaian data entry & PO</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-3">
                  <div className="bg-slate-955/80 border border-slate-800 px-4 py-2 rounded-xl">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Total Terpotong</div>
                    <div className="text-lg font-black text-rose-400">Rp {totalFines.toLocaleString('id-ID')}</div>
                  </div>
                  <div className="bg-slate-955/80 border border-slate-800 px-4 py-2 rounded-xl">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Proses Banding</div>
                    <div className="text-lg font-black text-amber-400">Rp {totalBanding.toLocaleString('id-ID')}</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddFineOpen(!isAddFineOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-black tracking-tight shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow ${
                    isAddFineOpen
                      ? 'bg-rose-500 text-slate-950 hover:bg-rose-400 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 font-bold'
                  }`}
                >
                  <span>{isAddFineOpen ? 'Tutup Form' : '＋ Catat Denda'}</span>
                </button>
              </div>
            </div>

            {isAddFineOpen && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-4">
                <div className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Formulir Pengajuan Sanksi / Denda Checker</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Select Admin Staf */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Pilih Staf Admin</label>
                    <select
                      value={newFineAdmin}
                      onChange={(e) => setNewFineAdmin(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                    >
                      <option value="">-- Pilih Staf Admin --</option>
                      {activeAdminKpis.map(admin => (
                        <option key={admin.name} value={admin.name}>{admin.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Severity & Status */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tingkat Kerugian & Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newFineSeverity}
                        onChange={(e) => {
                          const val = e.target.value as 'Rendah' | 'Sedang' | 'Tinggi';
                          setNewFineSeverity(val);
                          // Auto set nominal based on severity
                          if (val === 'Rendah') setNewFineAmount('50000');
                          else if (val === 'Sedang') setNewFineAmount('100000');
                          else if (val === 'Tinggi') setNewFineAmount('150000');
                        }}
                        className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                      >
                        <option value="Rendah">Rendah (Rp 50K)</option>
                        <option value="Sedang">Sedang (Rp 100K)</option>
                        <option value="Tinggi">Tinggi (Rp 150K)</option>
                      </select>
                      <select
                        value={newFineStatus}
                        onChange={(e) => setNewFineStatus(e.target.value as any)}
                        className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                      >
                        <option value="Dipotong">Dipotong</option>
                        <option value="Banding">Banding</option>
                      </select>
                    </div>
                  </div>

                  {/* Nominal Denda */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Nominal Denda (Rp)</label>
                    <input
                      type="number"
                      placeholder="Contoh: 50000"
                      value={newFineAmount}
                      onChange={(e) => setNewFineAmount(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                    />
                  </div>
                </div>

                {/* Rincian Pelanggaran */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Rincian Kelalaian / Pelanggaran</label>
                  <input
                    type="text"
                    placeholder="Contoh: Keterlambatan input invoice ke sistem pelanggan >2 jam"
                    value={newFineReason}
                    onChange={(e) => setNewFineReason(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2.5">
                  <button
                    onClick={() => {
                      setIsAddFineOpen(false);
                      setNewFineAdmin('');
                      setNewFineReason('');
                      setNewFineAmount('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      if (!newFineAdmin || !newFineReason || !newFineAmount) {
                        alert('Harap isi nama staf, rincian kelalaian, dan nominal denda!');
                        return;
                      }
                      
                      const amt = parseInt(newFineAmount) || 50000;
                      const incidentDate = new Date().toISOString().split('T')[0];
                      
                      const newFine = {
                        adminName: newFineAdmin,
                        incidentDate,
                        reason: newFineReason,
                        amount: amt,
                        status: newFineStatus,
                        severity: newFineSeverity
                      };
                      
                      const fineId = `DC-00${finesData.length + 1}`;
                      setFinesData(prev => [
                        { id: fineId, ...newFine },
                        ...prev
                      ]);
                      
                      // Trigger Toast notification
                      addNotification(
                        'checker',
                        `Sanksi Denda Checker Baru: ${newFine.adminName}`,
                        `Denda Rp ${amt.toLocaleString('id-ID')} dikeluarkan atas kelalaian: "${newFine.reason}".`,
                        newFine.severity === 'Tinggi'
                      );
                      
                      // Reset and close
                      setIsAddFineOpen(false);
                      setNewFineAdmin('');
                      setNewFineReason('');
                      setNewFineAmount('');
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-black bg-rose-500 hover:bg-rose-400 text-slate-950 cursor-pointer"
                  >
                    Simpan Sanksi
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-slate-800 bg-slate-950/20">
                <thead className="bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase">
                  <tr>
                    <th className="p-4">ID Transaksi</th>
                    <th className="p-4">Tanggal Kejadian</th>
                    <th className="p-4">Staf Admin</th>
                    <th className="p-4">Rincian Pelanggaran</th>
                    <th className="p-4">Tingkat Kerugian</th>
                    <th className="p-4 text-right">Denda Finansial</th>
                    <th className="p-4 text-center">Status Sanksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {activeFinesData.map((fine) => (
                    <tr key={fine.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-4 font-bold text-slate-500">{fine.id}</td>
                      <td className="p-4">{new Date(fine.incidentDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      <td className="p-4 font-black text-white">{fine.adminName}</td>
                      <td className="p-4 font-semibold text-slate-400">{fine.reason}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          fine.severity === 'Tinggi' ? 'bg-rose-500/10 text-rose-400' :
                          fine.severity === 'Sedang' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {fine.severity}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black text-rose-400">Rp {fine.amount.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          fine.status === 'Dipotong' ? 'bg-rose-600/15 text-rose-300 border border-rose-500/30' : 'bg-amber-600/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {fine.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/10 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-white">SOP Klaim & Keberatan Checker:</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Semua denda checker diakumulasikan dan disepakati oleh supervisor logistik. Admin memiliki waktu maksimal 3 hari kerja setelah surat peringatan dikeluarkan untuk mengajukan berkas sanggahan/banding jika terdapat ketidaksesuaian data di lapangan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: PERSENTASE KIRIMAN NUSANTARA DASHBOARD                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'sales_kpi_nusantara' && (
          <div className="space-y-6 animate-fade-in">
            {/* Visual Ring Meters Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderProgressCircle(soetomoPerformance, '#6366f1', 'Pengiriman tepat waktu ke cabang Dr. Soetomo (target minimal 80%)', 'Nusantara dr. Soetomo')}
              {renderProgressCircle(expandPerformance, '#06b6d4', 'Pengiriman rute perluasan baru dan mitra ekspansi (target minimal 70%)', 'Nusantara Expand')}
            </div>

            {/* SLA Trends Over Months (Line Chart) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Tren SLA Keberhasilan Kiriman (%)</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Analisis histori lima bulan terakhir</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-indigo-500"></span>
                    <span className="text-slate-400">Dr. Soetomo</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded bg-cyan-500"></span>
                    <span className="text-slate-400">Nusantara Expand</span>
                  </div>
                </div>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={NUSANTARA_TRENDS} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} domain={[50, 100]} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                              <p className="font-bold text-white">{payload[0].payload.month}</p>
                              <p className="text-indigo-400 font-bold">Dr. Soetomo: {payload[0].value}%</p>
                              <p className="text-cyan-400 font-bold">Nusantara Expand: {payload[1].value}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line type="monotone" dataKey="soetomo" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="expand" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 4: OMSET ADMIN PENJUALAN DASHBOARD                       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'sales_kpi_omset' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Building className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-black text-white">Omset Penjualan Admin</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">Distribusi nilai omset penjualan (dalam Miliar Rupiah)</p>
                </div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg text-xs font-black text-cyan-300">
                Pencapaian Akumulatif: Rp {(dynamicRevenueBreakdown[dynamicRevenueBreakdown.length - 1]?.omset || 2.10).toFixed(2)} Miliar ({dynamicRevenueBreakdown[dynamicRevenueBreakdown.length - 1]?.month || 'Sept 2026'})
              </div>
            </div>

            {/* INTEGRATED FILE IMPORT COMPONENT */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" /> Import & Sinkronisasi Data Omset (Excel)
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Unggah berkas Excel untuk memperbarui tren grafik & kontribusi secara instan.</p>
                </div>
                {/* Template download links */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadExcelTemplate}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-[10px] text-slate-300 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    title="Download template format Excel (.xlsx) dengan nama-nama admin saat ini"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" /> Unduh Template Excel (.xlsx)
                  </button>
                </div>
              </div>

              {/* Status alerts */}
              {importStatus.type && (
                <div className={`p-3 rounded-lg text-[10px] font-bold flex items-start gap-2.5 animate-fade-in ${
                  importStatus.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/15 border border-rose-500/20 text-rose-400'
                }`}>
                  {importStatus.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <p className="leading-relaxed">{importStatus.message}</p>
                </div>
              )}

              {/* Drag & Drop uploader area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleFileUpload(files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`lg:col-span-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-2 min-h-[160px] ${
                    isDragging
                      ? 'border-cyan-500 bg-cyan-500/5 shadow-inner'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-900/40'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleFileUpload(files[0]);
                      }
                    }}
                    accept=".xlsx,.xls,.json"
                    className="hidden"
                  />
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-cyan-400 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Seret & lepas berkas Excel di sini, atau <span className="text-cyan-400 hover:underline">pilih berkas</span></p>
                    <p className="text-[9px] text-slate-500 font-bold mt-1">Mendukung format .xlsx / .xls sesuai nama admin terdaftar</p>
                  </div>
                </div>

                {/* Alternate manual "Tambah Data" Form */}
                <div className="lg:col-span-2 border border-slate-850 bg-slate-950/20 rounded-xl p-4 flex flex-col space-y-3 justify-between">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <div>
                      <h5 className="text-[10px] font-black text-white uppercase tracking-wider">Alternatif: Input / Tambah Data Baru</h5>
                      <p className="text-[9px] text-slate-500 mt-0.5">Gunakan form di bawah ini untuk menambahkan data baris omset bulan baru secara langsung ke grafik.</p>
                    </div>
                    {!isManualInputOpen && (
                      <button
                        onClick={() => setIsManualInputOpen(true)}
                        className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Buka Form Tambah Data
                      </button>
                    )}
                  </div>

                  {!isManualInputOpen ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <p className="text-[10px] text-slate-400 font-medium">Form tambah data manual sedang ditutup.</p>
                      <button
                        onClick={() => setIsManualInputOpen(true)}
                        className="mt-2 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-bold transition-all"
                      >
                        Mulai Tambah Data Manual
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleAddManualData} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">Bulan & Tahun *</label>
                        <input
                          type="text"
                          value={newMonth}
                          onChange={(e) => setNewMonth(e.target.value)}
                          placeholder="Contoh: Okt 2026"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">Total Omset (Miliar Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newOmset}
                          onChange={(e) => setNewOmset(e.target.value)}
                          placeholder="Contoh: 2.35"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">Target KPI (Miliar Rp)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newTarget}
                          onChange={(e) => setNewTarget(e.target.value)}
                          placeholder="Contoh: 2.20"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">Jumlah PO Terinput</label>
                        <input
                          type="number"
                          value={newPoCount}
                          onChange={(e) => setNewPoCount(e.target.value)}
                          placeholder="Contoh: 560"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">Kontribusi: {adminA.name}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newAdminAVal}
                          onChange={(e) => setNewAdminAVal(e.target.value)}
                          placeholder="Miliar Rp"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">Kontribusi: {adminB.name}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newAdminBVal}
                          onChange={(e) => setNewAdminBVal(e.target.value)}
                          placeholder="Miliar Rp"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-3 flex items-center justify-end gap-2 border-t border-slate-900 pt-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setIsManualInputOpen(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-black uppercase cursor-pointer"
                        >
                          Tambah Data Ke Grafik
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Area Chart showing revenue vs Target */}
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicRevenueBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-1.5 shadow-xl">
                            <p className="font-bold text-slate-400">{payload[0].payload.month}</p>
                            <p className="text-cyan-400 font-black">Total Omset Riil: Rp {payload[0].value} Miliar</p>
                            <p className="text-indigo-400 font-bold">Target KPI: Rp {payload[1].value} Miliar</p>
                            <div className="border-t border-slate-800 my-1 pt-1 space-y-0.5">
                              <p className="text-[#10b981] font-semibold">{adminA.name}: Rp {payload[0].payload[adminA.name]} Miliar</p>
                              <p className="text-[#f59e0b] font-semibold">{adminB.name}: Rp {payload[0].payload[adminB.name]} Miliar</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="omset" name="Omset Riil" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorOmset)" />
                  <Area type="monotone" dataKey="target" name="Target KPI" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorTarget)" />
                  <Area type="monotone" dataKey={adminA.name} name={`Kontribusi ${adminA.name}`} stroke="#10b981" strokeWidth={2} fillOpacity={0} strokeDasharray="3 3" />
                  <Area type="monotone" dataKey={adminB.name} name={`Kontribusi ${adminB.name}`} stroke="#f59e0b" strokeWidth={2} fillOpacity={0} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Rasio Pencapaian</span>
                <div className="text-lg font-black text-white mt-1">105%</div>
                <p className="text-[10px] text-slate-400 mt-1">Melampaui target bulanan Rp 2.0 Miliar</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Jumlah PO Terinput</span>
                <div className="text-lg font-black text-cyan-400 mt-1">520 Berkas</div>
                <p className="text-[10px] text-slate-400 mt-1">Rata-rata 17.3 PO terproses/hari</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Rerata Nilai PO</span>
                <div className="text-lg font-black text-indigo-400 mt-1">Rp 4.03 Juta</div>
                <p className="text-[10px] text-slate-400 mt-1">Nilai per transaksi retail</p>
              </div>
            </div>

            {/* Monthly Comparison Card (Bar and Pie Chart) */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Perbandingan Kontribusi Bulanan ({adminA.name} vs {adminB.name})</h4>
                  <p className="text-[10px] text-slate-500 font-bold">Pilih bulan untuk melihat visualisasi kontribusi masing-masing staf admin</p>
                </div>
                {/* Horizontal month selection tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {dynamicRevenueBreakdown.map(item => (
                    <button
                      key={item.month}
                      onClick={() => setSelectedRevenueMonth(item.month)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap cursor-pointer transition-all ${
                        selectedRevenueMonth === item.month
                          ? 'bg-cyan-500 text-slate-950 shadow-md'
                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                      }`}
                    >
                      {item.month.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two columns: Bar Chart and Pie Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Left side: Bar chart comparison */}
                <div className="bg-slate-900/60 border border-slate-850/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Nilai Penjualan (Miliar Rp) - {selectedRevenueMonth}</span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-black">Bar Chart</span>
                  </div>
                  <div className="h-[160px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyComparisonData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[10px] shadow-xl">
                                  <p className="font-bold text-slate-400">{payload[0].payload.name}</p>
                                  <p className="text-cyan-400 font-black">Omset: Rp {payload[0].value} Miliar</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="omset" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={36}>
                          {monthlyComparisonData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={idx === 0 ? '#10b981' : '#f59e0b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right side: Pie chart contribution share */}
                <div className="bg-slate-900/60 border border-slate-850/60 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Porsi Kontribusi (%) - {selectedRevenueMonth}</span>
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-black">Donut Chart</span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 h-[140px]">
                    <div className="h-full w-[140px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={monthlyPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={38}
                            outerRadius={52}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {monthlyPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[10px] shadow-xl">
                                    <p className="font-bold text-slate-400">{payload[0].name}</p>
                                    <p className="text-cyan-400 font-black">Kontribusi: Rp {payload[0].value} Miliar</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-col gap-3 justify-center text-[10px]">
                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] mt-0.5" />
                        <div>
                          <p className="font-bold text-white leading-none">{adminA.name}</p>
                          <p className="text-[9px] text-emerald-400 font-black mt-1">Rp {selectedMonthData ? (selectedMonthData as any)[adminA.name] : 0} M ({(selectedMonthData && (selectedMonthData as any).omset > 0) ? Math.round(((selectedMonthData as any)[adminA.name] / (selectedMonthData as any).omset) * 100) : 50}%)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] mt-0.5" />
                        <div>
                          <p className="font-bold text-white leading-none">{adminB.name}</p>
                          <p className="text-[9px] text-amber-400 font-black mt-1">Rp {selectedMonthData ? (selectedMonthData as any)[adminB.name] : 0} M ({(selectedMonthData && (selectedMonthData as any).omset > 0) ? Math.round(((selectedMonthData as any)[adminB.name] / (selectedMonthData as any).omset) * 100) : 50}%)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 5: MASTER OVERVIEW (COMBINED SUMMARY DASHBOARD)          */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'sales_kpi' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Admin Bulan Ini</h4>
                  <div className="text-base font-black text-white">{topPerformer.name}</div>
                  <p className="text-[10px] text-slate-500 font-semibold">Rating Kinerja: {topPerformer.rating} / 5.0</p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <User className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Denda Terpotong</h4>
                  <div className="text-base font-black text-rose-400">Rp {totalFines.toLocaleString('id-ID')}</div>
                  <p className="text-[10px] text-slate-500 font-semibold">Dari 4 denda terverifikasi</p>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SLA Kiriman Nusantara</h4>
                  <div className="text-base font-black text-emerald-400">78.0% Rerata</div>
                  <p className="text-[10px] text-slate-500 font-semibold">dr. Soetomo & Nusantara Expand</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Percent className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Omset Berjalan (Sept)</h4>
                  <div className="text-base font-black text-cyan-400">Rp 2.10 Miliar</div>
                  <p className="text-[10px] text-slate-500 font-semibold">Tumbuh +13.5% vs bulan lalu</p>
                </div>
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Monthly Admin Performance Comparison Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Analisis Perbandingan Kinerja Bulanan Antar Admin</h3>
                    <p className="text-[9px] text-slate-500 font-bold">Perbandingan tren skor KPI (Skala 0-100) per bulan untuk memonitor kontribusi kinerja staff</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[10px] font-bold text-slate-400">Sorotan Bulan:</span>
                  <select
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none cursor-pointer"
                    value={highlightedMonth}
                    onChange={(e) => setHighlightedMonth(e.target.value)}
                  >
                    {['Mei 2026', 'Jun 2026', 'Jul 2026', 'Agu 2026', 'Sep 2026'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Bar chart block */}
                <div className="lg:col-span-8 bg-slate-950/40 p-4 rounded-xl border border-slate-850 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyAdminPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[50, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                        itemStyle={{ fontSize: '10px', padding: '1px 0' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                      {activeAdminKpis.map((admin, idx) => {
                        const colors = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e', '#8b5cf6'];
                        return (
                          <Bar
                            key={admin.name}
                            dataKey={admin.name}
                            fill={colors[idx % colors.length]}
                            radius={[3, 3, 0, 0]}
                            barSize={12}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Best vs Lowest performers display */}
                <div className="lg:col-span-4 flex flex-col justify-between bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Ringkasan Evaluasi: {highlightedMonth}</h4>
                    
                    <div className="space-y-2.5">
                      {/* Best Performer */}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-3 transition">
                        <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
                          <Star className="w-4 h-4 fill-emerald-400/20" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider block">Admin Terbaik 🏆</span>
                          <span className="text-xs font-black text-white block truncate">{bestPerformer.name}</span>
                          <span className="text-[10px] text-slate-400">Skor Kinerja: <strong className="text-emerald-400">{bestPerformer.score}</strong></span>
                        </div>
                      </div>

                      {/* Worst Performer */}
                      <div className="bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 rounded-lg p-2.5 flex items-center gap-3 transition">
                        <div className="p-2 rounded bg-rose-500/10 text-rose-400">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-bold text-rose-400 uppercase tracking-wider block">Skor Terendah ⚠️</span>
                          <span className="text-xs font-black text-white block truncate">{worstPerformer.name}</span>
                          <span className="text-[10px] text-slate-400">Skor Kinerja: <strong className="text-rose-400">{worstPerformer.score}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[9px] text-slate-400 leading-relaxed font-medium">
                    💡 <strong className="text-slate-300">Rekomendasi Bulanan:</strong> Staff dengan skor di bawah 80 disarankan untuk dilakukan rotasi rute penugasan, sedangkan skor di atas 95 mendapatkan poin reward bonus.
                  </div>
                </div>
              </div>
            </div>

            {/* Combined summary charts and lists */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Box 1: KPI radar */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">1. Ringkasan KPI Individu ({selectedAdmin.name})</h3>
                      <p className="text-[9px] text-slate-500 font-bold">Tekan sub-tab di atas untuk detail analitis mendalam</p>
                    </div>
                  </div>
                  <select
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none cursor-pointer"
                    value={selectedAdmin.name}
                    onChange={(e) => {
                      const found = activeAdminKpis.find(a => a.name === e.target.value);
                      if (found) setSelectedAdmin(found);
                    }}
                  >
                    {activeAdminKpis.map(admin => (
                      <option key={admin.name} value={admin.name}>{admin.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="h-[170px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} />
                        <Radar name={selectedAdmin.name} dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850 space-y-2">
                    <div className="text-[10px] font-black text-white border-b border-slate-800 pb-1.5 flex items-center justify-between">
                      <span>Rasio Skor</span>
                      <span className="text-amber-400">{selectedAdmin.rating} / 5.0</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500 block">Akurasi</span>
                        <span className="text-white font-bold">{selectedAdmin.accuracy}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">SOP</span>
                        <span className="text-white font-bold">{selectedAdmin.taskCompletion}%</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleTabChange('sales_kpi_individual')}
                      className="w-full text-center text-[9px] font-black bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 py-1.5 rounded-lg transition-all"
                    >
                      Buka Detail Individu &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Box 2: Nusantara performance brief */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">3. Ringkasan SLA Nusantara</h3>
                      <p className="text-[9px] text-slate-500 font-bold">Tingkat ketepatan waktu pengiriman</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 text-center">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Soetomo</div>
                    <div className="text-lg font-black text-indigo-400 mt-1">84%</div>
                    <span className="text-[9px] text-emerald-400 font-bold">AMAN (SLA &gt; 80%)</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 text-center">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Expand</div>
                    <div className="text-lg font-black text-cyan-400 mt-1">72%</div>
                    <span className="text-[9px] text-amber-400 font-bold">PERLU EVALUASI</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleTabChange('sales_kpi_nusantara')}
                  className="w-full text-center text-[9px] font-black bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 py-2 rounded-lg transition-all"
                >
                  Analisis Grafik Tren SLA &rarr;
                </button>
              </div>

              {/* Box 3: Denda Checker brief */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">2. Rangkuman Denda Terakhir</h3>
                      <p className="text-[9px] text-slate-500 font-bold">Sanksi keterlambatan / salah entri</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleTabChange('sales_kpi_fines')}
                    className="text-[10px] font-black text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Selengkapnya &rarr;
                  </button>
                </div>

                <div className="space-y-2">
                  {activeFinesData.slice(0, 3).map(fine => (
                    <div key={fine.id} className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-850 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-white">{fine.adminName}</span>
                        <p className="text-[9px] text-slate-500 truncate max-w-[200px]" title={fine.reason}>{fine.reason}</p>
                      </div>
                      <span className="font-black text-rose-400">Rp {fine.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 4: Omset Penjualan brief */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">4. Grafik Omset Berjalan</h3>
                      <p className="text-[9px] text-slate-500 font-bold">Target vs Riil Realisasi (Miliar Rp)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleTabChange('sales_kpi_omset')}
                    className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Detail Grafik &rarr;
                  </button>
                </div>

                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={REVENUE_BREAKDOWN.slice(-3)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="omset" fill="#06b6d4" radius={[3, 3, 0, 0]} barSize={28}>
                        {REVENUE_BREAKDOWN.slice(-3).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 2 ? '#6366f1' : '#06b6d4'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
