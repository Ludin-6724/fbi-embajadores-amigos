"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Menu, X, LogOut, User, PenLine, Users, ChevronRight,
  Loader2, Check, Shield, Bell
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NotificationCenter from "./NotificationCenter";
import InstallPWA from "./InstallPWA";

export default function Navbar({ 
  initialUser, 
  initialProfile 
}: { 
  initialUser?: any, 
  initialProfile?: any 
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(initialUser || null);
  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setProfile(data);
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          setProfile(data);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      window.removeEventListener("scroll", handleScroll);
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    setIsOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const openUsernameModal = () => {
    setDropdownOpen(false);
    setIsOpen(false);
    setNewUsername(profile?.username || "");
    setUsernameError(null);
    setUsernameSuccess(false);
    setUsernameModalOpen(true);
  };

  const saveUsername = async () => {
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setUsernameError("El nombre de usuario no puede estar vacío.");
      return;
    }
    if (trimmed.length < 3) {
      setUsernameError("Mínimo 3 caracteres.");
      return;
    }
    if (!/^[a-zA-Z0-9_.\-]+$/.test(trimmed)) {
      setUsernameError("Solo letras, números, guiones y puntos.");
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    // Check uniqueness (excluding self)
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      setUsernameError("Ese nombre de usuario ya está en uso.");
      setSavingUsername(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", user.id);

    if (error) {
      setUsernameError(`Error: ${error.message}`);
    } else {
      setProfile((prev: any) => ({ ...prev, username: trimmed }));
      setUsernameSuccess(true);
      router.refresh(); // REFRESCAR SERVIDOR
      setTimeout(() => {
        setUsernameModalOpen(false);
        setUsernameSuccess(false);
      }, 1200);
    }
    setSavingUsername(false);
  };

  const scrollToCommunities = () => {
    setDropdownOpen(false);
    setIsOpen(false);
    const el = document.getElementById("comunidades");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const displayName = profile?.username || user?.user_metadata?.full_name || "Agente";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  const navLinks = [
    { name: "La Misión", href: "#mision" },
    { name: "Comunidad", href: "#comunidad" },
    { name: "Rachas", href: "#rachas" },
  ];

  /* ── Dropdown menu items ── */
  const menuItems = [
    {
      icon: <PenLine size={15} className="text-gold" />,
      label: "Cambiar nombre",
      sublabel: profile?.username ? `@${profile.username}` : "Sin username",
      action: openUsernameModal,
    },
    {
      icon: <User size={15} className="text-gold" />,
      label: "Mi Perfil",
      sublabel: "Ver tu información",
      action: () => {
        setDropdownOpen(false);
        setIsOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    },
    {
      icon: <Users size={15} className="text-gold" />,
      label: "Mis Comunidades",
      sublabel: "Grupos y células",
      action: scrollToCommunities,
    },
  ];

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "bg-white/80 backdrop-blur-md border-b border-light-gray shadow-sm py-3"
            : "bg-transparent py-5"
        )}
      >
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 z-50">
            <img
              src="/logo-fbi.jpg"
              alt="Logo Congreso FBI"
              className="h-10 w-auto object-contain mix-blend-multiply"
            />
            <img
              src="/logo-amigos.jpg"
              alt="Logo Amigos"
              className="h-10 w-auto object-contain border-l border-gold/30 pl-3 mix-blend-multiply"
            />
          </Link>

          {/* ── Desktop Nav ── */}
          <div className="hidden md:flex items-center space-x-8">
            {user && navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-navy-dark/80 hover:text-gold transition-colors"
              >
                {link.name}
              </Link>
            ))}

            {user ? (
              <div className="flex items-center gap-2">
                <NotificationCenter />
                
                <div className="relative" ref={dropdownRef}>
                  {/* Avatar trigger */}
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-3 cursor-pointer group ml-2"
                  >
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-navy-dark leading-none group-hover:text-gold transition-colors">
                      {displayName}
                    </span>
                    <span className="text-xs text-navy-dark/60">Agente Activo</span>
                  </div>
                  <div className={cn(
                    "w-10 h-10 rounded-full overflow-hidden border-2 shadow-sm transition-all",
                    dropdownOpen ? "border-gold ring-2 ring-gold/20" : "border-gold/60 group-hover:border-gold"
                  )}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-cream flex items-center justify-center text-gold">
                        <User size={20} />
                      </div>
                    )}
                  </div>
                </button>

                {/* ── Dropdown ── */}
                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-3 w-[calc(100vw-2rem)] md:w-72 bg-white border border-light-gray rounded-2xl shadow-2xl overflow-hidden"
                    style={{ animation: "dropdownIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}
                  >
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 border-b border-light-gray bg-cream/50">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold/30 flex-shrink-0">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-cream flex items-center justify-center text-gold">
                              <User size={22} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-serif font-bold text-navy-dark text-sm truncate">
                            {user?.user_metadata?.full_name || displayName}
                          </p>
                          {profile?.username && (
                            <p className="font-sans text-xs text-navy-dark/50 truncate">
                              @{profile.username}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Shield size={10} className="text-gold" />
                            <span className="font-sans text-[10px] font-bold text-gold uppercase tracking-wider">
                              Agente Activo
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-2">
                      {menuItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={item.action}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-cream/70 transition-colors group/item"
                        >
                          <div className="w-8 h-8 rounded-xl bg-gold/8 flex items-center justify-center flex-shrink-0 group-hover/item:bg-gold/15 transition-colors">
                            {item.icon}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-sans text-sm font-semibold text-navy-dark group-hover/item:text-gold transition-colors">
                              {item.label}
                            </p>
                            <p className="font-sans text-[11px] text-navy-dark/45 truncate">
                              {item.sublabel}
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-navy-dark/20 group-hover/item:text-gold/60 transition-colors flex-shrink-0" />
                        </button>
                      ))}
                      <InstallPWA />
                    </div>

                    {/* Logout */}
                    <div className="border-t border-light-gray py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50/60 transition-colors group/logout"
                      >
                        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 group-hover/logout:bg-red-100 transition-colors">
                          <LogOut size={15} className="text-red-500" />
                        </div>
                        <p className="font-sans text-sm font-semibold text-red-500 group-hover/logout:text-red-600 transition-colors">
                          Cerrar sesión
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
              <button
                onClick={handleLogin}
                className="bg-gold hover:bg-gold/90 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <User size={16} /> Iniciar Sesión
              </button>
            )}
          </div>

          {/* ── Mobile Notifications ── */}
          <div className="md:hidden flex items-center gap-3 z-50">
            {user && <NotificationCenter />}
          </div>

          {/* ── Mobile Menu ── */}
          {isOpen && (
            <div className="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center space-y-6 animate-fade-in md:hidden px-8">
              {/* Mobile profile header */}
              {user && (
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold shadow-md">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-cream flex items-center justify-center text-gold">
                        <User size={28} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-serif font-bold text-navy-dark">{displayName}</p>
                    <p className="text-xs text-navy-dark/50 font-sans">Agente Activo</p>
                  </div>
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-xl font-serif font-medium text-navy-dark hover:text-gold transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}

              {user ? (
                <div className="flex flex-col items-center gap-3 mt-6 w-full max-w-xs">
                  <button
                    onClick={openUsernameModal}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-cream border border-light-gray rounded-full font-sans font-semibold text-navy-dark text-sm hover:border-gold/30 transition-colors"
                  >
                    <PenLine size={16} className="text-gold" /> Cambiar nombre
                  </button>
                  <InstallPWA />
                  <button
                    onClick={scrollToCommunities}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-cream border border-light-gray rounded-full font-sans font-semibold text-navy-dark text-sm hover:border-gold/30 transition-colors"
                  >
                    <Users size={16} className="text-gold" /> Mis Comunidades
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-50 border border-red-100 rounded-full font-sans font-semibold text-red-600 text-sm hover:bg-red-100 transition-colors"
                  >
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setIsOpen(false); handleLogin(); }}
                  className="mt-4 bg-gold hover:bg-gold/90 text-white px-8 py-3 rounded-full text-base font-semibold shadow-md flex items-center gap-2"
                >
                  <User size={18} /> Iniciar Sesión
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── Username Edit Modal ── */}
      {usernameModalOpen && (
        <div className="fixed inset-0 bg-navy-dark/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gold/20"
            style={{ animation: "dropdownIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-light-gray bg-cream">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
                  <PenLine size={18} className="text-gold" />
                </div>
                <h3 className="font-serif text-lg font-bold text-navy-dark">
                  Cambiar nombre de usuario
                </h3>
              </div>
              <button
                onClick={() => setUsernameModalOpen(false)}
                className="text-navy-dark/40 hover:text-navy-dark transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Current */}
              <div className="flex items-center gap-3 p-3 bg-cream/60 rounded-2xl border border-light-gray">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gold/20 flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-cream flex items-center justify-center text-gold"><User size={18} /></div>
                  )}
                </div>
                <div>
                  <p className="font-sans text-xs text-navy-dark/50 font-semibold">Nombre actual</p>
                  <p className="font-sans text-sm font-bold text-navy-dark">
                    {profile?.username || "Sin username"}
                  </p>
                </div>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-sans font-bold text-navy-dark mb-2">
                  Nuevo nombre de usuario
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ej: juan_misionero"
                  maxLength={30}
                  className="w-full p-3.5 bg-cream/50 rounded-xl border border-light-gray focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none font-sans text-navy-dark placeholder:text-navy-dark/30"
                  onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }}
                  autoFocus
                />
                <p className="font-sans text-[11px] text-navy-dark/40 mt-1.5">
                  Solo letras, números, guiones y puntos. Mínimo 3 caracteres.
                </p>
              </div>

              {/* Error / Success messages */}
              {usernameError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-sans text-red-600 font-semibold">
                  {usernameError}
                </div>
              )}
              {usernameSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm font-sans text-green-600 font-semibold flex items-center gap-2">
                  <Check size={16} /> Nombre actualizado correctamente
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setUsernameModalOpen(false)}
                  className="px-5 py-2.5 font-sans font-semibold text-sm text-navy-dark/60 hover:text-navy-dark rounded-full transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveUsername}
                  disabled={savingUsername || usernameSuccess}
                  className="flex items-center gap-2 px-6 py-2.5 bg-navy-dark hover:bg-navy-dark/90 disabled:opacity-50 text-white font-sans font-semibold text-sm rounded-full transition-all shadow-md"
                >
                  {savingUsername ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : usernameSuccess ? (
                    <Check size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  {usernameSuccess ? "Listo" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown animation keyframes */}
      <style jsx>{`
        @keyframes dropdownIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
