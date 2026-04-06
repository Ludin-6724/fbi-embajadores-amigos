"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, Heart, Laugh, Hand } from "lucide-react";

export type ReactionType = "like" | "heart" | "haha" | "amen" | "pray";

interface ReactionPickerProps {
  onSelect: (reaction: ReactionType) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const REACTIONS: { type: ReactionType; icon: any; label: string; color: string }[] = [
  { type: "like", icon: "👍", label: "Me gusta", color: "text-blue-500" },
  { type: "heart", icon: "❤️", label: "Me encanta", color: "text-red-500" },
  { type: "haha", icon: "😂", label: "Me divierte", color: "text-yellow-500" },
  { type: "amen", icon: "🙏", label: "Amén", color: "text-gold" },
  { type: "pray", icon: "🙌", label: "Oración", color: "text-indigo-500" },
];

export default function ReactionPicker({ onSelect, children, className, disabled }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      setIsOpen(true);
      if (window.navigator.vibrate) window.navigator.vibrate(20);
    }, 450); // Umbral de Long Press
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseEnter = () => {
    if (disabled || 'ontouchstart' in window) return;
    timerRef.current = setTimeout(() => setIsOpen(true), 150);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onContextMenu={(e) => {
        if (isOpen) e.preventDefault();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        // Si el menú estaba cerrado, es un clic simple: ejecutar acción por defecto
        if (!isOpen) {
          onSelect("like");
        }
      }}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 10, x: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: -50, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.5, y: 10 }}
            className="absolute left-1/2 bottom-full mb-2 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gold/10 p-1.5 flex items-center gap-1 z-[100] preserve-3d"
            style={{ transformOrigin: "bottom" }}
          >
            {REACTIONS.map((r, i) => (
              <motion.button
                key={r.type}
                whileHover={{ scale: 1.3, y: -5 }}
                whileTap={{ scale: 0.9 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(r.type);
                  setIsOpen(false);
                }}
                className="w-10 h-10 rounded-full hover:bg-cream flex flex-col items-center justify-center transition-colors relative group"
              >
                <span className="text-2xl drop-shadow-sm">{r.icon}</span>
                <span className="absolute -top-8 px-2 py-0.5 bg-navy-dark text-white text-[9px] font-bold rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {r.label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
