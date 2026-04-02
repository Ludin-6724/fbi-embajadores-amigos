"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Fingerprint, MessageCircle, Heart, MessageSquare, Loader2, Send, Trash2, Edit3, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ─── */
type CommentRow = {
  id: string;
  author_id: string;
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
};

/* ─── Supabase Select Strings ─── */
const POST_SELECT = `
  id, author_id, content, is_anonymous, community_id, created_at,
  profiles(username, full_name, avatar_url),
  post_reactions(id, user_id, reaction),
  comments(id, author_id, content, created_at, profiles(username, full_name, avatar_url))
`.replace(/\n/g, " ").trim();

export default function Comunidad({ communityId }: { communityId?: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"muro" | "oratorio">("muro");
  const [userId, setUserId] = useState<string | null>(null);
  const [newPostText, setNewPostText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ─── Toast helper ─── */
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ─── Build a query with the current filters ─── */
  const buildQuery = useCallback(() => {
    let q = supabase
      .from("posts")
      .select(POST_SELECT)
      .order("created_at", { ascending: false })
      .limit(30);

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
  }, [activeTab, communityId]);

  /* ─── Fetch posts from DB ─── */
  const fetchPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data, error } = await buildQuery();

      if (error) {
        console.warn("Query error, trying fallback:", error.message);
        // Minimal fallback
        const { data: fb } = await supabase
          .from("posts")
          .select("id, author_id, content, created_at, profiles(username, full_name, avatar_url)")
          .order("created_at", { ascending: false })
          .limit(30);
        setPosts((fb as unknown as Post[])?.map(p => ({ ...p, post_reactions: [], comments: [] })) ?? []);
      } else {
        setPosts((data as unknown as Post[]) ?? []);
      }
    } catch (err) {
      console.error("fetchPosts error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { fetchPosts(); }, [activeTab, communityId]);

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

    const { error } = await supabase.from("posts").insert({
      author_id: userId,
      content,
      is_anonymous: activeTab === "oratorio",
      community_id: communityId || null,
    });

    if (error) {
      showToast("No se pudo publicar: " + error.message, false);
      setPosts(prev => prev.filter(p => p.id !== tempPost.id));
    } else {
      showToast("¡Publicación creada!");
      // Refresh to get real IDs
      setTimeout(() => fetchPosts(true), 800);
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

    // Optimistic
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
    setEditingPostId(null);
    setEditPostText("");

    const { error } = await supabase.from("posts").update({ content: newContent }).eq("id", postId);
    if (error) {
      showToast("No se pudo editar: " + error.message, false);
      fetchPosts(true);
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
        fetchPosts(true);
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

      const { error } = await supabase.from("post_reactions").insert({
        post_id: postId,
        user_id: userId,
        reaction: reactionType,
      });

      if (error) {
        if (error.code === "23505") {
          showToast("Ya reaccionaste con este tipo", false);
        } else {
          showToast("Error al reaccionar: " + error.message, false);
        }
        fetchPosts(true);
      } else {
        // Sync to get real ID for future toggles
        setTimeout(() => fetchPosts(true), 600);
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
      author_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      profiles: { username: "Tú", full_name: "Tú", avatar_url: null },
    };

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...p.comments, tempComment] };
    }));

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: userId,
      content: text,
    });

    if (error) {
      showToast("No se pudo comentar: " + error.message, false);
      fetchPosts(true);
    } else {
      // Sync to get real IDs
      setTimeout(() => fetchPosts(true), 600);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    // Optimistic remove
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
    }));

    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      showToast("No se pudo eliminar comentario", false);
      fetchPosts(true);
    }
  };

  /* ═══════════════════════════════════════════════════
     RENDER HELPERS
     ═══════════════════════════════════════════════════ */

  const countReaction = (post: Post, type: string) =>
    post.post_reactions.filter(r => r.reaction === type).length;

  const userHasReacted = (post: Post, type: string) =>
    userId ? post.post_reactions.some(r => r.user_id === userId && r.reaction === type) : false;

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
          <div className="flex flex-col items-center mb-8 text-center">
            <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-2 inline-block">
              Red FBI Oficial
            </span>
            <h3 className="text-3xl font-serif text-navy-dark font-bold flex items-center gap-3">
              Muro de Agentes <MessageCircle className="text-gold" size={28} />
            </h3>
          </div>

          {/* Tabs */}
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

          {/* New Post Form */}
          {userId && (
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
                  className="self-end px-6 py-2 bg-gold hover:bg-gold/90 text-white font-sans font-bold rounded-full transition-all flex items-center gap-2 shadow disabled:opacity-50"
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

          {/* Posts List */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
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
            <div className="space-y-6">
              {posts.map(post => {
                const postDate = new Date(post.created_at).toLocaleDateString("es-ES", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                });
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
                    <div className="flex flex-wrap items-center gap-2 mb-2 border-t border-light-gray pt-4">
                      {/* Like */}
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

                      {/* Amen */}
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

                      {/* Pray */}
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

                      {/* Comments toggle */}
                      <button
                        onClick={() => setOpenComments(openComments === post.id ? null : post.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                          openComments === post.id
                            ? "bg-navy-dark/10 text-navy-dark"
                            : "bg-cream hover:bg-navy-dark/5 text-navy-dark/60"
                        }`}
                      >
                        <MessageSquare size={15} /> {post.comments.length > 0 && post.comments.length}
                      </button>
                    </div>

                    {/* Comments Panel */}
                    {openComments === post.id && (
                      <div className="mt-3 pt-4 border-t border-light-gray bg-cream/20 -mx-6 -mb-6 p-6 rounded-b-2xl">
                        {/* Comment list */}
                        <div className="space-y-3 mb-4">
                          {post.comments.length > 0 ? (
                            post.comments.map(comment => (
                              <div key={comment.id} className="flex gap-3 group/comment">
                                <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 flex items-center justify-center font-serif text-sm font-bold text-gold border border-light-gray overflow-hidden">
                                  {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                                  ) : (
                                    (comment.profiles?.username || "A")[0].toUpperCase()
                                  )}
                                </div>
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-light-gray shadow-sm flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <p className="font-semibold font-sans text-xs text-navy-dark truncate">
                                      {comment.profiles?.username || comment.profiles?.full_name || "Agente"}
                                    </p>
                                    {userId === comment.author_id && (
                                      <button
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="opacity-0 group-hover/comment:opacity-100 text-red-400 hover:text-red-600 transition-all p-0.5 flex-shrink-0"
                                        title="Eliminar"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm font-sans text-navy-dark/80 break-words">{comment.content}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-xs text-navy-dark/50 italic py-2">
                              Nadie ha comentado aún. Sé el primero.
                            </p>
                          )}
                        </div>

                        {/* Comment input */}
                        {userId && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentTexts[post.id] || ""}
                              onChange={e => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="Escribe un comentario..."
                              className="flex-1 text-sm py-2.5 px-4 rounded-full border border-light-gray bg-white focus:border-gold outline-none font-sans"
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmitComment(post.id); } }}
                            />
                            <button
                              disabled={!(commentTexts[post.id] || "").trim()}
                              onClick={() => handleSubmitComment(post.id)}
                              className="bg-navy-dark text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-navy-dark/90 transition-colors disabled:opacity-40 flex-shrink-0"
                            >
                              <Send size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
