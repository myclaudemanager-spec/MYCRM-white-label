"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        if (e.key !== "Escape") return;
      }
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.altKey ? e.altKey : !e.altKey;
        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

export function useGlobalShortcuts() {
  const router = useRouter();
  const shortcuts: Shortcut[] = [
    { key: "1", ctrlKey: true, action: () => router.push("/dashboard"), description: "Aller au Dashboard" },
    { key: "2", ctrlKey: true, action: () => router.push("/clients"), description: "Aller aux Clients" },
    { key: "3", ctrlKey: true, action: () => router.push("/planning"), description: "Aller au Planning" },
    { key: "4", ctrlKey: true, action: () => router.push("/factures"), description: "Aller aux Factures" },
    { key: "5", ctrlKey: true, action: () => router.push("/actions"), description: "Aller aux Actions" },
    { key: "/", action: () => {
        const searchInput = document.querySelector('input[placeholder*="Rechercher"]') as HTMLInputElement;
        searchInput?.focus();
      }, description: "Focus recherche" },
  ];
  useKeyboardShortcuts(shortcuts);
}
