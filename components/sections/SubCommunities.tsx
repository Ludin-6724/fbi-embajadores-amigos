"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Shield, PlusCircle, ArrowRight, Globe, Lock,
  MoreVertical, Settings, Trash2, Loader2, Clock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Community = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_official: boolean;
  is_private: boolean;
  invite_code: string | null;
  member_count?: number;
};

type MembershipEntry = {
  community_id: string;
  role: string;
};

type PendingRequest = { community_id: string };

export default function SubCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myMemberships, setMyMemberships] = useState<MembershipEntry[]>([]);
  const [myPending, setMyPending] = useState<PendingRequest[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const supabase = createClient();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data: comms } = await supabase
      .from("communities")
      .select("id, name, description, owner_id, is_official, is_private, invite_code")
      .order("is_official", { ascending: false })
      .order("created_at", { ascending: false });

    setCommunities((comms as Community[]) ?? []);

    if (user?.id) {
      const { data: memberships } = await supabase
        .from("community_members")
        .select("community_id, role")
        .eq("user_id", user.id);
      setMyMemberships((memberships as MembershipEntry[]) ?? []);

      const { data: pending } = await supabase
        .from("community_join_requests")
        .select("community_id")
        .eq("user_id", user.id)
        .eq("status", "pending");
      setMyPending((pending as PendingRequest[]) ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Close menu on outside click
  useEffect(() => {
    const handler = () => setOpenMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const isMember = (commId: string) => myMemberships.some(m => m.community_id === commId);
  const isOwnerOrAdmin = (comm: Community) =>
    comm.owner_id === currentUserId ||
    myMemberships.some(m => m.community_id === comm.id && ["admin", "founder"].includes(m.role));
  const hasPendingRequest = (commId: string) => myPending.some(p => p.community_id === commId);

  const joinPublic = async (commId: string) => {
    if (!currentUserId) return;
    setJoiningId(commId);
    const { error } = await supabase.from("community_members").insert({
      community_id: commId,
      user_id: currentUserId,
      role: "member",
    });
    if (!error) {
      showToast("¡Te uniste exitosamente! 🎉");
      fetchAll();
    }
    setJoiningId(null);
  };

  const requestJoin = async (commId: string) => {
    if (!currentUserId) return;
    setRequestingId(commId);
    const res = await fetch(`/api/communities/${commId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (res.ok) {
      showToast("✉️ Solicitud enviada. El admin la revisará.");
      fetchAll();
    } else {
      showToast(`❌ ${json.error}`);
    }
    setRequestingId(null);
  };

  const deleteCommunity = async (commId: string) => {
    if (!confirm("¿Seguro que quieres disolver este grupo? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/communities/${commId}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Grupo disuelto.");
      fetchAll();
    } else {
      const json = await res.json();
      showToast(`❌ ${json.error}`);
    }
  };

  return (
    <section className="py-16 md:py-32 bg-light-gray/50 relative" id="comunidades">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-lg font-sans font-semibold text-sm bg-navy-dark text-white animate-fade-in">
          {toast}
        </div>
      )}

      <div className="container mx-auto px-4 md:px-8">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="max-w-xl">
            <span className="text-sm font-sans font-bold text-gold uppercase tracking-wider mb-4 inline-flex items-center gap-2">
              <Users size={16} /> Sub-Comunidades
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-dark leading-tight">
              Grupos de Misión
            </h2>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("fbi:open-community-modal"));
            }}
            className="text-navy-dark font-sans font-semibold border-b-2 border-gold pb-1 hover:text-gold transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <PlusCircle size={18} /> Fundar una comunidad
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : communities.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-sm border border-light-gray max-w-3xl mx-auto">
            <Users size={48} className="text-gold mx-auto mb-6 opacity-40" />
            <h3 className="font-serif text-2xl font-bold text-navy-dark mb-3">No hay grupos locales aún</h3>
            <p className="font-sans text-navy-dark/60 leading-relaxed mb-8 max-w-md mx-auto">
              Todos pertenecen a la red FBI Oficial, pero puedes formar sub-grupos,
              células o ministerios independientes para organizar misiones más específicas.
            </p>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("fbi:open-community-modal"));
              }}
              className="bg-navy-dark text-white px-6 py-3 rounded-full font-bold font-sans hover:bg-navy-dark/90 transition-colors shadow-lg"
            >
              Ser el primero en crear
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities.map((comm) => {
              const member = isMember(comm.id);
              const adminAccess = isOwnerOrAdmin(comm);
              const pending = hasPendingRequest(comm.id);
              const isOwner = comm.owner_id === currentUserId;

              return (
                <div
                  key={comm.id}
                  className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-light-gray hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  {/* Top badges row */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {comm.is_official && (
                      <span className="bg-gold/10 text-gold px-3 py-1 rounded-full text-xs font-bold font-sans flex items-center gap-1">
                        <Shield size={11} /> Oficial
                      </span>
                    )}
                    {comm.is_private ? (
                      <span className="bg-navy-dark/8 text-navy-dark/60 px-3 py-1 rounded-full text-xs font-bold font-sans flex items-center gap-1">
                        <Lock size={11} /> Privado
                      </span>
                    ) : (
                      <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold font-sans flex items-center gap-1">
                        <Globe size={11} /> Público
                      </span>
                    )}

                    {/* Admin 3-dot menu */}
                    {adminAccess && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === comm.id ? null : comm.id);
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-light-gray transition-colors text-navy-dark/50"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenu === comm.id && (
                          <div className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-xl border border-light-gray min-w-[160px] py-2 animate-fade-in">
                            <Link
                              href={`/c/${comm.id}/settings`}
                              onClick={() => setOpenMenu(null)}
                              className="flex items-center gap-2 px-4 py-2.5 text-sm font-sans font-semibold text-navy-dark hover:bg-cream transition-colors"
                            >
                              <Settings size={14} className="text-gold" /> Configurar
                            </Link>
                            {isOwner && !comm.is_official && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenu(null);
                                  deleteCommunity(comm.id);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-sans font-semibold text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={14} /> Disolver grupo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Community name & description */}
                  <h3 className="font-serif text-2xl font-bold text-navy-dark mb-3 mt-6 group-hover:text-gold transition-colors">
                    {comm.name}
                  </h3>
                  <p className="font-sans text-navy-dark/70 text-sm leading-relaxed mb-8 line-clamp-3">
                    {comm.description || "Un grupo de creyentes en misión activa para transformar el ambiente digital."}
                  </p>

                  {/* Footer row */}
                  <div className="mt-auto border-t border-light-gray pt-6 flex items-center justify-between gap-2">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-cream border-2 border-white" />
                      <div className="w-8 h-8 rounded-full bg-gold/20 border-2 border-white" />
                      <div className="w-8 h-8 rounded-full bg-navy-dark border-2 border-white flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold">+</span>
                      </div>
                    </div>

                    {/* Action button based on state */}
                    {member ? (
                      <Link
                        href={`/c/${comm.id}`}
                        className="flex items-center gap-1.5 text-sm font-sans font-bold text-navy-dark group-hover:text-gold transition-colors"
                      >
                        Entrar a la Sede <ArrowRight size={15} />
                      </Link>
                    ) : pending ? (
                      <span className="flex items-center gap-1.5 text-xs font-sans font-semibold text-navy-dark/50">
                        <Clock size={13} /> Solicitud enviada
                      </span>
                    ) : comm.is_private ? (
                      <button
                        disabled={requestingId === comm.id}
                        onClick={() => requestJoin(comm.id)}
                        className="flex items-center gap-1.5 text-xs font-sans font-bold px-4 py-2 bg-navy-dark/8 hover:bg-navy-dark hover:text-white text-navy-dark rounded-full transition-all disabled:opacity-50"
                      >
                        {requestingId === comm.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Lock size={13} />
                        )}
                        Solicitar acceso
                      </button>
                    ) : (
                      <button
                        disabled={joiningId === comm.id}
                        onClick={() => joinPublic(comm.id)}
                        className="flex items-center gap-1.5 text-xs font-sans font-bold px-4 py-2 bg-gold hover:bg-gold/90 text-white rounded-full transition-all disabled:opacity-50 shadow-md"
                      >
                        {joiningId === comm.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <PlusCircle size={13} />
                        )}
                        Unirse
                      </button>
                    )}
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
