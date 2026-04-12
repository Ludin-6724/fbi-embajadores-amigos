import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { endpoint, keys, userId: bodyUserId } = body;

    if (!endpoint || !keys) {
      return NextResponse.json({ error: "Invalid subscription: missing endpoint or keys" }, { status: 400 });
    }

    // Intentar obtener userId desde cookies de sesión
    let userId = bodyUserId;
    if (!userId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      } catch (_) {}
    }

    if (!userId) {
      return NextResponse.json({ error: "No se pudo identificar al usuario. Inicia sesion nuevamente." }, { status: 401 });
    }

    // Usar Service Role Key para saltarse RLS (es una acción del servidor)
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await adminSupabase
      .from("push_subscriptions")
      .upsert({
        user_id: userId,
        endpoint,
        auth_key: keys.auth,
        p256dh_key: keys.p256dh,
      }, { onConflict: "endpoint" });

    if (error) {
      console.error("[push/subscribe] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    console.error("[push/subscribe] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
