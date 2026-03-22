"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, MapPin, User, Clock, ChevronDown, ChevronUp, MessageSquare, FileText, X, ExternalLink } from "lucide-react";
import clsx from "clsx";

interface RDVCardProps {
  client: any;
  compact: boolean;
  statuses: any[];
  onStatusChanged?: () => void;
  onOpenClient?: (clientId: number) => void;
}

export default function RDVCard({ client, compact, statuses, onStatusChanged, onOpenClient }: RDVCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const statusObj = statuses.find(
    (s) => s.name === client.statusCall && s.type === "statut1"
  );
  const statusColor = statusObj?.color || "#94a3b8";

  const getBorderColor = () => {
    if (client.statusCall === "RDV CONFIRMÉ") return "border-l-green-500";
    if (client.statusCall === "RDV PRIS") return "border-l-blue-500";
    if (client.statusCall === "A RAPPELER") return "border-l-yellow-500";
    if (client.statusCall === "NRP") return "border-l-orange-500";
    return "border-l-gray-300";
  };

  const handleQuickStatus = async (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    if (newStatus === client.statusCall) {
      setShowStatusMenu(false);
      return;
    }
    setUpdating(true);
    setShowStatusMenu(false);
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusCall: newStatus }),
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setUpdating(false);
    }
  };

  const statut1List = statuses.filter((s) => s.type === "statut1");

  if (compact) {
    return (
      <div
        className={clsx(
          "bg-white rounded-lg border border-border border-l-4 p-2 hover:shadow-md transition-shadow cursor-pointer",
          getBorderColor(),
          updating && "opacity-60"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-secondary truncate">
            {client.lastName} {client.firstName}
          </p>
          {client.rdvTime && (
            <span className="text-[10px] text-muted font-mono shrink-0">{client.rdvTime}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1 relative">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white cursor-pointer hover:opacity-80"
            style={{ backgroundColor: statusColor }}
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
          >
            {client.statusCall || "—"}
          </span>
          <ChevronDown
            size={10}
            className="text-muted cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
          />
          {showStatusMenu && (
            <StatusDropdown
              statuses={statut1List}
              current={client.statusCall}
              onSelect={handleQuickStatus}
              onClose={() => setShowStatusMenu(false)}
            />
          )}
        </div>
      </div>
    );
  }

  const hasComments = client.infosRDV || client.rapportCommerciale;

  return (
    <>
      <div
        ref={cardRef}
        onClick={() => setShowPopover(true)}
        className={clsx(
          "bg-white rounded-lg border border-border border-l-4 p-3 hover:shadow-md transition-all cursor-pointer space-y-1.5 relative",
          getBorderColor(),
          updating && "opacity-60",
          showPopover && "ring-2 ring-blue-500"
        )}
      >
      {/* Status badge + time + comments indicator */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex items-center gap-1">
          <span
            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: statusColor }}
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
          >
            {client.statusCall || "—"}
          </span>
          <ChevronDown
            size={12}
            className="text-muted cursor-pointer hover:text-secondary"
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
          />
          {showStatusMenu && (
            <StatusDropdown
              statuses={statut1List}
              current={client.statusCall}
              onSelect={handleQuickStatus}
              onClose={() => setShowStatusMenu(false)}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {client.rdvTime && (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Clock size={10} /> {client.rdvTime}
            </span>
          )}
          {hasComments && (
            <MessageSquare size={12} className="text-blue-500" />
          )}
        </div>
      </div>

      {/* Client name */}
      <p className="text-sm font-semibold text-secondary">
        {client.lastName} {client.firstName}
        {client.zipCode && (
          <span className="text-xs text-muted font-normal ml-1">{client.zipCode}</span>
        )}
      </p>

      {/* Phone */}
      {client.mobile && (
        <p className="flex items-center gap-1 text-xs text-muted">
          <Phone size={10} />
          <a
            href={`tel:${client.mobile}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-primary hover:underline"
          >
            {client.mobile}
          </a>
        </p>
      )}

      {/* Address */}
      {(client.address || client.city) && (
        <p className="flex items-center gap-1 text-xs text-muted truncate">
          <MapPin size={10} />
          {client.address && <span className="truncate">{client.address}</span>}
          {client.city && <span>, {client.city}</span>}
        </p>
      )}

      {/* Team */}
      {client.telepos && (
        <p className="flex items-center gap-1 text-xs text-muted">
          <User size={10} /> {client.telepos.name}
        </p>
      )}

      {/* Status RDV */}
      {client.statusRDV && (
        <span
          className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white"
          style={{
            backgroundColor:
              statuses.find((s) => s.name === client.statusRDV && s.type === "statut2")?.color ||
              "#64748b",
          }}
        >
          {client.statusRDV}
        </span>
      )}

    </div>

      {/* Popover détails RDV (style Google Agenda) */}
      {showPopover && (
        <>
          {/* Backdrop pour fermer */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />

          {/* Bulle de détails */}
          <div className="fixed z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500 w-96 max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
               style={{
                 top: cardRef.current ? `${cardRef.current.getBoundingClientRect().top}px` : '50%',
                 left: cardRef.current ? `${cardRef.current.getBoundingClientRect().right + 10}px` : '50%',
               }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-lg">
                  {client.firstName} {client.lastName}
                </h3>
                {client.rdvTime && (
                  <p className="text-sm text-blue-100 flex items-center gap-1 mt-1">
                    <Clock size={14} /> {client.rdvTime}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowPopover(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Infos contact */}
              <div className="space-y-2">
                {client.mobile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-gray-500" />
                    <a href={`tel:${client.mobile}`} className="text-blue-600 hover:underline">
                      {client.mobile}
                    </a>
                  </div>
                )}
                {(client.address || client.city) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={14} className="text-gray-500" />
                    <span className="text-gray-700">
                      {client.address && <>{client.address}, </>}
                      {client.city}
                    </span>
                  </div>
                )}
                {client.telepos && (
                  <div className="flex items-center gap-2 text-sm">
                    <User size={14} className="text-gray-500" />
                    <span className="text-gray-700">{client.telepos.name}</span>
                  </div>
                )}
              </div>

              {/* Statuts */}
              <div className="flex gap-2 flex-wrap">
                {client.statusCall && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: statuses.find(s => s.name === client.statusCall)?.color + '20' || '#e5e7eb',
                          color: statuses.find(s => s.name === client.statusCall)?.color || '#6b7280'
                        }}>
                    {client.statusCall}
                  </span>
                )}
                {client.statusRDV && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: statuses.find(s => s.name === client.statusRDV)?.color + '20' || '#e5e7eb',
                          color: statuses.find(s => s.name === client.statusRDV)?.color || '#6b7280'
                        }}>
                    {client.statusRDV}
                  </span>
                )}
              </div>

              {/* Commentaires */}
              {client.infosRDV && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={16} className="text-blue-600" />
                    <p className="text-sm font-bold text-blue-700">
                      Infos RDV (Téléprospecteur)
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {client.infosRDV}
                  </p>
                </div>
              )}

              {client.rapportCommerciale && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-green-600" />
                    <p className="text-sm font-bold text-green-700">
                      Rapport Commercial
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {client.rapportCommerciale}
                  </p>
                </div>
              )}

              {/* Bouton ouvrir fiche complète */}
              {onOpenClient && (
                <button
                  onClick={() => {
                    setShowPopover(false);
                    onOpenClient(client.id);
                  }}
                  className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <ExternalLink size={16} />
                  Ouvrir la fiche complète
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function StatusDropdown({
  statuses,
  current,
  onSelect,
  onClose,
}: {
  statuses: any[];
  current: string;
  onSelect: (e: React.MouseEvent, status: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-xl z-50 py-1 min-w-[140px] max-h-48 overflow-y-auto">
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={(e) => onSelect(e, s.name)}
            className={clsx(
              "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bg transition-colors text-xs",
              s.name === current && "bg-primary/5 font-bold"
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
