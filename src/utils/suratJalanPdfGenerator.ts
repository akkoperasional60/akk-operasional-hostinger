import { jsPDF } from 'jspdf';
import { OutboundWaybill, Schedule, ScannedDocumentLog } from '../types';
import { driverWaybillService } from '../services/driverWaybillService';
import { logisticsStore } from '../services/store';

/**
 * Generate and download Surat Jalan Keluar PDF formatted for 57-58 mm thermal receipt paper
 * with blank signature spaces by default.
 */
export async function downloadSuratJalanPdf(
  waybill: OutboundWaybill,
  _elementToCapture?: HTMLElement | null
): Promise<boolean> {
  const cleanNumber = (waybill.waybillNumber || 'SJ_AKK').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Surat_Jalan_${cleanNumber}.pdf`;

  try {
    // 58mm paper width, height 210mm
    const paperWidth = 58;
    const paperHeight = 210;
    const margin = 3;
    const contentWidth = paperWidth - margin * 2; // 52mm

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperWidth, paperHeight]
    });

    let y = 4.5;

    const drawDashedLine = (yPos: number) => {
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, paperWidth - margin, yPos);
    };

    // Render Official PT AKK Logo Icon (Transparent Background) via offscreen canvas PNG
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 160, 160);
        // Rounded Blue Square
        ctx.fillStyle = '#1273BA';
        ctx.beginPath();
        ctx.roundRect(0, 0, 160, 160, 28);
        ctx.fill();

        // White Monogram 'A' & Arch
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(80.8, 24.8);
        ctx.lineTo(151.2, 150.4);
        ctx.lineTo(130.4, 150.4);
        ctx.lineTo(108.8, 116.8);
        ctx.bezierCurveTo(88.8, 108, 65.6, 98.4, 48.8, 81.6);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(48.8, 97.6);
        ctx.bezierCurveTo(67.2, 107.2, 86.4, 114.4, 108.8, 117.6);
        ctx.lineTo(105.6, 126.4);
        ctx.bezierCurveTo(81.6, 123.2, 60.8, 115.2, 44.8, 105.6);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(10.4, 150.4);
        ctx.bezierCurveTo(19.2, 124, 41.6, 103.2, 73.6, 103.2);
        ctx.bezierCurveTo(96, 103.2, 116, 116, 127.2, 150.4);
        ctx.lineTo(111.2, 150.4);
        ctx.bezierCurveTo(103.2, 127.2, 90.4, 119.2, 73.6, 119.2);
        ctx.bezierCurveTo(54.4, 119.2, 36.8, 132, 27.2, 150.4);
        ctx.closePath();
        ctx.fill();

        // Terracotta Half Dome
        ctx.fillStyle = '#C84B28';
        ctx.beginPath();
        ctx.moveTo(40, 150.4);
        ctx.bezierCurveTo(40, 126.4, 120, 126.4, 120, 150.4);
        ctx.closePath();
        ctx.fill();

        const logoPng = canvas.toDataURL('image/png');
        doc.addImage(logoPng, 'PNG', 9, y, 11, 11);
      }
    } catch {}

    // Stacked Brand Text on Right of Logo Icon (Gambar 11 Lockup)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(21, 58, 94);
    doc.text('PT ANUGRAH', 22, y + 2.8);
    doc.text('KEMASAN', 22, y + 5.6);
    doc.text('KREATIF', 22, y + 8.4);

    doc.setFontSize(5.4);
    doc.setTextColor(200, 75, 40);
    doc.text('SOLUTIF & KREATIF', 22, y + 10.8);

    y += 13.5;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Divisi Logistik & Distribusi Armada', paperWidth / 2, y, { align: 'center' });
    y += 3;
    doc.text('Banyuwangi KM 12 • Telp (0333) 412890', paperWidth / 2, y, { align: 'center' });
    y += 2.5;

    drawDashedLine(y);
    y += 3.5;

    // Document Title & Number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('SURAT JALAN KELUAR', paperWidth / 2, y, { align: 'center' });
    y += 3.5;

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.text(waybill.waybillNumber || 'SJ-OUT/AKK/2026', paperWidth / 2, y, { align: 'center' });
    y += 3.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Tgl: ${waybill.date || new Date().toISOString().slice(0, 10)} | Out: ${waybill.gateOutTime || '07:30'}`, paperWidth / 2, y, { align: 'center' });
    y += 3;
    doc.text(`Resi: ${waybill.trackingNumber || '-'}`, paperWidth / 2, y, { align: 'center' });
    y += 2.5;

    drawDashedLine(y);
    y += 3.5;

    // Destination Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TUJUAN PENGIRIMAN:', margin, y);
    y += 3.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const destNameLines = doc.splitTextToSize(waybill.destination?.storeName || waybill.destination?.areaName || 'Area Tujuan', contentWidth);
    doc.text(destNameLines, margin, y);
    y += destNameLines.length * 3.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const addrLines = doc.splitTextToSize(waybill.destination?.address || 'Banyuwangi', contentWidth);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 3;

    doc.text(`Area : ${waybill.destination?.areaName || '-'}`, margin, y);
    y += 3;
    doc.text(`PIC  : ${waybill.destination?.contactPerson || '-'}`, margin, y);
    y += 3;
    doc.text(`Telp : ${waybill.destination?.phone || '-'}`, margin, y);
    y += 2.5;

    drawDashedLine(y);
    y += 3.5;

    // Fleet & Crew Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ARMADA & KRU PENGEMUDI:', margin, y);
    y += 3.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`${waybill.fleet?.plateNumber || '-'} [${waybill.fleet?.initialCode || 'AKK'}]`, margin, y);
    y += 3.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Tipe   : ${waybill.fleet?.vehicleType || 'Engkel Box'}`, margin, y);
    y += 3;
    doc.text(`Driver : ${waybill.crew?.driverName || '-'}`, margin, y);
    y += 3;
    doc.text(`Helper : ${waybill.crew?.helperName || '-'}`, margin, y);
    y += 3;
    doc.text(`Telp   : ${waybill.crew?.driverPhone || '-'}`, margin, y);
    y += 2.5;

    drawDashedLine(y);
    y += 3.5;

    // Gate-Pass Verification Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('VERIFIKASI GATE-OUT DC PT AKK', paperWidth / 2, y, { align: 'center' });
    y += 3;
    doc.setFont('courier', 'normal');
    doc.setFontSize(5.8);
    const qrPayload = waybill.qrCodeData || `PT_AKK|${waybill.waybillNumber}`;
    const qrLines = doc.splitTextToSize(qrPayload, contentWidth);
    doc.text(qrLines, paperWidth / 2, y, { align: 'center' });
    y += qrLines.length * 2.6 + 1.5;

    drawDashedLine(y);
    y += 3.5;

    // Signatures Section (2x2 Grid for 58mm paper, Blank by Default)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('KOLOM TANDA TANGAN (TTD):', paperWidth / 2, y, { align: 'center' });
    y += 3.5;

    const formatConcisePdfName = (raw?: string) => {
      if (!raw) return '-';
      const cleaned = raw
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/^Super\s+Admin$/i, 'Admin')
        .replace(/^(MUHAMMAD|MOHAMAD|MOCHAMAD|MUH\.?)\s+/i, 'M. ')
        .trim();
      const parts = cleaned.split(/\s+/).filter(Boolean);
      if (parts.length <= 2) return parts.join(' ');
      if (parts[0] === 'M.') return `M. ${parts[1]} ${parts[2].charAt(0)}.`;
      return `${parts[0]} ${parts[1].charAt(0)}.`;
    };

    const allUsers = logisticsStore.getUsers();
    const spvName = formatConcisePdfName(waybill.preparedByName || allUsers.find(u => u.role === 'spv_logistik')?.fullName || 'M. Syaiful B.');
    const operasionalName = formatConcisePdfName(waybill.acknowledgedByName || allUsers.find(u => u.role === 'operasional')?.fullName || 'Bayu Novianto Dimas Permana');
    const secName = formatConcisePdfName(waybill.securityOfficerName || allUsers.find(u => u.role === 'security')?.fullName || 'Hairul Rozikin');
    const dFirst = (waybill.crew?.driverName || 'Driver').replace(/^Super\s+Admin$/i, 'Admin').replace(/^(MUHAMMAD|MOHAMAD|MOCHAMAD)\s+/i, '').trim().split(/\s+/)[0];
    const hFirst = (waybill.crew?.helperName || '').replace(/^(MUHAMMAD|MOHAMAD|MOCHAMAD)\s+/i, '').trim().split(/\s+/)[0];
    const crewName = hFirst && hFirst !== '-' ? `${dFirst} / ${hFirst}` : dFirst;

    const colW = contentWidth / 2;
    const leftX = margin + colW / 2;
    const rightX = margin + colW + colW / 2;

    // Row 1: SPV Logistik & Operasional
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('Disiapkan (SPV):', leftX, y, { align: 'center' });
    doc.text('Operasional:', rightX, y, { align: 'center' });

    // Blank space for manual/initial signature (13mm vertical space)
    if (waybill.preparedBySigned === true) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.text('[TTD Terisi]', leftX, y + 7, { align: 'center' });
    }
    if (waybill.acknowledgedBySigned === true) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.text('[TTD Terisi]', rightX, y + 7, { align: 'center' });
    }

    y += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text('( .................... )', leftX, y, { align: 'center' });
    doc.text('( .................... )', rightX, y, { align: 'center' });
    y += 2.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(spvName.slice(0, 16), leftX, y, { align: 'center' });
    doc.text(operasionalName.slice(0, 16), rightX, y, { align: 'center' });

    y += 5;

    // Row 2: Security & Driver/Helper
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('Security Gerbang:', leftX, y, { align: 'center' });
    doc.text('Driver / Helper:', rightX, y, { align: 'center' });

    if (waybill.securitySigned === true) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.text('[TTD Terisi]', leftX, y + 7, { align: 'center' });
    }
    if (waybill.driverSigned === true) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.text('[TTD Terisi]', rightX, y + 7, { align: 'center' });
    }

    y += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text('( .................... )', leftX, y, { align: 'center' });
    doc.text('( .................... )', rightX, y, { align: 'center' });
    y += 2.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(secName.slice(0, 16), leftX, y, { align: 'center' });
    doc.text(crewName.slice(0, 16), rightX, y, { align: 'center' });

    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    return false;
  }
}

/**
 * Generate and download PDF from a Schedule object directly
 */
export async function downloadScheduleManifestPdf(schedule: Schedule): Promise<boolean> {
  try {
    const waybill = driverWaybillService.generateWaybillFromSchedule(schedule);
    return await downloadSuratJalanPdf(waybill);
  } catch (err) {
    console.error('Error generating Schedule PDF:', err);
    return false;
  }
}

/**
 * Generate and download PDF for a Scanned Document Log (58mm format)
 */
export async function downloadScannedDocumentPdf(docLog: ScannedDocumentLog): Promise<boolean> {
  try {
    const paperWidth = 58;
    const paperHeight = 160;
    const margin = 3;
    const contentWidth = paperWidth - margin * 2;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperWidth, paperHeight]
    });

    let y = 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PT. ANUGRAH KEMASAN KREATIF', paperWidth / 2, y, { align: 'center' });
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Arsip Bukti Scan Operasional (58mm)', paperWidth / 2, y, { align: 'center' });
    y += 3.5;

    doc.line(margin, y, paperWidth - margin, y);
    y += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(`No: ${docLog.documentNumber || 'DOC-SCAN'}`, margin, y);
    y += 3.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Tipe   : ${docLog.documentTypeLabel}`, margin, y);
    y += 3;
    doc.text(`Armada : ${docLog.vehiclePlate || '-'}`, margin, y);
    y += 3;
    doc.text(`Driver : ${docLog.driverName || docLog.capturedBy}`, margin, y);
    y += 3;
    doc.text(`Tujuan : ${docLog.destinationOrStore || '-'}`, margin, y);
    y += 4;

    doc.line(margin, y, paperWidth - margin, y);
    y += 3.5;

    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    const splitOcr = doc.splitTextToSize(docLog.rawExtractedText || 'Tidak ada teks OCR tambahan.', contentWidth);
    doc.text(splitOcr, margin, y);
    y += splitOcr.length * 2.8 + 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Petugas Lapangan:', margin, y);
    doc.text('Koordinator Gudang:', paperWidth - margin, y, { align: 'right' });
    y += 12;
    doc.text('( .................... )', margin, y);
    doc.text('( .................... )', paperWidth - margin, y, { align: 'right' });

    const safeNum = (docLog.documentNumber || 'DOC').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Arsip_Scan_58mm_${safeNum}.pdf`);
    return true;
  } catch (err) {
    console.error('Failed to generate Scanned Document PDF:', err);
    return false;
  }
}
