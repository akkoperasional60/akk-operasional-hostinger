import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  RefreshCw,
  ArrowRightLeft,
  History,
  Plus,
  Search,
  Building2,
  Briefcase,
  Calendar,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  ArrowRight,
  Layers,
  UserPlus,
  Clock
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import { branchStore, BranchRecord } from '../../services/branchStore';
import { getUserRoleDisplayTitle } from '../../utils/rbac';
import { UserProfile } from '../../types';

export type HrChangeType =
  | 'Penugasan Awal'
  | 'Rolling Departemen'
  | 'Promosi Jabatan'
  | 'Mutasi Cabang'
  | 'Rolling & Mutasi';

export type HrEmploymentStatus = 'Aktif' | 'Non-Aktif' | 'Resign';

export interface HrWorkHistoryEntry {
  id: string;
  department: string;
  position: string;
  branchId: string;
  branchName: string;
  startDate: string;
  endDate?: string | null;
  changeType: HrChangeType;
  reason: string;
  recordedBy?: string;
  recordedAt?: string;
}

export interface HrEmployeeRecord {
  id: string;
  nik: string;
  fullName: string;
  phone?: string;
  email?: string;
  linkedUserId?: string;
  joinDate: string;
  employmentStatus: HrEmploymentStatus;
  currentDepartment: string;
  currentPosition: string;
  currentBranchId: string;
  currentBranchName: string;
  notes?: string;
  workHistory: HrWorkHistoryEntry[];
  updatedAt: string;
}

export const HR_DEPARTMENT_OPTIONS = [
  'Logistik & Pengiriman',
  'Gudang (WMS)',
  'Admin Penjualan',
  'Adm Pembelian',
  'Marketing',
  'Finance & Tax',
  'HR & GA',
  'Produksi',
  'Security',
  'Manajemen & Eksekutif'
];

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapRoleToDepartmentAndPosition(user: UserProfile): { department: string; position: string } {
  const role = String(user.role || '');
  const position = getUserRoleDisplayTitle(role);
  if (
    role === 'driver' ||
    role === 'crew_helper' ||
    role === 'dispatcher' ||
    role === 'spv_logistik' ||
    role === 'spv logistik' ||
    role === 'operasional' ||
    role === 'koordinator_driver'
  ) {
    return { department: 'Logistik & Pengiriman', position };
  }
  if (role === 'warehouse_admin' || role === 'koordinator_gudang') {
    return { department: 'Gudang (WMS)', position };
  }
  if (role === 'sales_admin' || role === 'spv_sales_admin') {
    return { department: 'Admin Penjualan', position };
  }
  if (role === 'purchasing_admin' || role === 'spv_purchasing_admin') {
    return { department: 'Adm Pembelian', position };
  }
  if (role === 'marketing_online' || role === 'marketing_offline' || role === 'spv_marketing_offline') {
    return { department: 'Marketing', position };
  }
  if (role === 'finance_tax_admin') {
    return { department: 'Finance & Tax', position };
  }
  if (role === 'security') {
    return { department: 'Security', position };
  }
  if (role === 'hr_admin') {
    return { department: 'HR & GA', position };
  }
  if (role === 'super_admin') {
    return { department: 'Manajemen & Eksekutif', position };
  }
  return {
    department: user.department?.trim() || 'Logistik & Pengiriman',
    position
  };
}

function inferPrimaryBranchForUser(
  user: UserProfile,
  branches: BranchRecord[],
  fallbackBranchId: string
): { branchId: string; branchName: string } {
  const branchPerms = user.permissions?.branchPermissions;
  if (branchPerms && typeof branchPerms === 'object') {
    const enabledBranchId = Object.keys(branchPerms).find(bId => branchPerms[bId]?.enabled);
    if (enabledBranchId) {
      const found = branches.find(b => b.id === enabledBranchId);
      if (found) return { branchId: found.id, branchName: found.name };
    }
  }
  const fallback = branches.find(b => b.id === fallbackBranchId) || branches[0];
  return {
    branchId: fallback?.id || 'banyuwangi',
    branchName: fallback?.name || 'Banyuwangi'
  };
}

function formatReadableDate(iso?: string | null): string {
  if (!iso) return 'Sekarang';
  const parts = String(iso).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return String(iso);
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDurationBetween(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return '-';
  const start = new Date(`${String(startIso).slice(0, 10)}T00:00:00`);
  const end = endIso ? new Date(`${String(endIso).slice(0, 10)}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  if (diffDays < 30) {
    return `${diffDays} hari`;
  }
  const totalMonths = Math.floor(diffDays / 30);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} thn ${months} bln`;
  if (years > 0) return `${years} thn`;
  return `${months} bln`;
}

function getOrderedWorkHistory(emp: HrEmployeeRecord): HrWorkHistoryEntry[] {
  const list = Array.isArray(emp.workHistory) ? [...emp.workHistory] : [];
  return list.sort((a, b) => {
    const aActive = !a.endDate ? 1 : 0;
    const bActive = !b.endDate ? 1 : 0;
    if (aActive !== bActive) return aActive - bActive; // completed first, active last in chronological journey
    return String(a.startDate || '').localeCompare(String(b.startDate || ''));
  });
}

function getDistinctDepartments(emp: HrEmployeeRecord): string[] {
  const ordered = getOrderedWorkHistory(emp);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const h of ordered) {
    const dept = String(h.department || '').trim();
    if (dept && !seen.has(dept)) {
      seen.add(dept);
      result.push(dept);
    }
  }
  if (emp.currentDepartment && !seen.has(emp.currentDepartment)) {
    result.push(emp.currentDepartment);
  }
  return result;
}

function buildEmployeeFromUser(
  user: UserProfile,
  idx: number,
  branches: BranchRecord[],
  fallbackBranchId: string
): HrEmployeeRecord {
  const { department, position } = mapRoleToDepartmentAndPosition(user);
  const { branchId, branchName } = inferPrimaryBranchForUser(user, branches, fallbackBranchId);
  const joinIso = user.createdAt ? String(user.createdAt).slice(0, 10) : getTodayIso();
  const nik = `AKK-${String(1001 + idx).padStart(4, '0')}`;
  const status: HrEmploymentStatus = user.status === 'inactive' ? 'Non-Aktif' : 'Aktif';

  return {
    id: `EMP-${user.id || Date.now()}-${idx}`,
    nik,
    fullName: user.fullName || 'Karyawan AKK',
    phone: user.phone || '',
    email: user.email || '',
    linkedUserId: user.id,
    joinDate: joinIso,
    employmentStatus: status,
    currentDepartment: department,
    currentPosition: position,
    currentBranchId: branchId,
    currentBranchName: branchName,
    notes: '',
    workHistory: [
      {
        id: `WH-${user.id || Date.now()}-INIT`,
        department,
        position,
        branchId,
        branchName,
        startDate: joinIso,
        endDate: null,
        changeType: 'Penugasan Awal',
        reason: 'Penempatan awal terintegrasi dari akun sistem operasional.',
        recordedBy: 'Sistem HR',
        recordedAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  };
}

export const HrEmployeeRollingView: React.FC = () => {
  const [activeSubView, setActiveSubView] = useState<'employees' | 'rolling_log' | 'department_explorer'>('employees');
  const [employees, setEmployees] = useState<HrEmployeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [historyFilterMode, setHistoryFilterMode] = useState<'ALL' | 'MULTI_DEPT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [explorerDepartment, setExplorerDepartment] = useState<string>(HR_DEPARTMENT_OPTIONS[0]);

  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => logisticsStore.getCurrentUser());

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<HrEmployeeRecord | null>(null);
  const [empForm, setEmpForm] = useState<{
    nik: string;
    fullName: string;
    phone: string;
    email: string;
    linkedUserId: string;
    joinDate: string;
    employmentStatus: HrEmploymentStatus;
    currentDepartment: string;
    currentPosition: string;
    currentBranchId: string;
    notes: string;
  }>({
    nik: '',
    fullName: '',
    phone: '',
    email: '',
    linkedUserId: '',
    joinDate: getTodayIso(),
    employmentStatus: 'Aktif',
    currentDepartment: HR_DEPARTMENT_OPTIONS[0],
    currentPosition: '',
    currentBranchId: branches[0]?.id || 'banyuwangi',
    notes: ''
  });

  // Rolling Modal
  const [isRollingModalOpen, setIsRollingModalOpen] = useState(false);
  const [rollingEmployeeId, setRollingEmployeeId] = useState<string>('');
  const [rollingForm, setRollingForm] = useState<{
    changeType: HrChangeType;
    targetDepartment: string;
    targetPosition: string;
    targetBranchId: string;
    effectiveDate: string;
    reason: string;
  }>({
    changeType: 'Rolling Departemen',
    targetDepartment: HR_DEPARTMENT_OPTIONS[1],
    targetPosition: '',
    targetBranchId: branches[0]?.id || 'banyuwangi',
    effectiveDate: getTodayIso(),
    reason: ''
  });

  // Work History Detail Modal
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string | null>(null);
  const [isAddPastHistoryOpen, setIsAddPastHistoryOpen] = useState(false);
  const [pastHistoryForm, setPastHistoryForm] = useState<{
    department: string;
    position: string;
    branchId: string;
    startDate: string;
    endDate: string;
    changeType: HrChangeType;
    reason: string;
  }>({
    department: HR_DEPARTMENT_OPTIONS[0],
    position: '',
    branchId: branches[0]?.id || 'banyuwangi',
    startDate: getTodayIso(),
    endDate: getTodayIso(),
    changeType: 'Penugasan Awal',
    reason: ''
  });

  // Delete confirmation modal (avoid window.confirm)
  const [deleteTargetEmployee, setDeleteTargetEmployee] = useState<HrEmployeeRecord | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const unsubStore = logisticsStore.subscribe(() => {
      setAllUsers([...logisticsStore.getUsers()]);
      setCurrentUser(logisticsStore.getCurrentUser());
    });
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
    });
    return () => {
      unsubStore();
      unsubBranch();
    };
  }, []);

  const persistEmployees = async (nextRecords: HrEmployeeRecord[]) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/hr-employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialized: true, records: nextRecords })
      });
      if (!res.ok) {
        throw new Error('Gagal menyimpan data karyawan ke server.');
      }
    } catch (err) {
      console.warn('[HR Employees Persist Error]', err);
      showToast('Gagal menyimpan perubahan ke database server.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetch('/api/hr-employees', { cache: 'no-store' })
      .then(r => r.json())
      .then(async res => {
        if (!active) return;
        const currentBranches = branchStore.getActiveBranches();
        const defaultBranchId = branchStore.getSelectedOriginBranchId();
        if (res && res.success && res.initialized && Array.isArray(res.records)) {
          setEmployees(res.records);
        } else {
          const usersToSeed = logisticsStore
            .getUsers()
            .filter(u => u.status === 'approved' || u.status === 'inactive');
          const seeded = usersToSeed.map((u, idx) =>
            buildEmployeeFromUser(u, idx, currentBranches, defaultBranchId)
          );
          setEmployees(seeded);
          if (seeded.length > 0) {
            await fetch('/api/hr-employees', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initialized: true, records: seeded })
            }).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSyncFromUserAccounts = async () => {
    const existingLinkedIds = new Set(employees.map(e => e.linkedUserId).filter(Boolean));
    const existingEmails = new Set(employees.map(e => (e.email || '').trim().toLowerCase()).filter(Boolean));
    const existingNames = new Set(employees.map(e => e.fullName.trim().toLowerCase()));

    const candidateUsers = allUsers.filter(
      u =>
        (u.status === 'approved' || u.status === 'inactive') &&
        !existingLinkedIds.has(u.id) &&
        !(u.email && existingEmails.has(u.email.trim().toLowerCase())) &&
        !existingNames.has((u.fullName || '').trim().toLowerCase())
    );

    if (candidateUsers.length === 0) {
      showToast('Semua akun user yang disetujui sudah terdaftar pada Data Karyawan HR.');
      return;
    }

    const defaultBranchId = branchStore.getSelectedOriginBranchId();
    const startIdx = employees.length;
    const newRecords = candidateUsers.map((u, i) =>
      buildEmployeeFromUser(u, startIdx + i, branches, defaultBranchId)
    );
    const merged = [...employees, ...newRecords];
    setEmployees(merged);
    await persistEmployees(merged);
    showToast(`${newRecords.length} karyawan baru berhasil disinkronkan dari Akun User.`);
  };

  const departmentChoices = useMemo(() => {
    const set = new Set<string>(HR_DEPARTMENT_OPTIONS);
    employees.forEach(emp => {
      if (emp.currentDepartment) set.add(emp.currentDepartment);
      (emp.workHistory || []).forEach(h => {
        if (h.department) set.add(h.department);
      });
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter(emp => {
      if (selectedBranchId !== 'ALL' && emp.currentBranchId !== selectedBranchId) {
        return false;
      }
      if (selectedStatusFilter !== 'ALL' && emp.employmentStatus !== selectedStatusFilter) {
        return false;
      }
      const distinctDepts = getDistinctDepartments(emp);
      if (selectedDepartmentFilter !== 'ALL') {
        const matchesDept =
          emp.currentDepartment === selectedDepartmentFilter ||
          distinctDepts.includes(selectedDepartmentFilter);
        if (!matchesDept) return false;
      }
      if (historyFilterMode === 'MULTI_DEPT' && distinctDepts.length < 2) {
        return false;
      }
      if (q) {
        const inProfile =
          emp.fullName.toLowerCase().includes(q) ||
          emp.nik.toLowerCase().includes(q) ||
          emp.currentDepartment.toLowerCase().includes(q) ||
          emp.currentPosition.toLowerCase().includes(q) ||
          emp.currentBranchName.toLowerCase().includes(q);
        const inHistory = (emp.workHistory || []).some(
          h =>
            h.department.toLowerCase().includes(q) ||
            h.position.toLowerCase().includes(q) ||
            h.branchName.toLowerCase().includes(q) ||
            (h.reason || '').toLowerCase().includes(q)
        );
        if (!inProfile && !inHistory) return false;
      }
      return true;
    });
  }, [
    employees,
    selectedBranchId,
    selectedStatusFilter,
    selectedDepartmentFilter,
    historyFilterMode,
    searchQuery
  ]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.employmentStatus === 'Aktif').length;
    const totalRollingEvents = employees.reduce(
      (acc, e) => acc + Math.max(0, (e.workHistory?.length || 1) - 1),
      0
    );
    const crossDeptEmployees = employees.filter(e => getDistinctDepartments(e).length >= 2).length;
    const activeDepts = new Set(employees.map(e => e.currentDepartment).filter(Boolean)).size;
    return { total, active, totalRollingEvents, crossDeptEmployees, activeDepts };
  }, [employees]);

  const rollingLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      nik: string;
      effectiveDate: string;
      changeType: HrChangeType;
      fromDepartment: string;
      fromPosition: string;
      fromBranch: string;
      toDepartment: string;
      toPosition: string;
      toBranch: string;
      reason: string;
      recordedBy: string;
    }> = [];

    employees.forEach(emp => {
      const ordered = getOrderedWorkHistory(emp);
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1];
        const curr = ordered[i];
        logs.push({
          id: `${emp.id}-${curr.id}`,
          employeeId: emp.id,
          employeeName: emp.fullName,
          nik: emp.nik,
          effectiveDate: curr.startDate,
          changeType: curr.changeType,
          fromDepartment: prev.department,
          fromPosition: prev.position,
          fromBranch: prev.branchName,
          toDepartment: curr.department,
          toPosition: curr.position,
          toBranch: curr.branchName,
          reason: curr.reason,
          recordedBy: curr.recordedBy || 'Admin HR'
        });
      }
    });

    const q = searchQuery.trim().toLowerCase();
    return logs
      .filter(l => {
        if (selectedDepartmentFilter !== 'ALL') {
          if (l.fromDepartment !== selectedDepartmentFilter && l.toDepartment !== selectedDepartmentFilter) {
            return false;
          }
        }
        if (!q) return true;
        return (
          l.employeeName.toLowerCase().includes(q) ||
          l.nik.toLowerCase().includes(q) ||
          l.fromDepartment.toLowerCase().includes(q) ||
          l.toDepartment.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  }, [employees, searchQuery, selectedDepartmentFilter]);

  const departmentExplorerData = useMemo(() => {
    const activeMembers: HrEmployeeRecord[] = [];
    const alumniMembers: Array<{
      employee: HrEmployeeRecord;
      pastPeriods: HrWorkHistoryEntry[];
    }> = [];

    employees.forEach(emp => {
      if (selectedBranchId !== 'ALL' && emp.currentBranchId !== selectedBranchId) return;
      if (emp.currentDepartment === explorerDepartment) {
        activeMembers.push(emp);
      } else {
        const matchedPast = (emp.workHistory || []).filter(
          h => h.department === explorerDepartment
        );
        if (matchedPast.length > 0) {
          alumniMembers.push({ employee: emp, pastPeriods: matchedPast });
        }
      }
    });

    return { activeMembers, alumniMembers };
  }, [employees, explorerDepartment, selectedBranchId]);

  const openAddEmployeeModal = () => {
    setEditingEmployee(null);
    const defaultBranchId =
      selectedBranchId !== 'ALL'
        ? selectedBranchId
        : branchStore.getSelectedOriginBranchId() || branches[0]?.id || 'banyuwangi';
    setEmpForm({
      nik: `AKK-${String(1001 + employees.length).padStart(4, '0')}`,
      fullName: '',
      phone: '',
      email: '',
      linkedUserId: '',
      joinDate: getTodayIso(),
      employmentStatus: 'Aktif',
      currentDepartment: HR_DEPARTMENT_OPTIONS[0],
      currentPosition: '',
      currentBranchId: defaultBranchId,
      notes: ''
    });
    setIsEmployeeModalOpen(true);
  };

  const openEditEmployeeModal = (emp: HrEmployeeRecord) => {
    setEditingEmployee(emp);
    setEmpForm({
      nik: emp.nik,
      fullName: emp.fullName,
      phone: emp.phone || '',
      email: emp.email || '',
      linkedUserId: emp.linkedUserId || '',
      joinDate: emp.joinDate,
      employmentStatus: emp.employmentStatus,
      currentDepartment: emp.currentDepartment,
      currentPosition: emp.currentPosition,
      currentBranchId: emp.currentBranchId,
      notes: emp.notes || ''
    });
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.fullName.trim() || !empForm.currentDepartment.trim()) return;

    const branchObj = branches.find(b => b.id === empForm.currentBranchId);
    const branchName = branchObj?.name || empForm.currentBranchId || 'Banyuwangi';
    const nowIso = new Date().toISOString();

    let nextRecords: HrEmployeeRecord[];
    if (editingEmployee) {
      nextRecords = employees.map(emp => {
        if (emp.id !== editingEmployee.id) return emp;
        const updatedHistory = [...(emp.workHistory || [])];
        const activeIdx = updatedHistory.findIndex(h => !h.endDate);
        if (activeIdx >= 0) {
          updatedHistory[activeIdx] = {
            ...updatedHistory[activeIdx],
            department: empForm.currentDepartment.trim(),
            position: empForm.currentPosition.trim() || updatedHistory[activeIdx].position,
            branchId: empForm.currentBranchId,
            branchName
          };
        }
        return {
          ...emp,
          nik: empForm.nik.trim() || emp.nik,
          fullName: empForm.fullName.trim(),
          phone: empForm.phone.trim(),
          email: empForm.email.trim(),
          linkedUserId: empForm.linkedUserId || undefined,
          joinDate: empForm.joinDate || emp.joinDate,
          employmentStatus: empForm.employmentStatus,
          currentDepartment: empForm.currentDepartment.trim(),
          currentPosition: empForm.currentPosition.trim() || 'Staff',
          currentBranchId: empForm.currentBranchId,
          currentBranchName: branchName,
          notes: empForm.notes.trim(),
          workHistory: updatedHistory,
          updatedAt: nowIso
        };
      });
    } else {
      const newEmp: HrEmployeeRecord = {
        id: `EMP-${Date.now()}`,
        nik: empForm.nik.trim() || `AKK-${String(1001 + employees.length).padStart(4, '0')}`,
        fullName: empForm.fullName.trim(),
        phone: empForm.phone.trim(),
        email: empForm.email.trim(),
        linkedUserId: empForm.linkedUserId || undefined,
        joinDate: empForm.joinDate || getTodayIso(),
        employmentStatus: empForm.employmentStatus,
        currentDepartment: empForm.currentDepartment.trim(),
        currentPosition: empForm.currentPosition.trim() || 'Staff Operasional',
        currentBranchId: empForm.currentBranchId,
        currentBranchName: branchName,
        notes: empForm.notes.trim(),
        workHistory: [
          {
            id: `WH-${Date.now()}`,
            department: empForm.currentDepartment.trim(),
            position: empForm.currentPosition.trim() || 'Staff Operasional',
            branchId: empForm.currentBranchId,
            branchName,
            startDate: empForm.joinDate || getTodayIso(),
            endDate: null,
            changeType: 'Penugasan Awal',
            reason: empForm.notes.trim() || 'Penempatan awal karyawan baru.',
            recordedBy: currentUser?.fullName || 'Admin HR',
            recordedAt: nowIso
          }
        ],
        updatedAt: nowIso
      };
      nextRecords = [newEmp, ...employees];
    }

    setEmployees(nextRecords);
    await persistEmployees(nextRecords);
    setIsEmployeeModalOpen(false);
    showToast(
      editingEmployee
        ? `Data karyawan ${empForm.fullName.trim()} berhasil diperbarui.`
        : `Karyawan baru ${empForm.fullName.trim()} berhasil ditambahkan.`
    );
  };

  const openRollingModal = (emp?: HrEmployeeRecord) => {
    const target = emp || filteredEmployees[0] || employees[0];
    if (!target) {
      showToast('Belum ada data karyawan. Tambahkan atau sinkronkan data karyawan terlebih dahulu.');
      return;
    }
    const suggestedDept =
      HR_DEPARTMENT_OPTIONS.find(d => d !== target.currentDepartment) || target.currentDepartment;
    setRollingEmployeeId(target.id);
    setRollingForm({
      changeType: 'Rolling Departemen',
      targetDepartment: suggestedDept,
      targetPosition: target.currentPosition,
      targetBranchId: target.currentBranchId,
      effectiveDate: getTodayIso(),
      reason: ''
    });
    setIsRollingModalOpen(true);
  };

  const selectedRollingEmployee = useMemo(
    () => employees.find(e => e.id === rollingEmployeeId) || null,
    [employees, rollingEmployeeId]
  );

  const handleConfirmRolling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRollingEmployee) return;
    if (!rollingForm.targetDepartment.trim() || !rollingForm.targetPosition.trim()) {
      showToast('Isi Departemen Tujuan dan Jabatan Baru.');
      return;
    }

    const branchObj = branches.find(b => b.id === rollingForm.targetBranchId);
    const branchName = branchObj?.name || rollingForm.targetBranchId;
    const effectiveDate = rollingForm.effectiveDate || getTodayIso();
    const nowIso = new Date().toISOString();

    const nextRecords = employees.map(emp => {
      if (emp.id !== selectedRollingEmployee.id) return emp;
      const ordered = getOrderedWorkHistory(emp);
      const updatedHistory = ordered.map((h, i) => {
        if (!h.endDate || i === ordered.length - 1) {
          return { ...h, endDate: h.endDate || effectiveDate };
        }
        return h;
      });
      updatedHistory.push({
        id: `WH-ROLL-${Date.now()}`,
        department: rollingForm.targetDepartment.trim(),
        position: rollingForm.targetPosition.trim(),
        branchId: rollingForm.targetBranchId,
        branchName,
        startDate: effectiveDate,
        endDate: null,
        changeType: rollingForm.changeType,
        reason:
          rollingForm.reason.trim() ||
          `${rollingForm.changeType} dari ${emp.currentDepartment} ke ${rollingForm.targetDepartment.trim()}`,
        recordedBy: currentUser?.fullName || 'Admin HR',
        recordedAt: nowIso
      });

      return {
        ...emp,
        currentDepartment: rollingForm.targetDepartment.trim(),
        currentPosition: rollingForm.targetPosition.trim(),
        currentBranchId: rollingForm.targetBranchId,
        currentBranchName: branchName,
        workHistory: updatedHistory,
        updatedAt: nowIso
      };
    });

    setEmployees(nextRecords);
    await persistEmployees(nextRecords);
    setIsRollingModalOpen(false);
    showToast(
      `${selectedRollingEmployee.fullName} berhasil di-rolling ke ${rollingForm.targetDepartment.trim()} (${rollingForm.targetPosition.trim()}).`
    );
  };

  const detailEmployee = useMemo(
    () => employees.find(e => e.id === historyEmployeeId) || null,
    [employees, historyEmployeeId]
  );

  const handleAddPastHistoryEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailEmployee || !pastHistoryForm.department.trim() || !pastHistoryForm.position.trim()) return;
    const branchObj = branches.find(b => b.id === pastHistoryForm.branchId);
    const branchName = branchObj?.name || pastHistoryForm.branchId;
    const nowIso = new Date().toISOString();

    const newEntry: HrWorkHistoryEntry = {
      id: `WH-PAST-${Date.now()}`,
      department: pastHistoryForm.department.trim(),
      position: pastHistoryForm.position.trim(),
      branchId: pastHistoryForm.branchId,
      branchName,
      startDate: pastHistoryForm.startDate || detailEmployee.joinDate,
      endDate: pastHistoryForm.endDate || detailEmployee.joinDate,
      changeType: pastHistoryForm.changeType,
      reason: pastHistoryForm.reason.trim() || 'Riwayat penempatan departemen sebelumnya',
      recordedBy: currentUser?.fullName || 'Admin HR',
      recordedAt: nowIso
    };

    const nextRecords = employees.map(emp => {
      if (emp.id !== detailEmployee.id) return emp;
      const mergedHistory = [...(emp.workHistory || []), newEntry];
      const earliestJoin = mergedHistory.reduce(
        (minDate, h) => (h.startDate && h.startDate < minDate ? h.startDate : minDate),
        emp.joinDate || newEntry.startDate
      );
      return {
        ...emp,
        joinDate: earliestJoin,
        workHistory: mergedHistory,
        updatedAt: nowIso
      };
    });

    setEmployees(nextRecords);
    await persistEmployees(nextRecords);
    setIsAddPastHistoryOpen(false);
    setPastHistoryForm(prev => ({ ...prev, position: '', reason: '' }));
    showToast(`Riwayat departemen lampau untuk ${detailEmployee.fullName} ditambahkan.`);
  };

  const handleDeleteHistoryEntry = async (empId: string, entryId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp || (emp.workHistory?.length || 0) <= 1) return;
    const target = emp.workHistory.find(h => h.id === entryId);
    if (!target || !target.endDate) {
      showToast('Entri penempatan aktif saat ini tidak dapat dihapus langsung. Gunakan Rolling Karyawan untuk memindahkannya.');
      return;
    }
    const nextRecords = employees.map(item =>
      item.id === empId
        ? {
            ...item,
            workHistory: item.workHistory.filter(h => h.id !== entryId),
            updatedAt: new Date().toISOString()
          }
        : item
    );
    setEmployees(nextRecords);
    await persistEmployees(nextRecords);
    showToast('Entri riwayat kerja berhasil dihapus.');
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!deleteTargetEmployee) return;
    const targetName = deleteTargetEmployee.fullName;
    const nextRecords = employees.filter(e => e.id !== deleteTargetEmployee.id);
    setEmployees(nextRecords);
    await persistEmployees(nextRecords);
    setDeleteTargetEmployee(null);
    showToast(`Data karyawan ${targetName} berhasil dihapus.`);
  };

  return (
    <div className="space-y-5 w-full max-w-full">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header HR: Data Karyawan, Rolling & Riwayat Departemen */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  HR: Data Karyawan, Rolling &amp; History Departemen
                </h1>
                {isSaving && (
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    &middot; Menyimpan perubahan...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola profil karyawan, proses rolling antar departemen atau cabang, serta telusuri history departemen tempat karyawan pernah bekerja.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncFromUserAccounts}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Sinkron Akun User</span>
            </button>

            <button
              type="button"
              onClick={() => openRollingModal()}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Rolling Karyawan</span>
            </button>

            <button
              type="button"
              onClick={openAddEmployeeModal}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Tambah Karyawan</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Karyawan Terdata
            </span>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 font-mono tabular-nums">
              {stats.active} Aktif{' '}
              <span className="text-xs font-normal text-slate-500">/ {stats.total} Total</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              Total Riwayat Rolling / Mutasi
            </span>
            <div className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5 font-mono tabular-nums">
              {stats.totalRollingEvents} Kali Rolling
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 block">
              Pengalaman Lintas Departemen
            </span>
            <div className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5 font-mono tabular-nums">
              {stats.crossDeptEmployees} Karyawan
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              Departemen Aktif
            </span>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono tabular-nums">
              {stats.activeDepts} Departemen
            </div>
          </div>
        </div>
      </div>

      {/* Mode Tampilan Internal HR + Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubView('employees')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeSubView === 'employees'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Data &amp; Jejak Karyawan ({filteredEmployees.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('rolling_log')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeSubView === 'rolling_log'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Log Rolling &amp; Mutasi ({rollingLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubView('department_explorer')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeSubView === 'department_explorer'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Telusur History Per Departemen</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan, NIK, jabatan, atau departemen yang pernah ditempati..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={selectedDepartmentFilter}
              onChange={e => setSelectedDepartmentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Departemen (Aktif &amp; Riwayat)</option>
              {departmentChoices.map(dept => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Cabang</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  Cabang {b.name}
                </option>
              ))}
            </select>

            <select
              value={historyFilterMode}
              onChange={e => setHistoryFilterMode(e.target.value as 'ALL' | 'MULTI_DEPT')}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Pengalaman</option>
              <option value="MULTI_DEPT">Pernah Rolling &ge; 2 Departemen</option>
            </select>

            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Non-Aktif">Non-Aktif</option>
              <option value="Resign">Resign</option>
            </select>
          </div>
        </div>
      </div>

      {/* TAB 1: TABEL DATA KARYAWAN & JEJAK HISTORY DEPARTEMEN */}
      {activeSubView === 'employees' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="h-10 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-4">NIK &amp; Nama Karyawan</th>
                  <th className="px-4">Departemen &amp; Jabatan Aktif</th>
                  <th className="px-4">Cabang</th>
                  <th className="px-4">Masa Kerja</th>
                  <th className="px-4">History Departemen Pernah Ditempati</th>
                  <th className="px-4 text-center">Status</th>
                  <th className="px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Memuat data karyawan dan riwayat departemen...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="space-y-2 max-w-md mx-auto">
                        <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                          Tidak Ada Data Karyawan yang Sesuai Filter
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tambahkan karyawan baru atau klik Sinkron Akun User untuk menarik daftar karyawan aktif.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => {
                    const orderedHistory = getOrderedWorkHistory(emp);
                    const distinctDepts = getDistinctDepartments(emp);
                    const rollingCount = Math.max(0, orderedHistory.length - 1);
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {emp.fullName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {emp.nik}
                            {emp.phone ? ` • ${emp.phone}` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-indigo-700 dark:text-indigo-300">
                            {emp.currentDepartment}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                            {emp.currentPosition}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">
                          {emp.currentBranchName}
                        </td>

                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {formatDurationBetween(emp.joinDate, emp.employmentStatus === 'Resign' ? emp.updatedAt : null)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Masuk: {formatReadableDate(emp.joinDate)}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top min-w-[260px]">
                          <div className="flex flex-wrap items-center gap-1">
                            {orderedHistory.map((h, idx) => {
                              const isCurrent = !h.endDate || idx === orderedHistory.length - 1;
                              return (
                                <React.Fragment key={h.id}>
                                  <button
                                    type="button"
                                    onClick={() => setHistoryEmployeeId(emp.id)}
                                    title={`${h.department} (${h.position}) • ${formatReadableDate(h.startDate)} - ${formatReadableDate(h.endDate)}`}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                      isCurrent
                                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    {h.department}
                                    {isCurrent ? ' (Aktif)' : ''}
                                  </button>
                                  {idx < orderedHistory.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {distinctDepts.length} departemen &middot; {rollingCount}x rolling
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                              emp.employmentStatus === 'Aktif'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : emp.employmentStatus === 'Non-Aktif'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {emp.employmentStatus}
                          </span>
                        </td>

                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setHistoryEmployeeId(emp.id)}
                              className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Lihat Timeline History Kerja & Departemen"
                            >
                              <History className="w-3 h-3" />
                              <span>History</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openRollingModal(emp)}
                              className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Rolling / Mutasi Departemen"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Rolling</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditEmployeeModal(emp)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                              title="Edit Profil Karyawan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetEmployee(emp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Hapus Karyawan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LOG ROLLING & MUTASI */}
      {activeSubView === 'rolling_log' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Riwayat Rolling &amp; Mutasi Karyawan ({rollingLogs.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Catatan kronologis perpindahan karyawan antar departemen, jabatan, maupun cabang operasional.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="h-10 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-4">Tanggal Efektif</th>
                  <th className="px-4">Karyawan</th>
                  <th className="px-4">Jenis Perubahan</th>
                  <th className="px-4">Dari Departemen &amp; Posisi</th>
                  <th className="px-4">Ke Departemen &amp; Posisi</th>
                  <th className="px-4">Alasan / Catatan</th>
                  <th className="px-4 text-right">Diproses Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rollingLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Belum ada riwayat rolling karyawan. Gunakan tombol <strong>Rolling Karyawan</strong> untuk memindahkan atau mempromosikan karyawan.
                    </td>
                  </tr>
                ) : (
                  rollingLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatReadableDate(log.effectiveDate)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setHistoryEmployeeId(log.employeeId)}
                          className="text-left hover:underline cursor-pointer"
                        >
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            {log.employeeName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">{log.nik}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-extrabold">
                          {log.changeType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700 dark:text-slate-300">
                          {log.fromDepartment}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {log.fromPosition} &bull; {log.fromBranch}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300">
                          {log.toDepartment}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {log.toPosition} &bull; {log.toBranch}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs">
                        {log.reason}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-semibold whitespace-nowrap">
                        {log.recordedBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TELUSUR HISTORY PER DEPARTEMEN */}
      {activeSubView === 'department_explorer' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Telusur Karyawan Aktif &amp; Alumni Per Departemen
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih departemen untuk melihat siapa saja yang sedang bertugas serta karyawan yang pernah bekerja di departemen tersebut.
              </p>
            </div>
            <select
              value={explorerDepartment}
              onChange={e => setExplorerDepartment(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-900 dark:text-white cursor-pointer"
            >
              {departmentChoices.map(dept => (
                <option key={dept} value={dept}>
                  Departemen: {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sedang Menjabat */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Sedang Menjabat di {explorerDepartment}
                  </h3>
                  <p className="text-[11px] text-slate-500">Karyawan yang saat ini aktif bertugas</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold font-mono">
                  {departmentExplorerData.activeMembers.length} Orang
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {departmentExplorerData.activeMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Belum ada karyawan aktif pada departemen ini.
                  </div>
                ) : (
                  departmentExplorerData.activeMembers.map(emp => {
                    const ordered = getOrderedWorkHistory(emp);
                    const currentEntry = ordered[ordered.length - 1];
                    return (
                      <div key={emp.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {emp.fullName}{' '}
                            <span className="font-mono text-[10px] text-slate-400">({emp.nik})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {emp.currentPosition} &bull; Cabang {emp.currentBranchName}
                          </div>
                          {currentEntry && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                              Menjabat sejak {formatReadableDate(currentEntry.startDate)} (
                              {formatDurationBetween(currentEntry.startDate, null)})
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setHistoryEmployeeId(emp.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          History Lengkap
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Alumni / Pernah Bekerja di Departemen Ini */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Pernah Bekerja di {explorerDepartment} (Sudah Rolling)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Karyawan yang memiliki history penempatan sebelumnya di departemen ini
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-extrabold font-mono">
                  {departmentExplorerData.alumniMembers.length} Orang
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {departmentExplorerData.alumniMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Belum ada alumni atau riwayat karyawan yang pindah dari departemen ini.
                  </div>
                ) : (
                  departmentExplorerData.alumniMembers.map(({ employee, pastPeriods }) => (
                    <div key={employee.id} className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {employee.fullName}{' '}
                          <span className="font-mono text-[10px] text-slate-400">
                            ({employee.nik})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHistoryEmployeeId(employee.id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          Detail History
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        Posisi saat ini:{' '}
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {employee.currentDepartment} ({employee.currentPosition})
                        </strong>
                      </div>
                      <div className="space-y-1 pt-1">
                        {pastPeriods.map(p => (
                          <div
                            key={p.id}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            Pernah sebagai <strong>{p.position}</strong> ({p.branchName}) &bull;{' '}
                            {formatReadableDate(p.startDate)} s/d {formatReadableDate(p.endDate)} (
                            {formatDurationBetween(p.startDate, p.endDate)})
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT KARYAWAN */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingEmployee ? 'Edit Data Karyawan' : 'Tambah Data Karyawan Baru'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Data karyawan dan penempatan awal otomatis tersimpan ke database server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    NIK / ID Karyawan *
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.nik}
                    onChange={e => setEmpForm(prev => ({ ...prev, nik: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Lengkap Karyawan *
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.fullName}
                    onChange={e => setEmpForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Contoh: Ahmad Fauzi"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Departemen Saat Ini *
                  </label>
                  <select
                    value={empForm.currentDepartment}
                    onChange={e =>
                      setEmpForm(prev => ({ ...prev, currentDepartment: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {departmentChoices.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jabatan / Posisi *
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.currentPosition}
                    onChange={e =>
                      setEmpForm(prev => ({ ...prev, currentPosition: e.target.value }))
                    }
                    placeholder="Contoh: Helper Gudang / Supir"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cabang Penempatan *
                  </label>
                  <select
                    value={empForm.currentBranchId}
                    onChange={e =>
                      setEmpForm(prev => ({ ...prev, currentBranchId: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Mulai Kerja *
                  </label>
                  <input
                    type="date"
                    required
                    value={empForm.joinDate}
                    onChange={e => setEmpForm(prev => ({ ...prev, joinDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status Kerja
                  </label>
                  <select
                    value={empForm.employmentStatus}
                    onChange={e =>
                      setEmpForm(prev => ({
                        ...prev,
                        employmentStatus: e.target.value as HrEmploymentStatus
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                    <option value="Resign">Resign</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    No. Telepon / WA
                  </label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={e => setEmpForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Karyawan
                  </label>
                  <input
                    type="email"
                    value={empForm.email}
                    onChange={e => setEmpForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="opsional@perusahaan.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tautkan Akun Sistem (Opsional)
                  </label>
                  <select
                    value={empForm.linkedUserId}
                    onChange={e => {
                      const uid = e.target.value;
                      const found = allUsers.find(u => u.id === uid);
                      setEmpForm(prev => ({
                        ...prev,
                        linkedUserId: uid,
                        fullName: prev.fullName || found?.fullName || '',
                        phone: prev.phone || found?.phone || '',
                        email: prev.email || found?.email || ''
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Tidak Tertaut Akun Login --</option>
                    {allUsers
                      .filter(u => u.status === 'approved')
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({getUserRoleDisplayTitle(u.role)})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  value={empForm.notes}
                  onChange={e => setEmpForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Catatan kontrak, kompetensi, atau keterangan penempatan..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  {editingEmployee ? 'Simpan Perubahan' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ROLLING / MUTASI KARYAWAN */}
      {isRollingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Proses Rolling &amp; Mutasi Karyawan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Riwayat departemen lama otomatis tercatat agar rekam jejak kerja karyawan lengkap.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRollingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRolling} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Karyawan yang Di-Rolling *
                </label>
                <select
                  value={rollingEmployeeId}
                  onChange={e => {
                    const nextId = e.target.value;
                    setRollingEmployeeId(nextId);
                    const found = employees.find(x => x.id === nextId);
                    if (found) {
                      setRollingForm(prev => ({
                        ...prev,
                        targetPosition: found.currentPosition,
                        targetBranchId: found.currentBranchId
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nik}) — {emp.currentDepartment} ({emp.currentPosition})
                    </option>
                  ))}
                </select>
              </div>

              {selectedRollingEmployee && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Penempatan Aktif Sebelumnya
                  </span>
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {selectedRollingEmployee.currentDepartment} &bull;{' '}
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {selectedRollingEmployee.currentPosition}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Cabang {selectedRollingEmployee.currentBranchName} &bull; Sejak{' '}
                    {formatReadableDate(
                      getOrderedWorkHistory(selectedRollingEmployee).slice(-1)[0]?.startDate ||
                        selectedRollingEmployee.joinDate
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jenis Rolling / Perubahan *
                  </label>
                  <select
                    value={rollingForm.changeType}
                    onChange={e =>
                      setRollingForm(prev => ({
                        ...prev,
                        changeType: e.target.value as HrChangeType
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Rolling Departemen">Rolling Departemen</option>
                    <option value="Promosi Jabatan">Promosi / Perubahan Jabatan</option>
                    <option value="Mutasi Cabang">Mutasi Cabang</option>
                    <option value="Rolling & Mutasi">Rolling Departemen &amp; Cabang</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Efektif Rolling *
                  </label>
                  <input
                    type="date"
                    required
                    value={rollingForm.effectiveDate}
                    onChange={e =>
                      setRollingForm(prev => ({ ...prev, effectiveDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Departemen Tujuan *
                  </label>
                  <select
                    value={rollingForm.targetDepartment}
                    onChange={e =>
                      setRollingForm(prev => ({ ...prev, targetDepartment: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {departmentChoices.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jabatan / Posisi Baru *
                  </label>
                  <input
                    type="text"
                    required
                    value={rollingForm.targetPosition}
                    onChange={e =>
                      setRollingForm(prev => ({ ...prev, targetPosition: e.target.value }))
                    }
                    placeholder="Contoh: Koordinator Gudang"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cabang Tujuan *
                  </label>
                  <select
                    value={rollingForm.targetBranchId}
                    onChange={e =>
                      setRollingForm(prev => ({ ...prev, targetBranchId: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alasan / Catatan Rolling
                </label>
                <textarea
                  rows={2}
                  value={rollingForm.reason}
                  onChange={e => setRollingForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Contoh: Kebutuhan operasional divisi gudang & penguatan tim inbound."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRollingModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  Simpan Rolling Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL TIMELINE HISTORY KERJA & DEPARTEMEN KARYAWAN */}
      {detailEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0">
                  {detailEmployee.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    History Kerja &amp; Riwayat Departemen — {detailEmployee.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    NIK: <span className="font-mono font-bold">{detailEmployee.nik}</span> &bull; Masuk{' '}
                    {formatReadableDate(detailEmployee.joinDate)} &bull; Total Masa Kerja{' '}
                    <strong>{formatDurationBetween(detailEmployee.joinDate, null)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryEmployeeId(null);
                  setIsAddPastHistoryOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ringkasan Departemen yang Pernah Ditempati */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Jejak Departemen yang Pernah Ditempati ({getDistinctDepartments(detailEmployee).length} Departemen)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddPastHistoryOpen(prev => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Catat Riwayat Lampau</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailEmployee;
                      setHistoryEmployeeId(null);
                      openRollingModal(target);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Proses Rolling Baru</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {getOrderedWorkHistory(detailEmployee).map((h, i, arr) => {
                  const isActive = !h.endDate || i === arr.length - 1;
                  return (
                    <React.Fragment key={h.id}>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {h.department} ({h.position})
                      </span>
                      {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Form Catat Riwayat Lampau */}
            {isAddPastHistoryOpen && (
              <form
                onSubmit={handleAddPastHistoryEntry}
                className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-3 text-xs"
              >
                <div className="font-extrabold text-indigo-900 dark:text-indigo-200">
                  Tambah Catatan Riwayat Kerja Sebelumnya
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Departemen Terdahulu *
                    </label>
                    <select
                      value={pastHistoryForm.department}
                      onChange={e =>
                        setPastHistoryForm(prev => ({ ...prev, department: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      {departmentChoices.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Jabatan / Posisi *
                    </label>
                    <input
                      type="text"
                      required
                      value={pastHistoryForm.position}
                      onChange={e =>
                        setPastHistoryForm(prev => ({ ...prev, position: e.target.value }))
                      }
                      placeholder="Contoh: Operator Produksi"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Cabang
                    </label>
                    <select
                      value={pastHistoryForm.branchId}
                      onChange={e =>
                        setPastHistoryForm(prev => ({ ...prev, branchId: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Mulai *
                    </label>
                    <input
                      type="date"
                      required
                      value={pastHistoryForm.startDate}
                      onChange={e =>
                        setPastHistoryForm(prev => ({ ...prev, startDate: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Selesai *
                    </label>
                    <input
                      type="date"
                      required
                      value={pastHistoryForm.endDate}
                      onChange={e =>
                        setPastHistoryForm(prev => ({ ...prev, endDate: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={pastHistoryForm.reason}
                      onChange={e =>
                        setPastHistoryForm(prev => ({ ...prev, reason: e.target.value }))
                      }
                      placeholder="Catatan penempatan"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddPastHistoryOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold cursor-pointer"
                  >
                    Simpan Riwayat
                  </button>
                </div>
              </form>
            )}

            {/* Timeline Kronologis */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Timeline Perjalanan Kerja &amp; Departemen
              </h4>
              <div className="space-y-3 border-l-2 border-indigo-200 dark:border-indigo-800 ml-3 pl-5">
                {[...getOrderedWorkHistory(detailEmployee)].reverse().map(entry => {
                  const isActive = !entry.endDate;
                  return (
                    <div
                      key={entry.id}
                      className={`relative p-4 rounded-xl border ${
                        isActive
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full absolute -left-[27px] top-5 border-2 border-white dark:border-slate-900 ${
                          isActive ? 'bg-indigo-600' : 'bg-slate-400'
                        }`}
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{entry.department}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            &mdash; {entry.position}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {isActive ? 'Aktif Saat Ini' : entry.changeType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatReadableDate(entry.startDate)} &ndash;{' '}
                              {formatReadableDate(entry.endDate)} (
                              {formatDurationBetween(entry.startDate, entry.endDate)})
                            </span>
                          </span>
                          {!isActive && (detailEmployee.workHistory?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteHistoryEntry(detailEmployee.id, entry.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Hapus entri riwayat ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Building2 className="w-3 h-3" /> Cabang {entry.branchName}
                        </span>
                        {entry.reason && <span>Catatan: {entry.reason}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS KARYAWAN */}
      {deleteTargetEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Hapus Data Karyawan?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus data karyawan{' '}
              <strong>{deleteTargetEmployee.fullName}</strong> ({deleteTargetEmployee.nik}) beserta riwayat kerjanya?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetEmployee(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEmployee}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
