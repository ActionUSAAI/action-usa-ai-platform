import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";

export default async function SetupAccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-white" />
        </div>
      }
    >
      <SetupForm
        initialName={user?.user_metadata?.full_name || ""}
        initialEmail={user?.email || ""}
        isAuthenticated={!!user}
      />
    </Suspense>
  );
}
