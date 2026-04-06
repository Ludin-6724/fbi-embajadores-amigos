"use client";

import { Home, Heart, PlusCircle, Flame, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabType = "feed" | "prayers" | "publish" | "streaks" | "groups" | "profile";

interface BottomNavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function BottomNavbar({ activeTab, onTabChange }: BottomNavbarProps) {
  // New 5-tab layout for perfect centering of "Publicar"
  const tabs = [
    { id: "feed" as TabType, icon: Home, label: "Muro" },
    { id: "prayers" as TabType, icon: Heart, label: "Oración" },
    { id: "publish" as TabType, icon: PlusCircle, label: "Publicar", isCenter: true },
    { id: "streaks" as TabType, icon: Flame, label: "Rachas" },
    { id: "profile" as TabType, icon: User, label: "Perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-lg border-t border-light-gray shadow-2xl md:hidden pb-safe-area">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -top-3 flex flex-col items-center justify-center min-w-[64px]"
              >
                <div className="w-14 h-14 bg-gold rounded-full flex items-center justify-center shadow-lg transform active:scale-95 transition-all border-4 border-white">
                  <Icon size={28} className="text-white" />
                </div>
                <span className="text-[10px] font-bold text-gold mt-1">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 transition-all min-w-[50px]",
                isActive ? "text-gold" : "text-navy-dark/40"
              )}
            >
              <Icon 
                size={22} 
                className={cn(
                    "transition-all mb-1",
                    isActive ? "scale-110" : ""
                )} 
              />
              <span className={cn(
                "text-[10px] font-medium leading-none",
                isActive ? "font-bold" : ""
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
