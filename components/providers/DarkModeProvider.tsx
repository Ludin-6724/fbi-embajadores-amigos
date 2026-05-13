"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type DarkModeCtx = { dark: boolean; toggle: () => void };

const Ctx = createContext<DarkModeCtx>({ dark: false, toggle: () => {} });

export function useDarkMode() {
  return useContext(Ctx);
}

export default function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem("dark-mode") === "true");
    } catch {}
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("dark-mode", String(dark));
    } catch {}
  }, [dark]);

  const toggle = useCallback(() => setDark(d => !d), []);

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}
