"use client";

import { useEffect } from "react";

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);

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
