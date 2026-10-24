// Hand-drawn line icons for the eight core components and nutrition stats.
import type { CoreComponent } from '@shared/types';

type P = { size?: number; className?: string; strokeWidth?: number };
const S = ({ size = 22, className, strokeWidth = 1.5, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const CoreIcon = ({ id, ...p }: P & { id: CoreComponent }) => {
  switch (id) {
    case 'nuts':
      return <S {...p}><path d="M12 3c4 0 7 3.5 7 8.5S15.5 21 12 21 5 16.5 5 11.5 8 3 12 3Z" /><path d="M12 3c-1.5 3-1.5 15 0 18M8 8c2 1 6 1 8 0" /></S>;
    case 'fish':
      return <S {...p}><path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 6-2 4-4 6-7 6-4 0-8-2-11-6Z" /><path d="M14 6l3-3M14 18l3 3" /><circle cx="9" cy="11" r="0.8" fill="currentColor" /><path d="M3 12l4-2.5M3 12l4 2.5" /></S>;
    case 'olive-oil':
      return <S {...p}><path d="M10 3h4v3l2 3v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3V3Z" /><path d="M8 13c2 1 6 1 8 0" /></S>;
    case 'dairy':
      return <S {...p}><path d="M8 3h8v3l2 4v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9l2-4V3Z" /><path d="M6 10h12" /></S>;
    case 'vegetables':
      return <S {...p}><path d="M12 21c-5 0-8-3-8-8 0-4 3-7 8-9 5 2 8 5 8 9 0 5-3 8-8 8Z" /><path d="M12 4v17M12 11c-2-1-4-1-6 0M12 14c2-1 4-1 6 0" /></S>;
    case 'fruit':
      return <S {...p}><path d="M12 8c-4 0-7 3-7 7 0 3 2 6 5 6 1 0 1.5-.5 2-.5s1 .5 2 .5c3 0 5-3 5-6 0-4-3-7-7-7Z" /><path d="M12 8c0-2 1-4 3-5M12 8c-1-1-3-1.5-5-1" /></S>;
    case 'legumes':
      return <S {...p}><path d="M5 14c0-5 4-9 9-9 2 0 4 1 5 3-1 6-5 11-11 11-2 0-3-2-3-5Z" /><circle cx="9" cy="14" r="1.2" /><circle cx="13" cy="11" r="1.2" /><circle cx="16" cy="8" r="1.2" /></S>;
    case 'whole-grains':
      return <S {...p}><path d="M12 21V8" /><path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 8c3 0 5-2 5-5-3 0-5 2-5 5ZM12 13c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5ZM12 18c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 18c3 0 5-2 5-5-3 0-5 2-5 5Z" /></S>;
  }
};

export const Flame = (p: P) => <S {...p}><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-8 0 4-4 6-4 12 0 4 3 7 7 7Z" /></S>;
export const Protein = (p: P) => <S {...p}><path d="M7 7l10 10M9.5 4.5 4.5 9.5l3 3 5-5M14.5 11.5l5 5-5 5-5-5" /></S>;
export const Drop = (p: P) => <S {...p}><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" /></S>;
export const Wheat = (p: P) => <CoreIcon id="whole-grains" {...p} />;
export const Leaf = (p: P) => <S {...p}><path d="M4 20c0-9 6-15 16-16 0 10-6 16-16 16Z" /><path d="M4 20c4-6 8-9 12-11" /></S>;
export const Search = (p: P) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></S>;
export const ArrowStart = (p: P) => <S {...p}><path className="rtl:hidden" d="M19 12H5m7-7-7 7 7 7" /><path className="ltr:hidden" d="M5 12h14m-7-7 7 7-7 7" /></S>;
export const Globe = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></S>;
export const Check = (p: P) => <S {...p}><path d="m5 12 5 5L20 7" /></S>;
export const Plus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const Key = (p: P) => <S {...p}><circle cx="8" cy="14" r="4" /><path d="M11 11l9-9M16 6l2 2M13 9l2 2" /></S>;
export const Lock = (p: P) => <S {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>;
export const Grip = (p: P) => <S {...p}><circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" /></S>;
export const Image = (p: P) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-9 8" /></S>;
export const Sparkle = (p: P) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5Z" /></S>;
export const Wifi = (p: P) => <S {...p}><path d="M2 9c6-5 14-5 20 0M5 13c4-3 10-3 14 0M8.5 17c2-1.5 5-1.5 7 0" /><circle cx="12" cy="20" r="1" fill="currentColor" /></S>;

/** The Artisan Kitchen brand mark (from the original brand files). */
export function Monogram({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * (303.9/380.3)} viewBox="0 0 380.3 303.9" className={className} aria-hidden>
      <path d="M268.7,232.5c13.2-2.7,26.1,5.8,28.9,19.1,2.7,13.2-5.8,26.2-19,28.9-13.2,2.8-26.2-5.8-28.9-19-2.7-13.3,5.8-26.2,19.1-28.9h0Z" fill="var(--color-gold)" />
      <path d="M278.3,301.2l-1,2.4h103c-15.6-86.9-70.8-144.3-158.3-159,24.2-4.6,47.2-14.1,67.6-28C331.3,88.5,357,49.4,366.6.2c-6.1,0-12.3,0-18.4.1-30.3-.4-61.4-.2-91.7,0,2,.5,4.1,1.2,6.1,1.6,5.5,2.2,8.8,3.2,13.9,6.5,28.5,18.5,24.3,58.5,7.2,83.3-19.1,27.7-49.9,44-82.5,50.1-4.4-17.8-9.8-35.3-14.4-53.1-4.1-17.2-12.4-36.2-4.8-53.7,7.6-17.4,22.8-26.9,39.6-33.7l1.3-.2.2-.6c-7.8-.9-29.5-.2-38.5-.2-21.3-.5-43.7-.2-65,0-19,58.3-37.5,116.8-55.5,175.5l-14.7,47.1c-11.4,37.4-15.1,57.1-49.5,79.1,1.9,1.9,3,1.4,5.6,1.8h59.2c5-.5,19.2.3,21.8-1.2-35.2-12.3-42.2-42.6-26.4-74.1,17.8-35.4,46.4-53.1,82.6-65.8,5.5,18.9,9.9,38.8,15,57.9,9.1,34,21.5,63.9-20.8,80.9-1,.4-3.5,1-4,1.7,0,.9,4.1.5,4.6.5h84.5c12.9,0,27.6.5,40.3,0l1.2-2.2c-36.6-13.1-39.8-48-46.8-81l-14.4-70.4c35.9,2.9,69.2,20.1,92.4,47.8,28,32.9,37.7,90.8-16.6,103.2h0ZM79.2,182.9c-6.5,4.9-11.1,10.4-16.9,14.9l26.1-84c5.9-19.3,12.4-41.9,19.3-60.8,10.9,8.3,17.6,40.5,20.9,53.7,3.6,14.5,7.9,30.1,11.1,44.7-23.4,8.4-40.8,16.4-60.5,31.4h0Z" fill="currentColor" />
    </svg>
  );
}