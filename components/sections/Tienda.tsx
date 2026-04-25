"use client";

import { useState, useEffect } from "react";
import { Store, Shield, Loader2, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import confetti from "canvas-confetti";

const PROTECTOR_PACKS = [
  { days: 1, cost: 50,  label: "Escudo Básico",   emoji: "🛡️", desc: "Cubre 1 día de ausencia" },
  { days: 2, cost: 120, label: "Escudo Doble",     emoji: "⚔️", desc: "Cubre 2 días consecutivos" },
  { days: 3, cost: 500, label: "Escudo Legendario", emoji: "🏰", desc: "Cubre 3 días — Máxima seguridad" },
];

export default function Tienda({ profile, isAllowedToFetch = true }: { profile?: any, isAllowedToFetch?: boolean }) {
  const [userId] = useState<string | null>(profile?.id || null);
  const [myPoints, setMyPoints] = useState(profile?.points || 0);
  const [myProtectors, setMyProtectors] = useState(profile?.streak_protectors || 0);
  const [buyingPack, setBuyingPack] = useState<number | null>(null);
  const [storeMsg, setStoreMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const supabase = createClient();

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
    if (storeMsg) {
      const timer = setTimeout(() => setStoreMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [storeMsg]);

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
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#1E293B', '#F3F4F6']
        });
      } else {
        setStoreMsg({ text: "No tienes suficientes puntos 🪙.", type: "error" });
      }
    } catch (err: any) {
      setStoreMsg({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setBuyingPack(null);
    }
  };

  if (!userId) {
    return (
      <section className="py-20 md:py-32 bg-cream/30 min-h-[80vh] flex items-center justify-center">
        <p className="text-navy-dark/60 font-sans">Inicia sesión para acceder a la Tienda de Agente.</p>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-cream/20 min-h-[80vh]" id="tienda">
      <div className="container mx-auto px-4 max-w-4xl">
        
        {/* Encabezado */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-navy-dark text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-navy-dark/10">
            <Store size={32} />
          </div>
          <h2 className="text-4xl font-serif font-bold text-navy-dark mb-4">La Tienda</h2>
          <p className="font-sans text-navy-dark/70 max-w-lg mx-auto">
            Utiliza tus puntos de misión diarios para adquirir escudos. Las rachas perdidas duele verlas caer.
          </p>
        </div>

        {/* Resumen Puntos */}
        <div className="bg-white rounded-3xl border border-light-gray p-6 mb-12 shadow-sm flex items-center justify-around">
          <div className="text-center">
             <span className="text-xs font-bold text-navy-dark/40 uppercase tracking-widest mb-1 block">Tus Puntos</span>
             <span className="text-3xl font-black text-navy-dark font-sans">{myPoints} 🪙</span>
          </div>
          <div className="w-px h-12 bg-light-gray"></div>
          <div className="text-center">
             <span className="text-xs font-bold text-navy-dark/40 uppercase tracking-widest mb-1 block">Tus Escudos</span>
             <span className="text-3xl font-black text-navy-dark font-sans">{myProtectors} 🛡️</span>
          </div>
        </div>

        {/* Grid de Productos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PROTECTOR_PACKS.map((pack) => {
            const canAfford = myPoints >= pack.cost;
            const isBuying = buyingPack === pack.days;
            const isLegendary = pack.days === 3;
            
            return (
              <div
                key={pack.days}
                className={`flex flex-col bg-white rounded-3xl p-6 border transition-all relative overflow-hidden ${
                  isLegendary 
                    ? "border-navy-dark shadow-[0_8px_30px_rgba(30,41,59,0.12)] ring-1 ring-navy-dark" 
                    : "border-light-gray hover:border-navy-dark/30 hover:shadow-md"
                }`}
              >
                {isLegendary && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-navy-dark text-white px-3 py-1 rounded-full shadow-sm">
                      Recomendado
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6 mt-4">
                  <span className="text-5xl block mb-4 drop-shadow-sm">{pack.emoji}</span>
                  <h4 className="font-serif font-bold text-xl text-navy-dark mb-2">
                    {pack.label}
                  </h4>
                  <p className="text-sm text-navy-dark/60 font-sans max-w-[180px] mx-auto min-h-[40px]">
                    {pack.desc}
                  </p>
                </div>

                <div className="text-center mb-8 mt-auto">
                  <div className="inline-flex items-end justify-center bg-cream/50 px-6 py-3 rounded-2xl border border-light-gray">
                    <span className="text-3xl font-black font-sans text-navy-dark leading-none">
                      {pack.cost}
                    </span>
                    <span className="text-base text-navy-dark/50 ml-2 font-bold mb-0.5">puntos</span>
                  </div>
                </div>

                <button
                  onClick={() => handleBuyPack(pack)}
                  disabled={!canAfford || isBuying}
                  className={`w-full py-4 rounded-full font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    isLegendary
                      ? canAfford 
                        ? "bg-navy-dark text-white hover:bg-gold hover:text-navy-dark shadow-xl hover:shadow-gold/20 active:scale-95" 
                        : "bg-navy-dark/10 text-navy-dark/40 cursor-not-allowed border border-navy-dark/10"
                      : canAfford
                        ? "bg-cream text-navy-dark hover:bg-navy-dark/5 hover:border-navy-dark/20 border border-light-gray shadow-sm active:scale-95"
                        : "bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100"
                  }`}
                >
                  {isBuying ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : canAfford ? (
                    "Adquirir Seguro"
                  ) : (
                    "Insuficiente"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Mensaje de Compra */}
        <div className="h-12 flex items-center justify-center mt-6">
          {storeMsg && (
            <div className={`px-6 py-3 rounded-full text-sm font-sans font-bold shadow-sm animate-fade-in flex items-center gap-2 ${
              storeMsg.type === 'error' 
                ? 'bg-red-50 text-red-600 border border-red-100' 
                : 'bg-green-50 text-green-700 border border-green-100'
            }`}>
              {storeMsg.type === 'error' ? '❌ ' : '✅ '}
              {storeMsg.text}
            </div>
          )}
        </div>

        {/* Nota Informativa */}
        <div className="mt-12 bg-cream/40 rounded-3xl p-6 border border-light-gray/50 flex flex-col md:flex-row items-center gap-6">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-navy-dark/40 shadow-sm">
                <Info size={24} />
            </div>
            <div>
                <h5 className="font-serif font-bold text-navy-dark text-lg mb-1">Activación Automática</h5>
                <p className="font-sans text-sm text-navy-dark/70 leading-relaxed">
                    No necesitas pulsar ningún botón para usar los escudos. Si finaliza tu día y olvidas registrar tu misión, 
                    el sistema detectará tu escudos en el inventario y **los consumirá automáticamente para salvar tu Llama** de volver a cero.
                </p>
            </div>
        </div>

      </div>
    </section>
  );
}
