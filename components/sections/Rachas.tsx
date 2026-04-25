"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, CheckCircle, Loader2, Target, PenTool, Shield, Coins, Store, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import confetti from "canvas-confetti";
import { cache } from "@/lib/utils/cache";

type Streak = {
  streak_days: number;
  last_checkin: string | null;
  last_mission_title?: string | null;
  last_mission_note?: string | null;
  user_id: string;
  max_streak?: number;
  profiles: { 
    username: string | null; 
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const PROTECTOR_PACKS = [
  { days: 1, cost: 50,  label: "Escudo Básico",   emoji: "🛡️", desc: "Protege 1 día de ausencia" },
  { days: 2, cost: 120, label: "Escudo Doble",     emoji: "⚔️", desc: "Protege 2 días consecutivos" },
  { days: 3, cost: 300, label: "Escudo Legendario", emoji: "🏰", desc: "Protege 3 días — Máxima seguridad" },
];

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

  // Points & Store
  const [myPoints, setMyPoints] = useState(profile?.points || 0);
  const [myProtectors, setMyProtectors] = useState(profile?.streak_protectors || 0);
  const [buyingPack, setBuyingPack] = useState<number | null>(null);
  const [storeMsg, setStoreMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [missionNote, setMissionNote] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (isAllowedToFetch) {
      // 1. Try to load from Cache first
      const { data: cachedStreaks } = cache.peekStale<Streak[]>(`streaks_${communityId || 'global'}`);
      const { data: cachedMyStreak } = cache.peekStale<Streak>(`my_streak_${communityId || 'global'}`);
      
      if (cachedStreaks?.length) {
        setTopStreaks(cachedStreaks);
        setLoading(false);
      }
      if (cachedMyStreak) {
        setMyStreak(cachedMyStreak);
      }

      // 2. Fetch fresh data
      fetchData();
    }
  }, [communityId, isAllowedToFetch]);

  // Load points from profile
  useEffect(() => {
    if (userId && isAllowedToFetch) {
      supabase.from('profiles').select('points, streak_protectors').eq('id', userId).single()
        .then(({ data }: { data: any }) => {
          if (data) {
            setMyPoints(data.points || 0);
            setMyProtectors(data.streak_protectors || 0);
          }
        });
    }
  }, [userId, isAllowedToFetch]);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  useEffect(() => {
    if (storeMsg) {
      const timer = setTimeout(() => setStoreMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [storeMsg]);

  const fetchData = async () => {
    if (topStreaks.length === 0) setLoading(true);
    setError(null);

    try {
      let streaksQuery = supabase
        .from("streaks")
        .select("streak_days, max_streak, last_checkin, user_id, last_mission_title, last_mission_note, profiles(username, full_name, avatar_url)")
        .order("max_streak", { ascending: false })
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
        const { data: fallback, error: fbErr } = await supabase.from("streaks").select("streak_days, max_streak, user_id, profiles(username)").order("max_streak", { ascending: false }).limit(20);
        if (fbErr) throw fbErr;
        const filtered = ((fallback as any) || []).filter((s: any) => !isTestUser(s)).slice(0, 10);
        setTopStreaks(filtered);
        cache.set(`streaks_${communityId || 'global'}`, filtered);
      } else {
        const filtered = ((data as any) || []).filter((s: any) => !isTestUser(s)).slice(0, 10);
        setTopStreaks(filtered);
        cache.set(`streaks_${communityId || 'global'}`, filtered);
      }

      // Check self streak using existing userId
      if (userId) {
        const mine = (data as any)?.find((s: any) => s.user_id === userId);
        if (mine) {
          setMyStreak(mine);
          cache.set(`my_streak_${communityId || 'global'}`, mine);
        }
        else {
          supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle().then(({ data: myD }: { data: any; error: any }) => {
            if (myD) {
              setMyStreak(myD as any);
              cache.set(`my_streak_${communityId || 'global'}`, myD as any);
            }
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
      .select("streak_days, max_streak, last_checkin, user_id, last_mission_title, last_mission_note, profiles(username, full_name, avatar_url)")
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
          .select("streak_days, max_streak, last_checkin, user_id, profiles(username, full_name)")
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
    let protectorUsed = false;
    let daysMissed = 0;

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
        // DiffDays > 1: Falló algunos días. Revisar si hay protectores.
        daysMissed = diffDays - 1;
        try {
          const { data: profileData } = await supabase.from('profiles').select('streak_protectors').eq('id', userId).single();
          const protectors = profileData?.streak_protectors || 0;
          
          if (protectors >= daysMissed) {
            let consumed = 0;
            for (let i = 0; i < daysMissed; i++) {
               const { data: ok } = await supabase.rpc('consume_protector', { user_id: userId });
               if (ok) consumed++;
            }
            if (consumed === daysMissed) {
                newDays = myStreak.streak_days + 1; // Racha salvada
                protectorUsed = true;
                setMyProtectors((prev: any) => Math.max(0, prev - daysMissed));
                setStatusMsg({ message: `Fallaste ${daysMissed} día(s), ¡Pero tu(s) Protector(es) salvaron tu racha! 🛡️🔥`, type: 'success' });
            } else {
                newDays = 1;
                setStatusMsg({ message: `Tu racha se reinició. No tenías suficientes protectores. ¡Vamos de nuevo! 💪`, type: 'error' });
            }
          } else {
            newDays = 1;
            setStatusMsg({ message: `Perdiste ${daysMissed} día(s) sin registrar. Tu racha se reinició a 1. ¡Vamos de nuevo! 💪`, type: 'error' });
          }
        } catch (e) {
          console.warn("Could not check protectors", e);
          newDays = 1;
        }
      }
    }

    const newMaxStreak = Math.max(myStreak?.max_streak || 0, newDays);

    const payload = {
      user_id: userId, 
      streak_days: newDays, 
      max_streak: newMaxStreak,
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
        // Otorgar 10 puntos si la racha creció (y no fue día repetido)
        if (newDays > (oldStreak?.streak_days || 0)) {
            await supabase.rpc('award_streak_points', { user_id: userId, points_to_add: 10 }).catch(() => {});
            setMyPoints((prev: any) => prev + 10);
        }

        // Solo publicar en el muro si fue un check-in real (NO protector)
        if (!protectorUsed) {
          try {
            await supabase.from("posts").insert({
              author_id: userId,
              content: `🎯 ¡Acabo de registrar mi misión del día! Racha actual: ${newDays} días (Récord: ${newMaxStreak} días) 🔥\n\n"${missionNote.trim()}"`,
              is_anonymous: false,
              community_id: communityId || null
            });
          } catch (e) {
            console.warn("Failed to auto-post mission milestone to wall", e);
          }
        }

        // Si se usó un protector, enviar notificación
        if (protectorUsed) {
          try {
            await supabase.from("notifications").insert({
              user_id: userId,
              actor_id: userId,
              type: "protector_used",
              message: `🛡️ Tu protector salvó tu racha de ${newDays - 1} días. Cubrió ${daysMissed} día(s) de ausencia. ¡Sigue sin fallar!`,
              link: "#rachas"
            });
          } catch (e) {
            console.warn("Notification for protector use failed", e);
          }
        }

        if (!statusMsg) {
          setStatusMsg({ message: "¡Misión registrada con éxito! Tu racha ha subido y ganaste 10 🪙.", type: 'success' });
        }
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

  const handleBuyPack = async (pack: typeof PROTECTOR_PACKS[0]) => {
    if (!userId || buyingPack !== null) return;
    setBuyingPack(pack.days);
    setStoreMsg(null);

    try {
      const { data, error } = await supabase.rpc('purchase_protector', { 
        user_id: userId, 
        cost: pack.cost, 
        days_count: pack.days 
      });
      if (error) throw error;
      if (data) {
        setMyPoints((prev: any) => prev - pack.cost);
        setMyProtectors((prev: any) => prev + pack.days);
        setStoreMsg({ text: `¡${pack.label} comprado! +${pack.days} protector(es) 🛡️`, type: "success" });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#D4A017', '#4F46E5', '#10B981']
        });
      } else {
        setStoreMsg({ text: "No tienes suficientes puntos 🪙. ¡Sigue con tu racha!", type: "error" });
      }
    } catch (err: any) {
      setStoreMsg({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setBuyingPack(null);
    }
  };

  const handleCheer = async (target: Streak) => {
    if (!userId || cheeringId || cheeredIds.has(target.user_id) || target.user_id === userId) return;

    // 1. Optimistic feedback: Confetti first!
    setCheeredIds((prev: Set<string>) => new Set(prev).add(target.user_id));
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

        {/* ── Puntos y Protectores ─────────────────────────────── */}
        {userId && (
          <div className="max-w-4xl mx-auto mb-12">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Puntos */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-5 border border-amber-200/50 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-amber-300/10 rounded-full blur-lg group-hover:bg-amber-300/20 transition-all" />
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <Coins size={22} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-amber-800/60 font-bold uppercase tracking-widest">Mis Puntos</p>
                    <p className="text-2xl font-black text-amber-700 font-sans leading-none">{myPoints}</p>
                  </div>
                </div>
                <p className="text-[10px] text-amber-700/50 font-sans font-medium">+10 🪙 por cada día de racha</p>
              </div>

              {/* Protectores */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl p-5 border border-indigo-200/50 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-indigo-300/10 rounded-full blur-lg group-hover:bg-indigo-300/20 transition-all" />
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                    <Shield size={22} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-800/60 font-bold uppercase tracking-widest">Protectores</p>
                    <p className="text-2xl font-black text-indigo-700 font-sans leading-none">{myProtectors}</p>
                  </div>
                </div>
                <p className="text-[10px] text-indigo-700/50 font-sans font-medium">Salvan tu racha si faltas</p>
              </div>
            </div>

            {/* ── Tienda de Agente ─────────────────────────────── */}
            <div className="bg-gradient-to-br from-navy-dark to-[#1a2744] rounded-3xl p-6 md:p-8 shadow-xl border border-gold/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gold/5 rounded-bl-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold/3 rounded-tr-full pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-gold/20 flex items-center justify-center">
                  <Store size={22} className="text-gold" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
                    Tienda de Agente
                    <Sparkles size={16} className="text-gold" />
                  </h3>
                  <p className="text-[11px] text-white/40 font-sans">Canjea tus puntos por protectores de racha</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PROTECTOR_PACKS.map((pack) => {
                  const canAfford = myPoints >= pack.cost;
                  const isBuying = buyingPack === pack.days;
                  const isLegendary = pack.days === 3;
                  
                  return (
                    <div
                      key={pack.days}
                      className={`rounded-2xl p-4 border transition-all relative overflow-hidden ${
                        isLegendary 
                          ? "bg-gradient-to-b from-gold/20 to-gold/5 border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.15)]" 
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {isLegendary && (
                        <div className="absolute top-2 right-2">
                          <span className="text-[8px] font-black uppercase tracking-widest bg-gold text-navy-dark px-2 py-0.5 rounded-full">
                            Premium
                          </span>
                        </div>
                      )}
                      
                      <div className="text-center mb-3">
                        <span className="text-3xl block mb-1">{pack.emoji}</span>
                        <h4 className={`font-serif font-bold text-sm ${isLegendary ? 'text-gold' : 'text-white'}`}>
                          {pack.label}
                        </h4>
                        <p className="text-[10px] text-white/40 font-sans mt-0.5">{pack.desc}</p>
                      </div>

                      <div className="text-center mb-3">
                        <span className={`text-lg font-black font-sans ${isLegendary ? 'text-gold' : 'text-amber-400'}`}>
                          {pack.cost}
                        </span>
                        <span className="text-xs text-white/40 ml-1">🪙</span>
                      </div>

                      <button
                        onClick={() => handleBuyPack(pack)}
                        disabled={!canAfford || isBuying}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                          isLegendary
                            ? canAfford 
                              ? "bg-gold text-navy-dark hover:bg-gold/90 shadow-md active:scale-95" 
                              : "bg-gold/20 text-gold/40 cursor-not-allowed"
                            : canAfford
                              ? "bg-white/10 text-white hover:bg-white/20 active:scale-95 border border-white/10"
                              : "bg-white/5 text-white/20 cursor-not-allowed"
                        }`}
                      >
                        {isBuying ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : canAfford ? (
                          "Comprar"
                        ) : (
                          "Sin fondos"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {storeMsg && (
                <div className={`mt-4 p-3 rounded-xl text-xs font-bold text-center border ${
                  storeMsg.type === 'error' 
                    ? 'bg-red-500/10 border-red-500/20 text-red-300' 
                    : 'bg-green-500/10 border-green-500/20 text-green-300'
                }`}>
                  {storeMsg.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tu Llama & Misión ────────────────────────────────── */}
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
                   <span className="text-sm text-navy-dark/50 font-sans uppercase tracking-wider block">días</span>
                   {(myStreak?.max_streak || 0) > 0 && (
                     <span className="text-[10px] text-navy-dark/40 font-bold uppercase tracking-wider block mt-1">Récord: {myStreak?.max_streak}</span>
                   )}
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

        {/* ── Leaderboard ──────────────────────────────────────── */}
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

                      <div className={`flex items-center gap-2 ${rStyle.text} font-bold font-sans bg-white px-3 py-2 rounded-xl border ${rStyle.border} flex-shrink-0 min-w-[80px] justify-center text-center`}>
                        <div className="flex flex-col items-center leading-none">
                           <span className="text-[9px] uppercase tracking-wider opacity-60 mb-1">Récord</span>
                           <div className="flex items-center gap-1 text-xl">
                             <Flame size={18} className={idx < 3 ? "fill-current animate-pulse" : "fill-transparent"} />
                             {streak.max_streak || streak.streak_days}
                           </div>
                        </div>
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
