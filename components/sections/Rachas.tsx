"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, CheckCircle, Loader2, Target, PenTool } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import confetti from "canvas-confetti";

type Streak = {
  streak_days: number;
  last_checkin: string | null;
  last_mission_title?: string | null;
  last_mission_note?: string | null;
  user_id: string;
  profiles: { 
    username: string | null; 
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function Rachas({ 
  communityId,
  profile,
  isAllowedToFetch = true
}: { 
  communityId?: string,
  profile?: any,
  isAllowedToFetch?: boolean
}) {
  const [topStreaks, setTopStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(profile?.id || null);
  const [myStreak, setMyStreak] = useState<Streak | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cheeringId, setCheeringId] = useState<string | null>(null);
  const [cheeredIds, setCheeredIds] = useState<Set<string>>(new Set());

  // Form state
  const [missionNote, setMissionNote] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (isAllowedToFetch) {
      fetchData();
    }
  }, [communityId, isAllowedToFetch]);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  const fetchData = async () => {
    if (topStreaks.length === 0) setLoading(true);
    setError(null);

    try {
      let streaksQuery = supabase
        .from("streaks")
        .select("streak_days, last_checkin, user_id, last_mission_title, last_mission_note, profiles(username, full_name, avatar_url)")
        .order("streak_days", { ascending: false })
        .limit(20);

      if (communityId) streaksQuery = streaksQuery.eq('community_id', communityId);
      else streaksQuery = streaksQuery.is('community_id', null);

      const { data, error: streaksError } = await streaksQuery;

      const isTestUser = (s: any) => 
        s.user_id === '11111111-1111-1111-1111-111111111111' || 
        s.profiles?.full_name?.toLowerCase().includes('agente base') ||
        s.profiles?.username?.toLowerCase().includes('agente base');

      if (streaksError) {
        console.warn("Retrying streak fetch:", streaksError.message);
        const { data: fallback, error: fbErr } = await supabase.from("streaks").select("streak_days, user_id, profiles(username)").limit(20);
        if (fbErr) throw fbErr;
        setTopStreaks(((fallback as any) || []).filter((s: any) => !isTestUser(s)).slice(0, 10));
      } else {
        setTopStreaks(((data as any) || []).filter((s: any) => !isTestUser(s)).slice(0, 10));
      }

      // Check self streak using existing userId
      if (userId) {
        const mine = (data as any)?.find((s: any) => s.user_id === userId);
        if (mine) setMyStreak(mine);
        else {
          supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle().then(({ data: myD }: { data: any; error: any }) => {
            if (myD) setMyStreak(myD as any);
          });
        }
      }
    } catch (err: any) {
      console.error("fetchData error:", err);
      setError("Sede Offline: Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyStreak = async (uId: string, currentTop: Streak[]) => {
    const mine = currentTop.find(s => s.user_id === uId);
    if (mine) {
      setMyStreak(mine);
      return;
    }

    let myQuery = supabase
      .from("streaks")
      .select("streak_days, last_checkin, user_id, last_mission_title, last_mission_note, profiles(username, full_name, avatar_url)")
      .eq("user_id", uId);
    if (communityId) myQuery = myQuery.eq('community_id', communityId);
    else myQuery = myQuery.is('community_id', null);

    myQuery.maybeSingle().then(({ data: myData }: { data: any; error: any }) => {
      if (myData) {
        setMyStreak(myData as unknown as Streak);
      } else {
        // Fallback sin columnas de misión
        let fallbackQ = supabase
          .from("streaks")
          .select("streak_days, last_checkin, user_id, profiles(username, full_name)")
          .eq("user_id", uId);
        if (communityId) fallbackQ = fallbackQ.eq("community_id", communityId);
        else fallbackQ = fallbackQ.is("community_id", null);
        fallbackQ.maybeSingle().then(({ data: fb }: { data: any; error: any }) => {
          if (fb) setMyStreak(fb as unknown as Streak);
        });
      }
    });
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || checkingIn || !missionNote.trim()) return;

    setCheckingIn(true);
    setStatusMsg(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let newDays = 1;

    if (myStreak && myStreak.last_checkin) {
      const last = new Date(myStreak.last_checkin);
      last.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - last.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) { 
        newDays = myStreak.streak_days; 
        setStatusMsg({ message: "Ya registraste tu misión de hoy, pero vamos a actualizar tu nota.", type: 'success' });
      } else if (diffDays === 1) {
        newDays = myStreak.streak_days + 1;
      } else {
        newDays = 1;
      }
    }

    const payload = {
      user_id: userId, 
      streak_days: newDays, 
      last_checkin: new Date().toISOString(),
      last_mission_title: "Misión Completada",
      last_mission_note: missionNote.trim(),
      community_id: communityId || null
    };

    // Optimistic UI: assume success to give instant feedback
    const oldStreak = myStreak;
    setMyStreak({
      ...payload,
      profiles: myStreak?.profiles || null
    } as any);

    try {
      let reqError;
      const { data: existing } = await supabase
        .from("streaks")
        .select("id")
        .eq("user_id", userId)
        .is("community_id", communityId || null)
        .maybeSingle();

      if (existing) {
         const { error } = await supabase.from("streaks").update(payload).eq("id", existing.id);
         reqError = error;
      } else {
         const { error } = await supabase.from("streaks").insert(payload);
         reqError = error;
      }

      if (!reqError) {
        setStatusMsg({ message: "¡Misión registrada con éxito! Tu racha ha subido.", type: 'success' });
        await fetchData();
        setMissionNote("");
      } else {
        throw reqError;
      }
    } catch (err: any) {
      console.error("Error updating streak:", err);
      setStatusMsg({ message: `Error: ${err.message || 'No se pudo guardar'}`, type: 'error' });
      setMyStreak(oldStreak); // Rollback optimistic UI
    } finally {
      setCheckingIn(false);
    }
  };

  const hasCheckedInToday = () => {
    if (!myStreak || !myStreak.last_checkin) return false;
    const last = new Date(myStreak.last_checkin);
    const today = new Date();
    return last.getDate() === today.getDate() && 
           last.getMonth() === today.getMonth() && 
           last.getFullYear() === today.getFullYear();
  };

  const handleCheer = async (target: Streak) => {
    if (!userId || cheeringId || cheeredIds.has(target.user_id) || target.user_id === userId) return;

    // 1. Optimistic feedback: Confetti first!
    setCheeredIds(prev => new Set(prev).add(target.user_id));
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#D4A017', '#FF4500', '#FFA500', '#101726']
    });

    setCheeringId(target.user_id);
    const myName = myStreak?.profiles?.full_name || myStreak?.profiles?.username || "Un Agente";
    const message = `¡${myName} te animó a seguir con tu racha de ${target.streak_days} días! 🔥`;

    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: target.user_id,
        actor_id: userId,
        type: "cheer",
        message,
        link: "#rachas"
      });

      if (error) throw error;
      setStatusMsg({ message: `¡Ánimo enviado a ${target.profiles?.full_name || 'Agente'}!`, type: 'success' });
    } catch (err: any) {
      console.error("Error sending cheer:", err);
      // Even if notification fails, the user already saw the confetti celebration
      setStatusMsg({ message: "Tu ánimo fue enviado, aunque la notificación tardará un poco.", type: 'error' });
    } finally {
      setCheeringId(null);
    }
  };

  const getRankStyle = (idx: number) => {
    switch(idx) {
      case 0: return {
        border: "border-gold",
        bg: "bg-gold/10",
        text: "text-gold",
        shadow: "shadow-[0_0_15px_rgba(212,175,55,0.3)]",
        label: "Oro"
      };
      case 1: return {
        border: "border-slate-400",
        bg: "bg-slate-400/10",
        text: "text-slate-500",
        shadow: "shadow-sm",
        label: "Plata"
      };
      case 2: return {
        border: "border-amber-700",
        bg: "bg-amber-700/10",
        text: "text-amber-800",
        shadow: "shadow-sm",
        label: "Bronce"
      };
      default: return {
        border: "border-gold/20",
        bg: "bg-white",
        text: "text-navy-dark",
        shadow: "shadow-inner",
        label: ""
      };
    }
  };

  return (
    <section className="py-16 md:py-32 bg-white relative overflow-hidden" id="rachas">
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-8 relative z-10">
        <div className="flex flex-col md:flex-row items-start lg:items-center gap-16 lg:gap-24 mb-16">
          <div className="flex-1">
             <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-4 inline-block flex items-center gap-2">
              <Target size={16} /> Misiones Diarias
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-dark leading-tight mb-6">
              Rachas de Agentes Nacional
            </h2>
            <p className="font-sans text-lg text-navy-dark/70 leading-relaxed max-w-xl mb-4">
              Recuerda hacer algo diferente hoy y marcar tu racha, algo que implique no ser arrastrado por el algoritmo. Cualquier detalle cuenta.
            </p>
            <div className="bg-gold/10 inline-block px-4 py-2 rounded-xl border border-gold/20">
              <p className="font-sans text-sm text-gold font-bold">
                🏆 En el próximo congreso será premiado el agente con la mayor racha.
              </p>
            </div>
          </div>

          <div className="flex-1 w-full flex justify-center">
             <div className="bg-cream border border-light-gray rounded-3xl p-8 shadow-sm max-w-md w-full relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold/20 via-gold to-gold/20" />
               
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h3 className="font-serif text-2xl font-bold text-navy-dark flex items-center gap-2">
                     <Flame className={`w-8 h-8 ${hasCheckedInToday() ? 'text-gold fill-gold' : 'text-light-gray'}`} />
                     Tu Llama
                   </h3>
                 </div>
                 <div className="text-right">
                   <p className="text-4xl font-sans font-black text-gold leading-none">
                     {myStreak?.streak_days || 0}
                   </p>
                   <span className="text-sm text-navy-dark/50 font-sans uppercase tracking-wider">días</span>
                 </div>
               </div>

               {loading ? (
                 <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gold" /></div>
               ) : hasCheckedInToday() ? (
                 <div className="bg-white rounded-2xl p-6 text-center border border-light-gray">
                   <CheckCircle className="text-green-500 w-12 h-12 mx-auto mb-4" />
                   <h4 className="font-serif font-bold text-navy-dark text-xl mb-2">Misión Completada</h4>
                   {myStreak?.last_mission_note && (
                     <p className="text-navy-dark/80 font-sans text-sm italic bg-cream p-4 rounded-xl border border-light-gray">
                       "{myStreak.last_mission_note}"
                     </p>
                   )}
                   <p className="text-[10px] uppercase font-bold tracking-wider text-navy-dark/40 mt-6">
                     Vuelve mañana para continuar tu racha
                   </p>
                 </div>
               ) : userId ? (
                 <form onSubmit={handleCheckIn} className="space-y-4">
                   <div>
                     <label className="block text-sm font-sans font-bold text-navy-dark mb-2">¿Qué misión cumpliste hoy? (FBI)</label>
                     <textarea 
                       value={missionNote}
                       onChange={(e) => setMissionNote(e.target.value)}
                       placeholder="Escribe brevemente tu reporte misionero. Ej: Oré intensamente en la mañana y recordé que mi valor viene del cielo."
                       rows={4}
                       required
                       className="w-full p-4 bg-white rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold transition-all outline-none font-sans text-sm resize-none"
                     />
                   </div>

                   <button 
                     type="submit"
                     disabled={checkingIn || !missionNote.trim()}
                     className="w-full py-4 mt-2 bg-gold hover:bg-gold/90 disabled:opacity-50 text-white rounded-xl font-sans font-bold transition-all shadow-md flex items-center justify-center gap-2"
                   >
                     {checkingIn ? <Loader2 className="animate-spin" /> : <><PenTool size={18} /> Registrar Misión</>}
                   </button>
                 </form>
               ) : (
                 <div className="text-center p-6 bg-white rounded-2xl border border-light-gray">
                   <p className="text-sm font-sans text-navy-dark/70">Inicia sesión para registrar tu progreso y ver misiones diarias.</p>
                 </div>
               )}

               {statusMsg && (
                <div className={`mt-4 p-4 rounded-xl text-xs font-sans font-bold border animate-fade-in ${
                  statusMsg.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-600'
                }`}>
                  {statusMsg.type === 'error' ? '⚠️ ' : '✅ '}
                  {statusMsg.message}
                </div>
               )}
             </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto bg-white border border-light-gray rounded-3xl p-6 md:p-12 shadow-sm">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-light-gray">
            <h3 className="text-2xl font-serif font-semibold text-navy-dark flex items-center gap-2">
              <Trophy className="text-gold" />
              Líderes de Constancia Nacional
            </h3>
            <span className="text-sm font-sans text-navy-dark/60 font-medium bg-cream px-3 py-1 rounded-full">Top 10</span>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-10 px-4 mb-8 bg-red-50 rounded-3xl border border-red-100 text-center">
              <p className="text-red-600 font-sans font-medium mb-4">{error}</p>
              <button 
                onClick={() => fetchData()}
                className="px-6 py-2 bg-navy-dark text-white rounded-full font-sans font-bold text-sm hover:bg-navy-dark/90 transition-all active:scale-95"
              >
                Reintentar Carga
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-gold w-8 h-8" />
            </div>
          ) : topStreaks.length === 0 && !error ? (
            <div className="text-center py-12">
              <p className="text-navy-dark/50">Todavía no hay líderes registrados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topStreaks.map((streak, idx) => {
                const name = streak.profiles?.full_name || streak.profiles?.username || "Agente";
                const rStyle = getRankStyle(idx);
                const isMe = streak.user_id === userId;
                const hasCheered = cheeredIds.has(streak.user_id);

                return (
                  <div
                    key={idx}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl transition-all group gap-4 border ${
                      isMe ? "bg-gold/5 border-gold shadow-md" : `bg-cream/30 ${rStyle.border} ${idx < 3 ? 'shadow-md' : 'shadow-sm'}`
                    } hover:scale-[1.01] duration-300`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Ranking Number */}
                      <div className={`w-6 text-center font-serif font-black ${idx < 3 ? rStyle.text + ' text-xl' : 'text-navy-dark/20 text-base'}`}>
                        {idx + 1}
                      </div>

                      {/* Avatar with Medal Style */}
                      <div className={`relative w-14 h-14 rounded-full flex-shrink-0 animate-in zoom-in duration-500 delay-${idx * 100}`}>
                        <div className={`w-full h-full rounded-full overflow-hidden border-2 ${rStyle.border} ${rStyle.shadow} p-0.5 bg-white`}>
                          {streak.profiles?.avatar_url ? (
                            <img 
                              src={streak.profiles.avatar_url} 
                              alt={name} 
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <div className={`w-full h-full rounded-full flex items-center justify-center font-serif font-bold text-lg ${rStyle.bg} ${rStyle.text}`}>
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {idx < 3 && (
                          <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${idx === 0 ? 'bg-gold' : idx === 1 ? 'bg-slate-400' : 'bg-amber-700'} flex items-center justify-center border-2 border-white shadow-sm`}>
                            <Trophy size={12} className="text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold font-sans text-navy-dark truncate">{name}</h4>
                          {isMe && <span className="text-[10px] bg-navy-dark text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Tú</span>}
                        </div>
                        {streak.last_mission_note && (
                          <p className="text-xs text-navy-dark/60 font-sans mt-0.5 line-clamp-1 italic">
                            "{streak.last_mission_note}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Animar Button - for Top 10, not for self */}
                      {idx < 10 && !isMe && (
                        <button
                          onClick={() => handleCheer(streak)}
                          disabled={hasCheered || cheeringId === streak.user_id}
                          className={`px-4 py-2 rounded-full font-sans font-bold text-xs transition-all flex items-center gap-2 ${
                            hasCheered
                              ? "bg-green-100 text-green-600 cursor-default"
                              : "bg-navy-dark text-white hover:bg-gold hover:text-navy-dark shadow-md active:scale-95 disabled:opacity-50"
                          }`}
                        >
                          {cheeringId === streak.user_id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : hasCheered ? (
                            <>¡Ánimo enviado! ✨</>
                          ) : (
                            <>Animar 🔥</>
                          )}
                        </button>
                      )}

                      <div className={`flex items-center gap-2 ${rStyle.text} font-bold font-sans text-xl bg-white px-4 py-2 rounded-xl border ${rStyle.border} flex-shrink-0 min-w-[80px] justify-center`}>
                        <Flame size={20} className={idx < 3 ? "fill-current animate-pulse" : "fill-transparent"} />
                        {streak.streak_days}
                      </div>
                    </div>
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
