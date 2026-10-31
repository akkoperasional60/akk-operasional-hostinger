import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, UserX, Clock, ShieldAlert, CheckCircle2, XCircle, 
  Search, Filter, Plus, Shield, User, Building, Phone, Mail, Calendar, 
  AlertTriangle, Edit3, Lock, Save, UserCog, ShieldCheck, X, Key, Copy, Check,
  ChevronDown, ChevronRight, ChevronUp, Settings, Eye, EyeOff, BarChart3,
  Truck, Briefcase, Package, Megaphone, ShoppingBag, DollarSign
} from 'lucide-react';
import { UserProfile, UserRole, UserApprovalStatus, UserPermissions } from '../types';
import { logisticsStore } from '../services/store';
import { getDefaultPermissionsForRole } from '../utils/rbac';
import { branchStore, BranchRecord, UserBranchPermissionEntry } from '../services/branchStore';

const MODULE_DEFINITIONS = [
  {
    id: 'logistics',
    name: 'Logistik & Pengiriman',
    description: 'Dashboard logistik, jadwal pengiriman, armada, simulasi kubikasi armada, dan portal driver per cabang.',
    borderClass: 'border-blue-500/30',
    iconBgClass: 'bg-blue-500/15 text-blue-400',
    IconComp: Truck,
    subMenus: [
      { id: 'dashboard_logistik', name: 'Dashboard Logistik & Analitik Armada' },
      { id: 'armada_ceklis', name: 'Data Armada & Simulasi Kubikasi Armada' },
      { id: 'live_map', name: 'Live Map GPS' },
      { id: 'monitoring_sla', name: 'Monitoring SLA, Kru & Evaluasi Jalur' },
      { id: 'rencana_rute', name: 'Jadwal & Penugasan Pengiriman' },
      { id: 'portal_driver', name: 'Portal Driver Mobile' }
    ]
  },
  {
    id: 'sales_admin',
    name: 'Admin Penjualan',
    description: 'Aktivitas harian admin, jadwal produksi, durasi muat, matriks skill, dan data KPI penjualan mengikuti cabang.',
    borderClass: 'border-indigo-500/30',
    iconBgClass: 'bg-indigo-500/15 text-indigo-400',
    IconComp: Briefcase,
    subMenus: [
      { id: 'dashboard_penjualan', name: 'Dashboard Penjualan' },
      { id: 'aktivitas_harian', name: 'Aktivitas Harian Admin' },
      { id: 'jadwal_admin', name: 'Jadwal Admin & Produksi' },
      { id: 'durasi_muat', name: 'Durasi Muat Admin' },
      { id: 'matriks_skil', name: 'Matriks Skill Admin' },
      { id: 'pengaturan_sop', name: 'Pengaturan SOP & Jobdesk' },
      { id: 'data_kpi', name: 'Data KPI & Omset Penjualan' }
    ]
  },
  {
    id: 'warehouse',
    name: 'Gudang (WMS)',
    description: 'Dashboard gudang, master SKU & stok bin, inbound/outbound, denah rak, opname, dan kubikasi & berat barang per cabang.',
    borderClass: 'border-emerald-500/30',
    iconBgClass: 'bg-emerald-500/15 text-emerald-400',
    IconComp: Package,
    subMenus: [
      { id: 'stok_barang', name: 'Master SKU, Denah Rak & Kubikasi Barang' },
      { id: 'permintaan_barang', name: 'Inbound (Barang Masuk)' },
      { id: 'opname_stok', name: 'Stok Opname & Kartu Stok' },
      { id: 'ceklis_muat', name: 'Outbound (Picking & Muat)' }
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Marketing online, laporan kunjungan & laporan penjualan marketing offline, serta pemetaan jaringan toko per cabang.',
    borderClass: 'border-amber-500/30',
    iconBgClass: 'bg-amber-500/15 text-amber-400',
    IconComp: Megaphone,
    subMenus: [
      { id: 'kampanye', name: 'Marketing Online' },
      { id: 'leads_pipeline', name: 'Marketing Offline (Laporan Kunjungan & Penjualan)' },
      { id: 'laporan_kunjungan', name: 'Jaringan Toko & Mitra' }
    ]
  },
  {
    id: 'purchasing',
    name: 'Admin Pembelian (Purchasing)',
    description: 'Akses stok pembelian, ringkasan stok, dan analisa prediksi kebutuhan reorder mengikuti cabang.',
    borderClass: 'border-purple-500/30',
    iconBgClass: 'bg-purple-500/15 text-purple-400',
    IconComp: ShoppingBag,
    subMenus: [
      { id: 'permintaan_pembelian', name: 'Dashboard Pembelian' },
      { id: 'po_vendor', name: 'Analisa Stok & Prediksi Kebutuhan' },
      { id: 'evaluasi_harga', name: 'Evaluasi Harga Supplier' }
    ]
  },
  {
    id: 'finance_tax',
    name: 'Finance & Tax',
    description: 'Monitoring tagihan pelanggan belum terlunasi, jatuh tempo piutang, dan pencatatan cicilan/pembayaran per cabang.',
    borderClass: 'border-cyan-500/30',
    iconBgClass: 'bg-cyan-500/15 text-cyan-400',
    IconComp: DollarSign,
    subMenus: [
      { id: 'kas_bank', name: 'Tagihan Pelanggan Belum Terlunasi' },
      { id: 'faktur_pajak', name: 'Faktur Pajak & E-Faktur' },
      { id: 'rekonsiliasi', name: 'Rekonsiliasi Keuangan' },
      { id: 'laba_rugi', name: 'Laporan Laba Rugi' }
    ]
  },
  {
    id: 'hr',
    name: 'Human Resources & GA',
    description: 'Data karyawan & presensi, General Affair (Security, Housekeeping, Aset), serta Training & Development per cabang.',
    borderClass: 'border-rose-500/30',
    iconBgClass: 'bg-rose-500/15 text-rose-400',
    IconComp: Users,
    subMenus: [
      { id: 'hr_data_karyawan', name: 'HR - Dashboard & Presensi' },
      { id: 'hr_gaji_kpi', name: 'HR - Gaji, Lembur & Penilaian Kinerja' },
      { id: 'ga_security', name: 'GA - Security (Keamanan Pabrik)' },
      { id: 'ga_hk', name: 'GA - HK (Housekeeping & Kebersihan)' },
      { id: 'ga_aset', name: 'GA - Aset (Inventaris & Fasilitas)' },
      { id: 'td_video_training', name: 'Training & Development - Video Training' },
      { id: 'td_training_karyawan', name: 'Training & Development - Training Karyawan' }
    ]
  },
  {
    id: 'sistem_pengguna',
    name: 'Sistem & Pengguna',
    description: 'Master cabang, manajemen user & approval, log aktivitas sistem, pengujian E2E, dan skema database.',
    borderClass: 'border-slate-600/40',
    iconBgClass: 'bg-slate-700/40 text-slate-300',
    IconComp: Settings,
    subMenus: [
      { id: 'daftar_pengguna', name: 'Master Cabang & Manajemen User' },
      { id: 'manajemen_hak_akses', name: 'Manajemen Hak Akses & Skema SQL' },
      { id: 'dashboard_eksekutif', name: 'Dashboard Eksekutif' },
      { id: 'log_aktivitas_sistem', name: 'Log Aktivitas Sistem' },
      { id: 'persetujuan_akun', name: 'Persetujuan Akun (Approval)' }
    ]
  }
];

const DEPARTMENT_FILTER_OPTIONS = [
  { id: 'all', label: 'Semua Role / Departemen', shortLabel: 'Semua', icon: '🌐' },
  { id: 'logistics', label: 'Logistik & Pengiriman', shortLabel: 'Logistik', icon: '🚚' },
  { id: 'sales', label: 'Admin Penjualan (Sales)', shortLabel: 'Sales', icon: '💼' },
  { id: 'warehouse', label: 'Gudang (Warehouse)', shortLabel: 'Gudang', icon: '📦' },
  { id: 'marketing', label: 'Marketing', shortLabel: 'Marketing', icon: '📢' },
  { id: 'purchasing', label: 'Admin Pembelian', shortLabel: 'Pembelian', icon: '🛒' },
  { id: 'finance', label: 'Finance & Tax', shortLabel: 'Finance', icon: '💰' },
  { id: 'hr', label: 'Human Resources & GA', shortLabel: 'HR & GA', icon: '👥' },
  { id: 'super_admin', label: 'Super Admin', shortLabel: 'Super Admin', icon: '👑' },
];

const OFFICIAL_DEPARTMENT_OPTIONS = [
  'Logistik',
  'Pengiriman',
  'Adm. Penjualan',
  'Adm. Pembelian',
  'Gudang',
  'Finance & Tax',
  'Satpam',
  'Human Resources',
  'Marketing'
];

export interface UserManagementProps {
  onNavigateToE2E?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onNavigateToE2E }) => {
  const [users, setUsers] = useState<UserProfile[]>(logisticsStore.getUsers());
  const [currentUser, setCurrentUser] = useState<UserProfile>(logisticsStore.getCurrentUser());
  const [statusFilter, setStatusFilter] = useState<'all' | UserApprovalStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Super Admin check
  const isSuperAdmin = currentUser.role === 'super_admin';
  const visibleUsersForRole = isSuperAdmin
    ? users
    : users.filter(u => u.status !== 'inactive' && u.status !== 'rejected');

  // Selected User for Split-Screen Detail View
  const [selectedUserId, setSelectedUserId] = useState<string>(visibleUsersForRole[0]?.id || '');
  const selectedUser = visibleUsersForRole.find(u => u.id === selectedUserId) || visibleUsersForRole[0] || null;

  // Granular Access & Per-Branch Menu Permissions State
  const [branches, setBranches] = useState<BranchRecord[]>(branchStore.getBranches());
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions['modules']>({});
  const [branchPermissions, setBranchPermissions] = useState<Record<string, UserBranchPermissionEntry>>({});
  
  // Copy Access Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [sourceUserIdForCopy, setSourceUserIdForCopy] = useState<string>('');
  
  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // View Password per user account state
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedPasswordUserId, setCopiedPasswordUserId] = useState<string | null>(null);

  const getEffectivePassword = (_u: UserProfile): string => 'Tersimpan sebagai hash di server';

  const togglePasswordVisibility = (userId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCopyUserPassword = (_u: UserProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPageModalNotification({
      title: 'Password Tidak Dapat Ditampilkan',
      message: 'Password disimpan sebagai hash scrypt di Hostinger MySQL. Gunakan menu Reset Password untuk menetapkan password baru.',
      type: 'info'
    });
  };

  // In-Page Pop-up Notification Modal State (Request: popup di depan halaman user manajemen)
  const [pageModalNotification, setPageModalNotification] = useState<{
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  // Support pressing Enter or Escape on keyboard when "Oke, Mengerti" modal is open
  useEffect(() => {
    if (!pageModalNotification) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPageModalNotification(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [pageModalNotification]);

  const showNotification = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setPageModalNotification({ title, message, type });
  };

  // Edit User Profile State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'unassigned' as UserRole,
    department: 'Logistik',
    status: 'approved' as UserApprovalStatus,
    notes: '',
    approvedBy: ''
  });
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New user form state
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'driver' as UserRole,
    password: '',
    department: 'Logistik & Pengiriman'
  });

  useEffect(() => {
    const unsubUsers = logisticsStore.subscribe(() => {
      const freshUsers = logisticsStore.getUsers();
      setUsers(freshUsers);
      setCurrentUser(logisticsStore.getCurrentUser());
      if (!selectedUserId && freshUsers.length > 0) {
        setSelectedUserId(freshUsers[0].id);
      }
    });
    const unsubBranches = branchStore.subscribe(() => {
      setBranches(branchStore.getBranches());
    });
    return () => {
      unsubUsers();
      unsubBranches();
    };
  }, [selectedUserId]);

  // Combine per-branch module permissions into effective user.permissions.modules
  const computeMergedModulesFromBranches = (
    bPerms: Record<string, UserBranchPermissionEntry>,
    fallbackRole: UserRole
  ): UserPermissions['modules'] => {
    const merged: UserPermissions['modules'] = {};
    const roleDefaults = getDefaultPermissionsForRole(fallbackRole);

    MODULE_DEFINITIONS.forEach(mod => {
      let anyModEnabled = false;
      const subMenus: Record<string, 'none' | 'read_only' | 'full_access'> = {};
      mod.subMenus.forEach(s => {
        subMenus[s.id] = 'none';
      });

      Object.values(bPerms).forEach(entry => {
        if (!entry.enabled) return;
        const m = entry.modules?.[mod.id];
        if (m?.enabled) {
          anyModEnabled = true;
          mod.subMenus.forEach(s => {
            const val = m.subMenus?.[s.id] || 'none';
            if (val === 'full_access') {
              subMenus[s.id] = 'full_access';
            } else if (val === 'read_only' && subMenus[s.id] !== 'full_access') {
              subMenus[s.id] = 'read_only';
            }
          });
        }
      });

      // Fallback if all branches were unchecked so roleDefaults structure stays valid
      if (!anyModEnabled && Object.values(bPerms).every(b => !b.enabled)) {
        merged[mod.id] = {
          enabled: false,
          subMenus
        };
      } else {
        merged[mod.id] = {
          enabled: anyModEnabled || Boolean(roleDefaults[mod.id]?.enabled && false),
          subMenus
        };
      }
    });

    return merged;
  };

  // Whenever selectedUser changes, initialize editingPermissions and per-branch permissions
  useEffect(() => {
    if (selectedUser) {
      const roleDefaults = getDefaultPermissionsForRole(selectedUser.role);
      const initialPerms: UserPermissions['modules'] = {};
      const isLogisticsLead =
        selectedUser.role === 'spv_logistik' ||
        selectedUser.role === 'operasional' ||
        selectedUser.role === 'pengiriman' ||
        selectedUser.role === 'dispatcher';

      const isCrewRole = selectedUser.role === 'driver' || selectedUser.role === 'crew_helper';

      MODULE_DEFINITIONS.forEach(mod => {
        const userMod = selectedUser.permissions?.modules?.[mod.id];
        const defaultMod = roleDefaults[mod.id];
        const subMenuPerms: Record<string, 'read_only' | 'full_access' | 'none'> = {};

        const savedSubEntries = Object.entries(userMod?.subMenus || {});
        const savedActiveKeys = savedSubEntries
          .filter(([, v]) => v === 'full_access' || v === 'read_only')
          .map(([k]) => k);
        const savedActiveCount = savedActiveKeys.length;
        const shouldUseRoleDefaultForLogistics =
          mod.id === 'logistics' && isLogisticsLead && savedActiveCount <= 1;
        const isLegacyCrewDefault =
          mod.id === 'logistics' &&
          isCrewRole &&
          savedActiveCount === 2 &&
          savedActiveKeys.includes('portal_driver') &&
          savedActiveKeys.includes('monitoring_sla');

        mod.subMenus.forEach(sub => {
          if (shouldUseRoleDefaultForLogistics) {
            subMenuPerms[sub.id] = defaultMod?.subMenus?.[sub.id] || 'full_access';
          } else if (isLegacyCrewDefault) {
            subMenuPerms[sub.id] = sub.id === 'portal_driver' ? 'full_access' : 'none';
          } else {
            const savedVal = userMod?.subMenus?.[sub.id];
            subMenuPerms[sub.id] = savedVal !== undefined ? savedVal : (defaultMod?.subMenus?.[sub.id] || 'none');
          }
        });
        const isEnabled = shouldUseRoleDefaultForLogistics
          ? true
          : userMod !== undefined
          ? userMod.enabled
          : (defaultMod ? defaultMod.enabled : false);
        initialPerms[mod.id] = {
          enabled: isEnabled,
          subMenus: subMenuPerms
        };
      });

      const loadedBranchPerms = branchStore.getUserBranchPermissions(
        selectedUser.id,
        selectedUser.role,
        initialPerms
      );
      setBranchPermissions(loadedBranchPerms);
      setEditingPermissions(initialPerms);
      // Cabang tertutup default (sesuai gambar 2)
      setExpandedBranches({});
      setExpandedModules({});
    }
  }, [selectedUser?.id, selectedUser?.role, selectedUser?.permissions, branches.length]);

  const ROLE_LABELS: Record<UserRole, string> = {
    super_admin: 'Super Admin / Manager',
    dispatcher: 'Dispatcher / SPV Logistik',
    spv_logistik: 'SPV Logistik',
    operasional: 'Operasional (Operational Lead)',
    pengiriman: 'Pengiriman',
    security: 'Security (Pos Satpam & Keamanan)',
    sales_admin: 'Adm. Penjualan',
    purchasing_admin: 'Adm. Pembelian',
    hr_admin: 'HR Admin',
    finance_tax_admin: 'Finance & Tax',
    warehouse_admin: 'Gudang',
    driver: 'Kru Supir / Driver',
    marketing_online: 'Marketing Online',
    marketing_offline: 'Marketing Offline',
    crew_helper: 'Kru Helper / Kernet',
    unassigned: '⚠️ Perlu Diisi (Belum Ada Role)'
  };

  const toggleBranchExpansion = (branchId: string) => {
    setExpandedBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  const toggleBranchModuleExpansion = (branchId: string, modId: string) => {
    const key = `${branchId}:${modId}`;
    setExpandedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleBranchEnabled = (branchId: string, enabled: boolean) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah akses cabang.', 'warning');
      return;
    }
    setBranchPermissions(prev => {
      const current = prev[branchId];
      if (!current) return prev;
      const roleDefaults = getDefaultPermissionsForRole(selectedUser?.role || 'unassigned');
      let nextModules = { ...current.modules };

      // If enabling a branch that currently has 0 active modules, populate from role defaults
      if (enabled && branchStore.countActiveModulesInBranch(nextModules) === 0) {
        nextModules = JSON.parse(JSON.stringify(roleDefaults));
      }

      const nextMap = {
        ...prev,
        [branchId]: {
          ...current,
          enabled,
          allAccess: enabled ? current.allAccess : false,
          modules: nextModules
        }
      };
      const merged = computeMergedModulesFromBranches(nextMap, selectedUser?.role || 'unassigned');
      setEditingPermissions(merged);
      if (selectedUser) {
        branchStore.saveUserBranchPermissions(selectedUser.id, nextMap);
        logisticsStore.updateUserProfile(selectedUser.id, {
          permissions: { modules: merged }
        });
      }
      return nextMap;
    });

    if (enabled) {
      setExpandedBranches(prev => ({ ...prev, [branchId]: true }));
    }
  };

  const handleToggleBranchAllAccess = (branchId: string, allAccess: boolean) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah akses cabang.', 'warning');
      return;
    }
    setBranchPermissions(prev => {
      const current = prev[branchId];
      if (!current) return prev;
      const nextModules: UserPermissions['modules'] = {};

      MODULE_DEFINITIONS.forEach(mod => {
        const subMenus: Record<string, 'none' | 'read_only' | 'full_access'> = {};
        mod.subMenus.forEach(sub => {
          subMenus[sub.id] = allAccess ? 'full_access' : 'none';
        });
        nextModules[mod.id] = {
          enabled: allAccess,
          subMenus
        };
      });

      const nextMap = {
        ...prev,
        [branchId]: {
          ...current,
          enabled: allAccess ? true : current.enabled,
          allAccess,
          modules: nextModules
        }
      };
      const merged = computeMergedModulesFromBranches(nextMap, selectedUser?.role || 'unassigned');
      setEditingPermissions(merged);
      if (selectedUser) {
        branchStore.saveUserBranchPermissions(selectedUser.id, nextMap);
        logisticsStore.updateUserProfile(selectedUser.id, {
          permissions: { modules: merged }
        });
      }
      return nextMap;
    });

    if (allAccess) {
      setExpandedBranches(prev => ({ ...prev, [branchId]: true }));
    }
  };

  const handleToggleBranchModuleEnabled = (branchId: string, modId: string, enabled: boolean) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah hak akses modul.', 'warning');
      return;
    }
    const modDef = MODULE_DEFINITIONS.find(m => m.id === modId);
    setBranchPermissions(prev => {
      const branchEntry = prev[branchId];
      if (!branchEntry) return prev;
      const existingSubMenus = { ...(branchEntry.modules[modId]?.subMenus || {}) };
      if (modDef) {
        modDef.subMenus.forEach(sub => {
          existingSubMenus[sub.id] = enabled ? 'full_access' : 'none';
        });
      }
      const nextModules = {
        ...branchEntry.modules,
        [modId]: {
          enabled,
          subMenus: existingSubMenus
        }
      };
      const activeModCount = branchStore.countActiveModulesInBranch(nextModules);
      const nextMap = {
        ...prev,
        [branchId]: {
          ...branchEntry,
          enabled: enabled ? true : activeModCount > 0,
          allAccess: activeModCount === MODULE_DEFINITIONS.length,
          modules: nextModules
        }
      };
      const merged = computeMergedModulesFromBranches(nextMap, selectedUser?.role || 'unassigned');
      setEditingPermissions(merged);
      if (selectedUser) {
        branchStore.saveUserBranchPermissions(selectedUser.id, nextMap);
        logisticsStore.updateUserProfile(selectedUser.id, {
          permissions: { modules: merged }
        });
      }
      return nextMap;
    });

    if (enabled) {
      setExpandedModules(prev => ({ ...prev, [`${branchId}:${modId}`]: true }));
    }
  };

  const handleBranchSubMenuPermissionChange = (
    branchId: string,
    modId: string,
    subId: string,
    accessLevel: 'none' | 'read_only' | 'full_access'
  ) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah hak akses sub-menu.', 'warning');
      return;
    }
    setBranchPermissions(prev => {
      const branchEntry = prev[branchId];
      if (!branchEntry) return prev;
      const mod = branchEntry.modules[modId] || { enabled: true, subMenus: {} };
      const nextSubs = {
        ...mod.subMenus,
        [subId]: accessLevel
      };
      const hasAnyActiveSub = Object.values(nextSubs).some(v => v === 'full_access' || v === 'read_only');
      const nextModules = {
        ...branchEntry.modules,
        [modId]: {
          enabled: hasAnyActiveSub,
          subMenus: nextSubs
        }
      };
      const activeModCount = branchStore.countActiveModulesInBranch(nextModules);
      const nextMap = {
        ...prev,
        [branchId]: {
          ...branchEntry,
          enabled: activeModCount > 0 ? true : branchEntry.enabled,
          allAccess: activeModCount === MODULE_DEFINITIONS.length,
          modules: nextModules
        }
      };
      const merged = computeMergedModulesFromBranches(nextMap, selectedUser?.role || 'unassigned');
      setEditingPermissions(merged);
      if (selectedUser) {
        branchStore.saveUserBranchPermissions(selectedUser.id, nextMap);
        logisticsStore.updateUserProfile(selectedUser.id, {
          permissions: { modules: merged }
        });
      }
      return nextMap;
    });
  };

  const handleSaveAccess = () => {
    if (!selectedUser) return;
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menyimpan perubahan akses.', 'warning');
      return;
    }

    const mergedModules = computeMergedModulesFromBranches(branchPermissions, selectedUser.role);
    const updatedPermissions: UserPermissions = {
      modules: mergedModules
    };

    branchStore.saveUserBranchPermissions(selectedUser.id, branchPermissions);
    const success = logisticsStore.updateUserProfile(selectedUser.id, {
      permissions: updatedPermissions
    });

    if (success) {
      showNotification('Hak Akses Disimpan', `Akses cabang dan rincian menu website untuk "${selectedUser.fullName}" berhasil disimpan ke sistem.`, 'success');
      setSaveSuccessMessage(`Akses cabang dan hak akses untuk "${selectedUser.fullName}" berhasil disimpan.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    }
  };

  const handleCopyAccess = () => {
    if (!sourceUserIdForCopy) {
      showNotification('Peringatan', 'Silakan pilih user sumber untuk menyalin akses.', 'warning');
      return;
    }
    const sourceUser = users.find(u => u.id === sourceUserIdForCopy);
    if (!sourceUser || !sourceUser.permissions) {
      showNotification('User Sumber Kosong', 'User sumber tidak memiliki konfigurasi akses khusus.', 'warning');
      return;
    }
    setEditingPermissions(JSON.parse(JSON.stringify(sourceUser.permissions.modules)));
    setIsCopyModalOpen(false);
    setSourceUserIdForCopy('');
    showNotification('Salin Akses Berhasil', `Berhasil menyalin hak akses dari ${sourceUser.fullName}. Klik 'Simpan Akses' di kanan bawah untuk menerapkan ke database.`, 'success');
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;
    if (!newPasswordInput || newPasswordInput.length < 8) {
      showNotification('Password Tidak Valid', 'Password baru minimal harus 8 karakter.', 'warning');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showNotification('Password Tidak Cocok', 'Konfirmasi password tidak cocok dengan password baru. Harap periksa kembali kedua input.', 'error');
      return;
    }
    const success = await logisticsStore.resetUserPassword(selectedUser.id, newPasswordInput);
    if (success) {
      showNotification('Password Berhasil Diubah', `Password baru untuk akun "${selectedUser.fullName}" berhasil disimpan ke database.`, 'success');
      setSaveSuccessMessage(`Password akun "${selectedUser.fullName}" berhasil diubah.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      setIsPasswordModalOpen(false);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  };

  const handleApprove = (userId: string, notes?: string) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menyetujui akun pengguna.', 'warning');
      return;
    }
    logisticsStore.approveUser(userId, notes || 'Disetujui oleh ' + currentUser.fullName);
    showNotification('Akun Disetujui', 'Akun pengguna berhasil disetujui dan kini berstatus aktif.', 'success');
  };

  const handleDeactivateUser = (user: UserProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menonaktifkan akun pengguna.', 'warning');
      return;
    }
    const isPrimaryOrSelfSuperAdmin =
      user.id === currentUser.id ||
      (user.email || '').trim().toLowerCase() === 'akkoperasional60@gmail.com';
    if (user.role === 'super_admin' && isPrimaryOrSelfSuperAdmin) {
      showNotification('Tindakan Dibatasi', 'Akun utama Super Admin yang sedang aktif tidak dapat dinonaktifkan.', 'warning');
      return;
    }
    logisticsStore.deactivateUser(user.id);
    setSaveSuccessMessage(`Akun "${user.fullName}" berhasil dinonaktifkan. Hak akses ditutup, histori data tetap tersimpan.`);
    setTimeout(() => setSaveSuccessMessage(null), 5000);
    showNotification(
      'Akun Dinonaktifkan',
      `Akun "${user.fullName}" kini berstatus Nonaktif. Hak akses disembunyikan sementara, namun seluruh histori pengiriman & log aktivitas tetap tersimpan utuh.`,
      'warning'
    );
  };

  const handleActivateUser = (user: UserProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat mengaktifkan akun pengguna.', 'warning');
      return;
    }
    logisticsStore.activateUser(user.id);
    setSaveSuccessMessage(`Akun "${user.fullName}" berhasil diaktifkan kembali dan hak akses dipulihkan!`);
    setTimeout(() => setSaveSuccessMessage(null), 5000);
    showNotification(
      'Akun Diaktifkan Kembali',
      `Akun "${user.fullName}" telah aktif kembali. Pengaturan hak akses kini ditampilkan dan akun terbaca pada pemrosesan sistem ke depannya.`,
      'success'
    );
  };

  const handleDelete = (userId: string) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang dapat menghapus akun pengguna.', 'warning');
      return;
    }
    
    setDeleteTargetId(userId);
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = () => {
    if (!deleteTargetId) return;
    
    const target = users.find(u => u.id === deleteTargetId);
    logisticsStore.deleteUser(deleteTargetId);
    const remaining = users.filter(u => u.id !== deleteTargetId);
    if (remaining.length > 0) {
      setSelectedUserId(remaining[0].id);
    }
    
    setIsDeleteModalOpen(false);
    setDeleteTargetId(null);
    showNotification('Akun Dihapus', `Akun ${target?.fullName || 'pengguna'} telah berhasil dihapus dari sistem.`, 'success');
  };

  const handleOpenEdit = (user: UserProfile) => {
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Fitur edit profil hanya dapat diakses oleh Super Admin.', 'warning');
      return;
    }
    setEditingUser(user);
    setEditFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      department: user.department || '',
      status: user.status,
      notes: user.notes || '',
      approvedBy: user.approvedBy || currentUser.fullName
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!isSuperAdmin) {
      showNotification('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah profil pengguna.', 'warning');
      return;
    }

    const success = logisticsStore.updateUserProfile(editingUser.id, {
      fullName: editFormData.fullName.trim(),
      email: editFormData.email.trim(),
      phone: editFormData.phone.trim(),
      role: editFormData.role,
      department: editFormData.department.trim(),
      status: editFormData.status,
      notes: editFormData.notes.trim(),
      approvedBy: editFormData.status === 'approved' ? (editFormData.approvedBy || currentUser.fullName) : editingUser.approvedBy
    });

    if (success) {
      setSaveSuccessMessage(`Profil "${editFormData.fullName}" berhasil diperbarui.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      setEditingUser(null);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email) return;
    if (!newUser.password || newUser.password.length < 8) {
      setPageModalNotification({
        title: 'Password Belum Valid',
        message: 'Saat membuat akun baru, masukkan password minimal 8 karakter. Password akan dikirim ke backend dan disimpan sebagai hash.',
        type: 'warning'
      });
      return;
    }

    const chosenRole: UserRole = newUser.role || 'unassigned';
    const isCrewRole = chosenRole === 'driver' || chosenRole === 'crew_helper';

    const created = logisticsStore.registerUser({
      fullName: newUser.fullName || 'Pengguna Baru',
      email: newUser.email,
      phone: newUser.phone || '0812-3456-7890',
      role: chosenRole,
      department: newUser.department || 'Logistik & Pengiriman',
      password: newUser.password,
      status: chosenRole !== 'unassigned' ? 'approved' : 'pending',
      notes: isCrewRole
        ? `Akun ${chosenRole === 'driver' ? 'Kru Supir / Driver' : 'Kru Helper / Kernet'} aktif & terintegrasi otomatis ke Daftar Jadwal Pengiriman`
        : chosenRole !== 'unassigned'
        ? `Akun aktif untuk role ${ROLE_LABELS[chosenRole] || chosenRole}`
        : 'Akun baru terdaftar — Role perlu diisi oleh Super Admin'
    });

    setIsAddUserModalOpen(false);
    setSelectedUserId(created.id);
    setNewUser({
      fullName: '',
      email: '',
      phone: '',
      role: 'driver',
      password: '',
      department: 'Logistik & Pengiriman'
    });
    showNotification(
      isCrewRole ? 'Akun Kru Terdaftar & Sinkron ke Jadwal' : 'Akun Baru Terdaftar',
      isCrewRole
        ? `Akun "${created.fullName}" (${ROLE_LABELS[chosenRole]}) berhasil dibuat dan otomatis masuk ke dalam daftar pilihan ${chosenRole === 'driver' ? 'Kru Supir Utama' : 'Kru Helper / Kernet'} pada menu Jadwal & Penugasan Pengiriman.`
        : `Akun "${created.fullName}" berhasil dibuat dengan Role: ${ROLE_LABELS[chosenRole] || chosenRole}.`,
      'success'
    );
  };

  const pendingCount = visibleUsersForRole.filter(u => u.status === 'pending').length;
  const approvedCount = visibleUsersForRole.filter(u => u.status === 'approved').length;
  const inactiveCount = visibleUsersForRole.filter(u => u.status === 'inactive').length;
  const rejectedCount = visibleUsersForRole.filter(u => u.status === 'rejected').length;

  const matchUserDepartment = (u: UserProfile, filterKey: string) => {
    if (filterKey === 'all') return true;
    const dept = (u.department || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    switch (filterKey) {
      case 'logistics':
        return role === 'spv_logistik' || role === 'operasional' || role === 'pengiriman' || role === 'driver' || role === 'crew_helper' || /logistik|pengiriman|distribusi|armada|supir|operasional/i.test(dept);
      case 'sales':
        return role === 'sales_admin' || /sales|penjualan/i.test(dept);
      case 'warehouse':
        return role === 'warehouse_admin' || /gudang|warehouse/i.test(dept);
      case 'marketing':
        return role === 'marketing_online' || role === 'marketing_offline' || /marketing|pemasaran/i.test(dept);
      case 'purchasing':
        return role === 'purchasing_admin' || /pembelian|purchasing|pengadaan/i.test(dept);
      case 'finance':
        return role === 'finance_tax_admin' || /finance|tax|keuangan|pajak/i.test(dept);
      case 'hr':
        return role === 'hr_admin' || role === 'security' || /hr|human|ga|personalia|general affair|satpam|keamanan/i.test(dept);
      case 'super_admin':
        return role === 'super_admin' || /super|direksi|manajemen/i.test(dept);
      default:
        return role === filterKey || dept.includes(filterKey.toLowerCase());
    }
  };

  const countUsersInDept = (deptId: string) => {
    if (deptId === 'all') return visibleUsersForRole.length;
    return visibleUsersForRole.filter(u => matchUserDepartment(u, deptId)).length;
  };

  const filteredUsers = visibleUsersForRole.filter(u => {
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesDept = matchUserDepartment(u, departmentFilter);
    const matchesQuery =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDept && matchesQuery;
  });

  // Auto-select first matching user if current selected user is filtered out
  useEffect(() => {
    if (!isSuperAdmin && statusFilter === 'inactive') {
      setStatusFilter('all');
    }
    if (filteredUsers.length > 0) {
      const isSelectedPresent = filteredUsers.some(u => u.id === selectedUserId);
      if (!isSelectedPresent) {
        setSelectedUserId(filteredUsers[0].id);
      }
    }
  }, [departmentFilter, statusFilter, searchQuery, isSuperAdmin, visibleUsersForRole.length]);

  const activeDeptOption = DEPARTMENT_FILTER_OPTIONS.find(opt => opt.id === departmentFilter);

  return (
    <div className="space-y-5">
      {/* RBAC Header & Schedule Integration Summary */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm bg-slate-900 ${
        isSuperAdmin
          ? 'border-amber-500/40'
          : 'border-slate-800'
      }`}>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            isSuperAdmin
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-xs'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
              <span>{isSuperAdmin ? 'Manajemen User & Hak Akses Cabang' : 'Hak Akses Pengguna Terbatas'}</span>
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                isSuperAdmin
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isSuperAdmin ? '👑 Super Admin' : '🔒 Read Only'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-relaxed">
              {isSuperAdmin
                ? 'Pengaturan akun pengguna, pembagian akses cabang (Sidoarjo & Nusantara), serta kontrol hak akses modul sistem.'
                : `Manajemen user dan perubahan hak akses dikunci khusus untuk Super Admin. Anda login sebagai: ${currentUser.fullName} (${currentUser.role}).`}
            </p>
          </div>
        </div>
      </div>

      {/* Save Success Alert Banner */}
      {saveSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="p-1 text-emerald-400 hover:text-white rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Toolbar: Add User & Search / Filter */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User Langsung</span>
          </button>

          {/* Department / Role Filter Dropdown in Top Toolbar */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 font-semibold text-[11px] hidden sm:inline">Role / Dept:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-amber-400 font-bold text-xs focus:outline-none cursor-pointer pr-1"
            >
              {DEPARTMENT_FILTER_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-200 font-medium">
                  {opt.icon} {opt.label} ({countUsersInDept(opt.id)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({visibleUsersForRole.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aktif ({approvedCount})
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'inactive' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Nonaktif ({inactiveCount})</span>
              </button>
            )}
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, email, divisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ================= SPLIT SCREEN MASTER-DETAIL LAYOUT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Modern & Crisp User List */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col max-h-[82vh]">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-xs flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Daftar Pengguna ({filteredUsers.length})</span>
            </h3>
            {departmentFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setDepartmentFilter('all')}
                className="text-amber-400 hover:text-amber-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 transition"
              >
                <X className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">Pilih akun untuk rincian</span>
            )}
          </div>

          <div className="overflow-y-auto p-2 space-y-1.5 flex-1">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Tidak ada user yang ditemukan.
              </div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUser?.id === user.id;
                const isCurrent = user.id === currentUser.id;
                const isInactive = user.status === 'inactive';

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected 
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-xs' 
                        : isInactive
                        ? 'bg-slate-950/70 border-slate-800/70 hover:bg-slate-800/50 opacity-75'
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs border ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : isInactive
                          ? 'bg-slate-800 text-slate-500 border-slate-700'
                          : user.role === 'super_admin'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : user.role === 'driver' || user.role === 'crew_helper'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}>
                        {user.fullName === 'Super Admin' ? '👑' : user.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs leading-snug flex items-center gap-1.5 flex-wrap">
                          <span className={isSelected ? 'text-amber-400 font-extrabold' : isInactive ? 'text-slate-400 line-through' : 'text-white'}>
                            {user.fullName}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {user.role === 'unassigned' ? (
                            <span className="text-rose-400 font-bold text-[10px]">
                              ⚠️ Perlu Diisi Role
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">{ROLE_LABELS[user.role] || user.role}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {user.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Aktif
                        </span>
                      )}
                      {user.status === 'inactive' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Nonaktif
                        </span>
                      )}
                      {user.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          Pending
                        </span>
                      )}
                      {user.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                          Ditolak
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected User Details, Password & Menu/Submenu Granular Access */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col">
          {selectedUser ? (
            <>
              {/* Selected User Header Banner */}
              <div className="p-5 bg-slate-950 border-b border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0 border ${
                      selectedUser.status === 'inactive'
                        ? 'bg-slate-800 border-slate-700 text-slate-400'
                        : 'bg-amber-600 border-amber-500 text-white'
                    }`}>
                      {selectedUser.fullName === 'Super Admin' ? '👑' : selectedUser.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-white">
                          {selectedUser.fullName}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          selectedUser.role === 'unassigned'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        }`}>
                          {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          selectedUser.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                            : selectedUser.status === 'inactive'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        }`}>
                          {selectedUser.status === 'approved' ? '🟢 Status: Aktif' : selectedUser.status === 'inactive' ? '🔴 Status: Nonaktif' : '🟡 Status: Pending'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3.5 mt-1.5 flex-wrap font-medium">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-amber-400" />
                          <span>{selectedUser.email}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-blue-400" />
                          <span>{selectedUser.department || 'Perlu Diisi'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* User Actions in Detail View: Masuk Role, Edit & Aktifkan/Nonaktifkan */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {selectedUser.status === 'approved' && (
                      <button
                        onClick={() => {
                          if (isSuperAdmin) {
                            const merged = computeMergedModulesFromBranches(branchPermissions, selectedUser.role);
                            branchStore.saveUserBranchPermissions(selectedUser.id, branchPermissions);
                            logisticsStore.updateUserProfile(selectedUser.id, {
                              permissions: { modules: merged }
                            });
                          }
                          logisticsStore.switchCurrentUser(selectedUser.id);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                        title={`Masuk sebagai ${selectedUser.fullName} dan buka menu ${ROLE_LABELS[selectedUser.role] || selectedUser.role}`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Masuk &amp; Buka Menu Role</span>
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleOpenEdit(selectedUser)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                        title={`Edit Data ${selectedUser.fullName} (${ROLE_LABELS[selectedUser.role] || selectedUser.role})`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Pengguna</span>
                      </button>
                    )}
                    {isSuperAdmin && !(selectedUser.role === 'super_admin' && (selectedUser.id === currentUser.id || (selectedUser.email || '').trim().toLowerCase() === 'akkoperasional60@gmail.com')) && (
                      selectedUser.status === 'inactive' ? (
                        <button
                          onClick={() => handleActivateUser(selectedUser)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Aktifkan User</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeactivateUser(selectedUser)}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Nonaktifkan User</span>
                        </button>
                      )
                    )}
                    {selectedUser.status === 'pending' && isSuperAdmin && (
                      <button
                        onClick={() => handleApprove(selectedUser.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95"
                      >
                        Setujui Akun
                      </button>
                    )}
                  </div>
                </div>

                {/* Dedicated Password & Credentials Bar for Selected User */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-bold">
                        Kata Sandi / Password Akun ({selectedUser.email}):
                      </span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <code className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono font-extrabold text-amber-400 text-xs tracking-wider">
                          {visiblePasswords[selectedUser.id] ? getEffectivePassword(selectedUser) : '••••••••••••'}
                        </code>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(selectedUser.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                        >
                          {visiblePasswords[selectedUser.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{visiblePasswords[selectedUser.id] ? 'Sembunyikan Password' : 'Lihat Password'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyUserPassword(selectedUser)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                        >
                          {copiedPasswordUserId === selectedUser.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPasswordUserId === selectedUser.id ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-end sm:self-auto"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Ubah Password</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Conditional Content: Hide Hak Akses if User is Inactive */}
              {selectedUser.status === 'inactive' ? (
                <div className="p-6 space-y-5 text-xs flex-1 bg-slate-950/40">
                  <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Hak Akses Tidak Ditampilkan (Akun Nonaktif)</span>
                        </h4>
                        <p className="text-slate-300 leading-relaxed text-xs">
                          Akun <strong className="text-amber-300">{selectedUser.fullName}</strong> saat ini berstatus <strong className="text-rose-400">NONAKTIF</strong>. Sesuai aturan integrasi sistem, pengaturan dan daftar hak akses tidak dimunculkan serta tidak dapat digunakan untuk pemrosesan operasional baru sampai akun ini diaktifkan kembali.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                        <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Histori Data Tetap Terlihat</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Seluruh riwayat jadwal pengiriman, surat jalan, laporan aktivitas, dan log audit milik <strong>{selectedUser.fullName}</strong> tetap tersimpan utuh dan terlihat di sistem.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                        <div className="font-bold text-amber-400 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Pemrosesan Sistem Ke Depan</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Hanya akun berstatus <strong>Aktif</strong> yang akan terbaca pada pemrosesan sistem ke depannya. Aktifkan kembali akun ini untuk memulihkan hak akses.
                        </p>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleActivateUser(selectedUser)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer active:scale-95"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Aktifkan Kembali Akun &amp; Tampilkan Hak Akses</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Preserved History Data Preview for Inactive User */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="font-bold text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Arsip &amp; Histori Data Pengguna ({selectedUser.fullName})</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                        Data Historis Tersimpan
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block">ID Akun &amp; Departemen</span>
                        <strong className="text-white">{selectedUser.id} &bull; {selectedUser.department || '-'}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block">Role Terakhir</span>
                        <strong className="text-amber-300">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block">Catatan Status</span>
                        <strong className="text-slate-300">{selectedUser.notes || 'Akun dinonaktifkan sementara'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Role Unassigned Warning Banner if role is 'unassigned' */}
                  {selectedUser.role === 'unassigned' && (
                    <div className="mx-5 mt-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <strong className="text-amber-300 block">Role Akun Baru Belum Diisi (Perlu Diisi)</strong>
                          <span className="text-slate-300 text-[11px]">
                            Akun baru tidak otomatis menjadi SPV Logistik. Silakan klik <strong>Edit Pengguna</strong> untuk memilih Role dan Departemen yang sesuai.
                          </span>
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(selectedUser)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                        >
                          Isi Role Sekarang
                        </button>
                      )}
                    </div>
                  )}

                  {/* AKSES CABANG & MENU WEBSITE SECTION — Matches image_22fe4cd6.png & image_a6bb64da.png */}
                  <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto text-xs bg-slate-950/30">
                    {/* Top Header Row: AKSES CABANG & Copy Akses */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                          AKSES CABANG
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                          CABANG TERTUTUP DEFAULT
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsCopyModalOpen(true)}
                          className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-[10px] flex items-center gap-1.5 transition cursor-pointer shrink-0"
                          title="Salin hak akses dari user lain"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Akses</span>
                        </button>
                      </div>
                    </div>

                    {/* Branch Accordion Cards */}
                    <div className="space-y-3">
                      {branches.map(branch => {
                        const bEntry = branchPermissions[branch.id] || {
                          branchId: branch.id,
                          enabled: false,
                          allAccess: false,
                          modules: {}
                        };
                        const isBranchExpanded = Boolean(expandedBranches[branch.id]);
                        const activeModCount = bEntry.enabled
                          ? branchStore.countActiveModulesInBranch(bEntry.modules)
                          : 0;

                        return (
                          <div
                            key={branch.id}
                            className={`rounded-2xl border transition overflow-hidden ${
                              bEntry.enabled
                                ? 'bg-slate-900/90 border-slate-700/90 shadow-xs'
                                : 'bg-slate-900/50 border-slate-800/80'
                            }`}
                          >
                            {/* Branch Card Header Row (matches image_22fe4cd6.png) */}
                            <div
                              onClick={() => toggleBranchExpansion(branch.id)}
                              className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition select-none"
                            >
                              <div className="flex flex-wrap items-center gap-2.5">
                                {/* Branch Checkbox Pill */}
                                <label
                                  onClick={e => e.stopPropagation()}
                                  className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border font-extrabold text-xs transition cursor-pointer ${
                                    bEntry.enabled
                                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={bEntry.enabled}
                                    onChange={e => handleToggleBranchEnabled(branch.id, e.target.checked)}
                                    disabled={!isSuperAdmin}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span>{branch.name}</span>
                                </label>

                                {/* "Semua akses cabang ini" Checkbox Pill */}
                                <label
                                  onClick={e => e.stopPropagation()}
                                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border font-bold text-xs transition cursor-pointer ${
                                    bEntry.allAccess
                                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/15'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={bEntry.allAccess}
                                    onChange={e => handleToggleBranchAllAccess(branch.id, e.target.checked)}
                                    disabled={!isSuperAdmin}
                                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span>Semua akses cabang ini</span>
                                </label>

                                {/* Active Access Count Badge */}
                                <span
                                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    activeModCount > 0
                                      ? 'bg-slate-800 text-slate-200 border border-slate-700'
                                      : 'bg-slate-950 text-slate-500 border border-slate-800'
                                  }`}
                                >
                                  {activeModCount} AKSES AKTIF
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleBranchExpansion(branch.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                                title={isBranchExpanded ? 'Tutup Menu Cabang' : 'Buka Menu Website Cabang Ini'}
                              >
                                {isBranchExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            {/* Expanded Website Menu Modules inside this Branch (matches image_a6bb64da.png) */}
                            {isBranchExpanded && (
                              <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-slate-800/80 bg-slate-950/50">
                                {MODULE_DEFINITIONS.map(mod => {
                                  const modState = bEntry.modules?.[mod.id] || {
                                    enabled: false,
                                    subMenus: {}
                                  };
                                  const modKey = `${branch.id}:${mod.id}`;
                                  const isModExpanded = Boolean(expandedModules[modKey]);
                                  const activeSubCount = branchStore.countActiveSubMenusInModule(modState);
                                  const IconComp = mod.IconComp;

                                  return (
                                    <div
                                      key={mod.id}
                                      className={`rounded-2xl border bg-slate-900/90 transition overflow-hidden ${mod.borderClass}`}
                                    >
                                      {/* Website Module Header Card */}
                                      <div
                                        onClick={() => toggleBranchModuleExpansion(branch.id, mod.id)}
                                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition select-none"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div
                                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${mod.iconBgClass}`}
                                          >
                                            <IconComp className="w-4 h-4" />
                                          </div>
                                          <div className="min-w-0">
                                            <div className="font-black text-white text-xs sm:text-sm flex items-center gap-2">
                                              <span>{mod.name}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 truncate">
                                              {mod.description}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0">
                                          <span
                                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                              activeSubCount > 0
                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                : 'bg-slate-950 text-slate-400 border-slate-800'
                                            }`}
                                          >
                                            {activeSubCount} AKSES
                                          </span>
                                          {isModExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-slate-300" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                          )}
                                        </div>
                                      </div>

                                      {/* Expanded Sub-Menus inside Module */}
                                      {isModExpanded && (
                                        <div className="px-4 pb-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-950/60 space-y-2.5">
                                          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                                            <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={modState.enabled && mod.subMenus.length > 0 && activeSubCount === mod.subMenus.length}
                                                onChange={e =>
                                                  handleToggleBranchModuleEnabled(
                                                    branch.id,
                                                    mod.id,
                                                    e.target.checked
                                                  )
                                                }
                                                disabled={!isSuperAdmin}
                                                className="w-4 h-4 rounded text-amber-500 cursor-pointer"
                                              />
                                              <span>Aktifkan Semua Sub-Menu {mod.name} ({branch.name})</span>
                                            </label>
                                          </div>

                                          <div className="divide-y divide-slate-800/60 space-y-2">
                                            {mod.subMenus.map(sub => {
                                              const accessLevel = modState.subMenus?.[sub.id] || 'none';
                                              const isSubActive = accessLevel !== 'none';

                                              return (
                                                <div
                                                  key={sub.id}
                                                  className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                                >
                                                  <label className="flex items-center gap-2.5 cursor-pointer">
                                                    <input
                                                      type="checkbox"
                                                      checked={isSubActive}
                                                      onChange={e =>
                                                        handleBranchSubMenuPermissionChange(
                                                          branch.id,
                                                          mod.id,
                                                          sub.id,
                                                          e.target.checked ? 'full_access' : 'none'
                                                        )
                                                      }
                                                      disabled={!isSuperAdmin}
                                                      className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
                                                    />
                                                    <span
                                                      className={
                                                        isSubActive
                                                          ? 'text-slate-200 font-semibold'
                                                          : 'text-slate-500'
                                                      }
                                                    >
                                                      {sub.name}
                                                    </span>
                                                  </label>

                                                  {isSubActive && (
                                                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                      <span className="text-[10px] text-slate-400">
                                                        Akses Input:
                                                      </span>
                                                      <select
                                                        value={accessLevel}
                                                        onChange={e =>
                                                          handleBranchSubMenuPermissionChange(
                                                            branch.id,
                                                            mod.id,
                                                            sub.id,
                                                            e.target.value as 'none' | 'read_only' | 'full_access'
                                                          )
                                                        }
                                                        disabled={!isSuperAdmin}
                                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                                                      >
                                                        <option value="full_access">
                                                          🟢 Full Akses (Bisa Input/Edit)
                                                        </option>
                                                        <option value="read_only">
                                                          🟡 Hanya Lihat (Read Only)
                                                        </option>
                                                        <option value="none">🔴 Tidak Ada Akses</option>
                                                      </select>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Right Actions Footer (Copy Akses, Ubah Password, Simpan Akses, Hapus) */}
                  <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSuperAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 text-xs shadow-xs"
                            title="Ubah password akun apabila user lupa password"
                          >
                            <Key className="w-4 h-4 text-amber-400" />
                            <span>Ubah Password</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(selectedUser.id)}
                            className="px-3.5 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900 text-rose-300 font-bold flex items-center gap-1.5 transition cursor-pointer border border-rose-950 text-xs shadow-xs"
                            title="Hapus akun dari sistem"
                          >
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>Hapus Akun</span>
                          </button>
                        </>
                      )}
                    </div>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={handleSaveAccess}
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95 text-xs self-end sm:self-auto"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan Akses</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Pilih pengguna di sebelah kiri untuk melihat rincian hak akses.
            </div>
          )}
        </div>

      </div>

      {/* ================= COPY ACCESS SUB-MODAL ================= */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Salin Akses dari User Lain</span>
            </h4>
            <p className="text-xs text-slate-400">
              Pilih akun pengguna sumber untuk menyalin seluruh konfigurasi hak akses modul dan sub-menu ke user saat ini ({selectedUser?.fullName}).
            </p>
            <select
              value={sourceUserIdForCopy}
              onChange={(e) => setSourceUserIdForCopy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
            >
              <option value="">-- Pilih User Sumber --</option>
              {visibleUsersForRole.filter(u => u.id !== selectedUser?.id && u.status !== 'inactive').map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({ROLE_LABELS[u.role] || u.role})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleCopyAccess}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Terapkan Salin Akses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CHANGE PASSWORD SUB-MODAL ================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Ubah Password Akun: {selectedUser?.fullName}</span>
              </h4>
              <button
                onClick={() => { setIsPasswordModalOpen(false); setNewPasswordInput(''); setConfirmPasswordInput(''); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Masukkan password baru untuk akun ini (digunakan apabila user lupa password).
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Password Baru <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Minimal 6 karakter"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white pr-9 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showNewPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Konfirmasi Password Baru <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ketik ulang password baru"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white pr-9 focus:outline-none ${
                      confirmPasswordInput && newPasswordInput !== confirmPasswordInput
                        ? 'border-rose-500/70 focus:border-rose-500'
                        : confirmPasswordInput && newPasswordInput === confirmPasswordInput
                        ? 'border-emerald-500/70 focus:border-emerald-500'
                        : 'border-slate-800 focus:border-amber-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Real-time mismatch detection */}
              {confirmPasswordInput.length > 0 && (
                <div className="text-[11px] flex items-center gap-1.5 pt-0.5">
                  {newPasswordInput !== confirmPasswordInput ? (
                    <span className="text-rose-400 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Password konfirmasi tidak cocok!</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Password cocok dan terkonfirmasi.</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsPasswordModalOpen(false); setNewPasswordInput(''); setConfirmPasswordInput(''); }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={!newPasswordInput || newPasswordInput.length < 8 || newPasswordInput !== confirmPasswordInput}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:cursor-not-allowed"
              >
                Simpan Password Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                Tambah Pengguna Baru AKK
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hendra Wijaya"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Email / Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="nama@gmail.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    placeholder="0812-xxxx-xxxx"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Role Pengguna *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setNewUser({
                        ...newUser,
                        role: r,
                        department: r === 'pengiriman'
                          ? 'Pengiriman'
                          : (r === 'driver' || r === 'crew_helper' || r === 'spv_logistik' || r === 'operasional')
                          ? 'Logistik'
                          : newUser.department
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    <option value="driver">🚚 Kru Supir / Driver</option>
                    <option value="crew_helper">🤝 Kru Helper / Kernet</option>
                    <option value="spv_logistik">🚛 SPV Logistik</option>
                    <option value="operasional">📋 Operasional</option>
                    <option value="pengiriman">📦 Pengiriman</option>
                    <option value="security">🛡️ Security</option>
                    <option value="sales_admin">💼 Adm. Penjualan</option>
                    <option value="purchasing_admin">🛒 Adm. Pembelian</option>
                    <option value="warehouse_admin">📦 Gudang</option>
                    <option value="finance_tax_admin">💰 Finance &amp; Tax</option>
                    <option value="hr_admin">👥 HR Admin</option>
                    <option value="marketing_online">🌐 Marketing Online</option>
                    <option value="marketing_offline">📣 Marketing Offline</option>
                    <option value="super_admin">👑 Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Departemen / Divisi</label>
                  <select
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    {OFFICIAL_DEPARTMENT_OPTIONS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Password *</label>
                <input
                  type="text"
                  required
                  placeholder="Minimal 6 karakter"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow cursor-pointer"
                >
                  Simpan Akun Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Profile Modal (Khusus Super Admin) */}
      {editingUser && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                    <span>Edit Pengguna: {editingUser.fullName}</span>
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {ROLE_LABELS[editingUser.role] || editingUser.role}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Perbarui data akun <strong className="text-slate-200">{editingUser.fullName}</strong> &bull; ID: <code className="text-amber-400 font-mono">{editingUser.id}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nama Lengkap &amp; Gelar</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>Email Akun</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>No. WhatsApp</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hak Akses (Role)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="unassigned">⚠️ Perlu Diisi (Belum Ditentukan)</option>
                    <option value="super_admin">👑 Super Admin / Manager</option>
                    <option value="spv_logistik">🚛 SPV Logistik</option>
                    <option value="operasional">📋 Operasional (Operational Lead)</option>
                    <option value="pengiriman">📦 Pengiriman</option>
                    <option value="security">🛡️ Security (Pos Satpam &amp; Keamanan)</option>
                    <option value="driver">🚚 Kru Supir / Driver</option>
                    <option value="crew_helper">🤝 Kru Helper / Kernet</option>
                    <option value="sales_admin">💼 Adm. Penjualan</option>
                    <option value="purchasing_admin">🛒 Adm. Pembelian</option>
                    <option value="hr_admin">👥 HR Admin</option>
                    <option value="finance_tax_admin">💰 Finance &amp; Tax</option>
                    <option value="warehouse_admin">📦 Gudang</option>
                    <option value="marketing_online">🌐 Marketing Online</option>
                    <option value="marketing_offline">📣 Marketing Offline</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Status Akun</span>
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as UserApprovalStatus })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="approved">🟢 Aktif / Disetujui (Approved)</option>
                    <option value="inactive">⚫ Nonaktif (Hak Akses Ditutup, Histori Tersimpan)</option>
                    <option value="pending">🟡 Menunggu Approval (Pending)</option>
                    <option value="rejected">🔴 Ditolak / Dibekukan (Rejected)</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Departemen / Divisi</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {!OFFICIAL_DEPARTMENT_OPTIONS.includes(editFormData.department) && editFormData.department && (
                      <option value={editFormData.department}>{editFormData.department}</option>
                    )}
                    {OFFICIAL_DEPARTMENT_OPTIONS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= DELETE CONFIRMATION SUB-MODAL ================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl neu-flat">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">
                  Konfirmasi Hapus Akun
                </h4>
                <p className="text-[10px] text-slate-400">
                  Panel Pengguna &bull; PT Anugrah Kemasan Kreatif
                </p>
              </div>
            </div>

            {users.find(u => u.id === deleteTargetId) && (
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {users.find(u => u.id === deleteTargetId)?.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-xs truncate">
                    {users.find(u => u.id === deleteTargetId)?.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {users.find(u => u.id === deleteTargetId)?.email} &bull; <span className="text-amber-400">{ROLE_LABELS[users.find(u => u.id === deleteTargetId)?.role || 'spv_logistik']}</span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun pengguna ini? Tindakan ini bersifat permanen dan seluruh hak akses akun akan dihapus dari sistem.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setDeleteTargetId(null); }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Tidak, Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= IN-PAGE POP-UP MODAL NOTIFICATION ================= */}
      {pageModalNotification && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-center">
            <div className="flex flex-col items-center gap-2.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                pageModalNotification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                pageModalNotification.type === 'error' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                pageModalNotification.type === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {pageModalNotification.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                {pageModalNotification.type === 'error' && <AlertTriangle className="w-6 h-6" />}
                {pageModalNotification.type === 'warning' && <ShieldAlert className="w-6 h-6" />}
                {pageModalNotification.type === 'info' && <ShieldCheck className="w-6 h-6" />}
              </div>
              <h4 className="font-bold text-white text-base">
                {pageModalNotification.title}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pageModalNotification.message}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                autoFocus
                onClick={() => setPageModalNotification(null)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
