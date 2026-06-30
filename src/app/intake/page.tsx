import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { IntakeForm } from "./IntakeForm";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface Props {
  searchParams: { token?: string };
}

export default async function IntakePage({ searchParams }: Props) {
  const token = searchParams.token?.trim();

  if (!token) {
    redirect("/intake/no-access");
  }

  const db  = adminDb();
  const now = new Date().toISOString();

  const { data: invitation } = await db
    .from("intake_invitations")
    .select("id, status, case_id, client_id")
    .eq("token", token)
    .in("status", ["pending", "opened"])
    .gt("expires_at", now)
    .maybeSingle();

  if (!invitation) {
    redirect("/intake/no-access");
  }

  // Advance status to 'opened' on first visit
  if (invitation.status === "pending") {
    await db
      .from("intake_invitations")
      .update({ status: "opened", opened_at: now })
      .eq("id", invitation.id);
  }

  return (
    <IntakeForm
      token={token}
      caseId={invitation.case_id as string}
      clientId={invitation.client_id as string}
    />
  );
}
