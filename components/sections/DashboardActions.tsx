"use client";

import { useState, useEffect } from "react";
import { PenSquare, UserMinus, Flame, Users, X, Loader2, Globe, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DashboardActionsProps = {
  profile: any;
  isCommunity?: boolean;
};

export default function DashboardActions({ profile, isCommunity = false }: DashboardActionsProps) {
  const [activeModal, setActiveModal] = useState<"post" | "prayer" | "community" | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [commPrivate, setCommPrivate] = useState(false);
  const supabase = createClient();

  const handleClose = () => {
    setActiveModal(null);
    setContent("");
    setSubmitting(false);
    setFormError(null);
    setCommPrivate(false);
  };

  useEffect(() => {
    const handleOpenModal = () => setActiveModal("community");
    window.addEventListener("fbi:open-community-modal", handleOpenModal);
    return () => window.removeEventListener("fbi:open-community-modal", handleOpenModal);
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
      window.location.reload();
    } else {
      console.error(error);
      setFormError(`Error al publicar: ${error.message}`);
      setSubmitting(false);
    }
  };

  const name = profile?.username || profile?.full_name || "Agente";

  return (
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
               onClick={() => setActiveModal("community")}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-light-gray hover:border-gold/30 hover:bg-gold/5 text-navy-dark font-sans font-semibold rounded-full transition-colors shadow-sm text-sm"
            >
              <Users size={18} className="text-gold" />
              Sub-Comunidad
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-navy-dark/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white w-[95%] max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gold/20 my-auto">
            <div className="flex items-center justify-between p-6 border-b border-light-gray bg-cream">
              <h3 className="font-serif text-xl font-bold text-navy-dark">
                {activeModal === "post" ? "Crear Publicación" : activeModal === "prayer" ? "Petición Anónima" : "Nueva Comunidad"}
              </h3>
              <button onClick={handleClose} className="text-navy-dark/50 hover:text-navy-dark">
                <X size={24} />
              </button>
            </div>
            
            <form 
             onSubmit={(e) => activeModal === "community" ? e.preventDefault() : handlePostSubmit(e, activeModal === "prayer")} 
             className="p-6 space-y-4"
            >
              {activeModal === "community" ? (
                <>
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
                       className="w-full min-h-[100px] p-3 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none font-sans text-navy-dark"
                     />
                   </div>
                   {/* Privacidad */}
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
                         <span className="font-sans text-[10px] text-navy-dark/40 text-center leading-tight">Cualquiera puede unirse directamente</span>
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
                         <span className="font-sans text-[10px] text-navy-dark/40 text-center leading-tight">Requiere solicitud o link de invitación</span>
                       </button>
                     </div>
                   </div>
                 </div>

                 {/* Error visible */}
                 {formError && (
                   <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-sans text-red-700">
                     ⚠️ {formError}
                   </div>
                 )}

                 <div className="flex justify-end pt-2">
                   <button 
                     type="button" 
                     onClick={async () => {
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

                       console.log("[FBI] Insertando comunidad. owner_id:", profile.id);

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

                       console.log("[FBI] Resultado:", { data, error });

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
                     }}
                     disabled={submitting}
                     className="px-6 py-3 bg-gold hover:bg-gold/90 disabled:opacity-50 text-white font-sans font-semibold rounded-full transition-all shadow-md flex items-center gap-2"
                   >
                     {submitting ? <Loader2 className="animate-spin" size={18} /> : "Fundar Comunidad"}
                   </button>
                 </div>
                </>
              ) : (
                <>
                 <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={activeModal === "post" ? "¿Qué luz vas a compartir hoy con la comunidad?" : "Escribe tu petición o testimonio de forma completamente anónima..."}
                  className="w-full min-h-[150px] p-4 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none font-sans text-navy-dark"
                  required
                 />
                 {formError && (
                   <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-sans text-red-700">
                     ⚠️ {formError}
                   </div>
                 )}
                 <div className="flex justify-end pt-4">
                   <button 
                     type="submit" 
                     disabled={submitting || !content.trim()}
                     className="px-6 py-3 bg-gold hover:bg-gold/90 disabled:opacity-50 text-white font-sans font-semibold rounded-full transition-all shadow-md flex items-center gap-2"
                   >
                     {submitting ? <Loader2 className="animate-spin" size={18} /> : "Publicar Mensaje"}
                   </button>
                 </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
