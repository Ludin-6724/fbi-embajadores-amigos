"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface PWAContextType {
  deferredPrompt: any;
  isInstallable: boolean;
  promptInstall: () => Promise<void>;
  isIOS: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error("usePWA must be used within a PWAProvider");
  }
  return context;
}

export default function PWAProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Detect device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsIOS(isIOSDevice && !isStandalone);

    // 2. Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("SW registered:", registration.scope);
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

    // 3. Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log("PWA: BeforeInstallPrompt event captured at root");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. Request Notifications
    if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => {
            Notification.requestPermission();
        }, 10000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <PWAContext.Provider value={{ deferredPrompt, isInstallable, promptInstall, isIOS }}>
      {children}
    </PWAContext.Provider>
  );
}
