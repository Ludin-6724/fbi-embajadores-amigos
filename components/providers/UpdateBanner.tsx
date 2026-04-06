"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const APP_VERSION = "2.2.0";
const STORAGE_KEY = "fbi_last_seen_version";

const UPDATES = [
  "Los posts ahora muestran los últimos comentarios directamente",
  "Input de comentario siempre visible en cada post",
  "Tiempo relativo en publicaciones (hace 2h, hace 3d…)",
  "La plataforma carga más rápido con menos consumo de datos",
];

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== APP_VERSION) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-2rem)] max-w-sm animate-slide-up">
      <div className="bg-navy-dark text-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Gold accent bar */}
        <div className="h-1 bg-gradient-to-r from-gold/40 via-gold to-gold/40" />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-gold flex-shrink-0" />
              <p className="font-serif font-bold text-base leading-tight">
                Actualización v{APP_VERSION}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>

          <ul className="space-y-1.5 mb-4">
            {UPDATES.map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/80 font-sans leading-snug">
                <span className="text-gold mt-0.5 flex-shrink-0">✦</span>
                {u}
              </li>
            ))}
          </ul>

          <button
            onClick={dismiss}
            className="w-full py-2.5 bg-gold hover:bg-gold/90 text-white font-sans font-bold text-sm rounded-full transition-colors"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}
