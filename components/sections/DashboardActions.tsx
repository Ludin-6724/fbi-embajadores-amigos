"use client";

import { useState, useEffect } from "react";
import { PenSquare, UserMinus, Flame, Users, X, Loader2, Globe, Lock, Target, CheckCircle, PenTool, Rocket, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DashboardActionsProps = {
  profile: any;
  isCommunity?: boolean;
  hideVisuals?: boolean;
};

export default function DashboardActions({ profile, isCommunity = false, hideVisuals = false }: DashboardActionsProps) {
  const [activeModal, setActiveModal] = useState<"post" | "prayer" | "community" | "selector" | "streak" | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [commPrivate, setCommPrivate] = useState(false);
  
  // Streak state
  const [myStreak, setMyStreak] = useState<any>(null);
  const [loadingStreak, setLoadingStreak] = useState(false);

  const supabase = createClient();

  const handleClose = () => {
    setActiveModal(null);
    setContent("");
    setSubmitting(false);
    setFormError(null);
    setCommPrivate(false);
  };

  useEffect(() => {
    const handleOpenCommunity = () => setActiveModal("community");
    const handleOpenPost = () => setActiveModal("post");
    const handleOpenPrayer = () => setActiveModal("prayer");
    const handleOpenSelector = () => setActiveModal("selector");

    window.addEventListener("fbi:open-community-modal", handleOpenCommunity);
    window.addEventListener("fbi:open-post-modal", handleOpenPost);
    window.addEventListener("fbi:open-prayer-modal", handleOpenPrayer);
    window.addEventListener("fbi:open-publish-selector", handleOpenSelector);

    return () => {
      window.removeEventListener("fbi:open-community-modal", handleOpenCommunity);
      window.removeEventListener("fbi:open-post-modal", handleOpenPost);
      window.removeEventListener("fbi:open-prayer-modal", handleOpenPrayer);
      window.removeEventListener("fbi:open-publish-selector", handleOpenSelector);
    };
  }, []);

  useEffect(() => {
    if (activeModal === "streak") {
        fetchMyStreak();
    }
  }, [activeModal]);

  const fetchMyStreak = async () => {
    if (!profile?.id) return;
    setLoadingStreak(true);
    const { data } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", profile.id)
        .is("community_id", null)
        .maybeSingle();
    setMyStreak(data);
    setLoadingStreak(false);
  };

  const handlePostSubmit = async (e: React.FormEvent, isAnonymous: boolean) => {
    e.preventDefault();
    if (!content.trim() || !profile) return;
    setSubmitting(true);
    
    const { error } = await supabase.from("posts").insert({
      author_id: profile.id,
      content: content.trim(),
      is_anonymous: isAnonymous
    });

    if (!error) {
      handleClose();
      window.dispatchEvent(new CustomEvent("fbi:refresh-feed")); 
      window.location.reload(); 
    } else {
      console.error(error);
      setFormError(`Error al publicar: ${error.message}`);
      setSubmitting(false);
    }
  };

  const handleStreakSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile?.id || submitting) return;
    setSubmitting(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let newDays = 1;

    if (myStreak && myStreak.last_checkin) {
      const last = new Date(myStreak.last_checkin);
      last.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - last.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) newDays = myStreak.streak_days;
      else if (diffDays === 1) newDays = myStreak.streak_days + 1;
      else newDays = 1;
    }

    const payload = {
      user_id: profile.id,
      streak_days: newDays,
      last_checkin: new Date().toISOString(),
      last_mission_title: "Misión Completada",
      last_mission_note: content.trim(),
      community_id: null
    };

    const { error: streakError } = await (myStreak 
      ? supabase.from("streaks").update(payload).eq("id", myStreak.id)
      : supabase.from("streaks").insert(payload));

    if (!streakError) {
      await supabase.from("posts").insert({
        author_id: profile.id,
        content: `🔥 Misión completada - Día ${newDays}!\n\n"${content.trim()}"`,
        is_anonymous: false
      });
      handleClose();
      window.location.reload();
    } else {
      setFormError(`Error al guardar racha: ${streakError.message}`);
      setSubmitting(false);
    }
  };

  const handleCommunitySubmit = async () => {
    const nameInput = document.querySelector('input[name="commName"]') as HTMLInputElement;
    const descInput = document.querySelector('textarea[name="commDesc"]') as HTMLTextAreaElement;

    if (!nameInput?.value.trim()) {
      setFormError("El nombre de la comunidad es obligatorio.");
      return;
    }
    if (!profile?.id) {
      setFormError("No hay sesión activa. Recarga la página e intenta de nuevo.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const { data, error } = await supabase
      .from('communities')
      .insert({
        name: nameInput.value.trim(),
        description: descInput?.value.trim() || null,
        owner_id: profile.id,
        is_private: commPrivate
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from('community_members').insert({
        community_id: data.id,
        user_id: profile.id,
        role: 'founder'
      });
      handleClose();
      window.location.reload();
    } else {
      setFormError(`Error: ${error?.message ?? "desconocido. Verifica permisos en Supabase."}`);
      setSubmitting(false);
    }
  };

  const name = profile?.username || profile?.full_name || "Agente";

  return (
    <>
      {!hideVisuals && (
        <section className="bg-white py-12 border-b border-light-gray relative z-20">
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-cream p-6 rounded-3xl border border-light-gray shadow-sm mb-8 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center font-serif font-bold text-2xl text-gold overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    name[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-sans text-sm text-navy-dark/60 font-semibold uppercase tracking-wider">
                    Panel de Control
                  </p>
                  <h2 className="font-serif text-2xl font-bold text-navy-dark">
                    Bienvenido, {name}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => setActiveModal("post")}
                  className="flex items-center gap-2 px-5 py-3 bg-navy-dark hover:bg-navy-dark/90 text-white font-sans font-semibold rounded-full transition-colors text-sm"
                >
                  <PenSquare size={18} />
                  Nueva Publicación
                </button>
                <button 
                  onClick={() => setActiveModal("prayer")}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-light-gray hover:border-gold/30 hover:bg-gold/5 text-navy-dark font-sans font-semibold rounded-full transition-colors shadow-sm text-sm"
                >
                  <UserMinus size={18} className="text-gold" />
                  Oración Anónima
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById("rachas");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-light-gray hover:border-gold/30 hover:bg-gold/5 text-navy-dark font-sans font-semibold rounded-full transition-colors shadow-sm text-sm"
                >
                  <Flame size={18} className="text-gold" />
                  Rachas
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById("comunidades");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-light-gray hover:border-gold/30 hover:bg-gold/5 text-navy-dark font-sans font-semibold rounded-full transition-colors shadow-sm text-sm"
                >
                  <Users size={18} className="text-gold" />
                  Sub-Comunidades
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeModal && (
        <div 
          className="fixed inset-0 bg-navy-dark/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center animate-fade-in" 
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-white w-full h-[95dvh] sm:h-auto sm:w-[95%] sm:max-w-lg sm:rounded-3xl shadow-2xl border border-gold/20 sm:max-h-[90vh] flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-light-gray bg-cream rounded-t-3xl flex-shrink-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-navy-dark">
                {activeModal === "selector" ? "Selecciona una Acción" : 
                 activeModal === "post" ? "Crear Publicación" : 
                 activeModal === "prayer" ? "Petición Anónima" : 
                 activeModal === "streak" ? "Registrar Misión Diaria" :
                 "Nueva Comunidad"}
              </h3>
              <button onClick={handleClose} className="text-navy-dark/50 hover:text-navy-dark p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-5 sm:p-6 pb-40 sm:pb-10 space-y-4 overflow-y-auto flex-1">
              {activeModal === "selector" ? (
                <div className="grid grid-cols-1 gap-4 py-4">
                  <button 
                    onClick={() => setActiveModal("post")}
                    className="flex items-center gap-4 p-5 bg-gold/5 border border-gold/20 rounded-3xl hover:bg-gold/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gold/20 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                      <PenSquare size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-navy-dark text-lg">Publicar en el Muro</h4>
                      <p className="font-sans text-xs text-navy-dark/60 italic">Comparte tu luz con la comunidad</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setActiveModal("prayer")}
                    className="flex items-center gap-4 p-5 bg-navy-dark/5 border border-navy-dark/10 rounded-3xl hover:bg-navy-dark/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-navy-dark/10 flex items-center justify-center text-navy-dark group-hover:scale-110 transition-transform">
                      <UserMinus size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-navy-dark text-lg">Petición Anónima</h4>
                      <p className="font-sans text-xs text-navy-dark/60 italic">Oración confidencial para el oratorio</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setActiveModal("streak")}
                    className="flex items-center gap-4 p-5 bg-orange-500/5 border border-orange-500/10 rounded-3xl hover:bg-orange-500/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                      <Flame size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-navy-dark text-lg">Reportar Misión FBI</h4>
                      <p className="font-sans text-xs text-navy-dark/60 italic">Sube tu racha diaria de constancia</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setActiveModal("community")}
                    className="flex items-center gap-4 p-5 bg-navy-dark/5 border border-navy-dark/10 rounded-3xl hover:bg-navy-dark/10 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-navy-dark/10 flex items-center justify-center text-navy-dark group-hover:scale-110 transition-transform">
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-navy-dark text-lg">Fundar Comunidad</h4>
                      <p className="font-sans text-xs text-navy-dark/60 italic">Crea un nuevo grupo o ministerio</p>
                    </div>
                  </button>
                </div>
              ) : activeModal === "community" ? (
                <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-sans font-bold text-navy-dark mb-1">Nombre de la Comunidad</label>
                     <input
                       type="text"
                       name="commName"
                       placeholder="Ej: Ministerio Jóvenes Luz"
                       className="w-full p-3 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none font-sans text-navy-dark"
                       required
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-sans font-bold text-navy-dark mb-1">Descripción</label>
                     <textarea
                       name="commDesc"
                       placeholder="¿Cuál es la misión específica de este grupo?"
                       className="w-full min-h-[80px] p-3 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none font-sans text-navy-dark"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-sans font-bold text-navy-dark mb-2">Privacidad del grupo</label>
                     <div className="grid grid-cols-2 gap-3">
                       <button
                         type="button"
                         onClick={() => setCommPrivate(false)}
                         className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                           !commPrivate ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                         }`}
                       >
                         <Globe size={20} className={!commPrivate ? "text-gold" : "text-navy-dark/40"} />
                         <span className={`font-sans text-xs font-bold ${!commPrivate ? "text-gold" : "text-navy-dark/60"}`}>Público</span>
                         <span className="font-sans text-[10px] text-navy-dark/40 text-center leading-tight">Cualquiera puede unirse</span>
                       </button>
                       <button
                         type="button"
                         onClick={() => setCommPrivate(true)}
                         className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                           commPrivate ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                         }`}
                       >
                         <Lock size={20} className={commPrivate ? "text-gold" : "text-navy-dark/40"} />
                         <span className={`font-sans text-xs font-bold ${commPrivate ? "text-gold" : "text-navy-dark/60"}`}>Privado</span>
                         <span className="font-sans text-[10px] text-navy-dark/40 text-center leading-tight">Requiere invitación</span>
                       </button>
                     </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                 {activeModal === "streak" && (
                    <div className="bg-orange-500/5 p-4 rounded-2xl border border-orange-500/10 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <Flame className="text-orange-600 fill-orange-600/20" size={24} />
                            <span className="font-serif font-bold text-navy-dark">Tu Racha Actual</span>
                        </div>
                        <span className="text-2xl font-black text-orange-600">{myStreak?.streak_days || 0}</span>
                    </div>
                 )}
                 <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    activeModal === "post" ? "¿Qué luz vas a compartir hoy con la comunidad?" : 
                    activeModal === "prayer" ? "Escribe tu petición o testimonio de forma completamente anónima..." :
                    "Reporta tu misión completada. Ej: 'Hoy recordé mi identidad en Cristo y oré 15min'."
                  }
                  className="w-full min-h-[180px] p-4 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none font-sans text-navy-dark"
                  required
                 />
                 {formError && (
                   <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-sans text-red-700">
                     ⚠️ {formError}
                   </div>
                 )}
                </div>
              )}
            </div>

            {activeModal !== "selector" && (
              <div className="p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,24px))] sm:pb-6 border-t border-light-gray bg-white flex justify-end flex-shrink-0 sm:rounded-b-3xl">
                <button 
                  onClick={(e) => activeModal === "community" ? handleCommunitySubmit() : (activeModal === "streak" ? handleStreakSubmit(e as any) : handlePostSubmit(e as any, activeModal === "prayer"))}
                  disabled={activeModal !== "community" && (submitting || !content.trim())}
                  className={`px-8 py-4 w-full sm:w-auto ${activeModal === "streak" ? "bg-orange-600" : "bg-gold"} hover:opacity-90 disabled:opacity-50 text-white font-sans font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2`}
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : 
                   activeModal === "community" ? "Fundar Comunidad" :
                   activeModal === "streak" ? "Registrar y Publicar Racha" : "Publicar Mensaje"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
