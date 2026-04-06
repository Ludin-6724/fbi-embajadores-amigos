import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import PostClient from "./PostClient";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> | { id: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const resolvedParams = await params;
  const { id } = resolvedParams;
  
  const { data: post } = await supabase
    .from("posts")
    .select("content, is_anonymous, profiles(username, full_name, avatar_url)")
    .eq("id", id)
    .single();

  if (!post) {
    return { title: "Publicación no encontrada - Red FBI" };
  }

  // Handle profiles as potentially an array (Supabase join type inference)
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const authorName = post.is_anonymous 
    ? "Agente Anónimo" 
    : (profile?.username || profile?.full_name || "Agente");
  
  const description = post.content.substring(0, 160) + (post.content.length > 160 ? "..." : "");

  return {
    title: `Publicación de ${authorName} - Red FBI`,
    description,
    openGraph: {
      title: `Publicación de ${authorName}`,
      description,
      type: "article",
      images: profile?.avatar_url ? [profile.avatar_url] : ["/logo-fbi.jpg"],
    },
    twitter: {
      card: "summary",
      title: `Publicación de ${authorName} en la Red FBI`,
      description,
    },
  };
}

export default async function SinglePostPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const supabase = await createClient();
  const resolvedParams = await params;
  const { id } = resolvedParams;

  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profile = data;
  }

  // Fetch post to check if it exists
  const { data: post } = await supabase.from("posts").select("id").eq("id", id).single();
  if (!post) {
    notFound();
  }

  return (
    <>
      <Navbar initialUser={user} initialProfile={profile} />
      <main className="flex-1 bg-cream/30 min-h-screen pt-24 pb-20 mt-16 md:mt-0">
        <div className="container mx-auto px-4">
           <PostClient postId={id} initialUser={user} initialProfile={profile} />
        </div>
      </main>
      <Footer />
    </>
  );
}
