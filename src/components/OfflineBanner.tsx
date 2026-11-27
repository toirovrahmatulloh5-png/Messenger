import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { TRANSLATIONS, type Lang } from '../i18n.ts';

interface OfflineBannerProps {
  lang: Lang;
}

export function OfflineBanner({ lang }: OfflineBannerProps) {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[65] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#D97706] text-white text-xs font-medium shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{TRANSLATIONS[lang].offlineBanner}</span>
    </div>
  );
}
