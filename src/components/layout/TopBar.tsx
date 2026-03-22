"use client";

import { Menu, Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NotificationBell from "./NotificationBell";

interface TopBarProps {
  title: string;
  userName: string;
  onMenuToggle?: () => void;
}

export default function TopBar({ title, userName, onMenuToggle }: TopBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/clients?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  };

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-bg transition-colors lg:hidden"
        >
          <Menu size={20} className="text-secondary" />
        </button>
        <h2 className="text-lg font-semibold text-secondary">{title}</h2>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        {/* Search — hidden on very small screens */}
        <form onSubmit={handleSearch} className="relative hidden sm:block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client..."
            className="pl-9 pr-4 py-1.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-48 lg:w-64 transition-all"
          />
        </form>

        {/* Notifications */}
        <NotificationBell />

        {/* User avatar — name hidden on mobile */}
        <div className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-border">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
          <span className="text-sm font-medium text-secondary hidden lg:inline">{userName}</span>
        </div>
      </div>
    </header>
  );
}
