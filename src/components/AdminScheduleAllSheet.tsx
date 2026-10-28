import React, { useMemo } from 'react';
import { rawAdminScheduleData } from '../data/adminSchedule';

export const AdminScheduleAllSheet: React.FC = () => {
  const tableData = useMemo(() => {
    // Basic CSV parser
    const rows = rawAdminScheduleData.split('\n').map(row => row.split(','));
    return rows.filter(row => row.some(cell => cell.trim() !== ''));
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg overflow-x-auto">
      <h3 className="text-sm font-bold text-white mb-4">Sheet: ALL - Admin Schedule</h3>
      <table className="w-full text-[10px] text-slate-300 border-collapse">
        <thead>
          <tr className="bg-slate-800 text-left">
            {tableData[0]?.map((header, i) => (
              <th key={`header-${i}`} className="p-2 border border-slate-700">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.slice(1).map((row, i) => (
            <tr key={`row-${i}`} className="hover:bg-slate-800/50">
              {row.map((cell, j) => (
                <td key={`cell-${i}-${j}`} className="p-1.5 border border-slate-700 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
