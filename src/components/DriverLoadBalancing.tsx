import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { logisticsStore } from '../services/store';
import { Users } from 'lucide-react';

export const DriverLoadBalancing: React.FC = () => {
  const history = logisticsStore.getCrewDeliveryHistory();

  const chartData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    const months = new Set<string>();

    history.forEach(item => {
      const date = new Date(item.completionDate);
      const month = date.toLocaleString('id-ID', { month: 'short' });
      const crew = item.crewName;
      
      if (!data[month]) data[month] = {};
      if (!data[month][crew]) data[month][crew] = 0;
      
      data[month][crew] += 1;
      months.add(month);
    });

    return Array.from(months).map(month => ({
      month,
      ...data[month]
    }));
  }, [history]);

  const drivers = useMemo(() => {
    const s = new Set<string>();
    history.forEach(h => s.add(h.crewName));
    return Array.from(s);
  }, [history]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white">Load Balancing Driver (Penugasan per Bulan)</h3>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
            />
            <Legend />
            {drivers.map((driver, index) => (
              <Bar 
                key={driver} 
                dataKey={driver} 
                fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5]} 
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
