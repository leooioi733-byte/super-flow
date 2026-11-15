import React, { useState } from 'react';
import { Check, Download, Share2, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'topbar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#38d9c8]/40 bg-[#2596A6]/15 px-3 py-1.5 text-xs font-medium text-[#38d9c8]">
          <Check className="h-3.5 w-3.5" />
          <span>Instalado</span>
        </span>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'settings'
            ? 'inline-flex items-center gap-2 rounded-lg border border-[#38d9c8]/60 bg-[#2596A6]/30 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2596A6]/50'
            : 'inline-flex h-9 items-center gap-2 rounded-lg border border-[#38d9c8]/45 bg-[#071726]/65 px-3 text-xs font-medium tracking-wide text-white/95 transition-all duration-200 hover:border-[#38d9c8] hover:bg-[#0B3C5D]/85 sm:h-10 sm:px-3.5'
        }
      >
        <Download className="h-3.5 w-3.5 text-[#38d9c8]" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-[#071726]/60 px-3 text-xs font-medium text-white/90 transition-colors hover:border-white/35 hover:bg-[#071726]/85 sm:h-10"
        >
          <Share2 className="h-3.5 w-3.5 text-[#2596A6]" />
          <span>Instalar</span>
        </button>

        {showGuide && (
          <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#071726]/80 p-4">
            <div className="w-full max-w-sm rounded-xl border border-white/15 bg-[#071726]/95 p-5 text-white shadow-2xl">
              <h3 className="font-display text-lg font-bold">Instalar FLOW no iPhone / iPad</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                1. Toque no botão <strong className="text-white">Compartilhar</strong> na barra do
                Safari.
                <br />
                2. Role para baixo e toque em{' '}
                <strong className="text-white">Adicionar à Tela de Início</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-4 w-full rounded-lg border border-white/15 bg-white/10 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback inside Settings when Chrome hasn't emitted beforeinstallprompt yet (e.g. embedded preview)
  if (variant === 'settings') {
    return (
      <span className="text-right text-[11px] text-white/60">
        Menu do Chrome (⋮) → Instalar app
      </span>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#e68a5c]/45 bg-[#071726]/90 px-3 py-1.5 text-xs font-medium text-[#E7DCC8] shadow-lg">
      <WifiOff className="h-3.5 w-3.5 text-[#e68a5c]" />
      <span>Modo Offline — usando dados em cache</span>
    </div>
  );
};
