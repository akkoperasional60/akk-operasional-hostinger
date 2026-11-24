import React, { Suspense, useState } from 'react';
import type { UserProfile } from '../../types';
import { logisticsStore } from '../../services/store';
import CrewFieldApp from './CrewFieldApp';

// The mature operational module remains accessible for workflows not yet
// migrated (formal Surat Jalan, existing photos/PIN/shift flows). We do not
// mount it behind the new UI: doing that would start duplicate GPS/subscriptions.
const LegacyDriverView = React.lazy(() => import('../DriverMobileView').then(m => ({ default: m.DriverMobileView })));

interface Props {
  currentUser?: UserProfile;
  initialDriverId?: string;
  onBackToPortal?: () => void;
}

export const CrewPortalGateway: React.FC<Props> = ({ currentUser, ...legacyProps }) => {
  const user = currentUser || logisticsStore.getCurrentUser();
  const [showFull, setShowFull] = useState(false);
  const staff = user?.role === 'driver' || user?.role === 'crew_helper';

  if (!staff || showFull) {
    return <Suspense fallback={<div className="mx-auto max-w-sm p-6 text-center text-sm text-slate-500">Membuka fitur pengiriman...</div>}>
      {showFull && staff && <button type="button" onClick={() => setShowFull(false)} className="fixed bottom-4 left-4 z-[24000] flex h-11 items-center rounded-2xl bg-blue-600 px-4 text-[12px] font-bold text-white shadow-xl">Kembali ke Tampilan Baru</button>}
      <LegacyDriverView currentUser={user} {...legacyProps} />
    </Suspense>;
  }
  return <CrewFieldApp currentUser={user} onOpenClassic={() => setShowFull(true)} />;
};

export default CrewPortalGateway;
