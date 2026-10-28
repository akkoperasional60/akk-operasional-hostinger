/**
 * Standard Area Normalizer & Harmonizer
 * Menyelaraskan nama area dari Google Sheet (Sheet ALL)
 * agar 100% identik dengan 33 opsi resmi pada Pembuatan Jadwal Pengiriman.
 */

export const OFFICIAL_DESTINATION_AREAS = [
  'Denpasar 1',
  'Denpasar 2',
  'Situbondo',
  'Bondowoso',
  'Susulan Genteng Rogojampi',
  'Muncar Pasar',
  'Muncar Pinggir',
  'Grosir Banyuwangi Rogojampi',
  'Jember Selatan',
  'Singaraja',
  'Sumberayu Retail',
  'Susulan Sanggar Jajag',
  'Rogojampi Retail',
  'Genteng Retail',
  'Grosir Genteng Gendoh',
  'Songgon Retail',
  'BWI Kota Selatan',
  'Susulan Situbondo Bondowoso',
  'Jember Barat',
  'Galekan Retail',
  'Ketapang Wongsorejo',
  'Grosir Srono Sumberayu Muncar',
  'Kalibaru Retail',
  'Sempu Stail',
  'Sanggar Retail',
  'Susulan Rogojampi Muncar',
  'Negara',
  'Purwo Pasar',
  'Purwo Dambuntung',
  'Grosir Jajag Sanggar Purwo',
  'Jajag Retail',
  'Srono Retail',
  'Jember Kota',
  'Toko DR. Soetomo',
  'Nusantara Expand',
  'Titipan Kota Kota',
  'Kanvas LKT'
] as const;

export type OfficialDestinationArea = typeof OFFICIAL_DESTINATION_AREAS[number];

export const STANDARD_AREAS = OFFICIAL_DESTINATION_AREAS;
export type StandardAreaName = typeof STANDARD_AREAS[number];

export const AREA_CODE_MAP: Record<string, StandardAreaName> = {
  'DENPASAR1': 'Denpasar 1',
  'DENPASAR_1': 'Denpasar 1',
  'DENPASAR2': 'Denpasar 2',
  'DENPASAR_2': 'Denpasar 2',
  'SITUBONDO': 'Situbondo',
  'BONDOWOSO': 'Bondowoso',
  'SUSULAN_GENTENG_ROGOJAMPI': 'Susulan Genteng Rogojampi',
  'MUNCAR_PASAR': 'Muncar Pasar',
  'MUNCAR_PINGGIR': 'Muncar Pinggir',
  'GROSIR_BANYUWANGI_ROGOJAMPI': 'Grosir Banyuwangi Rogojampi',
  'JEMBER_SELATAN': 'Jember Selatan',
  'SINGARAJA': 'Singaraja',
  'SSLN_SINGARAJA': 'Singaraja',
  'SUMBERAYU_RETAIL': 'Sumberayu Retail',
  'SUSULAN_SANGGAR_JAJAG': 'Susulan Sanggar Jajag',
  'ROGOJAMPI_RETAIL': 'Rogojampi Retail',
  'RITEL_ROGOJAMPI': 'Rogojampi Retail',
  'GENTENG_RETAIL': 'Genteng Retail',
  'GROSIR_GENTENG_GENDOH': 'Grosir Genteng Gendoh',
  'SONGGON_RETAIL': 'Songgon Retail',
  'RITEL_SONGGON': 'Songgon Retail',
  'BWI_KOTA_SELATAN': 'BWI Kota Selatan',
  'SUSULAN_SITUBONDO_BONDOWOSO': 'Susulan Situbondo Bondowoso',
  'SSLN_STB_BDWS': 'Susulan Situbondo Bondowoso',
  'JEMBER_BARAT': 'Jember Barat',
  'GALEKAN_RETAIL': 'Galekan Retail',
  'GALEKAN': 'Galekan Retail',
  'KETAPANG_WONGSOREJO': 'Ketapang Wongsorejo',
  'GROSIR_SRONO_SUMBERAYU_MUNCAR': 'Grosir Srono Sumberayu Muncar',
  'KALIBARU_RETAIL': 'Kalibaru Retail',
  'RITEL_KALIBARU': 'Kalibaru Retail',
  'SEMPU_STAIL': 'Sempu Stail',
  'SEMPU_KALISTAIL': 'Sempu Stail',
  'SANGGAR_RETAIL': 'Sanggar Retail',
  'RITEL_SANGGAR': 'Sanggar Retail',
  'SUSULAN_ROGOJAMPI_MUNCAR': 'Susulan Rogojampi Muncar',
  'NEGARA': 'Negara',
  'PURWO_PASAR': 'Purwo Pasar',
  'PURWO_DAMBUNTUNG': 'Purwo Dambuntung',
  'GROSIR_JAJAG_SANGGAR_PURWO': 'Grosir Jajag Sanggar Purwo',
  'JAJAG_RETAIL': 'Jajag Retail',
  'SRONO_RETAIL': 'Srono Retail',
  'RITEL_SRONO': 'Srono Retail',
  'JEMBER_KOTA': 'Jember Kota',
  'GROSIR1': 'Grosir Banyuwangi Rogojampi',
  'TOKO_DR_SOETOMO': 'Toko DR. Soetomo',
  'DR_SOETOMO': 'Toko DR. Soetomo',
  'NUSANTARA_EXPAND': 'Nusantara Expand',
  'TITIPAN_KOTA_KOTA': 'Titipan Kota Kota',
  'KANVAS_LKT': 'Kanvas LKT',
  'KANVAS LKT': 'Kanvas LKT',
  'KANVAS': 'Kanvas LKT',
  'LKT': 'Kanvas LKT'
};

/**
 * Normalisasi otomatis nama area variatif dari Google Sheets / Excel / Form
 * menjadi salah satu dari 37 nama area baku resmi.
 */
export function standardizeAreaName(rawArea: string | undefined | null): string {
  if (!rawArea) return 'Rogojampi Retail';
  const clean = rawArea.trim().toUpperCase();

  // 1. Direct case-insensitive match dengan salah satu dari official areas
  const exactMatch = OFFICIAL_DESTINATION_AREAS.find(a => a.toUpperCase() === clean);
  if (exactMatch) return exactMatch;

  // 1a. Kanvas LKT
  if (clean.includes('KANVAS LKT') || clean.includes('KANVAS_LKT') || clean.includes('KANVAS LUAR KOTA') || clean === 'KANVAS' || clean === 'LKT') {
    return 'Kanvas LKT';
  }

  // 1b. Toko DR. Soetomo, Nusantara Expand, Titipan Kota Kota
  if (clean.includes('SOETOMO') || clean.includes('SUTOMO')) {
    return 'Toko DR. Soetomo';
  }
  if (clean.includes('NUSANTARA')) {
    return 'Nusantara Expand';
  }
  if (clean.includes('TITIPAN')) {
    return 'Titipan Kota Kota';
  }

  // 2. Denpasar 1 & Denpasar 2
  if (clean === 'DENPASAR 1' || clean === 'DENPASAR1' || clean === 'DPS1' || clean === 'DENPASAR 1 & 2' || clean === 'DENPASAR 1/2') {
    return 'Denpasar 1';
  }
  if (clean === 'DENPASAR 2' || clean === 'DENPASAR2' || clean === 'DPS2') {
    return 'Denpasar 2';
  }
  if (clean === 'DENPASAR' || clean === 'DPS') {
    return 'Denpasar 1';
  }

  // 3. Susulan Situbondo Bondowoso vs Situbondo vs Bondowoso
  if (clean.includes('SUSULAN SITUBONDO') || clean.includes('SSLN STB') || clean.includes('SITUBONDO BONDOWOSO') || clean.includes('STB BDWS')) {
    return 'Susulan Situbondo Bondowoso';
  }
  if (clean === 'SITUBONDO' || clean.includes('STBD') || clean === 'STB') {
    return 'Situbondo';
  }
  if (clean === 'BONDOWOSO' || clean === 'BDWS') {
    return 'Bondowoso';
  }

  // 4. Susulan Genteng Rogojampi vs Susulan Rogojampi Muncar
  if (clean.includes('GENTENG ROGOJAMPI') || clean.includes('GTG ROGOJAMPI') || clean.includes('SUSULAN GENTENG')) {
    return 'Susulan Genteng Rogojampi';
  }
  if (clean.includes('ROGOJAMPI MUNCAR') || clean.includes('ROGOJAMPI-MUNCAR') || clean.includes('SUSULAN ROGOJAMPI')) {
    return 'Susulan Rogojampi Muncar';
  }

  // 5. Muncar Pasar vs Muncar Pinggir
  if (clean.includes('MUNCAR') && clean.includes('PASAR')) {
    return 'Muncar Pasar';
  }
  if (clean.includes('MUNCAR') && (clean.includes('PINGGIR') || clean.includes('PGIR'))) {
    return 'Muncar Pinggir';
  }

  // 6. Grosir Banyuwangi Rogojampi, Grosir Genteng Gendoh, Grosir Srono Sumberayu Muncar, Grosir Jajag Sanggar Purwo
  if (clean.includes('GROSIR') && clean.includes('BANYUWANGI')) {
    return 'Grosir Banyuwangi Rogojampi';
  }
  if (clean.includes('GROSIR') && (clean.includes('GENDOH') || clean.includes('GENTENG'))) {
    return 'Grosir Genteng Gendoh';
  }
  if (clean.includes('GROSIR') && (clean.includes('SRONO') || clean.includes('SUMBERAYU'))) {
    return 'Grosir Srono Sumberayu Muncar';
  }
  if (clean.includes('GROSIR') && (clean.includes('JAJAG') || clean.includes('SANGGAR') || clean.includes('PURWO'))) {
    return 'Grosir Jajag Sanggar Purwo';
  }
  if (clean === 'GROSIR 1' || clean === 'GROSIR1') {
    return 'Grosir Banyuwangi Rogojampi';
  }

  // 7. Jember Selatan, Jember Barat, Jember Kota
  if (clean.includes('JEMBER') && clean.includes('SELATAN')) {
    return 'Jember Selatan';
  }
  if (clean.includes('JEMBER') && (clean.includes('BARAT') || clean.includes('PINGGIR'))) {
    return 'Jember Barat';
  }
  if (clean.includes('JEMBER')) {
    return 'Jember Kota';
  }

  // 8. Singaraja & Negara
  if (clean.includes('SINGARAJA')) {
    return 'Singaraja';
  }
  if (clean.includes('NEGARA')) {
    return 'Negara';
  }

  // 9. Sumberayu Retail
  if (clean.includes('SUMBERAYU') || clean.includes('SUMBER AYU')) {
    return 'Sumberayu Retail';
  }

  // 10. Susulan Sanggar Jajag vs Sanggar Retail
  if (clean.includes('SUSULAN SANGGAR') || clean.includes('SANGGAR JAJAG') || clean.includes('SANGGAR-JAJAG')) {
    return 'Susulan Sanggar Jajag';
  }
  if (clean.includes('SANGGAR')) {
    return 'Sanggar Retail';
  }

  // 11. Rogojampi Retail
  if (clean.includes('ROGOJAMPI')) {
    return 'Rogojampi Retail';
  }

  // 12. Genteng Retail
  if (clean.includes('GENTENG')) {
    return 'Genteng Retail';
  }

  // 13. Songgon Retail
  if (clean.includes('SONGGON')) {
    return 'Songgon Retail';
  }

  // 14. BWI Kota Selatan
  if (clean.includes('BWI KOTA') || clean.includes('BANYUWANGI KOTA') || clean.includes('BWI KOTA SELATAN')) {
    return 'BWI Kota Selatan';
  }

  // 15. Galekan Retail
  if (clean.includes('GALEKAN')) {
    return 'Galekan Retail';
  }

  // 16. Ketapang Wongsorejo
  if (clean.includes('KETAPANG') || clean.includes('WONGSOREJO')) {
    return 'Ketapang Wongsorejo';
  }

  // 17. Kalibaru Retail
  if (clean.includes('KALIBARU')) {
    return 'Kalibaru Retail';
  }

  // 18. Sempu Stail
  if (clean.includes('SEMPU') || clean.includes('STAIL') || clean.includes('KALISTAIL') || clean.includes('XSTAIL')) {
    return 'Sempu Stail';
  }

  // 19. Purwo Pasar & Purwo Dambuntung
  if (clean.includes('DAMBUNTUNG')) {
    return 'Purwo Dambuntung';
  }
  if (clean.includes('PURWO') && clean.includes('PASAR')) {
    return 'Purwo Pasar';
  }
  if (clean.includes('PURWO')) {
    return 'Purwo Pasar';
  }

  // 20. Jajag Retail
  if (clean.includes('JAJAG')) {
    return 'Jajag Retail';
  }

  // 21. Srono Retail
  if (clean.includes('SRONO')) {
    return 'Srono Retail';
  }

  // Fallback: search closest in OFFICIAL_DESTINATION_AREAS
  for (const official of OFFICIAL_DESTINATION_AREAS) {
    if (clean.includes(official.toUpperCase()) || official.toUpperCase().includes(clean)) {
      return official;
    }
  }

  return rawArea.trim();
}

/**
 * Mendapatkan sub-detail asli untuk tampilan badge informatif opsional.
 */
export function getAreaSubDetail(rawArea: string | undefined | null): string | null {
  if (!rawArea) return null;
  const upper = rawArea.trim().toUpperCase();

  if (upper.includes('DAMBUNTUNG')) return 'Dambuntung';
  if (upper.includes('PASAR') && upper.includes('PURWO')) return 'Pasar';
  if (upper.includes('PAGI') && upper.includes('SITUBONDO')) return 'Pagi';
  if (upper.includes('GENTENG') && upper.includes('ROGOJAMPI')) return 'Genteng - Rogojampi';

  return null;
}
