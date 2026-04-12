import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verificamos si es un INSERT en la tabla de notifications
    if (body.type !== "INSERT" || body.table !== "notifications") {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const { user_id, message, link, type } = body.record;

    // Inicializar VAPID dentro del handler (evita error de build si las keys no están al compilar)
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublic || !vapidPrivate) {
      console.error("VAPID keys not configured");
      return NextResponse.json({ error: "VAPID keys missing" }, { status: 500 });
    }

    try {
      webpush.setVapidDetails("mailto:soporte@fbiembajadores.com", vapidPublic, vapidPrivate);
    } catch (vapidErr: any) {
      console.error("VAPID setup error:", vapidErr.message);
      return NextResponse.json({ error: "VAPID key inválida: " + vapidErr.message }, { status: 500 });
    }

    // Usamos la Service Role Key para evadir las directivas de seguridad RLS de la BD 
    // al ser llamado en el bg (sin usuario)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Obtener los dispositivos del usuario destino
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (error || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, warning: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title: type === 'cheer' ? '¡Recibiste Ánimos! 🔥' : 'Nueva Notificación',
      body: message,
      link: link
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth_key, p256dh: sub.p256dh_key }
        };
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // El usuario ha quitado permisos o desinstalado; lo borramos
          console.log('Subscription expired. Deleting from DB');
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push Error:", err);
        }
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Webhook Push Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
