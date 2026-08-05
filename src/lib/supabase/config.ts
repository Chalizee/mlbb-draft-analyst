export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// Private links use an anonymous Supabase session behind the scenes. There is
// no email/password UI, but RLS still protects every workspace row.
export const isPrivateWorkspaceEnabled = true;

const hasSupabaseEnvironment = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const isSupabaseConfigured = hasSupabaseEnvironment;
