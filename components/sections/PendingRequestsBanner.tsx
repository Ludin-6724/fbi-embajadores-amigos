"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

type JoinRequest = {
  id: string;
  user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
};

export default function PendingRequestsBanner({
  communityId,
  initialCount,
}: {
  communityId: string;
  initialCount: number;
}) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [count, setCount] = useState(initialCount);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const supabase = createClient();

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_join_requests")
      .select(`id, user_id, status, message, created_at, profiles:user_id ( username, full_name, avatar_url )`)
      .eq("community_id", communityId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const reqs = (data as unknown as JoinRequest[]) ?? [];
    setRequests(reqs);
    setCount(reqs.length);
    setLoading(false);
  }, [communityId]);

  useEffect(() => {
    if (expanded && requests.length === 0) {
      loadRequests();
    }
  }, [expanded]);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingId(requestId);
    const res = await fetch(`/api/communities/${communityId}/requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, action }),
    });

    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setCount(prev => Math.max(0, prev - 1));
    }
    setProcessingId(null);
  };

  if (count === 0) return null;

  return (
    <div className="bg-gold/5 border-y border-gold/20">
      <div className="container mx-auto px-4 md:px-8">
        {/* Collapsed banner */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-gold" />
            </div>
            <p className="font-sans font-semibold text-navy-dark text-sm">
              <span className="text-gold font-bold">{count}</span>{" "}
              {count === 1 ? "solicitud pendiente" : "solicitudes pendientes"} de acceso
            </p>
          </div>
          <div className="flex items-center gap-2 text-navy-dark/50">
            <span className="text-xs font-sans font-semibold hidden sm:inline">
              {expanded ? "Ocultar" : "Ver solicitudes"}
            </span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {/* Expanded list */}
        {expanded && (
          <div className="pb-6 space-y-3 animate-fade-in">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-gold" size={24} />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-center text-sm text-navy-dark/50 font-sans py-4">
                No hay solicitudes pendientes.
              </p>
            ) : (
              requests.map(req => {
                const name = req.profiles?.username || req.profiles?.full_name || "Agente";
                const isProcessing = processingId === req.id;

                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-light-gray shadow-sm"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center font-serif font-bold text-gold overflow-hidden flex-shrink-0">
                      {req.profiles?.avatar_url ? (
                        <img src={req.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        name[0]?.toUpperCase()
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-sans font-semibold text-navy-dark text-sm truncate">{name}</p>
                      <p className="font-sans text-[11px] text-navy-dark/40">
                        {new Date(req.created_at).toLocaleDateString("es-ES", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAction(req.id, "approve")}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-xs font-sans font-bold transition-colors"
                      >
                        {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={13} />}
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleAction(req.id, "reject")}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-3 py-1.5 bg-navy-dark/10 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 text-navy-dark/60 rounded-lg text-xs font-sans font-bold transition-colors"
                      >
                        <XCircle size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
