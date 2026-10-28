import React, { useState, useMemo } from 'react';
import { 
  User, 
  Users, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Check
} from 'lucide-react';
import { CrewMappingEntry, OfficialCrewItem } from '../services/crewAutoMapper';

interface CrewAutoMappingSectionProps {
  crewMappings: Record<string, CrewMappingEntry>;
  officialCrews: OfficialCrewItem[];
  onMappingChange: (rawCrewName: string, targetCrewName: string) => void;
  onRequestCreateCrew: (rawCrewName: string, roleHint?: 'Driver' | 'Helper') => void;
  className?: string;
}

export const CrewAutoMappingSection: React.FC<CrewAutoMappingSectionProps> = ({
  crewMappings,
  officialCrews,
  onMappingChange,
  onRequestCreateCrew,
  className = ''
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'unmapped' | 'suggested' | 'matched'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const cleanOfficialCrews = useMemo(() => {
    return officialCrews.filter(c => c.name.trim().toLowerCase() !== 'super admin');
  }, [officialCrews]);

  const mappingList = useMemo(() => {
    return Object.values(crewMappings);
  }, [crewMappings]);

  const counts = useMemo(() => {
    let matched = 0;
    let suggested = 0;
    let unmapped = 0;

    mappingList.forEach(m => {
      if (m.confidence === 'exact' || m.confidence === 'high') matched++;
      else if (m.confidence === 'suggested') suggested++;
      else unmapped++;
    });

    return { total: mappingList.length, matched, suggested, unmapped };
  }, [mappingList]);

  const filteredItems = useMemo(() => {
    return mappingList.filter(item => {
      if (filterTab === 'matched' && item.confidence !== 'exact' && item.confidence !== 'high') return false;
      if (filterTab === 'suggested' && item.confidence !== 'suggested') return false;
      if (filterTab === 'unmapped' && item.confidence !== 'unmapped') return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const rawMatch = item.rawName.toLowerCase().includes(q);
        const officialMatch = item.matchedCrewName?.toLowerCase().includes(q);
        if (!rawMatch && !officialMatch) return false;
      }

      return true;
    });
  }, [mappingList, filterTab, searchTerm]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header Ringkas */}
      <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Semua ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('matched')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterTab === 'matched'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sesuai ({counts.matched})</span>
          </button>

          {counts.suggested > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab('suggested')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'suggested'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Tinjau ({counts.suggested})</span>
            </button>
          )}

          {counts.unmapped > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab('unmapped')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'unmapped'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Belum Terdaftar ({counts.unmapped})</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kru..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs focus:border-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Tabel Pemetaan Kru Ringkas */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <th className="p-2.5 w-1/3">Nama Kru (Excel)</th>
              <th className="p-2.5 w-28">Status</th>
              <th className="p-2.5">Data Kru &amp; Supir</th>
              <th className="p-2.5 w-24 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-medium bg-white dark:bg-slate-900/40">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500 dark:text-slate-400">
                  Tidak ada kru yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isExactOrHigh = item.confidence === 'exact' || item.confidence === 'high';
                const isSuggested = item.confidence === 'suggested';
                const isUnmapped = item.confidence === 'unmapped';

                return (
                  <tr 
                    key={item.rawName}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-850/50 transition ${
                      isUnmapped ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    <td className="p-2.5 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white uppercase">
                            {item.rawName}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            ({item.occurrenceCount}x)
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-2.5 border-r border-slate-200 dark:border-slate-800">
                      {isExactOrHigh && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Sesuai</span>
                        </span>
                      )}
                      {isSuggested && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Saran</span>
                        </span>
                      )}
                      {isUnmapped && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Baru</span>
                        </span>
                      )}
                    </td>

                    <td className="p-2.5 border-r border-slate-200 dark:border-slate-800">
                      <select
                        value={item.matchedCrewName || ''}
                        onChange={(e) => {
                          if (e.target.value === '__CREATE_NEW__') {
                            onRequestCreateCrew(item.rawName, item.roleHint);
                          } else {
                            onMappingChange(item.rawName, e.target.value);
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold transition focus:outline-hidden ${
                          isUnmapped
                            ? 'bg-rose-50 dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-blue-500'
                        }`}
                      >
                        <option value="">-- Pilih Kru --</option>
                        <option value="__CREATE_NEW__" className="text-blue-600 font-black">
                          + Tambah Kru &apos;{item.rawName}&apos;
                        </option>
                        {cleanOfficialCrews.map((crew) => (
                          <option key={crew.id} value={crew.name}>
                            {crew.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onRequestCreateCrew(item.rawName, item.roleHint)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tambah</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
