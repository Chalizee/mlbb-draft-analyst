export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// Temporary no-login mode. Keep the Supabase setup intact so authentication
// can be restored later by changing this single value back to false.
export const isAuthBypassEnabled = true;

const hasSupabaseEnvironment = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const isSupabaseConfigured =
  !isAuthBypassEnabled && hasSupabaseEnvironment;
