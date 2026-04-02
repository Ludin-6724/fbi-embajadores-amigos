"use client";

import { useEffect, useState, useCallback, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Settings, Shield, Users, Globe, Lock, Copy, RefreshCw,
  Check, X, Loader2, Trash2, AlertTriangle, CheckCircle, XCircle, Clock
} from "lucide-react";

type Community = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_official: boolean;
  is_private: boolean;
  invite_code: string | null;
};

type JoinRequest = {
  id: string;
  user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

export default function CommunitySettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient();
  const router = useRouter();
  const resolvedParams = use(params);
  const communityId = resolvedParams.id;

  const [community, setCommunity] = useState<Community | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }
    setCurrentUserId(user.id);

    const { data: comm } = await supabase
      .from("communities")
      .select("id, name, description, owner_id, is_official, is_private, invite_code")
      .eq("id", communityId)
      .single();

    if (!comm) { router.push("/"); return; }
    if (comm.owner_id !== user.id) { router.push(`/c/${communityId}`); return; }

    setCommunity(comm);
    setEditName(comm.name);
    setEditDesc(comm.description ?? "");
    setEditPrivate(comm.is_private ?? false);

    // Load join requests
    const { data: reqs } = await supabase
      .from("community_join_requests")
      .select(`id, user_id, status, message, created_at, profiles:user_id ( username, full_name, avatar_url )`)
      .eq("community_id", communityId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    setRequests((reqs as unknown as JoinRequest[]) ?? []);
    setLoading(false);
  }, [communityId, router, supabase]);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/communities/${communityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null, is_private: editPrivate }),
    });
    const json = await res.json();
    if (res.ok) {
      setCommunity(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() || null, is_private: editPrivate } : prev);
      showToast("✅ Comunidad actualizada", "success");
    } else {
      showToast(`❌ ${json.error}`, "error");
    }
    setSaving(false);
  };

  const handleRegenerateInvite = async () => {
    setRegenerating(true);
    const res = await fetch(`/api/communities/${communityId}/invite`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setCommunity(prev => prev ? { ...prev, invite_code: json.invite_code } : prev);
      showToast("🔗 Nuevo código generado", "success");
    } else {
      showToast(`❌ ${json.error}`, "error");
    }
    setRegenerating(false);
  };

  const handleCopyLink = () => {
    if (!community?.invite_code) return;
    const link = `${window.location.origin}/join/${community.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequest = async (requestId: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/communities/${communityId}/requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, action }),
    });
    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== requestId));
      showToast(action === "approve" ? "✅ Solicitud aprobada" : "❌ Solicitud rechazada", action === "approve" ? "success" : "error");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/communities/${communityId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      const json = await res.json();
      showToast(`❌ ${json.error}`, "error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const inviteLink = (mounted && community?.invite_code)
    ? `${window.location.origin}/join/${community.invite_code}`
    : null;

  return (
    <div className="min-h-screen bg-cream">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-lg font-sans font-semibold text-sm animate-fade-in ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-500 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-navy-dark text-white">
        <div className="container mx-auto px-4 md:px-8 py-6 flex items-center gap-4">
          <Link href={`/c/${communityId}`} className="text-gold hover:text-gold/80 transition-colors">
            <ArrowLeft size={22} />
          </Link>
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-gold" />
            <h1 className="font-serif text-xl font-bold">Configuración del Grupo</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 py-10 max-w-2xl space-y-8">

        {/* ── EDITAR INFORMACIÓN ── */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-light-gray">
          <h2 className="font-serif text-xl font-bold text-navy-dark mb-6 flex items-center gap-2">
            <Shield size={18} className="text-gold" /> Información del Grupo
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-sans font-bold text-navy-dark mb-1">Nombre</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full p-3 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none font-sans text-navy-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-bold text-navy-dark mb-1">Descripción</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
                className="w-full p-3 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none font-sans text-navy-dark"
              />
            </div>

            {/* Privacidad toggle */}
            <div>
              <label className="block text-sm font-sans font-bold text-navy-dark mb-3">Privacidad</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setEditPrivate(false)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    !editPrivate ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                  }`}
                >
                  <Globe size={22} className={!editPrivate ? "text-gold" : "text-navy-dark/40"} />
                  <span className={`font-sans text-sm font-bold ${!editPrivate ? "text-gold" : "text-navy-dark/60"}`}>Público</span>
                  <span className="font-sans text-xs text-navy-dark/40 text-center">Cualquiera puede unirse directamente</span>
                </button>
                <button
                  onClick={() => setEditPrivate(true)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    editPrivate ? "border-gold bg-gold/5" : "border-light-gray hover:border-gold/30"
                  }`}
                >
                  <Lock size={22} className={editPrivate ? "text-gold" : "text-navy-dark/40"} />
                  <span className={`font-sans text-sm font-bold ${editPrivate ? "text-gold" : "text-navy-dark/60"}`}>Privado</span>
                  <span className="font-sans text-xs text-navy-dark/40 text-center">Requiere solicitud o link de invitación</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-navy-dark hover:bg-navy-dark/90 disabled:opacity-50 text-white font-sans font-semibold rounded-full transition-colors shadow-md"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Guardar cambios
              </button>
            </div>
          </div>
        </section>

        {/* ── LINK DE INVITACIÓN ── */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-light-gray">
          <h2 className="font-serif text-xl font-bold text-navy-dark mb-2 flex items-center gap-2">
            <Users size={18} className="text-gold" /> Link de Invitación
          </h2>
          <p className="font-sans text-sm text-navy-dark/60 mb-6">
            Comparte este link para que otros se unan directamente, aunque el grupo sea privado.
          </p>

          {community?.invite_code ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-cream rounded-xl border border-light-gray p-3">
                <code className="flex-1 font-mono text-sm text-navy-dark truncate">
                  {inviteLink}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-navy-dark text-white rounded-lg text-xs font-sans font-bold hover:bg-navy-dark/90 transition-colors"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
              <button
                onClick={handleRegenerateInvite}
                disabled={regenerating}
                className="flex items-center gap-2 text-sm font-sans font-semibold text-navy-dark/60 hover:text-navy-dark transition-colors"
              >
                <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} />
                Regenerar código
              </button>
            </div>
          ) : (
            <button
              onClick={handleRegenerateInvite}
              disabled={regenerating}
              className="flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold/90 disabled:opacity-50 text-white font-sans font-semibold rounded-full transition-colors shadow-md"
            >
              {regenerating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Generar link de invitación
            </button>
          )}
        </section>

        {/* ── SOLICITUDES PENDIENTES ── */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-light-gray">
          <h2 className="font-serif text-xl font-bold text-navy-dark mb-2 flex items-center gap-2">
            <Clock size={18} className="text-gold" />
            Solicitudes Pendientes
            {requests.length > 0 && (
              <span className="ml-auto bg-gold text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {requests.length}
              </span>
            )}
          </h2>
          <p className="font-sans text-sm text-navy-dark/60 mb-6">
            Personas que quieren unirse a tu grupo privado.
          </p>

          {requests.length === 0 ? (
            <div className="text-center py-8 text-navy-dark/40">
              <Clock size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-sans text-sm">No hay solicitudes pendientes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const displayName = req.profiles?.username || req.profiles?.full_name || "Agente";
                return (
                  <div key={req.id} className="flex items-center gap-3 p-4 bg-cream/50 rounded-2xl border border-light-gray">
                    <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center font-serif font-bold text-gold overflow-hidden flex-shrink-0">
                      {req.profiles?.avatar_url ? (
                        <img src={req.profiles.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        displayName[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans font-semibold text-navy-dark text-sm">{displayName}</p>
                      {req.message && <p className="font-sans text-xs text-navy-dark/60 truncate">{req.message}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRequest(req.id, "approve")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-sans font-bold transition-colors"
                      >
                        <CheckCircle size={13} /> Aprobar
                      </button>
                      <button
                        onClick={() => handleRequest(req.id, "reject")}
                        className="flex items-center gap-1 px-3 py-1.5 bg-navy-dark/10 hover:bg-red-50 hover:text-red-600 text-navy-dark/60 rounded-lg text-xs font-sans font-bold transition-colors"
                      >
                        <XCircle size={13} /> Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── ZONA PELIGROSA ── */}
        {!community?.is_official && (
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-red-100">
            <h2 className="font-serif text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} /> Zona de Peligro
            </h2>
            <p className="font-sans text-sm text-navy-dark/60 mb-6">
              Esta acción es irreversible. Se eliminarán todos los miembros, publicaciones y rachas asociadas a este grupo.
            </p>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-sans font-semibold rounded-full transition-colors"
              >
                <Trash2 size={16} /> Disolver este grupo
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
                <p className="font-sans font-semibold text-red-700 text-sm">
                  ¿Estás seguro de que quieres disolver <strong>{community?.name}</strong>? No hay vuelta atrás.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-sans font-semibold rounded-full transition-colors text-sm"
                  >
                    {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                    Sí, disolver
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-light-gray text-navy-dark font-sans font-semibold rounded-full transition-colors text-sm hover:border-navy-dark/30"
                  >
                    <X size={14} /> Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
