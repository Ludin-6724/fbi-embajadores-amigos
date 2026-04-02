"use client";

import { useState, useEffect } from "react";
import { Download, Laptop } from "lucide-react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-cream/70 transition-colors group/install"
    >
      <div className="w-8 h-8 rounded-xl bg-gold/8 flex items-center justify-center flex-shrink-0 group-hover/install:bg-gold/15 transition-colors">
        <Download size={15} className="text-gold" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-sans text-sm font-semibold text-navy-dark group-hover/install:text-gold transition-colors">
          Instalar App
        </p>
        <p className="font-sans text-[11px] text-navy-dark/45 truncate">
          Usar en pantalla de inicio
        </p>
      </div>
    </button>
  );
}
