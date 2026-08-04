// Dummy values so importing lib/supabase.ts (a side effect of importing other
// lib/ modules that re-export from it) doesn't throw — unit tests never
// actually call out to Supabase, they only exercise pure business logic.
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
