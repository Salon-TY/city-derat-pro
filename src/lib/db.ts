// Untyped wrapper around supabase to use until DB types regenerate.
import { supabase } from "@/integrations/supabase/client";
export const db = supabase as any;
