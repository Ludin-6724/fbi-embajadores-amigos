"use client";

import { useState } from "react";
import { LayoutGrid, Target, BarChart3, Calendar, Sparkles, ArrowRight, ChevronLeft } from "lucide-react";
import HabitsSection from "./HabitsSection";

type MenuView = "hub" | "habits";

const MENU_ITEMS = [
  {
    id: "habits" as const,
    icon: Target,
    emoji: "🎯",
    label: "Hábitos Personales",
    desc: "Crea y rastrea tus hábitos diarios. Gana puntos y mantén tus rachas.",
    gradient: "from-gold/20 to-amber-500/10",
    border: "border-gold/30",
    iconBg: "bg-gold/15",
    iconColor: "text-gold",
  },
  {
    id: "stats" as const,
    icon: BarChart3,
    emoji: "📊",
    label: "Estadísticas",
    desc: "Próximamente: analiza tu rendimiento y constancia a lo largo del tiempo.",
    gradient: "from-indigo-500/10 to-purple-500/10",
    border: "border-indigo-300/30",
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    disabled: true,
  },
  {
    id: "events" as const,
    icon: Calendar,
    emoji: "📅",
    label: "Eventos",
    desc: "Próximamente: calendario de eventos de la comunidad FBI.",
    gradient: "from-emerald-500/10 to-teal-500/10",
    border: "border-emerald-300/30",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    disabled: true,
  },
];

export default function MenuSection({
  profile,
  isAllowedToFetch = true,
}: {
  profile?: any;
  isAllowedToFetch?: boolean;
}) {
  const [view, setView] = useState<MenuView>("hub");

  if (view === "habits") {
    return (
      <div className="min-h-[80vh]">
        {/* Back button */}
        <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md border-b border-light-gray/50">
          <div className="container mx-auto px-4 max-w-4xl">
            <button
              onClick={() => setView("hub")}
              className="flex items-center gap-2 py-3 text-sm font-sans font-bold text-navy-dark/60 hover:text-gold transition-colors group"
            >
              <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              Volver al Menú
            </button>
          </div>
        </div>
        <HabitsSection profile={profile} isAllowedToFetch={isAllowedToFetch} />
      </div>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-cream/20 min-h-[80vh]" id="menu">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-navy-dark text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-navy-dark/10">
            <LayoutGrid size={32} />
          </div>
          <h2 className="text-4xl font-serif font-bold text-navy-dark mb-4">Menú</h2>
          <p className="font-sans text-navy-dark/70 max-w-lg mx-auto">
            Accede a todas las herramientas para tu crecimiento personal como Agente FBI.
          </p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isDisabled = "disabled" in item && item.disabled;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isDisabled && item.id === "habits") setView("habits");
                }}
                disabled={isDisabled}
                className={`group relative flex flex-col p-6 rounded-3xl border transition-all text-left overflow-hidden ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed border-light-gray bg-cream/30"
                    : `${item.border} bg-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer`
                }`}
              >
                {/* Gradient backdrop */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

                <div className="relative z-10">
                  {/* Icon + Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${item.iconBg} ${item.iconColor} rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 duration-300`}>
                      <Icon size={24} />
                    </div>
                    {isDisabled ? (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-navy-dark/10 text-navy-dark/40 px-3 py-1 rounded-full">
                        Próximamente
                      </span>
                    ) : (
                      <ArrowRight
                        size={18}
                        className="text-navy-dark/20 group-hover:text-gold group-hover:translate-x-1 transition-all"
                      />
                    )}
                  </div>

                  {/* Text */}
                  <h3 className="font-serif font-bold text-lg text-navy-dark mb-2 flex items-center gap-2">
                    <span>{item.emoji}</span>
                    {item.label}
                  </h3>
                  <p className="text-sm font-sans text-navy-dark/60 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                {/* Active indicator for habits */}
                {!isDisabled && (
                  <div className="mt-4 pt-4 border-t border-light-gray/50 relative z-10">
                    <div className="flex items-center gap-2 text-gold">
                      <Sparkles size={14} className="animate-pulse" />
                      <span className="text-xs font-bold font-sans uppercase tracking-wider">
                        +5 puntos por hábito completado
                      </span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Info card */}
        <div className="mt-10 bg-gold/5 rounded-3xl p-6 border border-gold/15 text-center">
          <p className="font-sans text-sm text-navy-dark/70 leading-relaxed">
            <span className="font-bold text-gold">💡 Tip:</span> Los puntos que ganes completando hábitos
            se suman a tu balance general. Úsalos en la{" "}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("fbi:change-tab", { detail: "shop" }))}
              className="text-gold font-bold hover:underline"
            >
              Tienda
            </button>{" "}
            para comprar protectores de racha.
          </p>
        </div>
      </div>
    </section>
  );
}
