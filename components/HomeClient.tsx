"use client";

import { useState, useRef, useEffect } from "react";
import Hero from "@/components/sections/Hero";
import Comunidad from "@/components/sections/Comunidad";
import Rachas from "@/components/sections/Rachas";
import DashboardActions from "@/components/sections/DashboardActions";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import BottomNavbar, { TabType } from "@/components/ui/BottomNavbar";
import ProfileSection from "@/components/sections/ProfileSection";
import SubCommunities from "@/components/sections/SubCommunities";
import UpdatePrompt from "@/components/ui/UpdatePrompt";
import { createClient } from "@/lib/supabase/client";

export default function HomeClient({ initialUser, initialProfile }: { initialUser: any, initialProfile: any }) {
  const [activeTab, setActiveTab] = useState<TabType>("feed");
  
  // Sync tab with URL hash on mount and on changes
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabType;
    const validTabs: TabType[] = ["feed", "prayers", "streaks", "groups", "profile"];
    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
    }
  }, []);
  const dashboardRef = useRef<any>(null);

  const handleTabChange = (tab: TabType) => {
    if (tab === "publish") {
        const event = new CustomEvent("fbi:open-publish-selector");
        window.dispatchEvent(event);
        return;
    }
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Helper to sync tab with "DashboardActions" if needed
  useEffect(() => {
    const handleOpenPost = () => {
        // If we want to open a v2 selector 
    };
    const handleChangeTab = (e: any) => {
        if (e.detail) handleTabChange(e.detail as TabType);
    };

    window.addEventListener("fbi:open-publish-selector", handleOpenPost);
    window.addEventListener("fbi:change-tab", handleChangeTab);
    return () => {
        window.removeEventListener("fbi:open-publish-selector", handleOpenPost);
        window.removeEventListener("fbi:change-tab", handleChangeTab);
    };
  }, []);

  const renderContent = () => {
    if (!initialUser) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center bg-cream/30 pt-20">
          <div className="w-24 h-24 bg-gold/10 rounded-full flex items-center justify-center mb-6 border border-gold/20 shadow-inner">
            <img src="/logo-fbi.jpg" alt="FBI" className="w-16 h-16 object-contain mix-blend-multiply opacity-80" />
          </div>
          <h2 className="font-serif text-3xl font-bold text-navy-dark mb-4">Acceso Reservado</h2>
          <p className="font-sans text-navy-dark/60 max-w-sm mb-8 leading-relaxed">
            Esta plataforma es exclusiva para los **Agentes de FBI Embajadores**. 
            Inicia sesión para ver las novedades, peticiones de oración y rachas de la comunidad.
          </p>
          <button
            onClick={() => {
                const supabase = createClient();
                supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                });
            }}
            className="px-8 py-4 bg-navy-dark text-white font-sans font-bold rounded-full shadow-xl hover:bg-navy-dark/90 transition-all flex items-center gap-3 active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4 brightness-0 invert" />
            Acceder como Agente
          </button>
          
          <div className="mt-12 p-4 bg-white/50 rounded-2xl border border-gold/10 max-w-xs">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gold mb-1">Privacidad Total</p>
            <p className="text-[11px] text-navy-dark/40 font-sans italic">
              "Confesaos vuestras ofensas unos a otros..." - Santiago 5:16
            </p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "feed":
        return (
          <>
            <Hero profile={initialProfile} />
            <Comunidad initialTab="muro" hideTabs={true} />
            <SubCommunities />
          </>
        );
      case "prayers":
        return (
          <>
            <div className="pt-20 bg-cream"></div>
            <Comunidad initialTab="oratorio" hideTabs={true} />
          </>
        );
      case "streaks":
        return (
          <>
             <div className="pt-20 bg-cream"></div>
             <Rachas />
          </>
        );
      case "groups":
        return (
          <>
            <div className="pt-20 bg-white"></div>
            <SubCommunities />
          </>
        );
      case "profile":
        return (
          <>
            <div className="pt-20 bg-white"></div>
            <ProfileSection profile={initialProfile} />
          </>
        );
      default:
        return <Hero profile={initialProfile} />;
    }
  };

  return (
    <>
      <Navbar initialUser={initialUser} initialProfile={initialProfile} />
      <main className="flex-1 flex flex-col bg-white pb-20 md:pb-0">
        {initialProfile && (
          <DashboardActions 
            profile={initialProfile} 
            hideVisuals={true} 
          />
        )}
        {renderContent()}
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
      {initialUser && <BottomNavbar activeTab={activeTab} onTabChange={handleTabChange} />}
      <UpdatePrompt />
    </>
  );
}
