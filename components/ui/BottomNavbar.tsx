"use client";

import { Home, Heart, PlusCircle, Flame, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabType = "feed" | "prayers" | "publish" | "streaks" | "groups" | "profile";

interface BottomNavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function BottomNavbar({ activeTab, onTabChange }: BottomNavbarProps) {
  const tabs = [
    { id: "feed" as TabType, icon: Home, label: "Muro" },
    { id: "prayers" as TabType, icon: Heart, label: "Oración" },
    { id: "publish" as TabType, icon: PlusCircle, label: "Publicar", isCenter: true },
    { id: "streaks" as TabType, icon: Flame, label: "Rachas" },
    { id: "profile" as TabType, icon: User, label: "Perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white/97 backdrop-blur-md border-t border-gold/20 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="pb-[env(safe-area-inset-bottom,0px)]">
        <div className="max-w-4xl mx-auto flex items-center justify-around h-16 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            const handlePrefetch = () => {
              if (!isActive) {
                window.dispatchEvent(new CustomEvent("fbi:prefetch-tab", { detail: tab.id }));
              }
            };

            if (tab.isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  onMouseEnter={handlePrefetch}
                  onTouchStart={handlePrefetch}
                  className="relative -top-4 flex flex-col items-center justify-center min-w-[64px] group"
                  aria-label={tab.label}
                >
                  <div className="w-14 h-14 bg-navy-dark group-hover:bg-gold rounded-full flex items-center justify-center shadow-xl transform active:scale-95 transition-all border-4 border-white">
                    <Icon size={28} className="text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-navy-dark mt-1">{tab.label}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                onMouseEnter={handlePrefetch}
                onTouchStart={handlePrefetch}
                aria-label={tab.label}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1 transition-all min-w-[50px] group",
                  isActive ? "text-gold" : "text-navy-dark/40 hover:text-navy-dark/70"
                )}
              >
                <div className={cn(
                  "relative p-2 rounded-xl transition-all",
                  isActive ? "bg-gold/10" : "group-hover:bg-cream"
                )}>
                  <Icon
                    size={22}
                    className={cn("transition-all", isActive ? "scale-110" : "")}
                  />
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-gold rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium leading-none mt-0.5 transition-all",
                  isActive ? "font-bold text-gold" : ""
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
