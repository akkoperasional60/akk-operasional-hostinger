import React, { useState } from 'react';
import { Users, UserPlus, Award, ShieldCheck, MapPin, Phone, Star, Edit, Trash2, X, CheckCircle2, Search, AlertCircle, AlertTriangle, Truck } from 'lucide-react';
import { Crew } from '../types';
import { logisticsStore } from '../services/store';

interface CrewPoolManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  crews: Crew[];
  onRefresh: () => void;
}

export const CrewPoolManagementModal: React.FC<CrewPoolManagementModalProps> = ({
  isOpen,
  onClose,
  crews,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'drivers' | 'helpers'>('drivers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [crewToDelete, setCrewToDelete] = useState<Crew | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'Driver Utama' as Crew['role'],
    licenseNumber: '',
    licenseType: 'SIM B2 Umum' as Crew['licenseType'],
    status: 'available' as Crew['status'],
    certificationsStr: 'SIM B2 Umum, Defensive Driving, Sertifikat Kesehatan',
    routeExperienceStr: 'Banyuwangi - Surabaya, Ketapang - Gilimanuk (Bali)'
  });

  if (!isOpen) return null;

  const driversList = crews.filter(c => c.role === 'Driver Utama' || c.role === 'Driver Cadangan' || !c.role.includes('Helper'));
  const helpersList = crews.filter(c => c.role === 'Kernet / Helper' || c.role.includes('Helper'));

  const displayedCrews = (activeTab === 'drivers' ? driversList : helpersList).filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const handleOpenAdd = () => {
    setEditingCrew(null);
    setFormData({
      name: '',
      phone: '081',
      role: activeTab === 'drivers' ? 'Driver Utama' : 'Kernet / Helper',
      licenseNumber: 'SIM-' + Math.floor(Math.random() * 900000 + 100000),
      licenseType: activeTab === 'drivers' ? 'SIM B2 Umum' : 'SIM A',
      status: 'available',
      certificationsStr: activeTab === 'drivers' ? 'SIM B2 Umum, Defensive Driving' : 'K3 Umum Dasar, Muatan Berbahaya Ringan',
      routeExperienceStr: 'Banyuwangi DC, Tapal Kuda, Lintas Jawa-Bali'
    });
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (crew: Crew) => {
    setEditingCrew(crew);
    setFormData({
      name: crew.name,
      phone: crew.phone,
      role: crew.role,
      licenseNumber: crew.licenseNumber,
      licenseType: crew.licenseType,
      status: crew.status,
      certificationsStr: (crew.certifications || ['SIM B2 Umum', 'Defensive Driving']).join(', '),
      routeExperienceStr: (crew.routeExperience || ['Jawa Timur', 'Bali']).join(', ')
    });
    setIsAddEditOpen(true);
  };

  const handleSaveCrew = (e: React.FormEvent) => {
    e.preventDefault();
    const certifications = formData.certificationsStr.split(',').map(s => s.trim()).filter(Boolean);
    const routeExperience = formData.routeExperienceStr.split(',').map(s => s.trim()).filter(Boolean);

    if (editingCrew) {
      logisticsStore.updateCrew(editingCrew.id, {
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        licenseNumber: formData.licenseNumber,
        licenseType: formData.licenseType,
        status: formData.status,
        certifications,
        routeExperience
      });
      logisticsStore.logActivity('Update Profil Kru', formData.name, `Memperbarui database pool kru ID: ${editingCrew.id}`);
    } else {
      logisticsStore.addCrew({
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        licenseNumber: formData.licenseNumber,
        licenseType: formData.licenseType,
        status: formData.status,
        certifications,
        routeExperience,
        currentFleetId: undefined
      });
      logisticsStore.logActivity('Tambah Kru Baru', formData.name, `Menambahkan profil baru ke database pool (${formData.role})`);
    }

    setIsAddEditOpen(false);
    onRefresh();
  };

  const handleConfirmDelete = () => {
    if (!crewToDelete) return;
    logisticsStore.deleteCrew(crewToDelete.id);
    logisticsStore.logActivity('Hapus Profil Kru', crewToDelete.name, `Menghapus ID ${crewToDelete.id} dari database pool (${crewToDelete.role})`);
    setCrewToDelete(null);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Manajemen Data Pool Driver & Helper</h3>
              <p className="text-xs text-slate-400">Database terpusat profil kru, masa berlaku SIM, status sertifikasi, dan rekam jejak rute</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="bg-slate-950/60 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-4 py-2 rounded-lg font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'drivers' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Pool Driver ({driversList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('helpers')}
              className={`px-4 py-2 rounded-lg font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'helpers' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Pool Helper / Kernet ({helpersList.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, no SIM, atau no HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Profil Baru</span>
            </button>
          </div>
        </div>

        {/* Main Content Area / Cards Grid */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {displayedCrews.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">Tidak ada data profil kru yang ditemukan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedCrews.map(crew => (
                <div key={crew.id} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{crew.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          crew.status === 'available' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          crew.status === 'on-duty' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {crew.status === 'available' ? 'Tersedia' : crew.status === 'on-duty' ? 'Bertugas' : 'Istirahat'}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-2">
                        <span>{crew.role}</span>
                        <span>•</span>
                        <span className="text-indigo-400 font-mono font-bold">{crew.licenseNumber} ({crew.licenseType})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(crew)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Edit Profil"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCrewToDelete(crew)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                        title="Hapus Profil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400">Total Trip Selesai</div>
                      <div className="font-bold text-white text-sm mt-0.5">{crew.tripsCompleted} Trip</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Rating Kinerja</div>
                      <div className="font-bold text-amber-400 text-sm mt-0.5 flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{crew.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Kontak Telepon</div>
                      <div className="font-bold text-slate-200 text-xs mt-1 truncate">{crew.phone}</div>
                    </div>
                  </div>

                  {/* Certifications Badge List */}
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Status Sertifikasi & Kompetensi:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(crew.certifications || [crew.licenseType, 'Defensive Driving']).map((cert, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-medium">
                          ✓ {cert}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Route Experience List */}
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Pengalaman Rute & Wilayah:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(crew.routeExperience || ['Banyuwangi Hub', 'Lintas Tapal Kuda']).map((route, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-md text-[10px] font-medium">
                          📍 {route}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-slate-400 text-xs">
            Total Database Pool: <strong className="text-white">{crews.length} Kru Aktif</strong> ({driversList.length} Driver, {helpersList.length} Helper).
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
          >
            Tutup Manajemen Pool
          </button>
        </div>

      </div>

      {/* Add / Edit Modal Sub-Popup */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-black text-white text-sm">
                {editingCrew ? 'Edit Profil Kru Pool' : 'Tambah Profil Kru Baru ke Pool'}
              </h4>
              <button onClick={() => setIsAddEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCrew} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Nama Lengkap Kru</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Peran / Jabatan</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Driver Utama">Driver Utama</option>
                    <option value="Driver Cadangan">Driver Cadangan</option>
                    <option value="Kernet / Helper">Kernet / Helper</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Status Ketersediaan</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="available">Tersedia (Available)</option>
                    <option value="on-duty">Bertugas (On Duty)</option>
                    <option value="off">Istirahat / Off</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Nomor SIM / KTA</label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber}
                    onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="Contoh: SIM-35120984"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Golongan SIM</label>
                  <select
                    value={formData.licenseType}
                    onChange={e => setFormData({ ...formData, licenseType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="SIM B2 Umum">SIM B2 Umum</option>
                    <option value="SIM B1 Umum">SIM B1 Umum</option>
                    <option value="SIM A">SIM A</option>
                    <option value="-">- (Tanpa SIM / Belum Ada)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Nomor Telepon / WhatsApp</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08123456789"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Status Sertifikasi (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={formData.certificationsStr}
                  onChange={e => setFormData({ ...formData, certificationsStr: e.target.value })}
                  placeholder="SIM B2 Umum, Defensive Driving, Sertifikat Kesehatan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Pengalaman Rute & Wilayah (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={formData.routeExperienceStr}
                  onChange={e => setFormData({ ...formData, routeExperienceStr: e.target.value })}
                  placeholder="Banyuwangi Kota, Lintas Jawa-Bali, Tapal Kuda"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition cursor-pointer shadow"
                >
                  Simpan Profil Kru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Warning Konfirmasi Hapus Kru */}
      {crewToDelete && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Konfirmasi Hapus Kru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Penghapusan profil supir & helper dari database pool
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-800 transition cursor-pointer text-base leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">
                    Yakin ingin menghapus profil kru ini?
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Data kru supir/helper ini akan dihapus secara permanen dari database master pool logistik.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{crewToDelete.name}</h4>
                    <span className="text-xs text-slate-400">{crewToDelete.role}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {crewToDelete.licenseType}
                  </span>
                </div>
                <div className="text-xs text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
                  <span>Kontak: <strong className="text-white">{crewToDelete.phone}</strong></span>
                  <span>Total Trip: <strong className="text-white">{crewToDelete.tripsCompleted}</strong></span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Kru</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
