import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SLAStatus {
  name: string;
  value: number;
  color: string;
}

interface SlaGaugeWidgetProps {
  onTimePercentage: number;
  previousPercentage: number;
}

export const SlaGaugeWidget: React.FC<SlaGaugeWidgetProps> = ({ onTimePercentage, previousPercentage }) => {
  const data: SLAStatus[] = [
    { name: 'On-Time', value: onTimePercentage, color: '#10b981' }, // Emerald-500
    { name: 'Delayed', value: 100 - onTimePercentage, color: '#ef4444' }, // Rose-500
  ];

  const trend = onTimePercentage - previousPercentage;
  const isPositiveTrend = trend >= 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-bold text-white">Real-time SLA Performance</h3>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isPositiveTrend ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {isPositiveTrend ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      </div>
      <div className="h-40 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              cornerRadius={10}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/4 text-center">
          <span className="text-3xl font-black text-white">{onTimePercentage}%</span>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">On-Time</p>
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> On-Time</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Delayed</span>
      </div>
      <p className="text-[10px] text-slate-500 mt-2 text-center">Vs. 7 hari terakhir: {previousPercentage}%</p>
    </div>
  );
};
