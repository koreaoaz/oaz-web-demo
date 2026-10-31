import { createClient } from "@supabase/supabase-js";
import { validateDemoPublicConfig } from "./demoConfig";

const { url, key } = validateDemoPublicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);
export const supabase = createClient(url, key);
