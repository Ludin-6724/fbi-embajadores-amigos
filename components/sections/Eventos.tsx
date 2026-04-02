"use client";

import { useEffect, useState } from "react";
import { MapPin, Clock, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Evento = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string;
  tag: string;
};

export default function Eventos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("events")
      .select("id, title, description, event_date, location, tag")
      .order("event_date", { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (error) console.error("Eventos fetch error:", error.message);
        else setEventos((data as Evento[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <section className="py-24 md:py-32 bg-light-gray relative" id="eventos">
      <div className="container mx-auto px-4 md:px-8">

        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-xl">
            <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-4 inline-block">
              Agenda Abierta
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-dark leading-tight">
              Próximos Encuentros
            </h2>
          </div>
          <button className="text-navy-dark font-sans font-semibold border-b-2 border-gold pb-1 hover:text-gold transition-colors whitespace-nowrap">
            Ver calendario completo →
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
              <Calendar size={28} className="text-gold/60" />
            </div>
            <h4 className="font-serif text-xl font-semibold text-navy-dark mb-2">
              Sin eventos próximos
            </h4>
            <p className="text-navy-dark/50 font-sans text-sm max-w-sm">
              No hay eventos programados por el momento. Mantente atento, pronto habrá nuevos encuentros.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventos.map((ev, idx) => {
              const evDate = new Date(ev.event_date);
              const mes = evDate.toLocaleDateString("es-ES", { month: "short" });
              const dia = evDate.toLocaleDateString("es-ES", { day: "2-digit" });
              const hora = evDate.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={ev.id}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-transparent hover:border-gold/30 hover:shadow-lg transition-all flex flex-col justify-between group h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-sans font-bold ${
                          ev.tag === "Online"
                            ? "bg-navy-dark/10 text-navy-dark"
                            : "bg-gold/10 text-gold"
                        }`}
                      >
                        {ev.tag}
                      </span>
                      <div className="w-12 h-12 rounded-full bg-cream flex flex-col items-center justify-center font-bold font-serif text-navy-dark shadow-inner">
                        <span className="text-lg leading-none">{dia}</span>
                        <span className="text-[10px] uppercase leading-none mt-1">{mes}</span>
                      </div>
                    </div>

                    <h3 className="text-2xl font-serif font-bold text-navy-dark mb-4 group-hover:text-gold transition-colors line-clamp-2">
                      {ev.title}
                    </h3>
                  </div>

                  <div className="space-y-3 font-sans text-sm text-navy-dark/70 bg-cream p-4 rounded-xl mt-6">
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-gold flex-shrink-0" />
                      <span>{hora}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-gold flex-shrink-0" />
                      <span>{ev.location}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
