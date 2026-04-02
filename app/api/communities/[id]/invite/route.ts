import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Native 8-char alphanumeric code generator
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// ── POST /api/communities/[id]/invite — Regenerar invite_code ────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verificar ownership o admin role
  const { data: community } = await supabase
    .from("communities")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!community || community.owner_id !== user.id) {
    // Check if admin member
    const { data: memberData } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", id)
      .eq("user_id", user.id)
      .single();

    if (!memberData || !["admin", "founder"].includes(memberData.role)) {
      return NextResponse.json({ error: "Sin permisos para gestionar esta comunidad." }, { status: 403 });
    }
  }

  const newCode = generateCode();

  const { data, error } = await supabase
    .from("communities")
    .update({ invite_code: newCode })
    .eq("id", id)
    .select("invite_code")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite_code: data.invite_code });
}
