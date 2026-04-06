"use client";

import Comunidad from "@/components/sections/Comunidad";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

export default function PostClient({ 
  postId, 
  initialUser,
  initialProfile 
}: { 
  postId: string, 
  initialUser: any,
  initialProfile: any
}) {
  if (!initialUser) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-16 md:py-24 px-6 text-center bg-white rounded-[2.5rem] border border-gold/20 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gold/20 via-gold to-gold/20" />
        
        <div className="w-28 h-28 bg-gold/5 rounded-full flex items-center justify-center mb-10 border border-gold/15 shadow-inner group transition-transform hover:scale-105 duration-500">
          <img src="/logo-fbi.jpg" alt="FBI" className="w-16 h-16 object-contain mix-blend-multiply opacity-90 transition-opacity group-hover:opacity-100" />
        </div>
        
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-navy-dark/[0.03] rounded-full text-[11px] font-bold uppercase tracking-[0.2em] text-gold mb-6 border border-gold/10 shadow-sm">
          <Lock size={12} className="text-gold/70" /> Acceso Reservado
        </div>

        <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy-dark mb-5 tracking-tight">Comunidad Exclusiva</h2>
        
        <p className="font-sans text-navy-dark/60 max-w-sm mb-12 leading-relaxed text-sm md:text-base font-medium">
          Esta publicación es privada para los **Agentes de FBI Embajadores**. 
          Inicia sesión para leer la reflexión completa, interactuar y participar en la red.
        </p>
        
        <button
          onClick={() => {
              const supabase = createClient();
              supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/auth/callback?next=/post/${postId}` },
              });
          }}
          className="w-full max-w-xs px-8 py-5 bg-navy-dark text-white font-sans font-bold rounded-full shadow-[0_20px_50px_rgba(10,17,40,0.3)] hover:bg-navy-dark/95 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 active:scale-95 mb-10"
        >
          <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 brightness-0 invert" />
          Ingresar para ver Post
        </button>
        
        <Link 
          href="/" 
          className="text-navy-dark/40 hover:text-gold font-sans text-xs font-bold transition-all flex items-center gap-2 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" /> 
          Volver a la Red Pública
        </Link>
        
        <div className="mt-20 p-8 bg-cream/30 rounded-3xl border border-gold/5 max-w-md w-full relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 py-1 rounded-full border border-gold/10 text-[9px] font-bold uppercase tracking-widest text-gold/60">Agentes FBI</div>
          <p className="text-xs text-navy-dark/50 font-sans italic leading-relaxed text-center">
            "Confesaos vuestras ofensas unos a otros, y orad unos por otros, para que seáis sanados. La oración eficaz del justo puede mucho." 
          </p>
          <p className="mt-4 font-bold text-gold tracking-[0.25em] uppercase text-[9px] text-center">Santiago 5:16</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="mb-10 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2.5 text-navy-dark/40 hover:text-gold font-sans font-bold text-sm transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-navy-dark/5 flex items-center justify-center group-hover:bg-gold/10 transition-colors">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          </div>
           Volver al Muro General
        </Link>
        
        <span className="text-[10px] font-bold uppercase tracking-widest text-navy-dark/20 bg-navy-dark/5 px-3 py-1 rounded-full">
          Vista Individual
        </span>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Comunidad 
          postId={postId} 
          hideTabs={true} 
          initialProfile={initialProfile} 
          isAllowedToFetch={true}
        />
      </div>
    </div>
  );
}
