import {
  Schedule,
  OutboundWaybill,
  OutboundWaybillStatus,
  OutboundWaybillCargoItem
} from '../types';
import { logisticsStore } from './store';

const STORAGE_KEY = 'akk_driver_outbound_waybills_v3';

class DriverWaybillService {
  /**
   * Derive a structured Outbound Waybill (Surat Jalan Keluar) from a delivery Schedule
   */
  public generateWaybillFromSchedule(schedule: Schedule): OutboundWaybill {
    const rawDate = schedule.departureDate || new Date().toISOString().split('T')[0];
    const dateFormatted = rawDate.replace(/-/g, '/');
    const cleanNum = schedule.id.replace(/\D/g, '').slice(-4) || '1024';
    const waybillNumber = `SJ-OUT/AKK/${dateFormatted.slice(0, 7)}/${cleanNum}`;

    // Calculate box quantities based on ton capacity or description
    const weightTon = schedule.cargoWeightTon || 2.5;
    const totalWeightKg = Math.round(weightTon * 1000);
    const estKoli = Math.round(totalWeightKg / 14); // Average ~14kg per corrugated carton box

    const cargoItems: OutboundWaybillCargoItem[] = [
      {
        id: `cargo-${schedule.id}-1`,
        itemCode: 'BOX-CB-A1',
        description: `${schedule.cargoDescription || 'Karton Box Corrugated'} (Standar Industri PT AKK)`,
        boxDimensions: '40 x 30 x 28 cm',
        quantity: Math.round(estKoli * 0.65),
        unit: 'Koli',
        weightKg: Math.round(totalWeightKg * 0.65),
        notes: 'Double Wall (K200/M150/K200)'
      },
      {
        id: `cargo-${schedule.id}-2`,
        itemCode: 'BOX-CB-B2',
        description: 'Karton Box Custom Cetak Logo (Die-Cut Inner Box)',
        boxDimensions: '32 x 22 x 18 cm',
        quantity: Math.round(estKoli * 0.35),
        unit: 'Koli',
        weightKg: Math.round(totalWeightKg * 0.35),
        notes: 'Single Wall High Density'
      }
    ];

    const sealNumber = `SEAL-AKK-${cleanNum.padStart(4, '0')}`;

    // Map schedule status to waybill status
    let status: OutboundWaybillStatus = 'checker_verified';
    if (schedule.status === 'scheduled') {
      status = 'checker_verified';
    } else if (schedule.status === 'picked_up' || schedule.status === 'in_transit' || schedule.status === 'delayed') {
      status = 'in_transit';
    } else if (schedule.status === 'delivered') {
      status = 'delivered';
    }

    const statusLabels: Record<OutboundWaybillStatus, string> = {
      draft: 'Draft Manifest',
      loading: 'Proses Pemuatan (Loading Bay)',
      sealed: 'Segel Terpasang',
      checker_verified: 'Siap Out (Persiapan Keluar)',
      gate_out: 'Di Jalan (Keluar Gudang)',
      in_transit: 'Di Jalan (Keluar Gudang)',
      delivered: 'Selesai (Tiba di Gudang)'
    };

    const crewName = schedule.crew?.name || '-';
    const crewPhone = schedule.crew?.phone || '-';
    const fleetPlate = schedule.fleet?.plateNumber || '-';
    const fleetType = schedule.fleet?.vehicleType || '-';

    return {
      id: `WB-${schedule.id}`,
      waybillNumber,
      scheduleId: schedule.id,
      trackingNumber: schedule.trackingNumber,
      poNumber: `PO-AKK-${cleanNum}`,
      date: rawDate,
      gateOutTime: '-',
      estimatedArrival: schedule.estimatedArrival || '-',
      originWarehouse: {
        name: 'Distribution Center (DC) PT Anugrah Kemasan Kreatif',
        address: 'Jl. Argopuro No.60, Lingkungan Sukowidi, Klatak, Kec. Kalipuro, Kab. Banyuwangi, Jawa Timur 68421',
        phone: '-',
        gateNumber: 'Gate Keluar Outbound DC'
      },
      destination: {
        storeName: schedule.store?.storeName || schedule.areaName || '-',
        areaName: schedule.areaName || schedule.store?.city || '-',
        city: schedule.store?.city || '-',
        province: schedule.store?.province || '-',
        address: schedule.store?.address || '-',
        contactPerson: schedule.store?.contactPerson || '-',
        phone: schedule.store?.phone || '-'
      },
      fleet: {
        id: schedule.fleetId,
        plateNumber: fleetPlate,
        vehicleType: fleetType,
        initialCode: schedule.fleet?.initialCode || '-'
      },
      crew: {
        driverId: schedule.crewId,
        driverName: crewName,
        driverPhone: crewPhone,
        licenseType: schedule.crew?.licenseType || '-',
        helperName: schedule.crewHelper?.name || '-',
        helper2Name: schedule.crewHelper2?.name
      },
      cargoItems,
      totalKoli: estKoli,
      totalWeightKg,
      securitySealNumber: sealNumber,
      status,
      statusLabel: statusLabels[status],
      checkerName: 'Rahmat Hidayat (Checker Outbound DC)',
      checkerNotes: 'Karton box kering, kondisi segel utuh, muatan disusun stabil sesuai SOP distribusi PT AKK.',
      driverNotes: schedule.notes || '',
      signedByDriver: false,
      signedByDriverAt: '',
      signedByChecker: false,
      signedByCheckerAt: '',
      // 4 Role-based signatures dikosongi terlebih dahulu
      preparedByName: 'M. Syaiful B.',
      preparedBySigned: false,
      preparedBySignedAt: '',
      acknowledgedByName: 'Bayu Novianto Dimas Permana',
      acknowledgedBySigned: false,
      acknowledgedBySignedAt: '',
      securityOfficerName: 'Hairul Rozikin',
      securitySigned: false,
      securitySignedAt: '',
      driverSigned: false,
      driverSignedAt: '',
      qrCodeData: `PT_AKK|${waybillNumber}|${fleetPlate}|${sealNumber}|${rawDate}`,
      synced: true,
      createdAt: schedule.createdAt || new Date().toISOString()
    };
  }

  public getStoredWaybills(): Record<string, OutboundWaybill> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public saveWaybill(waybill: OutboundWaybill): void {
    try {
      const existing = this.getStoredWaybills();
      existing[waybill.id] = waybill;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (err) {
      console.error('Failed to save waybill to localStorage:', err);
    }
  }

  public getWaybillForSchedule(schedule: Schedule): OutboundWaybill {
    const stored = this.getStoredWaybills();
    const key = `WB-${schedule.id}`;
    if (stored[key]) {
      const existing = stored[key];
      let changed = false;
      if (schedule.fleet?.plateNumber && existing.fleet.plateNumber !== schedule.fleet.plateNumber) {
        existing.fleet = {
          id: schedule.fleetId,
          plateNumber: schedule.fleet.plateNumber,
          vehicleType: schedule.fleet.vehicleType,
          initialCode: schedule.fleet.initialCode || existing.fleet.initialCode
        };
        changed = true;
      }
      if (schedule.crew?.name && existing.crew.driverName !== schedule.crew.name) {
        existing.crew.driverName = schedule.crew.name;
        changed = true;
      }
      if (schedule.crewHelper?.name && existing.crew.helperName !== schedule.crewHelper.name) {
        existing.crew.helperName = schedule.crewHelper.name;
        changed = true;
      }
      if (schedule.status === 'delivered') {
        if (existing.status !== 'delivered' || existing.statusLabel !== 'Selesai (Tiba di Gudang)') {
          existing.status = 'delivered';
          existing.statusLabel = 'Selesai (Tiba di Gudang)';
          changed = true;
        }
      } else if (
        schedule.status === 'in_transit' ||
        schedule.status === 'picked_up' ||
        schedule.status === 'delayed' ||
        existing.status === 'in_transit' ||
        existing.status === 'gate_out'
      ) {
        if (existing.status !== 'in_transit' || existing.statusLabel !== 'Di Jalan (Keluar Gudang)') {
          existing.status = 'in_transit';
          existing.statusLabel = 'Di Jalan (Keluar Gudang)';
          changed = true;
        }
      } else if (schedule.status === 'scheduled') {
        if (existing.status !== 'checker_verified' || existing.statusLabel !== 'Siap Out (Persiapan Keluar)') {
          existing.status = 'checker_verified';
          existing.statusLabel = 'Siap Out (Persiapan Keluar)';
          changed = true;
        }
      }
      if (changed) {
        this.saveWaybill(existing);
      }
      return existing;
    }
    const generated = this.generateWaybillFromSchedule(schedule);
    stored[key] = generated;
    this.saveWaybill(generated);
    return generated;
  }

  public getWaybillsForDriver(_driverId: string, schedules: Schedule[]): OutboundWaybill[] {
    return schedules.map(sch => this.getWaybillForSchedule(sch));
  }

  public updateWaybillStatus(
    waybillId: string,
    status: OutboundWaybillStatus,
    notes?: string
  ): boolean {
    try {
      const stored = this.getStoredWaybills();
      if (!stored[waybillId]) return false;

      const statusLabels: Record<OutboundWaybillStatus, string> = {
        draft: 'Draft Manifest',
        loading: 'Proses Pemuatan (Loading Bay)',
        sealed: 'Segel Terpasang',
        checker_verified: 'Siap Out (Persiapan Keluar)',
        gate_out: 'Di Jalan (Keluar Gudang)',
        in_transit: 'Di Jalan (Keluar Gudang)',
        delivered: 'Selesai (Tiba di Gudang)'
      };

      const normalizedStatus: OutboundWaybillStatus = status === 'gate_out' ? 'in_transit' : status;
      stored[waybillId].status = normalizedStatus;
      stored[waybillId].statusLabel = statusLabels[normalizedStatus];
      if (notes) {
        stored[waybillId].driverNotes = notes;
      }
      if (status === 'gate_out' || status === 'in_transit') {
        const now = new Date();
        stored[waybillId].gateOutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
        try {
          const wb = stored[waybillId];
          logisticsStore.recordGateOut(
            wb.scheduleId,
            wb.fleet.plateNumber,
            wb.crew.driverName,
            wb.destination.storeName || wb.destination.areaName,
            wb.fleet.initialCode
          );
        } catch (err) {
          console.warn('[WaybillService] Failed to record gate out to security:', err);
        }
      }
      this.saveWaybill(stored[waybillId]);
      try {
        window.dispatchEvent(new CustomEvent('driver-waybill-updated', { detail: stored[waybillId] }));
      } catch {}
      return true;
    } catch {
      return false;
    }
  }
}

export const driverWaybillService = new DriverWaybillService();
