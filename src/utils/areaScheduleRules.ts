/**
 * PT ANUGRAH KEMASAN KREATIF (AKK) - STANDAR OPERASIONAL JADWAL KEBERANGKATAN & KEPULANGAN ARMADA
 * ==============================================================================================
 * Mengatur jam baku keberangkatan dari DC Banyuwangi dan jam estimasi kepulangan (return) armada:
 * 1. Denpasar: Berangkat hari ini / nanti malam 21.00 WIB & kepulangan besok jam 17.30 WIB
 * 2. Singaraja: Berangkat hari ini / nanti malam 21.00 WIB & kepulangan besok jam 17.30 WIB
 * 3. Negara: Berangkat 07.15 WIB & kepulangan 18.00 WIB
 * 4. Situbondo: Berangkat 07.15 WIB & kepulangan 16.30 WIB
 * 5. Bondowoso: Berangkat hari ini / nanti malam 21.00 WIB & kepulangan 17.30 WIB (besok)
 * 6. Ssln STB BDWS: Berangkat 07.30 WIB & kepulangan 16.30 WIB
 * 7. Seluruh area Jember (Jember Selatan, Jember Barat, Jember Kota): Berangkat hari ini / nanti malam 21.00 WIB & kepulangan besok 16.00 WIB
 * 8. Selain area di atas (seperti Jajag Retail dsb.): Keberangkatan jam 07.30 WIB & kepulangan 16.00 WIB
 */

export type AreaCategoryKey = 
  | 'denpasar' 
  | 'singaraja' 
  | 'negara' 
  | 'situbondo' 
  | 'bondowoso' 
  | 'ssln_stb_bdws' 
  | 'jember' 
  | 'kanvas_lkt'
  | 'lainnya';

export interface AreaScheduleTiming {
  key: AreaCategoryKey;
  areaGroupTitle: string;
  departureHour: number;
  departureMinute: number;
  returnHour: number;
  returnMinute: number;
  departureLabel: string;
  returnLabel: string;
  isNightDeparture: boolean;
  isNextDayReturn: boolean;
  description: string;
  badgeLabel: string;
}

export const AREA_TIMING_RULES: Record<AreaCategoryKey, AreaScheduleTiming> = {
  denpasar: {
    key: 'denpasar',
    areaGroupTitle: 'Denpasar (Bali Selatan / Hub)',
    departureHour: 21,
    departureMinute: 0,
    returnHour: 17,
    returnMinute: 30,
    departureLabel: '21.00 WIB',
    returnLabel: '17.30 WIB',
    isNightDeparture: true,
    isNextDayReturn: true,
    description: 'Berangkat hari ini 21.00 WIB & kepulangan besok jam 17.30 WIB',
    badgeLabel: '🌙 Berangkat Nanti Malam (21.00 WIB) · Pulang Besok 17.30 WIB'
  },
  singaraja: {
    key: 'singaraja',
    areaGroupTitle: 'Singaraja (Bali Utara)',
    departureHour: 21,
    departureMinute: 0,
    returnHour: 17,
    returnMinute: 30,
    departureLabel: '21.00 WIB',
    returnLabel: '17.30 WIB',
    isNightDeparture: true,
    isNextDayReturn: true,
    description: 'Berangkat hari ini 21.00 WIB & kepulangan besok jam 17.30 WIB',
    badgeLabel: '🌙 Berangkat Nanti Malam (21.00 WIB) · Pulang Besok 17.30 WIB'
  },
  negara: {
    key: 'negara',
    areaGroupTitle: 'Negara (Bali Barat)',
    departureHour: 7,
    departureMinute: 15,
    returnHour: 18,
    returnMinute: 0,
    departureLabel: '07.15 WIB',
    returnLabel: '18.00 WIB',
    isNightDeparture: false,
    isNextDayReturn: false,
    description: 'Berangkat 07.15 WIB & kepulangan 18.00 WIB',
    badgeLabel: '☀️ Berangkat Pagi (07.15 WIB) · Pulang Hari Ini 18.00 WIB'
  },
  situbondo: {
    key: 'situbondo',
    areaGroupTitle: 'Situbondo (Pantura Reguler)',
    departureHour: 7,
    departureMinute: 15,
    returnHour: 16,
    returnMinute: 30,
    departureLabel: '07.15 WIB',
    returnLabel: '16.30 WIB',
    isNightDeparture: false,
    isNextDayReturn: false,
    description: 'Berangkat 07.15 WIB & kepulangan 16.30 WIB',
    badgeLabel: '☀️ Berangkat Pagi (07.15 WIB) · Pulang Hari Ini 16.30 WIB'
  },
  bondowoso: {
    key: 'bondowoso',
    areaGroupTitle: 'Bondowoso (Reguler Malam)',
    departureHour: 21,
    departureMinute: 0,
    returnHour: 17,
    returnMinute: 30,
    departureLabel: '21.00 WIB',
    returnLabel: '17.30 WIB',
    isNightDeparture: true,
    isNextDayReturn: true,
    description: 'Berangkat hari ini 21.00 WIB & kepulangan besok 17.30 WIB',
    badgeLabel: '🌙 Berangkat Nanti Malam (21.00 WIB) · Pulang Besok 17.30 WIB'
  },
  ssln_stb_bdws: {
    key: 'ssln_stb_bdws',
    areaGroupTitle: 'Ssln STB BDWS (Susulan Situbondo - Bondowoso)',
    departureHour: 7,
    departureMinute: 30,
    returnHour: 16,
    returnMinute: 30,
    departureLabel: '07.30 WIB',
    returnLabel: '16.30 WIB',
    isNightDeparture: false,
    isNextDayReturn: false,
    description: 'Berangkat 07.30 WIB & kepulangan 16.30 WIB',
    badgeLabel: '☀️ Berangkat Pagi (07.30 WIB) · Pulang Hari Ini 16.30 WIB'
  },
  jember: {
    key: 'jember',
    areaGroupTitle: 'Seluruh Area Jember (Jember Selatan, Barat, Kota)',
    departureHour: 21,
    departureMinute: 0,
    returnHour: 16,
    returnMinute: 0,
    departureLabel: '21.00 WIB',
    returnLabel: '16.00 WIB',
    isNightDeparture: true,
    isNextDayReturn: true,
    description: 'Berangkat hari ini 21.00 WIB & kepulangan besok 16.00 WIB',
    badgeLabel: '🌙 Berangkat Nanti Malam (21.00 WIB) · Pulang Besok 16.00 WIB'
  },
  kanvas_lkt: {
    key: 'kanvas_lkt',
    areaGroupTitle: 'Kanvas LKT (Luar Kota)',
    departureHour: 7,
    departureMinute: 15,
    returnHour: 17,
    returnMinute: 30,
    departureLabel: '07.15 WIB',
    returnLabel: '17.30 WIB',
    isNightDeparture: false,
    isNextDayReturn: false,
    description: 'Jadwal Kanvas LKT — Berangkat 07.15 WIB & kepulangan 17.30 WIB',
    badgeLabel: '🚚 Kanvas LKT · Berangkat 07.15 WIB · Pulang 17.30 WIB'
  },
  lainnya: {
    key: 'lainnya',
    areaGroupTitle: 'Area Lokal Banyuwangi (Jajag Retail, dsb.)',
    departureHour: 7,
    departureMinute: 30,
    returnHour: 16,
    returnMinute: 0,
    departureLabel: '07.30 WIB',
    returnLabel: '16.00 WIB',
    isNightDeparture: false,
    isNextDayReturn: false,
    description: 'Keberangkatan jam 07.30 WIB & kepulangan 16.00 WIB',
    badgeLabel: '📦 Distribusi Lokal · Berangkat 07.30 WIB · Pulang 16.00 WIB'
  }
};

/**
 * Deteksi kategori area dan timing SOP berdasarkan nama area, nama toko, atau kota
 */
export function getAreaScheduleTiming(
  areaName?: string | null,
  storeName?: string | null,
  city?: string | null
): AreaScheduleTiming {
  const combined = `${areaName || ''} ${storeName || ''} ${city || ''}`.toUpperCase().trim();

  // 1. Denpasar
  if (combined.includes('DENPASAR') || combined.includes('DPS') || (combined.includes('BALI') && !combined.includes('SINGARAJA') && !combined.includes('NEGARA'))) {
    return AREA_TIMING_RULES.denpasar;
  }

  // 2. Singaraja
  if (combined.includes('SINGARAJA') || combined.includes('BULELENG')) {
    return AREA_TIMING_RULES.singaraja;
  }

  // 3. Negara
  if (combined.includes('NEGARA') || combined.includes('JEMBRANA')) {
    return AREA_TIMING_RULES.negara;
  }

  // 6. Ssln STB BDWS (harus dicek sebelum Situbondo atau Bondowoso mandiri)
  if (
    combined.includes('SSLN STB') ||
    combined.includes('SSLN_STB') ||
    combined.includes('STB BDWS') ||
    combined.includes('STB-BDWS') ||
    (combined.includes('SUSULAN') && (combined.includes('SITUBONDO') || combined.includes('BONDOWOSO') || combined.includes('STB')))
  ) {
    return AREA_TIMING_RULES.ssln_stb_bdws;
  }

  // 4. Situbondo (Reguler)
  if (combined.includes('SITUBONDO') || combined.includes('STBD') || combined.includes('BESUKI')) {
    return AREA_TIMING_RULES.situbondo;
  }

  // 5. Bondowoso (Reguler)
  if (combined.includes('BONDOWOSO') || combined.includes('BDWS')) {
    return AREA_TIMING_RULES.bondowoso;
  }

  // 7. Seluruh area Jember (Jember Selatan, Jember Barat, Jember Kota)
  if (combined.includes('JEMBER')) {
    return AREA_TIMING_RULES.jember;
  }

  // 7b. Kanvas LKT
  if (combined.includes('KANVAS LKT') || combined.includes('KANVAS_LKT') || combined.includes('KANVAS')) {
    return AREA_TIMING_RULES.kanvas_lkt;
  }

  // 8. Selain area di atas (Jajag Retail, Genteng, Rogojampi, Songgon, Srono, Sanggar, Muncar, Sempu, dsb.)
  return AREA_TIMING_RULES.lainnya;
}

/**
 * Menghitung tanggal & jam ISO lengkap untuk Berangkat dan Pulang
 * sesuai aturan SOP PT AKK
 */
export function calculateScheduleTimestamps(
  baseDate: Date,
  areaName?: string | null,
  storeName?: string | null,
  city?: string | null
): {
  departureDate: string; // ISO string 'YYYY-MM-DDTHH:mm'
  estimatedArrival: string; // ISO string 'YYYY-MM-DDTHH:mm'
  timing: AreaScheduleTiming;
} {
  const timing = getAreaScheduleTiming(areaName, storeName, city);

  const dep = new Date(baseDate);
  dep.setHours(timing.departureHour, timing.departureMinute, 0, 0);

  const arr = new Date(dep);
  if (timing.isNextDayReturn) {
    arr.setDate(arr.getDate() + 1);
  }
  arr.setHours(timing.returnHour, timing.returnMinute, 0, 0);

  return {
    departureDate: dep.toISOString().substring(0, 16),
    estimatedArrival: arr.toISOString().substring(0, 16),
    timing
  };
}

/**
 * Format label keberangkatan untuk portal driver
 * Contoh: Jika Denpasar & besok ada jadwal, menampilkan "Berangkat Nanti Malam (21.00 WIB)"
 */
export function getDriverPortalDepartureLabel(
  departureDateStr?: string | null,
  areaName?: string | null,
  storeName?: string | null,
  estimatedArrivalStr?: string | null,
  deliveryWindowStr?: string | null
): {
  badgeTitle: string;
  departureText: string;
  returnText: string;
  isNightRun: boolean;
  isTomorrowRun: boolean;
  timing: AreaScheduleTiming;
} {
  const baseTiming = getAreaScheduleTiming(areaName, storeName);
  let timing: AreaScheduleTiming = { ...baseTiming };

  // Ekstrak Jam Keberangkatan & Target Jam Kepulangan langsung dari jadwal jika tersedia
  let customDepHHMM = '';
  let customRetHHMM = '';

  if (deliveryWindowStr && typeof deliveryWindowStr === 'string') {
    const winMatch = deliveryWindowStr.match(/(\d{2}[:.]\d{2})\s*-\s*(\d{2}[:.]\d{2})/);
    if (winMatch && deliveryWindowStr.trim() !== '08:00 - 17:00') {
      customDepHHMM = winMatch[1].replace('.', ':');
      customRetHHMM = winMatch[2].replace('.', ':');
    }
  }

  if (!customDepHHMM && departureDateStr && typeof departureDateStr === 'string') {
    const depMatch = departureDateStr.match(/T(\d{2}:\d{2})/);
    if (depMatch) {
      customDepHHMM = depMatch[1];
    }
  }

  if (!customRetHHMM && estimatedArrivalStr && typeof estimatedArrivalStr === 'string') {
    const arrMatch = estimatedArrivalStr.match(/T(\d{2}:\d{2})/);
    if (arrMatch) {
      customRetHHMM = arrMatch[1];
    }
  }

  if (customDepHHMM) {
    const [dh, dm] = customDepHHMM.split(':').map(Number);
    if (!isNaN(dh) && !isNaN(dm)) {
      timing.departureHour = dh;
      timing.departureMinute = dm;
      timing.departureLabel = `${String(dh).padStart(2, '0')}:${String(dm).padStart(2, '0')} WIB`;
      timing.isNightDeparture = dh >= 18;
    }
  }

  if (customRetHHMM) {
    const [rh, rm] = customRetHHMM.split(':').map(Number);
    if (!isNaN(rh) && !isNaN(rm)) {
      timing.returnHour = rh;
      timing.returnMinute = rm;
      timing.returnLabel = `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')} WIB`;
    }
  }

  const now = new Date();
  const depDate = departureDateStr ? new Date(departureDateStr) : new Date();

  // Cek apakah tanggal jadwal adalah hari ini atau besok
  const isToday = 
    depDate.getFullYear() === now.getFullYear() &&
    depDate.getMonth() === now.getMonth() &&
    depDate.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = 
    depDate.getFullYear() === tomorrow.getFullYear() &&
    depDate.getMonth() === tomorrow.getMonth() &&
    depDate.getDate() === tomorrow.getDate();

  let badgeTitle = '';
  let departureText = '';
  let returnText = '';

  if (timing.isNightDeparture) {
    if (isTomorrow || isToday) {
      badgeTitle = '🌙 Berangkat Malam';
      departureText = `Berangkat: ${timing.departureLabel}`;
      returnText = `Pulang: ${timing.returnLabel}`;
    } else {
      const dayName = depDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      badgeTitle = `🌙 Berangkat Malam (${dayName})`;
      departureText = `Berangkat: ${timing.departureLabel}`;
      returnText = `Pulang: ${timing.returnLabel}`;
    }
  } else {
    if (isTomorrow) {
      badgeTitle = '☀️ Jadwal Besok';
      departureText = `Berangkat: ${timing.departureLabel}`;
      returnText = `Pulang: ${timing.returnLabel}`;
    } else if (isToday) {
      badgeTitle = '☀️ Jadwal Hari Ini';
      departureText = `Berangkat: ${timing.departureLabel}`;
      returnText = `Pulang: ${timing.returnLabel}`;
    } else {
      const dayName = depDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      badgeTitle = `☀️ Jadwal Kirim (${dayName})`;
      departureText = `Berangkat: ${timing.departureLabel}`;
      returnText = `Pulang: ${timing.returnLabel}`;
    }
  }

  return {
    badgeTitle,
    departureText,
    returnText,
    isNightRun: timing.isNightDeparture,
    isTomorrowRun: isTomorrow,
    timing
  };
}
