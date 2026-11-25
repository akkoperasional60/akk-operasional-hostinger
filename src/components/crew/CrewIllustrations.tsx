import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type CrewArtName = 'truck' | 'tasks' | 'report' | 'history' | 'gauge' | 'shield' | 'fuel' | 'alert' | 'shop' | 'parcel' | 'camera' | 'crew' | 'success' | 'location' | 'offline';
const palettes: Record<CrewArtName, [string, string, string, string]> = {
  truck: ['#83baff','#2878ef','#1754bf','#e8f2ff'],
  tasks: ['#8ee6b9','#24aa76','#087b59','#e5faef'],
  report: ['#b9a6ff','#8263e1','#5439b6','#f1ebff'],
  history: ['#8ad9f9','#2c9acb','#1476a1','#e8f8fe'],
  gauge: ['#87b8ff','#377ce9','#1857bf','#eaf3ff'],
  shield: ['#8fe2c1','#26b587','#087d63','#e6f8f0'],
  fuel: ['#ffd58b','#ee9b2c','#b76c13','#fff3df'],
  alert: ['#ffb29b','#ed785c','#bd443c','#fff0ea'],
  shop: ['#b4a1ff','#8765e4','#6244b9','#f1ebff'],
  parcel: ['#fbd49c','#e8a459','#aa6428','#fff2e3'],
  camera: ['#88b9ff','#4479e5','#2a48ac','#ecf2ff'],
  crew: ['#90d9f9','#399fd2','#2169a5','#e9f8ff'],
  success: ['#a1e9bf','#21ae77','#0b7851','#e7f9ef'],
  location: ['#ffa9a0','#e76a67','#b7474b','#fff0ef'],
  offline: ['#d0dbe8','#8296b2','#566a88','#f0f4f8'],
};

/** Small original, layered vector illustrations; no downloaded icon packs or WebGL. */
export function CrewArt({ name, size = 48, className = '', active = false }: { name: CrewArtName; size?: number; className?: string; active?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [light, mid, deep, pale] = palettes[name];
  const grad = `${uid}-main`, shine = `${uid}-shine`, glass = `${uid}-glass`;
  const g = `url(#${grad})`, hi = `url(#${shine})`, lens = `url(#${glass})`;
  const reduced = useReducedMotion();
  let art: React.ReactNode;
  switch (name) {
    case 'truck': art = <>
      <path d="M7 23 42 16 53 24 53 45 7 48Z" fill={deep}/><path d="M7 23 42 16 53 24 18 31Z" fill={light}/>
      <path d="M7 23 18 31 18 48 7 43Z" fill={deep}/><path d="M18 31 53 24 53 45 18 52Z" fill={g}/>
      <path d="M21 34 49 29 49 42 21 47Z" fill="#fff" opacity=".91"/><path d="M24 37 42 34 42 38 24 41Z" fill={light}/>
      <path d="M50 29 59 27 67 35 67 48 53 53 50 45Z" fill={g}/><path d="M59 27 67 35 59 37 53 30Z" fill={light}/>
      <path d="M54 32 59 31 64 37 56 39Z" fill={lens}/><path d="M59 40 67 38 67 46 59 49Z" fill={deep}/>
      <path d="M62 44 67 43 67 46 62 47Z" fill="#fff1b3"/><path d="M18 49 54 43 64 48 54 53 18 56Z" fill="#284668"/>
      <ellipse cx="25" cy="52" rx="6" ry="8" transform="rotate(-10 25 52)" fill="#223956"/><ellipse cx="25" cy="52" rx="3" ry="4" fill="#9fb4d0"/>
      <ellipse cx="56" cy="49" rx="6" ry="8" transform="rotate(-10 56 49)" fill="#223956"/><ellipse cx="56" cy="49" rx="3" ry="4" fill="#9fb4d0"/>
    </>; break;
    case 'tasks': case 'report': art = <>
      <g transform="rotate(-8 36 33)">
        <rect x="17" y="12" width="42" height="48" rx="9" fill={deep}/><rect x="13" y="8" width="42" height="48" rx="9" fill={g}/>
        <rect x="18" y="15" width="32" height="35" rx="5" fill="#f9fcff"/>
        {name === 'tasks' ? <><rect x="26" y="5" width="17" height="12" rx="5" fill={deep}/><rect x="27" y="5" width="15" height="8" rx="4" fill={light}/><path d="m23 25 3 3 5-6m-8 15 3 3 5-6" fill="none" stroke={mid} strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M35 26h10M35 38h10" stroke="#bdcad9" strokeWidth="3" strokeLinecap="round"/></> : <><path d="M24 24h20M24 30h20M24 36h13M24 42h16" stroke="#ab9be0" strokeWidth="3" strokeLinecap="round"/><path d="m47 14 6 6-6 1Z" fill={light}/></>}
      </g>
      <circle cx="54" cy="48" r="12" fill={deep}/><circle cx="52" cy="45" r="12" fill={g}/><path d={name === 'tasks' ? 'm46 45 4 4 8-9' : 'M48 40h8M48 45h8M48 50h5'} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </>; break;
    case 'history': case 'gauge': art = <>
      <circle cx="38" cy="35" r="26" fill={deep}/><circle cx="33" cy="30" r="26" fill={g}/><circle cx="33" cy="30" r="20" fill="#f8fcff"/>
      <path d="M33 12v4M51 30h-4M33 48v-4M15 30h4" stroke={mid} strokeWidth="3" strokeLinecap="round"/>
      {name === 'history' ? <path d="M33 19v12l9 5" fill="none" stroke={deep} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/> : <><path d="M19 35a15 15 0 0 1 28 0" fill="none" stroke={light} strokeWidth="4" strokeLinecap="round"/><path d="m33 34 12-13" stroke={deep} strokeWidth="4" strokeLinecap="round"/><rect x="24" y="40" width="18" height="5" rx="2.5" fill={mid}/></>}
      <circle cx="33" cy="31" r="3" fill={deep}/><path d="M14 19A23 23 0 0 1 32 8" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round"/>
    </>; break;
    case 'shield': art = <>
      <path d="M36 6 61 16v18C61 46 50 55 36 62 20 54 13 44 13 32V17Z" fill={deep}/>
      <path d="M32 3 56 13v18C56 44 44 53 32 59 18 52 8 42 8 30V13Z" fill={g}/>
      <path d="M32 11 48 18v13c0 9-7 16-16 21-9-5-16-12-16-21V18Z" fill={hi}/>
      <path d="m22 31 7 7 14-16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    </>; break;
    case 'fuel': art = <>
      <path d="M49 20 59 27v15c0 8 8 8 8 0V23l-8-8" fill="none" stroke="#6a5260" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="17" y="8" width="32" height="48" rx="6" fill={deep}/><rect x="11" y="5" width="32" height="48" rx="6" fill={g}/>
      <rect x="17" y="12" width="21" height="16" rx="3" fill={lens}/><path d="M20 16h14" stroke="#e7f8ff" strokeWidth="2" strokeLinecap="round"/>
      <path d="M26 32c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z" fill="#fff7df"/>
      <path d="M7 50h40l5 6-39 5-6-5Z" fill={deep}/><path d="M7 50h40l5 6H13Z" fill={light}/><path d="m56 14 6-3 6 9-6 3Z" fill={mid}/>
    </>; break;
    case 'alert': art = <>
      <path d="M29 8q7-10 14 0l23 40q5 11-7 11H18Q6 59 11 48Z" fill={deep}/>
      <path d="M25 5q7-10 14 0l23 40q5 11-7 11H14Q2 56 7 45Z" fill={g}/>
      <path d="M27 10 11 42" stroke={light} strokeWidth="3" fill="none" strokeLinecap="round"/>
      <rect x="31" y="18" width="7" height="18" rx="3.5" fill="#fff"/><circle cx="34.5" cy="44" r="4" fill="#fff"/>
    </>; break;
    case 'shop': art = <>
      <path d="M12 25 53 19 62 28 62 53 21 60 12 51Z" fill={deep}/><path d="M12 25 21 33 21 60 12 51Z" fill={mid}/>
      <path d="M21 33 62 28v25l-41 7Z" fill="#f9f5ff"/><path d="M42 38 56 36v18l-14 2Z" fill={mid}/><path d="M26 40 38 38v10l-12 2Z" fill="#abdffc"/>
      <path d="M8 19 48 12 65 25 24 33Z" fill={g}/><path d="m17 17 40-7 7 6-40 8Zm17 13 40-7" fill="#fff" opacity=".65"/>
      <path d="M8 19v8q4 6 8 1l8 5v-9Z" fill={deep}/><path d="M24 33 65 25v8q-4 6-8 1-5 7-10 1-5 8-10 2-6 8-13 2Z" fill={g}/>
      <path d="M24 33 34 31v8q-5 5-10 0Zm20-4 10-2v8q-5 5-10 0Z" fill="#fff" opacity=".85"/>
    </>; break;
    case 'parcel': art = <>
      <path d="M8 19 35 7 64 19 36 33Z" fill={light}/><path d="M8 19 36 33v29L8 47Z" fill={g}/><path d="M36 33 64 19v28L36 62Z" fill={deep}/>
      <path d="m20 14 28 13 9-4-29-13Z" fill="#fff0cf"/><path d="m48 27 9-4v14l-9 5Z" fill="#ffedcd"/><path d="m13 35 16 8v8l-16-8Z" fill="#fff5dc"/><path d="m15 39 11 5" stroke={mid} strokeWidth="2"/>
    </>; break;
    case 'camera': art = <>
      <rect x="11" y="16" width="55" height="39" rx="10" fill={deep}/><rect x="6" y="11" width="55" height="39" rx="10" fill={g}/>
      <rect x="21" y="5" width="18" height="12" rx="5" fill={g}/><rect x="12" y="17" width="10" height="5" rx="2" fill="#e4efff"/>
      <circle cx="36" cy="31" r="17" fill={deep}/><circle cx="36" cy="30" r="13" fill="#bedcff"/><circle cx="36" cy="30" r="10" fill={lens}/><circle cx="32" cy="26" r="4" fill="#fff" opacity=".8"/>
    </>; break;
    case 'crew': art = <>
      <circle cx="48" cy="19" r="12" fill={deep}/><circle cx="46" cy="17" r="11" fill="#ffd4ad"/>
      <path d="M45 31c14 0 22 9 22 23H29c0-14 5-23 16-23Z" fill={deep}/><path d="M46 30c12 0 19 10 19 21H29c0-12 6-21 17-21Z" fill={g}/>
      <circle cx="25" cy="23" r="13" fill="#d99868"/><circle cx="22" cy="21" r="12" fill="#ffdfbb"/><path d="M10 18a12 12 0 0 1 25 0l-7-2-6-5-7 6Z" fill="#374c73"/>
      <path d="M22 36c14 0 24 9 24 24H4c0-14 7-24 18-24Z" fill={deep}/><path d="M21 35c13 0 22 9 22 21H3c0-12 7-21 18-21Z" fill={g}/><path d="m16 37 5 8 5-8" fill="#e6f5ff"/>
    </>; break;
    case 'success': art = <>
      <circle cx="38" cy="35" r="26" fill={deep}/><circle cx="33" cy="30" r="26" fill={g}/><circle cx="33" cy="30" r="19" fill={hi}/><path d="m21 30 8 8 16-17" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </>; break;
    case 'location': art = <>
      <path d="M38 5c15 0 26 12 26 26 0 15-18 29-26 34C30 60 12 46 12 31 12 16 23 5 38 5Z" fill={deep}/>
      <path d="M32 1C47 1 58 13 58 27c0 15-18 29-26 34C24 56 6 42 6 27 6 12 17 1 32 1Z" fill={g}/><circle cx="32" cy="27" r="12" fill="#fff3e9"/><circle cx="30" cy="25" r="6" fill={light}/>
    </>; break;
    case 'offline': art = <><path d="M16 45a13 13 0 0 1-1-26 19 19 0 0 1 36-2 15 15 0 1 1 4 30H16Z" fill={deep}/><path d="M12 41a13 13 0 0 1-1-26 19 19 0 0 1 36-2 15 15 0 1 1 4 30H12Z" fill={g}/><path d="m20 14 32 32" stroke="#fff" strokeWidth="5" strokeLinecap="round"/></>; break;
  }
  return <motion.span className={`cv69-art cv69-art--${name} ${className}`} data-art={name} aria-hidden="true" initial={false} animate={{scale: active && !reduced ? 1.06 : 1, y: active && !reduced ? -1 : 0}} transition={{type:'spring',stiffness:320,damping:24}}>
    <svg className="cv69-art-svg" width={size} height={size} viewBox="0 0 72 68" fill="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id={grad} x1="0" y1="0" x2="1" y2="1"><stop stopColor={light}/><stop offset=".48" stopColor={mid}/><stop offset="1" stopColor={deep}/></linearGradient><linearGradient id={shine} x1="0" y1="0" x2="0" y2="1"><stop stopColor={light}/><stop offset="1" stopColor={mid}/></linearGradient><linearGradient id={glass} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b9e5ff"/><stop offset=".55" stopColor="#6c9dcf"/><stop offset="1" stopColor="#294d83"/></linearGradient></defs>
      <ellipse cx="36" cy="62" rx="27" ry="4" fill="#17395c" opacity=".10"/>{art}
    </svg>
  </motion.span>;
}
