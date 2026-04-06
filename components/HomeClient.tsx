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
      <BottomNavbar activeTab={activeTab} onTabChange={handleTabChange} />
      <UpdatePrompt />
    </>
  );
}
