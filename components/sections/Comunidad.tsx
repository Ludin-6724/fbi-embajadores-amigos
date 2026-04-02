"use client";

import { useEffect, useState } from "react";

import { Flame, BookOpen, Fingerprint, MessageCircle, Heart, MessageSquare, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";


type Comment = {
  id: string;
  content: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

type Reaction = {
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
  post_reactions?: Reaction[];
  comments?: Comment[];
};

export default function Comunidad({ communityId }: { communityId?: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingReaction, setSubmittingReaction] = useState(false);
  const [activeTab, setActiveTab] = useState<'muro' | 'oratorio'>('muro');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newPrayerText, setNewPrayerText] = useState("");
  const [submittingPrayer, setSubmittingPrayer] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchPosts();
  }, [activeTab, communityId]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    let query = supabase
      .from("posts")
      .select("id, author_id, content, is_anonymous, community_id, created_at, profiles(username, full_name, avatar_url), post_reactions(reaction), comments(id, content, profiles(username, full_name, avatar_url))")
      .order("created_at", { ascending: false })
      .limit(20);

    if (activeTab === 'oratorio') {
      query = query.eq('is_anonymous', true);
    } else {
      query = query.neq('is_anonymous', true);
    }

    if (communityId) {
       query = query.eq('community_id', communityId);
    } else {
       query = query.is('community_id', null);
    }

    const { data: fullData, error: fullError } = await query;
      
    if (fullError) {
      console.warn("Nuevas tablas no detectadas, usando fallback clásico:", fullError); // Fallback ignore community_id
      let fallbackQuery = supabase
        .from("posts")
        .select("id, author_id, content, created_at, profiles(username, full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(20);
        
      const { data: fallbackData } = await fallbackQuery;
      if (activeTab === 'oratorio') {
        setPosts([]); 
      } else {
        setPosts((fallbackData as unknown as Post[]) ?? []);
      }
    } else {
      setPosts((fullData as unknown as Post[]) ?? []);
    }
    setLoading(false);
  };

  const handlePostPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayerText.trim() || !currentUserId || submittingPrayer) return;
    
    setSubmittingPrayer(true);
    await supabase.from("posts").insert({
      author_id: currentUserId,
      content: newPrayerText.trim(),
      is_anonymous: activeTab === 'oratorio',
      community_id: communityId || null
    });
    
    setNewPrayerText("");
    await fetchPosts();
    setSubmittingPrayer(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta publicación?")) return;
    
    await supabase.from("posts").delete().eq("id", postId);
    await fetchPosts();
  };

  const handleReact = async (postId: string, reactionType: "like" | "amen" | "pray") => {
    if (submittingReaction) return;
    setSubmittingReaction(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setSubmittingReaction(false);
    
    // Si ya reaccionó, la DB lanzará error por constraint de unicidad que es esperado
    await supabase.from("post_reactions").insert({
      post_id: postId,
      user_id: user.id,
      reaction: reactionType
    });
    
    await fetchPosts();
    setSubmittingReaction(false);
  };

  const submitComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("comments").insert({
      post_id: postId,
      author_id: user.id,
      content: commentText.trim()
    });
    
    setCommentText("");
    await fetchPosts();
  };

  return (
    <section className="py-16 md:py-32 bg-cream text-navy-dark relative z-10" id="comunidad">
      <div className="container mx-auto px-4 md:px-8">
        {/* Posts feed */}
        <div className="pt-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-2 inline-block">
              Red FBI Oficial
            </span>
            <h3 className="text-3xl font-serif text-navy-dark font-bold flex items-center gap-3">
              Muro de Agentes <MessageCircle className="text-gold" size={28} />
            </h3>
          </div>

          <div className="flex justify-center mb-10">
            <div className="bg-cream/50 p-1 border border-light-gray rounded-full flex gap-1">
              <button
                onClick={() => setActiveTab('muro')}
                className={`px-6 py-2.5 rounded-full font-sans text-sm font-bold transition-all ${
                  activeTab === 'muro' ? 'bg-white shadow flex gap-2 items-center text-navy-dark' : 'text-navy-dark/60 hover:text-navy-dark hover:bg-cream'
                }`}
              >
                Muro Principal
              </button>
              {currentUserId && (
                <button
                  onClick={() => setActiveTab('oratorio')}
                  className={`px-6 py-2.5 rounded-full font-sans text-sm font-bold transition-all ${
                    activeTab === 'oratorio' ? 'bg-white shadow flex gap-2 items-center text-navy-dark' : 'text-navy-dark/60 hover:text-navy-dark hover:bg-cream'
                  }`}
                >
                  Oración Anónima
                </button>
              )}
            </div>
          </div>

          {/* Formulario rápido para nueva publicación */}
          {currentUserId && (
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-light-gray mb-8">
              <form onSubmit={handlePostPrayer} className="flex flex-col gap-4">
                <textarea
                  value={newPrayerText}
                  onChange={(e) => setNewPrayerText(e.target.value)}
                  placeholder={
                    activeTab === 'oratorio' 
                      ? "Escribe tu petición de oración. Será publicada anónimamente..."
                      : "¿Qué ha hecho Dios hoy? Comparte un testimonio, foto o pensamiento con los agentes..."
                  }
                  className="w-full bg-cream/30 border border-light-gray rounded-2xl p-4 font-sans text-navy-dark outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={!newPrayerText.trim() || submittingPrayer}
                  className="self-end px-6 py-2 bg-gold hover:bg-gold/90 text-white font-sans font-bold rounded-full transition-all flex items-center gap-2 shadow disabled:opacity-50"
                >
                  {submittingPrayer ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : activeTab === 'oratorio' ? (
                    "Publicar Oración"
                  ) : (
                    "Publicar al Muro"
                  )}
                </button>
              </form>
            </div>
          )}

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
                {activeTab === 'oratorio' ? 'No hay peticiones de oración' : 'El muro aún está en silencio'}
              </h4>
              <p className="text-navy-dark/50 font-sans text-sm max-w-sm">
                {activeTab === 'oratorio' 
                  ? 'Aún no hay oraciones anónimas en tu comunidad. Sé el primero en abrir tu corazón.'
                  : 'Aún no hay publicaciones en la comunidad. Usa el Panel de Control arriba para compartir tu mensaje de luz.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => {
                const postDate = new Date(post.created_at).toLocaleDateString("es-ES", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                
                const isAnonymous = post.is_anonymous === true;
                const username = isAnonymous ? "Agente Anónimo" : (post.profiles?.username || post.profiles?.full_name || "Agente");
                
                const likes = post.post_reactions?.filter(r => r.reaction === 'like').length || 0;
                const amens = post.post_reactions?.filter(r => r.reaction === 'amen').length || 0;
                const prays = post.post_reactions?.filter(r => r.reaction === 'pray').length || 0;

                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-light-gray hover:shadow-md transition-all flex flex-col group relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-cream overflow-hidden border border-gold/30 flex items-center justify-center">
                          {isAnonymous ? (
                            <Fingerprint size={24} className="text-navy-dark/40" />
                          ) : post.profiles?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.profiles.avatar_url}
                              alt={username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-serif font-bold text-gold text-lg">
                              {username[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold font-sans text-navy-dark text-base leading-none mb-1">
                            {username}
                          </p>
                          <p className="text-xs text-navy-dark/50 font-sans">{postDate}</p>
                        </div>
                      </div>
                      {currentUserId === post.author_id && (
                        <button 
                          onClick={() => handleDeletePost(post.id)}
                          className="text-xs font-sans text-red-500/50 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded-full transition-colors"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <p className="font-sans text-navy-dark/90 text-base leading-relaxed mb-6 whitespace-pre-wrap">
                      {post.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-4 border-t border-light-gray pt-4">
                      <button onClick={() => handleReact(post.id, 'like')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream hover:bg-gold/10 text-sm font-semibold text-navy-dark/70 transition-colors">
                        <Heart size={16} className={likes > 0 ? "fill-gold text-gold" : "text-navy-dark/50"} /> {likes > 0 && likes}
                      </button>
                      <button onClick={() => handleReact(post.id, 'amen')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream hover:bg-gold/10 text-sm font-semibold text-navy-dark/70 transition-colors">
                        🙏 Amén {amens > 0 && `(${amens})`}
                      </button>
                      <button onClick={() => handleReact(post.id, 'pray')} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream hover:bg-gold/10 text-sm font-semibold text-navy-dark/70 transition-colors">
                        🙌 Ora por mí {prays > 0 && `(${prays})`}
                      </button>
                      
                      <div className="flex-1" />
                      
                      <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cream hover:bg-navy-dark/5 text-sm font-semibold text-navy-dark/70 transition-colors">
                        <MessageSquare size={16} /> {post.comments?.length || 0} Comentarios
                      </button>
                    </div>

                    {/* Comments Section */}
                    {activeCommentPost === post.id && (
                      <div className="mt-4 pt-4 border-t border-light-gray bg-cream/30 -mx-6 -mb-6 p-6">
                        <div className="space-y-4 mb-6">
                          {post.comments && post.comments.length > 0 ? post.comments.map(comment => (
                            <div key={comment.id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 flex items-center justify-center font-serif text-sm font-bold text-gold border border-light-gray">
                                {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} className="w-full h-full rounded-full object-cover" />
                                  ) : (comment.profiles?.username || "A")[0].toUpperCase()
                                }
                              </div>
                              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-light-gray shadow-sm flex-1">
                                <p className="font-semibold font-sans text-xs text-navy-dark mb-1">
                                  {comment.profiles?.username || comment.profiles?.full_name || "Agente"}
                                </p>
                                <p className="text-sm font-sans text-navy-dark/80">{comment.content}</p>
                              </div>
                            </div>
                          )) : (
                            <p className="text-center text-xs text-navy-dark/50 italic">Nadie ha comentado aún. Sé el primero.</p>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Escribe un comentario..."
                            className="flex-1 text-sm py-2 px-4 rounded-full border border-light-gray bg-white focus:border-gold outline-none font-sans"
                            onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                          />
                          <button 
                            disabled={!commentText.trim()} 
                            onClick={() => submitComment(post.id)}
                            className="bg-navy-dark text-white px-4 rounded-full text-sm font-semibold hover:bg-navy-dark/90 transition-colors disabled:opacity-50"
                          >
                            Enviar
                          </button>
                        </div>
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
