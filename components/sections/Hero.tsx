"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MoveRight, ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
const HeroCanvas = dynamic(() => import("@/components/three/HeroCanvas"), { ssr: false });
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createClient } from "@/lib/supabase/client";

gsap.registerPlugin(ScrollTrigger);

export default function Hero({ profile, community }: { profile?: any, community?: any }) {
  const textRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(
        textRef.current.children,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          stagger: 0.2,
          ease: "power3.out",
          delay: 0.2,
        }
      );

      gsap.to(textRef.current, {
        scrollTrigger: {
          trigger: textRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
        y: 100,
        opacity: 0,
      });
    }
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const scrollToComunidad = () => {
    const el = document.getElementById("comunidad");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className={`relative flex items-center justify-center overflow-hidden bg-white ${profile ? 'min-h-[40vh] pt-24 pb-12' : 'min-h-screen pt-28 md:pt-0'}`} id="mision">
      {/* 3D Background layer */}
      <HeroCanvas />

      {/* Radial soft gradient glow to blend with white theme */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,rgba(255,255,255,1)_80%)] z-[1]" />

      <div className="container relative z-10 px-4 md:px-8 mx-auto text-center">
        <div ref={textRef} className="max-w-4xl mx-auto flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="text-gold font-sans font-bold tracking-[0.2em] text-sm uppercase mb-6 inline-block bg-gold/10 px-4 py-2 rounded-full backdrop-blur-sm"
          >
            {community ? "Sede Especializada FBI" : profile ? "Panel de Organización" : "Congreso FBI · Taller"}
          </motion.span>
          
          <h1 className={`${profile ? 'text-4xl md:text-5xl lg:text-6xl mb-4' : 'text-5xl md:text-7xl lg:text-8xl mb-8'} font-serif font-bold text-navy-dark leading-tight`}>
            {community ? (
              <>
                Sede {community.name} <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-600 drop-shadow-sm text-3xl md:text-4xl block mt-2">
                  Agente @{profile?.username || "Luz"}
                </span>
              </>
            ) : profile ? (
              <>
                Misión Activa, <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-600 drop-shadow-sm">
                  Agente @{profile.username || "Luz"}
                </span>
              </>
            ) : (
              <>
                Del Algoritmo al <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-600 drop-shadow-sm">
                  Agente Espiritual
                </span>
              </>
            )}
          </h1>

          {!profile && (
            <p className="text-lg md:text-2xl text-navy-dark/70 font-sans max-w-2xl mx-auto mb-12 leading-relaxed">
              Deja de ser arrastrado. Conviértete en un embajador y amigo de Dios que decide su propia misión en el mundo digital y físico.
            </p>
          )}

          {!profile && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={handleLogin}
                className="w-full sm:w-auto px-8 py-4 bg-gold hover:bg-gold/90 text-white font-sans font-semibold rounded-full shadow-[0_0_20px_rgba(212,160,23,0.3)] transition-all flex items-center justify-center gap-3 text-lg group"
              >
                Comenzar Misión
                <MoveRight className="group-hover:translate-x-1 transition-transform" />
              </button>

            </div>
          )}
        </div>
      </div>
    </section>
  );
}
