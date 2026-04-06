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
  const dashboardRef = useRef<any>(null);

  const handleTabChange = (tab: TabType) => {
    if (tab === "publish") {
        // Trigger the "Nueva Publicación" modal via DashboardActions or custom logic
        // For now, if we are in Feed or Prayers, we can show the creation form or trigger the modal.
        // Let's use a simpler way: if "publish" is clicked, trigger a modal.
        const event = new CustomEvent("fbi:open-post-modal");
        window.dispatchEvent(event);
        return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Helper to sync tab with "DashboardActions" if needed
  useEffect(() => {
    const handleOpenPost = () => {
        // If we want to open a specific modal
    };
    window.addEventListener("fbi:open-post-modal", handleOpenPost);
    return () => window.removeEventListener("fbi:open-post-modal", handleOpenPost);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "feed":
        return (
          <>
            <Hero profile={initialProfile} />
            <Comunidad initialTab="muro" />
            <SubCommunities />
          </>
        );
      case "prayers":
        return (
          <>
            <div className="pt-20 bg-cream"></div>
            <Comunidad initialTab="oratorio" />
          </>
        );
      case "streaks":
        return (
          <>
             <div className="pt-20 bg-cream"></div>
             <Rachas />
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
            hideVisuals={activeTab !== "feed"} 
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
