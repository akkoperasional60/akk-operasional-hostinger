import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { logisticsStore } from '../services/store';
import { Users, Truck, CheckCircle2, Award } from 'lucide-react';

const VIBRANT_BAR_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1'  // Indigo
];

export const DriverLoadBalancing: React.FC = () => {
  const [schedules, setSchedules] = useState(() => logisticsStore.getSchedules());
  const [history, setHistory] = useState(() => logisticsStore.getCrewDeliveryHistory());

  useEffect(() => {
    const updateData = () => {
      setSchedules(logisticsStore.getSchedules());
      setHistory(logisticsStore.getCrewDeliveryHistory());
    };
    updateData();
    return logisticsStore.subscribe(updateData);
  }, []);

  // Compute monthly driver load counts dynamically combining active schedules + history
  const { chartData, drivers, totalTripsCount } = useMemo(() => {
    const monthlyDriverMap: Record<string, Record<string, number>> = {};
    const monthsSet = new Set<string>();
    const driversSet = new Set<string>();
    let total = 0;

    // 1. Process active schedules
    schedules.forEach(s => {
      const driver = (s.crew?.name || (s as any).driver || 'Driver').trim();
      if (!driver || driver === 'Driver') return;

      const dateObj = s.departureDate ? new Date(s.departureDate) : new Date();
      if (isNaN(dateObj.getTime())) return;

      const monthLabel = dateObj.toLocaleString('id-ID', { month: 'short' });
      monthsSet.add(monthLabel);
      driversSet.add(driver);

      if (!monthlyDriverMap[monthLabel]) monthlyDriverMap[monthLabel] = {};
      if (!monthlyDriverMap[monthLabel][driver]) monthlyDriverMap[monthLabel][driver] = 0;
      monthlyDriverMap[monthLabel][driver] += 1;
      total += 1;
    });

    // 2. Process crew history (avoiding duplicate counting if scheduleId matches)
    const scheduleIdSet = new Set(schedules.map(s => s.id));
    history.forEach(item => {
      if (item.scheduleId && scheduleIdSet.has(item.scheduleId)) return;

      const driver = (item.crewName || 'Driver').trim();
      if (!driver || driver === 'Driver') return;

      const dateObj = item.completionDate ? new Date(item.completionDate) : new Date();
      if (isNaN(dateObj.getTime())) return;

      const monthLabel = dateObj.toLocaleString('id-ID', { month: 'short' });
      monthsSet.add(monthLabel);
      driversSet.add(driver);

      if (!monthlyDriverMap[monthLabel]) monthlyDriverMap[monthLabel] = {};
      if (!monthlyDriverMap[monthLabel][driver]) monthlyDriverMap[monthLabel][driver] = 0;
      monthlyDriverMap[monthLabel][driver] += 1;
      total += 1;
    });

    const monthsArray = Array.from(monthsSet);
    // If no data, provide current month fallback
    if (monthsArray.length === 0) {
      const curMonth = new Date().toLocaleString('id-ID', { month: 'short' });
      monthsArray.push(curMonth);
    }

    const data = monthsArray.map(month => ({
      month,
      ...(monthlyDriverMap[month] || {})
    }));

    return {
      chartData: data,
      drivers: Array.from(driversSet),
      totalTripsCount: total
    };
  }, [schedules, history]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header with Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">Load Balancing Driver (Penugasan per Bulan)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pemerataan ritase pengiriman antar pengemudi untuk pencegahan kelelahan (Fatigue SLA).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            <span>Total Ritase: <strong className="text-white font-mono">{totalTripsCount} Rit</strong></span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Driver Aktif: <strong className="text-white font-mono">{drivers.length} Personel</strong></span>
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
            barCategoryGap="25%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              fontSize={11}
              fontWeight="bold"
              tickLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              allowDecimals={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '12px',
                color: '#f8fafc',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                fontSize: '12px'
              }}
              cursor={{ fill: 'rgba(51, 65, 85, 0.25)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
            />
            {drivers.map((driver, index) => (
              <Bar
                key={driver}
                dataKey={driver}
                name={driver}
                fill={VIBRANT_BAR_COLORS[index % VIBRANT_BAR_COLORS.length]}
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
