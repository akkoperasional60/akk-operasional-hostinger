import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { FuelLog, VehicleType, EfficiencyStatus } from '../types';
import { FUEL_TARGET_RATIOS } from '../data/fuelMockData';
import { logisticsStore } from '../services/store';

export interface WeekBounds {
  weekKey: string;      // e.g. "2026-W38"
  weekNumber: number;   // 38
  year: number;         // 2026
  startDate: string;    // YYYY-MM-DD (Monday)
  endDate: string;      // YYYY-MM-DD (Sunday)
  weekLabel: string;    // "Minggu ke-38 (15 Sep - 21 Sep 2026)"
  shortLabel: string;   // "15 - 21 Sep 2026"
}

export interface WeeklyFleetFuelSummary {
  id: string;
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  fleetId: string;
  plateNumber: string;
  initialCode: string;
  vehicleType: VehicleType;
  refuelCount: number;
  totalLiters: number;
  totalCost: number;
  totalDistanceKm: number;
  avgKmPerLiter: number;
  avgLiterPerKm: number;
  avgLiterPer100Km: number;
  avgCostPerKm: number;
  targetRatio: number;
  targetLiterPerKm: number;
  variancePercent: number; // vs target ratio
  status: EfficiencyStatus;
  driverNames: string[];
}

export interface WeeklyDriverFuelSummary {
  id: string;
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  driverId?: string;
  driverName: string;
  fleetPlates: string[];
  refuelCount: number;
  totalLiters: number;
  totalCost: number;
  totalDistanceKm: number;
  avgKmPerLiter: number;
  avgLiterPerKm: number;
  avgCostPerKm: number;
  ecoScore: number; // 0 - 100
  predicate: 'Master Eco-Driver' | 'Driver Efisien' | 'Perlu Bimbingan';
}

/**
 * Calculate Monday-to-Sunday week bounds for any given ISO date string.
 */
export function getWeekBounds(dateStr: string): WeekBounds {
  // Normalize date string (YYYY-MM-DD)
  const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = cleanDateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const d = new Date(year, month, day);
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(year, month, day + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const startDate = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const endDate = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

  // ISO 8601 week number calculation
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const isoYear = monday.getFullYear();
  const weekKey = `${isoYear}-W${pad(weekNumber)}`;

  const monthsId = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const startFmt = `${monday.getDate()} ${monthsId[monday.getMonth()]}`;
  const endFmt = `${sunday.getDate()} ${monthsId[sunday.getMonth()]} ${sunday.getFullYear()}`;
  const shortLabel = `${startFmt} - ${endFmt}`;
  const weekLabel = `Minggu ke-${weekNumber} (${shortLabel})`;

  return {
    weekKey,
    weekNumber,
    year: isoYear,
    startDate,
    endDate,
    weekLabel,
    shortLabel
  };
}

/**
 * Aggregate logs into weekly summaries per fleet
 */
export function computeWeeklyFleetSummaries(logs: FuelLog[]): WeeklyFleetFuelSummary[] {
  // Key: `${weekKey}_${fleetId}`
  const grouped: Record<string, {
    bounds: WeekBounds;
    fleetId: string;
    plateNumber: string;
    initialCode: string;
    vehicleType: VehicleType;
    logs: FuelLog[];
  }> = {};

  logs.forEach(log => {
    const bounds = getWeekBounds(log.date);
    const key = `${bounds.weekKey}_${log.fleetId}`;
    if (!grouped[key]) {
      grouped[key] = {
        bounds,
        fleetId: log.fleetId,
        plateNumber: log.plateNumber,
        initialCode: log.initialCode || '-',
        vehicleType: log.vehicleType,
        logs: []
      };
    }
    grouped[key].logs.push(log);
  });

  const results: WeeklyFleetFuelSummary[] = Object.values(grouped).map(item => {
    const totalLiters = Number(item.logs.reduce((sum, l) => sum + (l.liters || 0), 0).toFixed(1));
    const totalCost = item.logs.reduce((sum, l) => sum + (l.totalCost || 0), 0);
    const totalDistanceKm = item.logs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);
    const refuelCount = item.logs.length;

    const avgKmPerLiter = totalLiters > 0 && totalDistanceKm > 0
      ? Number((totalDistanceKm / totalLiters).toFixed(2))
      : 0;

    const avgLiterPerKm = totalDistanceKm > 0
      ? Number((totalLiters / totalDistanceKm).toFixed(4))
      : 0;

    const avgLiterPer100Km = Number((avgLiterPerKm * 100).toFixed(2));
    const avgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;

    const targetRatio = FUEL_TARGET_RATIOS[item.vehicleType]?.target || 7.5;
    const targetLiterPerKm = Number((1 / targetRatio).toFixed(4));
    const variancePercent = targetRatio > 0
      ? Number((((avgKmPerLiter - targetRatio) / targetRatio) * 100).toFixed(1))
      : 0;

    let status: EfficiencyStatus = 'Efisien / Normal';
    if (avgKmPerLiter >= targetRatio * 1.05) {
      status = 'Sangat Efisien';
    } else if (avgKmPerLiter >= targetRatio * 0.90) {
      status = 'Efisien / Normal';
    } else if (avgKmPerLiter >= targetRatio * 0.75) {
      status = 'Boros';
    } else {
      status = 'Kritis / Potensi Anomali';
    }

    const driverNames = Array.from(new Set(item.logs.map(l => l.driverName).filter(Boolean)));

    return {
      id: `${item.bounds.weekKey}_${item.fleetId}`,
      weekKey: item.bounds.weekKey,
      weekLabel: item.bounds.weekLabel,
      startDate: item.bounds.startDate,
      endDate: item.bounds.endDate,
      fleetId: item.fleetId,
      plateNumber: item.plateNumber,
      initialCode: item.initialCode,
      vehicleType: item.vehicleType,
      refuelCount,
      totalLiters,
      totalCost,
      totalDistanceKm,
      avgKmPerLiter,
      avgLiterPerKm,
      avgLiterPer100Km,
      avgCostPerKm,
      targetRatio,
      targetLiterPerKm,
      variancePercent,
      status,
      driverNames
    };
  });

  // Sort descending by weekKey, then by plateNumber
  return results.sort((a, b) => b.weekKey.localeCompare(a.weekKey) || a.plateNumber.localeCompare(b.plateNumber));
}

/**
 * Aggregate logs into weekly summaries per driver
 */
export function computeWeeklyDriverSummaries(logs: FuelLog[]): WeeklyDriverFuelSummary[] {
  // Key: `${weekKey}_${driverName}`
  const grouped: Record<string, {
    bounds: WeekBounds;
    driverId?: string;
    driverName: string;
    logs: FuelLog[];
  }> = {};

  logs.forEach(log => {
    const bounds = getWeekBounds(log.date);
    const key = `${bounds.weekKey}_${log.driverName}`;
    if (!grouped[key]) {
      grouped[key] = {
        bounds,
        driverId: log.driverId,
        driverName: log.driverName,
        logs: []
      };
    }
    grouped[key].logs.push(log);
  });

  const results: WeeklyDriverFuelSummary[] = Object.values(grouped).map(item => {
    const totalLiters = Number(item.logs.reduce((sum, l) => sum + (l.liters || 0), 0).toFixed(1));
    const totalCost = item.logs.reduce((sum, l) => sum + (l.totalCost || 0), 0);
    const totalDistanceKm = item.logs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);
    const refuelCount = item.logs.length;

    const avgKmPerLiter = totalLiters > 0 && totalDistanceKm > 0
      ? Number((totalDistanceKm / totalLiters).toFixed(2))
      : 0;

    const avgLiterPerKm = totalDistanceKm > 0
      ? Number((totalLiters / totalDistanceKm).toFixed(4))
      : 0;

    const avgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;

    // Calculate Eco Score based on target comparison
    let totalTargetRatios = 0;
    item.logs.forEach(l => {
      const tgt = FUEL_TARGET_RATIOS[l.vehicleType]?.target || 7.5;
      totalTargetRatios += tgt;
    });
    const avgTargetRatio = item.logs.length > 0 ? totalTargetRatios / item.logs.length : 7.5;
    const ratioToTarget = avgTargetRatio > 0 ? avgKmPerLiter / avgTargetRatio : 1;
    let ecoScore = Math.round(ratioToTarget * 85);
    if (ecoScore > 98) ecoScore = 98;
    if (ecoScore < 50) ecoScore = 50;

    let predicate: 'Master Eco-Driver' | 'Driver Efisien' | 'Perlu Bimbingan' = 'Driver Efisien';
    if (ecoScore >= 88) {
      predicate = 'Master Eco-Driver';
    } else if (ecoScore < 75) {
      predicate = 'Perlu Bimbingan';
    }

    const fleetPlates = Array.from(new Set(item.logs.map(l => l.plateNumber).filter(Boolean)));

    return {
      id: `${item.bounds.weekKey}_${item.driverName}`,
      weekKey: item.bounds.weekKey,
      weekLabel: item.bounds.weekLabel,
      startDate: item.bounds.startDate,
      endDate: item.bounds.endDate,
      driverId: item.driverId,
      driverName: item.driverName,
      fleetPlates,
      refuelCount,
      totalLiters,
      totalCost,
      totalDistanceKm,
      avgKmPerLiter,
      avgLiterPerKm,
      avgCostPerKm,
      ecoScore,
      predicate
    };
  });

  // Sort descending by weekKey, then by ecoScore
  return results.sort((a, b) => b.weekKey.localeCompare(a.weekKey) || b.ecoScore - a.ecoScore);
}

/**
 * Format Currency in Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

/**
 * Export Multi-Sheet Excel Report
 */
export function exportFuelReportToExcel(options: {
  fleetSummaries: WeeklyFleetFuelSummary[];
  driverSummaries: WeeklyDriverFuelSummary[];
  detailedLogs?: FuelLog[];
  filterWeekKey?: string;
  filterWeekLabel?: string;
}): void {
  const { fleetSummaries, driverSummaries, detailedLogs, filterWeekKey, filterWeekLabel } = options;

  const workbook = XLSX.utils.book_new();

  // 1. Sheet 1: Ringkasan Mingguan Per Armada
  const fleetData = fleetSummaries.map((f, index) => ({
    'No': index + 1,
    'Minggu / Periode': f.weekLabel,
    'Plat Nomor': f.plateNumber,
    'Inisial Armada': f.initialCode,
    'Tipe Kendaraan': f.vehicleType,
    'Frekuensi Isi': f.refuelCount,
    'Total Liter': f.totalLiters,
    'Total Jarak (KM)': f.totalDistanceKm,
    'Total Biaya (Rp)': f.totalCost,
    'Rasio Aktual (KM/L)': f.avgKmPerLiter,
    'Konsumsi (Liter/KM)': f.avgLiterPerKm,
    'Konsumsi (L/100 KM)': f.avgLiterPer100Km,
    'Target Rasio (KM/L)': f.targetRatio,
    'Variansi vs Target (%)': `${f.variancePercent > 0 ? '+' : ''}${f.variancePercent}%`,
    'Biaya/KM (Rp)': f.avgCostPerKm,
    'Status Efisiensi': f.status,
    'Pengemudi Bertugas': f.driverNames.join(', ')
  }));

  const fleetWs = XLSX.utils.json_to_sheet(fleetData);
  // Auto-width columns
  fleetWs['!cols'] = [
    { wch: 5 },  // No
    { wch: 32 }, // Minggu
    { wch: 14 }, // Plat
    { wch: 14 }, // Inisial
    { wch: 16 }, // Tipe
    { wch: 12 }, // Freq
    { wch: 12 }, // Liter
    { wch: 15 }, // Jarak
    { wch: 18 }, // Biaya
    { wch: 18 }, // Rasio
    { wch: 18 }, // Liter/KM
    { wch: 18 }, // L/100 KM
    { wch: 16 }, // Target
    { wch: 16 }, // Variansi
    { wch: 14 }, // Biaya/KM
    { wch: 22 }, // Status
    { wch: 28 }  // Driver
  ];
  XLSX.utils.book_append_sheet(workbook, fleetWs, 'Ringkasan_Mingguan_Armada');

  // 2. Sheet 2: Ringkasan Mingguan Per Driver
  const driverData = driverSummaries.map((d, index) => ({
    'No': index + 1,
    'Minggu / Periode': d.weekLabel,
    'Nama Driver': d.driverName,
    'Armada Dikemudikan': d.fleetPlates.join(', '),
    'Frekuensi Isi BBM': d.refuelCount,
    'Total Liter BBM': d.totalLiters,
    'Total Jarak Tempuh (KM)': d.totalDistanceKm,
    'Total Biaya BBM (Rp)': d.totalCost,
    'Rasio Efisiensi (KM/L)': d.avgKmPerLiter,
    'Konsumsi (Liter/KM)': d.avgLiterPerKm,
    'Biaya BBM / KM (Rp)': d.avgCostPerKm,
    'Skor Eco-Driving': d.ecoScore,
    'Predikat': d.predicate
  }));

  const driverWs = XLSX.utils.json_to_sheet(driverData);
  driverWs['!cols'] = [
    { wch: 5 },  // No
    { wch: 32 }, // Minggu
    { wch: 22 }, // Nama
    { wch: 22 }, // Plat
    { wch: 16 }, // Freq
    { wch: 14 }, // Liter
    { wch: 22 }, // Jarak
    { wch: 18 }, // Biaya
    { wch: 20 }, // Rasio
    { wch: 18 }, // Liter/KM
    { wch: 18 }, // Biaya/KM
    { wch: 16 }, // Skor
    { wch: 20 }  // Predikat
  ];
  XLSX.utils.book_append_sheet(workbook, driverWs, 'Ringkasan_Mingguan_Driver');

  // 3. Sheet 3: Detail Transaksi Log Pengisian BBM
  if (detailedLogs && detailedLogs.length > 0) {
    const detailedData = detailedLogs.map((l, index) => ({
      'No': index + 1,
      'ID Log': l.id,
      'Tanggal': l.date,
      'Plat Nomor': l.plateNumber,
      'Inisial': l.initialCode || '-',
      'Tipe Kendaraan': l.vehicleType,
      'Driver': l.driverName,
      'Jenis BBM': l.fuelType,
      'Volume (Liter)': l.liters,
      'Harga / Liter (Rp)': l.costPerLiter,
      'Total Biaya (Rp)': l.totalCost,
      'KM Awal': l.startOdometerKm,
      'KM Akhir': l.endOdometerKm,
      'Jarak Tempuh (KM)': l.distanceKm,
      'Rasio (KM/L)': l.ratioKmPerLiter,
      'Target Rasio (KM/L)': l.targetRatio,
      'Konsumsi (Liter/KM)': l.literPerKm || Number((l.liters / l.distanceKm).toFixed(4)),
      'Status': l.efficiencyStatus,
      'Nama SPBU': l.gasStation,
      'No Struk': l.receiptNumber || '-',
      'Rute Pengiriman': l.routeTrip || '-',
      'Catatan': l.notes || '-'
    }));
    const logWs = XLSX.utils.json_to_sheet(detailedData);
    logWs['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
      { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 16 },
      { wch: 28 }, { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(workbook, logWs, 'Detail_Log_BBM');
  }

  // 4. Sheet 4: Standar Target BBM PT AKK
  const targetData = [
    { 'Tipe Kendaraan': 'Pick Up Box', 'Target KM/L': 11.0, 'Batas Toleransi Min': 9.5, 'Target Liter/KM': 0.0909, 'Target L/100 KM': 9.09 },
    { 'Tipe Kendaraan': 'Engkel STD', 'Target KM/L': 8.2, 'Batas Toleransi Min': 7.0, 'Target Liter/KM': 0.1220, 'Target L/100 KM': 12.20 },
    { 'Tipe Kendaraan': 'Engkel Long', 'Target KM/L': 7.5, 'Batas Toleransi Min': 6.4, 'Target Liter/KM': 0.1333, 'Target L/100 KM': 13.33 },
    { 'Tipe Kendaraan': 'Double STD', 'Target KM/L': 6.2, 'Batas Toleransi Min': 5.2, 'Target Liter/KM': 0.1613, 'Target L/100 KM': 16.13 }
  ];
  const targetWs = XLSX.utils.json_to_sheet(targetData);
  XLSX.utils.book_append_sheet(workbook, targetWs, 'Standar_Target_BBM');

  const fileDate = new Date().toISOString().split('T')[0];
  const periodSlug = filterWeekKey ? `_${filterWeekKey}` : '_Semua_Minggu';
  const fileName = `Laporan_Konsumsi_BBM_Mingguan_AKK${periodSlug}_${fileDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export Formatted Multi-Page PDF Report
 */
export function exportFuelReportToPDF(options: {
  fleetSummaries: WeeklyFleetFuelSummary[];
  driverSummaries: WeeklyDriverFuelSummary[];
  filterWeekKey?: string;
  filterWeekLabel?: string;
  printedBy?: string;
}): void {
  const { fleetSummaries, driverSummaries, filterWeekKey, filterWeekLabel, printedBy } = options;

  // Use landscape A4 (297 x 210 mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const totalLiters = Number(fleetSummaries.reduce((acc, f) => acc + f.totalLiters, 0).toFixed(1));
  const totalCost = fleetSummaries.reduce((acc, f) => acc + f.totalCost, 0);
  const totalDistance = fleetSummaries.reduce((acc, f) => acc + f.totalDistanceKm, 0);
  const avgKmPerL = totalLiters > 0 ? Number((totalDistance / totalLiters).toFixed(2)) : 0;
  const avgLPerKm = totalDistance > 0 ? Number((totalLiters / totalDistance).toFixed(4)) : 0;

  let currentPage = 1;

  const renderHeader = (titleSection: string) => {
    // Top Brand Bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, margin, contentWidth, 22, 'F');

    doc.setFillColor(245, 158, 11); // amber-500 line
    doc.rect(margin, margin + 22, contentWidth, 1.5, 'F');

    // Company Name & Subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PT ANUGRAH KEMASAN KREATIF', margin + 6, margin + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text('DIVISI LOGISTIK & TRANSPORTASI ARMADA DISTRIBUSI KARTON BOX', margin + 6, margin + 14);

    doc.setTextColor(251, 191, 36); // amber-400
    doc.setFont('helvetica', 'bold');
    doc.text(`LAPORAN KONSUMSI BBM & EFISIENSI MINGGUAN`, margin + 6, margin + 19);

    // Right Meta info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    const datePrinted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Periode: ${filterWeekLabel || 'Seluruh Periode Terdata'}`, pageWidth - margin - 6, margin + 7, { align: 'right' });
    doc.text(`Tanggal Cetak: ${datePrinted}`, pageWidth - margin - 6, margin + 12, { align: 'right' });
    doc.text(`Penyusun: ${printedBy || 'Bayu Novianto (Super Admin Logistik)'}`, pageWidth - margin - 6, margin + 17, { align: 'right' });

    // Section Subheader title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(titleSection, margin, margin + 29);
  };

  const renderFooter = (page: number, totalP: number) => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Sistem Informasi Manajemen Logistik & Efisiensi BBM - PT Anugrah Kemasan Kreatif', margin, pageHeight - 8);
    doc.text(`Halaman ${page} dari ${totalP}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  // ==========================================
  // PAGE 1: FLEET WEEKLY SUMMARY
  // ==========================================
  renderHeader('BAGIAN I: RINGKASAN KONSUMSI BBM MINGGUAN PER ARMADA KENDARAAN');

  // KPI Highlight Box
  let yPos = margin + 33;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.rect(margin, yPos, contentWidth, 14, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL BBM:', margin + 4, yPos + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalLiters.toLocaleString('id-ID')} Liter`, margin + 4, yPos + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL JARAK:', margin + 48, yPos + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalDistance.toLocaleString('id-ID')} KM`, margin + 48, yPos + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL BIAYA BBM:', margin + 96, yPos + 5);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.setFont('helvetica', 'bold');
  doc.text(formatRupiah(totalCost), margin + 96, yPos + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('RERATA RASIO ARMADA:', margin + 155, yPos + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgKmPerL} KM / Liter`, margin + 155, yPos + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('KONSUMSI LITER / KM:', margin + 215, yPos + 5);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgLPerKm} L/KM (${(avgLPerKm * 100).toFixed(2)} L/100KM)`, margin + 215, yPos + 10);

  // Fleet Table Header
  yPos += 18;
  const colWidthsFleet = [8, 42, 22, 16, 26, 12, 18, 20, 26, 16, 16, 16, 35];
  const colHeadersFleet = [
    'No',
    'Periode Minggu',
    'Plat Nomor',
    'Inisial',
    'Tipe Kendaraan',
    'Rit',
    'Liter',
    'Jarak (KM)',
    'Total Biaya (Rp)',
    'KM/L',
    'L/KM',
    'Target',
    'Status Efisiensi'
  ];

  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, yPos, contentWidth, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  let currentX = margin;
  colHeadersFleet.forEach((h, i) => {
    const align = (i >= 5 && i <= 11) ? 'right' : 'left';
    const textX = align === 'right' ? currentX + colWidthsFleet[i] - 2 : currentX + 2;
    doc.text(h, textX, yPos + 4.8, { align });
    currentX += colWidthsFleet[i];
  });

  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  fleetSummaries.forEach((f, idx) => {
    // Page overflow check
    if (yPos > pageHeight - 35) {
      renderFooter(currentPage, 2);
      doc.addPage();
      currentPage++;
      renderHeader('BAGIAN I: RINGKASAN KONSUMSI BBM MINGGUAN PER ARMADA (LANJUTAN)');
      yPos = margin + 33;

      // Repeat table header
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, yPos, contentWidth, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      let cx = margin;
      colHeadersFleet.forEach((h, i) => {
        const align = (i >= 5 && i <= 11) ? 'right' : 'left';
        const textX = align === 'right' ? cx + colWidthsFleet[i] - 2 : cx + 2;
        doc.text(h, textX, yPos + 4.8, { align });
        cx += colWidthsFleet[i];
      });
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
    }

    // Row alternating background
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 6, 'F');
    }

    doc.setTextColor(15, 23, 42);

    let cx = margin;
    const rowValues = [
      (idx + 1).toString(),
      f.weekLabel.length > 25 ? f.weekLabel.substring(0, 25) + '...' : f.weekLabel,
      f.plateNumber,
      f.initialCode || '-',
      f.vehicleType,
      f.refuelCount.toString(),
      f.totalLiters.toFixed(1),
      f.totalDistanceKm.toLocaleString('id-ID'),
      formatRupiah(f.totalCost),
      f.avgKmPerLiter.toFixed(2),
      f.avgLiterPerKm.toFixed(4),
      f.targetRatio.toFixed(1),
      f.status
    ];

    rowValues.forEach((val, i) => {
      const align = (i >= 5 && i <= 11) ? 'right' : 'left';
      const textX = align === 'right' ? cx + colWidthsFleet[i] - 2 : cx + 2;

      // Color status column
      if (i === 12) {
        if (f.status === 'Sangat Efisien') {
          doc.setTextColor(16, 185, 129); // green
        } else if (f.status === 'Efisien / Normal') {
          doc.setTextColor(2, 132, 199); // blue
        } else if (f.status === 'Boros') {
          doc.setTextColor(217, 119, 6); // amber
        } else {
          doc.setTextColor(225, 29, 72); // rose
        }
      } else {
        doc.setTextColor(15, 23, 42);
      }

      doc.text(val, textX, yPos + 4.2, { align });
      cx += colWidthsFleet[i];
    });

    yPos += 6;
  });

  // Fleet Totals row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, yPos, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL REKAPITULASI ARMADA', margin + 4, yPos + 4.5);
  doc.text(`${totalLiters.toFixed(1)} L`, margin + 124, yPos + 4.5, { align: 'right' });
  doc.text(`${totalDistance.toLocaleString('id-ID')} KM`, margin + 144, yPos + 4.5, { align: 'right' });
  doc.text(formatRupiah(totalCost), margin + 170, yPos + 4.5, { align: 'right' });
  doc.text(`${avgKmPerL}`, margin + 186, yPos + 4.5, { align: 'right' });
  doc.text(`${avgLPerKm}`, margin + 202, yPos + 4.5, { align: 'right' });

  renderFooter(currentPage, 2);

  // ==========================================
  // PAGE 2: DRIVER WEEKLY SUMMARY & SIGNATURES
  // ==========================================
  doc.addPage();
  currentPage++;
  renderHeader('BAGIAN II: RINGKASAN KONSUMSI BBM MINGGUAN PER DRIVER / KRU PENGIRIMAN');

  yPos = margin + 33;

  const colWidthsDriver = [10, 48, 40, 35, 15, 20, 24, 28, 18, 18, 19];
  const colHeadersDriver = [
    'No',
    'Periode Minggu',
    'Nama Driver / Kru',
    'Armada Dikemudikan',
    'Rit',
    'Total Liter',
    'Jarak Tempuh (KM)',
    'Total Biaya (Rp)',
    'KM / L',
    'Liter / KM',
    'Predikat Eco'
  ];

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, yPos, contentWidth, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  currentX = margin;
  colHeadersDriver.forEach((h, i) => {
    const align = (i >= 4 && i <= 9) ? 'right' : 'left';
    const textX = align === 'right' ? currentX + colWidthsDriver[i] - 2 : currentX + 2;
    doc.text(h, textX, yPos + 4.8, { align });
    currentX += colWidthsDriver[i];
  });

  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  driverSummaries.forEach((d, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 6, 'F');
    }

    doc.setTextColor(15, 23, 42);

    let cx = margin;
    const rowValues = [
      (idx + 1).toString(),
      d.weekLabel.length > 28 ? d.weekLabel.substring(0, 28) + '...' : d.weekLabel,
      d.driverName,
      d.fleetPlates.join(', ') || '-',
      d.refuelCount.toString(),
      d.totalLiters.toFixed(1),
      d.totalDistanceKm.toLocaleString('id-ID'),
      formatRupiah(d.totalCost),
      d.avgKmPerLiter.toFixed(2),
      d.avgLiterPerKm.toFixed(4),
      d.predicate
    ];

    rowValues.forEach((val, i) => {
      const align = (i >= 4 && i <= 9) ? 'right' : 'left';
      const textX = align === 'right' ? cx + colWidthsDriver[i] - 2 : cx + 2;

      if (i === 10) {
        if (d.predicate === 'Master Eco-Driver') {
          doc.setTextColor(16, 185, 129);
        } else if (d.predicate === 'Driver Efisien') {
          doc.setTextColor(2, 132, 199);
        } else {
          doc.setTextColor(217, 119, 6);
        }
      } else {
        doc.setTextColor(15, 23, 42);
      }

      doc.text(val, textX, yPos + 4.2, { align });
      cx += colWidthsDriver[i];
    });

    yPos += 6;
  });

  // Signature Block at Bottom
  const sigY = pageHeight - 48;
  const colSigWidth = contentWidth / 3;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, sigY, contentWidth, 32, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  // Column 1: Disiapkan
  doc.text('Dibuat & Dihitung Oleh:', margin + 10, sigY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Admin Logistik & Efisiensi Armada', margin + 10, sigY + 10);
  const coordinatorName = logisticsStore.getLogisticsCoordinator();
  doc.text(`( ${coordinatorName} )`, margin + 10, sigY + 27);

  // Column 2: Diperiksa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Diperiksa & Diaudit Oleh:', margin + colSigWidth + 10, sigY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Koordinator Lapangan & Transportasi', margin + colSigWidth + 10, sigY + 10);
  doc.text('( Bayu Novianto D.P., S.Si )', margin + colSigWidth + 10, sigY + 27);

  // Column 3: Disetujui
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Disetujui Oleh:', margin + (colSigWidth * 2) + 10, sigY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Manajer Operasional & Distribusi', margin + (colSigWidth * 2) + 10, sigY + 10);
  doc.text('( Ir. Hadi Suryanto, M.M. )', margin + (colSigWidth * 2) + 10, sigY + 27);

  renderFooter(currentPage, 2);

  const fileDate = new Date().toISOString().split('T')[0];
  const periodSlug = filterWeekKey ? `_${filterWeekKey}` : '_Semua_Minggu';
  const fileName = `Laporan_Resmi_Konsumsi_BBM_AKK${periodSlug}_${fileDate}.pdf`;
  doc.save(fileName);
}
