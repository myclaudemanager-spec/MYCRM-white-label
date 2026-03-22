"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, User as UserIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  createdAt: string;
  type: string;
  title: string;
  message: string;
  clientId: number | null;
  read: boolean;
  client: { id: number; firstName: string | null; lastName: string | null } | null;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [latestNotif, setLatestNotif] = useState<Notification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  // Initialiser l'audio au montage
  useEffect(() => {
    // Essayer de charger le fichier audio
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;

    // Si le fichier n'existe pas, on utilisera la Web Audio API
    audioRef.current.addEventListener('error', () => {
      audioRef.current = null; // Fallback vers Web Audio API
    });
  }, []);

  // Fonction pour jouer un son de cloche avec Web Audio API (fallback)
  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Son de cloche agréable (2 notes)
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.3;

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);

      // Deuxième note
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 600;
        gain2.gain.value = 0.3;
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.15);
      }, 100);
    } catch (e) {
      // Silencieux si Web Audio API n'est pas supporté
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const newNotifications = data.notifications || [];
        const newUnreadCount = data.unreadCount || 0;

        // Détecter nouveau lead (unreadCount a augmenté)
        if (newUnreadCount > prevUnreadCount && prevUnreadCount > 0) {
          // Nouveau lead détecté !
          const latestUnread = newNotifications.find((n: Notification) => !n.read);

          if (latestUnread) {
            setLatestNotif(latestUnread);
            setShowToast(true);

            // Jouer le son de cloche
            if (audioRef.current) {
              audioRef.current.play().catch(() => {
                // Fallback: utiliser Web Audio API
                playBeepSound();
              });
            } else {
              // Pas de fichier audio, utiliser Web Audio API
              playBeepSound();
            }

            // Cacher le toast après 5 secondes
            setTimeout(() => setShowToast(false), 5000);
          }
        }

        setNotifications(newNotifications);
        setPrevUnreadCount(unreadCount);
        setUnreadCount(newUnreadCount);
      }
    } catch {
      // silent
    }
  }, [prevUnreadCount, unreadCount]);

  // Polling toutes les 5 secondes pour notifications temps réel
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const markAsRead = async (id: number) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    fetchNotifications();
  };

  const handleNotifClick = (notif: Notification) => {
    if (!notif.read) markAsRead(notif.id);
    setOpen(false);
    if (notif.clientId) {
      router.push(`/clients?openClient=${notif.clientId}`);
    }
  };

  const typeIcon: Record<string, string> = {
    new_lead: "🆕",
    assigned: "👤",
    rappel: "🔔",
  };

  const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  return (
    <>
      {/* Toast notification en haut de l'écran */}
      {showToast && latestNotif && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
          <div className="bg-card border-2 border-primary rounded-xl shadow-2xl p-4 min-w-[320px] max-w-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0 animate-bounce">
                {typeIcon[latestNotif.type] || "📌"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-secondary">
                  {latestNotif.title}
                </p>
                <p className="text-sm text-muted mt-1">
                  {latestNotif.message}
                </p>
                {latestNotif.client && (
                  <p className="text-xs text-primary mt-2 flex items-center gap-1">
                    <UserIcon size={12} />
                    {latestNotif.client.firstName} {latestNotif.client.lastName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="p-1 hover:bg-bg rounded transition-colors shrink-0"
              >
                <X size={16} className="text-muted" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-bg transition-colors"
      >
        <Bell size={18} className="text-muted" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-secondary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors"
              >
                <CheckCheck size={14} />
                Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aucune notification</p>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg transition-colors border-b border-border/50 last:border-0 ${
                    !notif.read ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Icon */}
                  <span className="text-lg shrink-0 mt-0.5">
                    {typeIcon[notif.type] || "📌"}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        notif.read ? "text-muted" : "text-secondary font-medium"
                      }`}
                    >
                      {notif.title}
                    </p>
                    {notif.client && (
                      <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                        <UserIcon size={10} />
                        {notif.client.firstName} {notif.client.lastName}
                      </p>
                    )}
                    <p className="text-[11px] text-muted mt-0.5">{timeAgo(notif.createdAt)}</p>
                  </div>

                  {/* Read indicator */}
                  {!notif.read && (
                    <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                  )}
                  {notif.read && (
                    <Check size={14} className="text-muted/30 shrink-0 mt-1" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>

      {/* Styles d'animation */}
      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
