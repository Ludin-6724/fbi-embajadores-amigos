"use client";

import { useEffect } from "react";

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("SW registered:", registration.scope);

            // Check for updates on register
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("New content is available; please refresh.");
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.log("SW registration failed:", error);
          });
      });
    }

    // 2. Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Store event globally for components like InstallPWA to use
      (window as any).deferredPrompt = e;
      console.log("PWA: BeforeInstallPrompt event captured");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 3. Request Notifications
    if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => {
            Notification.requestPermission();
        }, 10000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  return <>{children}</>;
}
