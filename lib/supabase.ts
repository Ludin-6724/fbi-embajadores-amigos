import { createClient } from "@supabase/supabase-js";

// Dummy fallbacks for Mock Phase (Fase 1)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-fbi-embajadores.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
