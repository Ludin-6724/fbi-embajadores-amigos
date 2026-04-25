"use client";

import { useState, useEffect } from "react";
import { User, PenLine, Shield, Mail, Calendar, LogOut, Check, Loader2, X, Flame, Coins, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Comunidad from "./Comunidad";

export default function ProfileSection({ profile: initialProfile }: { profile: any }) {
  const [profile, setProfile] = useState(initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [buyingProtector, setBuyingProtector] = useState(false);
  const [buyMsg, setBuyMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [myStreak, setMyStreak] = useState<{ streak_days: number; max_streak: number } | null>(null);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (initialProfile?.id) {
      const loadStreak = async () => {
        const { data } = await supabase
          .from("streaks")
          .select("streak_days, max_streak")
          .eq("user_id", initialProfile.id)
          .maybeSingle();
        if (data) {
          setMyStreak(data as any);
        }
      };
      loadStreak();
    }
  }, [initialProfile?.id, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleBuyProtector = async () => {
    if (buyingProtector || !profile?.id) return;
    setBuyingProtector(true);
    setBuyMsg(null);
    try {
      const { data, error } = await supabase.rpc('purchase_protector', { user_id: profile.id, cost: 50 });
      if (error) throw error;
      if (data) {
        setProfile((prev: any) => ({
          ...prev,
          points: (prev?.points || 0) - 50,
          streak_protectors: (prev?.streak_protectors || 0) + 1
        }));
        setBuyMsg({ text: "¡Protector comprado con éxito! 🛡️", type: "success" });
      } else {
        setBuyMsg({ text: "No tienes suficientes puntos 🪙.", type: "error" });
      }
    } catch (err: any) {
      setBuyMsg({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setBuyingProtector(false);
      setTimeout(() => setBuyMsg(null), 3000);
    }
  };

  const saveUsername = async () => {
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed === profile?.username) {
      setIsEditing(false);
      return;
    }
    
    if (trimmed.length < 3) {
      setError("Mínimo 3 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);

    // Check uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .neq("id", profile.id)
      .maybeSingle();

    if (existing) {
      setError("Ese nombre de usuario ya está en uso.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", profile.id);

    if (updateError) {
      setError(`Error: ${updateError.message}`);
    } else {
      setProfile({ ...profile, username: trimmed });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsEditing(false);
      }, 1500);
    }
    setSaving(false);
  };

  const name = profile?.full_name || profile?.username || "Agente";
  const avatarUrl = profile?.avatar_url;
  const createdAt = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-ES", {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : "Reciente";

  return (
    <section className="py-12 bg-white min-h-[80vh]">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header / Avatar */}
        <div className="flex flex-col items-center mb-10 text-center">
            <div className="relative mb-6">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gold/20 shadow-xl">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-cream flex items-center justify-center text-gold">
                            <User size={48} />
                        </div>
                    )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-gold text-white p-2 rounded-full shadow-lg border-2 border-white">
                    <Shield size={16} />
                </div>
            </div>
            
            <h2 className="text-3xl font-serif font-bold text-navy-dark mb-1">{name}</h2>
            <p className="text-gold font-sans font-bold uppercase tracking-widest text-xs">Agente Activo FBI</p>
        </div>

        {/* Info Cards */}
        <div className="space-y-4">
            {/* Username Section */}
            <div className="bg-cream/40 p-6 rounded-3xl border border-light-gray">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                            <PenLine size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-navy-dark/50 font-bold uppercase tracking-wider">Nombre de Usuario</p>
                            {!isEditing ? (
                                <p className="text-navy-dark font-sans font-semibold">@{profile?.username || "sin_nombre"}</p>
                            ) : (
                                <div className="mt-2 flex flex-col gap-2">
                                    <input 
                                        type="text" 
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        className="w-full p-2 bg-white border border-gold/30 rounded-lg outline-none focus:ring-2 focus:ring-gold/20"
                                        autoFocus
                                    />
                                    {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                                    {success && <p className="text-xs text-green-600 font-bold">¡Actualizado!</p>}
                                </div>
                            )}
                        </div>
                    </div>
                    {!isEditing ? (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-bold text-gold hover:text-gold/80 transition-colors px-4 py-2 border border-gold/20 rounded-full hover:bg-gold/5"
                        >
                            Editar
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="p-2 text-navy-dark/40 hover:text-navy-dark transition-colors">
                                <X size={20} />
                            </button>
                            <button onClick={saveUsername} disabled={saving} className="p-2 text-gold hover:text-gold/80 transition-colors">
                                {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Other details */}
            <div className="bg-cream/40 p-6 rounded-3xl border border-light-gray space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-navy-dark/5 flex items-center justify-center text-navy-dark/40">
                        <Mail size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-navy-dark/50 font-bold uppercase tracking-wider">Correo Electrónico</p>
                        <p className="text-navy-dark font-sans font-medium">{profile?.email || "No disponible"}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-navy-dark/5 flex items-center justify-center text-navy-dark/40">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-navy-dark/50 font-bold uppercase tracking-wider">Agente desde</p>
                        <p className="text-navy-dark font-sans font-medium">{createdAt}</p>
                    </div>
                </div>
            </div>

            {/* Streak card */}
            <div className="bg-cream/40 p-6 rounded-3xl border border-light-gray flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                        <Flame size={20} className="fill-gold" />
                    </div>
                    <div>
                        <p className="text-xs text-navy-dark/50 font-bold uppercase tracking-wider">Llama Actual</p>
                        <p className="text-navy-dark font-sans font-medium">{myStreak?.streak_days || 0} Días</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-navy-dark/40 font-bold uppercase tracking-wider mb-1">Récord Histórico</p>
                    <p className="text-gold font-sans font-bold text-xl">{myStreak?.max_streak || myStreak?.streak_days || 0}</p>
                </div>
            </div>

            {/* Puntos y Protectores */}
            <div className="bg-cream/40 p-6 rounded-3xl border border-light-gray flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-1 items-center gap-4 w-full justify-between sm:justify-start">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <Coins size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-navy-dark/50 font-bold uppercase tracking-wider">Mis Puntos</p>
                        <p className="text-navy-dark font-sans font-bold text-xl">{profile?.points || 0} 🪙</p>
                    </div>
                </div>
                <div className="w-px h-10 bg-light-gray hidden md:block"></div>
                <div className="flex flex-1 items-center gap-4 w-full justify-between sm:justify-start">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                        <Shield size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-navy-dark/50 font-bold uppercase tracking-wider">Protectores</p>
                        <p className="text-navy-dark font-sans font-bold text-xl">{profile?.streak_protectors || 0} 🛡️</p>
                    </div>
                </div>
            </div>

            {/* Tienda */}
            <div className="bg-gold/5 p-6 rounded-3xl border border-gold/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gold text-white flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Store size={24} />
                  </div>
                  <div>
                      <h4 className="font-serif text-lg font-bold text-navy-dark leading-tight">Tienda de Agente</h4>
                      <p className="text-xs text-navy-dark/60 font-sans mt-0.5">Canjea tus puntos por recompensas.</p>
                  </div>
              </div>
              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleBuyProtector}
                  disabled={buyingProtector || (profile?.points || 0) < 50}
                  className="w-full sm:w-auto px-6 py-2.5 bg-navy-dark text-white rounded-full font-bold text-xs uppercase tracking-wider hover:bg-gold hover:text-navy-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                >
                  {buyingProtector ? <Loader2 size={16} className="animate-spin" /> : "Comprar Protector (50🪙)"}
                </button>
                {buyMsg && (
                  <p className={`text-[10px] font-bold ${buyMsg.type === 'error' ? 'text-red-500' : 'text-green-600'} text-center w-full`}>
                    {buyMsg.text}
                  </p>
                )}
              </div>
            </div>

            {/* Logout Action */}
            <button 
                onClick={handleLogout}
                className="w-full mt-8 flex items-center justify-center gap-3 p-5 bg-red-50 hover:bg-red-100 text-red-600 rounded-3xl border border-red-100 transition-all font-sans font-bold group"
            >
                <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                Cerrar Sesión
            </button>
        </div>

        {/* Separator / Title for Muro Personal */}
        <div className="mt-16 mb-8 text-center max-w-xl mx-auto">
          <h3 className="font-serif text-3xl font-bold text-navy-dark mb-2">Tu Muro Personal</h3>
          <p className="font-sans text-sm text-navy-dark/60">Todo lo que publicas aquí se comparte también con la comunidad de embajadores.</p>
        </div>
      </div>
      
      {/* Muro Personal Component */}
      <div className="-mx-4 md:mx-0">
        <Comunidad hideTabs={true} authorId={profile?.id} initialProfile={profile} isAllowedToFetch={true} />
      </div>
    </section>
  );
}
