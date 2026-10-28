import { UserProfile } from '../types';

/**
 * ============================================================================
 * PT ANUGRAH KEMASAN KREATIF (AKK) - ENTERPRISE SECURITY UTILITIES
 * ============================================================================
 * Modul keamanan terpusat untuk:
 * 1. Sanitasi Input Pengguna (Pencegahan XSS, HTML Injection, SQL Injection)
 * 2. Pengamanan API Key & Masking Kredensial Sensitif
 * 3. Validasi Format Bisnis (Plat Nomor Kendaraan, No. Telepon, Resi PO, PIN)
 * 4. Pengamanan Akses Database & RBAC Mutation Guard
 * 5. Wrapper Penyimpanan Aman (localStorage with anti-prototype pollution)
 */

// Regex Pola Serangan XSS & Injeksi Skrip
const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const DANGEROUS_TAGS_REGEX = /<\/?(script|iframe|object|embed|applet|meta|link|style|base|form|input|button)\b[^>]*>/gi;
const INLINE_EVENT_REGEX = /\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const JAVASCRIPT_PROTOCOL_REGEX = /(javascript|vbscript|data|file):/gi;

// Regex Pola Serangan SQL Injection
const SQL_META_REGEX = /(--|\/\*|\*\/|;|xp_|sp_|exec\s+|union\s+select|insert\s+into|drop\s+table)/gi;

// Regex Format Bisnis Validasi Indonesia
const INDONESIA_PLATE_REGEX = /^[A-Z]{1,2}\s?[0-9]{1,4}\s?[A-Z]{0,3}$/i;
const INDONESIA_PHONE_REGEX = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
const TRACKING_NUMBER_REGEX = /^[A-Za-z0-9\-_]{4,40}$/;
const NUMERIC_PIN_REGEX = /^[0-9]{4,6}$/;

/**
 * 1. PENGAMANAN & MASKING API KEY
 * Menyembunyikan token / API key rahasia agar tidak terekspos di log atau pratinjau UI
 */
export function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== 'string') return '••••••••';
  const clean = key.trim();
  if (clean.length <= 8) return '••••••••';
  const first = clean.slice(0, 4);
  const last = clean.slice(-4);
  return `${first}••••••••${last}`;
}

export function isApiKeyConfigured(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim();
  return clean.length >= 10 && !clean.includes('MY_') && !clean.includes('YOUR_');
}

/**
 * 2. SANITASI INPUT PENGGUNA (ANTI-XSS & ANTI-INJECTION)
 */

/**
 * Sanitasi teks umum: membersihkan karakter kontrol tersembunyi, menghapus spasi berlebih,
 * dan membatasi panjang karakter agar tidak menyebabkan buffer overflow.
 */
export function sanitizeText(input: unknown, maxLength: number = 500): string {
  if (input === null || input === undefined) return '';
  let str = String(input);

  // Hapus karakter null-byte dan kontrol berbahaya (\x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Netralkan tag HTML berbahaya
  str = str
    .replace(SCRIPT_REGEX, '')
    .replace(DANGEROUS_TAGS_REGEX, '')
    .replace(INLINE_EVENT_REGEX, '')
    .replace(JAVASCRIPT_PROTOCOL_REGEX, '');

  // Potong sesuai batas maksimum
  return str.trim().slice(0, maxLength);
}

/**
 * Sanitasi HTML untuk teks yang akan ditampilkan di web:
 * Mengubah entitas karakter berbahaya menjadi kode HTML aman.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;'
  };
  return str.replace(/[&<>"'`/]/g, (char) => map[char] || char);
}

/**
 * Sanitasi parameter query SQL dinamis:
 * Menggandakan tanda petik tunggal dan menghapus keyword SQL destruktif.
 */
export function sanitizeSqlParam(input: unknown): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  // Netralkan single quote
  str = str.replace(/'/g, "''");
  // Hapus pola komentar SQL yang biasa dipakai bypass autentikasi
  str = str.replace(SQL_META_REGEX, '');
  return str.trim();
}

/**
 * 3. VALIDATOR FORMAT DATA BISNIS
 */

export function validatePlateNumber(plate: string): boolean {
  if (!plate || typeof plate !== 'string') return false;
  return INDONESIA_PLATE_REGEX.test(plate.trim());
}

export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s\-]/g, '');
  return INDONESIA_PHONE_REGEX.test(clean);
}

export function validateTrackingNumber(trk: string): boolean {
  if (!trk || typeof trk !== 'string') return false;
  return TRACKING_NUMBER_REGEX.test(trk.trim());
}

export function validateSecurityPin(pin: string): boolean {
  if (!pin || typeof pin !== 'string') return false;
  return NUMERIC_PIN_REGEX.test(pin.trim());
}

export function sanitizeNumber(
  val: unknown,
  min: number = 0,
  max: number = 1000000,
  fallback: number = 0
): number {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

/**
 * 4. PENGAMANAN AKSES DATABASE & MUTATION GUARD
 * Menjamin hanya role berwenang yang dapat mengubah entitas kritis.
 */
export type SecureAction =
  | 'CREATE_SCHEDULE'
  | 'DELETE_SCHEDULE'
  | 'UPDATE_FLEET'
  | 'DELETE_FLEET'
  | 'APPROVE_USER'
  | 'VIEW_FINANCE'
  | 'SUBMIT_DRIVER_REPORT'
  | 'SUBMIT_DRIVER_POD'
  | 'RESOLVE_DRIVER_REPORT'
  | 'SYSTEM_ADMIN_CONFIG';

export function verifyActionPermission(
  user: UserProfile | null | undefined,
  action: SecureAction
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'Pengguna belum terautentikasi (Sesi Habis).' };
  }

  // Super Admin selalu memiliki otorisasi penuh
  if (user.role === 'super_admin') {
    return { allowed: true };
  }

  // Pastikan akun telah diverifikasi / disetujui
  if (user.status !== 'approved') {
    return { allowed: false, reason: 'Akun Anda belum disetujui oleh Super Administrator.' };
  }

  switch (action) {
    case 'CREATE_SCHEDULE':
    case 'UPDATE_FLEET':
    case 'RESOLVE_DRIVER_REPORT':
      if (['spv_logistik', 'direksi'].includes(user.role)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Hanya SPV Logistik & Super Admin yang berwenang mengubah jadwal & armada.' };

    case 'DELETE_SCHEDULE':
    case 'DELETE_FLEET':
    case 'APPROVE_USER':
    case 'SYSTEM_ADMIN_CONFIG':
      return { allowed: false, reason: 'Tindakan destruktif ini dibatasi khusus untuk Super Administrator.' };

    case 'SUBMIT_DRIVER_REPORT':
    case 'SUBMIT_DRIVER_POD':
      if (['driver', 'spv_logistik'].includes(user.role)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Aksi ini hanya dapat dilakukan oleh Kru Pengemudi Aktif atau SPV.' };

    case 'VIEW_FINANCE':
      if (['finance_tax', 'direksi'].includes(user.role)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Akses modul keuangan dibatasi untuk Departemen Finance.' };

    default:
      return { allowed: true };
  }
}

/**
 * 5. WRAPPER PENYIMPANAN AMAN (SECURE STORAGE)
 * Mencegah prototype pollution dan menangani kuota memori browser.
 */
export const secureStorage = {
  getItem<T>(key: string, fallback: T): T {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return fallback;
      }
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);

      // Lindungi dari prototype pollution
      if (parsed && typeof parsed === 'object') {
        Reflect.deleteProperty(parsed, '__proto__');
        Reflect.deleteProperty(parsed, 'constructor');
        Reflect.deleteProperty(parsed, 'prototype');
      }

      return parsed as T;
    } catch (e) {
      console.warn(`[SecureStorage] Gagal membaca storage "${key}":`, e);
      return fallback;
    }
  },

  setItem<T>(key: string, value: T): boolean {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return false;
      }
      // Bersihkan prototype sebelum serialisasi
      const cleanValue = JSON.parse(
        JSON.stringify(value, (k, v) => (k === '__proto__' || k === 'constructor' ? undefined : v))
      );
      localStorage.setItem(key, JSON.stringify(cleanValue));
      return true;
    } catch (e) {
      console.error(`[SecureStorage] Kuota penyimpanan habis atau gagal menyimpan "${key}":`, e);
      return false;
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SecureStorage] Gagal menghapus "${key}":`, e);
    }
  }
};
