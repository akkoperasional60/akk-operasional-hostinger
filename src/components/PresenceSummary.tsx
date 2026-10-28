import React from 'react';
import { attendanceService } from '../services/attendanceService';
import { Users, CheckCircle2, AlertCircle, CalendarDays, XCircle } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';

export const PresenceSummary: React.FC = () => {
  const todayDate = '2026-09-23';
  const attendance = attendanceService.getAttendanceByDate(todayDate);
  
  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    sick: attendance.filter(a => a.status === 'sick').length,
    leave: attendance.filter(a => a.status === 'leave').length,
    absent: attendance.filter(a => a.status === 'absent').length,
  };

  // Mock trend data for last 7 days
  const trendData = [
    { day: 'Sen', present: 135 },
    { day: 'Sel', present: 138 },
    { day: 'Rab', present: 140 },
    { day: 'Kam', present: 136 },
    { day: 'Jum', present: 139 },
    { day: 'Sab', present: 141 },
    { day: 'Min', present: stats.present },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-500/10 rounded-xl">
          <Users className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-white font-bold">Ringkasan Kehadiran Hari Ini</h3>
          <p className="text-slate-400 text-sm">Update real-time status tim</p>
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-white font-semibold">{stats.present} Hadir</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-amber-400" />
            <span className="text-white font-semibold">{stats.leave} Ijin</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <span className="text-white font-semibold">{stats.sick} Sakit</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-400" />
            <span className="text-white font-semibold">{stats.absent} Alpha</span>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="h-12 w-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <Bar dataKey="present" radius={[2, 2, 0, 0]}>
                {trendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === trendData.length - 1 ? '#34d399' : '#475569'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
