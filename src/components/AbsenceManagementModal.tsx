import React, { useState } from 'react';
import { logisticsStore } from '../services/store';
import { attendanceService } from '../services/attendanceService';
import { X, AlertTriangle, UserCheck } from 'lucide-react';

export const AbsenceManagementModal: React.FC<{ 
  onClose: () => void,
  initialCrewId?: string,
  initialDate?: string
}> = ({ onClose, initialCrewId, initialDate }) => {
  const [crewId, setCrewId] = useState(initialCrewId || '');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'absent' | 'sick' | 'leave'>('absent');
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const crews = logisticsStore.getCrews();
  const schedules = logisticsStore.getSchedules();

  const handleLogAbsence = () => {
    if (!crewId) return;
    
    // 1. Log attendance
    attendanceService.addAttendanceRecord({
      id: 'att-' + Math.random().toString(36).substring(2, 9),
      crewId,
      date,
      status,
      reason: 'HR Action'
    });
    logisticsStore.updateCrewStatus(crewId, 'off');
    
    // 2. Find impacted schedules
    const impactedSchedules = schedules.filter(s => 
      s.crewId === crewId && s.departureDate.startsWith(date) && (s.status === 'scheduled' || s.status === 'in_transit')
    );
    
    // 3. Find recommendations for each
    const recs = impactedSchedules.map(sch => {
      const area = sch.store?.city || 'Jawa';
      const availableCrews = crews.filter(c => c.status === 'available' && c.id !== crewId);
      
      const scoredCrews = availableCrews.map(c => {
        const threshold = logisticsStore.checkCrewAreaThreshold(c.id, area);
        return { crew: c, score: threshold.tripCount };
      });
      
      return {
        schedule: sch,
        alternatives: scoredCrews.sort((a, b) => a.score - b.score).slice(0, 3)
      };
    });
    
    setRecommendations(recs);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-2xl text-white shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-emerald-400">HR: Manajemen Ketidakhadiran</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">Kru Driver</label>
            <select className="w-full bg-slate-800 p-4 rounded-xl border border-slate-700" value={crewId} onChange={e => setCrewId(e.target.value)}>
              <option value="">Pilih Kru</option>
              {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">Status</label>
            <select className="w-full bg-slate-800 p-4 rounded-xl border border-slate-700" value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="absent">Alpha (Tidak Hadir)</option>
              <option value="sick">Sakit</option>
              <option value="leave">Ijin</option>
            </select>
          </div>
        </div>
        
        <button onClick={handleLogAbsence} className="w-full bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-bold shadow-lg transition">
          Proses Status & Rekomendasi Pengganti
        </button>

        {recommendations.length > 0 && (
          <div className="mt-8 pt-8 border-t border-slate-700 space-y-6">
            <h3 className="text-amber-400 font-bold flex items-center gap-2 text-lg"><AlertTriangle /> Rekomendasi Pengganti</h3>
            {recommendations.map(r => (
              <div key={r.schedule.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p className="font-semibold text-white">Jadwal: {r.schedule.trackingNumber} - {r.schedule.store?.storeName}</p>
                <div className="mt-4 space-y-2">
                  {r.alternatives.map((a: any) => (
                    <div key={a.crew.id} className="flex justify-between items-center text-sm bg-slate-900 p-3 rounded-lg">
                      <span>{a.crew.name}</span>
                      <span className="text-slate-400">Histori Area: {a.score}x</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
