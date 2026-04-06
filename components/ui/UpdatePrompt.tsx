"use client";

import { useState, useEffect } from "react";
import { RefreshCw, X, Download, Share, Zap } from "lucide-react";

// ESTA VERSIÓN DEBE COINCIDIR CON /public/version.json PARA QUE NO SALTE EL AVISO
const APP_VERSION = "2.5.0"; 

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

    // 2. Check version against server
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        // Si la versión del servidor es superior a la local, mostramos el aviso
        if (data.version && data.version !== APP_VERSION) {
          setShow(true);
        }
      } catch (e) {
        console.error("Error checking version:", e);
      }
    };

    // Check after 3s
    const initialDelay = setTimeout(checkVersion, 3000);
    const interval = setInterval(checkVersion, 10 * 60 * 1000); // 10 min
    
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    if (typeof window !== "undefined") {
      // Limpiar cachés de Service Worker si existen
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) registration.unregister();
        });
      }
      // Hard reload con cache busting
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now() + window.location.hash;
    }
  };

  if (!show && !showIOSHint) {
    return null;
  }

  return (
    <>
      {show && (
        <div className="fixed bottom-24 inset-x-0 z-[200] px-4 animate-fade-in-up">
          <div className="bg-navy-dark text-white p-4 rounded-2xl shadow-2xl border border-gold/30 flex items-center gap-3 max-w-sm mx-auto">
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="text-gold animate-spin-slow" size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-serif font-bold text-xs leading-tight">Actualización Disponible</p>
                <p className="font-sans text-[10px] text-white/70 truncate tracking-tight">Version {APP_VERSION}+ detectada. Pulsa para aplicar.</p>
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

      {showIOSHint && (
          <div className="fixed inset-0 bg-navy-dark/60 backdrop-blur-sm z-[300] flex items-end p-4">
              <div className="bg-white w-full rounded-3xl p-6 shadow-2xl animate-fade-in-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-serif text-xl font-bold text-navy-dark">Instalar en iPhone</h3>
                      <button onClick={() => setShowIOSHint(false)}><X size={24} className="text-navy-dark/40" /></button>
                  </div>
                  <div className="space-y-6">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center font-bold text-gold border border-gold/20">1</div>
                          <p className="font-sans text-sm text-navy-dark">Toca el botón <strong>Compartir</strong> en Safari.</p>
                          <Share size={20} className="text-gold ml-auto" />
                      </div>
                  </div>
                  <button onClick={() => setShowIOSHint(false)} className="w-full mt-8 bg-navy-dark text-white font-sans font-bold py-4 rounded-2xl">Entendido</button>
              </div>
          </div>
      )}
      
      <style jsx>{`
        .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-in-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
