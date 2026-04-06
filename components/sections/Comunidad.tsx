"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Fingerprint, MessageCircle, MessageSquare, Loader2, Send, Trash2, Edit3, X, Check, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReactionPicker, { ReactionType } from "@/components/ui/ReactionPicker";

/* ─── Types ─── */
type ReactionRow = { id: string; user_id: string; reaction: ReactionType; };
type CommentRow = {
  id: string; post_id: string; author_id: string; parent_id?: string | null; content: string; created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  comment_reactions: ReactionRow[];
};
type Post = {
  id: string; author_id: string; content: string; is_anonymous?: boolean; community_id?: string | null; created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  post_reactions: ReactionRow[]; comments: CommentRow[]; total_comments?: number;
};

const POST_SELECT = `
  id, author_id, content, is_anonymous, community_id, created_at,
  profiles(username, full_name, avatar_url),
  post_reactions(id, user_id, reaction),
  comments(id, author_id, parent_id, content, created_at, 
    profiles(username, full_name, avatar_url),
    comment_reactions(id, user_id, reaction)
  )
`.replace(/\s+/g, " ").trim();

export default function Comunidad({ 
  communityId, initialTab = "muro", hideTabs = false, postId, initialProfile, isAllowedToFetch = true 
}: { 
  communityId?: string, initialTab?: "muro" | "oratorio", hideTabs?: boolean, postId?: string, initialProfile?: any, isAllowedToFetch?: boolean 
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(initialProfile?.id || null);
  const [activeTab, setActiveTab] = useState<"muro" | "oratorio">(initialTab);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

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
  }, [initialProfile, userId, supabase]);

  const fetchPosts = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
        if (loading) {
            setLoading(false);
            setError("Tiempo de espera agotado. Reintenta la conexión.");
        }
    }, 10000);

    try {
      let q = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      if (postId) q = q.eq("id", postId);
      else {
        if (activeTab === "oratorio") q = q.eq("is_anonymous", true);
        else q = q.neq("is_anonymous", true);
        if (communityId) q = q.eq("community_id", communityId);
        else q = q.is("community_id", null);
      }
      const { data, error: qError } = (await q) as { data: any, error: any };
      clearTimeout(timer);
      if (qError) setError(`Sede Offline: ${qError.message}`);
      else {
        const postsData = (data as unknown as Post[]) ?? [];
        if (postsData.length < pageSize) setHasMore(false);
        if (page === 0) setPosts(postsData);
        else setPosts(prev => [...prev, ...postsData]);
      }
    } catch (err: any) { setError("Fallo de red."); }
    finally { setLoading(false); clearTimeout(timer); }
  }, [supabase, page, communityId, postId, activeTab]);

  useEffect(() => {
    if (isAllowedToFetch) fetchPosts(page > 0);
  }, [page, communityId, postId, isAllowedToFetch, fetchPosts]);

  const handleSubmitComment = async (pId: string) => {
    const text = (commentTexts[pId] || "").trim();
    if (!text || !userId) return;
    setCommentTexts(prev => ({ ...prev, [pId]: "" }));
    const { data } = (await supabase.from("comments").insert({ post_id: pId, author_id: userId, content: text }).select(`id, post_id, author_id, parent_id, content, created_at, profiles(username, full_name, avatar_url)`).single()) as { data: any };
    if (data) setPosts(prev => prev.map(p => p.id === pId ? { ...p, comments: [...p.comments, { ...data, comment_reactions: [] } as unknown as CommentRow], total_comments: (p.total_comments || 0) + 1 } : p));
  };

  const handleToggleReaction = async (pId: string, type: ReactionType) => {
    if (!userId) { showToast("Sincroniza para reaccionar", false); return; }
    const post = posts.find(p => p.id === pId); if (!post) return;
    const mine = post.post_reactions.find(r => r.user_id === userId);
    if (mine) {
      if (mine.reaction === type) {
        setPosts(prev => prev.map(p => p.id === pId ? { ...p, post_reactions: p.post_reactions.filter(r => r.id !== mine.id) } : p));
        await supabase.from("post_reactions").delete().eq("id", mine.id);
      } else {
        setPosts(prev => prev.map(p => p.id === pId ? { ...p, post_reactions: [...p.post_reactions.filter(r => r.user_id !== userId), { id: "temp", user_id: userId, reaction: type } ] } : p));
        await supabase.from("post_reactions").delete().eq("user_id", userId).eq("post_id", pId);
        const { data } = (await supabase.from("post_reactions").insert({ post_id: pId, user_id: userId, reaction: type }).select("id, user_id, reaction").single()) as { data: any };
        if (data) setPosts(prev => prev.map(p => p.id === pId ? { ...p, post_reactions: p.post_reactions.map(r => r.user_id === userId ? (data as ReactionRow) : r) } : p));
      }
    } else {
      setPosts(prev => prev.map(p => p.id === pId ? { ...p, post_reactions: [...p.post_reactions, { id: "temp", user_id: userId, reaction: type }] } : p));
      const { data } = (await supabase.from("post_reactions").insert({ post_id: pId, user_id: userId, reaction: type }).select("id, user_id, reaction").single()) as { data: any };
      if (data) setPosts(prev => prev.map(p => p.id === pId ? { ...p, post_reactions: p.post_reactions.map(r => r.id === "temp" ? (data as ReactionRow) : r) } : p));
    }
  };

  const handleToggleCommentReaction = async (cId: string, type: ReactionType, pId: string) => {
    if (!userId) return;
    const post = posts.find(p => p.id === pId); if (!post) return;
    const comm = post.comments.find(c => c.id === cId); if (!comm) return;
    const mine = comm.comment_reactions.find(r => r.user_id === userId);
    if (mine) {
       if (mine.reaction === type) {
         setPosts(prev => prev.map(p => p.id === pId ? { ...p, comments: p.comments.map(c => c.id === cId ? { ...c, comment_reactions: c.comment_reactions.filter(r => r.id !== mine.id) } : c) } : p));
         await supabase.from("comment_reactions").delete().eq("id", mine.id);
       } else {
         setPosts(prev => prev.map(p => p.id === pId ? { ...p, comments: p.comments.map(c => c.id === cId ? { ...c, comment_reactions: [...c.comment_reactions.filter(r => r.user_id !== userId), { id: "temp", user_id: userId, reaction: type }] } : c) } : p));
         await supabase.from("comment_reactions").delete().eq("user_id", userId).eq("comment_id", cId);
         const { data } = (await supabase.from("comment_reactions").insert({ comment_id: cId, user_id: userId, reaction: type }).select("id, user_id, reaction").single()) as {data:any};
         if (data) setPosts(prev => prev.map(p => p.id === pId ? { ...p, comments: p.comments.map(c => c.id === cId ? { ...c, comment_reactions: c.comment_reactions.map(r => r.user_id === userId ? (data as ReactionRow) : r) } : c) } : p));
       }
    } else {
       setPosts(prev => prev.map(p => p.id === pId ? { ...p, comments: p.comments.map(c => c.id === cId ? { ...c, comment_reactions: [...c.comment_reactions, { id: "temp", user_id: userId, reaction: type }] } : c) } : p));
       const { data } = (await supabase.from("comment_reactions").insert({ comment_id: cId, user_id: userId, reaction: type }).select("id, user_id, reaction").single()) as {data:any};
       if (data) setPosts(prev => prev.map(p => p.id === pId ? { ...p, comments: p.comments.map(c => c.id === cId ? { ...c, comment_reactions: c.comment_reactions.map(r => r.id === "temp" ? (data as ReactionRow) : r) } : c) } : p));
    }
  };

  const emojiMap: any = { like: "👍", heart: "❤️", haha: "😂", amen: "🙏", pray: "🙌" };
  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "ahora";
    const mins = Math.floor(diff/60000); if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins/60); if (hrs < 24) return `${hrs}h`;
    return new Date(d).toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  const renderCommentNode = (c: CommentRow, pId: string): React.ReactNode => {
    const name = c.profiles?.username || "Agente";
    return (
      <div key={c.id} className="mt-4 animate-in fade-in slide-in-from-left-2 duration-300">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-cream flex-shrink-0 flex items-center justify-center text-xs font-bold text-gold border border-gold/20 overflow-hidden shadow-sm">
            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" alt={name} /> : name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="relative inline-block max-w-full">
              <div className="bg-cream/40 backdrop-blur-sm rounded-2xl px-4 py-2 border border-gold/5">
                <p className="font-bold text-xs text-navy-dark/90 mb-0.5">{name}</p>
                <p className="text-sm text-navy-dark/80 break-words leading-relaxed">{c.content}</p>
              </div>
              {c.comment_reactions?.length > 0 && (
                <div className="absolute -right-2 -bottom-2 flex items-center bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-gold/10 gap-1">
                  <div className="flex -space-x-1">{Array.from(new Set(c.comment_reactions.map(r=>r.reaction))).slice(0,2).map(t=><span key={t} className="text-[10px]">{emojiMap[t]}</span>)}</div>
                  <span className="text-[9px] font-bold text-navy-dark/50">{c.comment_reactions.length}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 pl-1">
              <span className="text-[10px] text-navy-dark/30 font-medium uppercase tracking-tight">{timeAgo(c.created_at)}</span>
              <ReactionPicker onSelect={(t)=>handleToggleCommentReaction(c.id, t, pId)}>
                <button className={`text-[10px] font-bold transition-colors ${commHasMine(c) ? "text-gold" : "text-navy-dark/40 hover:text-gold"}`}>Reaccionar</button>
              </ReactionPicker>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const commHasMine = (c: CommentRow) => c.comment_reactions?.some(r => r.user_id === userId);

  return (
    <section className="py-20 bg-cream text-navy-dark relative z-10" id="comunidad">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl bg-navy-dark text-white border border-gold/30">
          <p className="font-bold text-sm">{toast.msg}</p>
        </div>
      )}
      <div className="container mx-auto px-4">
        {loading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32"><Loader2 className="w-10 h-10 animate-spin text-gold mb-4" /><p className="text-sm font-bold text-gold uppercase">Sincronizando...</p></div>
        ) : error ? (
          <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-red-100 text-center shadow-lg"><h4 className="text-red-600 font-bold mb-2">Error</h4><p className="text-xs text-navy-dark/60 mb-6">{error}</p><button onClick={() => fetchPosts()} className="bg-navy-dark text-white px-6 py-2 rounded-full font-bold text-sm">Reintentar</button></div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {!hideTabs && (
               <div className="flex gap-2 mb-6 bg-white p-1 rounded-full border border-gold/10 shadow-sm max-w-xs mx-auto">
                  <button onClick={() => setActiveTab("muro")} className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === "muro" ? "bg-navy-dark text-white shadow-md" : "text-navy-dark/40 hover:text-navy-dark"}`}>Muro</button>
                  <button onClick={() => setActiveTab("oratorio")} className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === "oratorio" ? "bg-navy-dark text-white shadow-md" : "text-navy-dark/40 hover:text-navy-dark"}`}>Oración</button>
               </div>
            )}
            {posts.map(post => {
              const name = post.is_anonymous ? "Agente Anónimo" : post.profiles?.username || "Agente";
              const myR = post.post_reactions.find(r => r.user_id === userId)?.reaction;
              return (
                <div key={post.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gold/10 hover:shadow-md transition-all relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-cream border border-gold/20 flex items-center justify-center overflow-hidden">{post.profiles?.avatar_url && !post.is_anonymous ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="font-bold text-gold">{post.is_anonymous ? <Fingerprint size={20}/> : name[0]}</span>}</div>
                      <div><p className="font-bold text-navy-dark leading-none pb-1">{name}</p><p className="text-[10px] text-navy-dark/40">{timeAgo(post.created_at)}</p></div>
                    </div>
                  </div>
                  <p className="text-navy-dark/90 leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-gold/5">
                    <div className="flex items-center gap-2">
                      <ReactionPicker onSelect={t => handleToggleReaction(post.id, t)} disabled={!userId}>
                        <button className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${myR ? "bg-gold/10 text-gold" : "bg-cream text-navy-dark/50"}`}>{myR ? <><span className="text-base">{emojiMap[myR]}</span> {myR}</> : "Reaccionar"}</button>
                      </ReactionPicker>
                      {post.post_reactions.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1.5 shadow-[0_2px_10px_rgba(212,160,23,0.15)] border border-gold/20">
                          <div className="flex -space-x-1.5">{Array.from(new Set(post.post_reactions.map(r=>r.reaction))).slice(0,3).map(t=><span key={t} className="text-[13px] drop-shadow-sm">{emojiMap[t]}</span>)}</div>
                          <span className="text-[11px] font-bold text-navy-dark/60 ml-0.5">{post.post_reactions.length}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setOpenComments(openComments === post.id ? null : post.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-navy-dark/50 hover:bg-gold/5 active:scale-95 transition-all"><MessageSquare size={14} /> {post.total_comments || post.comments.length}</button>
                  </div>
                  {openComments === post.id && (
                    <div className="mt-4 pt-4 border-t border-gold/10 animate-fade-in">
                      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">{post.comments.map(c => renderCommentNode(c, post.id))}</div>
                      {userId && (<div className="mt-4"><div className="flex gap-2 bg-cream/40 p-2 rounded-full border border-gold/10"><input type="text" value={commentTexts[post.id] || ""} onChange={e => setCommentTexts(p => ({ ...p, [post.id]: e.target.value }))} placeholder="Responder..." className="flex-1 bg-transparent border-none outline-none text-xs px-2" onKeyDown={e => e.key === "Enter" && (handleSubmitComment(post.id))} /><button onClick={() => handleSubmitComment(post.id)} className="w-8 h-8 bg-navy-dark text-white rounded-full flex items-center justify-center hover:bg-gold transition-colors"><Send size={12} /></button></div></div>)}
                    </div>
                  )}
                </div>
              );
            })}
            {hasMore && !loading && (
               <button onClick={() => { setPage(p => p + 1); fetchPosts(true); }} className="w-full py-4 text-xs font-bold text-gold uppercase tracking-widest hover:text-navy-dark transition-colors">Cargar más misiones</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
