"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Fingerprint, MessageSquare, Loader2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReactionPicker, { ReactionType } from "@/components/ui/ReactionPicker";
import Link from "next/link";

/* ─── Types ─── */
type ReactionRow = { id: string; user_id: string; reaction: ReactionType };
type CommentPreview = {
  id: string; post_id: string; content: string; created_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
};
type Post = {
  id: string; author_id: string; content: string;
  is_anonymous?: boolean; community_id?: string | null; created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  post_reactions: ReactionRow[];
};

/* Minimal query — no comment joins (they caused hangs) */
const POST_SELECT = `
  id, author_id, content, is_anonymous, community_id, created_at,
  profiles(username, full_name, avatar_url),
  post_reactions(id, user_id, reaction)
`.replace(/\s+/g, " ").trim();

export default function Comunidad({
  communityId, initialTab = "muro", hideTabs = false,
  postId, initialProfile, isAllowedToFetch = true
}: {
  communityId?: string; initialTab?: "muro" | "oratorio"; hideTabs?: boolean;
  postId?: string; initialProfile?: any; isAllowedToFetch?: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPreviews, setCommentPreviews] = useState<Record<string, CommentPreview[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(initialProfile?.id || null);
  const [activeTab, setActiveTab] = useState<"muro" | "oratorio">(initialTab);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 15;

  const supabase = createClient();
  const toastTimer = useRef<any>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (initialProfile?.id) setUserId(initialProfile.id);
    else if (!userId) {
      supabase.auth.getSession().then(({ data }: { data: any }) => {
        if (data?.session?.user) setUserId(data.session.user.id);
      });
    }
  }, [initialProfile]);

  const fetchPosts = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    setError(null);

    let finished = false;
    const timeoutId = setTimeout(() => {
      if (!finished) {
        setLoading(false);
        setError("Tiempo de espera agotado. Verifica tu conexión.");
      }
    }, 15000);

    try {
      let q = supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (postId) {
        q = q.eq("id", postId);
      } else {
        if (activeTab === "oratorio") q = q.eq("is_anonymous", true);
        else q = q.neq("is_anonymous", true);
        if (communityId) q = q.eq("community_id", communityId);
        else q = q.is("community_id", null);
      }

      const { data, error: qError } = await q as { data: any; error: any };
      finished = true;
      clearTimeout(timeoutId);

      if (qError) { setError(`Error: ${qError.message}`); return; }

      const fetched: Post[] = (data ?? []).map((p: any) => ({
        ...p,
        post_reactions: p.post_reactions ?? [],
      }));

      if (fetched.length < pageSize) setHasMore(false);
      if (page === 0) setPosts(fetched);
      else setPosts(prev => [...prev, ...fetched]);

      /* — Load 2 comment previews per post (non-blocking, best-effort) — */
      if (fetched.length > 0) {
        const ids = fetched.map(p => p.id);
        supabase
          .from("comments")
          .select("id, post_id, content, created_at, profiles(username, avatar_url)")
          .in("post_id", ids)
          .order("created_at", { ascending: false })
          .limit(ids.length * 4)
          .then(({ data: cData }: { data: any }) => {
            if (!cData) return;
            const previews: Record<string, CommentPreview[]> = {};
            const counts: Record<string, number> = {};
            for (const c of cData) {
              counts[c.post_id] = (counts[c.post_id] ?? 0) + 1;
              if (!previews[c.post_id]) previews[c.post_id] = [];
              // We fetched in DESC order — reverse later to show oldest-first
              if (previews[c.post_id].length < 2) previews[c.post_id].push(c);
            }
            // Reverse previews so oldest comment appears first
            Object.keys(previews).forEach(k => previews[k].reverse());
            setCommentPreviews(prev => ({ ...prev, ...previews }));
            setCommentCounts(prev => ({ ...prev, ...counts }));
          });
      }
    } catch {
      finished = true;
      clearTimeout(timeoutId);
      setError("Error de red. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [supabase, page, communityId, postId, activeTab]);

  useEffect(() => {
    if (isAllowedToFetch) fetchPosts(page > 0);
  }, [page, communityId, postId, isAllowedToFetch, fetchPosts]);

  /* ─── Reactions ─── */
  const handleToggleReaction = async (pId: string, type: ReactionType) => {
    if (!userId) { showToast("Inicia sesión para reaccionar", false); return; }
    const post = posts.find(p => p.id === pId);
    if (!post) return;
    const mine = post.post_reactions.find(r => r.user_id === userId);

    if (mine) {
      if (mine.reaction === type) {
        // Remove reaction
        setPosts(prev => prev.map(p => p.id === pId
          ? { ...p, post_reactions: p.post_reactions.filter(r => r.id !== mine.id) } : p));
        await supabase.from("post_reactions").delete().eq("id", mine.id);
      } else {
        // Change reaction
        const optimistic = { id: "temp", user_id: userId, reaction: type };
        setPosts(prev => prev.map(p => p.id === pId
          ? { ...p, post_reactions: [...p.post_reactions.filter(r => r.user_id !== userId), optimistic] } : p));
        await supabase.from("post_reactions").delete().eq("user_id", userId).eq("post_id", pId);
        const { data } = await supabase.from("post_reactions")
          .insert({ post_id: pId, user_id: userId, reaction: type })
          .select("id, user_id, reaction").single() as { data: any };
        if (data) setPosts(prev => prev.map(p => p.id === pId
          ? { ...p, post_reactions: p.post_reactions.map(r => r.user_id === userId ? data : r) } : p));
      }
    } else {
      // Add reaction
      const optimistic = { id: "temp", user_id: userId, reaction: type };
      setPosts(prev => prev.map(p => p.id === pId
        ? { ...p, post_reactions: [...p.post_reactions, optimistic] } : p));
      const { data } = await supabase.from("post_reactions")
        .insert({ post_id: pId, user_id: userId, reaction: type })
        .select("id, user_id, reaction").single() as { data: any };
      if (data) setPosts(prev => prev.map(p => p.id === pId
        ? { ...p, post_reactions: p.post_reactions.map(r => r.id === "temp" ? data : r) } : p));
    }
  };

  const emojiMap: Record<string, string> = {
    like: "👍", heart: "❤️", haha: "😂", amen: "🙏", pray: "🙌"
  };
  const labelMap: Record<string, string> = {
    like: "Me gusta", heart: "Me encanta", haha: "Me divierte", amen: "Amén", pray: "Oración"
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "ahora";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return new Date(d).toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  /* ─── Render ─── */
  return (
    <section className="py-20 bg-cream text-navy-dark relative z-10" id="comunidad">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl bg-navy-dark text-white border border-gold/30 pointer-events-none">
          <p className="font-bold text-sm">{toast.msg}</p>
        </div>
      )}

      <div className="container mx-auto px-4">
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-gold" />
            <p className="text-sm font-bold text-gold uppercase tracking-widest">Cargando muro...</p>
          </div>
        ) : error ? (
          <div className="max-w-sm mx-auto bg-white p-8 rounded-3xl border border-red-100 text-center shadow-lg">
            <p className="text-3xl mb-3">📡</p>
            <h4 className="text-red-600 font-bold mb-2">Sin conexión</h4>
            <p className="text-xs text-navy-dark/50 mb-6">{error}</p>
            <button
              onClick={() => { setError(null); setPage(0); setHasMore(true); fetchPosts(); }}
              className="bg-navy-dark text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-gold transition-colors"
            >
              🔄 Reintentar
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Tab selector */}
            {!hideTabs && (
              <div className="flex gap-2 mb-6 bg-white p-1 rounded-full border border-gold/10 shadow-sm max-w-xs mx-auto">
                <button
                  onClick={() => { if (activeTab !== "muro") { setActiveTab("muro"); setPage(0); setHasMore(true); } }}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === "muro" ? "bg-navy-dark text-white shadow-md" : "text-navy-dark/40 hover:text-navy-dark"}`}
                >Muro</button>
                <button
                  onClick={() => { if (activeTab !== "oratorio") { setActiveTab("oratorio"); setPage(0); setHasMore(true); } }}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === "oratorio" ? "bg-navy-dark text-white shadow-md" : "text-navy-dark/40 hover:text-navy-dark"}`}
                >Oración</button>
              </div>
            )}

            {/* Posts */}
            {posts.map(post => {
              const name = post.is_anonymous ? "Agente Anónimo" : post.profiles?.username || "Agente";
              const myR = post.post_reactions.find(r => r.user_id === userId)?.reaction;
              const totalReactions = post.post_reactions.length;
              const uniqueTypes = Array.from(new Set(post.post_reactions.map(r => r.reaction)));
              const previews = commentPreviews[post.id] ?? [];
              const commentCount = commentCounts[post.id] ?? 0;
              const extraComments = Math.max(0, commentCount - previews.length);

              return (
                <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">

                  {/* Post header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-cream border border-gold/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {post.profiles?.avatar_url && !post.is_anonymous
                          ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" alt={name} />
                          : <span className="font-bold text-gold">{post.is_anonymous ? <Fingerprint size={18} /> : name[0]}</span>
                        }
                      </div>
                      <div>
                        <p className="font-bold text-sm text-navy-dark leading-none">{name}</p>
                        <p className="text-[10px] text-navy-dark/40 mt-0.5">{timeAgo(post.created_at)}</p>
                      </div>
                    </div>
                    <p className="text-navy-dark/90 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Reaction summary (only if there are reactions) */}
                  {totalReactions > 0 && (
                    <div className="px-4 py-2 flex items-center gap-2 border-t border-gray-50">
                      <div className="flex items-center gap-0.5">
                        {uniqueTypes.slice(0, 3).map(t => (
                          <span key={t} className="text-[18px] leading-none">{emojiMap[t]}</span>
                        ))}
                      </div>
                      <span className="text-xs text-navy-dark/50 font-medium">{totalReactions}</span>
                      {commentCount > 0 && (
                        <span className="ml-auto text-xs text-navy-dark/40">
                          {commentCount} comentario{commentCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons — Facebook style */}
                  <div className="border-t border-gray-100 grid grid-cols-2">
                    {/* Reaction button */}
                    <ReactionPicker
                      onSelect={t => handleToggleReaction(post.id, t)}
                      disabled={!userId}
                      currentReaction={myR}
                    >
                      <button className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all hover:bg-gray-50 active:bg-gray-100 ${myR ? "text-gold" : "text-navy-dark/50"}`}>
                        <span className="text-xl leading-none">{myR ? emojiMap[myR] : "👍"}</span>
                        <span className="text-xs">{myR ? labelMap[myR] : "Me gusta"}</span>
                      </button>
                    </ReactionPicker>

                    {/* Comment button → link to full post */}
                    <Link
                      href={`/post/${post.id}`}
                      className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-navy-dark/50 hover:bg-gray-50 border-l border-gray-100 transition-all"
                    >
                      <MessageSquare size={17} />
                      <span className="text-xs">Comentar</span>
                    </Link>
                  </div>

                  {/* Comment previews (2 max) */}
                  {previews.length > 0 && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-50 space-y-2.5">
                      {previews.map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gold border border-gold/20 overflow-hidden">
                            {c.profiles?.avatar_url
                              ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                              : (c.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
                            <p className="text-[11px] font-bold text-navy-dark">{c.profiles?.username || "Agente"}</p>
                            <p className="text-xs text-navy-dark/80 leading-snug mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))}

                      {extraComments > 0 && (
                        <Link
                          href={`/post/${post.id}`}
                          className="flex items-center gap-1 text-[11px] font-bold text-navy-dark/40 hover:text-gold transition-colors pl-9"
                        >
                          Ver {extraComments} comentario{extraComments !== 1 ? "s" : ""} más
                          <ChevronRight size={11} />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && !loading && posts.length > 0 && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full py-4 text-xs font-bold text-gold uppercase tracking-widest hover:text-navy-dark transition-colors"
              >
                Cargar más publicaciones
              </button>
            )}

            {posts.length === 0 && !loading && (
              <div className="text-center py-16 text-navy-dark/40">
                <p className="text-4xl mb-3">✨</p>
                <p className="font-bold text-sm">Sin publicaciones aún.</p>
                <p className="text-xs mt-1">¡Sé el primero en compartir!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
