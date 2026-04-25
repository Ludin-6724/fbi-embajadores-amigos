"use client";

import { useState, useRef, useEffect } from "react";
import Hero from "@/components/sections/Hero";
import Comunidad from "@/components/sections/Comunidad";
import Rachas from "@/components/sections/Rachas";
import Tienda from "@/components/sections/Tienda";
import DashboardActions from "@/components/sections/DashboardActions";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import BottomNavbar, { TabType } from "@/components/ui/BottomNavbar";
import ProfileSection from "@/components/sections/ProfileSection";
import UpdatePrompt from "@/components/ui/UpdatePrompt";
import { createClient } from "@/lib/supabase/client";

/** Referencia estable: evita que `[]` nuevo en cada render dispare efectos en hijos. */
const EMPTY_POSTS: any[] = [];

export default function HomeClient({ initialUser, initialProfile, initialPosts = EMPTY_POSTS }: { initialUser: any, initialProfile: any, initialPosts?: any[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("feed");
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(new Set(["feed"]));

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabType;
    const validTabs: TabType[] = ["feed", "prayers", "streaks", "shop", "profile"];
    if (hash && validTabs.includes(hash)) {
      setActiveTab(hash);
      setVisitedTabs(prev => new Set([...prev, hash]));
    }
  }, []);

  const handleTabChange = (tab: TabType) => {
    if ((tab as string) === "publish") {
        window.dispatchEvent(new CustomEvent("fbi:open-publish-selector"));
        return;
    }
    setActiveTab(tab);
    setVisitedTabs(prev => {
        if (prev.has(tab)) return prev;
        return new Set([...prev, tab]);
    });
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleEvents = (e: any) => {
        if (e.type === "fbi:change-tab" && e.detail) {
          handleTabChange(e.detail as TabType);
        } else if (e.type === "fbi:prefetch-tab" && e.detail) {
          const tab = e.detail as TabType;
          setVisitedTabs(prev => {
            if (prev.has(tab)) return prev;
            return new Set([...prev, tab]);
          });
        }
    };
    window.addEventListener("fbi:change-tab", handleEvents);
    window.addEventListener("fbi:prefetch-tab", handleEvents);
    return () => {
      window.removeEventListener("fbi:change-tab", handleEvents);
      window.removeEventListener("fbi:prefetch-tab", handleEvents);
    };
  }, []);

  const renderContent = () => {
    if (!initialUser) {
      return (
        <>
          <Hero profile={null} />
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-cream/30 border-t border-gold/10">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 border border-gold/20 shadow-xl overflow-hidden animate-float">
              <img src="/logo-fbi.jpg" alt="FBI" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-navy-dark mb-4 drop-shadow-sm">Acceso a la Sede</h2>
            <p className="font-sans text-navy-dark/60 max-w-sm mb-10 leading-relaxed text-sm">
              Esta plataforma es exclusiva para los **Agentes de FBI Embajadores**. 
              Inicia sesión para sincronizar tus avances y ver las peticiones de la comunidad.
            </p>
            <button
              onClick={() => {
                  const supabase = createClient();
                  supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  });
              }}
              className="px-10 py-5 bg-navy-dark text-white font-sans font-bold rounded-full shadow-2xl hover:bg-gold hover:text-navy-dark transition-all flex items-center gap-4 active:scale-95 group"
            >
              <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 group-hover:filter-none" />
              Ingresar como Agente
            </button>
          </div>
        </>
      );
    }

    return (
      <div className="flex-1 flex flex-col pt-16">
        <div style={{ display: activeTab === "feed" ? "block" : "none" }}>
          <Hero profile={initialProfile} />
          <Comunidad initialTab="muro" hideTabs={true} initialProfile={initialProfile} isAllowedToFetch={visitedTabs.has("feed") && activeTab === "feed"} initialPosts={activeTab === "feed" ? initialPosts : EMPTY_POSTS} />
        </div>

        <div style={{ display: activeTab === "prayers" ? "block" : "none" }}>
          <Comunidad initialTab="oratorio" hideTabs={true} initialProfile={initialProfile} isAllowedToFetch={visitedTabs.has("prayers") && activeTab === "prayers"} />
        </div>

        <div style={{ display: activeTab === "streaks" ? "block" : "none" }}>
          <Rachas profile={initialProfile} isAllowedToFetch={visitedTabs.has("streaks") && activeTab === "streaks"} />
        </div>

        <div style={{ display: activeTab === "shop" ? "block" : "none" }}>
          <Tienda profile={initialProfile} isAllowedToFetch={visitedTabs.has("shop") && activeTab === "shop"} />
        </div>

        <div style={{ display: activeTab === "profile" ? "block" : "none" }}>
          <ProfileSection profile={initialProfile} />
        </div>
      </div>
    );
  };

  return (
    <>
      <Navbar initialUser={initialUser} initialProfile={initialProfile} />
      <main className="flex-1 flex flex-col bg-white pb-24">
        {initialProfile && <DashboardActions profile={initialProfile} hideVisuals={true} />}
        {renderContent()}
      </main>
      <Footer />
      {initialUser && <BottomNavbar activeTab={activeTab} onTabChange={handleTabChange} />}
      <UpdatePrompt />
    </>
  );
}
