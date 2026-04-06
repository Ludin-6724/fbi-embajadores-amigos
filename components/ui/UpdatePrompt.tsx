"use client";

import { useState, useEffect } from "react";
import { RefreshCw, X, Download, Share } from "lucide-react";

const APP_VERSION = "2.0.6"; // Local version

export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // 1. Detect if IOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    
    setIsIOS(isIOSDevice && !isStandalone);

    // 2. Check version
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        const data = await res.json();
        if (data.version && data.version !== APP_VERSION) {
          setShow(true);
        }
      } catch (e) {
        console.error("Error checking version:", e);
      }
    };

    // Check on mount
    checkVersion();
    
    // Check every 30 minutes
    const interval = setInterval(checkVersion, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  if (!show && !showIOSHint) return null;

  return (
    <>
      {/* Update Notification */}
      {show && (
        <div className="fixed bottom-24 left-4 right-4 z-[200] max-w-sm mx-auto animate-bounce-in">
          <div className="bg-navy-dark text-white p-4 rounded-2xl shadow-2xl border border-gold/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="text-gold animate-spin-slow" size={24} />
            </div>
            <div className="flex-1">
                <p className="font-serif font-bold text-sm leading-tight">Nueva versión disponible</p>
                <p className="font-sans text-[11px] text-white/70">Instala las mejoras de hoy.</p>
            </div>
            <button 
                onClick={handleUpdate}
                className="bg-gold hover:bg-gold/90 text-navy-dark font-sans font-bold text-xs px-4 py-2 rounded-full transition-all shadow-md active:scale-95"
            >
                Actualizar
            </button>
            <button onClick={() => setShow(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* iOS Install Hint Modal (if needed) */}
      {showIOSHint && (
          <div className="fixed inset-0 bg-navy-dark/60 backdrop-blur-sm z-[300] flex items-end p-4">
              <div className="bg-white w-full rounded-3xl p-6 shadow-2xl animate-slide-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-serif text-xl font-bold text-navy-dark">Instalar en iPhone</h3>
                      <button onClick={() => setShowIOSHint(false)}><X size={24} className="text-navy-dark/40" /></button>
                  </div>
                  <div className="space-y-6">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center font-bold text-gold border border-gold/20">1</div>
                          <p className="font-sans text-sm text-navy-dark">Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.</p>
                          <Share size={20} className="text-gold ml-auto" />
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center font-bold text-gold border border-gold/20">2</div>
                          <p className="font-sans text-sm text-navy-dark">Baja y selecciona <strong>Añadir a pantalla de inicio</strong>.</p>
                          <PlusSquareIcon />
                      </div>
                  </div>
                  <button 
                    onClick={() => setShowIOSHint(false)}
                    className="w-full mt-8 bg-navy-dark text-white font-sans font-bold py-4 rounded-2xl shadow-lg"
                  >
                    Entendido
                  </button>
              </div>
          </div>
      )}
      
      <style jsx>{`
        @keyframes bounce-in {
            0% { transform: translateY(20px) scale(0.9); opacity: 0; }
            50% { transform: translateY(-5px) scale(1.02); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}

function PlusSquareIcon() {
    return (
        <div className="w-8 h-8 rounded-lg bg-cream border border-gold/20 flex items-center justify-center ml-auto">
            <div className="relative w-4 h-4 border-2 border-gold rounded-sm flex items-center justify-center">
                <div className="absolute w-2.5 h-0.5 bg-gold" />
                <div className="absolute w-0.5 h-2.5 bg-gold" />
            </div>
        </div>
    )
}
