import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    message:
      "Database seeding is now handled via SQL. Please paste the contents of supabase/schema.sql into the Supabase SQL Editor and run it to create tables and seed initial data.",
    skipped: true,
  });
}

export async function GET() {
  return NextResponse.json({
    message:
      "Database seeding is now handled via SQL. Please paste the contents of supabase/schema.sql into the Supabase SQL Editor and run it to create tables and seed initial data.",
    skipped: true,
  });
}
