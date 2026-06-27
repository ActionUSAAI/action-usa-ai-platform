import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";

export default async function SetupAccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Must be authenticated (callback already ran and created session)
  if (!user) redirect("/login");

  const name = user.user_metadata?.full_name || "";
  const email = user.email || "";

  return <SetupForm name={name} email={email} />;
}
