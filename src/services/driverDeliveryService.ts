import { Schedule, ShipmentStatus, Crew, Fleet, RetailStore } from '../types';
import { logisticsStore } from './store';

export interface DriverDeliveryStats {
  totalAssigned: number;
  scheduled: number;
  pickedUp: number;
  inTransit: number;
  delivered: number;
  delayed: number;
  totalWeightTon: number;
}

export interface StatusUpdateResult {
  success: boolean;
  message: string;
  syncedToSupabase: boolean;
}

class DriverDeliveryService {
  /**
   * Fetch deliveries assigned to a driver.
   * Pulls from Hostinger MySQL if online and available, with local cache only for offline continuity.
   */
  public async getDriverDeliveries(driverId?: string): Promise<{
    deliveries: Schedule[];
    isSupabaseLive: boolean;
  }> {
    let isSupabaseLive = false;
    const localSchedules = logisticsStore.getSchedules();
    const activeCrew = logisticsStore.getActiveDriverCrew();
    const targetDriverId = driverId || activeCrew?.id || '';
    const targetDriverName =
      (driverId ? logisticsStore.getCrews().find(c => c.id === driverId)?.name : activeCrew?.name) ||
      logisticsStore.getCurrentUser()?.fullName ||
      '';

    // Hostinger MySQL remote snapshot
    try {
      const res = await fetch('/api/schedules/persisted', { credentials: 'same-origin' });
      if (res.ok) {
        const remote = await res.json();
        const remoteSchedules: Schedule[] = Array.isArray(remote?.schedules) ? remote.schedules : [];
        if (remoteSchedules.length > 0) {
          const filtered = targetDriverId || targetDriverName
            ? remoteSchedules.filter((sch: Schedule) =>
                sch.crewId === targetDriverId ||
                sch.crewHelperId === targetDriverId ||
                sch.crewHelper2Id === targetDriverId ||
                (targetDriverName && sch.crew?.name?.toLowerCase() === targetDriverName.toLowerCase())
              )
            : remoteSchedules;
          if (filtered.length > 0) return { deliveries: filtered, isSupabaseLive: true };
        }
      }
    } catch (err) {
      console.warn('[DriverDeliveryService] Hostinger MySQL pull notice, using local store:', err);
    }

    // Fallback: Filter local store schedules
    const targetDeliveries = (targetDriverId || targetDriverName)
      ? localSchedules.filter((s: Schedule) => 
          s.crewId === targetDriverId ||
          (targetDriverName && s.crew && s.crew.name.toLowerCase() === targetDriverName.toLowerCase()) ||
          s.crewHelperId === targetDriverId
        )
      : localSchedules;

    // Jika driver/helper tidak punya penugasan, kembalikan kosong.
    // Jangan menampilkan jadwal user lain atau jadwal demo sebagai fallback.
    const finalDeliveries = (targetDriverId || targetDriverName) ? targetDeliveries : localSchedules;

    return { deliveries: finalDeliveries, isSupabaseLive };
  }

  /**
   * Update delivery status by Driver with notes, proof of delivery photo/data, and Hostinger MySQL sync.
   */
  public async updateDeliveryStatus(
    scheduleId: string,
    trackingNumber: string,
    newStatus: ShipmentStatus,
    reasonOrNotes?: string,
    podData?: {
      podPhotoUrl?: string;
      podReceiverName?: string;
      podConditionNote?: string;
      podPhotoTimestamp?: string;
    }
  ): Promise<StatusUpdateResult> {
    // 1. Optimistic Local Store update (instant reactivity for UI)
    logisticsStore.updateScheduleStatus(scheduleId, newStatus, reasonOrNotes, podData);

    // 2. Persist status to Hostinger MySQL snapshot
    let syncedToSupabase = false; // Legacy return field kept for compatibility; true means remote DB synced.
    try {
      const notes = reasonOrNotes?.trim() || (podData?.podReceiverName
        ? `Diterima: ${podData.podReceiverName} (${podData.podConditionNote || 'Kondisi Baik'})${podData.podPhotoUrl ? ' [Bukti Foto POD OK]' : ''}`
        : undefined);
      const response = await fetch(`/api/schedules/${encodeURIComponent(scheduleId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber,
          status: newStatus,
          notes,
          actualArrival: newStatus === 'delivered' ? new Date().toISOString() : undefined
        })
      });
      syncedToSupabase = response.ok;
    } catch (err) {
      console.warn('[DriverDeliveryService] Hostinger MySQL status sync exception (persisted locally):', err);
    }

    const statusLabels: Record<ShipmentStatus, string> = {
      scheduled: 'Terjadwal',
      picked_up: 'Picked Up (Selesai Muat)',
      in_transit: 'In Transit (Berangkat)',
      delivered: 'Delivered (Terkirim)',
      delayed: 'Delayed (Tertunda)'
    };

    return {
      success: true,
      message: `Status pengiriman ${trackingNumber} berhasil diperbarui menjadi "${statusLabels[newStatus]}".`,
      syncedToSupabase
    };
  }

  /**
   * Compute stats for a driver's deliveries
   */
  public computeStats(deliveries: Schedule[]): DriverDeliveryStats {
    let scheduled = 0;
    let pickedUp = 0;
    let inTransit = 0;
    let delivered = 0;
    let delayed = 0;
    let totalWeightTon = 0;

    deliveries.forEach(d => {
      totalWeightTon += Number(d.cargoWeightTon) || 0;
      if (d.status === 'scheduled') scheduled++;
      else if (d.status === 'picked_up') pickedUp++;
      else if (d.status === 'in_transit') inTransit++;
      else if (d.status === 'delivered') delivered++;
      else if (d.status === 'delayed') delayed++;
    });

    return {
      totalAssigned: deliveries.length,
      scheduled,
      pickedUp,
      inTransit,
      delivered,
      delayed,
      totalWeightTon: Number(totalWeightTon.toFixed(1))
    };
  }
}

export const driverDeliveryService = new DriverDeliveryService();
