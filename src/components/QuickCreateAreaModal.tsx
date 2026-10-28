import React, { useState, useEffect } from 'react';
import { MapPin, X, Plus, Sparkles, Check, Building2, Navigation, Phone, User, CheckCircle2 } from 'lucide-react';
import { areaAutoMapper, OfficialAreaItem, NewAreaPayload } from '../services/areaAutoMapper';

interface QuickCreateAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawAreaName: string;
  onAreaCreated: (newArea: OfficialAreaItem, rawAreaKey: string) => void;
}

export const QuickCreateAreaModal: React.FC<QuickCreateAreaModalProps> = ({
  isOpen,
  onClose,
  rawAreaName,
  onAreaCreated
}) => {
  const [name, setName] = useState('');
  const [island, setIsland] = useState<NewAreaPayload['island']>('Jawa');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<NonNullable<NewAreaPayload['category']>>('Supermarket');
  const [routeCorridor, setRouteCorridor] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Auto-suggest fields when rawAreaName changes
  useEffect(() => {
    if (!rawAreaName) return;
    const cleanRaw = rawAreaName.trim().toUpperCase();
    setName(cleanRaw);

    const isBali = cleanRaw.includes('BALI') || cleanRaw.includes('DENPASAR') || cleanRaw.includes('SINGARAJA') || cleanRaw.includes('NEGARA') || cleanRaw.includes('KUTA');
    const isJember = cleanRaw.includes('JEMBER');
    const isSitubondo = cleanRaw.includes('SITUBONDO') || cleanRaw.includes('STB') || cleanRaw.includes('BONDOWOSO');

    if (isBali) {
      setIsland('Bali & Nusa Tenggara');
      setCity(cleanRaw.includes('SINGARAJA') ? 'Buleleng / Singaraja' : (cleanRaw.includes('NEGARA') ? 'Jembrana / Negara' : 'Denpasar'));
      setRouteCorridor('Lintas Pulau (Ferry ASDP Ketapang - Gilimanuk)');
      setAddress(`Jl. Utama Distribusi ${cleanRaw}, Bali`);
    } else if (isJember) {
      setIsland('Jawa');
      setCity('Jember');
      setRouteCorridor('Jalur Distribusi Jember & Sekitarnya');
      setAddress(`Jl. Raya ${cleanRaw}, Jember`);
    } else if (isSitubondo) {
      setIsland('Jawa');
      setCity(cleanRaw.includes('BONDOWOSO') ? 'Bondowoso' : 'Situbondo');
      setRouteCorridor('Jalur Pantura / Pegunungan Utara');
      setAddress(`Kawasan Distribusi ${cleanRaw}`);
    } else {
      setIsland('Jawa');
      setCity('Banyuwangi');
      setRouteCorridor(cleanRaw.includes('PURWO') || cleanRaw.includes('JAJAG') ? 'Koridor Banyuwangi Selatan' : 'Koridor Banyuwangi Reguler');
      setAddress(`Kawasan Distribusi ${cleanRaw}, Banyuwangi`);
    }

    setCategory(cleanRaw.includes('GROSIR') ? 'Distribution Hub' : 'Supermarket');
    setContactPerson('PIC Logistik ' + cleanRaw.substring(0, 10));
    setPhone('0812-3456-' + Math.floor(1000 + Math.random() * 9000));
    setIsSuccess(false);
  }, [rawAreaName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: NewAreaPayload = {
      name: name.trim().toUpperCase(),
      city: city.trim() || (island === 'Jawa' ? 'Banyuwangi' : 'Denpasar'),
      island,
      category,
      address: address.trim() || `Kawasan Distribusi ${name}`,
      contactPerson: contactPerson.trim() || 'PIC Area',
      phone: phone.trim() || '0812-3456-7890',
      routeCorridor: routeCorridor.trim() || 'Rute Reguler'
    };

    const { officialArea } = areaAutoMapper.quickCreateOfficialArea(payload);
    areaAutoMapper.saveUserMappingPreference(rawAreaName, officialArea.name);

    setIsSuccess(true);
    setTimeout(() => {
      onAreaCreated(officialArea, rawAreaName);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Buat Area Pengiriman Baru Cepat</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Quick Setup
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis mendaftarkan area baru ke tabel &lsquo;Jadwal Pengiriman &amp; Muat&rsquo;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source info pill */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">Area Asli di Spreadsheet:</span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
            {rawAreaName || '-'}
          </span>
        </div>

        {/* Success banner if created */}
        {isSuccess ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>Area &apos;{name}&apos; berhasil disimpan dan langsung dipetakan ke Jadwal Pengiriman!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Nama Area Resmi Jadwal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="Contoh: KUTA RETAIL, BALI SELATAN, BANYUWANGI UTARA"
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden font-bold tracking-wide"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Nama ini akan tercantum di seluruh kolom Area Jadwal &amp; Surat Jalan.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Wilayah / Pulau <span className="text-rose-500">*</span>
                </label>
                <select
                  value={island}
                  onChange={(e) => setIsland(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden font-medium"
                >
                  <option value="Jawa">Jawa</option>
                  <option value="Bali & Nusa Tenggara">Bali &amp; Nusa Tenggara</option>
                  <option value="Sumatera">Sumatera</option>
                  <option value="Kalimantan">Kalimantan</option>
                  <option value="Sulawesi">Sulawesi</option>
                  <option value="Papua & Maluku">Papua &amp; Maluku</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Kota / Kabupaten <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Misal: Banyuwangi, Denpasar, Jember"
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Kategori Area / Toko
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="Supermarket">Supermarket / Retail</option>
                  <option value="Distribution Hub">Distribution Hub (Grosir)</option>
                  <option value="Hypermarket">Hypermarket</option>
                  <option value="Minimarket Cluster">Minimarket Cluster</option>
                  <option value="Toko Kelontong / Minimarket">Toko Kelontong</option>
                  <option value="Mitra Distributor">Mitra Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Koridor Jalur Logistik
                </label>
                <input
                  type="text"
                  value={routeCorridor}
                  onChange={(e) => setRouteCorridor(e.target.value)}
                  placeholder="Misal: Lintas Ferry ASDP, Koridor Selatan"
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Alamat / Titik Hub Tujuan
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat penyerahan barang / staging area"
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan &amp; Petakan Sekarang</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
