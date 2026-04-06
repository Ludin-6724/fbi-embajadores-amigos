"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export type ReactionType = "like" | "heart" | "haha" | "amen" | "pray";

interface ReactionPickerProps {
  onSelect: (reaction: ReactionType) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like",  emoji: "👍", label: "Me gusta" },
  { type: "heart", emoji: "❤️", label: "Me encanta" },
  { type: "haha",  emoji: "😂", label: "Me divierte" },
  { type: "amen",  emoji: "🙏", label: "Amén" },
  { type: "pray",  emoji: "🙌", label: "Oración" },
];

export default function ReactionPicker({ onSelect, children, className, disabled }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [isOpen]);

  const openMenu = useCallback(() => {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Position above the element, centered
    const menuWidth = 280; // ~5 buttons × 52px + padding
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    // Clamp so it doesn't go off-screen
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    const top = rect.top - 72; // 64px menu height + 8px gap
    setMenuPos({ top, left });
    setIsOpen(true);
    if (window.navigator.vibrate) window.navigator.vibrate(15);
  }, [disabled]);

  const handleTouchStart = () => {
    if (disabled) return;
    timerRef.current = setTimeout(openMenu, 450);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseEnter = () => {
    if (disabled || "ontouchstart" in window) return;
    timerRef.current = setTimeout(openMenu, 200);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(false), 300);
  };

  const handleClick = () => {
    if (!isOpen) onSelect("like");
  };

  const menu = isOpen && mounted ? createPortal(
    <div
      onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
      onMouseLeave={() => { timerRef.current = setTimeout(() => setIsOpen(false), 200); }}
      style={{
        position: "fixed",
        top: menuPos.top,
        left: menuPos.left,
        zIndex: 9999,
      }}
      className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-gray-100 px-3 py-2.5 flex items-center gap-1"
    >
      {REACTIONS.map((r, i) => (
        <button
          key={r.type}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(r.type);
            setIsOpen(false);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(r.type);
            setIsOpen(false);
          }}
          style={{ animationDelay: `${i * 40}ms` }}
          className="relative group flex flex-col items-center animate-bounce-in"
          title={r.label}
        >
          <span
            className="text-3xl leading-none transition-transform duration-150 group-hover:scale-125 group-active:scale-90 drop-shadow"
            style={{ display: "block", width: 44, height: 44, lineHeight: "44px", textAlign: "center" }}
          >
            {r.emoji}
          </span>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-navy-dark text-white text-[9px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {r.label}
          </span>
        </button>
      ))}

      <style>{`
        @keyframes bounce-in {
          0% { opacity: 0; transform: scale(0.3) translateY(10px); }
          60% { transform: scale(1.15) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-bounce-in { animation: bounce-in 0.25s ease forwards; }
      `}</style>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={containerRef}
        className={`relative inline-block select-none ${className ?? ""}`}
        onContextMenu={(e) => { if (isOpen) e.preventDefault(); }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>
      {menu}
    </>
  );
}
