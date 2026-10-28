import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  HelpCircle, 
  Check
} from 'lucide-react';
import { AreaMappingEntry, OfficialAreaItem } from '../services/areaAutoMapper';

interface AreaAutoMappingSectionProps {
  areaMappings: Record<string, AreaMappingEntry>;
  officialAreas: OfficialAreaItem[];
  onMappingChange: (rawArea: string, targetOfficialArea: string) => void;
  onRequestCreateArea: (rawArea: string) => void;
  className?: string;
}

export const AreaAutoMappingSection: React.FC<AreaAutoMappingSectionProps> = ({
  areaMappings,
  officialAreas,
  onMappingChange,
  onRequestCreateArea,
  className = ''
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'unmapped' | 'suggested' | 'matched'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const mappingList = useMemo(() => {
    return Object.values(areaMappings);
  }, [areaMappings]);

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
        const rawMatch = item.rawArea.toLowerCase().includes(q);
        const officialMatch = item.matchedOfficialArea?.toLowerCase().includes(q);
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
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Saran ({counts.suggested})</span>
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
              <span>Baru ({counts.unmapped})</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs focus:border-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Tabel Pemetaan Area Ringkas */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <th className="p-2.5 w-1/3 border-r border-slate-200 dark:border-slate-800">Area Kirim (Excel)</th>
              <th className="p-2.5 w-28 border-r border-slate-200 dark:border-slate-800">Status</th>
              <th className="p-2.5 border-r border-slate-200 dark:border-slate-800">Area Resmi Sistem</th>
              <th className="p-2.5 w-24 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium bg-white dark:bg-slate-900/40">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  Tidak ada area yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isMatched = item.confidence === 'exact' || item.confidence === 'high';
                const isSuggested = item.confidence === 'suggested';
                const isUnmapped = item.confidence === 'unmapped';

                return (
                  <tr 
                    key={item.rawArea}
                    className={`transition-colors ${
                      isUnmapped 
                        ? 'bg-rose-50/30 dark:bg-rose-950/10' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="p-2.5 border-r border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{item.rawArea}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({item.occurrenceCount}x)
                        </span>
                      </div>
                    </td>

                    <td className="p-2.5 border-r border-slate-200 dark:border-slate-800">
                      {isMatched && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Sesuai</span>
                        </span>
                      )}
                      {isSuggested && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60">
                          <HelpCircle className="w-3 h-3 text-amber-600" />
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
                        value={item.matchedOfficialArea || ''}
                        onChange={(e) => {
                          if (e.target.value === '__CREATE_NEW__') {
                            onRequestCreateArea(item.rawArea);
                          } else {
                            onMappingChange(item.rawArea, e.target.value);
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold transition focus:outline-hidden ${
                          isUnmapped
                            ? 'bg-rose-50 dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-emerald-500'
                        }`}
                      >
                        <option value="">-- Pilih Area --</option>
                        <option value="__CREATE_NEW__" className="text-emerald-600 font-black">
                          + Tambah Area &apos;{item.rawArea}&apos;
                        </option>
                        {officialAreas.map((area) => (
                          <option key={area.id} value={area.name}>
                            {area.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onRequestCreateArea(item.rawArea)}
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
