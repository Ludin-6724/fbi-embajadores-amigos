import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import ProfileSection from "@/components/sections/ProfileSection"
import Navbar from "@/components/ui/Navbar"
import Footer from "@/components/ui/Footer"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> | { username: string } }) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const resolvedParams = await params;
  const username = decodeURIComponent(resolvedParams.username);

  const { data: { user } } = await supabase.auth.getUser()

  // We need the Target Profile
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!targetProfile) {
    notFound();
  }

  // We need the Logged In User's profile (for Navbar logic)
  let loggedInProfile = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    loggedInProfile = data;
  }

  // Check if we are viewing our own profile
  const isOwnProfile = user?.id === targetProfile.id;

  return (
    <>
      <Navbar initialUser={user} initialProfile={loggedInProfile} />
      <main className="flex-1 flex flex-col bg-white pb-12 min-h-screen">
        
        {/* Back Button Header */}
        <div className="bg-white border-b border-gold/20 sticky top-16 z-40">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center">
            <Link 
              href="/"
              className="flex items-center gap-2 text-navy-dark hover:text-gold transition-colors font-sans text-sm font-bold"
            >
              <ArrowLeft size={18} />
              Volver al Muro
            </Link>
          </div>
        </div>

        <ProfileSection profile={targetProfile} isOwnProfile={isOwnProfile} />
        
      </main>
      <Footer />
    </>
  )
}
