import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values.",
  );
}

// Anon key only — this client runs in the browser. RLS on every table is what
// keeps it safe; never import the service-role key here or in any VITE_ variable.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
