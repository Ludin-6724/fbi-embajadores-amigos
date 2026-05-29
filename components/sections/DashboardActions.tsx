"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PenSquare, UserMinus, Flame, Users, X, Loader2, Globe, Lock, Fingerprint, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DashboardActionsProps = {
  profile: any;
  isCommunity?: boolean;
  hideVisuals?: boolean;
};

type PrayerVisibility = "public" | "anonymous" | "private";

export default function DashboardActions({ profile, isCommunity = false, hideVisuals = false }: DashboardActionsProps) {
  const [activeModal, setActiveModal] = useState<"post" | "prayer" | "community" | "selector" | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [commPrivate, setCommPrivate] = useState(false);
  const [prayerVisibility, setPrayerVisibility] = useState<PrayerVisibility>("anonymous");

  const supabase = createClient();
  const router = useRouter();

  const handleClose = () => {
    setActiveModal(null);
    setContent("");
    setSubmitting(false);
    setFormError(null);
    setCommPrivate(false);
    setPrayerVisibility("anonymous");
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
      router.refresh(); 
    } else {
      console.error(error);
      setFormError(`Error al publicar: ${error.message}`);
      setSubmitting(false);
    }
  };

  const handlePrayerSubmit = async () => {
    if (!content.trim() || !profile) return;
    setSubmitting(true);

    const authorName = profile.full_name || profile.username || "Agente";
    const meta = {
      text: content.trim(),
      author_name: authorName,
      is_anonymous: prayerVisibility === "anonymous",
      is_private: prayerVisibility === "private",
    };

    const postContent = `🙏 [PRAYER_REQUEST]:${JSON.stringify(meta)}`;

    const { error } = await supabase.from("posts").insert({
      author_id: profile.id,
      content: postContent,
      is_anonymous: prayerVisibility === "anonymous",
    });

    if (!error) {
      handleClose();
      window.dispatchEvent(new CustomEvent("fbi:refresh-feed"));
      router.refresh();
    } else {
      console.error(error);
      setFormError(`Error al publicar petición: ${error.message}`);
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
      router.refresh();
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
                  <Heart size={18} className="text-gold" />
                  Petición de Oración
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
          className="fixed inset-0 bg-navy-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in p-4" 
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-white w-full h-auto sm:w-[95%] sm:max-w-lg rounded-3xl shadow-2xl border border-gold/20 max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-light-gray bg-cream rounded-t-3xl flex-shrink-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-navy-dark">
                {activeModal === "selector" ? "Selecciona una Acción" : 
                 activeModal === "post" ? "Crear Publicación" : 
                 activeModal === "prayer" ? "Petición de Oración" : 
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
                      <Heart size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-navy-dark text-lg">Petición de Oración</h4>
                      <p className="font-sans text-xs text-navy-dark/60 italic">Comparte tu petición y recibe oración de la comunidad</p>
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
              ) : activeModal === "prayer" ? (
                <div className="space-y-5">
                  {/* Visibility selector */}
                  <div>
                    <label className="block text-sm font-sans font-bold text-navy-dark mb-3">¿Cómo quieres publicar tu petición?</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPrayerVisibility("public")}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                          prayerVisibility === "public" ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                        }`}
                      >
                        <Globe size={18} className={prayerVisibility === "public" ? "text-gold" : "text-navy-dark/40"} />
                        <span className={`font-sans text-[11px] font-bold ${prayerVisibility === "public" ? "text-gold" : "text-navy-dark/60"}`}>Público</span>
                        <span className="font-sans text-[9px] text-navy-dark/40 text-center leading-tight">Con tu nombre</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrayerVisibility("anonymous")}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                          prayerVisibility === "anonymous" ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                        }`}
                      >
                        <Fingerprint size={18} className={prayerVisibility === "anonymous" ? "text-gold" : "text-navy-dark/40"} />
                        <span className={`font-sans text-[11px] font-bold ${prayerVisibility === "anonymous" ? "text-gold" : "text-navy-dark/60"}`}>Anónimo</span>
                        <span className="font-sans text-[9px] text-navy-dark/40 text-center leading-tight">Sin tu nombre</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrayerVisibility("private")}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                          prayerVisibility === "private" ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                        }`}
                      >
                        <Lock size={18} className={prayerVisibility === "private" ? "text-gold" : "text-navy-dark/40"} />
                        <span className={`font-sans text-[11px] font-bold ${prayerVisibility === "private" ? "text-gold" : "text-navy-dark/60"}`}>Privado</span>
                        <span className="font-sans text-[9px] text-navy-dark/40 text-center leading-tight">Solo para ti</span>
                      </button>
                    </div>
                  </div>

                  {/* Prayer text */}
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      prayerVisibility === "private"
                        ? "Escribe tu petición personal. Solo tú la verás..."
                        : prayerVisibility === "anonymous"
                        ? "Escribe tu petición. Se publicará sin tu nombre..."
                        : "Escribe tu petición. Se publicará con tu nombre..."
                    }
                    className="w-full min-h-[140px] p-4 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none font-sans text-navy-dark"
                    required
                  />

                  {/* Info text */}
                  <p className="text-[11px] text-navy-dark/40 font-sans italic text-center leading-relaxed">
                    {prayerVisibility === "private"
                      ? "Esta petición solo la verás tú en tu sección personal de oración."
                      : prayerVisibility === "anonymous"
                      ? "Tu petición aparecerá en la comunidad sin tu nombre. Otros podrán orar por ti."
                      : "Tu petición aparecerá en la comunidad con tu nombre. Otros podrán orar por ti."
                    }
                  </p>

                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-sans text-red-700">
                      ⚠️ {formError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                 <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    activeModal === "post" ? "¿Qué tienes para compartir hoy agente?" : 
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
                  onClick={(e) => {
                    if (activeModal === "community") handleCommunitySubmit();
                    else if (activeModal === "prayer") handlePrayerSubmit();
                    else handlePostSubmit(e as any, false);
                  }}
                  disabled={activeModal !== "community" && (submitting || !content.trim())}
                  className="px-8 py-4 w-full sm:w-auto bg-gold hover:opacity-90 disabled:opacity-50 text-white font-sans font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : 
                   activeModal === "community" ? "Fundar Comunidad" : 
                   activeModal === "prayer" ? "Enviar Petición 🙏" :
                   "Publicar Mensaje"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
