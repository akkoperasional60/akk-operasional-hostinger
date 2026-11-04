import React from 'react';

export interface ExifTimestampMetadata {
  /** Waktu dan tanggal persis saat rana kamera memotret objek (YYYY:MM:DD HH:MM:SS) */
  DateTimeOriginal: string;
  /** Waktu saat gambar dikonversi menjadi data digital (YYYY:MM:DD HH:MM:SS) */
  DateTimeDigitized: string;
  /** Penanda zona waktu (misalnya +07:00 untuk WIB) */
  OffsetTimeOriginal: string;
  /** Alias penanda zona waktu (OffsetTime) */
  OffsetTime: string;
  /** Milidetik untuk akurasi tinggi (misalnya "482") */
  SubSecTimeOriginal: string;
  /** Sumber tag EXIF: 'EXIF_BINARY' jika dibaca langsung dari header file JPEG, atau 'CAMERA_CAPTURE_SENSOR' */
  source?: 'EXIF_BINARY' | 'CAMERA_CAPTURE_SENSOR';
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad3 = (n: number) => String(n).padStart(3, '0');

export function formatExifDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}:${mm}:${dd} ${hh}:${min}:${ss}`;
}

export function getLocalOffsetTime(date: Date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hours = pad2(Math.floor(absMins / 60));
  const mins = pad2(absMins % 60);
  return `${sign}${hours}:${mins}`;
}

export function createExifMetadataFromDate(
  date: Date = new Date(),
  source: 'EXIF_BINARY' | 'CAMERA_CAPTURE_SENSOR' = 'CAMERA_CAPTURE_SENSOR'
): ExifTimestampMetadata {
  const dt = formatExifDateTime(date);
  const offset = getLocalOffsetTime(date);
  const subSec = pad3(date.getMilliseconds());
  return {
    DateTimeOriginal: dt,
    DateTimeDigitized: dt,
    OffsetTimeOriginal: offset,
    OffsetTime: offset,
    SubSecTimeOriginal: subSec,
    source,
  };
}

/**
 * Membaca tag EXIF asli dari binary ArrayBuffer JPEG (APP1 0xFFE1 Exif header)
 * Tag yang dicari:
 * - 0x9003: DateTimeOriginal
 * - 0x9004: DateTimeDigitized
 * - 0x9010: OffsetTime
 * - 0x9011: OffsetTimeOriginal
 * - 0x9291: SubSecTimeOriginal
 * - 0x0132: DateTime (fallback)
 */
function parseExifTagsFromArrayBuffer(buffer: ArrayBuffer): Partial<ExifTimestampMetadata> | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return null;
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset + 4 < length) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) break; // SOS or EOI

      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2 || offset + 2 + segmentLength > length) break;

      // APP1 marker (0xFFE1) with "Exif\0\0"
      if (
        marker === 0xe1 &&
        segmentLength >= 10 &&
        view.getUint32(offset + 4, false) === 0x45786966 && // "Exif"
        view.getUint16(offset + 8, false) === 0x0000
      ) {
        const tiffStart = offset + 10;
        const byteOrder = view.getUint16(tiffStart, false);
        const littleEndian = byteOrder === 0x4949;
        if (!littleEndian && byteOrder !== 0x4d4d) return null;

        if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return null;
        const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
        if (firstIfdOffset < 8) return null;

        const readAscii = (strOffset: number, count: number): string => {
          let out = '';
          const maxLen = Math.min(count, length - strOffset);
          for (let i = 0; i < maxLen; i++) {
            const c = view.getUint8(strOffset + i);
            if (c === 0) break;
            out += String.fromCharCode(c);
          }
          return out.trim();
        };

        const readIfd = (ifdRelOffset: number): Record<number, string | number> => {
          const result: Record<number, string | number> = {};
          const dirStart = tiffStart + ifdRelOffset;
          if (dirStart + 2 > length) return result;
          const numEntries = view.getUint16(dirStart, littleEndian);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = dirStart + 2 + i * 12;
            if (entryOffset + 12 > length) break;
            const tag = view.getUint16(entryOffset, littleEndian);
            const type = view.getUint16(entryOffset + 2, littleEndian);
            const count = view.getUint32(entryOffset + 4, littleEndian);
            const valueOffset = entryOffset + 8;

            // ASCII string (type === 2)
            if (type === 2) {
              if (count <= 4) {
                result[tag] = readAscii(valueOffset, count);
              } else {
                const strRelOffset = view.getUint32(valueOffset, littleEndian);
                if (tiffStart + strRelOffset < length) {
                  result[tag] = readAscii(tiffStart + strRelOffset, count);
                }
              }
            } else if (type === 4 && count === 1) {
              // LONG (used for ExifIFDPointer 0x8769)
              result[tag] = view.getUint32(valueOffset, littleEndian);
            }
          }
          return result;
        };

        const ifd0 = readIfd(firstIfdOffset);
        const exifIfdPointer = typeof ifd0[0x8769] === 'number' ? (ifd0[0x8769] as number) : null;
        const exifIfd = exifIfdPointer ? readIfd(exifIfdPointer) : {};

        const dtOriginal =
          (exifIfd[0x9003] as string) || (ifd0[0x0132] as string) || '';
        const dtDigitized =
          (exifIfd[0x9004] as string) || dtOriginal || '';
        const offsetOriginal =
          (exifIfd[0x9011] as string) || (exifIfd[0x9010] as string) || '';
        const offsetTime =
          (exifIfd[0x9010] as string) || offsetOriginal || '';
        const subSecOriginal =
          (exifIfd[0x9291] as string) || (exifIfd[0x9290] as string) || '';

        if (dtOriginal || dtDigitized) {
          return {
            DateTimeOriginal: dtOriginal || dtDigitized,
            DateTimeDigitized: dtDigitized || dtOriginal,
            OffsetTimeOriginal: offsetOriginal,
            OffsetTime: offsetTime,
            SubSecTimeOriginal: subSecOriginal,
            source: 'EXIF_BINARY',
          };
        }
      }

      offset += 2 + segmentLength;
    }
  } catch {
    // Ignore binary parse errors and use fallback
  }
  return null;
}

export async function extractExifFromFile(file: File): Promise<ExifTimestampMetadata> {
  const fallbackDate = file.lastModified ? new Date(file.lastModified) : new Date();
  const base = createExifMetadataFromDate(fallbackDate, 'CAMERA_CAPTURE_SENSOR');
  try {
    const buffer = await file.slice(0, 131072).arrayBuffer();
    const parsed = parseExifTagsFromArrayBuffer(buffer);
    if (parsed && parsed.DateTimeOriginal) {
      return {
        DateTimeOriginal: parsed.DateTimeOriginal,
        DateTimeDigitized: parsed.DateTimeDigitized || parsed.DateTimeOriginal,
        OffsetTimeOriginal: parsed.OffsetTimeOriginal || base.OffsetTimeOriginal,
        OffsetTime: parsed.OffsetTime || parsed.OffsetTimeOriginal || base.OffsetTime,
        SubSecTimeOriginal: parsed.SubSecTimeOriginal || base.SubSecTimeOriginal,
        source: 'EXIF_BINARY',
      };
    }
  } catch {
    // Fallback to file timestamp
  }
  return base;
}

/**
 * Menggambar watermark EXIF Timestamp Metadata di bagian atas/bawah canvas foto
 */
export function drawExifMetadataOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  exif: ExifTimestampMetadata
) {
  const pad = Math.max(10, Math.round(width * 0.018));
  const fontSize = Math.max(10, Math.round(width * 0.017));
  const bannerHeight = fontSize * 3.1 + pad * 1.1;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(0, 0, width, bannerHeight);

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, bannerHeight);
  ctx.lineTo(width, bannerHeight);
  ctx.stroke();

  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'left';
  ctx.fillText(
    `EXIF TAG METADATA • DateTimeOriginal: ${exif.DateTimeOriginal}.${exif.SubSecTimeOriginal} (${exif.OffsetTimeOriginal})`,
    pad,
    pad + fontSize * 0.9
  );

  ctx.font = `${Math.max(9, Math.round(fontSize * 0.92))}px monospace`;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(
    `DateTimeDigitized: ${exif.DateTimeDigitized} | OffsetTime: ${exif.OffsetTime} | SubSecTimeOriginal: .${exif.SubSecTimeOriginal}s`,
    pad,
    pad + fontSize * 2.1
  );
  ctx.restore();
}

export const ExifMetadataBadge: React.FC<{
  exif?: ExifTimestampMetadata | null;
  compact?: boolean;
  className?: string;
}> = ({ exif, compact = false, className = '' }) => {
  const data = exif || createExifMetadataFromDate();

  if (compact) {
    return (
      <div
        className={`rounded-lg bg-slate-950/90 border border-emerald-500/30 px-2.5 py-1.5 text-[10px] font-mono text-slate-200 leading-tight shadow-xs ${className}`}
      >
        <div className="flex items-center justify-between gap-1.5 text-emerald-400 font-bold mb-0.5">
          <span>EXIF TIMESTAMP METADATA</span>
          <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-[9px] text-emerald-300">
            {data.OffsetTimeOriginal}
          </span>
        </div>
        <div className="truncate">
          <span className="text-slate-400">DateTimeOriginal: </span>
          <span className="text-white font-semibold">{data.DateTimeOriginal}</span>
          <span className="text-amber-300">.{data.SubSecTimeOriginal}</span>
        </div>
        <div className="truncate text-[9px] text-slate-300">
          <span className="text-slate-400">DateTimeDigitized: </span>
          <span>{data.DateTimeDigitized}</span>
          <span className="text-slate-400"> • Offset: </span>
          <span className="text-cyan-300">{data.OffsetTime}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-slate-900 border border-slate-700/80 p-2.5 text-[11px] font-mono text-slate-200 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800">
        <span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          EXIF Tag Metadata Kunci (Tanggal & Waktu)
        </span>
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-300">
          {data.source === 'EXIF_BINARY' ? 'EXIF ASLI FILE' : 'EXIF SENSOR KAMERA'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
        <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800">
          <span className="text-slate-400 block text-[9px]">DateTimeOriginal (Waktu Rana):</span>
          <span className="text-white font-bold">{data.DateTimeOriginal}</span>
        </div>
        <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800">
          <span className="text-slate-400 block text-[9px]">DateTimeDigitized (Konversi Digital):</span>
          <span className="text-white font-bold">{data.DateTimeDigitized}</span>
        </div>
        <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800">
          <span className="text-slate-400 block text-[9px]">OffsetTimeOriginal / OffsetTime (Zona):</span>
          <span className="text-cyan-300 font-bold">
            {data.OffsetTimeOriginal} (WIB/Lokal)
          </span>
        </div>
        <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800">
          <span className="text-slate-400 block text-[9px]">SubSecTimeOriginal (Milidetik):</span>
          <span className="text-amber-300 font-bold">
            .{data.SubSecTimeOriginal} ms ({data.DateTimeOriginal}.{data.SubSecTimeOriginal})
          </span>
        </div>
      </div>
    </div>
  );
};
