import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import HomeClient from "@/components/HomeClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function Home() {
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
          } catch {
            // Ignorar en Server Components
          }
        },
      },
    }
  )

  // getUser() is the correct method once middleware refreshes cookies
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let initialPosts = []

  if (user) {
    // Parallelize profile and posts fetching
    const [profileRes, postsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      supabase
        .from('posts')
        .select('id, author_id, content, is_anonymous, community_id, created_at, profiles(username, full_name, avatar_url), post_reactions(id, user_id, reaction)')
        .neq('is_anonymous', true)
        .is('community_id', null)
        .order('created_at', { ascending: false })
        .range(0, 14)
    ])

    if (profileRes.error) {
      console.error('Error al cargar perfil:', profileRes.error.message)
    }
    profile = profileRes.data

    if (postsRes.error) {
      console.error('Error al cargar posts:', postsRes.error.message)
    }
    initialPosts = postsRes.data || []
  } else {
    // If no user, still fetch public posts for the muro
    const { data, error } = await supabase
      .from('posts')
      .select('id, author_id, content, is_anonymous, community_id, created_at, profiles(username, full_name, avatar_url), post_reactions(id, user_id, reaction)')
      .neq('is_anonymous', true)
      .is('community_id', null)
      .order('created_at', { ascending: false })
      .range(0, 14)
    
    if (error) console.error('Error al cargar posts públicos:', error.message)
    initialPosts = data || []
  }

  return (
    <HomeClient initialUser={user} initialProfile={profile} initialPosts={initialPosts} />
  )
}
