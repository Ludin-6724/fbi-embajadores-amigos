"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Fingerprint, Loader2 } from "lucide-react";
import Image from "next/image";

export default function Onboarding() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const checkState = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.replace("/");
      return;
    }

    // If user already has a username on their profile, they don't need onboarding
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profile?.username) {
      window.location.replace("/");
      return;
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    checkState();
  }, [checkState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) return;

    setSubmitting(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.replace("/");
      return;
    }

    const cleanUsername = trimmed.replace(/[@\s]/g, "").toLowerCase();

    // Upsert profile with username
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          username: cleanUsername,
          full_name: user.user_metadata?.full_name || "",
          avatar_url: user.user_metadata?.avatar_url || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      if (upsertError.code === "23505") {
        setError("Este nombre ya está en uso por otro agente. Elige otro.");
      } else {
        console.error("Upsert error:", upsertError);
        setError("Ocurrió un error al guardar tu identidad. Intenta de nuevo.");
      }
      setSubmitting(false);
      return;
    }

    // Hard redirect to home — forces fresh server render with session
    window.location.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="animate-spin text-gold w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center relative overflow-hidden px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 opacity-10">
        <Image
          src="/logo-fbi.jpg"
          alt="Logo FBI"
          fill
          className="object-cover mix-blend-luminosity"
        />
      </div>

      {/* Gold particle glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,160,23,0.15)_0%,transparent_70%)] z-0" />

      <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl relative z-10 w-full max-w-lg border border-gold/20">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center text-gold shadow-inner border border-light-gray">
            <Fingerprint size={32} />
          </div>
        </div>

        <h1 className="text-3xl font-serif font-bold text-center text-navy-dark mb-2">
          Tu Identidad Única
        </h1>
        <p className="text-center text-navy-dark/70 mb-8 font-sans text-sm leading-relaxed">
          Como embajador y amigo de Dios, elige tu seudónimo de agente. Este nombre será tu voz en la comunidad.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-navy-dark mb-2">
              Nombre de Agente (Username)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-dark/40 font-medium select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/[@\s]/g, ""));
                  setError(null);
                }}
                disabled={submitting}
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-light-gray focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition-all font-sans bg-white"
                placeholder="juanpablo"
                required
                minLength={3}
                maxLength={20}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 font-sans">{error}</p>
            )}
            <p className="text-navy-dark/40 text-xs mt-2 font-sans">
              Mínimo 3 caracteres. Solo letras, números y guiones bajos.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || username.replace(/[@\s]/g, "").length < 3}
            className="w-full bg-gold hover:bg-gold/90 text-white font-semibold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
          >
            {submitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Establecer Identidad →"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
