import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── GET /api/communities/[id]/requests — Listar solicitudes (owner/admin) ───
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("community_join_requests")
    .select(`
      id, status, message, created_at,
      user_id,
      profiles:user_id ( username, full_name, avatar_url )
    `)
    .eq("community_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

// ── POST /api/communities/[id]/requests — Enviar solicitud ────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = body?.message ?? null;

  const { error } = await supabase
    .from("community_join_requests")
    .insert({ community_id: id, user_id: user.id, message });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya enviaste una solicitud a este grupo." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ── PATCH /api/communities/[id]/requests — Aprobar o rechazar solicitud ──────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Only owner can approve/reject
  const { data: community } = await supabase
    .from("communities")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!community || community.owner_id !== user.id) {
    return NextResponse.json({ error: "Sin permisos." }, { status: 403 });
  }

  const { request_id, action } = await req.json(); // action: 'approve' | 'reject'

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  // Update request status
  const { data: requestData, error: updateError } = await supabase
    .from("community_join_requests")
    .update({ status: newStatus, reviewed_at: new Date().toISOString() })
    .eq("id", request_id)
    .eq("community_id", id)
    .select("user_id")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // If approved, add to community_members
  if (action === "approve" && requestData) {
    const { error: insertError } = await supabase
      .from("community_members")
      .insert({
        community_id: id,
        user_id: requestData.user_id,
        role: "member"
      });

    // Ignore duplicate (already member)
    if (insertError && insertError.code !== "23505") {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
