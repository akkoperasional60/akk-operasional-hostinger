import {
  DriverVehicleChecklist,
  VehicleChecklistItem,
  OverallChecklistStatus
} from '../types';

const STORAGE_KEY = 'akk_driver_vehicle_checklists_v2';

export const STANDARD_CHECKLIST_ITEMS: Omit<VehicleChecklistItem, 'id' | 'status' | 'note' | 'photoUrl'>[] = [
  // 1. Mesin & Fluida
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Oli Mesin & Indikator Dipstick',
    description: 'Volume oli berada di antara batas MIN dan MAX, tidak ada perubahan warna pekat terbakar'
  },
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Air Radiator (Coolant) & Reservoir',
    description: 'Level tabung cadangan air radiator cukup dan tutup radiator terpasang rapat'
  },
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Minyak Rem & Minyak Kopling',
    description: 'Ketinggian minyak rem pada tangki cadangan aman, tidak ada kebocoran master silinder'
  },
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Air Wiper Washer & Nozzle',
    description: 'Cairan wiper terisi penuh dan semprotan nozzle kaca depan bekerja lancar'
  },
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Pemeriksaan Kolong Mesin (Kebocoran)',
    description: 'Tidak ada tetesan oli, solar, atau air pendingin di bawah kolong mesin/transmisi'
  },

  // 2. Rem, Roda & Kaki-kaki
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Rem Kaki (Pedal Rem Utama)',
    description: 'Pedal rem padat dan tidak ambles saat ditekan, respons pengereman pakem'
  },
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Rem Parkir / Handbrake',
    description: 'Mampu menahan kendaraan pada kemiringan dan tuas mengunci dengan presisi'
  },
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Tekanan & Kondisi Ban Depan',
    description: 'Tekanan ban sesuai standar (60-70 PSI), alur kembang ban tidak gundul, tanpa robek samping'
  },
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Tekanan & Kondisi Ban Belakang / Gandar',
    description: 'Tekanan ban belakang ganda (75-85 PSI), baut roda kencang lengkap, sela ban bersih dari batu'
  },
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda (Kaki-Kaki)',
    name: 'Ban Serep & Tekanan Udara',
    description: 'Ban cadangan terpasang kuat pada bracket pengunci dan memiliki tekanan udara siap pakai'
  },

  // 3. Lampu & Kelistrikan
  {
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Lampu Utama (Dekat & Jauh)',
    description: 'Headlamp menyala terang di kedua sisi, sorot lampu fokus, kaca headlamp tidak pecah'
  },
  {
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Lampu Sein (L/R) & Hazard',
    description: 'Lampu sein depan, samping, belakang berkedip normal; hazard darurat berfungsi serentak'
  },
  {
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Lampu Rem & Lampu Mundur',
    description: 'Lampu rem menyala merah terang saat diinjak, lampu mundur putih & sirine buzzer aktif'
  },
  {
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Klakson & Karet Wiper Depan',
    description: 'Klakson bersuara lantang, bilah wiper fleksibel dan menyeka kaca depan dengan bersih'
  },
  {
    category: 'lampu_listrik',
    categoryLabel: 'Lampu & Sistem Kelistrikan',
    name: 'Baterai / Aki & Indikator Dashboard',
    description: 'Terminal aki bersih kencang, alternator mengisi normal, tidak ada check-engine menyala'
  },

  // 4. Fisik, Bodi & Legalitas Dokumen
  {
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'STNK Asli & Masa Pajak Aktif',
    description: 'STNK asli berada di dashboard dan masa berlaku pajak tahunan / 5 tahunan masih aktif'
  },
  {
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'Buku Uji KIR Dishub Aktif',
    description: 'Buku uji berkala KIR Dishub valid, stempel tanggal uji berikutnya belum terlewat'
  },
  {
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'Kaca Spion & Kaca Depan',
    description: 'Spion kiri-kanan-dalam kokoh dan bersih dari debu/retak, visibilitas pandangan jelas'
  },
  {
    category: 'fisik_dokumen',
    categoryLabel: 'Fisik Kendaraan & Dokumen Jalan',
    name: 'Pintu Boks & Engsel Pengunci',
    description: 'Engsel dan tuas kunci pintu boks belakang rapat, karet penutup kedap air dan tidak bocor'
  },

  // 5. Keselamatan K3 & Perlengkapan Darurat
  {
    category: 'darurat_k3',
    categoryLabel: 'Perlengkapan K3 & Darurat',
    name: 'APAR (Alat Pemadam Api Ringan)',
    description: 'APAR terpasang di kabin, jarum manometer berada di zona hijau, segel pengaman utuh'
  },
  {
    category: 'darurat_k3',
    categoryLabel: 'Perlengkapan K3 & Darurat',
    name: 'Segitiga Pengaman & Kotak P3K',
    description: 'Minimal 2 unit segitiga pengaman reflektor dan kotak P3K lengkap dengan kasa & antiseptik'
  },
  {
    category: 'darurat_k3',
    categoryLabel: 'Perlengkapan K3 & Darurat',
    name: 'Dongkrak Hidrolik & Kunci Roda',
    description: 'Kapasitas dongkrak sesuai tonase armada (min 5 ton) dan kunci roda pas dengan mur'
  },
  {
    category: 'darurat_k3',
    categoryLabel: 'Perlengkapan K3 & Darurat',
    name: 'Terpal Cadangan & Tali Pengikat Muatan',
    description: 'Terpal pelindung muatan anti air utuh dan tali tambang webbing pengikat koli siap pakai'
  }
];

class DriverChecklistService {
  private generateInitialSampleChecklists(): DriverVehicleChecklist[] {
    const today = new Date().toISOString().split('T')[0];
    const items = STANDARD_CHECKLIST_ITEMS.map((item, idx) => ({
      id: `chk-item-${idx + 1}`,
      ...item,
      status: 'ok' as const,
      note: ''
    }));

    return [
      {
        id: `CHK-INIT-${Date.now()}-1`,
        driverId: 'crew-01',
        driverName: 'Ach Taufiq',
        fleetId: 'fl-01',
        plateNumber: 'P 8848 U',
        vehicleType: 'Engkel Long Box',
        date: today,
        time: '06:45',
        odometerKm: 124580,
        fuelLevelPercent: 85,
        inspectionType: 'pre_trip',
        overallStatus: 'passed',
        passedCount: items.length,
        issueCount: 0,
        items,
        notes: 'Pemeriksaan rutin pagi hari di pool DC Banyuwangi. Seluruh sistem mesin dan pengereman prima.',
        driverSignature: 'Ach Taufiq (Digital Signed)',
        checkerName: 'Rahmat Hidayat (Kepala Pool DC)',
        checkerSigned: true,
        synced: true,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ];
  }

  public getChecklists(driverId?: string, fleetId?: string): DriverVehicleChecklist[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let list: DriverVehicleChecklist[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) {
        list = [];
      }

      if (driverId) {
        list = list.filter(c => c.driverId === driverId || c.driverName.toLowerCase().includes(driverId.toLowerCase()));
      }
      if (fleetId) {
        list = list.filter(c => c.fleetId === fleetId || c.plateNumber === fleetId);
      }

      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return this.generateInitialSampleChecklists();
    }
  }

  public getLatestChecklistForDriver(driverId: string): DriverVehicleChecklist | null {
    const all = this.getChecklists(driverId);
    return all.length > 0 ? all[0] : null;
  }

  public saveChecklist(checklist: DriverVehicleChecklist): boolean {
    try {
      const all = this.getChecklists();
      const existingIdx = all.findIndex(c => c.id === checklist.id);
      if (existingIdx >= 0) {
        all[existingIdx] = checklist;
      } else {
        all.unshift(checklist);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    } catch (err) {
      console.error('Failed to save checklist:', err);
      return false;
    }
  }

  public createNewChecklistTemplate(
    driverId: string,
    driverName: string,
    fleetId: string,
    plateNumber: string,
    vehicleType: string,
    odometerKm: number = 0,
    fuelPercent: number = 80
  ): DriverVehicleChecklist {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const items: VehicleChecklistItem[] = STANDARD_CHECKLIST_ITEMS.map((item, idx) => ({
      id: `item-${Date.now()}-${idx + 1}`,
      ...item,
      status: 'ok',
      note: ''
    }));

    return {
      id: `CHK-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      driverId,
      driverName,
      fleetId,
      plateNumber,
      vehicleType,
      date: dateStr,
      time: timeStr,
      odometerKm,
      fuelLevelPercent: fuelPercent,
      inspectionType: 'pre_trip',
      overallStatus: 'passed',
      passedCount: items.length,
      issueCount: 0,
      items,
      notes: '',
      driverSignature: `${driverName} (Checklist Diverifikasi)`,
      checkerName: 'Petugas Checker DC PT AKK',
      checkerSigned: true,
      synced: false,
      createdAt: now.toISOString()
    };
  }

  public calculateStatus(items: VehicleChecklistItem[]): {
    overallStatus: OverallChecklistStatus;
    passedCount: number;
    issueCount: number;
  } {
    const passedCount = items.filter(i => i.status === 'ok').length;
    const issueCount = items.filter(i => i.status === 'issue').length;

    let overallStatus: OverallChecklistStatus = 'passed';
    if (issueCount > 0 && issueCount <= 2) {
      overallStatus = 'warning';
    } else if (issueCount > 2) {
      overallStatus = 'failed';
    }

    return { overallStatus, passedCount, issueCount };
  }
}

export const driverChecklistService = new DriverChecklistService();
