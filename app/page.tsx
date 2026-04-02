import Hero from "@/components/sections/Hero";
import DashboardActions from "@/components/sections/DashboardActions";
import Comunidad from "@/components/sections/Comunidad";
import Rachas from "@/components/sections/Rachas";
import SubCommunities from "@/components/sections/SubCommunities";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // getUser() is the correct method once middleware refreshes cookies
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  return (
    <>
      <Navbar initialUser={user} initialProfile={profile} />
      <main className="flex-1 flex flex-col bg-white">
        <Hero profile={profile} />
        {profile && <DashboardActions profile={profile} isCommunity={false} />}
        <Comunidad />
        <Rachas />
        <SubCommunities />
      </main>
      <Footer />
    </>
  );
}
