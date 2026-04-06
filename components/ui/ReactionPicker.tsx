"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export type ReactionType = "like" | "heart" | "haha" | "amen" | "pray";

interface ReactionPickerProps {
  onSelect: (reaction: ReactionType) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  currentReaction?: ReactionType;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like",  emoji: "👍", label: "Me gusta" },
  { type: "heart", emoji: "❤️", label: "Me encanta" },
  { type: "haha",  emoji: "😂", label: "Me divierte" },
  { type: "amen",  emoji: "🙏", label: "Amén" },
  { type: "pray",  emoji: "🙌", label: "Oración" },
];

export default function ReactionPicker({
  onSelect, children, className, disabled, currentReaction
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Close picker on outside click/touch
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    setTimeout(() => document.addEventListener("click", close), 50);
    return () => document.removeEventListener("click", close);
  }, [isOpen]);

  const openMenu = useCallback(() => {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const menuW = 300;
    let left = rect.left + rect.width / 2 - menuW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
    const top = Math.max(8, rect.top - 76);
    setMenuPos({ top, left });
    setIsOpen(true);
    if (window.navigator.vibrate) window.navigator.vibrate(12);
  }, [disabled]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault(); // prevent context menu & double-tap zoom
    timerRef.current = setTimeout(openMenu, 400);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isOpen) return; // picker is open, ignore
    e.stopPropagation();
    // Short tap: toggle current reaction, or add "like"
    onSelect(currentReaction ?? "like");
  };

  const handleMouseEnter = () => {
    if (disabled || "ontouchstart" in window) return;
    timerRef.current = setTimeout(openMenu, 400);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const portal = isOpen && mounted ? createPortal(
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 99999 }}
      className="bg-white rounded-full shadow-[0_4px_32px_rgba(0,0,0,0.2)] border border-gray-100 px-2 py-2 flex items-end gap-1.5"
    >
      {REACTIONS.map((r, i) => (
        <button
          key={r.type}
          onMouseDown={e => e.preventDefault()}
          onPointerDown={e => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(r.type);
            setIsOpen(false);
          }}
          style={{ animationDelay: `${i * 35}ms` }}
          className="relative group flex flex-col items-center gap-1 reaction-btn"
          title={r.label}
        >
          <span
            className="block transition-transform duration-150 group-hover:scale-125 group-active:scale-90 leading-none"
            style={{ fontSize: 32 }}
          >
            {r.emoji}
          </span>
          <span className="text-[9px] font-bold text-navy-dark/70 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {r.label}
          </span>
        </button>
      ))}
      <style>{`
        @keyframes rPopIn {
          0%  { opacity: 0; transform: scale(0.2) translateY(12px); }
          70% { transform: scale(1.1) translateY(-3px); }
          100%{ opacity: 1; transform: scale(1) translateY(0); }
        }
        .reaction-btn { animation: rPopIn 0.22s ease forwards; opacity: 0; }
      `}</style>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={containerRef}
        className={`inline-block select-none ${className ?? ""}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={e => e.preventDefault()}
      >
        {children}
      </div>
      {portal}
    </>
  );
}
