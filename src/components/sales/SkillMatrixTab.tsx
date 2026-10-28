import React, { useState, useEffect } from 'react';
import {
  Award,
  Star,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  BookOpen,
  Edit3,
  Search,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import { AdminSkillProfile } from '../../types';

export interface SkillMatrixTabProps {
  adminOptions: string[];
}

export const SkillMatrixTab: React.FC<SkillMatrixTabProps> = ({ adminOptions }) => {
  const [profiles, setProfiles] = useState<AdminSkillProfile[]>(logisticsStore.getSkillProfiles());
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfile, setEditingProfile] = useState<AdminSkillProfile | null>(null);

  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      setProfiles(logisticsStore.getSkillProfiles());
    });
    return unsub;
  }, []);

  const filtered = profiles.filter(p =>
    p.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.roleTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelLabel = (lvl: number) => {
    switch (lvl) {
      case 5:
        return 'Tingkat 5: Master / Trainer';
      case 4:
        return 'Tingkat 4: Mahir / Advanced';
      case 3:
        return 'Tingkat 3: Mandiri / Kompeten';
      case 2:
        return 'Tingkat 2: Berkembang';
      case 1:
      default:
        return 'Tingkat 1: Dasar / Pemula';
    }
  };

  const handleUpdateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    logisticsStore.updateSkillProfile(editingProfile.id, editingProfile.skills);
    setEditingProfile(null);
  };

  const handleSkillLevelChange = (skillIndex: number, newLevel: 1 | 2 | 3 | 4 | 5) => {
    if (!editingProfile) return;
    const updatedSkills = [...editingProfile.skills];
    updatedSkills[skillIndex] = {
      ...updatedSkills[skillIndex],
      level: newLevel
    };
    setEditingProfile({
      ...editingProfile,
      skills: updatedSkills
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Competency & Talent Management
            </span>
            <span className="text-xs text-slate-500">Standar Keahlian Admin AKK</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Skill Matrix Admin Penjualan</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Matriks evaluasi kompetensi teknis kemasan karton box, sistem SAP ERP, negosiasi B2B, kendali durasi muat, penanganan retur, dan penagihan piutang.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Personel Admin</span>
            <UserCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{profiles.length} Admin</div>
          <div className="text-xs text-slate-500 mt-1">Mencakup Wilayah 1, 2, dan Luar Pulau</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rata-rata Skor Tim</span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {profiles.length
              ? Math.round(profiles.reduce((acc, p) => acc + p.overallScore, 0) / profiles.length)
              : 0}
            %
          </div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">Kategori Sangat Kompeten (Grade A)</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sertifikasi Packaging</span>
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">85.4%</div>
          <div className="text-xs text-purple-600 mt-1">SOP Mutu & Standar Karton Box Lolos Audit</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari nama admin penjualan atau spesialisasi jabatan..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Grid of Admin Skill Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map(profile => (
          <div
            key={profile.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-purple-300 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Profile Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{profile.adminName}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {profile.experienceYears} Thn Pengalaman
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{profile.roleTitle}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-purple-700">{profile.overallScore}%</div>
                  <div className="text-[10px] text-slate-400 font-medium">Indeks Kompetensi</div>
                </div>
              </div>

              {/* Skills List */}
              <div className="space-y-3 mt-4">
                {profile.skills.map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5">
                        {s.skillName}
                        {s.certified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                        )}
                      </span>
                      <span className="text-[11px] font-semibold text-purple-700">
                        Level {s.level} / 5
                      </span>
                    </div>

                    {/* 5-step visual bar */}
                    <div className="grid grid-cols-5 gap-1 h-2">
                      {[1, 2, 3, 4, 5].map(step => (
                        <div
                          key={step}
                          className={`rounded-sm transition-colors ${
                            step <= s.level
                              ? s.level === 5
                                ? 'bg-purple-600'
                                : s.level >= 4
                                ? 'bg-indigo-600'
                                : 'bg-blue-500'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Training */}
              <div className="mt-4 p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                <BookOpen className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800">Pelatihan Terakhir: </span>
                  {profile.recentTraining}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setEditingProfile({ ...profile })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Evaluasi / Update Skor
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Evaluasi Skill Admin */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Evaluasi Skill: {editingProfile.adminName}</h3>
                <p className="text-xs text-purple-200">{editingProfile.roleTitle}</p>
              </div>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-purple-200 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateSkill} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <p className="text-slate-600 text-xs">
                Sesuaikan level penguasaan keterampilan untuk masing-masing pilar kerja (1 = Pemula s/d 5 = Master/Trainer).
              </p>

              <div className="space-y-3">
                {editingProfile.skills.map((s, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">{s.skillName}</span>
                      <span className="text-xs font-semibold text-purple-700">
                        {getLevelLabel(s.level)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => handleSkillLevelChange(idx, lvl as any)}
                          className={`flex-1 py-1.5 rounded font-bold transition-all ${
                            s.level === lvl
                              ? 'bg-purple-600 text-white shadow'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold shadow"
                >
                  Simpan Perubahan Skor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
