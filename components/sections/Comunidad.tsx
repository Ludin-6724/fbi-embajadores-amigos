"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Fingerprint, MessageCircle, Heart, MessageSquare, Loader2, Send, Trash2, Edit3, X, Check, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ─── */
type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id?: string | null;
  content: string;
  created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

type ReactionRow = {
  id: string;
  user_id: string;
  reaction: "like" | "amen" | "pray";
};

type Post = {
  id: string;
  author_id: string;
  content: string;
  is_anonymous?: boolean;
  community_id?: string | null;
  created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  post_reactions: ReactionRow[];
  comments: CommentRow[];
  total_comments?: number; // Added to store total count separately if needed
};

/* ─── Supabase Select Strings ─── */
// Initial select for the feed: only 2 comments
const POST_SELECT = `
  id, author_id, content, is_anonymous, community_id, created_at,
  profiles(username, full_name, avatar_url),
  post_reactions(id, user_id, reaction),
  comments(id, author_id, parent_id, content, created_at, profiles(username, full_name, avatar_url))
`.replace(/\n/g, " ").trim();

export default function Comunidad({ communityId, initialTab = "muro", hideTabs = false, postId }: { communityId?: string, initialTab?: "muro" | "oratorio", hideTabs?: boolean, postId?: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"muro" | "oratorio">(initialTab);
  const [userId, setUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string; snippet: string } | null>(null);
  const [newPostText, setNewPostText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const [fullComments, setFullComments] = useState<Record<string, CommentRow[]>>({});
  const [fetchingFull, setFetchingFull] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // Sync activeTab with initialTab when it changes from outside
  useEffect(() => {
    setActiveTab(initialTab);
    setPage(0);
    setHasMore(true);
  }, [initialTab]);

  const supabase = createClient();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ─── Toast helper ─── */
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const buildQuery = useCallback((currentPage: number) => {
    let q = supabase
      .from("posts")
      .select(POST_SELECT)
      .order("created_at", { ascending: false })
      .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1)
      .limit(2, { referencedTable: "comments" });

    if (postId) {
      q = q.eq("id", postId);
      return q;
    }

    if (activeTab === "oratorio") {
      q = q.eq("is_anonymous", true);
    } else {
      q = q.neq("is_anonymous", true);
    }

    if (communityId) {
      q = q.eq("community_id", communityId);
    } else {
      q = q.is("community_id", null);
    }
    return q;
  }, [activeTab, communityId, postId]);

  /* ─── Fetch posts from DB ─── */
  const fetchPosts = useCallback(async (silent = false, isLoadMore = false) => {
    // Only show full loading if it's the first time and we have no posts
    if (!silent && !isLoadMore && posts.length === 0) setLoading(true);
    if (isLoadMore) setLoadingMore(true);
    setError(null);

    try {
      // getUser y posts query en paralelo — ahorra 300-500ms
      const [userResult, postsResult] = await Promise.all([
        supabase.auth.getUser(),
        buildQuery(page),
      ]);

      const user = userResult.data?.user;
      if (user) setUserId(user.id);

      const { data, error } = postsResult;

      if (error) {
        console.warn("Query error:", error.message);
        setError("No se pudieron cargar las publicaciones. Reintenta más tarde.");
      } else {
        const postsData = (data as unknown as Post[]) ?? [];

        if (postsData.length < pageSize) setHasMore(false);

        // Mostrar posts INMEDIATAMENTE — sin esperar el conteo de comentarios
        if (page === 0) {
          setPosts(postsData);
        } else {
          setPosts(prev => [...prev, ...postsData]);
        }

        // Conteo de comentarios en background — no bloquea el render
        const postIds = postsData.map(p => p.id);
        if (postIds.length > 0) {
          supabase
            .from("comments")
            .select("post_id")
            .in("post_id", postIds)
            .then(({ data: countsData }) => {
              if (!countsData) return;
              const counts: Record<string, number> = {};
              countsData.forEach(c => {
                counts[c.post_id] = (counts[c.post_id] || 0) + 1;
              });
              setPosts(prev => prev.map(p => ({
                ...p,
                total_comments: counts[p.id] ?? p.total_comments ?? 0,
              })));
            });
        }
      }
    } catch (err) {
      console.error("fetchPosts error:", err);
      setError("Error de conexión. Verifica tu internet.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery, page, posts.length]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    fetchPosts(false, page > 0);
  }, [page, activeTab, communityId, postId]);

  const fetchFullComments = useCallback(async (postId: string) => {
    setFetchingFull(prev => ({ ...prev, [postId]: true }));
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(`id, post_id, author_id, parent_id, content, created_at, profiles(username, full_name, avatar_url)`)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setFullComments(prev => ({ ...prev, [postId]: data as unknown as CommentRow[] }));
      }
    } catch (err) {
      console.error("fetchFullComments error:", err);
    } finally {
      setFetchingFull(prev => ({ ...prev, [postId]: false }));
    }
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  /* ═══════════════════════════════════════════════════
     POST ACTIONS
     ═══════════════════════════════════════════════════ */

  /* ─── Create Post ─── */
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() || !userId || submitting) return;

    setSubmitting(true);
    const content = newPostText.trim();
    setNewPostText("");

    // Optimistic: add at top
    const tempPost: Post = {
      id: "temp-" + Date.now(),
      author_id: userId,
      content,
      is_anonymous: activeTab === "oratorio",
      community_id: communityId || null,
      created_at: new Date().toISOString(),
      profiles: { username: "Tú", full_name: "Tú", avatar_url: null },
      post_reactions: [],
      comments: [],
    };
    setPosts(prev => [tempPost, ...prev]);

    const { data: newPostData, error } = await supabase.from("posts").insert({
      author_id: userId,
      content,
      is_anonymous: activeTab === "oratorio",
      community_id: communityId || null,
    }).select(POST_SELECT).single();

    if (error) {
      showToast("No se pudo publicar: " + error.message, false);
      setPosts(prev => prev.filter(p => p.id !== tempPost.id));
    } else {
      showToast("¡Publicación creada!");
      if (newPostData) {
        setPosts(prev => prev.map(p => p.id === tempPost.id ? (newPostData as unknown as Post) : p));
      }
    }
    setSubmitting(false);
  };

  /* ─── Delete Post ─── */
  const handleDeletePost = async (postId: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta publicación?")) return;

    // Optimistic remove
    const backup = posts;
    setPosts(prev => prev.filter(p => p.id !== postId));

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      showToast("No se pudo eliminar: " + error.message, false);
      setPosts(backup);
    } else {
      showToast("Publicación eliminada");
    }
  };

  /* ─── Edit Post ─── */
  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditPostText(post.content);
  };

  const cancelEditing = () => {
    setEditingPostId(null);
    setEditPostText("");
  };

  const saveEdit = async (postId: string) => {
    if (!editPostText.trim()) return;
    const newContent = editPostText.trim();
    const backup = posts;

    // Optimistic
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
    setEditingPostId(null);
    setEditPostText("");

    const { error } = await supabase.from("posts").update({ content: newContent }).eq("id", postId);
    if (error) {
      showToast("No se pudo editar: " + error.message, false);
      setPosts(backup);
    } else {
      showToast("Publicación editada");
    }
  };

  /* ═══════════════════════════════════════════════════
     REACTION ACTIONS — Toggle on/off like a real social
     ═══════════════════════════════════════════════════ */

  const handleToggleReaction = async (postId: string, reactionType: "like" | "amen" | "pray") => {
    if (!userId) {
      showToast("Inicia sesión para reaccionar", false);
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Check if user already reacted with this type
    const existingReaction = post.post_reactions.find(
      r => r.user_id === userId && r.reaction === reactionType
    );

    if (existingReaction) {
      // REMOVE reaction — optimistic
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return { ...p, post_reactions: p.post_reactions.filter(r => r.id !== existingReaction.id) };
      }));

      const { error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (error) {
        showToast("Error al quitar reacción", false);
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          return { ...p, post_reactions: [...p.post_reactions, existingReaction] };
        }));
      }
    } else {
      // ADD reaction — optimistic
      const tempReaction: ReactionRow = {
        id: "temp-" + Date.now(),
        user_id: userId,
        reaction: reactionType,
      };

      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return { ...p, post_reactions: [...p.post_reactions, tempReaction] };
      }));

      const { data: newReactionData, error } = await supabase.from("post_reactions").insert({
        post_id: postId,
        user_id: userId,
        reaction: reactionType,
      }).select("id, user_id, reaction").single();

      if (error) {
        if (error.code === "23505") {
          showToast("Ya reaccionaste con este tipo", false);
        } else {
          showToast("Error al reaccionar: " + error.message, false);
        }
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          return { ...p, post_reactions: p.post_reactions.filter(r => r.id !== tempReaction.id) };
        }));
      } else if (newReactionData) {
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          return { ...p, post_reactions: p.post_reactions.map(r => r.id === tempReaction.id ? (newReactionData as ReactionRow) : r) };
        }));
      }
    }
  };

  /* ═══════════════════════════════════════════════════
     COMMENT ACTIONS
     ═══════════════════════════════════════════════════ */

  const handleSubmitComment = async (postId: string) => {
    const text = (commentTexts[postId] || "").trim();
    if (!text || !userId) return;

    // Clear input first
    setCommentTexts(prev => ({ ...prev, [postId]: "" }));

    // Optimistic add
    const tempComment: CommentRow = {
      id: "temp-" + Date.now(),
      post_id: postId,
      author_id: userId,
      parent_id: replyingTo?.id || null,
      content: text,
      created_at: new Date().toISOString(),
      profiles: { username: "Tú", full_name: "Tú", avatar_url: null },
    };

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...p.comments, tempComment], total_comments: (p.total_comments || 0) + 1 };
    }));

    const { data: newCommentData, error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: userId,
      parent_id: replyingTo?.id || null,
      content: text,
    }).select(`id, post_id, author_id, parent_id, content, created_at, profiles(username, full_name, avatar_url)`).single();

    setReplyingTo(null);

    if (error) {
      showToast("No se pudo comentar: " + error.message, false);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return { ...p, comments: p.comments.filter(c => c.id !== tempComment.id), total_comments: Math.max(0, (p.total_comments || 1) - 1) };
      }));
    } else if (newCommentData) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return { ...p, comments: p.comments.map(c => c.id === tempComment.id ? (newCommentData as unknown as CommentRow) : c) };
      }));
      setFullComments(prev => {
        if (!prev[postId]) return prev;
        return { ...prev, [postId]: prev[postId].map(c => c.id === tempComment.id ? (newCommentData as unknown as CommentRow) : c) };
      });
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const backup = posts;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: p.comments.filter(c => c.id !== commentId), total_comments: Math.max(0, (p.total_comments || 1) - 1) };
    }));

    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      showToast("No se pudo eliminar comentario", false);
      setPosts(backup);
    }
  };

  /* ─── Share Post ─── */
  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}/post/${post.id}`;
    const authorName = post.is_anonymous ? "Agente Anónimo" : (post.profiles?.username || post.profiles?.full_name || "Agente");
    const title = `Publicación de ${authorName} - Red FBI`;
    const text = post.content.length > 100 ? post.content.substring(0, 100) + "..." : post.content;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(url);
          showToast("Enlace copiado al portapapeles");
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      showToast("Enlace copiado al portapapeles");
    }
  };

  /* ═══════════════════════════════════════════════════
     RENDER HELPERS
     ═══════════════════════════════════════════════════ */

  const countReaction = (post: Post, type: string) =>
    post.post_reactions.filter(r => r.reaction === type).length;

  const userHasReacted = (post: Post, type: string) =>
    userId ? post.post_reactions.some(r => r.user_id === userId && r.reaction === type) : false;

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `hace ${days}d`;
    return new Date(dateStr).toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  const renderCommentNode = (comment: CommentRow, allComments: CommentRow[], postId: string, depth = 0): React.ReactNode => {
    const replies = allComments.filter(c => c.parent_id === comment.id);
    const parentComment = comment.parent_id ? allComments.find(c => c.id === comment.parent_id) : null;
    const authorName = comment.profiles?.username || comment.profiles?.full_name || "Agente";
    const repliesOpen = !!expandedReplies[comment.id];

    return (
      <div key={comment.id} className={depth > 0 ? "ml-7 mt-2" : ""}>
        <div className="flex gap-2.5">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-cream flex-shrink-0 flex items-center justify-center font-serif text-xs font-bold text-gold border border-light-gray overflow-hidden mt-0.5">
            {comment.profiles?.avatar_url
              ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
              : authorName[0].toUpperCase()
            }
          </div>

          <div className="flex-1 min-w-0">
            {/* Bubble */}
            <div className="bg-cream/60 rounded-2xl rounded-tl-sm px-3 py-2 inline-block max-w-full">
              <p className="font-bold text-xs text-navy-dark mb-0.5 font-sans">{authorName}</p>
              {/* Contexto de respuesta citado */}
              {parentComment && (
                <div className="flex items-start gap-1 mb-1.5 bg-white/80 rounded-lg px-2 py-1 border-l-2 border-gold/40">
                  <p className="text-[11px] text-navy-dark/50 leading-snug italic">
                    <span className="font-semibold not-italic text-gold/80">@{parentComment.profiles?.username || "Agente"}: </span>
                    {parentComment.content.length > 55 ? parentComment.content.slice(0, 55) + "…" : parentComment.content}
                  </p>
                </div>
              )}
              <p className="text-sm font-sans text-navy-dark/85 break-words leading-snug">{comment.content}</p>
            </div>

            {/* Fila de acciones — siempre visible, no requiere hover */}
            <div className="flex items-center gap-3 mt-1 pl-1">
              <span className="text-[11px] text-navy-dark/30 font-sans">{timeAgo(comment.created_at)}</span>
              {userId && depth < 4 && (
                <button
                  onClick={() => {
                    setReplyingTo({ id: comment.id, username: authorName, snippet: comment.content.slice(0, 60) });
                    if (openComments !== postId) setOpenComments(postId);
                  }}
                  className="text-[11px] font-bold text-navy-dark/45 hover:text-gold transition-colors active:scale-95"
                >
                  Responder
                </button>
              )}
              {userId === comment.author_id && (
                <button
                  onClick={() => handleDeleteComment(postId, comment.id)}
                  className="text-[11px] text-red-400/50 hover:text-red-500 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>

            {/* Botón de respuestas colapsables */}
            {replies.length > 0 && (
              <button
                onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                className="flex items-center gap-1.5 mt-1.5 pl-1 text-[11px] font-bold text-gold hover:text-gold/70 transition-colors"
              >
                <div className="w-5 h-px bg-gold/40" />
                {repliesOpen
                  ? "Ocultar respuestas"
                  : `${replies.length} respuesta${replies.length > 1 ? "s" : ""}`
                }
              </button>
            )}

            {/* Respuestas anidadas */}
            {repliesOpen && replies.length > 0 && (
              <div className="mt-1.5 space-y-2">
                {replies.map(r => renderCommentNode(r, allComments, postId, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
  return (
    <section className="py-16 md:py-32 bg-cream text-navy-dark relative z-10" id="comunidad">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-lg border animate-fade-in max-w-[90vw] text-center ${
          toast.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <p className="font-sans font-bold text-sm">{toast.msg}</p>
        </div>
      )}

      <div className="container mx-auto px-4 md:px-8">
        <div className="pt-8">
          {/* Header */}
          {!hideTabs && (
            <div className="flex flex-col items-center mb-8 text-center">
              <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-2 inline-block">
                Red FBI Oficial
              </span>
              <h3 className="text-3xl font-serif text-navy-dark font-bold flex items-center gap-3">
                Muro de Agentes <MessageCircle className="text-gold" size={28} />
              </h3>
            </div>
          )}

          {/* Tabs */}
          {!hideTabs && (
            <div className="flex justify-center mb-10">
              <div className="bg-cream/50 p-1 border border-light-gray rounded-full flex gap-1">
                <button
                  onClick={() => setActiveTab("muro")}
                  className={`px-6 py-2.5 rounded-full font-sans text-sm font-bold transition-all ${
                    activeTab === "muro"
                      ? "bg-white shadow text-navy-dark"
                      : "text-navy-dark/60 hover:text-navy-dark hover:bg-cream"
                  }`}
                >
                  Muro Principal
                </button>
                {userId && (
                  <button
                    onClick={() => setActiveTab("oratorio")}
                    className={`px-6 py-2.5 rounded-full font-sans text-sm font-bold transition-all ${
                      activeTab === "oratorio"
                        ? "bg-white shadow text-navy-dark"
                        : "text-navy-dark/60 hover:text-navy-dark hover:bg-cream"
                    }`}
                  >
                    Oración Anónima
                  </button>
                )}
              </div>
            </div>
          )}

          {/* New Post Form           {/* Intro Text for Mobile/Clean Views */}
          {activeTab === "oratorio" && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gold/20 mb-6 text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold/20 via-gold to-gold/20" />
              <MessageSquare className="mx-auto text-gold mb-3 opacity-50 group-hover:scale-110 transition-transform" size={32} />
              <h4 className="font-serif text-xl font-bold text-navy-dark mb-2">Oración</h4>
              <p className="font-sans text-navy-dark/70 text-xs italic max-w-sm mx-auto leading-relaxed">
                "Confesaos vuestras ofensas unos a otros, y orad unos por otros, para que seáis sanados. La oración eficaz del justo puede mucho."
              </p>
              <footer className="mt-2 text-[9px] uppercase font-bold tracking-widest text-gold text-center">Santiago 5:16 RVR1960</footer>
            </div>
          )}

          {/* New Post Form - Only show in regular feed mode */}
          {userId && !postId && (
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-light-gray mb-8">
              <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
                <textarea
                  value={newPostText}
                  onChange={e => setNewPostText(e.target.value)}
                  placeholder={
                    activeTab === "oratorio"
                      ? "Escribe tu petición de oración. Será publicada anónimamente..."
                      : "¿Qué ha hecho Dios hoy? Comparte un testimonio o pensamiento con los agentes..."
                  }
                  className="w-full bg-cream/30 border border-light-gray rounded-2xl p-4 font-sans text-navy-dark outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={!newPostText.trim() || submitting}
                  className="self-end px-6 py-2.5 bg-gold hover:bg-gold/90 text-white font-sans font-bold rounded-full transition-all flex items-center gap-2 shadow disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <><Send size={14} /> {activeTab === "oratorio" ? "Publicar Oración" : "Publicar al Muro"}</>
                  )}
                </button>
              </form>
            </div>
          )}
          
          {activeTab === "muro" && (
            <div className="mb-8 pt-4">
               <h4 className="font-serif text-2xl font-bold text-navy-dark text-center">Novedades de los Agentes</h4>
               <div className="w-12 h-1 bg-gold mx-auto mt-2 rounded-full" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-10 px-4 mb-8 bg-red-50 rounded-3xl border border-red-100 text-center">
              <p className="text-red-600 font-sans font-medium mb-4">{error}</p>
              <button 
                onClick={() => fetchPosts()}
                className="px-6 py-2 bg-navy-dark text-white rounded-full font-sans font-bold text-sm hover:bg-navy-dark/90 transition-all active:scale-95"
              >
                Reintentar Carga
              </button>
            </div>
          )}

          {/* Posts List */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-light-gray">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                <MessageCircle size={28} className="text-gold/60" />
              </div>
              <h4 className="font-serif text-xl font-semibold text-navy-dark mb-2">
                {activeTab === "oratorio" ? "No hay peticiones de oración" : "El muro aún está en silencio"}
              </h4>
              <p className="text-navy-dark/50 font-sans text-sm max-w-sm">
                {activeTab === "oratorio"
                  ? "Aún no hay oraciones anónimas. Sé el primero en abrir tu corazón."
                  : "Aún no hay publicaciones. ¡Comparte tu mensaje de luz!"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-6 max-w-2xl mx-auto">
              {posts.map(post => {
                const postDate = timeAgo(post.created_at);
                const isAnonymous = post.is_anonymous === true;
                const displayName = isAnonymous
                  ? "Agente Anónimo"
                  : post.profiles?.username || post.profiles?.full_name || "Agente";

                const likes = countReaction(post, "like");
                const amens = countReaction(post, "amen");
                const prays = countReaction(post, "pray");
                const isMine = userId === post.author_id;
                const isEditing = editingPostId === post.id;

                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-light-gray hover:shadow-md transition-all flex flex-col group relative overflow-hidden"
                  >
                    {/* Post Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-cream overflow-hidden border border-gold/30 flex items-center justify-center flex-shrink-0">
                          {isAnonymous ? (
                            <Fingerprint size={24} className="text-navy-dark/40" />
                          ) : post.profiles?.avatar_url ? (
                            <img src={post.profiles.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-serif font-bold text-gold text-lg">
                              {displayName[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold font-sans text-navy-dark text-base leading-none mb-1">{displayName}</p>
                          <p className="text-xs text-navy-dark/50 font-sans">{postDate}</p>
                        </div>
                      </div>

                      {/* Post owner actions */}
                      {isMine && (
                        <div className="flex items-center gap-1">
                          {!isEditing && (
                            <button
                              onClick={() => startEditing(post)}
                              className="text-xs font-sans text-navy-dark/40 hover:text-gold p-2 rounded-full transition-colors"
                              title="Editar"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="text-xs font-sans text-navy-dark/40 hover:text-red-500 p-2 rounded-full transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Post Content / Edit Mode */}
                    {isEditing ? (
                      <div className="mb-6">
                        <textarea
                          value={editPostText}
                          onChange={e => setEditPostText(e.target.value)}
                          className="w-full bg-cream/30 border border-gold rounded-xl p-3 font-sans text-navy-dark outline-none resize-none text-sm"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2 justify-end">
                          <button onClick={cancelEditing} className="px-3 py-1.5 text-xs font-semibold text-navy-dark/60 hover:text-navy-dark rounded-full border border-light-gray transition-colors flex items-center gap-1">
                            <X size={12} /> Cancelar
                          </button>
                          <button onClick={() => saveEdit(post.id)} disabled={!editPostText.trim()} className="px-3 py-1.5 text-xs font-semibold text-white bg-gold hover:bg-gold/90 rounded-full transition-colors flex items-center gap-1 disabled:opacity-50">
                            <Check size={12} /> Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-sans text-navy-dark/90 text-base leading-relaxed mb-6 whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}

                    {/* Reactions Bar */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-light-gray pt-4">
                      <button
                        onClick={() => handleToggleReaction(post.id, "like")}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          userHasReacted(post, "like")
                            ? "bg-gold/15 text-gold border border-gold/30"
                            : "bg-cream hover:bg-gold/10 text-navy-dark/60"
                        }`}
                      >
                        <Heart size={15} className={userHasReacted(post, "like") ? "fill-gold text-gold" : ""} />
                        {likes > 0 && likes}
                      </button>
                      <button
                        onClick={() => handleToggleReaction(post.id, "amen")}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          userHasReacted(post, "amen")
                            ? "bg-gold/15 text-gold border border-gold/30"
                            : "bg-cream hover:bg-gold/10 text-navy-dark/60"
                        }`}
                      >
                        🙏 {amens > 0 && amens}
                      </button>
                      <button
                        onClick={() => handleToggleReaction(post.id, "pray")}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          userHasReacted(post, "pray")
                            ? "bg-gold/15 text-gold border border-gold/30"
                            : "bg-cream hover:bg-gold/10 text-navy-dark/60"
                        }`}
                      >
                        🙌 {prays > 0 && prays}
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => {
                          const next = openComments === post.id ? null : post.id;
                          setOpenComments(next);
                          if (next && !fullComments[post.id] && (post.total_comments ?? post.comments.length) > 2) {
                            fetchFullComments(post.id);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          openComments === post.id
                            ? "bg-navy-dark/10 text-navy-dark"
                            : "bg-cream hover:bg-navy-dark/5 text-navy-dark/60"
                        }`}
                      >
                        <MessageSquare size={15} />
                        {(post.total_comments ?? post.comments.length) > 0 && (post.total_comments ?? post.comments.length)}
                      </button>
                      <button
                        onClick={() => handleShare(post)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all bg-cream hover:bg-gold/10 text-navy-dark/60"
                        title="Compartir publicación"
                      >
                        <Share2 size={15} />
                      </button>
                    </div>

                    {/* Comments Section — always visible (Facebook-style) */}
                    {(post.comments.length > 0 || userId) && (
                      <div className="mt-3 pt-3 border-t border-light-gray">
                        {openComments === post.id ? (
                          /* EXPANDED: full hierarchical comment list */
                          <div className="space-y-3 mb-3 max-h-96 overflow-y-auto pr-1">
                            {fetchingFull[post.id] ? (
                              <div className="flex justify-center py-4">
                                <Loader2 size={20} className="animate-spin text-gold" />
                              </div>
                            ) : (() => {
                              const postComments = fullComments[post.id] || post.comments;
                              if (postComments.length === 0) {
                                return <p className="text-center text-xs text-navy-dark/50 italic py-2">Nadie ha comentado aún. Sé el primero.</p>;
                              }
                              const roots = fullComments[post.id]
                                ? postComments.filter(c => !c.parent_id)
                                : postComments;
                              return roots.map(c => renderCommentNode(c, postComments, post.id));
                            })()}
                          </div>
                        ) : (
                          /* PREVIEW: últimos 2 comentarios siempre visibles */
                          <>
                            {(post.total_comments ?? 0) > post.comments.length && (
                              <button
                                onClick={() => { setOpenComments(post.id); fetchFullComments(post.id); }}
                                className="block text-xs font-bold text-navy-dark/50 hover:text-gold mb-2 transition-colors"
                              >
                                Ver todos los {post.total_comments} comentarios
                              </button>
                            )}
                            {post.comments.length > 0 && (
                              <div className="space-y-2 mb-2">
                                {post.comments.slice(0, 2).map(comment => {
                                  const name = comment.profiles?.username || comment.profiles?.full_name || "Agente";
                                  return (
                                    <div key={comment.id} className="flex gap-2 items-start">
                                      <div className="w-6 h-6 rounded-full bg-cream flex-shrink-0 flex items-center justify-center font-serif text-xs font-bold text-gold border border-light-gray overflow-hidden mt-0.5">
                                        {comment.profiles?.avatar_url
                                          ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                                          : name[0].toUpperCase()
                                        }
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="bg-cream/60 rounded-2xl rounded-tl-sm px-2.5 py-1.5 inline-block max-w-full">
                                          <span className="font-bold text-xs text-navy-dark font-sans">{name} </span>
                                          <span className="text-sm font-sans text-navy-dark/80 break-words">{comment.content}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 pl-1">
                                          <span className="text-[10px] text-navy-dark/30">{timeAgo(comment.created_at)}</span>
                                          {userId && (
                                            <button
                                              onClick={() => {
                                                setReplyingTo({ id: comment.id, username: name, snippet: comment.content.slice(0, 60) });
                                                setOpenComments(post.id);
                                                fetchFullComments(post.id);
                                              }}
                                              className="text-[10px] font-bold text-navy-dark/40 hover:text-gold transition-colors"
                                            >
                                              Responder
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}

                        {/* Input de comentario — siempre visible para usuarios autenticados */}
                        {userId && (
                          <div className="flex flex-col gap-1.5 mt-2">
                            {replyingTo && openComments === post.id && (
                              <div className="flex items-start gap-2 px-3 py-2 bg-gold/8 rounded-xl border-l-2 border-gold/50 animate-fade-in">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-0.5">
                                    Respondiendo a @{replyingTo.username}
                                  </p>
                                  <p className="text-[11px] text-navy-dark/50 italic truncate">
                                    "{replyingTo.snippet}{replyingTo.snippet.length >= 60 ? "…" : ""}"
                                  </p>
                                </div>
                                <button
                                  onClick={() => setReplyingTo(null)}
                                  className="text-gold hover:text-navy-dark transition-colors flex-shrink-0 mt-0.5"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={commentTexts[post.id] || ""}
                                onChange={e => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder={replyingTo && openComments === post.id ? "Escribe una respuesta..." : "Escribe un comentario..."}
                                className="flex-1 text-sm py-2 px-4 rounded-full border border-light-gray bg-white focus:border-gold outline-none font-sans"
                                onFocus={() => { if (openComments !== post.id) setOpenComments(post.id); }}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmitComment(post.id); } }}
                              />
                              <button
                                disabled={!(commentTexts[post.id] || "").trim()}
                                onClick={() => handleSubmitComment(post.id)}
                                className="bg-navy-dark text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-navy-dark/90 transition-colors disabled:opacity-40 flex-shrink-0"
                              >
                                <Send size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-12 pb-20">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3 bg-white border border-light-gray text-navy-dark font-sans font-bold rounded-full hover:bg-cream transition-all shadow-sm disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-gold" />
                      Cargando más...
                    </>
                  ) : (
                    "Cargar más publicaciones"
                  )}
                </button>
              </div>
            )}
            
            {!hasMore && posts.length > 0 && (
              <p className="text-center text-navy-dark/40 font-sans text-sm mt-12 pb-20 italic">
                Has llegado al final del muro
              </p>
            )}
          </>
        )}
        </div>
      </div>
    </section>
  );
}
