/** Camera + position from one capture session. Shared validation on client/server. */
export interface CameraEvidence {
  photo: string;
  source: 'camera';
  capturedAt: string;
  gpsCapturedAt: string;
  gps: { latitude: number; longitude: number; accuracy: number };
}
export const CAMERA_MAX_AGE_MS = 15 * 60 * 1000;
export const CAMERA_MAX_ACCURACY_METERS = 200;
export const CAMERA_MAX_DATA_URL = 1_300_000;
export function validateCameraEvidence(value: unknown, now = Date.now()): string | null {
  if (!value || typeof value !== 'object') return 'Ambil foto langsung melalui kamera terlebih dahulu.';
  const e = value as Partial<CameraEvidence>;
  if (e.source !== 'camera' || typeof e.photo !== 'string' || e.photo.length > CAMERA_MAX_DATA_URL || e.photo.length < 160 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(e.photo)) return 'Foto kamera tidak valid. Ambil ulang.';
  try {
    const bytes = atob(e.photo.slice('data:image/jpeg;base64,'.length));
    if (bytes.length < 100 || bytes.charCodeAt(0) !== 255 || bytes.charCodeAt(1) !== 216 || bytes.charCodeAt(bytes.length - 2) !== 255 || bytes.charCodeAt(bytes.length - 1) !== 217) return 'Format JPEG tidak valid. Ambil ulang.';
  } catch { return 'Format JPEG tidak valid. Ambil ulang.'; }
  const gps = e.gps;
  if (!gps || typeof gps.latitude !== 'number' || !Number.isFinite(gps.latitude) || Math.abs(gps.latitude) > 90 || typeof gps.longitude !== 'number' || !Number.isFinite(gps.longitude) || Math.abs(gps.longitude) > 180 || typeof gps.accuracy !== 'number' || !Number.isFinite(gps.accuracy) || gps.accuracy <= 0 || gps.accuracy > CAMERA_MAX_ACCURACY_METERS) return 'GPS belum akurat. Ambil foto ulang di tempat terbuka.';
  if (typeof e.capturedAt !== 'string' || typeof e.gpsCapturedAt !== 'string') return 'Waktu foto dan GPS belum tersedia.';
  const captured = Date.parse(e.capturedAt), located = Date.parse(e.gpsCapturedAt);
  if (!Number.isFinite(captured) || !Number.isFinite(located) || Math.abs(captured - located) > 30_000 || captured > now + 60_000 || located > now + 60_000 || now - captured > CAMERA_MAX_AGE_MS) return 'Waktu foto atau GPS tidak valid/kedaluwarsa. Ambil foto ulang.';
  return null;
}
