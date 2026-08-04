/**
 * This file is no longer used.
 * Database seeding is now handled via SQL in supabase/schema.sql.
 * Paste that file into the Supabase SQL Editor and run it to initialise the database.
 */

export async function seedDatabase() {
  return {
    message:
      "Database seeding is now handled via SQL. Please run supabase/schema.sql in the Supabase SQL Editor.",
    skipped: true,
  };
}
