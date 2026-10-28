import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Briefcase, UserX, AlertCircle, X } from 'lucide-react';

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'agenda' | 'cuti' | 'tugas';
  description?: string;
}

const EVENT_TYPE_STYLES = {
  agenda: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  cuti: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  tugas: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
};

const EVENT_TYPE_ICONS = {
  agenda: Briefcase,
  cuti: UserX,
  tugas: AlertCircle,
};

// Default mock events for different departments
const DEFAULT_EVENTS: { [role: string]: CalendarEvent[] } = {
  hr_admin: [
    { id: 'hr-1', date: '2026-09-05', title: 'Onboarding Staff Baru', type: 'agenda', description: 'Sesi pengenalan budaya perusahaan' },
    { id: 'hr-2', date: '2026-09-12', title: 'Review Kinerja Q3', type: 'tugas', description: 'Evaluasi KPI seluruh departemen' },
    { id: 'hr-3', date: '2026-09-18', title: 'Cuti Bersama Tim HR', type: 'cuti', description: 'Libur akhir pekan panjang' },
    { id: 'hr-4', date: '2026-09-22', title: 'Wawancara Kandidat Utama', type: 'agenda', description: 'Posisi Senior Logistics Manager' },
  ],
  warehouse_admin: [
    { id: 'wh-1', date: '2026-09-08', title: 'Stok Opname Bulanan', type: 'tugas', description: 'Perhitungan fisik barang di semua rak' },
    { id: 'wh-2', date: '2026-09-15', title: 'Audit K3 Keamanan', type: 'agenda', description: 'Pemeriksaan alat pemadam & jalur evakuasi' },
    { id: 'wh-3', date: '2026-09-19', title: 'Maintenance Forklift', type: 'tugas', description: 'Servis rutin berkala armada gudang' },
    { id: 'wh-4', date: '2026-09-26', title: 'Cargo Masuk Skala Besar', type: 'agenda', description: 'Penerimaan impor bahan baku utama' },
  ],
  finance_tax_admin: [
    { id: 'fin-1', date: '2026-09-06', title: 'Penutupan Buku Bulanan', type: 'tugas', description: 'Rekonsiliasi semua akun kas & bank' },
    { id: 'fin-2', date: '2026-09-14', title: 'Audit Pajak Internal', type: 'agenda', description: 'Persiapan laporan SPT tahunan' },
    { id: 'fin-3', date: '2026-09-20', title: 'Batas Pelaporan PPN', type: 'tugas', description: 'Penyetoran dan pelaporan masa PPN' },
    { id: 'fin-4', date: '2026-09-25', title: 'Sesi Pembayaran Gaji', type: 'agenda', description: 'Disbursement payroll ke seluruh bank' },
  ],
  purchasing_admin: [
    { id: 'pur-1', date: '2026-09-03', title: 'Meeting Distribusi Utama', type: 'agenda', description: 'Koordinasi rute logistik dengan pemasok' },
    { id: 'pur-2', date: '2026-09-10', title: 'Negosiasi Kontrak Supplier', type: 'agenda', description: 'Pembaruan tarif dengan vendor armada luar' },
    { id: 'pur-3', date: '2026-09-17', title: 'Evaluasi Kinerja Vendor', type: 'tugas', description: 'Penilaian SLA pengiriman sebulan terakhir' },
    { id: 'pur-4', date: '2026-09-24', title: 'Deadline Pengajuan PO', type: 'tugas', description: 'Batas akhir order pembelian bulan berjalan' },
  ],
};

interface TeamCalendarProps {
  role: string;
}

export const TeamCalendar: React.FC<TeamCalendarProps> = ({ role }) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1)); // September 2026 as default corresponding to logs
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    return DEFAULT_EVENTS[role] || [];
  });

  // Modal State for adding event
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState<'agenda' | 'cuti' | 'tugas'>('agenda');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Year and Month selection
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday is 0, Monday is 1, etc.

  // Shift to previous month
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // Shift to next month
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Days mapping
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    // Pad initial blank days
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Fill days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [year, month, firstDayIndex, daysInMonth]);

  // Handle Event addition
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;

    const addedEvent: CalendarEvent = {
      id: `custom-${Math.random().toString(36).substring(2, 9)}`,
      date: newEventDate,
      title: newEventTitle,
      type: newEventType,
      description: newEventDesc
    };

    setEvents(prev => [...prev, addedEvent]);
    setShowAddModal(false);
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventType('agenda');
    setNewEventDesc('');
  };

  // Render events map for current month
  const eventsByDay = useMemo(() => {
    const map: { [day: number]: CalendarEvent[] } = {};
    events.forEach(event => {
      const eventDate = new Date(event.date);
      if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
        const d = eventDate.getDate();
        if (!map[d]) map[d] = [];
        map[d].push(event);
      }
    });
    return map;
  }, [events, year, month]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kalender Kerja &amp; Agenda Tim</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button 
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-slate-900 dark:text-white px-3 min-w-[120px] text-center">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 transition text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Kegiatan</span>
          </button>
        </div>
      </div>

      {/* Grid of Days */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
        {/* Days Header */}
        <div className="grid grid-cols-7 text-center py-2 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          <div>Min</div>
          <div>Sen</div>
          <div>Sel</div>
          <div>Rab</div>
          <div>Kam</div>
          <div>Jum</div>
          <div>Sab</div>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 auto-rows-[90px] divide-x divide-y divide-slate-200 dark:divide-slate-800/60 border-t border-slate-200 dark:border-slate-800/20">
          {calendarDays.map((day, idx) => {
            const hasEvents = day !== null && eventsByDay[day];
            return (
              <div 
                key={idx} 
                className={`p-1.5 flex flex-col justify-between transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-900/40 relative ${
                  day === null ? 'bg-slate-100/40 dark:bg-slate-950/10' : 'bg-white dark:bg-transparent'
                }`}
              >
                {day !== null && (
                  <>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-400">
                      {day}
                    </span>
                    <div className="flex-1 overflow-y-auto space-y-1 mt-1 scrollbar-thin">
                      {hasEvents && eventsByDay[day].map(event => {
                        const IconComponent = EVENT_TYPE_ICONS[event.type];
                        return (
                          <div 
                            key={event.id}
                            className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold leading-tight truncate flex items-center gap-1 ${EVENT_TYPE_STYLES[event.type]}`}
                            title={`${event.title} - ${event.description || ''}`}
                          >
                            <IconComponent className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend / Info bar */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
        <span className="text-slate-500">Tipe Kegiatan:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/40"></span>
          <span>Agenda Penting</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40"></span>
          <span>Cuti / Izin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40"></span>
          <span>Tugas Operasional</span>
        </div>
      </div>

      {/* Pop-up Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Tambah Agenda Baru</h4>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Nama Kegiatan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Stok Opname Baru"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Tanggal</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Kategori</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as any)}
                  >
                    <option value="agenda">Agenda</option>
                    <option value="cuti">Cuti</option>
                    <option value="tugas">Tugas</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Deskripsi singkat</label>
                <textarea
                  placeholder="Tulis rincian di sini..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 transition text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
