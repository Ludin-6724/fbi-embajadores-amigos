import Hero from "@/components/sections/Hero";
import DashboardActions from "@/components/sections/DashboardActions";
import Comunidad from "@/components/sections/Comunidad";
import Rachas from "@/components/sections/Rachas";
import PendingRequestsBanner from "@/components/sections/PendingRequestsBanner";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings, Lock, Globe } from "lucide-react";

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const supabase = await createClient();
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  let profile = null;
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  profile = profileData;

  // Fetch Community
  const { data: community } = await supabase
    .from('communities')
    .select('*')
    .eq('id', id)
    .single();

  if (!community) {
    notFound();
  }

  const isOwner = community.owner_id === user.id;

  // Check if user is admin/founder member
  const { data: memberData } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', id)
    .eq('user_id', user.id)
    .single();

  const isAdmin = isOwner || ['admin', 'founder'].includes(memberData?.role ?? '');

  // Count pending requests for private communities (admin only)
  let pendingCount = 0;
  if (isAdmin && community.is_private) {
    const { count } = await supabase
      .from('community_join_requests')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', id)
      .eq('status', 'pending');
    pendingCount = count ?? 0;
  }

  return (
    <>
      <Navbar />

      {/* Floating nav row */}
      <div className="fixed top-24 left-4 md:left-8 z-50 flex flex-col gap-2">
        <Link
          href="/"
          className="bg-navy-dark text-white rounded-full px-5 py-2.5 flex items-center gap-2 shadow-lg hover:bg-navy-dark/90 transition-transform hover:-translate-y-0.5 border border-gold/30"
        >
          <ArrowLeft size={16} className="text-gold" />
          <span className="font-sans font-bold text-sm tracking-wide">Red Nacional</span>
        </Link>

        {/* Privacy badge */}
        <div className={`rounded-full px-4 py-1.5 flex items-center gap-1.5 text-xs font-bold font-sans shadow-sm border ${
          community.is_private
            ? 'bg-white text-navy-dark/70 border-navy-dark/20'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {community.is_private
            ? <><Lock size={11} /> Privado</>
            : <><Globe size={11} /> Público</>
          }
        </div>
      </div>

      {/* Settings button for owner/admin — top right */}
      {isAdmin && (
        <div className="fixed top-24 right-4 md:right-8 z-50">
          <Link
            href={`/c/${id}/settings`}
            className="bg-white text-navy-dark rounded-full px-5 py-2.5 flex items-center gap-2 shadow-lg hover:bg-cream transition-colors border border-gold/30"
          >
            <Settings size={16} className="text-gold" />
            <span className="font-sans font-bold text-sm tracking-wide">Configurar grupo</span>
          </Link>
        </div>
      )}

      <main className="flex-1 flex flex-col bg-white">
        <Hero profile={profile} community={community} />
        {profile && <DashboardActions profile={profile} isCommunity={true} />}

        {/* Pending requests banner for private communities */}
        {isAdmin && community.is_private && pendingCount > 0 && (
          <PendingRequestsBanner communityId={id} initialCount={pendingCount} />
        )}

        <div className="bg-light-gray/20 pt-10">
          <Comunidad communityId={id} />
          <Rachas communityId={id} />
        </div>
      </main>
      <Footer />
    </>
  );
}
