"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink, Trash2, Loader2, MessageSquare, Heart, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { Flame, Smartphone } from "lucide-react";

type Notification = {
  id: string;
  type: 'reaction' | 'comment' | 'community_approved' | 'cheer';
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  actor_id?: string;
};

export default function NotificationCenter({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(true); // true = ocultar botón por defecto
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  function navigateToLink(link: string | null) {
    if (!link) return;
    if (link.startsWith("#")) {
      const id = link.substring(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        window.location.href = "/" + link;
      }
    } else {
      window.location.href = link;
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Tu navegador no soporta notificaciones de fondo.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Necesitas permitir las notificaciones para recibir alertas fuera de la app.');
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Falta la llave VAPID pública. Avisa al administrador.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // Obtener el userId actual para enviarlo junto con la suscripción
      const { data: { user } } = await supabase.auth.getUser();

      // Convertir la suscripción a JSON y agregar el userId
      const subJson = subscription.toJSON();
      const payload = { ...subJson, userId: user?.id };

      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error desconocido al guardar suscripción");

      setIsSubscribed(true);
      alert('✅ ¡Notificaciones activadas! Ya recibirás alertas en tu dispositivo.');
    } catch (e: any) {
      console.error(e);
      alert("Error activando notificaciones: " + e.message);
    }
  };

  // Verificar si este dispositivo ya tiene una suscripción activa en la BD
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          setIsSubscribed(true); // Ocultar botón si no es compatible
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (!existingSub) {
          setIsSubscribed(false); // No hay suscripción en el browser → mostrar botón
          return;
        }
        // Verificar si está guardada en la BD
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsSubscribed(false); return; }
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('endpoint', existingSub.endpoint)
          .single();
        setIsSubscribed(!!data); // Si no está en BD, mostrar botón
      } catch {
        setIsSubscribed(false);
      }
    };
    void checkSubscription();
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let swHandler: ((event: MessageEvent) => void) | null = null;

    const run = async () => {
      try {
        const currentUserId = userId || (await supabase.auth.getUser()).data?.user?.id;

        if (!currentUserId || !mounted) {
          setNotifications([]);
          setUnreadCount(0);
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!mounted) return;

        if (error) {
          console.warn("notifications fetch:", error.message);
          setNotifications([]);
          setUnreadCount(0);
        } else {
          const list = (data ?? []) as Notification[];
          setNotifications(list);
          setUnreadCount(list.filter((n) => !n.is_read).length);
        }

        if (!mounted) return;

        channel = supabase
          .channel(`notifs_${currentUserId.substring(0, 8)}_${Math.random().toString(36).substring(7)}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${currentUserId}` },
            (payload: { new: Record<string, unknown> }) => {
              if (!mounted) return;
              const newNotif = payload.new as Notification;
              setNotifications((prev) => [newNotif, ...prev]);
              setUnreadCount((prev) => prev + 1);

              if (newNotif.type === "cheer") {
                confetti({
                  particleCount: 150,
                  spread: 80,
                  origin: { y: 0.6 },
                  colors: ["#D4A017", "#FF4500", "#FFA500", "#101726"],
                });
              }

              if (typeof window !== "undefined" && window.Notification?.permission === "granted") {
                const sysNotif = new window.Notification("FBI Amigos", {
                  body: newNotif.message,
                  icon: "/logo-fbi.jpg",
                  badge: "/logo-fbi.jpg",
                  tag: newNotif.id,
                });
                sysNotif.onclick = () => {
                  window.focus();
                  sysNotif.close();
                  navigateToLink(newNotif.link);
                };
              }
            }
          )
          .subscribe();

        if ("serviceWorker" in navigator) {
          swHandler = (event: MessageEvent) => {
            if (event.data?.type === "NAVIGATE_TO" && mounted) {
              navigateToLink(event.data.link as string | null);
            }
          };
          navigator.serviceWorker.addEventListener("message", swHandler);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      if (swHandler && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", swHandler);
      }
    };
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'reaction': return <Heart size={14} className="text-pink-500" />;
      case 'comment': return <MessageSquare size={14} className="text-gold" />;
      case 'community_approved': return <ShieldCheck size={14} className="text-green-500" />;
      case 'cheer': return <Flame size={14} className="text-orange-500 fill-orange-500/20" />;
      default: return <Bell size={14} className="text-navy-dark/40" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-cream transition-colors text-navy-dark/60 hover:text-gold"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-x-3 top-20 md:absolute md:inset-x-auto md:top-auto md:right-0 md:mt-3 md:w-80 bg-white border border-light-gray rounded-2xl shadow-2xl overflow-hidden z-[200]"
          style={{ animation: 'dropdownIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards' }}
        >
          <div className="px-5 py-4 border-b border-light-gray flex items-center justify-between bg-cream/30">
            <h3 className="font-serif font-bold text-navy-dark">Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] font-sans font-bold text-gold hover:text-gold/80 transition-colors uppercase tracking-wider"
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[350px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-gold/40" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 bg-cream rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell size={20} className="text-gold/40" />
                </div>
                <p className="text-sm font-sans text-navy-dark/40">No tienes notificaciones aún.</p>
              </div>
            ) : (
              <div className="divide-y divide-light-gray/50">
                {notifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id);
                      setIsOpen(false);
                      navigateToLink(n.link);
                    }}
                    className={cn(
                      "px-5 py-4 cursor-pointer hover:bg-cream/40 transition-colors relative flex gap-3",
                      !n.is_read && "bg-gold/5"
                    )}
                  >
                    {!n.is_read && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-gold rounded-full" />}
                    <div className="w-8 h-8 rounded-xl bg-white border border-light-gray flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-[13px] font-sans leading-relaxed text-navy-dark/80",
                        !n.is_read && "font-semibold text-navy-dark"
                      )}>
                        {n.message}
                      </p>
                      <p className="text-[10px] text-navy-dark/30 mt-1 font-sans">
                        {new Date(n.created_at).toLocaleDateString("es-ES", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-light-gray bg-cream/10 text-center flex flex-col items-center gap-2">
             {!isSubscribed && (
                <button 
                  onClick={handleSubscribePush}
                  className="w-full bg-navy-dark text-white rounded-xl py-2 px-3 text-[11px] font-bold font-sans flex items-center justify-center gap-2 hover:bg-gold transition-colors"
                >
                  <Smartphone size={14} /> Activar Notificaciones Push
                </button>
             )}
             <span className="text-[11px] font-sans text-navy-dark/40">Agente @FBI</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
