import React, { useState, useEffect } from 'react';
import { Eye, Lock, AlertTriangle, X } from 'lucide-react';
import { UserProfile } from '../types';
import { isReadOnlyAccess } from '../utils/rbac';

interface ReadOnlyModuleBoundaryProps {
  user: UserProfile | null | undefined;
  activeTab: string;
  children: React.ReactNode;
}

const SAFE_READ_PATTERNS = [
  /\b(ekspor|export|unduh|download|cetak|print|lihat|view|detail|riwayat|history|tutup|close|batal|cancel|kembali|back|filter|cari|search|refresh|muat ulang|sebelumnya|berikutnya|prev|next)\b/i
];

const MUTATION_ACTION_PATTERNS = [
  /\b(tambah|simpan|hapus|edit|ubah|unggah|upload|import|gantikan|tidak jadi ganti|reset|setujui|tolak|sesuaikan|buat baru|perbarui|update|delete|save|create|remove|approve|reject|nonaktifkan|ambil foto|jepret)\b/i
];

export const ReadOnlyModuleBoundary: React.FC<ReadOnlyModuleBoundaryProps> = ({
  user,
  activeTab,
  children
}) => {
  const [blockedAlert, setBlockedAlert] = useState<string | null>(null);
  const isReadOnly = isReadOnlyAccess(user, activeTab);

  useEffect(() => {
    setBlockedAlert(null);
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (!blockedAlert) return;
    const timer = setTimeout(() => setBlockedAlert(null), 4000);
    return () => clearTimeout(timer);
  }, [blockedAlert]);

  if (!isReadOnly) {
    return <>{children}</>;
  }

  const triggerBlockedNotice = (actionLabel?: string) => {
    const cleanLabel = (actionLabel || 'Perubahan data').trim().slice(0, 60);
    setBlockedAlert(
      `Akses Ditolak: "${cleanLabel}" tidak diizinkan karena akun ${user?.fullName || 'Anda'} diatur Hanya Lihat (Read Only) pada menu ini.`
    );
  };

  const isMutationElement = (target: HTMLElement | null): { blocked: boolean; label: string } => {
    if (!target) return { blocked: false, label: '' };

    const fileInput = target.closest('input[type="file"]') as HTMLInputElement | null;
    if (fileInput) {
      return { blocked: true, label: 'Unggah File' };
    }

    const interactive = target.closest('button, [role="button"], label, a') as HTMLElement | null;
    if (!interactive) return { blocked: false, label: '' };

    if (interactive.tagName.toLowerCase() === 'label') {
      const hasFile = interactive.querySelector('input[type="file"]');
      if (hasFile) {
        return { blocked: true, label: interactive.textContent?.trim() || 'Unggah File' };
      }
    }

    const text = (interactive.textContent || '').replace(/\s+/g, ' ').trim();
    const title = (interactive.getAttribute('title') || '').trim();
    const ariaLabel = (interactive.getAttribute('aria-label') || '').trim();
    const combined = `${text} ${title} ${ariaLabel}`.trim();

    // Check if it is explicitly a safe read/export/filter/close button
    if (
      SAFE_READ_PATTERNS.some(rx => rx.test(text)) &&
      !MUTATION_ACTION_PATTERNS.some(rx => rx.test(text))
    ) {
      return { blocked: false, label: '' };
    }

    if (MUTATION_ACTION_PATTERNS.some(rx => rx.test(combined))) {
      return { blocked: true, label: text || title || ariaLabel || 'Aksi Perubahan' };
    }

    // Check for icon-only edit/delete/upload/save buttons
    const hasMutationIcon = Boolean(
      interactive.querySelector(
        '.lucide-trash, .lucide-trash-2, .lucide-edit, .lucide-edit-2, .lucide-edit-3, .lucide-pencil, .lucide-upload, .lucide-save, .lucide-user-plus, .lucide-file-up'
      )
    );
    if (hasMutationIcon) {
      return { blocked: true, label: title || text || 'Edit / Hapus Data' };
    }

    return { blocked: false, label: '' };
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const check = isMutationElement(target);
    if (check.blocked) {
      e.preventDefault();
      e.stopPropagation();
      triggerBlockedNotice(check.label);
    }
  };

  const handleSubmitCapture = (e: React.FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    triggerBlockedNotice('Simpan Formulir');
  };

  const handleChangeCapture = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.tagName.toLowerCase() === 'input' && (target as HTMLInputElement).type === 'file') {
      e.preventDefault();
      e.stopPropagation();
      (target as HTMLInputElement).value = '';
      triggerBlockedNotice('Unggah File');
    }
  };

  return (
    <div
      onClickCapture={handleClickCapture}
      onSubmitCapture={handleSubmitCapture}
      onChangeCapture={handleChangeCapture}
      className="space-y-3"
    >
      {/* Top Read-Only Mode Banner */}
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </span>
          <div>
            <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-400 mr-2">
              Mode Hanya Lihat (Read Only)
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Akun <strong>{user?.fullName}</strong> hanya memiliki izin melihat data pada menu ini. Fitur tambah, ubah, unggah, dan hapus dinonaktifkan.
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300">
          <Lock className="w-3 h-3" />
          <span>Terkunci dari Perubahan</span>
        </span>
      </div>

      {/* Blocked Action Toast Alert */}
      {blockedAlert && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-200 shadow-md">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{blockedAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setBlockedAlert(null)}
            className="p-1 rounded hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 cursor-pointer"
            title="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {children}
    </div>
  );
};
