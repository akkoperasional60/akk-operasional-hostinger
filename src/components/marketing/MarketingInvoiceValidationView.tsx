import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Calendar,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  MapPin,
  User,
  FileText,
  RefreshCw,
  Trash2,
  Edit3,
  X,
  Phone,
  Sparkles,
  Truck
} from 'lucide-react';

export type MarketingValidationStatus =
  | 'Menunggu Validasi'
  | 'Tervalidasi Siap Kirim'
  | 'Revisi / Tunda Kirim';

export interface MarketingInvoiceValidationItem {
  id: string;
  noInvoice: string;
  invoiceDate: string;
  deliveryTomorrowDate: string; // YYYY-MM-DD (Tanggal kirim hari esoknya)
  customerName: string;
  areaName: string;
  paymentCategory: 'COD' | 'TEMPO';
  nominalTagihan: number;
  itemSummary: string;
  salesName: string;
  salesWhatsapp: string;
  validationStatus: MarketingValidationStatus;
  validatedBy?: string;
  validatedAt?: string;
  marketingNotes: string;
  waNotifiedAt?: string;
}

export interface SalesContactOption {
  name: string;
  whatsapp: string;
  defaultArea: string;
}

export const DEFAULT_SALES_CONTACTS: SalesContactOption[] = [
  { name: 'Rendra Saputra', whatsapp: '6281234567801', defaultArea: 'ROGOJAMPI & BANYUWANGI KOTA' },
  { name: 'Dina Mariana', whatsapp: '6281234567802', defaultArea: 'GENTENG, SRONO & MUNCAR' },
  { name: 'Bagus Setiawan', whatsapp: '6281234567803', defaultArea: 'JEMBER KOTA & KALIBARU' },
  { name: 'Hendra Wijaya', whatsapp: '6281234567804', defaultArea: 'DENPASAR & SINGARAJA' }
];

function getTomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatReadableDate(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return iso;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function normalizeWaPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '6281234567801';
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

const INITIAL_VALIDATION_ITEMS: MarketingInvoiceValidationItem[] = [
  {
    id: 'MIV-001',
    noInvoice: 'FJ02-1126-0615',
    invoiceDate: getTodayIso(),
    deliveryTomorrowDate: getTomorrowIso(),
    customerName: 'BP H KHOLIK',
    areaName: 'ROGOJAMPI',
    paymentCategory: 'TEMPO',
    nominalTagihan: 1295050,
    itemSummary: 'Karton Box B-Flute & Lakban Coklat',
    salesName: 'Rendra Saputra',
    salesWhatsapp: '6281234567801',
    validationStatus: 'Tervalidasi Siap Kirim',
    validatedBy: 'Tim Marketing Offline',
    validatedAt: new Date().toISOString(),
    marketingNotes: 'PO terkonfirmasi toko, siap dimuat untuk pengiriman besok pagi',
    waNotifiedAt: new Date().toISOString()
  },
  {
    id: 'MIV-002',
    noInvoice: 'FJ02-1126-0787',
    invoiceDate: getTodayIso(),
    deliveryTomorrowDate: getTomorrowIso(),
    customerName: 'BP SUKRI',
    areaName: 'ROGOJAMPI',
    paymentCategory: 'COD',
    nominalTagihan: 1488167,
    itemSummary: 'Lunch Box Paper M & Plastik HD',
    salesName: 'Rendra Saputra',
    salesWhatsapp: '6281234567801',
    validationStatus: 'Menunggu Validasi',
    marketingNotes: 'Mohon sales konfirmasi kesiapan pembayaran tunai COD besok'
  },
  {
    id: 'MIV-003',
    noInvoice: 'FJ03-1126-0950',
    invoiceDate: getTodayIso(),
    deliveryTomorrowDate: getTomorrowIso(),
    customerName: 'BU IIS',
    areaName: 'SUMBER AYU',
    paymentCategory: 'TEMPO',
    nominalTagihan: 2244063,
    itemSummary: 'Gelas Cup 16oz & Sedotan Steril',
    salesName: 'Dina Mariana',
    salesWhatsapp: '6281234567802',
    validationStatus: 'Menunggu Validasi',
    marketingNotes: 'Cek sisa limit tempo pelanggan sebelum berangkat esok hari'
  },
  {
    id: 'MIV-004',
    noInvoice: 'FJ02-1126-0855',
    invoiceDate: getTodayIso(),
    deliveryTomorrowDate: getTomorrowIso(),
    customerName: 'BU ARISTA',
    areaName: 'GENTENG',
    paymentCategory: 'COD',
    nominalTagihan: 1126350,
    itemSummary: 'Karton Box Custom & Plastik Opp',
    salesName: 'Dina Mariana',
    salesWhatsapp: '6281234567802',
    validationStatus: 'Tervalidasi Siap Kirim',
    validatedBy: 'Tim Marketing Offline',
    validatedAt: new Date().toISOString(),
    marketingNotes: 'Sudah divalidasi dengan sales & toko siap terima barang besok'
  }
];

export const MarketingInvoiceValidationView: React.FC = () => {
  const tomorrowIso = useMemo(() => getTomorrowIso(), []);
  const todayIso = useMemo(() => getTodayIso(), []);

  const [records, setRecords] = useState<MarketingInvoiceValidationItem[]>(INITIAL_VALIDATION_ITEMS);
  const [isSyncingMysql, setIsSyncingMysql] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string>('ALL');
  const [selectedSalesFilter, setSelectedSalesFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Input / Edit Faktur Validasi
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNoInvoice, setFormNoInvoice] = useState('');
  const [formDeliveryDate, setFormDeliveryDate] = useState(tomorrowIso);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formAreaName, setFormAreaName] = useState('ROGOJAMPI');
  const [formPaymentCategory, setFormPaymentCategory] = useState<'COD' | 'TEMPO'>('COD');
  const [formNominal, setFormNominal] = useState<number>(1000000);
  const [formItemSummary, setFormItemSummary] = useState('');
  const [formSalesName, setFormSalesName] = useState(DEFAULT_SALES_CONTACTS[0].name);
  const [formSalesWhatsapp, setFormSalesWhatsapp] = useState(DEFAULT_SALES_CONTACTS[0].whatsapp);
  const [formStatus, setFormStatus] = useState<MarketingValidationStatus>('Menunggu Validasi');
  const [formNotes, setFormNotes] = useState('');

  // Modal Integrasi WhatsApp Sales (Single Invoice or Batch per Sales)
  const [waModalData, setWaModalData] = useState<{
    title: string;
    salesName: string;
    salesWhatsapp: string;
    messageText: string;
    targetIds: string[];
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const persistToMysql = async (nextRecords: MarketingInvoiceValidationItem[]) => {
    setIsSyncingMysql(true);
    try {
      await fetch('/api/marketing-invoice-validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: nextRecords })
      });
    } catch (err) {
      console.warn('[MySQL Marketing Invoice Validations Sync Error]', err);
    } finally {
      setIsSyncingMysql(false);
    }
  };

  // Hydrate directly from MySQL (/api/marketing-invoice-validations)
  useEffect(() => {
    let active = true;
    fetch('/api/marketing-invoice-validations', { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (!active) return;
        if (res && res.success && Array.isArray(res.records) && res.records.length > 0) {
          setRecords(res.records);
        } else {
          setRecords(INITIAL_VALIDATION_ITEMS);
          void persistToMysql(INITIAL_VALIDATION_ITEMS);
        }
      })
      .catch(err => {
        console.warn('[MySQL Marketing Validations Fetch Error]', err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync invoices from Form Kirim (/api/form-kirim) & Input Faktur SO (/api/sales-rfid-invoices)
  const handleSyncFromFormKirim = async () => {
    setIsSyncingMysql(true);
    try {
      const [fkRes, rfidRes] = await Promise.all([
        fetch('/api/form-kirim', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
        fetch('/api/sales-rfid-invoices', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      ]);

      const existingByNo = new Map(records.map(r => [r.noInvoice.toUpperCase(), r]));
      const addedItems: MarketingInvoiceValidationItem[] = [];

      if (fkRes && Array.isArray(fkRes.records)) {
        fkRes.records.forEach((fk: any) => {
          const area = String(fk.areaKirim || 'ROGOJAMPI').toUpperCase();
          const items = Array.isArray(fk.invoiceItems) ? fk.invoiceItems : [];
          items.forEach((it: any, idx: number) => {
            const noInv = String(it.noFaktur || '').trim();
            if (!noInv || existingByNo.has(noInv.toUpperCase())) return;
            const salesContact = DEFAULT_SALES_CONTACTS[idx % DEFAULT_SALES_CONTACTS.length];
            const newItem: MarketingInvoiceValidationItem = {
              id: `MIV-FK-${Date.now()}-${idx}`,
              noInvoice: noInv,
              invoiceDate: it.tglFaktur || todayIso,
              deliveryTomorrowDate: tomorrowIso,
              customerName: String(it.customerName || 'PELANGGAN').toUpperCase(),
              areaName: area,
              paymentCategory: it.paymentCategory === 'COD' ? 'COD' : 'TEMPO',
              nominalTagihan: Number(it.terutang) || 0,
              itemSummary: it.keterangan || `Faktur Form Kirim Area ${area}`,
              salesName: salesContact.name,
              salesWhatsapp: salesContact.whatsapp,
              validationStatus: 'Menunggu Validasi',
              marketingNotes: 'Tersinkronisasi otomatis dari Form Kirim Admin Penjualan'
            };
            existingByNo.set(noInv.toUpperCase(), newItem);
            addedItems.push(newItem);
          });
        });
      }

      if (rfidRes && Array.isArray(rfidRes.invoices)) {
        rfidRes.invoices.forEach((inv: any, idx: number) => {
          const noInv = String(inv.invoiceNumber || inv.soNumber || '').trim();
          if (!noInv || existingByNo.has(noInv.toUpperCase())) return;
          const salesContact = DEFAULT_SALES_CONTACTS[idx % DEFAULT_SALES_CONTACTS.length];
          const newItem: MarketingInvoiceValidationItem = {
            id: `MIV-SO-${Date.now()}-${idx}`,
            noInvoice: noInv,
            invoiceDate: inv.date || todayIso,
            deliveryTomorrowDate: tomorrowIso,
            customerName: String(inv.customerName || 'PELANGGAN').toUpperCase(),
            areaName: String(inv.destinationArea || 'BANYUWANGI').toUpperCase(),
            paymentCategory: 'TEMPO',
            nominalTagihan: Number(inv.totalValue) || 1500000,
            itemSummary: Array.isArray(inv.items)
              ? inv.items.map((x: any) => x.itemName).filter(Boolean).join(', ')
              : 'Pesanan Faktur SO',
            salesName: salesContact.name,
            salesWhatsapp: salesContact.whatsapp,
            validationStatus: 'Menunggu Validasi',
            marketingNotes: 'Tersinkronisasi otomatis dari Input Faktur / Sales Order (SO)'
          };
          existingByNo.set(noInv.toUpperCase(), newItem);
          addedItems.push(newItem);
        });
      }

      if (addedItems.length > 0) {
        const next = [...addedItems, ...records];
        setRecords(next);
        await persistToMysql(next);
        showToast(`${addedItems.length} faktur baru berhasil disinkronkan untuk validasi pengiriman esok.`);
      } else {
        showToast('Seluruh faktur dari Form Kirim & SO sudah berada di daftar validasi.');
      }
    } finally {
      setIsSyncingMysql(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter(item => {
      if (selectedDeliveryDate !== 'ALL' && item.deliveryTomorrowDate !== selectedDeliveryDate) {
        return false;
      }
      if (selectedSalesFilter !== 'ALL' && item.salesName !== selectedSalesFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'ALL' && item.validationStatus !== selectedStatusFilter) {
        return false;
      }
      if (q) {
        const matchInv = item.noInvoice.toLowerCase().includes(q);
        const matchCust = item.customerName.toLowerCase().includes(q);
        const matchArea = item.areaName.toLowerCase().includes(q);
        const matchSales = item.salesName.toLowerCase().includes(q);
        if (!matchInv && !matchCust && !matchArea && !matchSales) return false;
      }
      return true;
    });
  }, [records, selectedDeliveryDate, selectedSalesFilter, selectedStatusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const validated = filteredRecords.filter(r => r.validationStatus === 'Tervalidasi Siap Kirim').length;
    const pending = filteredRecords.filter(r => r.validationStatus === 'Menunggu Validasi').length;
    const postponed = filteredRecords.filter(r => r.validationStatus === 'Revisi / Tunda Kirim').length;
    const totalNominal = filteredRecords.reduce((acc, r) => acc + (Number(r.nominalTagihan) || 0), 0);
    return { total, validated, pending, postponed, totalNominal };
  }, [filteredRecords]);

  const handleQuickStatusUpdate = (id: string, status: MarketingValidationStatus) => {
    const next = records.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        validationStatus: status,
        validatedBy: 'Tim Marketing Offline',
        validatedAt: new Date().toISOString()
      };
    });
    setRecords(next);
    void persistToMysql(next);
    showToast(`Status faktur diperbarui menjadi "${status}".`);
  };

  const handleDelete = (id: string) => {
    const next = records.filter(r => r.id !== id);
    setRecords(next);
    void persistToMysql(next);
    showToast('Data faktur validasi berhasil dihapus.');
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormNoInvoice(`FJ02-1126-${String(records.length + 910).padStart(4, '0')}`);
    setFormDeliveryDate(tomorrowIso);
    setFormCustomerName('');
    setFormAreaName('ROGOJAMPI');
    setFormPaymentCategory('COD');
    setFormNominal(1500000);
    setFormItemSummary('');
    setFormSalesName(DEFAULT_SALES_CONTACTS[0].name);
    setFormSalesWhatsapp(DEFAULT_SALES_CONTACTS[0].whatsapp);
    setFormStatus('Menunggu Validasi');
    setFormNotes('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: MarketingInvoiceValidationItem) => {
    setEditingId(item.id);
    setFormNoInvoice(item.noInvoice);
    setFormDeliveryDate(item.deliveryTomorrowDate);
    setFormCustomerName(item.customerName);
    setFormAreaName(item.areaName);
    setFormPaymentCategory(item.paymentCategory);
    setFormNominal(item.nominalTagihan);
    setFormItemSummary(item.itemSummary);
    setFormSalesName(item.salesName);
    setFormSalesWhatsapp(item.salesWhatsapp);
    setFormStatus(item.validationStatus);
    setFormNotes(item.marketingNotes);
    setIsFormModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNoInvoice.trim() || !formCustomerName.trim()) return;

    const payload: MarketingInvoiceValidationItem = {
      id: editingId || `MIV-${Date.now()}`,
      noInvoice: formNoInvoice.trim().toUpperCase(),
      invoiceDate: todayIso,
      deliveryTomorrowDate: formDeliveryDate || tomorrowIso,
      customerName: formCustomerName.trim().toUpperCase(),
      areaName: formAreaName.trim().toUpperCase(),
      paymentCategory: formPaymentCategory,
      nominalTagihan: Number(formNominal) || 0,
      itemSummary: formItemSummary.trim() || 'Pesanan Kemasan & Karton Box',
      salesName: formSalesName.trim(),
      salesWhatsapp: normalizeWaPhone(formSalesWhatsapp),
      validationStatus: formStatus,
      validatedBy: 'Tim Marketing Offline',
      validatedAt: new Date().toISOString(),
      marketingNotes: formNotes.trim() || 'Siap dikirimkan esok hari'
    };

    const next = editingId
      ? records.map(r => (r.id === editingId ? { ...r, ...payload } : r))
      : [payload, ...records];

    setRecords(next);
    void persistToMysql(next);
    setIsFormModalOpen(false);
    setEditingId(null);
    showToast(editingId ? 'Perubahan validasi faktur disimpan ke MySQL.' : 'Faktur validasi pengiriman esok berhasil ditambahkan.');
  };

  // Build WhatsApp message for single invoice
  const openWaModalForInvoice = (item: MarketingInvoiceValidationItem) => {
    const readableDate = formatReadableDate(item.deliveryTomorrowDate);
    const msg =
      `Halo Sales *${item.salesName}*,\n` +
      `Berikut konfirmasi *Validasi Faktur Pengiriman Besok (${readableDate})* dari Tim Marketing PT. Anugrah Kemasan Kreatif:\n\n` +
      `• *No. Faktur*: ${item.noInvoice}\n` +
      `• *Nama Pelanggan*: ${item.customerName}\n` +
      `• *Area Kirim*: ${item.areaName}\n` +
      `• *Kategori Bayar*: ${item.paymentCategory} (Rp ${item.nominalTagihan.toLocaleString('id-ID')})\n` +
      `• *Rincian Barang*: ${item.itemSummary}\n` +
      `• *Status Validasi*: *${item.validationStatus}*\n` +
      `• *Catatan Marketing*: ${item.marketingNotes || '-'}\n\n` +
      `Mohon konfirmasi kembali ke toko agar proses pengiriman besok berjalan lancar. Terima kasih.`;

    setWaModalData({
      title: `Kirim Validasi WA ke Sales (${item.noInvoice})`,
      salesName: item.salesName,
      salesWhatsapp: normalizeWaPhone(item.salesWhatsapp),
      messageText: msg,
      targetIds: [item.id]
    });
  };

  // Build Batch WhatsApp message for all tomorrow's invoices of a Sales person
  const openBatchWaModalForSales = (targetSalesName?: string) => {
    const chosenSales =
      targetSalesName && targetSalesName !== 'ALL'
        ? targetSalesName
        : filteredRecords[0]?.salesName || DEFAULT_SALES_CONTACTS[0].name;

    const salesItems = filteredRecords.filter(r => r.salesName === chosenSales);
    const contactObj =
      DEFAULT_SALES_CONTACTS.find(c => c.name === chosenSales) || DEFAULT_SALES_CONTACTS[0];
    const phone = normalizeWaPhone(salesItems[0]?.salesWhatsapp || contactObj.whatsapp);
    const targetList = salesItems.length > 0 ? salesItems : filteredRecords;
    const readableTomorrow = formatReadableDate(
      selectedDeliveryDate !== 'ALL' ? selectedDeliveryDate : tomorrowIso
    );

    const lines = targetList.map(
      (it, idx) =>
        `${idx + 1}. *${it.customerName}* (${it.areaName}) — Faktur: *${it.noInvoice}* | ${it.paymentCategory} Rp ${it.nominalTagihan.toLocaleString('id-ID')} | Status: *${it.validationStatus}*`
    );

    const msg =
      `Halo *${chosenSales}*,\n` +
      `Berikut *Rekap Validasi Faktur Pengiriman Esok Hari (${readableTomorrow})* dari Tim Marketing:\n\n` +
      (lines.length > 0 ? lines.join('\n') : 'Belum ada daftar faktur.') +
      `\n\nTotal: *${targetList.length} Faktur*.\nMohon koordinasi dengan toko terkait jadwal kedatangan armada besok. Terima kasih.`;

    setWaModalData({
      title: `Rekap Broadcast WA Sales — ${chosenSales}`,
      salesName: chosenSales,
      salesWhatsapp: phone,
      messageText: msg,
      targetIds: targetList.map(i => i.id)
    });
  };

  const handleConfirmSendWa = () => {
    if (!waModalData) return;
    const cleanPhone = normalizeWaPhone(waModalData.salesWhatsapp);
    const encoded = encodeURIComponent(waModalData.messageText);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    // Mark records as notified via WA Sales & persist to MySQL
    const nowIso = new Date().toISOString();
    const idSet = new Set(waModalData.targetIds);
    const next = records.map(r =>
      idSet.has(r.id)
        ? {
            ...r,
            salesWhatsapp: cleanPhone,
            waNotifiedAt: nowIso
          }
        : r
    );
    setRecords(next);
    void persistToMysql(next);

    // Open WhatsApp Web / App link in new tab safely
    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setWaModalData(null);
    showToast(`Pesan konfirmasi validasi faktur telah diteruskan ke WhatsApp Sales (${waModalData.salesName}).`);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-extrabold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner: Validasi Faktur Pengiriman Esok (Marketing Offline) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Validasi Faktur Pengiriman Hari Esok
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Integrasi WA Sales
                </span>
                {isSyncingMysql && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 animate-pulse">
                    Menyimpan...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Halaman verifikasi Tim Marketing untuk memvalidasi kesiapan faktur yang akan dikirimkan besok ({formatReadableDate(tomorrowIso)}) beserta konfirmasi langsung ke WhatsApp Sales.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncFromFormKirim}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-extrabold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Sinkron dari Form Kirim / SO</span>
            </button>

            <button
              type="button"
              onClick={() => openBatchWaModalForSales(selectedSalesFilter)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Rekap WA Sales</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Faktur Esok</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              TOTAL FAKTUR KIRIM ESOK
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
              {stats.total} <span className="text-xs font-bold text-slate-500">Faktur</span>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
              Nilai: Rp {stats.totalNominal.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              TERVALIDASI SIAP KIRIM
            </span>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono tabular-nums">
              {stats.validated} <span className="text-xs font-bold">Faktur</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 mt-0.5 block">
              Disetujui Tim Marketing
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              MENUNGGU VALIDASI
            </span>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1 font-mono tabular-nums">
              {stats.pending} <span className="text-xs font-bold">Faktur</span>
            </div>
            <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-300/80 mt-0.5 block">
              Perlu konfirmasi Marketing / Sales
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 block">
              REVISI / TUNDA KIRIM
            </span>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1 font-mono tabular-nums">
              {stats.postponed} <span className="text-xs font-bold">Faktur</span>
            </div>
            <span className="text-[11px] font-semibold text-rose-700/80 dark:text-rose-300/80 mt-0.5 block">
              Menunggu tindak lanjut toko
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nomor faktur, nama pelanggan/toko, area kirim, atau nama sales..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tanggal Kirim Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[10px] font-bold uppercase text-slate-500">Tgl Kirim:</span>
            <select
              value={selectedDeliveryDate}
              onChange={e => setSelectedDeliveryDate(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Jadwal Esok</option>
              <option value={tomorrowIso}>Besok ({tomorrowIso})</option>
              <option value={todayIso}>Hari Ini ({todayIso})</option>
            </select>
          </div>

          {/* Filter Sales */}
          <select
            value={selectedSalesFilter}
            onChange={e => setSelectedSalesFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Sales Marketing</option>
            {DEFAULT_SALES_CONTACTS.map(s => (
              <option key={s.name} value={s.name}>
                Sales: {s.name}
              </option>
            ))}
          </select>

          {/* Filter Status Validasi */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status Validasi</option>
            <option value="Menunggu Validasi">Menunggu Validasi</option>
            <option value="Tervalidasi Siap Kirim">Tervalidasi Siap Kirim</option>
            <option value="Revisi / Tunda Kirim">Revisi / Tunda Kirim</option>
          </select>
        </div>
      </div>

      {/* Table Validasi Faktur Pengiriman Esok */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/95 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-3.5 px-4 text-center w-12">NO</th>
                <th className="py-3.5 px-4">NO. FAKTUR &amp; JADWAL KIRIM ESOK</th>
                <th className="py-3.5 px-4">PELANGGAN &amp; AREA KIRIM</th>
                <th className="py-3.5 px-4">METODE &amp; NOMINAL</th>
                <th className="py-3.5 px-4">SALES PENGAMPU (WA SALES)</th>
                <th className="py-3.5 px-4">STATUS VALIDASI MARKETING</th>
                <th className="py-3.5 px-4">CATATAN VALIDASI</th>
                <th className="py-3.5 px-4 text-right">AKSI &amp; KIRIM WA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center text-slate-500">
                    Tidak ada daftar faktur pengiriman esok yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, idx) => {
                  const isReady = item.validationStatus === 'Tervalidasi Siap Kirim';
                  const isPostponed = item.validationStatus === 'Revisi / Tunda Kirim';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                          {item.noInvoice}
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-emerald-500" />
                          <span>Kirim: {formatReadableDate(item.deliveryTomorrowDate)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {item.customerName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                            <MapPin className="w-2.5 h-2.5" />
                            {item.areaName}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[180px]">
                            {item.itemSummary}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mb-1 ${
                            item.paymentCategory === 'COD'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {item.paymentCategory}
                        </span>
                        <div className="font-mono font-black text-slate-900 dark:text-white">
                          Rp {item.nominalTagihan.toLocaleString('id-ID')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>{item.salesName}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span>+{normalizeWaPhone(item.salesWhatsapp)}</span>
                        </div>
                        {item.waNotifiedAt && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            WA Terkirim
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={item.validationStatus}
                          onChange={e =>
                            handleQuickStatusUpdate(item.id, e.target.value as MarketingValidationStatus)
                          }
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border cursor-pointer focus:outline-none ${
                            isReady
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : isPostponed
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          <option value="Menunggu Validasi">Menunggu Validasi</option>
                          <option value="Tervalidasi Siap Kirim">✓ Tervalidasi Siap Kirim</option>
                          <option value="Revisi / Tunda Kirim">⚠ Revisi / Tunda Kirim</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 max-w-[220px]">
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">
                          {item.marketingNotes || '-'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openWaModalForInvoice(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            title="Kirim Konfirmasi Validasi ke WhatsApp Sales"
                          >
                            <Send className="w-3 h-3" />
                            <span>WA Sales</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                            title="Edit Faktur Validasi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input / Edit Faktur Validasi Pengiriman Esok */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingId ? 'Edit Validasi Faktur Pengiriman Esok' : 'Tambah Faktur Pengiriman Esok'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Data tersimpan ke database MySQL &amp; terhubung dengan WhatsApp Sales
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Faktur *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNoInvoice}
                    onChange={e => setFormNoInvoice(e.target.value)}
                    placeholder="FJ02-1126-0890"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Kirim (Hari Esok) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDeliveryDate}
                    onChange={e => setFormDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pelanggan / Toko *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={e => setFormCustomerName(e.target.value)}
                    placeholder="Contoh: TK ANEKA BARU"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Area Kirim *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAreaName}
                    onChange={e => setFormAreaName(e.target.value)}
                    placeholder="Contoh: ROGOJAMPI"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori Pembayaran
                  </label>
                  <select
                    value={formPaymentCategory}
                    onChange={e => setFormPaymentCategory(e.target.value as 'COD' | 'TEMPO')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="COD">COD (Tunai Saat Kirim)</option>
                    <option value="TEMPO">TEMPO (Jatuh Tempo)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nominal Faktur (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formNominal}
                    onChange={e => setFormNominal(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Sales Pengampu *
                  </label>
                  <select
                    value={formSalesName}
                    onChange={e => {
                      const val = e.target.value;
                      setFormSalesName(val);
                      const found = DEFAULT_SALES_CONTACTS.find(c => c.name === val);
                      if (found) setFormSalesWhatsapp(found.whatsapp);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  >
                    {DEFAULT_SALES_CONTACTS.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor WhatsApp Sales (628...) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSalesWhatsapp}
                    onChange={e => setFormSalesWhatsapp(e.target.value)}
                    placeholder="6281234567801"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rincian Ringkas Barang
                </label>
                <input
                  type="text"
                  value={formItemSummary}
                  onChange={e => setFormItemSummary(e.target.value)}
                  placeholder="Contoh: Karton Box B-Flute 400 pcs & Lakban"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status Validasi Marketing
                </label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as MarketingValidationStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                >
                  <option value="Menunggu Validasi">Menunggu Validasi</option>
                  <option value="Tervalidasi Siap Kirim">Tervalidasi Siap Kirim</option>
                  <option value="Revisi / Tunda Kirim">Revisi / Tunda Kirim</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Validasi Tim Marketing
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Catatan konfirmasi pengiriman esok hari..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold shadow-xs cursor-pointer"
                >
                  Simpan Validasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Integrasi Kirim WhatsApp Sales */}
      {waModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {waModalData.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kirim notifikasi validasi faktur pengiriman esok langsung ke WhatsApp Sales
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pilih Sales Tujuan
                  </label>
                  <select
                    value={waModalData.salesName}
                    onChange={e => {
                      const name = e.target.value;
                      const found = DEFAULT_SALES_CONTACTS.find(c => c.name === name);
                      setWaModalData({
                        ...waModalData,
                        salesName: name,
                        salesWhatsapp: found ? found.whatsapp : waModalData.salesWhatsapp
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  >
                    {DEFAULT_SALES_CONTACTS.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor WhatsApp Sales
                  </label>
                  <input
                    type="text"
                    value={waModalData.salesWhatsapp}
                    onChange={e =>
                      setWaModalData({ ...waModalData, salesWhatsapp: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Format Pesan WhatsApp Validasi Faktur Esok
                </label>
                <textarea
                  rows={8}
                  value={waModalData.messageText}
                  onChange={e =>
                    setWaModalData({ ...waModalData, messageText: e.target.value })
                  }
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWaModalData(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSendWa}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim ke WhatsApp Sales Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
