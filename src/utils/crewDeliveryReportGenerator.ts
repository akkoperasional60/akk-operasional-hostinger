import { jsPDF } from 'jspdf';
import { Crew, CrewDeliveryHistory, Fleet } from '../types';
import { logisticsStore } from '../services/store';

export interface CrewReportOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  selectedCrewId?: string; // 'all' or ID
  selectedArea?: string;   // 'all' or area name
  printedBy?: string;
  threshold?: number;
}

export interface CrewPerformanceSummary {
  crewId: string;
  crewName: string;
  role: string;
  totalTrips: number;
  topArea: string;
  topAreaCount: number;
  frequentPlate: string;
  frequentInitial: string;
  rating: number;
  exceededCount: number;
  status: 'Aman' | 'Mendekati Batas' | 'Perlu Dispensasi';
}

export interface AreaPerformanceSummary {
  areaName: string;
  island: string;
  totalTrips: number;
  percentage: number;
  topCrewName: string;
}

/**
 * Format date string into Indonesian readable format: DD Mmm YYYY
 */
export function formatIndoDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Filter delivery history by date range and optional crew/area filters
 */
export function filterHistoryByDateRange(
  history: CrewDeliveryHistory[],
  options: CrewReportOptions
): CrewDeliveryHistory[] {
  const { startDate, endDate, selectedCrewId = 'all', selectedArea = 'all' } = options;

  const startIso = startDate ? `${startDate.substring(0, 10)}T00:00:00.000Z` : '2000-01-01';
  const endIso = endDate ? `${endDate.substring(0, 10)}T23:59:59.999Z` : '2099-12-31';

  const startTime = new Date(startIso).getTime();
  const endTime = new Date(endIso).getTime();

  return history.filter(item => {
    const itemDate = new Date(item.completionDate).getTime();
    if (isNaN(itemDate)) return false;

    // Check date bounds
    if (itemDate < startTime || itemDate > endTime) return false;

    // Check crew filter
    if (selectedCrewId !== 'all' && item.crewId !== selectedCrewId) return false;

    // Check area filter
    if (selectedArea !== 'all') {
      const q = selectedArea.toLowerCase();
      const matchIsland = (item.island || '').toLowerCase().includes(q);
      const matchArea = (item.area || '').toLowerCase().includes(q);
      if (!matchIsland && !matchArea) return false;
    }

    return true;
  });
}

/**
 * Compile summaries for each crew within the filtered dataset
 */
export function buildCrewSummaries(
  filteredHistory: CrewDeliveryHistory[],
  crews: Crew[],
  threshold: number = 3
): CrewPerformanceSummary[] {
  const map: Record<string, {
    crewId: string;
    crewName: string;
    role: string;
    totalTrips: number;
    rating: number;
    areas: Record<string, number>;
    plates: Record<string, number>;
    initials: Record<string, number>;
  }> = {};

  filteredHistory.forEach(item => {
    const key = item.crewId || item.crewName;
    if (!map[key]) {
      const crewObj = crews.find(c => c.id === item.crewId || c.name === item.crewName);
      map[key] = {
        crewId: item.crewId,
        crewName: item.crewName,
        role: crewObj?.role || 'Driver Utama',
        totalTrips: 0,
        rating: crewObj?.rating || 4.8,
        areas: {},
        plates: {},
        initials: {}
      };
    }

    map[key].totalTrips += 1;

    // Areas
    const a = item.area || 'Banyuwangi';
    map[key].areas[a] = (map[key].areas[a] || 0) + 1;

    // Plates
    const p = item.vehiclePlate || '-';
    map[key].plates[p] = (map[key].plates[p] || 0) + 1;

    // Initials
    const init = item.initialCode || (item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1]) || '-';
    map[key].initials[init] = (map[key].initials[init] || 0) + 1;
  });

  return Object.values(map).map(c => {
    // Top area
    let topArea = '-';
    let topAreaCount = 0;
    let exceededCount = 0;
    Object.entries(c.areas).forEach(([area, count]) => {
      if (count > topAreaCount) {
        topArea = area;
        topAreaCount = count;
      }
      if (count >= threshold) {
        exceededCount++;
      }
    });

    // Frequent plate
    let frequentPlate = '-';
    let maxP = 0;
    Object.entries(c.plates).forEach(([plate, count]) => {
      if (count > maxP) {
        frequentPlate = plate;
        maxP = count;
      }
    });

    // Frequent initial
    let frequentInitial = '-';
    let maxInit = 0;
    Object.entries(c.initials).forEach(([init, count]) => {
      if (count > maxInit) {
        frequentInitial = init;
        maxInit = count;
      }
    });

    let status: 'Aman' | 'Mendekati Batas' | 'Perlu Dispensasi' = 'Aman';
    if (topAreaCount > threshold) {
      status = 'Perlu Dispensasi';
    } else if (topAreaCount === threshold) {
      status = 'Mendekati Batas';
    }

    return {
      crewId: c.crewId,
      crewName: c.crewName,
      role: c.role,
      totalTrips: c.totalTrips,
      topArea,
      topAreaCount,
      frequentPlate,
      frequentInitial,
      rating: c.rating,
      exceededCount,
      status
    };
  }).sort((a, b) => b.totalTrips - a.totalTrips);
}

/**
 * Compile summaries for each delivery area
 */
export function buildAreaSummaries(filteredHistory: CrewDeliveryHistory[]): AreaPerformanceSummary[] {
  const map: Record<string, {
    areaName: string;
    island: string;
    totalTrips: number;
    crews: Record<string, number>;
  }> = {};

  const totalAllTrips = filteredHistory.length;

  filteredHistory.forEach(item => {
    const a = item.area || 'Banyuwangi';
    if (!map[a]) {
      map[a] = {
        areaName: a,
        island: item.island || 'Jawa Timur',
        totalTrips: 0,
        crews: {}
      };
    }
    map[a].totalTrips += 1;
    map[a].crews[item.crewName] = (map[a].crews[item.crewName] || 0) + 1;
  });

  return Object.values(map).map(a => {
    let topCrewName = '-';
    let maxC = 0;
    Object.entries(a.crews).forEach(([crew, count]) => {
      if (count > maxC) {
        topCrewName = crew;
        maxC = count;
      }
    });

    return {
      areaName: a.areaName,
      island: a.island,
      totalTrips: a.totalTrips,
      percentage: totalAllTrips > 0 ? Number(((a.totalTrips / totalAllTrips) * 100).toFixed(1)) : 0,
      topCrewName
    };
  }).sort((a, b) => b.totalTrips - a.totalTrips);
}

/**
 * Generate and trigger download of the Official Crew Delivery Performance PDF Report
 */
export function generateCrewDeliveryPerformancePdf(
  allHistory: CrewDeliveryHistory[],
  crews: Crew[],
  fleets: Fleet[],
  options: CrewReportOptions
): { success: boolean; totalRecords: number; fileName: string } {
  const threshold = options.threshold || 3;
  const filteredHistory = filterHistoryByDateRange(allHistory, options);
  const crewSummaries = buildCrewSummaries(filteredHistory, crews, threshold);
  const areaSummaries = buildAreaSummaries(filteredHistory);

  // Landscape A4: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = 1;

  // Key KPI numbers
  const totalTrips = filteredHistory.length;
  const totalActiveCrews = crewSummaries.length;
  const totalAreas = areaSummaries.length;
  const uniquePlates = new Set(filteredHistory.map(h => h.vehiclePlate)).size;
  const complianceTrips = crewSummaries.filter(c => c.status !== 'Perlu Dispensasi').length;
  const complianceRate = totalActiveCrews > 0 ? Math.round((complianceTrips / totalActiveCrews) * 100) : 100;
  const avgTripsPerCrew = totalActiveCrews > 0 ? (totalTrips / totalActiveCrews).toFixed(1) : '0';

  const crewFilterName = options.selectedCrewId && options.selectedCrewId !== 'all'
    ? crews.find(c => c.id === options.selectedCrewId)?.name || options.selectedCrewId
    : 'Semua Kru Pengemudi';

  const areaFilterName = options.selectedArea && options.selectedArea !== 'all'
    ? options.selectedArea
    : 'Semua Area Distribusi';

  // Helper Header
  const renderHeader = (sectionTitle: string) => {
    // Top Brand Accent Bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, margin, contentWidth, 23, 'F');

    // Accent line
    doc.setFillColor(245, 158, 11); // amber-500
    doc.rect(margin, margin + 22, contentWidth, 1.2, 'F');

    // Brand Name & Logo mark
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PT ANUGRAH KEMASAN KREATIF — LOGISTICS & FLEET OPERATION', margin + 6, margin + 7);

    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Gudang Distribusi Sukowidi DC Banyuwangi • Hub Transportasi Jawa Timur & Bali', margin + 6, margin + 12);

    doc.setTextColor(251, 191, 36); // amber-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('LAPORAN RESMI KINERJA PENGIRIMAN & ROTASI WILAYAH KRU', margin + 6, margin + 18.5);

    // Right Metadata block
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240); // slate-200
    const printDate = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const periodStr = `${formatIndoDate(options.startDate)} s/d ${formatIndoDate(options.endDate)}`;
    doc.text(`Periode: ${periodStr}`, pageWidth - margin - 6, margin + 7, { align: 'right' });
    doc.text(`Filter Kru: ${crewFilterName}`, pageWidth - margin - 6, margin + 11.5, { align: 'right' });
    doc.text(`Tanggal Cetak: ${printDate} • Oleh: ${options.printedBy || 'Koordinator Distribusi Logistik'}`, pageWidth - margin - 6, margin + 16, { align: 'right' });
    doc.text(`Standar SOP Batas Rotasi: Maksimal ${threshold}x Trip / Area`, pageWidth - margin - 6, margin + 20.5, { align: 'right' });

    // Section title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(sectionTitle, margin, margin + 29);
  };

  // Helper Footer
  const renderFooter = (page: number, totalP: number) => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Sistem Operasional Logistik Terpadu PT Anugrah Kemasan Kreatif — Dokumen Resmi Terverifikasi', margin, pageHeight - 6);
    doc.text(`Halaman ${page} dari ${totalP}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  // ========================================================
  // PAGE 1: EXECUTIVE SUMMARY & CREW PERFORMANCE TABLE
  // ========================================================
  renderHeader('BAGIAN I: RINGKASAN EKSEKUTIF & EVALUASI KINERJA PENGEMUDI');

  // Executive KPI Highlight Cards
  let yPos = margin + 33;
  const kpiWidth = (contentWidth - 10) / 6;
  const kpis = [
    { title: 'TOTAL RITASE', val: `${totalTrips} Rit`, sub: 'Pengiriman Terdata', color: [30, 41, 59], valColor: [15, 23, 42] },
    { title: 'KRU AKTIF', val: `${totalActiveCrews} Supir`, sub: 'Pengemudi Bertugas', color: [30, 41, 59], valColor: [37, 99, 235] },
    { title: 'AREA TERLAYANI', val: `${totalAreas} Wilayah`, sub: 'Jatim & Bali', color: [30, 41, 59], valColor: [79, 70, 229] },
    { title: 'ARMADA OPERASI', val: `${uniquePlates} Truk`, sub: 'Armada PT AKK', color: [30, 41, 59], valColor: [13, 148, 136] },
    { title: 'KEPATUHAN SOP', val: `${complianceRate}%`, sub: `Maks ${threshold}x Trip Area`, color: [30, 41, 59], valColor: complianceRate >= 85 ? [16, 185, 129] : [239, 68, 68] },
    { title: 'RERATA RITASE', val: `${avgTripsPerCrew} Rit`, sub: 'Rerata per Supir', color: [30, 41, 59], valColor: [217, 119, 6] }
  ];

  kpis.forEach((kpi, idx) => {
    const kx = margin + idx * (kpiWidth + 2);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(kx, yPos, kpiWidth, 14, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, kx + 3, yPos + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.valColor[0], kpi.valColor[1], kpi.valColor[2]);
    doc.text(kpi.val, kx + 3, yPos + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, kx + 3, yPos + 12.5);
  });

  // Table 1: Crew Performance Summary Table
  yPos += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Tabel 1: Rekapitulasi Produktivitas Pengemudi & Pengendalian Rotasi Wilayah', margin, yPos);
  yPos += 3.5;

  const crewColWidths = [10, 45, 30, 20, 45, 24, 30, 25, 44];
  const crewColHeaders = [
    'No',
    'Nama Pengemudi',
    'Peran / Posisi',
    'Total Rit',
    'Area Tersering & Frekuensi',
    'Inisial Mobil',
    'Plat Truk Utama',
    'Rating',
    'Status Kepatuhan Rotasi'
  ];

  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, yPos, contentWidth, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);

  let curX = margin;
  crewColHeaders.forEach((h, i) => {
    const align = i === 0 || i === 3 || i === 7 ? 'center' : 'left';
    const tx = align === 'center' ? curX + crewColWidths[i] / 2 : curX + 2;
    doc.text(h, tx, yPos + 4.5, { align });
    curX += crewColWidths[i];
  });

  yPos += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  crewSummaries.slice(0, 15).forEach((c, idx) => {
    if (yPos > pageHeight - 25) return; // keep room on page 1

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 5.5, 'F');
    }

    doc.setTextColor(30, 41, 59);
    curX = margin;

    // 0: No
    doc.text(String(idx + 1), curX + crewColWidths[0] / 2, yPos + 4, { align: 'center' });
    curX += crewColWidths[0];

    // 1: Name
    doc.setFont('helvetica', 'bold');
    doc.text(c.crewName, curX + 2, yPos + 4);
    doc.setFont('helvetica', 'normal');
    curX += crewColWidths[1];

    // 2: Role
    doc.text(c.role, curX + 2, yPos + 4);
    curX += crewColWidths[2];

    // 3: Total Rit
    doc.setFont('helvetica', 'bold');
    doc.text(`${c.totalTrips}`, curX + crewColWidths[3] / 2, yPos + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    curX += crewColWidths[3];

    // 4: Area & Frekuensi
    doc.text(`${c.topArea} (${c.topAreaCount}x)`, curX + 2, yPos + 4);
    curX += crewColWidths[4];

    // 5: Inisial
    doc.text(c.frequentInitial, curX + 2, yPos + 4);
    curX += crewColWidths[5];

    // 6: Plat
    doc.text(c.frequentPlate, curX + 2, yPos + 4);
    curX += crewColWidths[6];

    // 7: Rating
    doc.text(`${c.rating.toFixed(1)} / 5.0`, curX + crewColWidths[7] / 2, yPos + 4, { align: 'center' });
    curX += crewColWidths[7];

    // 8: Status Rotasi Badge
    if (c.status === 'Perlu Dispensasi') {
      doc.setTextColor(220, 38, 38); // red-600
      doc.setFont('helvetica', 'bold');
      doc.text(`* ${c.status} (>${threshold}x)`, curX + 2, yPos + 4);
    } else if (c.status === 'Mendekati Batas') {
      doc.setTextColor(217, 119, 6); // amber-600
      doc.setFont('helvetica', 'bold');
      doc.text(`! ${c.status} (= ${threshold}x)`, curX + 2, yPos + 4);
    } else {
      doc.setTextColor(22, 101, 52); // green-700
      doc.text(`OK ${c.status}`, curX + 2, yPos + 4);
    }
    doc.setFont('helvetica', 'normal');

    yPos += 5.5;
  });

  renderFooter(1, 3);

  // ========================================================
  // PAGE 2: AREA DISTRIBUTION & STATISTICAL ANALYSIS
  // ========================================================
  doc.addPage();
  currentPage = 2;
  renderHeader('BAGIAN II: DISTRIBUSI PENGIRIMAN WILAYAH & BEBAN JALUR RITASE');

  yPos = margin + 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Tabel 2: Peringkat Volume Distribusi Per Wilayah / Koridor Pengiriman', margin, yPos);
  yPos += 4;

  const areaColWidths = [12, 60, 45, 35, 35, 86];
  const areaColHeaders = [
    'No',
    'Nama Area / Jalur Distribusi',
    'Kelompok Wilayah',
    'Total Ritase',
    'Porsi Distribusi (%)',
    'Pengemudi Utama yang Sering Melayani'
  ];

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, yPos, contentWidth, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);

  curX = margin;
  areaColHeaders.forEach((h, i) => {
    const align = i === 0 || i === 3 || i === 4 ? 'center' : 'left';
    const tx = align === 'center' ? curX + areaColWidths[i] / 2 : curX + 2;
    doc.text(h, tx, yPos + 4.5, { align });
    curX += areaColWidths[i];
  });

  yPos += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  areaSummaries.forEach((a, idx) => {
    if (yPos > pageHeight - 30) return;

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 6, 'F');
    }

    doc.setTextColor(30, 41, 59);
    curX = margin;

    // No
    doc.text(String(idx + 1), curX + areaColWidths[0] / 2, yPos + 4.2, { align: 'center' });
    curX += areaColWidths[0];

    // Area Name
    doc.setFont('helvetica', 'bold');
    doc.text(a.areaName, curX + 2, yPos + 4.2);
    doc.setFont('helvetica', 'normal');
    curX += areaColWidths[1];

    // Island
    doc.text(a.island, curX + 2, yPos + 4.2);
    curX += areaColWidths[2];

    // Total Trips
    doc.setFont('helvetica', 'bold');
    doc.text(`${a.totalTrips} Rit`, curX + areaColWidths[3] / 2, yPos + 4.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    curX += areaColWidths[3];

    // Percentage
    doc.text(`${a.percentage}%`, curX + areaColWidths[4] / 2, yPos + 4.2, { align: 'center' });
    curX += areaColWidths[4];

    // Top Crew
    doc.text(a.topCrewName, curX + 2, yPos + 4.2);

    yPos += 6;
  });

  // Policy & Operational Guidance Box at Bottom of Page 2
  yPos += 6;
  doc.setFillColor(240, 253, 250); // teal-50
  doc.setDrawColor(204, 251, 241); // teal-100
  doc.rect(margin, yPos, contentWidth, 24, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text('PEDOMAN MANAJEMEN RISIKO FATIGUE & ROTASI WILAYAH PT ANUGRAH KEMASAN KREATIF:', margin + 4, yPos + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Pengemudi yang telah mencapai ambang batas penugasan (default 3x) pada koridor yang sama (terutama luar kota Denpasar/Singaraja)', margin + 4, yPos + 9.5);
  doc.text('   wajib diputar (rotasi) ke jalur lokal atau diberikan jeda pemulihan istirahat minimal 24 jam.', margin + 4, yPos + 13.5);
  doc.text('2. Penugasan lanjutan di area yang sama hanya dapat disahkan apabila telah melalui modul Otorisasi & Dispensasi Resmi Super Admin.', margin + 4, yPos + 17.5);
  doc.text('3. Laporan kinerja ini digunakan sebagai dasar audit bulanan remunerasi, kepatuhan keselamatan jalan, dan evaluasi armada.', margin + 4, yPos + 21.5);

  renderFooter(2, 3);

  // ========================================================
  // PAGE 3: DETAILED DELIVERY ACTIVITY LOG & SIGNATURE
  // ========================================================
  doc.addPage();
  currentPage = 3;
  renderHeader('BAGIAN III: LOG RINCIAN RIWAYAT PENGIRIMAN & LEMBAR PENGESAHAN');

  yPos = margin + 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Tabel 3: Rincian Log Operasional Pengiriman Dalam Rentang Tanggal Terpilih', margin, yPos);
  yPos += 4;

  const logColWidths = [10, 24, 38, 45, 22, 28, 56, 50];
  const logColHeaders = [
    'No',
    'Tanggal',
    'No. Resi / PO',
    'Pengemudi (Crew)',
    'Inisial Mobil',
    'Plat Armada',
    'Area Tujuan / Toko',
    'Status & Keterangan'
  ];

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, yPos, contentWidth, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);

  curX = margin;
  logColHeaders.forEach((h, i) => {
    const align = i === 0 || i === 1 || i === 4 ? 'center' : 'left';
    const tx = align === 'center' ? curX + logColWidths[i] / 2 : curX + 2;
    doc.text(h, tx, yPos + 4.5, { align });
    curX += logColWidths[i];
  });

  yPos += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);

  // Show up to 18 rows to fit with signature block
  const sampleLog = filteredHistory.slice(0, 18);
  sampleLog.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 5, 'F');
    }

    doc.setTextColor(30, 41, 59);
    curX = margin;

    // No
    doc.text(String(idx + 1), curX + logColWidths[0] / 2, yPos + 3.7, { align: 'center' });
    curX += logColWidths[0];

    // Tanggal
    const shortDate = item.completionDate.substring(0, 10);
    doc.text(shortDate, curX + logColWidths[1] / 2, yPos + 3.7, { align: 'center' });
    curX += logColWidths[1];

    // Resi / PO
    doc.setFont('helvetica', 'bold');
    doc.text(item.trackingNumber.substring(0, 18), curX + 2, yPos + 3.7);
    doc.setFont('helvetica', 'normal');
    curX += logColWidths[2];

    // Crew
    doc.text(item.crewName, curX + 2, yPos + 3.7);
    curX += logColWidths[3];

    // Inisial
    const initial = item.initialCode || (item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1]) || '-';
    doc.text(initial, curX + logColWidths[4] / 2, yPos + 3.7, { align: 'center' });
    curX += logColWidths[4];

    // Plat
    doc.text(item.vehiclePlate, curX + 2, yPos + 3.7);
    curX += logColWidths[5];

    // Area & Toko
    const targetLoc = `${item.area} • ${item.storeName.substring(0, 22)}`;
    doc.text(targetLoc, curX + 2, yPos + 3.7);
    curX += logColWidths[6];

    // Status
    doc.text('Selesai / Terkirim Sukses', curX + 2, yPos + 3.7);

    yPos += 5;
  });

  if (filteredHistory.length > 18) {
    yPos += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`* Menampilkan 18 entri teratas dari total ${filteredHistory.length} pengiriman yang terverifikasi dalam rentang tanggal terpilih.`, margin + 2, yPos);
    yPos += 4;
  }

  // Official Signature Block at Bottom of Page 3
  const sigY = pageHeight - 44;
  const colSigWidth = contentWidth / 3;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, sigY, contentWidth, 31, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  // Column 1: Disusun
  doc.text('Disusun & Dilaporkan Oleh:', margin + 8, sigY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Admin Operasional & Logistik Kru', margin + 8, sigY + 9.5);
  const coordinatorName = logisticsStore.getLogisticsCoordinator();
  doc.text(`( ${coordinatorName} )`, margin + 8, sigY + 25.5);

  // Column 2: Diperiksa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Diperiksa & Diverifikasi Oleh:', margin + colSigWidth + 8, sigY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Koordinator Lapangan & Transportasi', margin + colSigWidth + 8, sigY + 9.5);
  doc.text('( Bayu Novianto D.P., S.Si )', margin + colSigWidth + 8, sigY + 25.5);

  // Column 3: Disetujui
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Disetujui & Disahkan Oleh:', margin + (colSigWidth * 2) + 8, sigY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Manajer Distribusi & Rantai Pasok DC', margin + (colSigWidth * 2) + 8, sigY + 9.5);
  doc.text('( Ir. Hadi Suryanto, M.M. )', margin + (colSigWidth * 2) + 8, sigY + 25.5);

  renderFooter(3, 3);

  // File naming and automatic download trigger
  const fileDate = new Date().toISOString().split('T')[0];
  const startSlug = options.startDate ? options.startDate.replace(/-/g, '') : 'all';
  const endSlug = options.endDate ? options.endDate.replace(/-/g, '') : 'all';
  const fileName = `Laporan_Kinerja_Kru_AKK_${startSlug}_sd_${endSlug}_${fileDate}.pdf`;

  doc.save(fileName);

  return {
    success: true,
    totalRecords: filteredHistory.length,
    fileName
  };
}
