/* Motion UF — public client config.
   The anon key is meant to be public: every table is protected by Row Level Security,
   so a signed-in user can only ever read and write their own rows. */
window.MOTION_CONFIG = {
  supabaseUrl: 'https://prnwanufwqvblsklcraj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBybndhbnVmd3F2Ymxza2xjcmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTg3MjksImV4cCI6MjEwNjc3NDcyOX0.ZDljdwBqRVERGeglbpT6u_BP-zKmK3MbUZDlJl0u4FU'
};
