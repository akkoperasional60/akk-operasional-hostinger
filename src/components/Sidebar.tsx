import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, ClipboardCheck, ChevronDown, House, LogOut, Menu,
  Package, PanelLeftClose, PanelLeftOpen, Pin, Search, Settings2,
  ShoppingBag, Truck, Users, WalletCards, X,
} from 'lucide-react';
import { AkkLogo } from './AkkLogo';
import { ThemeSwitcher } from './ThemeSwitcher';
import { logisticsStore } from '../services/store';
import type { UserProfile } from '../types';
import { canAccess } from '../utils/rbac';
import { preloadTabModule } from '../utils/tabLoaders';
import '../styles/akk-clean-design.css';

// All existing tab IDs remain unchanged. Routes, role permissions, and saved links keep working.
export type NavTab =
  | 'dashboard' | 'driver_portal' | 'driver_reports' | 'analytics_reports'
  | 'operational_dashboard' | 'schedules' | 'portal_validation' | 'fleets'
  | 'spareparts' | 'maintenance_costs' | 'fuel_efficiency' | 'crew_history'
  | 'tracking_eval' | 'fleet_forms' | 'sales_dashboard'
  | 'sales_activities' | 'sales_schedules' | 'sales_loading_duration'
  | 'sales_invoice_so' | 'sales_form_kirim' | 'sales_rfid_scanner'
  | 'sales_muat_validation' | 'sales_skill_matrix' | 'sales_jobdesk'
  | 'sales_kpi' | 'sales_kpi_individual' | 'sales_kpi_fines'
  | 'sales_kpi_nusantara' | 'sales_kpi_omset' | 'customer_map'
  | 'purchasing_dashboard' | 'purchasing_stock_overview'
  | 'purchasing_stock_forecast' | 'purchasing_stok_opname'
  | 'purchasing_kartu_stok' | 'hr_dashboard' | 'ga_security'
  | 'ga_hk' | 'ga_aset' | 'training_videos' | 'training_karyawan'
  | 'finance_overview' | 'finance_dashboard' | 'finance_customer_mapping'
  | 'finance_validasi_form_kirim' | 'finance_billing_app'
  | 'warehouse_dashboard' | 'warehouse_inventory' | 'warehouse_inbound'
  | 'warehouse_outbound' | 'warehouse_scanner' | 'warehouse_slotting'
  | 'warehouse_opname' | 'warehouse_retur_muat' | 'warehouse_cubication'
  | 'warehouse_fleet_cubication' | 'marketing_online' | 'marketing_offline'
  | 'marketing_to_vo_ro' | 'marketing_invoice_validation'
  | 'marketing_sales_mapping' | 'marketing_billing_app' | 'activity_log'
  | 'users' | 'branches' | 'architecture' | 'e2e_testing';

export interface SimpleDropdownItem {
  tab: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
}
export interface SimpleDropdownGroup {
  groupId: string;
  groupTitle?: string;
  groupIcon?: React.ReactNode;
  items: SimpleDropdownItem[];
}
export interface NavCategory {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  defaultTab?: NavTab;
  badge?: React.ReactNode;
  groups: SimpleDropdownGroup[];
  checkAccess: (user: UserProfile) => boolean;
}
interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAuth: (defaultTab?: 'login' | 'register') => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

type MenuEntry = { tab: NavTab; label: string; keywords?: string };
type MenuSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  access: (user: UserProfile) => boolean;
  items: MenuEntry[];
};

// Single-source menu catalogue. Short visible labels, full original tab identifiers.
const SECTIONS: MenuSection[] = [
  { id: 'dashboard', label: 'Beranda', icon: House, access: u => canAccess(u, 'dashboard'),
    items: [['dashboard', 'Ringkasan']].map(([tab, label]) => ({ tab: tab as NavTab, label })) },
  { id: 'logistik', label: 'Pengiriman', icon: Truck, access: u => canAccess(u, 'logistics'), items: [
    { tab: 'operational_dashboard', label: 'Dashboard' },
    { tab: 'schedules', label: 'Jadwal Kirim', keywords: 'jadwal armada kru' },
    { tab: 'driver_portal', label: 'Portal Driver', keywords: 'supir hp' },
    { tab: 'portal_validation', label: 'Validasi Kiriman' },
    { tab: 'driver_reports', label: 'Laporan Driver' },
    { tab: 'tracking_eval', label: 'Evaluasi GPS' },
    { tab: 'fleet_forms', label: 'Form Armada' },
    { tab: 'fleets', label: 'Armada' },
    { tab: 'crew_history', label: 'Kru & Riwayat' },
    { tab: 'spareparts', label: 'Bengkel & Sparepart' },
    { tab: 'maintenance_costs', label: 'Biaya Servis' },
    { tab: 'fuel_efficiency', label: 'BBM' },
    { tab: 'warehouse_fleet_cubication', label: 'Simulasi Muatan' },
  ] },
  { id: 'warehouse', label: 'Gudang', icon: Package, access: u => canAccess(u, 'warehouse'), items: [
    { tab: 'warehouse_scanner', label: 'Database Barang' },
    { tab: 'warehouse_slotting', label: 'Denah Rak' },
    { tab: 'warehouse_inbound', label: 'Barang Masuk' },
    { tab: 'warehouse_outbound', label: 'Barang Keluar' },
    { tab: 'warehouse_opname', label: 'Stok Opname' },
    { tab: 'warehouse_retur_muat', label: 'Retur & Selisih' },
  ] },
  { id: 'sales_admin', label: 'Admin Penjualan', icon: ClipboardCheck, access: u => canAccess(u, 'sales_admin'), items: [
    { tab: 'sales_dashboard', label: 'Dashboard' },
    { tab: 'sales_schedules', label: 'Jadwal Admin' },
    { tab: 'sales_loading_duration', label: 'Durasi Muat' },
    { tab: 'sales_invoice_so', label: 'Faktur & SO' },
    { tab: 'sales_form_kirim', label: 'Form Kirim' },
    { tab: 'sales_rfid_scanner', label: 'Scan Muat' },
    { tab: 'sales_muat_validation', label: 'Validasi Muat' },
    { tab: 'sales_kpi_individual', label: 'Kinerja Staf' },
    { tab: 'sales_kpi_fines', label: 'Denda' },
    { tab: 'sales_kpi_nusantara', label: 'Persentase Kiriman' },
    { tab: 'sales_kpi_omset', label: 'Omzet' },
  ] },
  { id: 'purchasing', label: 'Pembelian', icon: ShoppingBag, access: u => canAccess(u, 'purchasing'), items: [
    { tab: 'purchasing_dashboard', label: 'Dashboard' },
    { tab: 'purchasing_stock_overview', label: 'Stok Bahan' },
    { tab: 'purchasing_stock_forecast', label: 'Prediksi Stok' },
    { tab: 'purchasing_stok_opname', label: 'Stok Opname' },
    { tab: 'purchasing_kartu_stok', label: 'Kartu Stok' },
  ] },
  { id: 'marketing', label: 'Marketing', icon: BarChart3, access: u => canAccess(u, 'marketing'), items: [
    { tab: 'marketing_online', label: 'Marketing Online' },
    { tab: 'marketing_offline', label: 'Marketing Offline' },
    { tab: 'marketing_invoice_validation', label: 'Validasi Faktur' },
    { tab: 'marketing_sales_mapping', label: 'Mapping Sales' },
    { tab: 'marketing_to_vo_ro', label: 'TO / VO / RO' },
    { tab: 'customer_map', label: 'Peta Pelanggan' },
    { tab: 'marketing_billing_app', label: 'Penagihan' },
  ] },
  { id: 'finance_tax', label: 'Keuangan', icon: WalletCards, access: u => canAccess(u, 'finance_tax'), items: [
    { tab: 'finance_overview', label: 'Ringkasan' },
    { tab: 'finance_dashboard', label: 'Tagihan' },
    { tab: 'finance_customer_mapping', label: 'Master Pelanggan' },
    { tab: 'finance_validasi_form_kirim', label: 'Validasi Form Kirim' },
    { tab: 'finance_billing_app', label: 'Penagihan' },
  ] },
  { id: 'hr', label: 'HR & GA', icon: Users, access: u =>
      canAccess(u, 'hr') || canAccess(u, 'hr', 'hr_dashboard') ||
      canAccess(u, 'hr', 'ga_security') || canAccess(u, 'hr', 'ga_hk') ||
      canAccess(u, 'hr', 'ga_aset') || canAccess(u, 'hr', 'training_videos') ||
      canAccess(u, 'hr', 'training_karyawan'), items: [
    { tab: 'hr_dashboard', label: 'Karyawan & Absensi' },
    { tab: 'ga_security', label: 'General Affairs' },
    { tab: 'training_videos', label: 'Pelatihan' },
  ] },
  { id: 'system_master', label: 'Pengaturan', icon: Settings2, access: u => canAccess(u, 'sistem_pengguna'), items: [
    { tab: 'users', label: 'Pengguna & Approval' },
    { tab: 'branches', label: 'Cabang' },
    { tab: 'activity_log', label: 'Riwayat Aktivitas' },
    { tab: 'e2e_testing', label: 'Uji Sistem' },
    { tab: 'architecture', label: 'Database & SQL' },
  ] },
];

// Compatible with old route aliases whose content is rendered under a sibling route.
const ACTIVE_ALIASES: Partial<Record<NavTab, NavTab>> = {
  analytics_reports: 'operational_dashboard',
  ga_hk: 'ga_security', ga_aset: 'ga_security',
  training_karyawan: 'training_videos',
  sales_activities: 'sales_dashboard', sales_kpi: 'sales_kpi_individual',
  sales_skill_matrix: 'sales_kpi_individual', sales_jobdesk: 'sales_kpi_individual',
  warehouse_dashboard: 'warehouse_scanner', warehouse_inventory: 'warehouse_scanner',
  warehouse_cubication: 'warehouse_fleet_cubication',
};
const FAVORITE_KEY = 'akk_ui_favorite_tabs_v1';
const normalize = (value: string) => value.trim().toLocaleLowerCase('id-ID');
const readStoredTabs = (key: string): NavTab[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((v): v is NavTab => typeof v === 'string').slice(0, 10) : [];
  } catch { return []; }
};

const SidebarComponent: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenAuth, isMinimized = false, onToggleMinimize }) => {
  const [user, setUser] = useState<UserProfile>(() => logisticsStore.getCurrentUser());
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<NavTab[]>(() => readStoredTabs(FAVORITE_KEY));
  const [expanded, setExpanded] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => logisticsStore.subscribe(() => {
    const next = logisticsStore.getCurrentUser();
    setUser(previous => previous.id === next.id && previous.role === next.role && previous.status === next.status &&
      previous.fullName === next.fullName && JSON.stringify(previous.permissions) === JSON.stringify(next.permissions) ? previous : next);
  }), []);

  const visible = useMemo(() => SECTIONS.filter(s => s.access(user)).map(section => ({
    ...section,
    items: section.items.filter(item => canAccess(user, item.tab)),
  })).filter(section => section.items.length > 0), [user]);

  const allItems = useMemo(() => visible.flatMap(s => s.items.map(item => ({ ...item, sectionId: s.id, sectionLabel: s.label }))), [visible]);
  const activeTab = ACTIVE_ALIASES[currentTab] || currentTab;
  const activeSection = visible.find(s => s.items.some(item => item.tab === activeTab));

  useEffect(() => {
    if (activeSection) setExpanded(activeSection.id);
  }, [activeSection?.id]);

  useEffect(() => {
    try { document.body.classList.add('akk-clean-ui'); } catch { /* SSR-safe */ }
    return () => { try { document.body.classList.remove('akk-clean-ui'); } catch { /* SSR-safe */ } };
  }, []);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMobileOpen(false); setSearch(''); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 1024) setMobileOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const navigate = useCallback((tab: NavTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
    setSearch('');
  }, [onSelectTab]);

  const toggleFavorite = (tab: NavTab) => {
    setFavorites(before => {
      const next = before.includes(tab) ? before.filter(x => x !== tab) : [tab, ...before].slice(0, 8);
      try { localStorage.setItem(FAVORITE_KEY, JSON.stringify(next)); } catch { /* private browsing */ }
      return next;
    });
  };

  const results = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return allItems.filter(item => terms.every(term => normalize(`${item.label} ${item.sectionLabel} ${item.keywords || ''}`).includes(term))).slice(0, 24);
  }, [allItems, search]);

  const shortcuts = useMemo(() =>
    favorites.map(tab => allItems.find(item => item.tab === tab))
      .filter((item): item is typeof allItems[number] => Boolean(item)).slice(0, 4),
  [allItems, favorites]);

  const renderItem = (item: MenuEntry, sectionLabel?: string) => {
    const active = activeTab === item.tab;
    const starred = favorites.includes(item.tab);
    return (
      <div className={`akk-nav-item-wrap ${active ? 'is-active' : ''}`} key={item.tab}>
        <button type="button" className={`akk-nav-link ${active ? 'is-active' : ''}`}
          onMouseEnter={() => preloadTabModule(item.tab)} onFocus={() => preloadTabModule(item.tab)}
          onClick={() => navigate(item.tab)} aria-current={active ? 'page' : undefined}
          title={`${sectionLabel ? `${sectionLabel} / ` : ''}${item.label}`}>
          <span className="akk-nav-item-dot" aria-hidden="true" />
          <span className="akk-nav-link-text">{item.label}</span>
        </button>
        <button type="button" className={`akk-nav-pin ${starred ? 'is-starred' : ''}`}
          onClick={() => toggleFavorite(item.tab)}
          aria-label={`${starred ? 'Hapus dari' : 'Simpan ke'} favorit: ${item.label}`}
          title={starred ? 'Hapus favorit' : 'Simpan favorit'}>
          {starred ? <Pin size={13} fill="currentColor" /> : <Pin size={13} />}
        </button>
      </div>
    );
  };

  const renderContent = (desktop: boolean) => (
    <>
      <div className="akk-clean-brand">
        <button type="button" className="akk-clean-logo-button" onClick={() => navigate('dashboard')} aria-label="Beranda AKK" title="Beranda AKK">
          <AkkLogo size="sm" showSubtitle={false} showText={false} />
          {(!desktop || !isMinimized) && <span className="akk-clean-brand-title"><strong>AKK</strong><small>Operasional</small></span>}
        </button>
        <div className="akk-clean-brand-actions">
          {!desktop && <button type="button" onClick={() => setMobileOpen(false)} className="akk-clean-icon-button" aria-label="Tutup menu"><X size={19} /></button>}
          {desktop && onToggleMinimize && <button type="button" onClick={onToggleMinimize} className="akk-clean-icon-button" aria-label={isMinimized ? 'Perluas menu' : 'Ringkas menu'} title={isMinimized ? 'Perluas menu' : 'Ringkas menu'}>
            {isMinimized ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>}
        </div>
      </div>

      {desktop && isMinimized ? (
        <div className="akk-clean-rail" role="navigation" aria-label="Menu utama">
          {visible.map(section => {
            const Icon = section.icon;
            const selected = activeSection?.id === section.id;
            return (
              <button type="button" key={section.id} className={`akk-clean-rail-button ${selected ? 'is-active' : ''}`}
                title={section.label} aria-label={section.label}
                onClick={() => { setExpanded(section.id); onToggleMinimize?.(); }}>
                <Icon size={20} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="akk-clean-search-area">
            <Search className="akk-clean-search-icon" size={17} />
            <input ref={searchRef} className="akk-clean-search" type="search" autoComplete="off"
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu..." aria-label="Cari menu" />
            {search ? (
              <button
                type="button"
                className="akk-clean-search-clear"
                onClick={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                aria-label="Bersihkan pencarian"
                title="Bersihkan pencarian"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="akk-clean-shortcut">Ctrl K</kbd>
            )}
          </div>

          <nav className="akk-clean-nav" aria-label="Navigasi AKK">
            {normalize(search) ? (
              <div className="akk-clean-menu-block">
                <p className="akk-clean-block-label">Hasil pencarian</p>
                {results.length ? results.map(item => renderItem(item, item.sectionLabel)) :
                  <div className="akk-clean-empty">Menu tidak ditemukan</div>}
              </div>
            ) : (
              <>
                {shortcuts.length > 0 && (
                  <div className="akk-clean-menu-block akk-clean-shortcuts">
                    <p className="akk-clean-block-label"><Pin size={12} /> Cepat dibuka</p>
                    {shortcuts.map(item => renderItem(item, item.sectionLabel))}
                  </div>
                )}
                <p className="akk-clean-block-label akk-clean-section-title">MENU UTAMA</p>
                {visible.map(section => {
                  const Icon = section.icon;
                  const isCurrent = activeSection?.id === section.id;
                  const isOpen = expanded === section.id;
                  if (section.items.length === 1) {
                    const item = section.items[0];
                    return <button type="button" key={section.id} className={`akk-clean-section-button ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => navigate(item.tab)} aria-current={isCurrent ? 'page' : undefined}>
                      <Icon size={19} /> <span>{section.label}</span>
                    </button>;
                  }
                  return (
                    <div className={`akk-clean-section ${isOpen ? 'is-open' : ''}`} key={section.id}>
                      <button type="button" className={`akk-clean-section-button ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => setExpanded(isOpen ? null : section.id)} aria-expanded={isOpen}>
                        <Icon size={19} /> <span>{section.label}</span>
                        <ChevronDown className="akk-clean-section-chevron" size={16} />
                      </button>
                      {isOpen && <div className="akk-clean-items">{section.items.map(item => renderItem(item))}</div>}
                    </div>
                  );
                })}
              </>
            )}
          </nav>
        </>
      )}
      <div className={`akk-clean-footer ${desktop && isMinimized ? 'is-rail' : ''}`}>
        {(!desktop || !isMinimized) && <div className="akk-clean-user">
          <span className="akk-clean-avatar">{(user.fullName?.trim()?.[0] || 'A').toUpperCase()}</span>
          <span className="akk-clean-user-text"><strong>{user.fullName || 'Pengguna AKK'}</strong><small>AKK Workspace</small></span>
        </div>}
        <div className="akk-clean-footer-actions">
          <ThemeSwitcher variant="icon-only" className="akk-clean-icon-button akk-clean-theme-btn" />
          <button type="button" className="akk-clean-icon-button" onClick={() => logisticsStore.logoutUser()} aria-label="Keluar akun" title="Keluar akun"><LogOut size={18} /></button>
        </div>
      </div>
    </>
  );

  return <>
    <div className="akk-clean-mobile-top lg:hidden">
      <button type="button" className="akk-clean-icon-button" onClick={() => setMobileOpen(true)} aria-label="Buka menu"><Menu size={22} /></button>
      <button type="button" className="akk-clean-mobile-home" onClick={() => navigate('dashboard')}><AkkLogo size="sm" showSubtitle={false} showText={false} /><strong>AKK</strong></button>
      <button type="button" className="akk-clean-icon-button" onClick={() => onOpenAuth('login')} title="Profil akun" aria-label="Profil akun"><Users size={19} /></button>
    </div>
    <aside className={`akk-clean-sidebar hidden lg:flex ${isMinimized ? 'is-minimized' : ''}`} aria-label="Navigasi utama">{renderContent(true)}</aside>
    {isMobileOpen && <div className="akk-clean-mobile-layer lg:hidden" role="dialog" aria-modal="true" aria-label="Menu AKK">
      <button type="button" className="akk-clean-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Tutup menu" />
      <aside className="akk-clean-mobile-panel">{renderContent(false)}</aside>
    </div>}
  </>;
};

export const Sidebar = React.memo(SidebarComponent);
export default Sidebar;
