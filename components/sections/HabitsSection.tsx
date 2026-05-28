"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Target, Plus, Check, X, Loader2, Flame, Sparkles,
  Pencil, Archive, Trash2, ChevronLeft, ChevronRight,
  Clock, Sun, Sunset, Moon as MoonIcon, BarChart3,
  Calendar as CalendarIcon, TrendingUp, Award, Hash,
  Timer, Ban, CircleCheck, Zap, Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import confetti from "canvas-confetti";

// ─── Types ───────────────────────────────────────────────────
type HabitCategory = "salud" | "productividad" | "espiritual" | "fitness" | "general";
type HabitType = "boolean" | "quantity" | "duration" | "negative";
type Frequency = "daily" | "weekly" | "specific_days";
type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

type Habit = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  category: HabitCategory;
  habit_type: HabitType;
  target_value: number;
  target_unit: string | null;
  frequency: Frequency;
  frequency_days: number;
  specific_days: string[] | null;
  time_of_day: TimeOfDay;
  color: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
};

type HabitLog = {
  id: string;
  habit_id: string;
  logged_date: string;
  completed: boolean;
  value: number | null;
  note: string | null;
  mood: number | null;
};

type HabitStreak = {
  habit_id: string;
  current_streak: number;
  max_streak: number;
  total_completions: number;
  last_completed_date: string | null;
};

// ─── Constants ───────────────────────────────────────────────
const CATEGORIES: { id: HabitCategory; label: string; icon: string }[] = [
  { id: "salud", label: "Salud", icon: "💊" },
  { id: "productividad", label: "Productividad", icon: "📚" },
  { id: "espiritual", label: "Espiritual", icon: "🙏" },
  { id: "fitness", label: "Fitness", icon: "💪" },
  { id: "general", label: "General", icon: "🎯" },
];

const HABIT_TYPES: { id: HabitType; label: string; desc: string; icon: typeof Check }[] = [
  { id: "boolean", label: "Sí / No", desc: "Marca como hecho", icon: CircleCheck },
  { id: "quantity", label: "Cantidad", desc: "Ej: 8 vasos de agua", icon: Hash },
  { id: "duration", label: "Duración", desc: "Ej: 30 minutos", icon: Timer },
  { id: "negative", label: "Evitar", desc: "Ej: Evitar quejas", icon: Ban },
];

const TIME_OPTIONS: { id: TimeOfDay; label: string; icon: typeof Sun; emoji: string }[] = [
  { id: "morning", label: "Mañana", icon: Sun, emoji: "☀️" },
  { id: "afternoon", label: "Tarde", icon: Sunset, emoji: "🌤" },
  { id: "evening", label: "Noche", icon: MoonIcon, emoji: "🌙" },
  { id: "any", label: "Cualquiera", icon: Clock, emoji: "⏰" },
];

const DAYS_OF_WEEK = [
  { id: "mon", label: "L" },
  { id: "tue", label: "M" },
  { id: "wed", label: "X" },
  { id: "thu", label: "J" },
  { id: "fri", label: "V" },
  { id: "sat", label: "S" },
  { id: "sun", label: "D" },
];

const COLORS = [
  "#D4A017", "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1",
];

const CATEGORY_ICONS: Record<HabitCategory, string> = {
  salud: "💊",
  productividad: "📚",
  espiritual: "🙏",
  fitness: "💪",
  general: "🎯",
};

// ─── Helpers ─────────────────────────────────────────────────
function getTodayMexico(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function getDayOfWeekMexico(): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
  }).format(new Date()).toLowerCase();
  const map: Record<string, string> = { mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun" };
  return map[day] || day;
}

function isHabitDueToday(habit: Habit): boolean {
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "specific_days" && habit.specific_days) {
    return habit.specific_days.includes(getDayOfWeekMexico());
  }
  // weekly: always show, user decides when
  return true;
}

function getDateRange(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d));
  }
  return dates;
}

// ─── Main Component ──────────────────────────────────────────
export default function HabitsSection({
  profile,
  isAllowedToFetch = true,
}: {
  profile?: any;
  isAllowedToFetch?: boolean;
}) {
  const userId = profile?.id || null;
  const supabase = createClient();

  // State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [streaks, setStreaks] = useState<HabitStreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [myPoints, setMyPoints] = useState(profile?.points || 0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Detail/stats view
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  // Quantity input tracking
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});

  // Stats carousel
  const [statsSlide, setStatsSlide] = useState(0); // 0 = general, 1+ = per-habit
  const statsScrollRef = useRef<HTMLDivElement>(null);

  const today = getTodayMexico();

  // ─── Fetch data ────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!userId || !isAllowedToFetch) return;

    try {
      const [habitsRes, logsRes, streaksRes] = await Promise.all([
        supabase.from("habits").select("*").eq("user_id", userId).eq("is_archived", false).order("sort_order"),
        supabase.from("habit_logs").select("*").eq("user_id", userId).gte("logged_date", getDateRange(90)[0]),
        supabase.from("habit_streaks").select("*").eq("user_id", userId),
      ]);

      if (habitsRes.data) setHabits(habitsRes.data as Habit[]);
      if (logsRes.data) setLogs(logsRes.data as HabitLog[]);
      if (streaksRes.data) setStreaks(streaksRes.data as HabitStreak[]);
    } catch (err) {
      console.error("Error fetching habits:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, isAllowedToFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (statusMsg) {
      const t = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [statusMsg]);

  // ─── Derived ───────────────────────────────────────────────
  const todayHabits = useMemo(() => habits.filter(isHabitDueToday), [habits]);

  const todayCompletedIds = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.logged_date === today && l.completed) set.add(l.habit_id);
    });
    return set;
  }, [logs, today]);

  const completedCount = useMemo(
    () => todayHabits.filter(h => todayCompletedIds.has(h.id)).length,
    [todayHabits, todayCompletedIds]
  );

  const progress = todayHabits.length > 0 ? Math.round((completedCount / todayHabits.length) * 100) : 0;

  const getStreak = (habitId: string) => streaks.find(s => s.habit_id === habitId);
  const getLogForDate = (habitId: string, date: string) => logs.find(l => l.habit_id === habitId && l.logged_date === date);

  // ─── Global stats (real data) ──────────────────────────────
  const globalStats = useMemo(() => {
    const last7 = getDateRange(7);
    const last30 = getDateRange(30);
    
    // Total completions across all habits this week
    const weekCompletions = logs.filter(l => last7.includes(l.logged_date) && l.completed).length;
    const weekPossible = todayHabits.length * 7;
    const weekRate = weekPossible > 0 ? Math.round((weekCompletions / weekPossible) * 100) : 0;

    // Total completions across all habits this month
    const monthCompletions = logs.filter(l => last30.includes(l.logged_date) && l.completed).length;
    const monthPossible = todayHabits.length * 30;
    const monthRate = monthPossible > 0 ? Math.round((monthCompletions / monthPossible) * 100) : 0;

    // Best streak across all habits
    const bestStreak = streaks.reduce((max, s) => Math.max(max, s.max_streak || 0), 0);
    const totalCompletionsAll = streaks.reduce((sum, s) => sum + (s.total_completions || 0), 0);
    
    // Points earned from habits (5 per completion)
    const totalPointsEarned = totalCompletionsAll * 5;

    return { weekRate, monthRate, bestStreak, totalCompletionsAll, totalPointsEarned, weekCompletions, monthCompletions };
  }, [logs, streaks, todayHabits]);

  // ─── Complete habit ────────────────────────────────────────
  const handleComplete = async (habit: Habit, value?: number, note?: string) => {
    if (!userId || completing) return;
    setCompleting(habit.id);

    try {
      const { data, error } = await supabase.rpc("complete_habit", {
        p_habit_id: habit.id,
        p_value: value ?? null,
        p_note: note ?? null,
        p_mood: null,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.ok) {
        setStatusMsg({ text: result?.message || "Error al completar hábito", type: "error" });
        return;
      }

      setStatusMsg({ text: result.message, type: "success" });

      if (result.points_awarded) {
        setMyPoints((p: number) => p + result.points_awarded);
      }

      // Auto-publicar en el muro de comunidad si es completado por primera vez hoy
      if (result?.ok && !result?.already_logged) {
        const uName = profile?.full_name || profile?.username || "Un agente";
        const streakVal = result.streak || 1;
        
        const postContent = `🎯 [HABIT_COMPLETE]:${JSON.stringify({
          user_name: uName,
          category: habit.category,
          icon: habit.icon,
          color: habit.color,
          streak: streakVal
        })}`;
        
        // Insertar en la tabla de posts de forma pública
        await supabase.from("posts").insert({
          author_id: userId,
          content: postContent,
          is_anonymous: false
        });
      }

      // Check if all habits completed → big confetti
      const newCompletedCount = completedCount + 1;
      if (newCompletedCount >= todayHabits.length && todayHabits.length > 1) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#D4A017", "#FF4500", "#FFA500", "#10B981", "#3B82F6"],
        });
      } else {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 },
          colors: [habit.color, "#D4A017"],
        });
      }

      await fetchAll();
    } catch (err: any) {
      setStatusMsg({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setCompleting(null);
    }
  };

  // ─── Uncomplete habit ──────────────────────────────────────
  const handleUncomplete = async (habitId: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.rpc("uncomplete_habit", { p_habit_id: habitId });
      if (error) throw error;
      await fetchAll();
    } catch (err: any) {
      setStatusMsg({ text: `Error: ${err.message}`, type: "error" });
    }
  };

  // ─── Archive habit ─────────────────────────────────────────
  const handleArchive = async (habitId: string) => {
    try {
      await supabase.from("habits").update({ is_archived: true }).eq("id", habitId);
      setDetailHabit(null);
      await fetchAll();
      setStatusMsg({ text: "Hábito archivado.", type: "success" });
    } catch (err: any) {
      setStatusMsg({ text: `Error: ${err.message}`, type: "error" });
    }
  };

  // ─── No auth state ─────────────────────────────────────────
  if (!userId) {
    return (
      <section className="py-20 bg-cream/30 min-h-[60vh] flex items-center justify-center">
        <p className="text-navy-dark/60 font-sans">Inicia sesión para gestionar tus hábitos.</p>
      </section>
    );
  }

  // ─── Detail view ───────────────────────────────────────────
  if (detailHabit) {
    const streak = getStreak(detailHabit.id);
    const last30 = getDateRange(30);
    const last7 = getDateRange(7);
    const completedDates = new Set(
      logs.filter(l => l.habit_id === detailHabit.id && l.completed).map(l => l.logged_date)
    );
    const weeklyRate = last7.filter(d => completedDates.has(d)).length;
    const monthlyRate = last30.filter(d => completedDates.has(d)).length;

    return (
      <section className="py-10 bg-white min-h-[60vh]">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Back */}
          <button
            onClick={() => setDetailHabit(null)}
            className="flex items-center gap-2 mb-6 text-sm font-sans font-bold text-navy-dark/60 hover:text-gold transition-colors group"
          >
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Mis Hábitos
          </button>

          {/* Header */}
          <div className="bg-cream/40 rounded-3xl p-6 border border-light-gray mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                style={{ backgroundColor: detailHabit.color + "20" }}
              >
                {detailHabit.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-xl text-navy-dark">{detailHabit.name}</h3>
                {detailHabit.description && (
                  <p className="text-sm text-navy-dark/60 font-sans mt-1">{detailHabit.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingHabit(detailHabit);
                    setShowModal(true);
                  }}
                  className="p-2 rounded-xl bg-white border border-light-gray hover:border-gold/30 text-navy-dark/40 hover:text-gold transition-all"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleArchive(detailHabit.id)}
                  className="p-2 rounded-xl bg-white border border-light-gray hover:border-red-200 text-navy-dark/40 hover:text-red-500 transition-all"
                >
                  <Archive size={16} />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div
                className="rounded-2xl p-4 text-center border transition-all"
                style={{
                  background: `linear-gradient(135deg, ${detailHabit.color}10, ${detailHabit.color}03)`,
                  borderColor: detailHabit.color + "25",
                }}
              >
                <p className="text-3xl font-black font-sans flex items-center justify-center gap-1" style={{ color: detailHabit.color }}>
                  {streak?.current_streak || 0}
                  <Flame size={18} className="fill-current animate-pulse" />
                </p>
                <p className="text-[10px] font-black text-navy-dark/50 uppercase tracking-wider mt-1.5">Racha Actual</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center border transition-all"
                style={{
                  background: `linear-gradient(135deg, ${detailHabit.color}15, ${detailHabit.color}05)`,
                  borderColor: detailHabit.color + "30",
                }}
              >
                <p className="text-3xl font-black font-sans text-gold flex items-center justify-center gap-1">
                  {streak?.max_streak || 0}
                  <Award size={18} className="fill-current" />
                </p>
                <p className="text-[10px] font-black text-navy-dark/50 uppercase tracking-wider mt-1.5">Récord Max</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center border transition-all"
                style={{
                  background: `linear-gradient(135deg, ${detailHabit.color}10, ${detailHabit.color}03)`,
                  borderColor: detailHabit.color + "25",
                }}
              >
                <p className="text-3xl font-black text-navy-dark font-sans flex items-center justify-center gap-1">
                  {streak?.total_completions || 0}
                  <Check size={18} className="stroke-[3]" />
                </p>
                <p className="text-[10px] font-black text-navy-dark/50 uppercase tracking-wider mt-1.5">Total Hecho</p>
              </div>
            </div>
          </div>

          {/* Cadena visual — Last 30 days */}
          <div className="bg-cream/40 rounded-3xl p-6 border border-light-gray mb-6">
            <h4 className="font-serif font-bold text-navy-dark mb-4 flex items-center gap-2">
              <CalendarIcon size={18} className="text-gold" />
              Últimos 30 días
            </h4>
            <div className="grid grid-cols-10 gap-1.5">
              {last30.map((date) => {
                const done = completedDates.has(date);
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    title={date}
                    className={`aspect-square rounded-lg transition-all ${
                      done
                        ? "shadow-sm"
                        : isToday
                        ? "bg-navy-dark/5 border-2 border-dashed border-gold/30"
                        : "bg-navy-dark/[0.03]"
                    }`}
                    style={done ? { backgroundColor: detailHabit.color, opacity: 0.85 } : undefined}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-navy-dark/40 font-sans">Hace 30 días</span>
              <span className="text-[10px] text-navy-dark/40 font-sans">Hoy</span>
            </div>
          </div>

          {/* Weekly & Monthly rates */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="rounded-3xl p-5 border text-center transition-all"
              style={{
                background: `linear-gradient(135deg, ${detailHabit.color}08, ${detailHabit.color}02)`,
                borderColor: detailHabit.color + "20",
              }}
            >
              <TrendingUp size={22} style={{ color: detailHabit.color }} className="mx-auto mb-2" />
              <p className="text-4xl font-black font-sans" style={{ color: detailHabit.color }}>
                {Math.round((weeklyRate / 7) * 100)}%
              </p>
              <p className="text-[10px] font-black text-navy-dark/50 uppercase tracking-wider mt-1.5">
                Éxito Semanal
              </p>
            </div>
            <div
              className="rounded-3xl p-5 border text-center transition-all"
              style={{
                background: `linear-gradient(135deg, ${detailHabit.color}08, ${detailHabit.color}02)`,
                borderColor: detailHabit.color + "20",
              }}
            >
              <BarChart3 size={22} className="text-gold mx-auto mb-2" />
              <p className="text-4xl font-black text-gold font-sans">
                {Math.round((monthlyRate / 30) * 100)}%
              </p>
              <p className="text-[10px] font-black text-navy-dark/50 uppercase tracking-wider mt-1.5">
                Éxito Mensual
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── Main dashboard view ───────────────────────────────────
  return (
    <section className="py-6 bg-white min-h-[60vh]">
      <div className="container mx-auto px-4 max-w-2xl">

        {/* ══════ STATS DASHBOARD (horizontal scroll) ══════ */}
        {habits.length > 0 && (
          <div className="mb-6">
            {/* Stats carousel dots */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-navy-dark/40 uppercase tracking-widest font-sans">
                Estadísticas
              </h3>
              <div className="flex gap-1.5">
                {[{ label: "General" }, ...habits].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setStatsSlide(i);
                      if (statsScrollRef.current) {
                        statsScrollRef.current.scrollTo({ left: i * statsScrollRef.current.offsetWidth, behavior: "smooth" });
                      }
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      statsSlide === i ? "bg-gold w-5" : "bg-navy-dark/15 hover:bg-navy-dark/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Scrollable stats cards */}
            <div
              ref={statsScrollRef}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-0 -mx-4 px-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const idx = Math.round(el.scrollLeft / el.offsetWidth);
                setStatsSlide(idx);
              }}
            >
              {/* ── General Stats Card ── */}
              <div className="snap-center flex-shrink-0 w-full pr-3">
                <div
                  className="rounded-3xl p-5 shadow-lg relative overflow-hidden border"
                  style={{
                    background: "linear-gradient(135deg, #D4A01715, #D4A01708)",
                    borderColor: "#D4A01725",
                  }}
                >
                  {/* Decorative */}
                  <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 bg-gold/10" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
                        <BarChart3 size={18} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-sans font-bold text-sm text-navy-dark">Resumen General</h4>
                        <p className="text-[10px] text-navy-dark/50 font-sans">FBI Embajadores</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center border border-light-gray/40">
                        <p className="text-lg font-black text-navy-dark font-sans">{globalStats.weekRate}%</p>
                        <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Semana</p>
                      </div>
                      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center border border-light-gray/40">
                        <p className="text-lg font-black text-navy-dark font-sans">{globalStats.monthRate}%</p>
                        <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Mes</p>
                      </div>
                      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center border border-light-gray/40">
                        <p className="text-lg font-black text-gold font-sans">{globalStats.bestStreak}</p>
                        <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Racha</p>
                      </div>
                      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center border border-light-gray/40">
                        <p className="text-lg font-black text-emerald-600 font-sans">{globalStats.totalPointsEarned}</p>
                        <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Puntos</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Per-Habit Stats Cards ── */}
              {habits.map((habit) => {
                const streak = getStreak(habit.id);
                const last7 = getDateRange(7);
                const last30 = getDateRange(30);
                const completedDates = new Set(
                  logs.filter(l => l.habit_id === habit.id && l.completed).map(l => l.logged_date)
                );
                const weeklyDone = last7.filter(d => completedDates.has(d)).length;
                const monthlyDone = last30.filter(d => completedDates.has(d)).length;

                return (
                  <div key={habit.id} className="snap-center flex-shrink-0 w-full pr-3">
                    <div
                      className="rounded-3xl p-5 shadow-lg relative overflow-hidden border"
                      style={{
                        background: `linear-gradient(135deg, ${habit.color}15, ${habit.color}08)`,
                        borderColor: habit.color + "25",
                      }}
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2"
                        style={{ backgroundColor: habit.color + "10" }} />
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm"
                            style={{ backgroundColor: habit.color + "20" }}
                          >
                            {habit.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-sans font-bold text-sm text-navy-dark truncate">{habit.name}</h4>
                            <p className="text-[10px] text-navy-dark/50 font-sans">{CATEGORIES.find(c => c.id === habit.category)?.label}</p>
                          </div>
                          <button
                            onClick={() => setDetailHabit(habit)}
                            className="text-[10px] font-bold text-navy-dark/40 hover:text-gold transition-colors font-sans uppercase tracking-wider"
                          >
                            Ver más →
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-navy-dark font-sans">{streak?.current_streak || 0}</p>
                            <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Racha</p>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black font-sans" style={{ color: habit.color }}>{streak?.max_streak || 0}</p>
                            <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Récord</p>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-navy-dark font-sans">{Math.round((weeklyDone / 7) * 100)}%</p>
                            <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Semana</p>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-navy-dark font-sans">{Math.round((monthlyDone / 30) * 100)}%</p>
                            <p className="text-[9px] font-bold text-navy-dark/40 uppercase">Mes</p>
                          </div>
                        </div>

                        {/* Mini 7-day chain */}
                        <div className="flex gap-1.5 mt-3 justify-center">
                          {last7.map((date) => {
                            const done = completedDates.has(date);
                            const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "narrow" });
                            return (
                              <div key={date} className="flex flex-col items-center gap-0.5">
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                    done ? "shadow-sm" : "bg-navy-dark/[0.06]"
                                  }`}
                                  style={done ? { backgroundColor: habit.color } : undefined}
                                >
                                  {done && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>
                                <span className="text-[8px] font-bold text-navy-dark/30 uppercase">{dayLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════ TODAY'S PROGRESS + HEADER ══════ */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-navy-dark flex items-center gap-2">
              Hoy
              {progress === 100 && todayHabits.length > 0 && (
                <span className="text-green-500 text-sm">✓</span>
              )}
            </h2>
            <p className="text-xs text-navy-dark/50 font-sans mt-0.5">
              {todayHabits.length > 0
                ? `${completedCount} de ${todayHabits.length} completados`
                : habits.length > 0 ? "No hay hábitos programados para hoy" : ""}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingHabit(null);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gold text-white rounded-2xl font-sans font-bold text-xs shadow-lg shadow-gold/20 hover:bg-gold/90 transition-all active:scale-95"
          >
            <Plus size={16} strokeWidth={3} />
            Nuevo
          </button>
        </div>

        {/* Progress bar (compact) */}
        {todayHabits.length > 0 && (
          <div className="mb-5">
            <div className="h-2 bg-cream rounded-full overflow-hidden border border-light-gray/50">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? "linear-gradient(90deg, #10B981, #059669)"
                    : "linear-gradient(90deg, #D4A017, #F59E0B)",
                }}
              />
            </div>
          </div>
        )}

        {/* Status message */}
        {statusMsg && (
          <div className={`mb-4 p-3 rounded-2xl text-sm font-sans font-bold border animate-in fade-in slide-in-from-top-2 ${
            statusMsg.type === "error"
              ? "bg-red-50 border-red-100 text-red-600"
              : "bg-green-50 border-green-100 text-green-600"
          }`}>
            {statusMsg.type === "error" ? "⚠️ " : "✅ "}{statusMsg.text}
          </div>
        )}

        {/* ══════ HABITS LIST ══════ */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gold w-8 h-8" />
          </div>
        ) : habits.length === 0 ? (
          /* Empty state — beautiful CTA */
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-gold/10 to-amber-500/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gold/15 shadow-inner">
              <Target size={40} className="text-gold/60" />
            </div>
            <h3 className="font-serif font-bold text-xl text-navy-dark mb-2">Comienza tu camino</h3>
            <p className="text-sm text-navy-dark/50 font-sans mb-8 max-w-xs mx-auto leading-relaxed">
              Crea tu primer hábito personal y gana <span className="font-bold text-gold">+5 puntos</span> cada vez que lo completes.
            </p>
            <button
              onClick={() => {
                setEditingHabit(null);
                setShowModal(true);
              }}
              className="px-8 py-4 bg-navy-dark text-white rounded-2xl font-sans font-bold shadow-xl hover:bg-gold hover:text-navy-dark transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <Plus size={18} strokeWidth={3} />
              Crear Primer Hábito
            </button>
          </div>
        ) : todayHabits.length === 0 ? (
          /* No habits due today */
          <div className="text-center py-10 bg-cream/30 rounded-3xl border border-light-gray">
            <CalendarIcon size={32} className="text-navy-dark/20 mx-auto mb-3" />
            <p className="text-sm text-navy-dark/50 font-sans font-bold">No tienes hábitos programados para hoy</p>
            <p className="text-xs text-navy-dark/30 font-sans mt-1">Disfruta tu descanso, Agente 😌</p>
          </div>
        ) : (
          /* Habit cards — streamlined */
          <div className="space-y-2.5">
            {todayHabits.map((habit) => {
              const isCompleted = todayCompletedIds.has(habit.id);
              const streak = getStreak(habit.id);
              const isLoading = completing === habit.id;
              const isQuantity = habit.habit_type === "quantity";
              const isDuration = habit.habit_type === "duration";
              const isNegative = habit.habit_type === "negative";

              return (
                <div
                  key={habit.id}
                  className={`relative rounded-3xl border transition-all duration-300 overflow-hidden group ${
                    isCompleted
                      ? "hover:shadow-md"
                      : "hover:shadow-lg hover:-translate-y-[1px]"
                  }`}
                  style={
                    isCompleted
                      ? {
                          background: `linear-gradient(135deg, #10B98110, #10B98104)`,
                          borderColor: "#10B98135",
                        }
                      : {
                          background: `linear-gradient(135deg, ${habit.color}08, ${habit.color}02)`,
                          borderColor: habit.color + "20",
                        }
                  }
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Check button */}
                     <button
                      onClick={() => {
                        if (isCompleted) {
                          handleUncomplete(habit.id);
                        } else if (isQuantity || isDuration) {
                          const inputVal = parseFloat(quantityInputs[habit.id] || "");
                          const val = !isNaN(inputVal) && inputVal > 0 ? inputVal : habit.target_value;
                          handleComplete(habit, val);
                          setQuantityInputs(prev => ({ ...prev, [habit.id]: "" }));
                        } else {
                          handleComplete(habit);
                        }
                      }}
                      disabled={isLoading}
                      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-green-500 text-white shadow-sm"
                          : "border-2 border-light-gray hover:border-gold hover:bg-gold/5 text-navy-dark/20 hover:text-gold"
                      } ${isLoading ? "animate-pulse" : ""}`}
                      style={!isCompleted ? { borderColor: habit.color + "30" } : undefined}
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : isCompleted ? (
                        <Check size={18} strokeWidth={3} />
                      ) : (
                        <Check size={18} className="text-navy-dark/15 group-hover:text-gold transition-all stroke-[2.5]" />
                      )}
                    </button>

                    {/* Habit info */}
                    <button
                      onClick={() => setDetailHabit(habit)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{habit.icon}</span>
                        <h4 className={`font-sans font-bold text-sm truncate ${
                          isCompleted ? "text-green-700 line-through opacity-70" : "text-navy-dark"
                        }`}>
                          {habit.name}
                        </h4>
                        {isNegative && (
                          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold uppercase">Evitar</span>
                        )}
                      </div>
                      {habit.description && (
                        <p className={`text-xs font-sans mt-0.5 truncate ${
                          isCompleted ? "text-green-600/60" : "text-navy-dark/50"
                        }`}>
                          {habit.description}
                        </p>
                      )}
                    </button>

                    {/* Streak badge */}
                    {(streak?.current_streak || 0) > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-gold/10 rounded-lg flex-shrink-0">
                        <Flame size={12} className="text-gold fill-gold" />
                        <span className="text-xs font-black text-gold font-sans">{streak?.current_streak}</span>
                      </div>
                    )}

                    {/* Points indicator */}
                    {isCompleted && (
                      <span className="text-xs text-green-600 font-bold font-sans flex-shrink-0">+5 🪙</span>
                    )}
                  </div>

                  {/* Quantity/Duration input (when not completed) */}
                  {(isQuantity || isDuration) && !isCompleted && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={isDuration ? 1 : 0.5}
                        value={quantityInputs[habit.id] ?? ""}
                        onChange={(e) => setQuantityInputs(prev => ({ ...prev, [habit.id]: e.target.value }))}
                        placeholder={`Meta: ${habit.target_value} ${habit.target_unit || (isDuration ? "min" : "")}`}
                        className="flex-1 px-3 py-2 bg-cream/50 rounded-xl border border-light-gray text-sm font-sans outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 transition-all"
                      />
                      <span className="text-xs text-navy-dark/40 font-sans font-bold">
                        / {habit.target_value} {habit.target_unit || (isDuration ? "min" : "")}
                      </span>
                    </div>
                  )}

                  {/* Color accent bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-3xl"
                    style={{ backgroundColor: isCompleted ? "#10B981" : habit.color }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* All done celebration */}
        {todayHabits.length > 0 && completedCount === todayHabits.length && (
          <div className="mt-6 text-center bg-green-50 rounded-3xl p-6 border border-green-100">
            <Award size={36} className="text-green-500 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-lg text-green-800 mb-1">¡Todos completados! 🎉</h3>
            <p className="text-sm text-green-600 font-sans">
              Ganaste <span className="font-black">{todayHabits.length * 5} 🪙</span> puntos hoy.
            </p>
          </div>
        )}

        {/* Points tip — only when have habits */}
        {habits.length > 0 && (
          <div className="mt-6 bg-gold/5 rounded-2xl p-4 border border-gold/10 text-center">
            <p className="font-sans text-xs text-navy-dark/60">
              <span className="font-bold text-gold">💡</span> Los puntos se suman a tu balance.{" "}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("fbi:change-tab", { detail: "shop" }))}
                className="text-gold font-bold hover:underline"
              >
                Canjéalos en la Tienda
              </button>
            </p>
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─────────────────────────────── */}
      {showModal && typeof window !== "undefined" && createPortal(
        <HabitModal
          habit={editingHabit}
          userId={userId}
          onClose={() => {
            setShowModal(false);
            setEditingHabit(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingHabit(null);
            fetchAll();
          }}
        />,
        document.body
      )}
    </section>
  );
}

// ─── Habit Create/Edit Modal ─────────────────────────────────
function HabitModal({
  habit,
  userId,
  onClose,
  onSaved,
}: {
  habit: Habit | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const isEdit = !!habit;

  const [name, setName] = useState(habit?.name || "");
  const [description, setDescription] = useState(habit?.description || "");
  const [category, setCategory] = useState<HabitCategory>(habit?.category as HabitCategory || "general");
  const [habitType, setHabitType] = useState<HabitType>(habit?.habit_type as HabitType || "boolean");
  const [targetValue, setTargetValue] = useState<string>(String(habit?.target_value ?? 1));
  const [targetUnit, setTargetUnit] = useState(habit?.target_unit || "");
  const [frequency, setFrequency] = useState<Frequency>(habit?.frequency as Frequency || "daily");
  const [frequencyDays, setFrequencyDays] = useState<string>(String(habit?.frequency_days ?? 3));
  const [specificDays, setSpecificDays] = useState<string[]>(habit?.specific_days || []);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(habit?.time_of_day as TimeOfDay || "any");
  const [color, setColor] = useState(habit?.color || "#D4A017");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCat = CATEGORIES.find(c => c.id === category);
  const icon = selectedCat?.icon || "🎯";

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const parsedTarget = parseInt(targetValue) || 1;
    const parsedFreqDays = parseInt(frequencyDays) || 3;

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      icon,
      category,
      habit_type: habitType,
      target_value: parsedTarget,
      target_unit: targetUnit || null,
      frequency,
      frequency_days: parsedFreqDays,
      specific_days: frequency === "specific_days" ? specificDays : null,
      time_of_day: timeOfDay,
      color,
      updated_at: new Date().toISOString(),
    };

    try {
      if (isEdit) {
        const { error: err } = await supabase.from("habits").update(payload).eq("id", habit!.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("habits").insert({
          ...payload,
          user_id: userId,
        });
        if (err) throw err;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setSpecificDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-dark/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-12 fade-in duration-300 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 flex justify-between items-center bg-cream/30 border-b border-light-gray sticky top-0 z-10">
          <h3 className="font-serif font-bold text-xl text-navy-dark flex items-center gap-2 px-2">
            <Target size={20} className="text-gold" />
            {isEdit ? "Editar Hábito" : "Nuevo Hábito"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-sm border border-gold/10 text-navy-dark"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-sans font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Nombre del hábito *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Orar, Leer la Biblia, Hacer ejercicio..."
              maxLength={60}
              className="w-full p-3 bg-cream/50 border border-light-gray rounded-xl outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 font-sans text-sm transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Descripción breve
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: 15 minutos de lectura devocional"
              maxLength={120}
              className="w-full p-3 bg-cream/50 border border-light-gray rounded-xl outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 font-sans text-sm transition-all"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Categoría
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-sans font-bold transition-all ${
                    category === cat.id
                      ? "bg-gold/10 border-gold text-gold shadow-sm"
                      : "bg-white border-light-gray text-navy-dark/60 hover:border-gold/30"
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Tipo de hábito
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HABIT_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setHabitType(t.id)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      habitType === t.id
                        ? "bg-gold/10 border-gold shadow-sm"
                        : "bg-white border-light-gray hover:border-gold/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className={habitType === t.id ? "text-gold" : "text-navy-dark/40"} />
                      <span className={`text-sm font-bold font-sans ${
                        habitType === t.id ? "text-gold" : "text-navy-dark"
                      }`}>
                        {t.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-navy-dark/50 font-sans">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target (for quantity/duration) */}
          {(habitType === "quantity" || habitType === "duration") && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
                  Meta
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Allow empty string and digits only
                    if (v === "" || /^\d+$/.test(v)) {
                      setTargetValue(v);
                    }
                  }}
                  placeholder="Ej: 30"
                  className="w-full p-3 bg-cream/50 border border-light-gray rounded-xl outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 font-sans text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
                  Unidad
                </label>
                <input
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder={habitType === "duration" ? "minutos" : "vasos, páginas..."}
                  className="w-full p-3 bg-cream/50 border border-light-gray rounded-xl outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 font-sans text-sm"
                />
              </div>
            </div>
          )}

          {/* Frequency */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Frecuencia
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFrequency("daily")}
                className={`px-4 py-2.5 rounded-xl border text-sm font-sans font-bold transition-all ${
                  frequency === "daily"
                    ? "bg-gold/10 border-gold text-gold"
                    : "bg-white border-light-gray text-navy-dark/60 hover:border-gold/30"
                }`}
              >
                Diaria
              </button>
              <button
                onClick={() => setFrequency("weekly")}
                className={`px-4 py-2.5 rounded-xl border text-sm font-sans font-bold transition-all ${
                  frequency === "weekly"
                    ? "bg-gold/10 border-gold text-gold"
                    : "bg-white border-light-gray text-navy-dark/60 hover:border-gold/30"
                }`}
              >
                Semanal
              </button>
              <button
                onClick={() => setFrequency("specific_days")}
                className={`px-4 py-2.5 rounded-xl border text-sm font-sans font-bold transition-all ${
                  frequency === "specific_days"
                    ? "bg-gold/10 border-gold text-gold"
                    : "bg-white border-light-gray text-navy-dark/60 hover:border-gold/30"
                }`}
              >
                Días específicos
              </button>
            </div>

            {frequency === "weekly" && (
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={frequencyDays}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Allow empty string, then only valid digits 1-7
                    if (v === "" || (/^\d$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 7)) {
                      setFrequencyDays(v);
                    }
                  }}
                  placeholder="3"
                  className="w-20 p-2 bg-cream/50 border border-light-gray rounded-xl text-center font-sans text-sm outline-none focus:border-gold"
                />
                <span className="text-sm text-navy-dark/60 font-sans">veces por semana</span>
              </div>
            )}

            {frequency === "specific_days" && (
              <div className="mt-3 flex gap-2">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDay(d.id)}
                    className={`w-10 h-10 rounded-xl font-sans font-bold text-sm transition-all ${
                      specificDays.includes(d.id)
                        ? "bg-gold text-white shadow-sm"
                        : "bg-cream border border-light-gray text-navy-dark/40 hover:border-gold/30"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time of day */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Momento del día
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTimeOfDay(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-sans font-bold transition-all ${
                    timeOfDay === t.id
                      ? "bg-gold/10 border-gold text-gold"
                      : "bg-white border-light-gray text-navy-dark/60 hover:border-gold/30"
                  }`}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-bold text-navy-dark/50 uppercase tracking-wider mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-xl transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-navy-dark scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-cream/40 rounded-2xl p-4 border border-light-gray flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ backgroundColor: color + "20" }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-bold text-sm text-navy-dark truncate">
                {name || "Tu hábito"}
              </p>
              <p className="text-[11px] text-navy-dark/50 font-sans">
                {CATEGORIES.find(c => c.id === category)?.label} · {HABIT_TYPES.find(t => t.id === habitType)?.label} · {TIME_OPTIONS.find(t => t.id === timeOfDay)?.label}
              </p>
            </div>
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: color }} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-light-gray bg-cream/10 flex gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 border border-light-gray rounded-2xl font-sans font-bold text-sm text-navy-dark/60 hover:bg-cream transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-[2] py-3.5 bg-gold text-white rounded-2xl font-sans font-bold text-sm shadow-lg hover:bg-gold/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : isEdit ? "Guardar Cambios" : "Crear Hábito"}
          </button>
        </div>
      </div>
    </div>
  );
}
