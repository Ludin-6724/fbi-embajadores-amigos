"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, CheckCircle, Loader2, Target, PenTool } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Streak = {
  streak_days: number;
  last_checkin: string | null;
  last_mission_title?: string | null;
  last_mission_note?: string | null;
  user_id: string;
  profiles: { username: string | null; full_name: string | null } | null;
};

export default function Rachas({ communityId }: { communityId?: string }) {
  const [topStreaks, setTopStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myStreak, setMyStreak] = useState<Streak | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // Form state
  const [missionNote, setMissionNote] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [communityId]);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    let query = supabase
      .from("streaks")
      .select("streak_days, last_checkin, user_id, last_mission_title, last_mission_note, profiles(username, full_name)")
      .order("streak_days", { ascending: false })
      .limit(5);
      
    if (communityId) {
      query = query.eq('community_id', communityId);
    } else {
      query = query.is('community_id', null);
    }

    const { data, error } = await query;
    let streakData = data;

    if (error) {
       console.warn("Nuevas columnas de misiones no detectadas, usando fallback:", error.message);
       let fallbackDataQuery = supabase
          .from("streaks")
          .select("streak_days, last_checkin, user_id, profiles(username, full_name)")
          .order("streak_days", { ascending: false })
          .limit(5);
       
       if (communityId) {
         fallbackDataQuery = fallbackDataQuery.eq('community_id', communityId);
       } else {
         fallbackDataQuery = fallbackDataQuery.is('community_id', null);
       }
       
       const { data: fallbackData } = await fallbackDataQuery;
       streakData = fallbackData as any;
    }

    if (streakData) {
      setTopStreaks((streakData as unknown as Streak[]) ?? []);
      
      if (user) {
        const mine = (streakData as any[]).find(s => s.user_id === user.id);
        if (mine) {
          setMyStreak(mine);
        } else {
          // Intentamos full y luego fallback para el usuario singular
          let myQuery = supabase.from("streaks").select("streak_days, last_checkin, user_id, last_mission_title, last_mission_note, profiles(username, full_name)").eq("user_id", user.id);
          if (communityId) myQuery = myQuery.eq('community_id', communityId);
          else myQuery = myQuery.is('community_id', null);
          
          const { data: myData, error: myError } = await myQuery.maybeSingle();
          
          if (myData) {
             setMyStreak(myData as unknown as Streak);
          } else {
             // Fallback just in case
             let fallbackMineQuery = supabase.from("streaks").select("streak_days, last_checkin, user_id, profiles(username, full_name)").eq("user_id", user.id);
             if (communityId) fallbackMineQuery = fallbackMineQuery.eq("community_id", communityId);
             else fallbackMineQuery = fallbackMineQuery.is("community_id", null);
             
             const { data: fallbackMine } = await fallbackMineQuery.maybeSingle();
             if (fallbackMine) setMyStreak(fallbackMine as unknown as Streak);
          }
        }
      }
    }
    setLoading(false);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || checkingIn || !missionNote.trim()) return;

    setCheckingIn(true);

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

    // Postgres 14 upsert logic can be tricky with partial unique indexes on coalesce triggers.
    // Instead of trusting "UPSERT", since we know myStreak existence, we can UPSERT based on user_id AND community_id condition
    // For supabase javascript client, `upsert` only works elegantly on Primary Key.
    // Let's do an explicit Update or Insert to avoid conflict problems:
    let reqError;
    if (myStreak) {
       // Update existing
       const req = await supabase.from("streaks").update(payload).eq("user_id", userId).is("community_id", communityId || null);
       reqError = req.error;
    } else {
       // Insert new
       const req = await supabase.from("streaks").insert(payload);
       reqError = req.error;
    }

    if (!reqError) {
       await supabase.from("posts").insert({
         author_id: userId,
         content: `🔥 Misión completada de ${newDays} ${newDays === 1 ? 'día' : 'días'} consecutivos!\n\n"${missionNote.trim()}"`,
         is_anonymous: false,
         community_id: communityId || null
       });

      await fetchData();
    } else {
       console.error("Error upserting streak:", reqError);
    }
    setCheckingIn(false);
  };

  const hasCheckedInToday = () => {
    if (!myStreak || !myStreak.last_checkin) return false;
    const last = new Date(myStreak.last_checkin);
    const today = new Date();
    return last.getDate() === today.getDate() && 
           last.getMonth() === today.getMonth() && 
           last.getFullYear() === today.getFullYear();
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
            <p className="font-sans text-lg text-navy-dark/70 leading-relaxed max-w-xl">
              Nuestra mayor fuerza es la regularidad. Registra cada día la misión específica 
              que completaste para transformar tu entorno y encender la <strong className="text-gold">F</strong>e, profundizar en la <strong className="text-gold">B</strong>iblia y reafirmar tu <strong className="text-gold">I</strong>dentidad (FBI).
            </p>
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
             </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto bg-white border border-light-gray rounded-3xl p-6 md:p-12 shadow-sm">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-light-gray">
            <h3 className="text-2xl font-serif font-semibold text-navy-dark flex items-center gap-2">
              <Trophy className="text-gold" />
              Líderes de Constancia Nacional
            </h3>
            <span className="text-sm font-sans text-navy-dark/60 font-medium bg-cream px-3 py-1 rounded-full">Top 5</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-gold w-8 h-8" />
            </div>
          ) : topStreaks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-navy-dark/50">Todavía no hay líderes registrados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topStreaks.map((streak, idx) => {
                const name = streak.profiles?.full_name || streak.profiles?.username || "Agente";
                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-cream/30 shadow-sm border border-light-gray hover:border-gold/30 transition-all group gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white border border-gold/20 flex flex-shrink-0 items-center justify-center font-serif font-bold text-navy-dark text-lg shadow-inner">
                        {idx + 1}
                      </div>
                      <div className="pr-4">
                        <h4 className="font-semibold font-sans text-navy-dark">{name}</h4>
                        {streak.last_mission_note && (
                          <p className="text-xs text-navy-dark/60 font-sans mt-1 line-clamp-2 italic">
                            "{streak.last_mission_note}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gold font-bold font-sans text-xl bg-white px-4 py-2 rounded-xl border border-gold/10 flex-shrink-0">
                      <Flame size={20} className={idx < 3 ? "fill-gold" : "fill-transparent"} />
                      {streak.streak_days}
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
