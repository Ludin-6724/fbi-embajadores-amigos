import { Download } from "lucide-react";
import { usePWA } from "../providers/PWAProvider";

export default function InstallPWA() {
  const { isInstallable, promptInstall } = usePWA();

  if (!isInstallable) return null;

  return (
    <button
      onClick={promptInstall}
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
