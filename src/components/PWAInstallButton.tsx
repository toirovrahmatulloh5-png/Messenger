import { useState } from 'react';
import { Download, Monitor, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { TRANSLATIONS, type Lang } from '../i18n.ts';

interface PWAInstallButtonProps {
  lang: Lang;
  alwaysShowGuideFallback?: boolean;
  compact?: boolean;
}

export function PWAInstallButton({
  lang,
  alwaysShowGuideFallback = false,
  compact = false,
}: PWAInstallButtonProps) {
  const t = TRANSLATIONS[lang];
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  if (!isInstallable && !isIOS && !alwaysShowGuideFallback) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title={isIOS ? t.installOnIOS : t.installApp}
        className={
          compact
            ? 'w-9 h-9 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0'
            : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1D2733] hover:bg-[#253342] border border-white/[0.08] text-xs font-medium text-[#EBF0F5] transition-colors cursor-pointer whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4 text-[#6AB2F2] shrink-0" />
        {!compact && <span>{isIOS && !isInstallable ? t.installOnIOS : t.installApp}</span>}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-[#151E27] border border-white/[0.08] rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="font-display text-base font-semibold text-white">
                {t.installGuideTitle}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label={t.close}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-[#D1DCE6]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0E141B] border border-white/[0.05]">
                <Smartphone className="w-4 h-4 text-[#34C77B] mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">{t.installGuideAndroid}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0E141B] border border-white/[0.05]">
                <Smartphone className="w-4 h-4 text-[#6AB2F2] mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">{t.installGuideIOS}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0E141B] border border-white/[0.05]">
                <Monitor className="w-4 h-4 text-[#8FA0B2] mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">{t.installGuideWindows}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-2.5 px-4 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
