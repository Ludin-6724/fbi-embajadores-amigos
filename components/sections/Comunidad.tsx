"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Fingerprint, MessageSquare, Loader2, ChevronRight, Share2, MoreHorizontal, Pen, Trash2, CornerDownRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReactionPicker, { ReactionType } from "@/components/ui/ReactionPicker";
import Link from "next/link";
import { cache } from "@/lib/utils/cache";

/* ─── Types ─── */
type ReactionRow = { id: string; user_id: string; reaction: ReactionType };
type CommentPreview = {
  id: string; post_id: string; author_id: string; parent_id: string | null; content: string; created_at: string;
  is_anonymous?: boolean;
  profiles: { username: string | null; avatar_url: string | null } | null;
  comment_reactions?: ReactionRow[];
};
type Post = {
  id: string; author_id: string; content: string;
  is_anonymous?: boolean; community_id?: string | null; created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  post_reactions: ReactionRow[];
};

/* Minimal select — NO nested comment joins */
const POST_SELECT = "id, author_id, content, is_anonymous, community_id, created_at, profiles(username, full_name, avatar_url), post_reactions(id, user_id, reaction)";

const EMPTY_INITIAL_POSTS: Post[] = [];

function getThreadDescendants(rootId: string, allComments: CommentPreview[]): CommentPreview[] {
  const result: CommentPreview[] = [];
  const mapByParent = new Map<string, CommentPreview[]>();
  for (const c of allComments) {
    if (!c.parent_id) continue;
    const list = mapByParent.get(c.parent_id) || [];
    list.push(c);
    mapByParent.set(c.parent_id, list);
  }

  function traverse(parentId: string) {
    const children = mapByParent.get(parentId) || [];
    for (const child of children) {
      result.push(child);
      traverse(child.id);
    }
  }
  traverse(rootId);
  return result.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function findRootParentId(commentId: string, allComments: CommentPreview[]): string {
  const current = allComments.find(c => c.id === commentId);
  if (!current || !current.parent_id) return commentId;
  return findRootParentId(current.parent_id, allComments);
}

export default function Comunidad({
  communityId, initialTab = "muro", hideTabs = false,
  postId, initialProfile, isAllowedToFetch = true, initialPosts = EMPTY_INITIAL_POSTS
}: {
  communityId?: string; initialTab?: "muro" | "oratorio"; hideTabs?: boolean;
  postId?: string; initialProfile?: any; isAllowedToFetch?: boolean;
  initialPosts?: Post[];
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
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [inlinePostContent, setInlinePostContent] = useState("");
  const [isSubmittingInline, setIsSubmittingInline] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const pageSize = 15;

  // Stable ref to supabase — never changes, never triggers re-renders
  const sbRef = useRef(createClient());
  const hasFetched = useRef(false);
  const fetchCtxRef = useRef("");
  const bootstrapDoneRef = useRef("");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const handleInitiateReply = useCallback((id: string, username: string) => {
    setReplyingTo({ id, username });
    setCommentText(`@${username} `);
    
    // Smooth scroll and focus
    setTimeout(() => {
      commentInputRef.current?.focus();
      if (commentInputRef.current) {
        const len = commentInputRef.current.value.length;
        commentInputRef.current.setSelectionRange(len, len);
      }
    }, 100);
  }, []);

  const toggleExpand = (commentId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const initialPostsSignature = useMemo(
    () => (initialPosts.length ? initialPosts.map((p) => p.id).join("|") : ""),
    [initialPosts]
  );

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

  // Helper to fetch comments for a list of post IDs
  const fetchCommentsForPosts = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) return;
    const supabase = sbRef.current;
    
    try {
      let q = supabase
        .from("comments")
        .select("id, post_id, author_id, parent_id, content, created_at, is_anonymous, profiles(username, avatar_url), comment_reactions(id, user_id, reaction)")
        .in("post_id", postIds)
        .order("created_at", { ascending: false });
        
      if (!postId) {
        q = q.limit(postIds.length * 3);
      }

      const { data: cData } = await q;
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
    } catch (err) {
      console.warn("Error fetching comments:", err);
    }
  }, [postId]);

  // Main fetch function — uses ref, no deps on supabase
  const fetchPosts = useCallback(async (pageNum: number, append: boolean, opts?: { silent?: boolean }) => {
    if (!append && !opts?.silent) setLoading(true);
    setError(null);

    const supabase = sbRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      let q = supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        .abortSignal(controller.signal);

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
      
      if (append) setPosts(prev => {
        const next = [...prev, ...fetched];
        if (!postId && pageNum === 0) cache.set(`posts_${activeTab}_${communityId || 'global'}`, next.slice(0, 50));
        return next;
      });
      else setPosts(prev => {
        if (!postId) cache.set(`posts_${activeTab}_${communityId || 'global'}`, fetched.slice(0, 50));
        return fetched;
      });
      
      setLoading(false);

      // Fetch comments for the newly fetched posts
      if (fetched.length > 0) {
        fetchCommentsForPosts(fetched.map(p => p.id));
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
  }, [activeTab, communityId, postId, pageSize, fetchCommentsForPosts]);

  // Realtime Subscriptions — Keep the feed alive
  useEffect(() => {
    if (!isAllowedToFetch || postId) return;

    const supabase = sbRef.current;
    const channel = supabase
      .channel(`public:posts:${activeTab}:${communityId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: communityId ? `community_id=eq.${communityId}` : 'community_id=is.null'
        },
        async (payload: { new: any }) => {
          const newPost = payload.new as any;
          // Only add if it matches the current tab's anonymity
          const matchesTab = activeTab === 'oratorio' ? newPost.is_anonymous : !newPost.is_anonymous;
          
          if (matchesTab) {
            // Fetch the profile for the new post to show name/avatar
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url')
              .eq('id', newPost.author_id)
              .single();
            
            const postWithProfile: Post = {
              ...newPost,
              profiles: profile,
              post_reactions: []
            };

            setPosts(prev => {
              if (prev.find(p => p.id === postWithProfile.id)) return prev;
              const next = [postWithProfile, ...prev];
              // Update cache with the new post
              if (!postId) cache.set(`posts_${activeTab}_${communityId || 'global'}`, next.slice(0, 50));
              return next;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_reactions'
        },
        () => {
          // If reactions change, we could do more granular updates, 
          // but for now, simple refresh or let the manual actions handle it.
          // Or we can just let the optimistic UI do its job.
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAllowedToFetch, activeTab, communityId, postId]);

  // Initial fetch — solo cuando la pestaña está activa; firma estable evita bucles por `[]` nuevo
  useEffect(() => {
    if (!isAllowedToFetch) return;

    const ctx = `${activeTab}|${communityId ?? ""}|${postId ?? ""}|${initialPostsSignature}`;
    if (bootstrapDoneRef.current === ctx) return;

    if (fetchCtxRef.current !== ctx) {
      fetchCtxRef.current = ctx;
      hasFetched.current = false;
    }

    let usedCache = false;

    // 1. Primacía de initialPosts (servidor)
    if (initialPosts.length > 0 && !postId && !hasFetched.current) {
      setPosts(initialPosts);
      setLoading(false);
      hasFetched.current = true;
      bootstrapDoneRef.current = ctx;
      cache.set(`posts_${activeTab}_${communityId || "global"}`, initialPosts);
      fetchCommentsForPosts(initialPosts.map((p) => p.id));
      void fetchPosts(0, false, { silent: true });
      return;
    }

    // 2. Caché local (incluye datos stale vía peekStale)
    if (!hasFetched.current && !postId) {
      const { data: cachedPosts } = cache.peekStale<Post[]>(`posts_${activeTab}_${communityId || "global"}`);
      if (cachedPosts && cachedPosts.length > 0) {
        setPosts(cachedPosts);
        setLoading(false);
        usedCache = true;
      }
    }

    // 3. Red (silencioso si ya pintamos caché)
    hasFetched.current = true;
    bootstrapDoneRef.current = ctx;
    setPage(0);
    setHasMore(true);
    void fetchPosts(0, false, { silent: usedCache });
  }, [
    isAllowedToFetch,
    activeTab,
    communityId,
    postId,
    initialPostsSignature,
    fetchCommentsForPosts,
    fetchPosts,
  ]);

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

  const handleToggleCommentReaction = async (commentId: string, postId: string, type: ReactionType) => {
    if (!userId) {
      showToast("Inicia sesión para reaccionar", false);
      return;
    }
    
    const currentPreviews = commentPreviews[postId] || [];
    const comment = currentPreviews.find(c => c.id === commentId);
    if (!comment) return;
    
    const existingReaction = comment.comment_reactions?.find(r => r.user_id === userId);
    const isRemoving = existingReaction && existingReaction.reaction === type;
    const isSwitching = existingReaction && existingReaction.reaction !== type;

    setCommentPreviews(prev => {
      const ps = prev[postId] || [];
      return {
        ...prev,
        [postId]: ps.map(c => {
          if (c.id !== commentId) return c;
          let newReactions = [...(c.comment_reactions || [])];
          if (isRemoving) {
            newReactions = newReactions.filter(r => r.user_id !== userId);
          } else if (isSwitching) {
            newReactions = newReactions.map(r => r.user_id === userId ? { ...r, reaction: type } : r);
          } else {
            newReactions.push({ id: "temp", user_id: userId, reaction: type });
          }
          return { ...c, comment_reactions: newReactions };
        })
      };
    });

    try {
      if (isRemoving) {
        await sbRef.current.from("comment_reactions").delete().eq("user_id", userId).eq("comment_id", commentId);
      } else if (isSwitching) {
        await sbRef.current.from("comment_reactions").delete().eq("user_id", userId).eq("comment_id", commentId);
        await sbRef.current.from("comment_reactions").insert({ comment_id: commentId, user_id: userId, reaction: type });
      } else {
        await sbRef.current.from("comment_reactions").insert({ comment_id: commentId, user_id: userId, reaction: type });
      }
    } catch (e) { }
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
        parent_id: replyingTo?.id || null,
        is_anonymous: isAnonymousComment || (activeTab === "oratorio" && isAnonymousComment === undefined)
      }).select("id, post_id, author_id, parent_id, content, created_at, is_anonymous, profiles(username, avatar_url)").single() as { data: any, error: any };

      if (insertError) throw insertError;
      
      setCommentPreviews(prev => {
        const updatedPreviews = [...(prev[pId] || []), data];
        if (data.parent_id) {
          const rootId = findRootParentId(data.parent_id, updatedPreviews);
          setExpandedComments(ex => ({ ...ex, [rootId]: true }));
        }
        return {
          ...prev,
          [pId]: updatedPreviews
        };
      });
      setCommentCounts(prev => ({
        ...prev,
        [pId]: (prev[pId] || 0) + 1
      }));
      setCommentText("");
      setReplyingTo(null);
      setIsAnonymousComment(false);
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

  const handleEditPost = async (pId: string) => {
    if (!editPostContent.trim()) return;
    try {
      const { error } = await sbRef.current.from("posts").update({ content: editPostContent.trim() }).eq("id", pId);
      if (error) throw error;
      setPosts(prev => prev.map(p => p.id === pId ? { ...p, content: editPostContent.trim() } : p));
      setEditingPostId(null);
      setOpenDropdownId(null);
      showToast("Publicación actualizada");
    } catch (err) {
      showToast("Error al editar publicación", false);
    }
  };

  const handleDeletePost = async (pId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta publicación?")) return;
    try {
      const { error } = await sbRef.current.from("posts").delete().eq("id", pId);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== pId));
      showToast("Publicación eliminada");
    } catch (err) {
      showToast("Error al eliminar publicación", false);
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
                <p className="text-[12px] text-navy-dark/70 font-sans max-w-sm mx-auto leading-relaxed mb-3">
                  No hay agentes solitarios, comparte tus luchas y ora por las demás de manera real.
                </p>
                <p className="text-sm font-sans italic max-w-sm mx-auto leading-relaxed text-gold font-medium">
                  "Y todo lo que pidiereis en oración, creyendo, lo recibiréis."
                </p>
                <p className="text-[10px] font-bold text-navy-dark/40 uppercase tracking-widest mt-2">Mateo 21:22 (RVR1960)</p>
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
                    placeholder={activeTab === "muro" ? "¿Qué tienes para compartir hoy agente?" : "Escribe tu petición o testimonio de forma anónima..."}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 resize-none transition-all"
                    rows={inlinePostContent.includes('\n') ? 4 : 2}
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
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
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

                      {userId === post.author_id && (
                        <div className="relative">
                          <button 
                            onClick={() => setOpenDropdownId(openDropdownId === post.id ? null : post.id)} 
                            className="text-navy-dark/30 hover:text-navy-dark/70 transition-colors p-1"
                          >
                            <MoreHorizontal size={18}/>
                          </button>
                          {openDropdownId === post.id && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gold/10 py-1 z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
                              <button 
                                onClick={() => { 
                                  setEditingPostId(post.id); 
                                  setEditPostContent(post.content); 
                                  setOpenDropdownId(null); 
                                }} 
                                className="w-full text-left px-4 py-2 text-xs font-bold text-navy-dark/70 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Pen size={12}/> Editar
                              </button>
                              <button 
                                onClick={() => handleDeletePost(post.id)} 
                                className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={12}/> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {editingPostId === post.id ? (
                      <div className="space-y-3">
                        <textarea 
                          autoFocus 
                          value={editPostContent} 
                          onChange={e => setEditPostContent(e.target.value)} 
                          className="w-full bg-cream/30 border border-gold/20 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-gold outline-none resize-none font-sans" 
                          rows={4}
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingPostId(null)} 
                            className="text-xs font-bold text-navy-dark/50 hover:text-navy-dark px-3 py-1.5 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleEditPost(post.id)} 
                            className="text-xs bg-navy-dark text-white px-4 py-1.5 rounded-full font-bold shadow-md hover:bg-gold hover:text-navy-dark transition-all"
                          >
                            Guardar cambios
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-navy-dark/90 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    )}
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
                        <Link href={`/post/${post.id}`} key={c.id} className="flex gap-3 hover:bg-gray-50 p-2 rounded-2xl transition-all -mx-2">
                          <div className="w-8 h-8 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-gold border border-gold/20 overflow-hidden mt-0.5">
                            {c.profiles?.avatar_url
                              ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                              : (c.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                          </div>
                          <div className="flex-1 bg-gray-50/80 rounded-2xl px-4 py-2.5 shadow-sm border border-gray-100/50">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-[12px] font-bold text-navy-dark">{c.profiles?.username || "Agente"}</p>
                            </div>
                            <p className="text-xs text-navy-dark/80 leading-relaxed line-clamp-2">{c.content}</p>
                            {c.comment_reactions && c.comment_reactions.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 opacity-80">
                                {Array.from(new Set(c.comment_reactions.map(r => r.reaction))).slice(0, 2).map(t => (
                                  <span key={t} className="text-[10px] leading-none">{emojiMap[t]}</span>
                                ))}
                                <span className="text-[9px] text-navy-dark/50 font-medium">{c.comment_reactions.length}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      )) : previews.filter(c => !c.parent_id).map(rootC => (
                        <div key={rootC.id} className="space-y-3">
                          {/* ROOT COMMENT */}
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-gold border border-gold/20 overflow-hidden mt-0.5">
                              {rootC.is_anonymous ? <Fingerprint size={14} className="text-gold" /> : rootC.profiles?.avatar_url ? <img src={rootC.profiles.avatar_url} className="w-full h-full object-cover" /> : (rootC.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                            </div>
                            <div className="flex-1">
                              <div className="bg-gray-50/80 rounded-2xl px-4 py-2.5 relative group">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-[12px] font-bold text-navy-dark">{rootC.is_anonymous ? "Agente Anónimo" : (rootC.profiles?.username || "Agente")}</p>
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
                                <div className="px-4 mt-1 flex items-center gap-4">
                                  <ReactionPicker
                                    onSelect={t => handleToggleCommentReaction(rootC.id, post.id, t)}
                                    disabled={!userId}
                                    currentReaction={rootC.comment_reactions?.find(r => r.user_id === userId)?.reaction}
                                  >
                                    <button className={`text-[10px] font-bold transition-colors select-none ${rootC.comment_reactions?.some(r => r.user_id === userId) ? "text-gold" : "text-navy-dark/40 hover:text-gold"}`}>
                                      {rootC.comment_reactions?.some(r => r.user_id === userId) ? labelMap[rootC.comment_reactions.find(r => r.user_id === userId)!.reaction] : "Reaccionar"}
                                    </button>
                                  </ReactionPicker>
                                  <button onClick={() => handleInitiateReply(rootC.id, rootC.is_anonymous ? "Agente Anónimo" : (rootC.profiles?.username || "Agente"))} className="text-[10px] font-bold text-navy-dark/40 hover:text-gold transition-colors select-none">Responder</button>
                                  {rootC.comment_reactions && rootC.comment_reactions.length > 0 && (
                                    <div className="flex items-center gap-0.5 ml-auto">
                                      {Array.from(new Set(rootC.comment_reactions.map(r => r.reaction))).slice(0, 3).map(t => (
                                        <span key={t} className="text-[10px] leading-none">{emojiMap[t]}</span>
                                      ))}
                                      <span className="text-[9px] text-navy-dark/40 ml-0.5">{rootC.comment_reactions.length}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* REPLIES */}
                          {getThreadDescendants(rootC.id, previews).length > 0 && (
                            <div className="pl-6 ml-4 mt-2 border-l-2 border-gray-100 space-y-4 relative">
                              {!expandedComments[rootC.id] ? (
                                <button 
                                  onClick={() => toggleExpand(rootC.id)}
                                  className="text-[11px] font-bold text-navy-dark/40 hover:text-gold transition-colors flex items-center gap-2 group py-1"
                                >
                                  <div className="w-6 h-[1px] bg-gray-100 group-hover:bg-gold transition-colors absolute -left-[1px] top-1/2" />
                                  Ver {getThreadDescendants(rootC.id, previews).length} respuesta{getThreadDescendants(rootC.id, previews).length !== 1 ? 's' : ''}
                                </button>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => toggleExpand(rootC.id)}
                                    className="text-[11px] font-bold text-navy-dark/40 hover:text-gold transition-colors flex items-center gap-2 group py-1 mb-2"
                                  >
                                    <div className="w-6 h-[1px] bg-gray-100 group-hover:bg-gold transition-colors absolute -left-[1px] top-4" />
                                    Ocultar respuestas
                                  </button>
                                  {getThreadDescendants(rootC.id, previews).map(reply => (
                                    <div key={reply.id} className="flex gap-2.5 relative group/reply">
                                      <div className="absolute -left-[24px] top-4 w-6 h-[1px] bg-gray-100 group-hover/reply:bg-gold transition-colors" />
                                      <div className="w-6 h-6 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-gold border border-gold/20 overflow-hidden mt-0.5">
                                        {reply.is_anonymous ? <Fingerprint size={10} className="text-gold" /> : reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover" /> : (reply.profiles?.username?.[0]?.toUpperCase() ?? "A")}
                                      </div>
                                      <div className="flex-1">
                                        <div className="bg-gray-50/80 rounded-2xl px-3 py-2 relative group">
                                          <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="text-[11px] font-bold text-navy-dark">{reply.is_anonymous ? "Agente Anónimo" : (reply.profiles?.username || "Agente")}</p>
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
                                        {/* Sub-Reply actions */}
                                        {!editingCommentId && (
                                          <div className="px-3 mt-1 flex items-center gap-3">
                                            <ReactionPicker
                                              onSelect={t => handleToggleCommentReaction(reply.id, post.id, t)}
                                              disabled={!userId}
                                              currentReaction={reply.comment_reactions?.find(r => r.user_id === userId)?.reaction}
                                            >
                                              <button className={`text-[9px] font-bold transition-colors select-none ${reply.comment_reactions?.some(r => r.user_id === userId) ? "text-gold" : "text-navy-dark/40 hover:text-gold"}`}>
                                                {reply.comment_reactions?.some(r => r.user_id === userId) ? labelMap[reply.comment_reactions.find(r => r.user_id === userId)!.reaction] : "Me gusta"}
                                              </button>
                                            </ReactionPicker>
                                            {reply.comment_reactions && reply.comment_reactions.length > 0 && (
                                              <div className="flex items-center gap-0.5 ml-auto">
                                                {Array.from(new Set(reply.comment_reactions.map(r => r.reaction))).slice(0, 2).map(t => (
                                                  <span key={t} className="text-[9px] leading-none">{emojiMap[t]}</span>
                                                ))}
                                                <span className="text-[8px] text-navy-dark/40 ml-0.5">{reply.comment_reactions.length}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div className="px-3 mt-1 flex">
                                          <button onClick={() => handleInitiateReply(reply.id, reply.is_anonymous ? "Agente Anónimo" : (reply.profiles?.username || "Agente"))} className="text-[10px] font-bold text-navy-dark/40 hover:text-gold transition-colors select-none">Responder</button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
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
                                 ref={commentInputRef}
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
                               <div className="flex items-center justify-between pt-2">
                                 <label className="flex items-center gap-2 cursor-pointer group select-none">
                                   <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAnonymousComment ? "bg-navy-dark border-navy-dark" : "border-gray-300 bg-white group-hover:border-navy-dark"}`}>
                                      {isAnonymousComment && <CornerDownRight size={10} className="text-white transform rotate-45" />}
                                   </div>
                                   <span className="text-[11px] font-sans text-navy-dark/70 font-medium group-hover:text-navy-dark transition-colors">Comentar de forma anónima</span>
                                   <input type="checkbox" checked={isAnonymousComment} onChange={(e) => setIsAnonymousComment(e.target.checked)} className="hidden" />
                                 </label>
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
