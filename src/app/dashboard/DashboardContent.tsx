"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  FileSignature,
  TrendingUp,
  Phone,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  LogIn,
  Edit,
  ArrowRightLeft,
  UserPlus,
  Euro,
  Trophy,
  MapPin,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import ClientModal from "../clients/ClientModal";

interface DashboardContentProps {
  userRole: string;
}

export default function DashboardContent({ userRole }: DashboardContentProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const fetchData = () => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
              <div className="h-3 bg-border/50 rounded w-20 mb-3" />
              <div className="h-7 bg-border/50 rounded w-14 mb-2" />
              <div className="h-3 bg-border/30 rounded w-28" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse h-60" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const pipeline = data?.pipeline || [];
  const quick = data?.quickActions || {};
  const activities = data?.activities || [];
  const rdvTodayList = data?.rdvTodayList || [];
  const statusChart = data?.statusChart || [];
  const performers = data?.performers || [];

  const ACTION_ICONS: Record<string, React.ReactNode> = {
    connexion: <LogIn size={14} className="text-blue-500" />,
    modification: <Edit size={14} className="text-orange-500" />,
    changement_statut: <ArrowRightLeft size={14} className="text-purple-500" />,
    creation: <UserPlus size={14} className="text-green-500" />,
  };

  // Status chart max for bar sizing
  const maxStatusCount = Math.max(...statusChart.map((s: any) => s.count), 1);

  // Status color map
  const STATUS_COLORS: Record<string, string> = {
    "NEW": "#3b82f6",
    "NRP": "#f97316",
    "A RAPPELER": "#f59e0b",
    "RDV PRIS": "#3b82f6",
    "RDV CONFIRMÉ": "#06b6d4",
    "PAS INTERESSE": "#ef4444",
    "FAUX NUMERO": "#dc2626",
    "ANNULATION": "#991b1b",
  };

  return (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clients */}
        <div
          className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => router.push("/clients")}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Total Clients</p>
              <p className="text-2xl font-bold mt-1 text-secondary">{stats.totalClients || 0}</p>
              {stats.clientsChange && (
                <p className="text-xs mt-1 text-success font-medium flex items-center gap-0.5">
                  <ArrowUpRight size={12} /> {stats.clientsChange}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={20} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* RDV cette semaine */}
        <div
          className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => router.push("/planning")}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">RDV semaine</p>
              <p className="text-2xl font-bold mt-1 text-secondary">{stats.rdvThisWeek || 0}</p>
              <p className="text-xs mt-1 text-cyan-600 font-medium">
                {stats.rdvConfirmedThisWeek || 0} confirmés
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar size={20} className="text-green-600" />
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Signatures</p>
              <p className="text-2xl font-bold mt-1 text-secondary">{stats.signaturesThisMonth || 0}</p>
              {stats.signatureChange && (
                <p className={clsx("text-xs mt-1 font-medium flex items-center gap-0.5",
                  stats.signatureChange.startsWith("+") ? "text-success" : "text-danger"
                )}>
                  {stats.signatureChange.startsWith("+") ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {stats.signatureChange}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSignature size={20} className="text-amber-600" />
            </div>
          </div>
        </div>

        {/* Taux de conversion */}
        <div className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider">Conversion</p>
              <p className="text-2xl font-bold mt-1 text-secondary">{stats.conversionRate || 0}%</p>
              <p className="text-xs mt-1 text-muted">RDV → Signature</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Pipeline + Quick Actions + RDV Today */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline Commercial — Full Funnel */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Pipeline Commercial</h3>
            <span className="text-xs text-muted">{stats.totalClients} total</span>
          </div>
          <div className="space-y-2.5">
            {pipeline.map((stage: any) => (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="text-xs text-muted w-24 shrink-0 text-right">{stage.label}</span>
                <div className="flex-1 bg-bg rounded-full h-7 overflow-hidden relative">
                  <div
                    className={`h-full ${stage.color} rounded-full flex items-center pr-2.5 transition-all duration-500`}
                    style={{ width: stage.width, minWidth: "32px" }}
                  >
                    <span className="text-[11px] font-bold text-white ml-auto">{stage.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Actions rapides</h3>
          <div className="space-y-1.5">
            {[
              { icon: <Sparkles size={16} />, label: "Nouveaux (NEW)", count: quick.new || 0, color: "text-blue-600", bg: "bg-blue-50", filter: "NEW" },
              { icon: <Phone size={16} />, label: "À rappeler", count: quick.aRappeler || 0, color: "text-orange-600", bg: "bg-orange-50", filter: "A RAPPELER" },
              { icon: <Clock size={16} />, label: "RDV aujourd'hui", count: quick.rdvToday || 0, color: "text-cyan-600", bg: "bg-cyan-50", link: "/planning" },
              { icon: <CheckCircle size={16} />, label: "À confirmer", count: quick.aConfirmer || 0, color: "text-green-600", bg: "bg-green-50", filter: "RDV PRIS" },
              { icon: <AlertTriangle size={16} />, label: "NRP", count: quick.nrp || 0, color: "text-red-600", bg: "bg-red-50", filter: "NRP" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  if (action.link) {
                    router.push(action.link);
                  } else if (action.filter) {
                    router.push(`/clients?statusCall=${encodeURIComponent(action.filter)}`);
                  }
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg transition-colors text-left group"
              >
                <div className={`p-2 rounded-lg ${action.bg} ${action.color}`}>
                  {action.icon}
                </div>
                <span className="flex-1 text-sm font-medium text-secondary">{action.label}</span>
                <span className="text-lg font-bold text-secondary">{action.count}</span>
                <ChevronRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: RDV Today + Status Distribution + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* RDV Aujourd'hui */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
              RDV aujourd'hui
            </h3>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {rdvTodayList.length}
            </span>
          </div>
          {rdvTodayList.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Aucun RDV aujourd'hui</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {rdvTodayList.map((rdv: any) => (
                <div
                  key={rdv.id}
                  onClick={() => setSelectedClientId(rdv.id)}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg cursor-pointer transition-colors border border-transparent hover:border-border"
                >
                  <div className="text-center shrink-0">
                    <p className="text-xs font-bold text-primary">{rdv.rdvTime || "—"}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">
                      {rdv.lastName} {rdv.firstName}
                    </p>
                    {rdv.city && (
                      <p className="text-[11px] text-muted flex items-center gap-1">
                        <MapPin size={9} /> {rdv.city}
                      </p>
                    )}
                  </div>
                  <StatusBadge name={rdv.statusCall} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
            Répartition statuts
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {statusChart.slice(0, 8).map((s: any) => (
              <div key={s.name} className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[s.name] || "#94a3b8" }}
                />
                <span className="text-xs text-muted flex-1 truncate">{s.name}</span>
                <div className="w-20 h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((s.count / maxStatusCount) * 100)}%`,
                      backgroundColor: STATUS_COLORS[s.name] || "#94a3b8",
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-secondary w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Top Télépos (mois)
            </h3>
          </div>
          {performers.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Aucune donnée</p>
          ) : (
            <div className="space-y-2.5">
              {performers.map((p: any, i: number) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-gray-100 text-gray-600" :
                    i === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-bg text-muted"
                  )}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-secondary truncate">{p.name}</span>
                  <span className="text-sm font-bold text-primary">{p.count} RDV</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent Activities */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Dernières activités</h3>
          <button
            onClick={() => router.push("/actions")}
            className="text-xs text-primary hover:underline font-medium"
          >
            Voir tout
          </button>
        </div>
        <div className="space-y-1">
          {activities.length > 0 ? activities.map((activity: any, i: number) => (
            <div
              key={i}
              className={clsx(
                "flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0 rounded-lg px-2 -mx-2 transition-colors",
                activity.clientId && "cursor-pointer hover:bg-bg"
              )}
              onClick={() => activity.clientId && setSelectedClientId(activity.clientId)}
            >
              <div className="mt-0.5 shrink-0">
                {ACTION_ICONS[activity.type] || <Edit size={14} className="text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-secondary">{activity.user}</span>{" "}
                  <span className="text-muted">{activity.action}</span>{" "}
                  {activity.target && <span className="font-medium text-primary">{activity.target}</span>}
                </p>
                {activity.detail && (
                  <p className="text-xs text-purple-600 font-medium mt-0.5">{activity.detail}</p>
                )}
              </div>
              <span className="text-[11px] text-muted whitespace-nowrap shrink-0">{activity.time}</span>
            </div>
          )) : (
            <p className="text-sm text-muted py-6 text-center">Aucune activité récente</p>
          )}
        </div>
      </div>

      {/* Client Modal */}
      {selectedClientId && (
        <ClientModal
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onSaved={() => { setSelectedClientId(null); fetchData(); }}
          userRole={userRole}
        />
      )}
    </div>
  );
}

function StatusBadge({ name }: { name: string | null }) {
  if (!name) return null;
  const COLORS: Record<string, string> = {
    "NEW": "#3b82f6",
    "RDV CONFIRMÉ": "#06b6d4",
    "RDV PRIS": "#3b82f6",
    "A RAPPELER": "#f59e0b",
    "NRP": "#f97316",
  };
  return (
    <span
      className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: COLORS[name] || "#94a3b8" }}
    >
      {name}
    </span>
  );
}
