"use client";

import { useState, useEffect, useRef } from "react";
import { X, Phone, Clock, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

interface CallPanelProps {
  clientId: number;
  clientName: string;
  phoneNumber: string;
  onClose: () => void;
  onCallCompleted: () => void;
}

const CALL_RESULTS = [
  { value: "NRP", label: "NRP", icon: "⚪", color: "orange" },
  { value: "A_RAPPELER", label: "À rappeler", icon: "📞", color: "amber" },
  { value: "RDV_PRIS", label: "RDV pris", icon: "✓", color: "green" },
  { value: "RDV_CONFIRMÉ", label: "RDV Confirmé", icon: "⏰", color: "blue" },
  { value: "PAS_INTERESSE", label: "Pas intéressé", icon: "✗", color: "red" },
  { value: "FAUX_NUMERO", label: "Faux numéro", icon: "⚠", color: "gray" },
];

export default function CallPanel({ clientId, clientName, phoneNumber, onClose, onCallCompleted }: CallPanelProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedResult, setSelectedResult] = useState("");
  const [comment, setComment] = useState("");
  const [rappelDate, setRappelDate] = useState("");
  const [rappelTime, setRappelTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isCallActive) {
      timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartCall = () => {
    setIsCallActive(true);
    setCallDuration(0);
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleCompleteCall = async () => {
    setError("");
    if (!selectedResult) {
      setError("Veuillez sélectionner un résultat d'appel");
      return;
    }
    if (selectedResult !== "NRP" && selectedResult !== "FAUX_NUMERO" && !comment.trim()) {
      setError("Un commentaire est requis pour ce type d'appel");
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const callTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const res = await fetch("/api/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, result: selectedResult, comment: comment.trim() || null, callTime, duration: callDuration }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }
      if (selectedResult === "A_RAPPELER" && rappelDate && rappelTime) {
        await fetch(`/api/clients/${clientId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rappelDate: new Date(rappelDate), rappelTime }),
        });
      }
      onCallCompleted();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  useEffect(() => {
    if (selectedResult === "A_RAPPELER" && !rappelDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setRappelDate(tomorrow.toISOString().split("T")[0]);
      setRappelTime("14:00");
    }
  }, [selectedResult, rappelDate]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full sm:w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-secondary">Appel en cours</h3>
              <p className="text-sm text-muted">{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-bg rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-secondary mb-3 tracking-wider">{phoneNumber}</p>
            {!isCallActive ? (
              <button onClick={handleStartCall} className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
                <Phone size={20} />
                Appeler
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse" />
                <span className="font-semibold">Appel en cours...</span>
              </div>
            )}
          </div>
          {isCallActive && (
            <div className="bg-bg rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted">
                <Clock size={18} />
                <span className="text-sm font-medium">Durée</span>
              </div>
              <span className="text-2xl font-mono font-bold text-primary">{formatDuration(callDuration)}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">
              🎯 Résultat de l'appel <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CALL_RESULTS.map((result) => (
                <button key={result.value} onClick={() => setSelectedResult(result.value)} className={clsx("p-3 rounded-lg border-2 transition-all text-left", selectedResult === result.value ? "border-primary bg-primary/10 shadow-md" : "border-border hover:border-border/60 hover:bg-bg")}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{result.icon}</span>
                    <span className={clsx("text-sm font-medium", selectedResult === result.value ? "text-secondary" : "text-muted")}>{result.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">
              📝 Note d'appel
              {selectedResult && selectedResult !== "NRP" && selectedResult !== "FAUX_NUMERO" && <span className="text-danger ml-1">*</span>}
            </label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Détails de la conversation, points importants..." className="w-full px-4 py-3 bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" rows={4} />
            <p className="text-xs text-muted mt-1">{comment.length}/500 caractères</p>
          </div>
          {selectedResult === "A_RAPPELER" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">Programmer un rappel</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-amber-700 mb-1 block">Date</label>
                  <input type="date" value={rappelDate} onChange={(e) => setRappelDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
                <div>
                  <label className="text-xs text-amber-700 mb-1 block">Heure</label>
                  <input type="time" value={rappelTime} onChange={(e) => setRappelTime(e.target.value)} className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border bg-bg/50 flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-3 border border-border rounded-lg font-medium text-secondary hover:bg-card transition-colors disabled:opacity-50">Annuler</button>
          <button onClick={handleCompleteCall} disabled={saving || !selectedResult} className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Enregistrement...
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                Terminer l'appel
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
