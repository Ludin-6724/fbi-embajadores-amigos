"use client";

import { useState, useEffect } from "react";
import { Download, X, Share, PlusSquare, ArrowUpCircle } from "lucide-react";
import { usePWA } from "../providers/PWAProvider";

export default function GlobalInstallPrompt() {
  const { isInstallable, promptInstall, isIOS } = usePWA();
  const [show, setShow] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Show after a small delay if installable and not dismissed this session
    const isDismissed = sessionStorage.getItem("fbi_install_dismissed");
    if ((isInstallable || isIOS) && !isDismissed) {
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isIOS]);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("fbi_install_dismissed", "true");
  };

  const handleInstallClick = () => {
    if (isIOS) {
        setShow(false);
        setShowIOSHint(true);
    } else {
        promptInstall();
        setShow(false);
    }
  };

  if (!show && !showIOSHint) return null;

  return (
    <>
      {/* Installation Banner - Top position as requested for better visibility */}
      {show && (
        <div className="fixed top-4 inset-x-0 z-[300] px-4 animate-slide-down">
          <div className="bg-white text-navy-dark p-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gold/20 flex items-center gap-4 relative overflow-hidden max-w-sm mx-auto">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gold" />
            
            <div className="w-12 h-12 rounded-2xl bg-gold/5 flex items-center justify-center flex-shrink-0 border border-gold/10">
                <img src="/logo-fbi.jpg" alt="FBI" className="w-8 h-8 object-contain mix-blend-multiply" />
            </div>
            
            <div className="flex-1 min-w-0">
                <p className="font-serif font-bold text-sm leading-tight text-navy-dark">¿Instalar App de FBI?</p>
                <p className="font-sans text-[10px] text-navy-dark/50 font-medium">Acceso rápido desde tu inicio.</p>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleInstallClick}
                    className="bg-navy-dark hover:bg-navy-dark/95 text-white font-sans font-bold text-[11px] px-4 py-2.5 rounded-full transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                    {isIOS ? "Cómo instalar" : "Instalar ahora"}
                </button>
                <button onClick={handleDismiss} className="text-navy-dark/20 hover:text-navy-dark transition-colors p-1">
                    <X size={18} />
                </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSHint && (
        <div className="fixed inset-0 bg-navy-dark/60 backdrop-blur-sm z-[400] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-slide-up relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gold" />
             
             <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-gold/5 flex items-center justify-center border border-gold/10">
                      <img src="/logo-fbi.jpg" alt="FBI" className="w-8 h-8 object-contain mix-blend-multiply" />
                   </div>
                   <div>
                      <h3 className="font-serif text-xl font-bold text-navy-dark">Instalar en tu iPhone</h3>
                      <p className="text-xs text-navy-dark/40 font-medium">Sigue estos pasos en Safari</p>
                   </div>
                </div>
                <button onClick={() => setShowIOSHint(false)} className="p-2 bg-navy-dark/5 rounded-full text-navy-dark/40 hover:text-navy-dark transition-colors">
                   <X size={20} />
                </button>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-5 p-5 bg-cream/30 rounded-3xl border border-gold/5">
                   <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-gold border border-gold/10 shadow-sm flex-shrink-0 text-sm">1</div>
                   <p className="font-sans text-sm text-navy-dark leading-relaxed">Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.</p>
                   <Share size={22} className="text-gold ml-auto animate-bounce" />
                </div>
                <div className="flex items-center gap-5 p-5 bg-cream/30 rounded-3xl border border-gold/5">
                   <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-gold border border-gold/10 shadow-sm flex-shrink-0 text-sm">2</div>
                   <p className="font-sans text-sm text-navy-dark leading-relaxed">Baja y selecciona <strong>Añadir a pantalla de inicio</strong>.</p>
                   <div className="w-10 h-10 rounded-xl bg-white border border-gold/10 flex items-center justify-center ml-auto shadow-sm">
                      <PlusSquare size={22} className="text-gold" />
                   </div>
                </div>
             </div>

             <button 
                onClick={() => setShowIOSHint(false)}
                className="w-full mt-10 bg-navy-dark text-white font-sans font-bold py-5 rounded-2xl shadow-[0_15px_30px_rgba(10,17,40,0.2)] active:scale-[0.98] transition-all"
             >
                ¡Entendido!
             </button>
             
             <p className="mt-6 text-center text-[10px] text-navy-dark/30 font-sans font-medium flex items-center justify-center gap-2">
                <ArrowUpCircle size={12} /> Requiere Safari en iOS
             </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-slide-down { animation: slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}
