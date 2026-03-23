"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar, Filter, X, Plus, Clock, MessageSquare, FileText, ExternalLink, Mail, MapPin, Phone, User } from "lucide-react";
import clsx from "clsx";
import ClientModal from "../clients/ClientModal";
import CreateRDVModal from "@/components/planning/CreateRDVModal";

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_NAMES_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTH_NAMES = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7 to 23
const DEFAULT_PX = 1.5; // fallback desktop

function getMonday(date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const utc = new Date(Date.UTC(y, m, d));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc;
}

function formatDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function timeToMinutes(time: string | null): number {
  if (!time) return 0;
  const normalized = time.replace(/[hH]/, ':');
  const parts = normalized.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function getEventPosition(time: string | null, duration: number, px: number): { top: number; height: number } {
  if (!time) return { top: 0, height: duration * px };
  const minutes = timeToMinutes(time);
  return {
    top: (minutes - 7 * 60) * px,
    height: Math.max(duration * px, 40),
  };
}

function getCurrentTimePosition(px: number): number {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes() - 7 * 60) * px;
}

interface PlanningViewProps {
  userRole?: string;
  userId?: number;
}

interface PlanningStatus {
  id: number;
  type: string;
  name: string;
  color: string;
  [key: string]: unknown;
}

interface PlanningClient {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  mobile?: string | null;
  phone1?: string | null;
  city?: string | null;
  rdvTime?: string | null;
  rdvDate?: string | null;
  rdvDuration?: number | null;
  statusCall?: string | null;
  statusRDV?: string | null;
  rappelDate?: string | null;
  rappelTime?: string | null;
  [key: string]: unknown;
}

export default function PlanningView({ userRole = "admin", userId }: PlanningViewProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [days, setDays] = useState<Record<string, PlanningClient[]>>({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [statuses, setStatuses] = useState<PlanningStatus[]>([]);
  const [statusCallFilter, setStatusCallFilter] = useState("");
  const [statusRDVFilter, setStatusRDVFilter] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [popoverClient, setPopoverClient] = useState<PlanningClient | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pxPerMin, setPxPerMin] = useState(DEFAULT_PX);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [showCreateRDV, setShowCreateRDV] = useState(false);
  const hourHeight = 60 * pxPerMin;

  const [showWeekend, setShowWeekend] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('planning-show-weekend') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setViewMode("day");
      setPxPerMin(0.8);
      const today = new Date();
      setWeekStart(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
    }
    setCurrentTimePosition(getCurrentTimePosition(isMobile ? 0.8 : DEFAULT_PX));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('planning-show-weekend', String(showWeekend));
  }, [showWeekend]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTimePosition(getCurrentTimePosition(pxPerMin)), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPlanning = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      weekStart: formatDateKey(weekStart),
      statusCall: statusCallFilter,
      statusRDV: statusRDVFilter,
    });
    if (userRole === "commercial" && userId) {
      params.set("commercialId", String(userId));
    }
    const res = await fetch(`/api/planning?${params}`);
    const data = await res.json();
    setDays(data.days || {});
    setLoading(false);
  }, [weekStart, statusCallFilter, statusRDVFilter, userRole, userId]);

  useEffect(() => { fetchPlanning(); }, [fetchPlanning]);
  useEffect(() => {
    fetch("/api/statuses").then((r) => r.json()).then((data) => setStatuses(data.statuses || []));
  }, []);

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) navigate(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const navigate = (delta: number) => {
    const d = new Date(weekStart);
    if (viewMode === "day") d.setUTCDate(d.getUTCDate() + delta);
    else if (viewMode === "month") d.setUTCMonth(d.getUTCMonth() + delta);
    else d.setUTCDate(d.getUTCDate() + delta * 7);
    setWeekStart(d);
  };

  const goToToday = () => {
    if (viewMode === "day") {
      const today = new Date();
      setWeekStart(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
    } else {
      setWeekStart(getMonday(new Date()));
    }
  };

  let numDays: number;
  let weekDays: Date[];
  if (viewMode === "day") {
    numDays = 1;
    weekDays = [weekStart];
  } else {
    numDays = showWeekend ? 7 : 5;
    weekDays = Array.from({ length: numDays }, (_, i) => {
      const d = new Date(weekStart); d.setUTCDate(d.getUTCDate() + i); return d;
    });
  }

  const today = getTodayKey();
  const weekMonth = MONTH_NAMES[weekStart.getUTCMonth()];
  const weekYear = weekStart.getUTCFullYear();
  let periodTitle = `${weekMonth} ${weekYear}`;
  if (viewMode === "day") {
    periodTitle = `${DAY_NAMES_FULL[(weekStart.getUTCDay() + 6) % 7]} ${weekStart.getUTCDate()} ${weekMonth}`;
  }

  const totalRDV = Object.values(days).reduce((sum, arr) => sum + arr.length, 0);
  const totalConfirmed = Object.values(days).flat().filter((c) => c.statusCall === "RDV CONFIRMÉ").length;
  const statut1List = statuses.filter((s) => s.type === "statut1");
  const statut2List = statuses.filter((s) => s.type === "statut2");

  const getStatusColor = (statusCall: string): string => {
    const statusObj = statuses.find((s) => s.name === statusCall && s.type === "statut1");
    return statusObj?.color || "#3b82f6";
  };

  const isTodayInWeek = weekDays.some(day => formatDateKey(day) === today);

  // Score badge color
  const getScoreBadge = (score: number | null) => {
    if (score == null) return null;
    let bg = "bg-red-100 text-red-700";
    if (score >= 75) bg = "bg-green-100 text-green-800";
    else if (score >= 50) bg = "bg-lime-100 text-lime-800";
    else if (score >= 30) bg = "bg-orange-100 text-orange-800";
    return <span className={`${bg} text-[9px] font-bold px-1.5 py-0.5 rounded-full`}>{score}</span>;
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Top Bar */}
      <div className="flex-shrink-0 bg-white border-b border-border px-3 sm:px-6 py-2 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={goToToday} className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border border-border rounded-lg hover:bg-gray-50 transition-colors">
              Aujourd'hui
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
              <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={20} /></button>
            </div>
            <h2 className="text-base sm:text-xl font-semibold text-gray-900">{periodTitle}</h2>
            <span className="hidden sm:inline text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {totalRDV} RDV · {totalConfirmed} confirmes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1">
              {(["day", "week", "month"] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={clsx("px-3 py-1.5 rounded text-sm font-medium transition-all",
                    viewMode === mode ? "bg-blue-500 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                  )}>
                  {mode === "day" ? "Jour" : mode === "week" ? "Semaine" : "Mois"}
                </button>
              ))}
            </div>
            {viewMode === "week" && (
              <button onClick={() => setShowWeekend(!showWeekend)}
                className={clsx("px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all",
                  !showWeekend ? "bg-blue-500 text-white border-blue-500 shadow-sm" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}>
                <span className="hidden sm:inline">{showWeekend ? "Semaine + WE" : "Semaine"}</span><span className="sm:hidden">{showWeekend ? "WE" : "WE"}</span>
              </button>
            )}
            <button onClick={() => setShowFilters(!showFilters)}
              className={clsx("flex items-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all",
                showFilters ? "bg-blue-500 text-white border-blue-500 shadow-sm" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              )}>
              <Filter size={16} /><span className="hidden sm:inline">Filtres</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4 flex-wrap">
            <div>
              <label className="text-xs text-gray-600 block mb-1.5 font-medium">Statut Call</label>
              <select value={statusCallFilter} onChange={(e) => setStatusCallFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                <option value="">Tous</option>
                {statut1List.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1.5 font-medium">Statut RDV</label>
              <select value={statusRDVFilter} onChange={(e) => setStatusRDVFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                <option value="">Tous</option>
                {statut2List.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={() => { setStatusCallFilter(""); setStatusRDVFilter(""); }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5">
              <X size={16} /> Reinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto relative" ref={scrollRef}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className={viewMode === "day" ? "" : "md:min-w-[1000px]"}>
          {/* Header: Days */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${numDays}, 1fr)` }}>
              <div className="border-r border-gray-200"></div>
              {weekDays.map((day) => {
                const key = formatDateKey(day);
                const isToday = key === today;
                const dayCount = (days[key] || []).length;
                return (
                  <div key={key} className={clsx("py-2 text-center border-r border-gray-200", isToday && "bg-blue-50")}>
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {DAY_NAMES[(day.getUTCDay() + 6) % 7]}
                    </div>
                    <div className={clsx("mt-0.5 text-xl font-bold inline-flex items-center justify-center w-9 h-9 rounded-full",
                      isToday ? "bg-blue-500 text-white" : "text-gray-900"
                    )}>
                      {day.getUTCDate()}
                    </div>
                    {dayCount > 0 && (
                      <div className="mt-0.5">
                        <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          isToday ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                        )}>
                          {dayCount} RDV
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body: Hours and Events */}
          <div className="relative">
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${numDays}, 1fr)` }}>
              {/* Time labels */}
              <div className="relative">
                {HOURS.map((hour) => (
                  <div key={hour} className="border-r border-gray-200 pr-2 text-right text-[11px] text-gray-400 font-medium"
                    style={{ height: `${hourHeight}px`, paddingTop: '2px' }}>
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const key = formatDateKey(day);
                const isToday = key === today;
                const dayClients = days[key] || [];

                return (
                  <div key={key} className="relative border-r border-gray-200">
                    {/* Hour grid + half-hour dashed lines */}
                    {HOURS.map((hour) => (
                      <div key={hour} style={{ height: `${hourHeight}px` }}
                        className={clsx("border-b border-gray-100 relative", isToday && "bg-blue-50/20")}>
                        {/* Half-hour dashed line */}
                        <div className="absolute left-0 right-0 border-b border-dashed border-gray-100"
                          style={{ top: `${hourHeight / 2}px` }} />
                      </div>
                    ))}

                    {/* Events */}
                    {!loading && (() => {
                      const withTime = dayClients.filter((c) => c.rdvTime);
                      const sorted = [...withTime].sort((a, b) => timeToMinutes(a.rdvTime) - timeToMinutes(b.rdvTime));
                      const columns: PlanningClient[][] = [];
                      for (const client of sorted) {
                        const mins = timeToMinutes(client.rdvTime);
                        const dur = parseInt(String(client.rdvDuration)) || 60;
                        let placed = false;
                        for (const col of columns) {
                          const hasOverlap = col.some((c) => {
                            const cStart = timeToMinutes(c.rdvTime);
                            const cDur = parseInt(String(c.rdvDuration)) || 60;
                            return mins < cStart + cDur && cStart < mins + dur;
                          });
                          if (!hasOverlap) { col.push(client); placed = true; break; }
                        }
                        if (!placed) columns.push([client]);
                      }
                      const colCount = columns.length || 1;
                      const clientColIndex = new Map<number, number>();
                      columns.forEach((col, ci) => col.forEach(c => clientColIndex.set(c.id, ci)));

                      return withTime.map((client) => {
                        const duration = parseInt(client.rdvDuration) || 60;
                        const { top, height } = getEventPosition(client.rdvTime, duration, pxPerMin);
                        const color = getStatusColor(client.statusCall || "");
                        const ci = clientColIndex.get(client.id) || 0;
                        const widthPct = 100 / colCount;
                        const leftPct = ci * widthPct;
                        const isCompact = height < 70;

                        return (
                          <div key={client.id}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setPopoverClient(client);
                              const sc = scrollRef.current;
                              const cRect = sc?.getBoundingClientRect();
                              const scrollTop = sc?.scrollTop || 0;
                              const scrollLeft = sc?.scrollLeft || 0;
                              const isMobile = window.innerWidth < 768;
                              setPopoverPosition(isMobile ? {
                                top: rect.bottom - (cRect?.top || 0) + scrollTop + 8, left: 8,
                              } : {
                                top: rect.top - (cRect?.top || 0) + scrollTop,
                                left: Math.min(rect.right + 10 - (cRect?.left || 0) + scrollLeft, (sc?.scrollWidth || window.innerWidth) - 400),
                              });
                            }}
                            className="absolute rounded-md cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all bg-white border border-gray-200 overflow-hidden group"
                            style={{
                              top: `${top}px`,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              height: `${height}px`,
                              borderLeftWidth: '4px',
                              borderLeftColor: color,
                              zIndex: 10,
                            }}
                          >
                            <div className="p-1.5 h-full flex flex-col overflow-hidden">
                              {/* Row 1: Time + Score */}
                              <div className="flex items-center justify-between gap-1 shrink-0">
                                <span className="font-bold text-[11px] text-gray-900">{client.rdvTime}</span>
                                <div className="flex items-center gap-1">
                                  {getScoreBadge(client.leadScore)}
                                  {client.statusRDV && (
                                    <span className="text-[8px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded font-medium truncate max-w-[60px]">{client.statusRDV}</span>
                                  )}
                                </div>
                              </div>
                              {/* Row 2: Name */}
                              <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
                                {client.firstName} {client.lastName}
                              </p>
                              {/* Row 3: Commercial (important for admin) */}
                              {!isCompact && client.commercial1 && (
                                <p className="text-[10px] text-blue-600 font-medium truncate leading-tight">
                                  {client.commercial1.name}
                                </p>
                              )}
                              {/* Row 4: City */}
                              {!isCompact && (client.city || client.zipCode) && (
                                <p className="text-[10px] text-gray-500 truncate leading-tight">
                                  {client.zipCode} {client.city}
                                </p>
                              )}
                              {/* Row 5: Phone (only tall events) */}
                              {height >= 100 && client.mobile && (
                                <p className="text-[10px] text-gray-400 truncate leading-tight">{client.mobile}</p>
                              )}
                              {/* Row 6: Comment preview (only very tall events) */}
                              {height >= 120 && (client.infosRDV || client.observationCommercial) && (
                                <p className="text-[9px] text-gray-400 italic truncate mt-auto leading-tight">
                                  {client.infosRDV || client.observationCommercial}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current time indicator */}
            {isTodayInWeek && currentTimePosition > 0 && (
              <div className="absolute left-16 right-0 z-30 pointer-events-none"
                style={{ top: `${currentTimePosition}px` }}>
                <div className="relative h-0.5 bg-red-500">
                  <div className="absolute -left-2 -top-[5px] w-3 h-3 bg-red-500 rounded-full" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Popover — bottom sheet mobile, positioned desktop */}
        {popoverClient && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 md:bg-transparent" onClick={() => setPopoverClient(null)} />
            <div className={`z-50 bg-white shadow-2xl overflow-y-auto ${
              pxPerMin < 1
                ? "fixed bottom-0 left-0 right-0 rounded-t-2xl border-t border-gray-200 max-h-[85vh]"
                : "absolute rounded-xl border border-gray-200 w-[min(24rem,calc(100vw-2rem))] max-h-[80vh]"
            }`}
              style={pxPerMin >= 1 && popoverPosition ? { top: `${popoverPosition.top}px`, left: `${popoverPosition.left}px` } : {}}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {popoverClient.firstName} {popoverClient.lastName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {popoverClient.rdvTime && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock size={14} /> {popoverClient.rdvTime}
                          {popoverClient.rdvDuration && ` (${popoverClient.rdvDuration}min)`}
                        </span>
                      )}
                      {popoverClient.leadScore != null && getScoreBadge(popoverClient.leadScore)}
                    </div>
                  </div>
                  <button onClick={() => setPopoverClient(null)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <X size={18} />
                  </button>
                </div>
                {/* Status badges */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {popoverClient.statusCall && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: getStatusColor(popoverClient.statusCall) }}>
                      {popoverClient.statusCall}
                    </span>
                  )}
                  {popoverClient.statusRDV && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: (statuses.find((s) => s.name === popoverClient.statusRDV)?.color || '#6b7280') + '20',
                        color: statuses.find((s) => s.name === popoverClient.statusRDV)?.color || '#6b7280',
                      }}>
                      {popoverClient.statusRDV}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                {/* Contact */}
                <div className="space-y-1.5">
                  {popoverClient.mobile && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-gray-400" />
                      <a href={`tel:${popoverClient.mobile}`} className="text-blue-600 hover:underline">{popoverClient.mobile}</a>
                    </div>
                  )}
                  {popoverClient.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-gray-400" />
                      <a href={`mailto:${popoverClient.email}`} className="text-blue-600 hover:underline truncate">{popoverClient.email}</a>
                    </div>
                  )}
                  {(popoverClient.address || popoverClient.city) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="text-gray-700">{popoverClient.address && <>{popoverClient.address}, </>}{popoverClient.zipCode} {popoverClient.city}</span>
                    </div>
                  )}
                  {(popoverClient.telepos || popoverClient.commercial1) && (
                    <div className="flex items-center gap-2 text-sm">
                      <User size={14} className="text-gray-400" />
                      <span className="text-gray-700">
                        {popoverClient.telepos && <><span className="text-gray-400">Telepro:</span> {popoverClient.telepos.name}</>}
                        {popoverClient.telepos && popoverClient.commercial1 && " · "}
                        {popoverClient.commercial1 && <><span className="text-gray-400">Com:</span> <strong>{popoverClient.commercial1.name}</strong></>}
                      </span>
                    </div>
                  )}
                </div>

                {/* Infos foyer */}
                {(popoverClient.electricBill || popoverClient.householdIncome || popoverClient.propertyType) && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-600 mb-1.5 uppercase tracking-wider">Infos Foyer</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                      {popoverClient.electricBill && <p><span className="text-gray-400">Elec:</span> <strong>{popoverClient.electricBill}</strong></p>}
                      {popoverClient.householdIncome && <p><span className="text-gray-400">Rev:</span> <strong>{popoverClient.householdIncome}</strong></p>}
                      {popoverClient.propertyType && <p><span className="text-gray-400">Type:</span> {popoverClient.propertyType}</p>}
                      {popoverClient.surface && <p><span className="text-gray-400">Surface:</span> {popoverClient.surface}m2</p>}
                      {popoverClient.heatingSystem && <p><span className="text-gray-400">Chauffage:</span> {popoverClient.heatingSystem}</p>}
                      {popoverClient.isOwner && <p><span className="text-gray-400">Statut:</span> {popoverClient.isOwner}</p>}
                      {popoverClient.roofOrientation && <p><span className="text-gray-400">Toit:</span> {popoverClient.roofOrientation}</p>}
                      {popoverClient.pool && <p>Piscine</p>}
                      {popoverClient.electricCar && <p>VE</p>}
                      {popoverClient.financing && <p><span className="text-gray-400">Fin:</span> {popoverClient.financing}</p>}
                    </div>
                  </div>
                )}

                {/* Comments */}
                {popoverClient.infosRDV && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider flex items-center gap-1"><MessageSquare size={12} /> Infos RDV</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{popoverClient.infosRDV}</p>
                  </div>
                )}
                {popoverClient.rapportCommerciale && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <p className="text-[10px] font-bold text-green-600 mb-1 uppercase tracking-wider flex items-center gap-1"><FileText size={12} /> Rapport Commercial</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{popoverClient.rapportCommerciale}</p>
                  </div>
                )}
                {popoverClient.observationCommercial && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 mb-1 uppercase tracking-wider flex items-center gap-1"><FileText size={12} /> Observation</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{popoverClient.observationCommercial}</p>
                  </div>
                )}

                <button onClick={() => { setPopoverClient(null); setSelectedClientId(popoverClient.id); }}
                  className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium text-sm">
                  <ExternalLink size={16} /> Ouvrir la fiche complete
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Client Modal */}
      {selectedClientId && (
        <ClientModal clientId={selectedClientId} onClose={() => setSelectedClientId(null)}
          onSaved={() => { setSelectedClientId(null); fetchPlanning(); }} userRole={userRole} />
      )}

      {/* Create RDV Modal */}
      {showCreateRDV && (
        <CreateRDVModal onClose={() => setShowCreateRDV(false)}
          onCreated={() => { setShowCreateRDV(false); fetchPlanning(); }} />
      )}

      {/* FAB */}
      <button onClick={() => setShowCreateRDV(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all flex items-center justify-center group z-40"
        title="Creer un RDV">
        <Plus size={28} className="group-hover:rotate-90 transition-transform" />
      </button>
    </div>
  );
}
