import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This is the public browser key. Database and Storage access remain protected by RLS.
export const supabase = createClient(
  "https://bmvqhoxtrxvbkybjskre.supabase.co",
  "sb_publishable_sdY2LfW0V2hc80EzrTkcqg_C0PkHi9b"
);

export async function isCurrentUserAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { user: null, isAdmin: false, error: userError };

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return { user: userData.user, isAdmin: Boolean(data), error };
}

export function productFromRow(row) {
  return {
    ...row,
    priceNum: Number(row.price_num),
    oldPrice: row.old_price || "",
    bgGradient: row.bg_gradient || "",
    ambientGlow: row.ambient_glow || "",
    desc: row.description || "",
    image: row.image_url || "",
    inStock: Boolean(row.in_stock)
  };
}
