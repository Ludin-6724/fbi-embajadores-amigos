"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Fingerprint, MessageSquare, Loader2, ChevronRight, Share2, MoreHorizontal, Pen, Trash2, CornerDownRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReactionPicker, { ReactionType } from "@/components/ui/ReactionPicker";
import Link from "next/link";

/* ─── Types ─── */
type ReactionRow = { id: string; user_id: string; reaction: ReactionType };
type CommentPreview = {
  id: string; post_id: string; author_id: string; parent_id: string | null; content: string; created_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
};
type Post = {
  id: string; author_id: string; content: string;
  is_anonymous?: boolean; community_id?: string | null; created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  post_reactions: ReactionRow[];
};

/* Minimal select — NO nested comment joins */
const POST_SELECT = "id, author_id, content, is_anonymous, community_id, created_at, profiles(username, full_name, avatar_url), post_reactions(id, user_id, reaction)";

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
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [inlinePostContent, setInlinePostContent] = useState("");
  const [isSubmittingInline, setIsSubmittingInline] = useState(false);
  const pageSize = 15;

  // Stable ref to supabase — never changes, never triggers re-renders
  const sbRef = useRef(createClient());
  const hasFetched = useRef(false);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Get userId once
  useEffect(() => {
    if (initialProfile?.id) { setUserId(initialProfile.id); return; }
    sbRef.current.auth.getSession().then(({ data }: { data: any }) => {
      if (data?.session?.user) setUserId(data.session.user.id);
    });
  }, [initialProfile]);

  // Main fetch function — uses ref, no deps on supabase
  const fetchPosts = useCallback(async (pageNum: number, append: boolean) => {
    if (!append) setLoading(true);
    setError(null);

    const supabase = sbRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      let q = supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (postId) {
        q = q.eq("id", postId);
      } else {
        if (activeTab === "oratorio") q = q.eq("is_anonymous", true);
        else q = q.neq("is_anonymous", true);
        if (communityId) q = q.eq("community_id", communityId);
        else q = q.is("community_id", null);
      }

      const { data, error: qError } = await q as { data: any; error: any };
      clearTimeout(timeoutId);

      if (qError) {
        setError(`Error: ${qError.message}`);
        setLoading(false);
        return;
      }

      const fetched: Post[] = (data ?? []).map((p: any) => ({
        ...p,
        post_reactions: p.post_reactions ?? [],
      }));

      if (fetched.length < pageSize) setHasMore(false);
      if (append) setPosts(prev => [...prev, ...fetched]);
      else setPosts(fetched);
      setLoading(false);

        // Load comments (all if postId is set, otherwise 2 previews per post)
      if (fetched.length > 0) {
        const ids = fetched.map(p => p.id);
        let q = supabase
          .from("comments")
          .select("id, post_id, author_id, parent_id, content, created_at, profiles(username, avatar_url)")
          .in("post_id", ids)
          .order("created_at", { ascending: false });
          
        if (!postId) {
          q = q.limit(ids.length * 3);
        }

        q.then(({ data: cData }: { data: any }) => {
            if (!cData) return;
            const previews: Record<string, CommentPreview[]> = {};
            const counts: Record<string, number> = {};
            for (const c of cData) {
              counts[c.post_id] = (counts[c.post_id] ?? 0) + 1;
              if (!previews[c.post_id]) previews[c.post_id] = [];
              if (!postId) {
                if (previews[c.post_id].length < 2) previews[c.post_id].push(c);
              } else {
                previews[c.post_id].push(c);
              }
            }
            Object.keys(previews).forEach(k => previews[k].reverse());
            setCommentPreviews(prev => ({ ...prev, ...previews }));
            setCommentCounts(prev => ({ ...prev, ...counts }));
          });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError") {
        setError("Tiempo de espera agotado. Verifica tu conexión.");
      } else {
        setError("Error de red. Reintenta.");
      }
      setLoading(false);
    }
  }, [activeTab, communityId, postId, pageSize]);

  // Initial fetch — runs ONCE when allowed, then only on real dependency changes
  useEffect(() => {
    if (!isAllowedToFetch) return;
    hasFetched.current = true;
    setPage(0);
    setHasMore(true);
    fetchPosts(0, false);
  }, [isAllowedToFetch, activeTab, communityId, postId]);

  // Pagination — only triggers on user action
  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next, true);
  };

  /* ─── Reactions ─── */
  const handleToggleReaction = async (pId: string, type: ReactionType) => {
    if (!userId) { showToast("Inicia sesión para reaccionar", false); return; }
    const supabase = sbRef.current;
    const post = posts.find(p => p.id === pId);
    if (!post) return;
    const mine = post.post_reactions.find(r => r.user_id === userId);

    if (mine) {
      if (mine.reaction === type) {
        // Remove
        setPosts(prev => prev.map(p => p.id === pId
          ? { ...p, post_reactions: p.post_reactions.filter(r => r.id !== mine.id) } : p));
        await supabase.from("post_reactions").delete().eq("id", mine.id);
      } else {
        // Change
        setPosts(prev => prev.map(p => p.id === pId
          ? { ...p, post_reactions: [...p.post_reactions.filter(r => r.user_id !== userId), { id: "temp", user_id: userId, reaction: type }] } : p));
        await supabase.from("post_reactions").delete().eq("user_id", userId).eq("post_id", pId);
        const { data } = await supabase.from("post_reactions")
          .insert({ post_id: pId, user_id: userId, reaction: type })
          .select("id, user_id, reaction").single() as { data: any };
        if (data) setPosts(prev => prev.map(p => p.id === pId
          ? { ...p, post_reactions: p.post_reactions.map(r => r.user_id === userId ? data : r) } : p));
      }
    } else {
      // Add
      setPosts(prev => prev.map(p => p.id === pId
        ? { ...p, post_reactions: [...p.post_reactions, { id: "temp", user_id: userId, reaction: type }] } : p));
      const { data } = await supabase.from("post_reactions")
        .insert({ post_id: pId, user_id: userId, reaction: type })
        .select("id, user_id, reaction").single() as { data: any };
      if (data) setPosts(prev => prev.map(p => p.id === pId
        ? { ...p, post_reactions: p.post_reactions.map(r => r.id === "temp" ? data : r) } : p));
    }
  };

  const handleAddComment = async (pId: string) => {
    if (!userId) { showToast("Inicia sesión para comentar", false); return; }
    if (!commentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const { data, error: insertError } = await sbRef.current.from("comments").insert({
        post_id: pId,
        author_id: userId,
        content: commentText.trim(),
        parent_id: replyingTo?.id || null
      }).select("id, post_id, author_id, parent_id, content, created_at, profiles(username, avatar_url)").single() as { data: any, error: any };

      if (insertError) throw insertError;
      
      setCommentPreviews(prev => ({
        ...prev,
        [pId]: [...(prev[pId] || []), data]
      }));
      setCommentCounts(prev => ({
        ...prev,
        [pId]: (prev[pId] || 0) + 1
      }));
      setCommentText("");
      setReplyingTo(null);
    } catch (err: any) {
      showToast(`Error: ${err.message || "Error al comentar"}`, false);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleInlinePost = async () => {
    if (!userId) { showToast("Debes iniciar sesión para publicar.", false); return; }
    if (!inlinePostContent.trim() || isSubmittingInline) return;

    setIsSubmittingInline(true);
    try {
      const { error } = await sbRef.current.from("posts").insert({
        author_id: userId,
        content: inlinePostContent.trim(),
        is_anonymous: activeTab === "oratorio",
        community_id: communityId || null
      });

      if (error) throw error;
      
      setInlinePostContent("");
      showToast("¡Publicado correctamente!");
      fetchPosts(0, false);
      window.dispatchEvent(new CustomEvent("fbi:refresh-feed"));
    } catch (err: any) {
      showToast(`Error al publicar: ${err.message}`, false);
    } finally {
      setIsSubmittingInline(false);
    }
  };

  const handleEditComment = async (cId: string, pId: string) => {
    if (!editContent.trim()) return;
    try {
      const { error } = await sbRef.current.from("comments").update({ content: editContent.trim() }).eq("id", cId);
      if (error) throw error;
      setCommentPreviews(prev => ({
        ...prev,
        [pId]: (prev[pId] || []).map(c => c.id === cId ? { ...c, content: editContent.trim() } : c)
      }));
      setEditingCommentId(null);
      setOpenDropdownId(null);
      showToast("Comentario actualizado");
    } catch (err) {
      showToast("Error al editar comentario", false);
    }
  };

  const handleDeleteComment = async (cId: string, pId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este comentario?")) return;
    try {
      const { error } = await sbRef.current.from("comments").delete().eq("id", cId);
      if (error) throw error;
      setCommentPreviews(prev => ({
        ...prev,
        [pId]: (prev[pId] || []).filter(c => c.id !== cId && c.parent_id !== cId)
      }));
      setCommentCounts(prev => ({ ...prev, [pId]: Math.max(0, (prev[pId] || 1) - 1) }));
      showToast("Comentario eliminado");
    } catch (err) {
      showToast("Error al eliminar comentario", false);
    }
  };

  const handleShare = async (pId: string) => {
    const url = `${window.location.origin}/post/${pId}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Publicación en FBI Amigos', url }); } catch (err) {}
    } else {
      navigator.clipboard.writeText(url);
      showToast("Enlace copiado al portapapeles");
    }
  };

  const emojiMap: Record<string, string> = { like: "👍", heart: "❤️", haha: "😂", amen: "🙏", pray: "🙌" };
  const labelMap: Record<string, string> = { like: "Me gusta", heart: "Me encanta", haha: "Me divierte", amen: "Amén", pray: "Oración" };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "ahora";
    const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h`;
    return new Date(d).toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  /* ─── Render ─── */
  return (
    <section className="py-16 bg-cream text-navy-dark relative z-10" id="comunidad">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl bg-navy-dark text-white border border-gold/30 pointer-events-none">
          <p className="font-bold text-sm">{toast.msg}</p>
        </div>
      )}

      <div className="container mx-auto px-4">
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
            <p className="text-xs font-bold text-gold/70 uppercase tracking-widest">Cargando...</p>
          </div>
        ) : error ? (
          <div className="max-w-sm mx-auto bg-white p-8 rounded-3xl border border-red-100 text-center shadow-lg">
            <p className="text-3xl mb-3">📡</p>
            <h4 className="text-red-600 font-bold mb-2">Sin conexión</h4>
            <p className="text-xs text-navy-dark/50 mb-6">{error}</p>
            <button
              onClick={() => fetchPosts(0, false)}
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
                  onClick={() => { if (activeTab !== "muro") setActiveTab("muro"); }}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === "muro" ? "bg-navy-dark text-white shadow-md" : "text-navy-dark/40 hover:text-navy-dark"}`}
                >Muro</button>
                <button
                  onClick={() => { if (activeTab !== "oratorio") setActiveTab("oratorio"); }}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === "oratorio" ? "bg-navy-dark text-white shadow-md" : "text-navy-dark/40 hover:text-navy-dark"}`}
                >Oración</button>
              </div>
            )}

            {/* Header Oración */}
            {activeTab === "oratorio" && (
              <div className="bg-white rounded-3xl p-6 text-center border border-gold/20 shadow-sm mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-bl-full pointer-events-none" />
                <h3 className="font-serif text-2xl font-bold text-navy-dark mb-2">Peticiones de Oración</h3>
                <p className="text-sm text-navy-dark/70 font-sans italic max-w-sm mx-auto leading-relaxed">
                  "Y todo lo que pidiereis en oración, creyendo, lo recibiréis."
                </p>
                <p className="text-[10px] font-bold text-gold uppercase tracking-widest mt-3">Mateo 21:22 (RVR1960)</p>
              </div>
            )}

            {/* Inline Post Creation (Only IF NOT looking at a single post view) */}
            {!postId && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-cream border border-gold/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {initialProfile?.avatar_url && activeTab !== "oratorio"
                    ? <img src={initialProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <span className="font-bold text-gold text-sm">{activeTab === "oratorio" ? <Fingerprint size={18} /> : (initialProfile?.full_name?.[0] || "A")}</span>
                  }
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <textarea
                    value={inlinePostContent}
                    onChange={e => setInlinePostContent(e.target.value)}
                    placeholder={activeTab === "muro" ? "¿Qué luz vas a compartir hoy con la comunidad?" : "Escribe tu petición o testimonio de forma anónima..."}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 resize-none transition-all"
                    rows={inlinePostContent.includes('\n') ? 3 : 1}
                  />
                  {inlinePostContent.trim() && (
                    <div className="flex justify-end animate-in fade-in pt-1">
                      <button 
                        onClick={handleInlinePost}
                        disabled={isSubmittingInline}
                        className="px-5 py-2 bg-navy-dark text-white rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-all shadow-md hover:bg-gold hover:text-navy-dark"
                      >
                        {isSubmittingInline ? "Publicando..." : "Publicar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Posts */}
            {posts.map(post => {
              const name = post.is_anonymous ? "Agente Anónimo" : (post.profiles?.full_name || post.profiles?.username || "Agente");
              const myR = post.post_reactions.find(r => r.user_id === userId)?.reaction;
              const totalReactions = post.post_reactions.length;
              const uniqueTypes = Array.from(new Set(post.post_reactions.map(r => r.reaction)));
              const previews = commentPreviews[post.id] ?? [];
              const commentCount = commentCounts[post.id] ?? 0;
              const extraComments = Math.max(0, commentCount - previews.length);

              return (
                <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-100">

                  {/* Header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-cream border border-gold/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {post.profiles?.avatar_url && !post.is_anonymous
                          ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" alt={name} />
                          : <span className="font-bold text-gold text-sm">{post.is_anonymous ? <Fingerprint size={18} /> : name[0]}</span>
                        }
                      </div>
                      <div>
                        <p className="font-bold text-sm text-navy-dark leading-none">{name}</p>
                        <p className="text-[10px] text-navy-dark/40 mt-0.5">{timeAgo(post.created_at)}</p>
                      </div>
                    </div>
                    <p className="text-navy-dark/90 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {/* Reaction + comment count summary */}
                  {(totalReactions > 0 || commentCount > 0) && (
                    <div className="px-4 py-2 flex items-center justify-between text-xs text-navy-dark/50">
                      {totalReactions > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {uniqueTypes.slice(0, 3).map(t => (
                            <span key={t} className="text-lg leading-none">{emojiMap[t]}</span>
                          ))}
                          <span className="font-medium">{totalReactions}</span>
                        </div>
                      ) : <span />}
                      {commentCount > 0 && (
                        <span>{commentCount} comentario{commentCount !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="border-t border-gray-100 grid grid-cols-3">
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

                    <Link
                      href={`/post/${post.id}`}
                      className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-navy-dark/50 hover:bg-gray-50 border-l border-r border-gray-100 transition-all"
                    >
                      <MessageSquare size={17} />
                      <span className="text-xs">Comentar</span>
                    </Link>

                    <button
                      onClick={() => handleShare(post.id)}
                      className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-navy-dark/50 hover:bg-gray-50 transition-all"
                    >
                      <Share2 size={17} />
                      <span className="text-xs">Compartir</span>
                    </button>
                  </div>

                  {/* Comments section */}
                  {(previews.length > 0 || postId) && (
                    <div className="px-4 pb-4 pt-4 border-t border-gray-50 space-y-4">
                      {!postId ? previews.slice(0,2).map(c => (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-gold border border-gold/20 overflow-hidden mt-0.5">
                            {c.profiles?.avatar_url
                              ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                              : (c.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                          </div>
                          <div className="flex-1 bg-gray-50/80 rounded-2xl px-4 py-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-[12px] font-bold text-navy-dark">{c.profiles?.username || "Agente"}</p>
                            </div>
                            <p className="text-xs text-navy-dark/80 leading-relaxed line-clamp-2">{c.content}</p>
                          </div>
                        </div>
                      )) : previews.filter(c => !c.parent_id).map(rootC => (
                        <div key={rootC.id} className="space-y-3">
                          {/* ROOT COMMENT */}
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-gold border border-gold/20 overflow-hidden mt-0.5">
                              {rootC.profiles?.avatar_url ? <img src={rootC.profiles.avatar_url} className="w-full h-full object-cover" /> : (rootC.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                            </div>
                            <div className="flex-1">
                              <div className="bg-gray-50/80 rounded-2xl px-4 py-2.5 relative group">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-[12px] font-bold text-navy-dark">{rootC.profiles?.username || "Agente"}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[9px] text-navy-dark/40">{timeAgo(rootC.created_at)}</p>
                                    {userId === rootC.author_id && (
                                      <div className="relative">
                                        <button onClick={() => setOpenDropdownId(openDropdownId === rootC.id ? null : rootC.id)} className="text-navy-dark/30 hover:text-navy-dark/70 transition-colors p-1"><MoreHorizontal size={14}/></button>
                                        {openDropdownId === rootC.id && (
                                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gold/10 py-1 z-20 overflow-hidden">
                                            <button onClick={() => { setEditingCommentId(rootC.id); setEditContent(rootC.content); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-xs font-bold text-navy-dark/70 hover:bg-gray-50 flex items-center gap-2"><Pen size={12}/> Editar</button>
                                            <button onClick={() => handleDeleteComment(rootC.id, post.id)} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={12}/> Eliminar</button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingCommentId === rootC.id ? (
                                  <div className="mt-2">
                                    <textarea autoFocus value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gold outline-none resize-none" rows={2}/>
                                    <div className="flex justify-end gap-2 mt-2">
                                      <button onClick={() => setEditingCommentId(null)} className="text-[10px] font-bold text-navy-dark/50 hover:text-navy-dark px-2">Cancelar</button>
                                      <button onClick={() => handleEditComment(rootC.id, post.id)} className="text-[10px] bg-navy-dark text-white px-3 py-1 rounded-full font-bold">Guardar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-navy-dark/80 leading-relaxed whitespace-pre-wrap">{rootC.content}</p>
                                )}
                              </div>
                              {/* Reply Action */}
                              {!editingCommentId && (
                                <div className="px-4 mt-1">
                                  <button onClick={() => setReplyingTo({ id: rootC.id, username: rootC.profiles?.username || "Agente" })} className="text-[10px] font-bold text-navy-dark/40 hover:text-gold transition-colors">Responder</button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* REPLIES */}
                          <div className="pl-11 space-y-3">
                            {previews.filter(r => r.parent_id === rootC.id).map(reply => (
                              <div key={reply.id} className="flex gap-2.5">
                                <CornerDownRight size={14} className="text-navy-dark/20 mt-1.5 flex-shrink-0" />
                                <div className="w-6 h-6 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-gold border border-gold/20 overflow-hidden mt-0.5">
                                  {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover" /> : (reply.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                                </div>
                                <div className="flex-1">
                                  <div className="bg-gray-50/80 rounded-2xl px-3 py-2 relative group">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <p className="text-[11px] font-bold text-navy-dark">{reply.profiles?.username || "Agente"}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[9px] text-navy-dark/40">{timeAgo(reply.created_at)}</p>
                                        {userId === reply.author_id && (
                                          <div className="relative">
                                            <button onClick={() => setOpenDropdownId(openDropdownId === reply.id ? null : reply.id)} className="text-navy-dark/30 hover:text-navy-dark/70 transition-colors p-1"><MoreHorizontal size={12}/></button>
                                            {openDropdownId === reply.id && (
                                              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gold/10 py-1 z-20 overflow-hidden">
                                                <button onClick={() => { setEditingCommentId(reply.id); setEditContent(reply.content); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-[10px] font-bold text-navy-dark/70 hover:bg-gray-50 flex items-center gap-2"><Pen size={10}/> Editar</button>
                                                <button onClick={() => handleDeleteComment(reply.id, post.id)} className="w-full text-left px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={10}/> Eliminar</button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {editingCommentId === reply.id ? (
                                      <div className="mt-2">
                                        <textarea autoFocus value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-[11px] focus:ring-1 focus:ring-gold outline-none resize-none" rows={2}/>
                                        <div className="flex justify-end gap-2 mt-2">
                                          <button onClick={() => setEditingCommentId(null)} className="text-[9px] font-bold text-navy-dark/50 hover:text-navy-dark px-2">Cancelar</button>
                                          <button onClick={() => handleEditComment(reply.id, post.id)} className="text-[9px] bg-navy-dark text-white px-2 py-1 rounded-full font-bold">Guardar</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-navy-dark/80 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!postId && extraComments > 0 && (
                        <Link
                          href={`/post/${post.id}`}
                          className="flex items-center gap-1 text-[11px] font-bold text-navy-dark/40 hover:text-gold transition-colors pl-11 mt-1"
                        >
                          Ver {extraComments} comentario{extraComments !== 1 ? "s" : ""} más
                          <ChevronRight size={11} />
                        </Link>
                      )}

                      {/* Comment Input Form (Only in Single Post View) */}
                      {postId && (
                        <div className="pt-2 mt-2">
                          {replyingTo && (
                            <div className="flex items-center justify-between bg-gold/10 px-4 py-2 rounded-t-xl border border-b-0 border-gold/20">
                              <p className="text-[10px] font-bold text-gold">Respondiendo a @{replyingTo.username}</p>
                              <button onClick={() => setReplyingTo(null)} className="text-gold hover:text-gold/70"><X size={12}/></button>
                            </div>
                          )}
                          <div className={`flex gap-2 items-start ${replyingTo ? 'border border-t-0 border-gold/20 p-3 pt-4 rounded-b-xl bg-white' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-cream border border-gold/20 flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {initialProfile?.avatar_url 
                                ? <img src={initialProfile.avatar_url} className="w-full h-full object-cover" />
                                : <Fingerprint size={14} className="text-gold" />
                              }
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                               <textarea
                                 value={commentText}
                                 onChange={e => setCommentText(e.target.value)}
                                 placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un comentario..."}
                                 className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 resize-none shadow-sm transition-all"
                                 rows={commentText.includes('\n') ? 3 : 1}
                                 onKeyDown={e => {
                                   if (e.key === 'Enter' && !e.shiftKey) {
                                     e.preventDefault();
                                     handleAddComment(post.id);
                                   }
                                 }}
                               />
                               <div className="flex justify-end">
                                 <button 
                                   onClick={() => handleAddComment(post.id)}
                                   disabled={isSubmittingComment || !commentText.trim()}
                                   className="px-5 py-2 bg-navy-dark text-white rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 disabled:active:scale-100 active:scale-95 transition-all shadow-md hover:bg-gold hover:text-navy-dark"
                                 >
                                   {isSubmittingComment ? "Enviando..." : (replyingTo ? "Responder" : "Comentar")}
                                 </button>
                               </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && !loading && posts.length > 0 && (
              <button
                onClick={loadMore}
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
