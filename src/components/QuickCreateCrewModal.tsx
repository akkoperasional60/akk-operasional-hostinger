import React, { useState } from 'react';
import { UserPlus, X, CheckCircle2, Shield, Phone, Award } from 'lucide-react';
import { crewAutoMapper, NewCrewPayload, OfficialCrewItem } from '../services/crewAutoMapper';

interface QuickCreateCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawCrewName: string;
  roleHint?: 'Driver' | 'Helper';
  onCrewCreated: (newCrew: OfficialCrewItem) => void;
}

export const QuickCreateCrewModal: React.FC<QuickCreateCrewModalProps> = ({
  isOpen,
  onClose,
  rawCrewName,
  roleHint = 'Driver',
  onCrewCreated
}) => {
  const [name, setName] = useState(rawCrewName);
  const [role, setRole] = useState<'Driver' | 'Helper' | 'Driver Cadangan'>(roleHint);
  const [licenseType, setLicenseType] = useState<'B1' | 'B2' | 'B2 Umum' | 'A' | 'C' | 'Non-SIM'>(
    roleHint === 'Driver' ? 'B1' : 'Non-SIM'
  );
  const [phone, setPhone] = useState('0812-3456-7890');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when rawCrewName changes
  React.useEffect(() => {
    if (rawCrewName) {
      setName(rawCrewName);
      setRole(roleHint);
      setLicenseType(roleHint === 'Driver' ? 'B1' : 'Non-SIM');
    }
  }, [rawCrewName, roleHint]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: NewCrewPayload = {
        name: name.trim(),
        role,
        licenseType,
        phone
      };

      const created = crewAutoMapper.registerNewCrew(payload);
      onCrewCreated(created);
      onClose();
    } catch (err) {
      console.error('Failed to create new crew:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Daftarkan Kru Baru
              </h3>
              <p className="text-xs text-slate-400">
                Tambahkan kru dari spreadsheet ke database resmi AKK
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nama Lengkap / Panggilan Kru *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: SUPRI, WAHYU, RIFAL"
              className="w-full bg-slate-950 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Posisi / Peran *
              </label>
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as any;
                  setRole(newRole);
                  if (newRole === 'Driver' && licenseType === 'Non-SIM') {
                    setLicenseType('B1');
                  }
                }}
                className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-hidden"
              >
                <option value="Driver">Driver (Pengemudi)</option>
                <option value="Helper">Helper (Kernet)</option>
                <option value="Driver Cadangan">Driver Cadangan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Kualifikasi SIM *
              </label>
              <select
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value as any)}
                className="w-full bg-slate-950 text-white px-3 py-2 rounded-xl border border-slate-800 text-xs font-bold focus:border-blue-500 focus:outline-hidden"
              >
                <option value="B1">SIM B1</option>
                <option value="B2">SIM B2</option>
                <option value="B2 Umum">SIM B2 Umum</option>
                <option value="A">SIM A</option>
                <option value="C">SIM C</option>
                <option value="Non-SIM">Non-SIM (Helper)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nomor Telepon / WhatsApp
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812-xxxx-xxxx"
              className="w-full bg-slate-950 text-white px-3.5 py-2 rounded-xl border border-slate-800 text-xs focus:border-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan &amp; Petakan Otomatis</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
