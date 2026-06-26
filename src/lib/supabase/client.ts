import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYXNiZmVwcW92ZHNlem1hZGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MzYyMDMsImV4cCI6MjA5ODAxMjIwM30.1yfKc3juIYZp1BY5dX33d2D7iXvVbwwPCoGAL1r7uLE";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
