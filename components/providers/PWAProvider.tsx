"use client";

import { useEffect } from "react";

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Registrar Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("SW registered:", registration.scope);
            
            // 2. Pedir permiso para notificaciones si el SW está listo
            if ("Notification" in window) {
              if (Notification.permission === "default") {
                // Pequeño delay para no molestar al cargar inmediatamente
                setTimeout(() => {
                   Notification.requestPermission().then((permission) => {
                    console.log("Notification permission:", permission);
                  });
                }, 5000);
              }
            }
          })
          .catch((error) => {
            console.log("SW registration failed:", error);
          });
      });
    }

    // 3. Manejar evento de instalación (para Chrome/Android)
    const handleBeforeInstallPrompt = (e: any) => {
      // Evitar que Chrome muestre el prompt automático por ahora
      // e.preventDefault();
      console.log("PWA install prompt available");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  return <>{children}</>;
}
