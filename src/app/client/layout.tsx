import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutBtn } from "./logout-btn";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-blue shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Image src="/logo.png" alt="ACTION USA AI" width={160} height={40} className="h-10 w-auto" priority />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-blue-200 sm:block">{user.email}</span>
            <LogoutBtn />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ACTION USA AI — Portal del Cliente
      </footer>
    </div>
  );
}
