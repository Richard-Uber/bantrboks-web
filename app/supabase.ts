import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://rkicuzscwfytwoxncugg.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraWN1enNjd2Z5dHdveG5jdWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTkzMDcsImV4cCI6MjA5ODk5NTMwN30.KaW9GkBOhXyMg4cfsCmrn8Dz1_qfiTJoJ-kKqwU2OXE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
