"use client";

import { Bell, Search } from "lucide-react";
import { useState } from "react";

interface TopbarProps {
  title: string;
  userEmail?: string;
  userName?: string;
}

export function Topbar({ title, userEmail, userName }: TopbarProps) {
  const [search, setSearch] = useState("");
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Búsqueda global */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar casos, clientes..."
            className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        </div>

        {/* Notificaciones */}
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Bell size={20} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-red" />
        </button>

        {/* Avatar usuario */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-gray-900 leading-none">{userName || "Usuario"}</p>
            <p className="text-xs text-gray-500 leading-none mt-0.5">{userEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
