import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Truck, 
  Users, 
  Ship, 
  Zap, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  UserCheck, 
  Sparkles,
  MapPin,
  FileCheck,
  Printer,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Schedule, Crew, Fleet, RetailStore } from '../types';
import { logisticsStore } from '../services/store';
import { isLuarKotaSchedule } from './OutboundGapMonitoringPanel';

interface NextDayReadinessPanelProps {
  schedules: Schedule[];
  crews: Crew[];
  fleets: Fleet[];
  onSchedulesUpdated?: () => void;
  onOpenSimulation?: () => void;
  onSelectSchedule?: (schedule: Schedule) => void;
}

export interface DayReadinessConflict {
  scheduleId: string;
  trackingNumber: string;
  destination: string;
  departureTime: string;
  isLuarKota: boolean;
  driverId: string;
  driverName: string;
  conflictType: 'gap_under_24h' | 'consecutive_outbound' | 'unassigned_driver' | 'fleet_maintenance' | 'missing_ferry_ticket' | 'forbidden_pairing' | 'out_of_town_restricted';
  gapHours?: number;
  previousTrip?: {
    trackingNumber: string;
    destination: string;
    departureTime: string;
    arrivalTime?: string;
    isLuarKota: boolean;
  };
  recommendedSubstitutes: Crew[];
  description: string;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const NextDayReadinessPanel: React.FC<NextDayReadinessPanelProps> = ({
  schedules,
  crews,
  fleets,
  onSchedulesUpdated,
  onOpenSimulation,
  onSelectSchedule
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Day Selector: "tomorrow" | "today" | "day_after" | or specific day name
  const [selectedTargetDay, setSelectedTargetDay] = useState<'tomorrow' | 'today' | 'day_after' | string>('tomorrow');

  // Helper to extract day name of a schedule
  const getScheduleDayName = (sch: Schedule): string => {
    if (sch.trackingNumber.includes('-SEN-') || sch.notes?.includes('Senin')) return 'Senin';
    if (sch.trackingNumber.includes('-SEL-') || sch.notes?.includes('Selasa')) return 'Selasa';
    if (sch.trackingNumber.includes('-RAB-') || sch.notes?.includes('Rabu')) return 'Rabu';
    if (sch.trackingNumber.includes('-KAM-') || sch.notes?.includes('Kamis')) return 'Kamis';
    if (sch.trackingNumber.includes('-JUM-') || sch.notes?.includes('Jumat')) return 'Jumat';
    if (sch.trackingNumber.includes('-SAB-') || sch.notes?.includes('Sabtu')) return 'Sabtu';

    if (sch.departureDate) {
      const d = new Date(sch.departureDate);
      if (!isNaN(d.getTime())) {
        return DAY_NAMES[d.getDay()] || 'Lainnya';
      }
    }
    return 'Lainnya';
  };

  // Determine current day & tomorrow's day name
  const today = new Date();
  const currentDayName = DAY_NAMES[today.getDay()];
  
  // Calculate default tomorrow (skip Sunday to Monday if Saturday)
  const tomorrowIdx = (today.getDay() + 1) % 7;
  const tomorrowDayName = tomorrowIdx === 0 ? 'Senin' : DAY_NAMES[tomorrowIdx];

  const dayAfterIdx = (today.getDay() + 2) % 7;
  const dayAfterDayName = dayAfterIdx === 0 ? 'Senin' : DAY_NAMES[dayAfterIdx];

  // Resolve active target day name
  const activeDayName = useMemo(() => {
    if (selectedTargetDay === 'today') return currentDayName === 'Minggu' ? 'Senin' : currentDayName;
    if (selectedTargetDay === 'tomorrow') return tomorrowDayName;
    if (selectedTargetDay === 'day_after') return dayAfterDayName;
    return selectedTargetDay;
  }, [selectedTargetDay, currentDayName, tomorrowDayName, dayAfterDayName]);

  // Filter schedules for the targeted active day
  const targetDaySchedules = useMemo(() => {
    return schedules.filter(s => getScheduleDayName(s) === activeDayName).sort((a, b) => {
      return new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime();
    });
  }, [schedules, activeDayName]);

  // Outbound vs Local for target day
  const outboundTargetSchedules = useMemo(() => {
    return targetDaySchedules.filter(isLuarKotaSchedule);
  }, [targetDaySchedules]);

  const localTargetSchedules = useMemo(() => {
    return targetDaySchedules.filter(s => !isLuarKotaSchedule(s));
  }, [targetDaySchedules]);

  // Drivers pool
  const drivers = useMemo(() => {
    return crews.filter(c => !c.role.includes('Helper') && c.role !== 'Kernet / Helper');
  }, [crews]);

  // Comprehensive Next Day Readiness Analysis & Gap Check
  const readinessAnalysis = useMemo(() => {
    const conflicts: DayReadinessConflict[] = [];
    const safeSchedules: Schedule[] = [];

    // Map all schedules by driver to compute historic/future gaps
    const driverHistoryMap = new Map<string, Schedule[]>();
    schedules.forEach(s => {
      if (s.crewId) {
        const list = driverHistoryMap.get(s.crewId) || [];
        list.push(s);
        driverHistoryMap.set(s.crewId, list);
      }
    });

    targetDaySchedules.forEach(currentSched => {
      const isOutbound = isLuarKotaSchedule(currentSched);
      const targetDepTime = new Date(currentSched.departureDate).getTime();

      // Check 1: Missing Driver
      if (!currentSched.crewId) {
        const availableDrivers = drivers.filter(d => {
          // Check if already driving on this target day
          const dayTrips = targetDaySchedules.filter(ts => ts.crewId === d.id);
          return dayTrips.length === 0;
        });

        conflicts.push({
          scheduleId: currentSched.id,
          trackingNumber: currentSched.trackingNumber,
          destination: currentSched.store?.storeName || currentSched.storeId,
          departureTime: currentSched.departureDate,
          isLuarKota: isOutbound,
          driverId: '',
          driverName: 'Belum Ada Supir',
          conflictType: 'unassigned_driver',
          recommendedSubstitutes: availableDrivers.slice(0, 3),
          description: 'Rute belum memiliki supir yang ditugaskan.'
        });
        return;
      }

      // Check 2: Missing Ferry Ticket for Inter-Island / Bali
      if (currentSched.isInterIsland && !currentSched.ferryBookingCode) {
        conflicts.push({
          scheduleId: currentSched.id,
          trackingNumber: currentSched.trackingNumber,
          destination: currentSched.store?.storeName || currentSched.storeId,
          departureTime: currentSched.departureDate,
          isLuarKota: true,
          driverId: currentSched.crewId,
          driverName: currentSched.crew?.name || 'Supir Ditugaskan',
          conflictType: 'missing_ferry_ticket',
          recommendedSubstitutes: [],
          description: 'Rute lintas pulau (Bali) belum memiliki kode booking tiket kapal ASDP Ketapang-Gilimanuk.'
        });
      }

      // Check 4: Forbidden Pairing (Blacklist Driver & Helper)
      if (currentSched.crewId && currentSched.crewHelperId) {
        const driverObj = crews.find(c => c.id === currentSched.crewId);
        const helperObj = crews.find(c => c.id === currentSched.crewHelperId);

        const isDriverForbidden = driverObj?.forbiddenPairCrewIds && driverObj.forbiddenPairCrewIds.includes(currentSched.crewHelperId);
        const isHelperForbidden = helperObj?.forbiddenPairCrewIds && helperObj.forbiddenPairCrewIds.includes(currentSched.crewId);

        if (isDriverForbidden || isHelperForbidden) {
          const helpers = crews.filter(c => c.role.includes('Helper') || c.role === 'Kernet / Helper');
          const availableHelpers = helpers.filter((h: Crew) => {
            const driverBlacklist = driverObj?.forbiddenPairCrewIds || [];
            const helperBlacklist = h.forbiddenPairCrewIds || [];
            return !driverBlacklist.includes(h.id) && !helperBlacklist.includes(driverObj?.id || '');
          });

          conflicts.push({
            scheduleId: currentSched.id,
            trackingNumber: currentSched.trackingNumber,
            destination: currentSched.store?.storeName || currentSched.storeId,
            departureTime: currentSched.departureDate,
            isLuarKota: isOutbound,
            driverId: currentSched.crewId,
            driverName: currentSched.crew?.name || 'Supir',
            conflictType: 'forbidden_pairing' as any,
            recommendedSubstitutes: availableHelpers.slice(0, 3) as any,
            description: `🚨 PELANGGARAN PASANGAN TERLARANG (BLACKLIST): Supir (${driverObj?.name || 'Supir'}) dan Helper (${helperObj?.name || 'Helper'}) masuk dalam daftar hitam dan tidak boleh berpasangan!`
          });
        }
      }

      // Check 5: Out-of-Town Restriction for local-only drivers
      if (currentSched.crewId && isOutbound && !currentSched.isUrgentOverride) {
        const driverObj = crews.find(c => c.id === currentSched.crewId);
        if (driverObj && driverObj.allowOutofTown === false) {
          const availableDrivers = drivers.filter(d => {
            if (d.allowOutofTown === false) return false;
            const dayTrips = targetDaySchedules.filter(ts => ts.crewId === d.id);
            return dayTrips.length === 0;
          });

          conflicts.push({
            scheduleId: currentSched.id,
            trackingNumber: currentSched.trackingNumber,
            destination: currentSched.store?.storeName || currentSched.storeId,
            departureTime: currentSched.departureDate,
            isLuarKota: isOutbound,
            driverId: currentSched.crewId,
            driverName: driverObj.name,
            conflictType: 'out_of_town_restricted' as any,
            recommendedSubstitutes: availableDrivers.slice(0, 3),
            description: `🚨 PELANGGARAN RUTE LUAR KOTA: Supir (${driverObj.name}) dibatasi khusus area Lokal Banyuwangi (tidak boleh kirim luar kota ke ${currentSched.store?.storeName || currentSched.storeId}), kecuali tombol 'Override Darurat' ditekan.`
          });
        }
      }

      // Check 3: 24-Hour Gap Audit from previous trips (specifically previous outbound trip)
      const driverTrips = (driverHistoryMap.get(currentSched.crewId) || []).sort(
        (a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
      );

      // Find the most recent trip before this target departure
      let prevTrip: Schedule | undefined;
      for (const t of driverTrips) {
        if (t.id === currentSched.id) continue;
        const tDep = new Date(t.departureDate).getTime();
        if (tDep < targetDepTime) {
          if (!prevTrip || tDep > new Date(prevTrip.departureDate).getTime()) {
            prevTrip = t;
          }
        }
      }

      let hasGapViolation = false;
      let gapHours: number | undefined;

      if (prevTrip) {
        const prevDep = new Date(prevTrip.departureDate).getTime();
        const prevArrival = prevTrip.estimatedArrival ? new Date(prevTrip.estimatedArrival).getTime() : prevDep + 10 * 3600000;
        
        // Calculate rest gap from previous departure
        gapHours = Math.round(((targetDepTime - prevDep) / (1000 * 60 * 60)) * 10) / 10;
        const isPrevOutbound = isLuarKotaSchedule(prevTrip);

        // Conflict triggers if:
        // 1. Current is Luar Kota AND gap from previous trip is < 24 hours
        // 2. OR Prev was Luar Kota AND current is Luar Kota on consecutive days (< 24h gap)
        if ((isOutbound || isPrevOutbound) && gapHours < 24) {
          hasGapViolation = true;

          // Find recommended substitute drivers who have NO trip within 24h of this target departure
          const substitutes = drivers.filter(d => {
            if (d.id === currentSched.crewId) return false;
            // Driver must not have any trip on target day
            const onTargetDay = targetDaySchedules.some(ts => ts.crewId === d.id);
            if (onTargetDay) return false;

            // Driver must not have an outbound trip within 24h
            const dTrips = driverHistoryMap.get(d.id) || [];
            const hasClash = dTrips.some(dt => {
              const dtDep = new Date(dt.departureDate).getTime();
              return Math.abs(targetDepTime - dtDep) < 24 * 3600000;
            });
            return !hasClash;
          });

          conflicts.push({
            scheduleId: currentSched.id,
            trackingNumber: currentSched.trackingNumber,
            destination: currentSched.store?.storeName || currentSched.storeId,
            departureTime: currentSched.departureDate,
            isLuarKota: isOutbound,
            driverId: currentSched.crewId,
            driverName: currentSched.crew?.name || 'Supir',
            conflictType: isOutbound && isPrevOutbound ? 'consecutive_outbound' : 'gap_under_24h',
            gapHours,
            previousTrip: {
              trackingNumber: prevTrip.trackingNumber,
              destination: prevTrip.store?.storeName || prevTrip.storeId,
              departureTime: prevTrip.departureDate,
              arrivalTime: prevTrip.estimatedArrival,
              isLuarKota: isPrevOutbound
            },
            recommendedSubstitutes: substitutes.slice(0, 3),
            description: `Supir baru menyelesaikan trip '${prevTrip.store?.storeName || prevTrip.storeId}' dan hanya memiliki jeda istirahat ${gapHours} jam (< 24 jam).`
          });
        }
      }

      if (!hasGapViolation) {
        safeSchedules.push(currentSched);
      }
    });

    const isReady = conflicts.length === 0;
    const totalOutbound = outboundTargetSchedules.length;
    const totalLocal = localTargetSchedules.length;
    const ferryRequired = outboundTargetSchedules.filter(s => s.isInterIsland).length;
    const ferryReady = outboundTargetSchedules.filter(s => s.isInterIsland && s.ferryBookingCode).length;

    // Available standby drivers on target day
    const assignedDriverIds = new Set(targetDaySchedules.map(s => s.crewId).filter(Boolean));
    const standbyDrivers = drivers.filter(d => !assignedDriverIds.has(d.id));

    return {
      isReady,
      conflicts,
      safeSchedules,
      totalRoutes: targetDaySchedules.length,
      totalOutbound,
      totalLocal,
      ferryRequired,
      ferryReady,
      standbyDrivers,
      compliancePercent: targetDaySchedules.length > 0 
        ? Math.round(((targetDaySchedules.length - conflicts.length) / targetDaySchedules.length) * 100) 
        : 100
    };
  }, [targetDaySchedules, schedules, drivers, outboundTargetSchedules, localTargetSchedules]);

  // Handler: Auto-Resolve all conflicts for target day
  const handleAutoResolveTargetConflicts = () => {
    if (readinessAnalysis.conflicts.length === 0) {
      setActionFeedback(`✅ Jadwal hari ${activeDayName} sudah 100% aman.`);
      setTimeout(() => setActionFeedback(null), 4000);
      return;
    }

    let resolvedCount = 0;
    const driverLastOutbound = new Map<string, number>();

    // Seed driver departure timestamps
    schedules.forEach(s => {
      if (s.crewId && isLuarKotaSchedule(s)) {
        driverLastOutbound.set(s.crewId, new Date(s.departureDate).getTime());
      }
    });

    readinessAnalysis.conflicts.forEach(conflict => {
      const sched = schedules.find(s => s.id === conflict.scheduleId);
      if (!sched) return;

      const depTime = new Date(sched.departureDate).getTime();

      // Find suitable substitute from recommended or standby
      let candidate: Crew | undefined = conflict.recommendedSubstitutes[0];
      if (!candidate) {
        candidate = readinessAnalysis.standbyDrivers.find(d => {
          if (d.id === conflict.driverId) return false;
          const last = driverLastOutbound.get(d.id);
          return last === undefined || Math.abs(depTime - last) >= 24 * 3600000;
        });
      }

      if (candidate) {
        logisticsStore.updateSchedule(sched.id, {
          crewId: candidate.id,
          crew: candidate,
          notes: (sched.notes || '') + ' [Auto-Resolved Readiness H+1]'
        });
        driverLastOutbound.set(candidate.id, depTime);
        resolvedCount++;
      }
    });

    if (resolvedCount > 0) {
      logisticsStore.logActivity(
        'Resolusi Kesiapan Jadwal H+1',
        'Next Day Readiness Auto-Swap',
        `Berhasil menukar ${resolvedCount} supir yang berpotensi benturan jeda di hari ${activeDayName}.`
      );
      if (onSchedulesUpdated) onSchedulesUpdated();
      setActionFeedback(`⚡ Berhasil menukar ${resolvedCount} supir dengan kru cadangan yang bugar! Status hari ${activeDayName} kini AMAN.`);
    } else {
      setActionFeedback(`⚠️ Tidak ditemukan supir cadangan yang memenuhi jeda 24 jam. Harap periksa Data Pool Kru.`);
    }

    setTimeout(() => setActionFeedback(null), 6000);
  };

  // Handler: Manual swap single driver
  const handleSwapDriver = (scheduleId: string, newDriverId: string) => {
    const selectedCrew = crews.find(c => c.id === newDriverId);
    if (!selectedCrew) return;

    logisticsStore.updateSchedule(scheduleId, {
      crewId: newDriverId,
      crew: selectedCrew,
      notes: (schedules.find(s => s.id === scheduleId)?.notes || '') + ` [Reassigned to ${selectedCrew.name}]`
    });

    if (onSchedulesUpdated) onSchedulesUpdated();
    setActionFeedback(`✅ Berhasil menugaskan ${selectedCrew.name} untuk jadwal.`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Handler: Toggle Emergency Override for out-of-town restriction
  const handleToggleEmergencyOverride = (scheduleId: string) => {
    const target = schedules.find(s => s.id === scheduleId);
    if (!target) return;
    const nextVal = !target.isUrgentOverride;
    logisticsStore.updateSchedule(scheduleId, { isUrgentOverride: nextVal } as any);
    if (onSchedulesUpdated) onSchedulesUpdated();
    setActionFeedback(`🚨 Override Darurat ${nextVal ? 'DIAKTIFKAN (Bypass Larangan Luar Kota)' : 'DINONAKTIFKAN'} untuk rute ${target.trackingNumber}`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Helper to calculate rest gap for individual schedule row
  const getScheduleGapDetails = (sched: Schedule) => {
    if (!sched.crewId) return { label: 'Belum Ada Supir', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    
    const driverTrips = schedules
      .filter(s => s.crewId === sched.crewId)
      .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());

    const currTime = new Date(sched.departureDate).getTime();
    let prevTrip: Schedule | undefined;
    for (const t of driverTrips) {
      if (t.id === sched.id) continue;
      const tDep = new Date(t.departureDate).getTime();
      if (tDep < currTime) {
        if (!prevTrip || tDep > new Date(prevTrip.departureDate).getTime()) {
          prevTrip = t;
        }
      }
    }

    if (!prevTrip) {
      return { 
        label: 'Trip Pertama / Istirahat Cukup (>48h)', 
        hours: '> 48h', 
        isSafe: true, 
        color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' 
      };
    }

    const prevDep = new Date(prevTrip.departureDate).getTime();
    const gap = Math.round(((currTime - prevDep) / (1000 * 60 * 60)) * 10) / 10;
    const isOutbound = isLuarKotaSchedule(sched);
    const isPrevOutbound = isLuarKotaSchedule(prevTrip);

    if ((isOutbound || isPrevOutbound) && gap < 24) {
      return {
        label: `Kritis: ${gap} Jam (< 24 Jam)`,
        hours: `${gap}h`,
        isSafe: false,
        color: 'text-rose-300 bg-rose-500/20 border-rose-500/40 font-bold'
      };
    }

    return {
      label: `Aman: ${gap} Jam Jeda`,
      hours: `${gap}h`,
      isSafe: true,
      color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
    };
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg no-print transition-all">
      {/* Action Notification Toast */}
      {actionFeedback && (
        <div className="bg-indigo-950 border-b border-indigo-800 px-4 py-3 text-xs text-indigo-200 flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button 
            onClick={() => setActionFeedback(null)} 
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Primary Header Card with Dynamic Color Coding (Hijau: Aman, Merah: Perlu Penyesuaian) */}
      <div className={`p-4 sm:p-5 border-b transition-colors ${
        readinessAnalysis.isReady
          ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/40 border-emerald-500/30'
          : 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/50 border-rose-500/50'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left Title & Status Indicator */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-3 rounded-xl border shrink-0 ${
              readinessAnalysis.isReady
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-rose-500/20 border-rose-500/60 text-rose-400 shadow-md shadow-rose-500/20 animate-pulse'
            }`}>
              {readinessAnalysis.isReady ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  Supervisor Audit System
                </span>
                
                {/* Visual Status Badge (Hijau / Merah) */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black tracking-wide border shadow-sm ${
                  readinessAnalysis.isReady
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30'
                    : 'bg-rose-600 text-white border-rose-400 animate-pulse ring-2 ring-rose-400/50'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${readinessAnalysis.isReady ? 'bg-emerald-400 animate-ping' : 'bg-white'}`} />
                  {readinessAnalysis.isReady ? '🟢 AMAN (SIAP OPERASIONAL)' : '🔴 PERLU PENYESUAIAN'}
                </span>

                <span className="text-xs text-slate-400 font-medium">
                  • Target: <strong className="text-white font-semibold">{activeDayName}</strong>
                </span>
              </div>

              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
                <span>Next Day Readiness Panel</span>
                <span className="text-xs font-normal text-slate-400 hidden sm:inline">
                  (Deteksi Otomatis Benturan Jeda &lt; 24 Jam)
                </span>
              </h3>

              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {readinessAnalysis.isReady ? (
                  <span className="text-emerald-200/90 font-medium">
                    Semua supir rute luar kota hari <strong className="text-emerald-300">{activeDayName}</strong> telah memiliki jeda istirahat ≥ 24 jam, armada siap, dan tiket ASDP terverifikasi.
                  </span>
                ) : (
                  <span className="text-rose-200 font-semibold">
                    Ditemukan <strong className="text-white underline">{readinessAnalysis.conflicts.length} potensi benturan jadwal</strong> (supir belum jeda 24 jam / tiket belum siap). Segera sesuaikan sebelum armada diberangkatkan!
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right Action & Day Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            {/* Auto-Resolve Button (Active when conflicts exist) */}
            {!readinessAnalysis.isReady && (
              <button
                onClick={handleAutoResolveTargetConflicts}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer ring-2 ring-rose-400/40 animate-pulse"
                title="Tukar supir yang benturan dengan kru cadangan yang sudah istirahat >24 jam"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>⚡ Atasi Benturan (Auto-Swap Cadangan)</span>
              </button>
            )}

            {readinessAnalysis.isReady && (
              <button
                onClick={() => {
                  setActionFeedback(`📋 Jadwal ${activeDayName} telah terverifikasi aman untuk briefing keberangkatan besok pagi.`);
                  setTimeout(() => setActionFeedback(null), 4000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-300 border border-emerald-700 text-xs font-bold transition cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Verifikasi Siap Jalan</span>
              </button>
            )}

            {/* Expand / Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title={isExpanded ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Day Selector Tabs for Supervisor */}
        <div className="mt-4 pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
            <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1 shrink-0 mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pilih Hari Audit:</span>
            </span>

            <button
              onClick={() => setSelectedTargetDay('tomorrow')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedTargetDay === 'tomorrow'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>Besok ({tomorrowDayName})</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-900 text-blue-200">H+1</span>
            </button>

            <button
              onClick={() => setSelectedTargetDay('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedTargetDay === 'today'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>Hari Ini ({currentDayName})</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-900 text-indigo-200">H</span>
            </button>

            <button
              onClick={() => setSelectedTargetDay('day_after')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedTargetDay === 'day_after'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>Lusa ({dayAfterDayName})</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900 text-purple-200">H+2</span>
            </button>

            {/* Direct Day Selector */}
            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(d => (
              <button
                key={d}
                onClick={() => setSelectedTargetDay(d)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  activeDayName === d && selectedTargetDay === d
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Standar Jeda: <strong className="text-amber-400 font-mono">≥ 24 Jam Istirahat</strong></span>
          </div>
        </div>
      </div>

      {/* Expandable Detail Section */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-5 bg-slate-900/90">
          {/* Supervisor Metric KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Schedules */}
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Rute {activeDayName}</span>
                <Truck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {readinessAnalysis.totalRoutes} <span className="text-xs font-normal text-slate-400">Jadwal</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="text-indigo-400 font-bold">{readinessAnalysis.totalOutbound} Luar Kota</span>
                <span>•</span>
                <span>{readinessAnalysis.totalLocal} Lokal</span>
              </div>
            </div>

            {/* Gap Rule Compliance */}
            <div className={`p-3.5 rounded-xl border ${
              readinessAnalysis.conflicts.length === 0
                ? 'bg-emerald-950/30 border-emerald-800/50'
                : 'bg-rose-950/30 border-rose-800/50'
            }`}>
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Kepatuhan Jeda 24H</span>
                <Clock className={`w-4 h-4 ${readinessAnalysis.conflicts.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div className="text-xl font-bold text-white flex items-center gap-2">
                <span>{readinessAnalysis.compliancePercent}%</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  readinessAnalysis.conflicts.length === 0 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {readinessAnalysis.conflicts.length === 0 ? 'Optimal' : `${readinessAnalysis.conflicts.length} Konflik`}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {readinessAnalysis.conflicts.length === 0 ? 'Semua supir istirahat cukup' : 'Terdapat supir berisiko kelelahan'}
              </div>
            </div>

            {/* Ferry Logistics Status */}
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Tiket Kapal (Bali)</span>
                <Ship className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {readinessAnalysis.ferryReady} / {readinessAnalysis.ferryRequired}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                {readinessAnalysis.ferryRequired === 0 ? (
                  <span className="text-slate-400">Tidak ada rute Bali hari ini</span>
                ) : readinessAnalysis.ferryReady === readinessAnalysis.ferryRequired ? (
                  <span className="text-emerald-400 font-medium">✅ Tiket ASDP Terpesan</span>
                ) : (
                  <span className="text-amber-400 font-medium">⚠️ Tiket Perlu Diverifikasi</span>
                )}
              </div>
            </div>

            {/* Standby Crew Availability */}
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Supir Cadangan Siap</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {readinessAnalysis.standbyDrivers.length} <span className="text-xs font-normal text-slate-400">Driver</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Siap menggantikan jika terjadi kendala
              </div>
            </div>
          </div>

          {/* Conflict Alert Box (Shown only if violations detected) */}
          {readinessAnalysis.conflicts.length > 0 && (
            <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 text-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Daftar Benturan Jadwal yang Perlu Penyesuaian Segera:</span>
                </div>
                <button
                  onClick={handleAutoResolveTargetConflicts}
                  className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Selesaikan Semua Benturan</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {readinessAnalysis.conflicts.map((conf, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-950/90 border border-rose-900/60 p-3 rounded-lg flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          {conf.driverName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {conf.gapHours ? `Jeda ${conf.gapHours} Jam` : 'Benturan'}
                        </span>
                      </div>

                      <p className="text-rose-200 text-[11px] leading-relaxed">
                        {conf.description}
                      </p>

                      <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800 space-y-1 font-mono">
                        <div>Jadwal Target: <strong className="text-white">{conf.destination}</strong> ({new Date(conf.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</div>
                        {conf.previousTrip && (
                          <div>Trip Sebelumnya: <strong className="text-slate-300">{conf.previousTrip.destination}</strong> ({new Date(conf.previousTrip.departureTime).toLocaleDateString()} {new Date(conf.previousTrip.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</div>
                        )}
                      </div>
                    </div>

                    {/* Quick Substitute Selection or Emergency Override */}
                    {conf.conflictType === 'out_of_town_restricted' ? (
                      <div className="pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleToggleEmergencyOverride(conf.scheduleId)}
                          className="w-full py-1.5 px-3 rounded bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>🚨 Aktifkan Override Darurat (Bypass Larangan)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">Pilih Pengganti:</span>
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleSwapDriver(conf.scheduleId, e.target.value);
                          }}
                          defaultValue=""
                          className="bg-slate-900 border border-rose-700/60 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer max-w-[180px] truncate"
                        >
                          <option value="" disabled>Pilih Driver Pengganti...</option>
                          {conf.recommendedSubstitutes.map(sub => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name} (⭐ Rekomendasi)
                            </option>
                          ))}
                          {readinessAnalysis.standbyDrivers.filter(d => !conf.recommendedSubstitutes.some(rs => rs.id === d.id)).map(sb => (
                            <option key={sb.id} value={sb.id}>
                              {sb.name} (Standby)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Operational Manifest & Driver Readiness Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">
                  Manifest Jadwal & Status Kesiapan Supir Hari {activeDayName}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({targetDaySchedules.length} Pengiriman Terdaftar)
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>≥ 24 Jam: Aman</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>&lt; 24 Jam: Benturan</span>
                </span>
              </div>
            </div>

            {targetDaySchedules.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Tidak ada jadwal pengiriman terdaftar untuk hari {activeDayName}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3 font-semibold">Area Kirim & Wilayah</th>
                      <th className="p-3 font-semibold">Jenis Rute</th>
                      <th className="p-3 font-semibold">Jam Berangkat</th>
                      <th className="p-3 font-semibold">Supir Ditugaskan</th>
                      <th className="p-3 font-semibold">Status Jeda Istirahat</th>
                      <th className="p-3 font-semibold">Armada</th>
                      <th className="p-3 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300">
                    {targetDaySchedules.map(sch => {
                      const isOutbound = isLuarKotaSchedule(sch);
                      const gapInfo = getScheduleGapDetails(sch);

                      return (
                        <tr key={sch.id} className="hover:bg-slate-800/30 transition">
                          {/* Area Kirim & Wilayah */}
                          <td className="p-3">
                            <div className="font-semibold text-white">
                              {sch.areaName || sch.store?.storeName || sch.storeId}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>{sch.store?.city || 'Banyuwangi'}, {sch.store?.province || 'Jatim'}</span>
                            </div>
                          </td>

                          {/* Jenis Rute */}
                          <td className="p-3">
                            {sch.isInterIsland ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                <Ship className="w-3 h-3" />
                                <span>Bali / Kapal</span>
                              </span>
                            ) : isOutbound ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                <Truck className="w-3 h-3" />
                                <span>Luar Kota (Jatim)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                <span>Lokal BWI</span>
                              </span>
                            )}
                          </td>

                          {/* Jam Berangkat */}
                          <td className="p-3 font-mono text-slate-300">
                            {new Date(sch.departureDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB
                          </td>

                          {/* Supir Ditugaskan */}
                          <td className="p-3">
                            {sch.crew ? (
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-semibold text-white">{sch.crew.name}</span>
                              </div>
                            ) : (
                              <span className="text-rose-400 font-bold italic">Belum Ada Supir</span>
                            )}
                          </td>

                          {/* Status Jeda Istirahat */}
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] border ${gapInfo.color}`}>
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{gapInfo.label}</span>
                            </span>
                          </td>

                          {/* Armada */}
                          <td className="p-3">
                            <div className="font-mono text-xs text-white">
                              {sch.fleet?.plateNumber || 'Belum Ada Truk'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {sch.fleet?.vehicleType || '-'}
                            </div>
                          </td>

                          {/* Aksi */}
                          <td className="p-3 text-right">
                            {onSelectSchedule && (
                              <button
                                onClick={() => onSelectSchedule(sch)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 text-[11px] font-semibold transition cursor-pointer"
                              >
                                Manifest
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Standby Crew Quick Drawer */}
          {readinessAnalysis.standbyDrivers.length > 0 && (
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-white font-bold">Kru Cadangan Siaga Hari {activeDayName}: </span>
                  <span className="text-slate-400">
                    {readinessAnalysis.standbyDrivers.map(d => d.name).join(', ')}
                  </span>
                </div>
              </div>

              {onOpenSimulation && (
                <button
                  onClick={onOpenSimulation}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Buka Simulasi Siklus Mingguan</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
