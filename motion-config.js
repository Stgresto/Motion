/* Motion UF — public client config.
   Fill these in to turn on accounts + database sync (Supabase).
   The anon key is safe to publish: every table is protected by Row Level Security,
   so a signed-in user can only ever read and write their own rows.
   Leave empty → guest mode: everything stays private on the device. */
window.MOTION_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
