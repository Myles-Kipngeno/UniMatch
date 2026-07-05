import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://bmrwstoajglitixyaqtq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_rW_d6IR93ndnKBff_67lHQ_BaDW9v20";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
