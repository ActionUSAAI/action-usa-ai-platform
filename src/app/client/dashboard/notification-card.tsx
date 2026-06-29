"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";

interface Notification {
  id: string;
  subject: string;
  body_text: string;
  sent_at: string | null;
  read_at: string | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} día${days > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "short" });
}

export function NotificationCard({ notification }: { notification: Notification }) {
  const router = useRouter();
  const isUnread = notification.read_at === null;

  async function markRead() {
    if (!isUnread) return;
    const supabase = createClient();
    await supabase
      .from("agent_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id);
    router.refresh();
  }

  return (
    <button
      onClick={markRead}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        isUnread
          ? "border-[#C9A84C]/40 bg-[#C9A84C]/5 hover:bg-[#C9A84C]/10"
          : "border-gray-100 bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUnread ? "bg-[#1B2B5E] text-[#C9A84C]" : "bg-gray-200 text-gray-400"
        }`}>
          <Bell size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-sm font-semibold ${isUnread ? "text-[#1B2B5E]" : "text-gray-700"}`}>
              {notification.subject}
            </p>
            {isUnread && (
              <span className="shrink-0 h-2 w-2 rounded-full bg-[#C9A84C]" />
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {notification.body_text.slice(0, 120)}{notification.body_text.length > 120 ? "…" : ""}
          </p>
          {notification.sent_at && (
            <p className="mt-1.5 text-xs text-gray-400">{relativeTime(notification.sent_at)}</p>
          )}
        </div>
      </div>
    </button>
  );
}
