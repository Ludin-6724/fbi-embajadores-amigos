import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── PATCH /api/communities/[id] — Editar comunidad (solo owner) ──────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { name, description, is_private } = body;

  // Verificar que es el owner
  const { data: community } = await supabase
    .from("communities")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!community || community.owner_id !== user.id) {
    return NextResponse.json({ error: "Sin permisos para editar esta comunidad." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("communities")
    .update({ name, description, is_private })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ community: data });
}

// ── DELETE /api/communities/[id] — Eliminar comunidad (solo owner) ──────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verificar ownership
  const { data: community } = await supabase
    .from("communities")
    .select("owner_id, is_official")
    .eq("id", id)
    .single();

  if (!community) return NextResponse.json({ error: "Comunidad no encontrada." }, { status: 404 });
  if (community.owner_id !== user.id)
    return NextResponse.json({ error: "Solo el fundador puede disolver esta comunidad." }, { status: 403 });
  if (community.is_official)
    return NextResponse.json({ error: "Las comunidades oficiales no se pueden eliminar." }, { status: 403 });

  const { error } = await supabase.from("communities").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
