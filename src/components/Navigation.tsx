import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, Truck, FileSpreadsheet, Map, Radio, Database, Shield, ChevronDown, Bell, LogOut, UserCircle, Menu, X, Building2, History, Users } from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { logisticsStore } from '../services/store';
import { AkkLogo } from './AkkLogo';

export type NavTab = 'dashboard' | 'operational_dashboard' | 'schedules' | 'fleets' | 'crew_history' | 'tracking_eval' | 'customer_map' | 'architecture' | 'hr_dashboard';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(logisticsStore.getCurrentUser());
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setCurrentUser(logisticsStore.getCurrentUser());
    });
  }, []);

  const handleSwitchRole = (role: UserRole) => {
    logisticsStore.setCurrentRole(role);
    setIsRoleMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard Utama', icon: LayoutDashboard, badge: null },
    { id: 'schedules' as NavTab, label: 'Jadwal & Penugasan', icon: Calendar, badge: '5 Aktif' },
    { id: 'fleets' as NavTab, label: 'Armada & Kru Supir', icon: Truck, badge: null },
    { id: 'crew_history' as NavTab, label: 'Histori & Otorisasi Kru', icon: History, badge: 'Rotasi Wilayah' },
    { id: 'tracking_eval' as NavTab, label: 'Evaluasi Jalur (Excel)', icon: FileSpreadsheet, badge: 'SheetJS' },
    { id: 'customer_map' as NavTab, label: 'Pemetaan Toko Retail', icon: Map, badge: '10 Outlet' },
    { id: 'hr_dashboard' as NavTab, label: 'Dashboard HR', icon: Users, badge: null },
    { id: 'architecture' as NavTab, label: 'Skema SQL & MySQL', icon: Database, badge: 'MySQL' },
  ].filter(item => {
    if (currentUser.role === 'sales_admin') {
      return item.id === 'dashboard' || item.id === 'tracking_eval';
    }
    if (currentUser.role === 'driver' || currentUser.role === 'spv_logistik') {
      return item.id !== 'architecture';
    }
    return true;
  });

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <AkkLogo size="md" />
            </div>
          </div>

          {/* Central Hub Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Hub:</span>
            <strong className="text-slate-200">Gudang Pusat Banyuwangi DC</strong>
            <span className="text-slate-600">&bull;</span>
            <span className="font-mono text-emerald-400">{currentTime}</span>
          </div>

          {/* User Profile & RBAC Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {currentUser.fullName.substring(0, 1)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">{currentUser.fullName}</div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentUser.role === 'super_admin' && 'Super Admin (Logistik Mgr)'}
                  {currentUser.role === 'spv_logistik' && 'SPV Logistik / Planner'}
                  {currentUser.role === 'driver' && 'Driver / Kru Lapangan'}
                  {currentUser.role === 'sales_admin' && 'Adm. Penjualan'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {/* Role Switcher Dropdown */}
            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 space-y-1 text-xs z-50">
                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Simulasi Hak Akses (RBAC)</div>
                  <div className="text-slate-300 text-xs mt-0.5">Pilih peran untuk menguji otorisasi:</div>
                </div>

                <button
                  onClick={() => handleSwitchRole('super_admin')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                    currentUser.role === 'super_admin' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">Super Admin / Logistik Manager</div>
                    <div className="text-[10px] text-slate-400">Kontrol penuh, skema DB, analitik</div>
                  </div>
                  {currentUser.role === 'super_admin' && <Shield className="w-3.5 h-3.5 text-blue-400" />}
                </button>

                <button
                  onClick={() => handleSwitchRole('spv_logistik')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                    currentUser.role === 'spv_logistik' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">SPV Logistik / Route Planner</div>
                    <div className="text-[10px] text-slate-400">Penjadwalan, armada, tiket kapal</div>
                  </div>
                  {currentUser.role === 'spv_logistik' && <Shield className="w-3.5 h-3.5 text-blue-400" />}
                </button>

                <button
                  onClick={() => handleSwitchRole('sales_admin')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition cursor-pointer ${
                    currentUser.role === 'sales_admin' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold">Adm. Penjualan</div>
                    <div className="text-[10px] text-slate-400">Manajemen Order & Aktivitas Sales</div>
                  </div>
                  {currentUser.role === 'sales_admin' && <Shield className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm pt-16">
          <div className="bg-slate-900 border-b border-slate-800 p-4 space-y-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Navigation Bar for Quick Desktop Tab Switching */}
      <div className="hidden lg:block bg-slate-900/60 border-b border-slate-800 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
