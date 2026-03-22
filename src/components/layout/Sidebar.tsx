"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  FileText,
  Activity,
  Mail,
  Wallet,
  Settings,
  UserCog,
  LayoutDashboard,
  LogOut,
  X,
  Zap,
  BarChart2,
  PhoneCall,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import clsx from "clsx";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/qualification", label: "Qualification", icon: Zap },
  { href: "/telepros", label: "Telepros", icon: PhoneCall },
  { href: "/planning", label: "Planning", icon: Calendar },
  { href: "/factures", label: "Factures", icon: FileText },
  { href: "/actions", label: "Actions", icon: Activity },
  { href: "/modeles", label: "Modeles", icon: Mail },
  { href: "/depenses", label: "Depenses", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/reglages", label: "Reglages", icon: Settings },
  { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ userName, userRole, mobileOpen, onMobileClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <aside
      className={clsx(
        "fixed top-0 h-screen bg-sidebar text-white flex flex-col z-50 transition-all duration-300",
        // Desktop: always visible
        "lg:translate-x-0 lg:left-0",
        collapsed ? "lg:w-16" : "lg:w-60",
        // Mobile: slide in/out, always full width
        "w-64",
        mobileOpen ? "translate-x-0 left-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">MyCRM</h1>
            <p className="text-[10px] text-white/50 -mt-1">Energie Solaire France</p>
          </div>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-sidebar-hover transition-colors hidden lg:flex items-center justify-center"
          title={collapsed ? "Ouvrir le menu" : "Reduire le menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="p-1.5 rounded-lg hover:bg-sidebar-hover transition-colors lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "flex items-center mx-2 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                collapsed ? "justify-center" : "gap-3",
                isActive
                  ? "bg-sidebar-active text-white shadow-lg shadow-blue-500/20"
                  : "text-white/60 hover:bg-sidebar-hover hover:text-white"
              )}
            >
              <Icon size={20} className={clsx("shrink-0", isActive && "text-white")} />
              {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-white/40 capitalize">{userRole}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={clsx(
            "flex items-center w-full px-3 py-2 rounded-lg text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-colors",
            collapsed ? "justify-center" : "gap-3"
          )}
          title="Deconnexion"
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span className="text-sm">Deconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
