"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Testimonio = {
  id: string;
  name: string;
  role: string;
  story: string;
  image_url: string | null;
};

export default function Testimonios() {
  const [testimonios, setTestimonios] = useState<Testimonio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("testimonials")
      .select("id, name, role, story, image_url")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (error) console.error("Testimonios fetch error:", error.message);
        else setTestimonios((data as Testimonio[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <section className="py-24 md:py-32 bg-cream text-navy-dark relative z-10" id="testimonios">
      <div className="container mx-auto px-4 md:px-8">

        <div className="text-center max-w-3xl mx-auto mb-16">
          <MessageSquareQuote size={48} className="text-gold mx-auto mb-6 opacity-30" />
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-dark leading-tight mb-6">
            Historias Reales
          </h2>
          <p className="font-sans text-lg text-navy-dark/70 leading-relaxed max-w-2xl mx-auto">
            Vidas transformadas por la gracia de Dios, que aprendieron a apagar el ruido digital
            para encender el propósito celestial.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : testimonios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
              <MessageSquareQuote size={28} className="text-gold/60" />
            </div>
            <h4 className="font-serif text-xl font-semibold text-navy-dark mb-2">
              Aún no hay testimonios
            </h4>
            <p className="text-navy-dark/50 font-sans text-sm max-w-sm">
              Las historias de transformación llegarán. Sé el primero en compartir cómo Dios ha
              cambiado tu perspectiva digital.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonios.map((tm) => (
              <div
                key={tm.id}
                className="bg-white p-8 rounded-3xl shadow-sm border border-light-gray relative hover:-translate-y-2 transition-transform duration-300 flex flex-col justify-between"
              >
                <p className="font-sans text-navy-dark/80 leading-relaxed mb-8 italic">
                  &ldquo;{tm.story}&rdquo;
                </p>

                <div className="mt-auto border-t border-light-gray pt-6 flex items-center gap-4">
                  {tm.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tm.image_url}
                      alt={tm.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center font-bold text-white font-serif text-lg flex-shrink-0">
                      {tm.name[0]}
                    </div>
                  )}
                  <div>
                    <h4 className="font-serif font-bold text-navy-dark">{tm.name}</h4>
                    <p className="text-xs text-navy-dark/60 font-sans uppercase tracking-wider">
                      {tm.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
