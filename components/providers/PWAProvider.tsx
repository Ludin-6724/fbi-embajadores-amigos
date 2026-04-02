"use client";

import { useEffect } from "react";

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Force update: unregister old SW, then register fresh one
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.update(); // Force check for new SW file
        });
      });

      navigator.serviceWorker
        .register(`/sw.js?v=${Date.now()}`) // Cache-bust the SW file itself
        .then((registration) => {
          console.log("SW registered:", registration.scope);

          // Force the new SW to activate immediately
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "activated") {
                  console.log("New SW activated — reloading for fresh content");
                  // Only reload if this is genuinely a new SW taking over
                  if (navigator.serviceWorker.controller) {
                    window.location.reload();
                  }
                }
              });
            }
          });

          // Request notification permission after 5s
          if ("Notification" in window && Notification.permission === "default") {
            setTimeout(() => {
              Notification.requestPermission().then((permission) => {
                console.log("Notification permission:", permission);
              });
            }, 5000);
          }
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    }
  }, []);

  return <>{children}</>;
}
