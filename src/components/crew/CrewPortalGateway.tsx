import React, { Suspense, useState } from 'react';
import type { UserProfile } from '../../types';
import { logisticsStore } from '../../services/store';
import CrewFieldApp from './CrewFieldApp';
import CrewAdminPortal from './CrewAdminPortal';

// V70: every authorized portal entry uses the modern UI. Keep the legacy
// operational workflows available only by explicit navigation from a crew account.
const LegacyDriverView = React.lazy(() => import('../DriverMobileView').then(m => ({ default: m.DriverMobileView })));

interface Props {
  currentUser?: UserProfile;
  initialDriverId?: string;
  onBackToPortal?: () => void;
}

export const CrewPortalGateway: React.FC<Props> = ({ currentUser, ...legacyProps }) => {
  const user = currentUser || logisticsStore.getCurrentUser();
  const [classicForUser, setClassicForUser] = useState<string | null>(null);
  if (!user || user.status !== 'approved') {
    return <div role="status" className="p-6 text-center text-sm text-slate-500">Akun belum memiliki akses Portal Driver.</div>;
  }
  const staff = user.role === 'driver' || user.role === 'crew_helper';
  if (!staff) return <CrewAdminPortal key={user.id} currentUser={user}/>;
  if (classicForUser === user.id) {
    return <Suspense fallback={<div className="mx-auto max-w-sm p-6 text-center text-sm text-slate-500">Membuka fitur pengiriman...</div>}>
      <button type="button" onClick={() => setClassicForUser(null)} className="fixed bottom-4 left-4 z-[24000] flex h-11 items-center rounded-2xl bg-blue-600 px-4 text-[12px] font-bold text-white shadow-xl">Kembali ke Tampilan Baru</button>
      <LegacyDriverView currentUser={user} {...legacyProps}/>
    </Suspense>;
  }
  return <CrewFieldApp key={user.id} currentUser={user} onOpenClassic={() => setClassicForUser(user.id)}/>;
};
export default CrewPortalGateway;
