"use client";

import { useState, useEffect } from "react";
import { Bell, X, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function GlobalPushPrompt() {
  const [show, setShow] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    const checkSubscription = async () => {
      try {
        const isDismissed = localStorage.getItem("fbi_push_dismissed");
        if (isDismissed) return;

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        
        // Wait a few seconds so we don't bombard immediately
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        if (!mounted) return;

        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        
        if (!existingSub) {
          setShow(true);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('endpoint', existingSub.endpoint)
          .single();

        if (!data) setShow(true);
      } catch (e) {
        console.error("Error checking push status on load:", e);
      }
    };
    
    void checkSubscription();
    return () => { mounted = false; };
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("fbi_push_dismissed", "true");
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Necesitas permitir las notificaciones en tu sistema para poder recibirlas.');
        setIsSubscribing(false);
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Falta la llave pública VAPID.");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...subscription.toJSON(), userId: user?.id };

      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Error guardando suscripción.");

      setShow(false);
      alert('✅ ¡Notificaciones activadas con éxito!');
    } catch (e: any) {
      console.error(e);
      alert("No se pudo activar: " + e.message);
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-navy-dark/70 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.4)] relative overflow-hidden animate-slide-up-modal">
         <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold to-yellow-500" />
         
         <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-cream/50 flex items-center justify-center border border-gold/20 shadow-inner mb-6 relative">
               <div className="absolute inset-2 bg-gold/10 rounded-full animate-ping opacity-75" />
               <Bell size={36} className="text-gold relative z-10" />
            </div>

            <h3 className="font-serif text-2xl font-bold text-navy-dark mb-3">¡No te pierdas nada!</h3>
            <p className="font-sans text-sm text-navy-dark/60 leading-relaxed mb-8 px-2">
              Activa las notificaciones para enterarte al instante de nuevas misiones, respuestas de agentes y actualizaciones de rachas.
            </p>

            <button 
               onClick={handleSubscribe}
               disabled={isSubscribing}
               className="w-full bg-navy-dark text-white font-sans font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all mb-4 disabled:opacity-70"
            >
               {isSubscribing ? (
                 <span className="flex items-center gap-2">Activando...</span>
               ) : (
                 <>
                   <Smartphone size={20} className="text-gold" />
                   Activar Notificaciones
                 </>
               )}
            </button>

            <button 
               onClick={handleDismiss}
               className="text-xs font-sans font-medium text-navy-dark/40 hover:text-navy-dark transition-colors px-4 py-2"
            >
               Quizá más tarde
            </button>
         </div>
      </div>
      <style jsx>{`
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up-modal { animation: slide-up-modal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slide-up-modal { from { transform: translateY(40px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
