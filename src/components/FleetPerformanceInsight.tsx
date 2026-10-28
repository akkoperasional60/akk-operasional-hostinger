import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { logisticsStore } from '../services/store';

export const FleetPerformanceInsight: React.FC = () => {
  const crews = logisticsStore.getCrews();
  const schedules = logisticsStore.getSchedules();

  const performanceData = useMemo(() => {
    return crews.map(crew => {
      const crewSchedules = schedules.filter(s => s.crewId === crew.id && s.status === 'delivered');
      const totalTrips = crewSchedules.length;
      
      // Calculate a basic performance metric (e.g., successful trips / total assigned)
      // For this implementation, we just use total completed trips as a proxy for activity
      return {
        name: crew.name,
        trips: totalTrips,
        fill: totalTrips > 10 ? '#10b981' : totalTrips > 5 ? '#f59e0b' : '#ef4444'
      };
    }).sort((a, b) => b.trips - a.trips).slice(0, 8); // Top 8 performers
  }, [crews, schedules]);

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
      <h3 className="text-lg font-bold text-white mb-6">Insight Performa Kru (Tren Historis)</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="trips" radius={[4, 4, 0, 0]}>
              {performanceData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
