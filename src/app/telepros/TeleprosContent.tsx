"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  phone1: string | null;
  city: string | null;
  zipCode: string | null;
  statusCall: string | null;
  missedCalls: number;
  rappelDate: string | null;
  rappelTime: string | null;
  leadScore: number | null;
  leadPriority: string | null;
  lastCommentText: string | null;
  lastCommentAt: string | null;
  observation: string | null;
}

interface LeaderboardEntry {
  userId: number;
  points: number;
  combos: number;
  user: { name: string };
}

const MEDALS = ["🥇", "🥈", "🥉"];

const COMMENT_SUGGESTIONS = [
  { chips: ["Messagerie", "Pas de réponse", "Raccroche"], cls: "bg-red-100 text-red-700 hover:bg-red-200" },
  { chips: ["À rappeler le matin", "Absent jusqu'à vendredi", "En déplacement"], cls: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { chips: ["Déjà équipé", "Pas propriétaire", "Budget insuffisant"], cls: "bg-gray-100 text-gray-600 hover:bg-gray-200" },
  { chips: ["Propriétaire, maison 120m², intéressé"], cls: "bg-green-100 text-green-700 hover:bg-green-200" },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function speak(name: string | null, city: string | null) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const text = [name, city].filter(Boolean).join(", ");
  if (!text) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "fr-FR";
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

function isRappelToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export default function TeleprosContent() {
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<Lead[]>([]);
  const [idx, setIdx] = useState(0);
  const [cardShownAt, setCardShownAt] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [myPoints, setMyPoints] = useState(0);
  const [myCombos, setMyCombos] = useState(0);
  const [comboFlash, setComboFlash] = useState(false);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [showRdvModal, setShowRdvModal] = useState(false);
  const [showRappelModal, setShowRappelModal] = useState(false);
  const [rdvDate, setRdvDate] = useState("");
  const [rdvTime, setRdvTime] = useState("14:00");
  const [comment, setComment] = useState("");
  const commentOk = comment.trim().length >= 3;
  const [rappelDateFastCall, setRappelDateFastCall] = useState("");
  const [rappelTimeFastCall, setRappelTimeFastCall] = useState("14:00");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [priorityToast, setPriorityToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<Lead[]>([]);

  // Auth
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setMyUserId(d.user.id);
      });
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/telepros/queue");
      const d = await r.json();
      const leads = d.leads || [];
      setQueue(leads);
      queueRef.current = leads;
      setTotal(d.total || 0);
      setIdx(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const r = await fetch("/api/telepros/leaderboard");
    const d = await r.json();
    setLeaderboard(d.leaderboard || []);
  }, []);

  // On mount: only load leaderboard (no auto-start of queue)
  useEffect(() => {
    loadLeaderboard();
    const lb = setInterval(loadLeaderboard, 30_000);
    return () => clearInterval(lb);
  }, [loadLeaderboard]);

  // Poll priorité en arrière-plan pendant la session (toutes les 60s)
  // Utilise queueRef pour éviter de reset le timer à chaque action
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/telepros/queue");
        const d = await r.json();
        const incoming = (d.leads || []) as Lead[];
        const localIds = new Set(queueRef.current.map((l) => l.id));
        // Chercher un lead prioritaire absent de la file locale
        const urgent = incoming.find(
          (l) =>
            (l.statusCall === "NEW" ||
              l.statusCall === "A RAPPELER" ||
              isRappelToday(l.rappelDate)) &&
            !localIds.has(l.id)
        );
        if (urgent) {
          setQueue((prev) => {
            const next = [urgent, ...prev.filter((l) => l.id !== urgent.id)];
            queueRef.current = next;
            return next;
          });
          setIdx(0);
          const isRappel = isRappelToday(urgent.rappelDate);
          setPriorityToast(
            isRappel
              ? `🕐 Rappel du jour : ${urgent.firstName} ${urgent.lastName}`
              : urgent.statusCall === "NEW"
              ? `✨ Nouveau lead : ${urgent.firstName} ${urgent.lastName}`
              : `📞 Rappel prioritaire : ${urgent.firstName} ${urgent.lastName}`
          );
          setTimeout(() => setPriorityToast(null), 5000);
        }
      } catch {
        // Silencieux — ne pas interrompre la session
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [started]); // ← queueRef (ref stable) remplace queue dans les deps

  // Afficher la carte courante + TTS — seulement si session démarrée
  const showCard = useCallback(() => {
    const lead = queue[idx];
    if (!lead) return;
    setCardShownAt(Date.now());
    setElapsed(0);
    setComment("");
    setRappelDateFastCall("");
    setRappelTimeFastCall("14:00");
    speak(lead.firstName, lead.city);
  }, [queue, idx]);

  useEffect(() => {
    if (started && queue.length > 0 && idx < queue.length) showCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue, started]);

  // Timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cardShownAt === 0) return;
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cardShownAt]);

  const handleStart = useCallback(async () => {
    await loadQueue();
    setStarted(true);
  }, [loadQueue]);

  const handleStop = useCallback(() => {
    setStarted(false);
    setQueue([]);
    setIdx(0);
    setCardShownAt(0);
    setElapsed(0);
    setComment("");
    setPriorityToast(null);
    if (timerRef.current) clearInterval(timerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const handleConfirmRdv = useCallback(async () => {
    if (acting || !queue[idx]) return;
    setShowRdvModal(false);
    setActing(true);
    const now = new Date();
    const callTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      const r = await fetch("/api/telepros/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: queue[idx].id,
          result: "RDV_PRIS",
          callTime,
          cardShownAt: new Date(cardShownAt).toISOString(),
          rdvDate,
          rdvTime,
          comment: comment.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMyPoints(d.points);
        setMyCombos(d.combos);
        setLastPoints(d.isCombo ? 2 : 1);
        if (d.isCombo) { setComboFlash(true); setTimeout(() => setComboFlash(false), 1500); }
        setTimeout(() => setLastPoints(null), 1500);
        setTotal(d.nextTotal);
        const nextIdx = idx + 1;
        if (nextIdx >= queue.length) { await loadQueue(); } else { setIdx(nextIdx); }
      }
    } finally { setActing(false); }
  }, [acting, queue, idx, cardShownAt, rdvDate, rdvTime, comment, loadQueue]);

  const handleConfirmRappel = useCallback(async () => {
    if (acting || !queue[idx]) return;
    setShowRappelModal(false);
    setActing(true);
    const now = new Date();
    const callTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      const r = await fetch("/api/telepros/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: queue[idx].id,
          result: "A_RAPPELER",
          callTime,
          cardShownAt: new Date(cardShownAt).toISOString(),
          comment: comment.trim() || undefined,
          rappelDate: rappelDateFastCall,
          rappelTime: rappelTimeFastCall,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMyPoints(d.points);
        setMyCombos(d.combos);
        setLastPoints(d.isCombo ? 2 : 1);
        if (d.isCombo) { setComboFlash(true); setTimeout(() => setComboFlash(false), 1500); }
        setTimeout(() => setLastPoints(null), 1500);
        setTotal(d.nextTotal);
        const nextIdx = idx + 1;
        if (nextIdx >= queue.length) { await loadQueue(); } else { setIdx(nextIdx); }
      }
    } finally { setActing(false); }
  }, [acting, queue, idx, cardShownAt, comment, rappelDateFastCall, rappelTimeFastCall, loadQueue]);

  const handleAction = useCallback(
    async (result: string) => {
      if (acting || !queue[idx]) return;
      if (result === "RDV_PRIS") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRdvDate(tomorrow.toISOString().split("T")[0]);
        setRdvTime("14:00");
        setShowRdvModal(true);
        return;
      }
      if (result === "A_RAPPELER") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRappelDateFastCall(tomorrow.toISOString().split("T")[0]);
        setRappelTimeFastCall("14:00");
        setShowRappelModal(true);
        return;
      }
      setActing(true);
      const now = new Date();
      const callTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      try {
        const r = await fetch("/api/telepros/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: queue[idx].id,
            result,
            callTime,
            cardShownAt: new Date(cardShownAt).toISOString(),
            comment: comment.trim() || undefined,
          }),
        });
        const d = await r.json();
        if (d.success) {
          setMyPoints(d.points);
          setMyCombos(d.combos);
          setLastPoints(d.isCombo ? 2 : 1);
          if (d.isCombo) {
            setComboFlash(true);
            setTimeout(() => setComboFlash(false), 1500);
          }
          setTimeout(() => setLastPoints(null), 1500);
          setTotal(d.nextTotal);

          const nextIdx = idx + 1;
          if (nextIdx >= queue.length) {
            await loadQueue();
          } else {
            setIdx(nextIdx);
          }
        }
      } finally {
        setActing(false);
      }
    },
    [acting, queue, idx, cardShownAt, comment, loadQueue]
  );

  const lead = queue[idx] || null;
  const isComboZone = cardShownAt > 0 && elapsed < 30;
  const rank = leaderboard.findIndex((e) => e.userId === myUserId) + 1;

  // Bordure colorée selon priorité
  const cardBorderClass =
    lead && isRappelToday(lead.rappelDate)
      ? "border-t-4 border-t-purple-500"
      : lead?.statusCall === "NEW"
      ? "border-t-4 border-t-green-400"
      : lead?.statusCall === "A RAPPELER"
      ? "border-t-4 border-t-orange-400"
      : "";

  const hasFiche =
    lead &&
    (lead.leadScore != null ||
      lead.lastCommentText ||
      lead.observation ||
      (lead.rappelTime && isRappelToday(lead.rappelDate)));

  // ── Écran d'accueil (session non démarrée) ──────────────────────────────────
  if (!started) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-10 text-center text-white shadow-lg">
          <div className="text-5xl mb-4">🎮</div>
          <h1 className="text-3xl font-bold mb-2">Fast-Call</h1>
          <p className="text-blue-200 text-sm mb-8">
            Prêt à démarrer votre session d&apos;appels ?
          </p>
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-3 bg-white text-blue-700 font-bold text-lg px-10 py-4 rounded-2xl shadow-md hover:bg-blue-50 active:scale-95 transition-all"
          >
            ▶ Démarrer la session
          </button>
        </div>

        {/* Leaderboard affiché dès l'accueil */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">🏆 Classement du jour</h3>
          {leaderboard.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">Soyez le premier à appeler !</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => {
                const isMe = entry.userId === myUserId;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm ${
                      isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base w-5 text-center">
                        {i < 3 ? MEDALS[i] : `${i + 1}.`}
                      </span>
                      <span className={`font-medium ${isMe ? "text-blue-700" : "text-gray-700"}`}>
                        {isMe ? "Vous" : entry.user.name.split(" ")[0]}
                      </span>
                    </div>
                    <span className="font-bold text-gray-800">
                      {entry.points} <span className="text-gray-400 font-normal text-xs">pts</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Session en cours ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Chargement de la file...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* Toast priorité */}
      {priorityToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-xl text-sm font-bold animate-bounce">
          {priorityToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">🎮 Fast-Call</h1>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {total} leads en attente
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full transition-all ${
              comboFlash
                ? "bg-yellow-300 text-yellow-900 animate-pulse"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {myPoints} pts
          </span>
          <span className="text-sm font-semibold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
            {myCombos} combos 🔥
          </span>
          {rank > 0 && (
            <span className="text-sm text-gray-500">
              #{rank} {rank <= 3 ? MEDALS[rank - 1] : ""}
            </span>
          )}
          {/* Bouton STOP */}
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
          >
            ⏹ Arrêter
          </button>
        </div>
      </div>

      {/* Corps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Carte lead */}
        <div className="lg:col-span-2">
          {lead ? (
            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${cardBorderClass}`}>
              {/* Lead info */}
              <div className="p-6 space-y-4">
                {/* Nom + ville */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Inconnu"}
                    </h2>
                    {isRappelToday(lead.rappelDate) && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold animate-pulse">
                        🕐 RAPPEL
                      </span>
                    )}
                    {!isRappelToday(lead.rappelDate) && lead.statusCall === "NEW" && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold animate-pulse">
                        ✨ NOUVEAU
                      </span>
                    )}
                    {!isRappelToday(lead.rappelDate) && lead.statusCall === "A RAPPELER" && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">
                        📞 À rappeler
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {[lead.zipCode, lead.city].filter(Boolean).join(" — ")}
                  </p>
                </div>

                {/* Téléphones */}
                <div className="flex gap-3 flex-wrap">
                  {lead.mobile && (
                    <a
                      href={`tel:${lead.mobile}`}
                      className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-800 px-4 py-2 rounded-xl font-mono text-sm font-semibold transition-colors"
                    >
                      📱 {lead.mobile}
                    </a>
                  )}
                  {lead.phone1 && lead.phone1 !== lead.mobile && (
                    <a
                      href={`tel:${lead.phone1}`}
                      className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-mono text-sm font-semibold transition-colors"
                    >
                      📞 {lead.phone1}
                    </a>
                  )}
                </div>

                {/* Fiche résumée */}
                {hasFiche && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs text-gray-600">
                    {lead.leadScore != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Score</span>
                        <span
                          className={`font-bold ${
                            lead.leadScore >= 60
                              ? "text-green-600"
                              : lead.leadScore >= 30
                              ? "text-orange-500"
                              : "text-red-500"
                          }`}
                        >
                          {lead.leadScore}/100
                        </span>
                        {lead.leadPriority && (
                          <span className="text-gray-400">— {lead.leadPriority}</span>
                        )}
                      </div>
                    )}
                    {lead.lastCommentText && (
                      <div>
                        <span className="text-gray-400">Dernier commentaire : </span>
                        <span className="text-gray-700 italic">&ldquo;{lead.lastCommentText}&rdquo;</span>
                      </div>
                    )}
                    {lead.observation && (
                      <div>
                        <span className="text-gray-400">Note : </span>
                        <span className="text-gray-700">{lead.observation}</span>
                      </div>
                    )}
                    {lead.rappelTime && isRappelToday(lead.rappelDate) && (
                      <div className="text-purple-700 font-bold">
                        🕐 Rappel programmé à {lead.rappelTime}
                      </div>
                    )}
                  </div>
                )}

                {/* Badges statut */}
                <div className="flex gap-2 flex-wrap">
                  {lead.statusCall &&
                    lead.statusCall !== "NEW" &&
                    lead.statusCall !== "A RAPPELER" && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {lead.statusCall}
                      </span>
                    )}
                  {lead.missedCalls > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">
                      NRP: {lead.missedCalls}×
                    </span>
                  )}
                </div>

                {/* Timer */}
                <div className="flex items-center gap-3">
                  <div
                    className={`text-2xl font-mono font-bold ${
                      isComboZone ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    ⏱ {formatTime(elapsed)}
                  </div>
                  {isComboZone ? (
                    <span className="text-xs text-green-600 font-semibold animate-pulse">
                      &lt; 30s → COMBO +2 🔥
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">+1 pt</span>
                  )}
                </div>

                {/* Feedback combo */}
                {lastPoints !== null && (
                  <div
                    className={`text-center py-2 rounded-xl font-bold text-lg animate-bounce ${
                      lastPoints === 2
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {lastPoints === 2 ? "+2 🔥 COMBO!" : "+1"}
                  </div>
                )}
              </div>

              {/* Commentaire rapide */}
              <div className="px-6 pb-3 space-y-2">
                {/* Chips de suggestions rapides */}
                <div className="flex flex-wrap gap-1.5">
                  {COMMENT_SUGGESTIONS.map((group) =>
                    group.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setComment(chip)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${group.cls} ${comment === chip ? "ring-2 ring-offset-1 ring-current" : ""}`}
                      >
                        {chip}
                      </button>
                    ))
                  )}
                </div>
                {/* Textarea */}
                <div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Commentaire obligatoire (sauf NRP)..."
                    rows={2}
                    className={`w-full px-3 py-2 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-colors ${
                      comment.trim().length === 0
                        ? "border-gray-200 focus:ring-blue-500/20"
                        : commentOk
                        ? "border-green-300 focus:ring-green-500/20"
                        : "border-orange-300 focus:ring-orange-500/20"
                    }`}
                  />
                  {!commentOk && comment.trim().length > 0 && (
                    <p className="text-xs text-orange-500 mt-0.5">Minimum 3 caractères</p>
                  )}
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="px-6 pb-6 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction("NRP")}
                  disabled={acting}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-95"
                >
                  🔴 NRP
                </button>
                <button
                  onClick={() => handleAction("RDV_PRIS")}
                  disabled={acting || !commentOk}
                  title={!commentOk ? "Commentaire obligatoire" : undefined}
                  className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-95"
                >
                  🟢 RDV PRIS
                </button>
                <button
                  onClick={() => handleAction("A_RAPPELER")}
                  disabled={acting || !commentOk}
                  title={!commentOk ? "Commentaire obligatoire" : undefined}
                  className="bg-orange-400 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-95"
                >
                  🟠 À rappeler
                </button>
                <button
                  onClick={() => handleAction("PAS_INTERESSE")}
                  disabled={acting || !commentOk}
                  title={!commentOk ? "Commentaire obligatoire" : undefined}
                  className="bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-95"
                >
                  ⚫ Pas intéressé
                </button>
                <button
                  onClick={() => handleAction("FAUX_NUMERO")}
                  disabled={acting || !commentOk}
                  title={!commentOk ? "Commentaire obligatoire" : undefined}
                  className="col-span-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 text-sm font-medium py-2 px-4 rounded-xl transition-all active:scale-95"
                >
                  Faux numéro
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-gray-600 font-semibold">File vide !</p>
              <p className="text-gray-400 text-sm mt-1">Tous les leads ont été traités.</p>
              <button
                onClick={loadQueue}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                Actualiser
              </button>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">🏆 Classement</h3>
          {leaderboard.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">
              Soyez le premier à appeler !
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => {
                const isMe = entry.userId === myUserId;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm ${
                      isMe
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base w-5 text-center">
                        {i < 3 ? MEDALS[i] : `${i + 1}.`}
                      </span>
                      <span
                        className={`font-medium truncate max-w-[100px] ${
                          isMe ? "text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {isMe ? "Vous" : entry.user.name.split(" ")[0]}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-800">{entry.points}</span>
                      <span className="text-gray-400 text-xs ml-1">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mes stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Mes stats
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-blue-50 rounded-xl p-2">
                <div className="text-xl font-bold text-blue-700">{myPoints}</div>
                <div className="text-xs text-blue-500">points</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-2">
                <div className="text-xl font-bold text-orange-600">{myCombos}</div>
                <div className="text-xs text-orange-400">combos 🔥</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal RDV date/heure */}
      {showRdvModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowRdvModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">📅</div>
                <h3 className="text-lg font-bold text-gray-900">RDV avec {lead?.firstName} {lead?.lastName}</h3>
                <p className="text-sm text-gray-500 mt-1">Choisissez la date et l&apos;heure du RDV</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={rdvDate}
                    onChange={e => setRdvDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Heure</label>
                  <input
                    type="time"
                    value={rdvTime}
                    onChange={e => setRdvTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowRdvModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmRdv}
                  disabled={!rdvDate || !rdvTime || !commentOk}
                  title={!commentOk ? "Commentaire obligatoire" : undefined}
                  className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
                >
                  ✅ Confirmer RDV
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal À rappeler */}
      {showRappelModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowRappelModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">🕐</div>
                <h3 className="text-lg font-bold text-gray-900">Rappel — {lead?.firstName} {lead?.lastName}</h3>
                <p className="text-sm text-gray-500 mt-1">Quand souhaitez-vous rappeler ?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={rappelDateFastCall}
                    onChange={e => setRappelDateFastCall(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Heure</label>
                  <input
                    type="time"
                    value={rappelTimeFastCall}
                    onChange={e => setRappelTimeFastCall(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Commentaire</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Commentaire obligatoire..."
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 transition-colors ${
                    comment.trim().length === 0
                      ? "border-gray-200 focus:ring-orange-500/20"
                      : commentOk
                      ? "border-green-300 focus:ring-green-500/20"
                      : "border-orange-300 focus:ring-orange-500/20"
                  }`}
                />
                {!commentOk && comment.trim().length > 0 && (
                  <p className="text-xs text-orange-500 mt-0.5">Minimum 3 caractères</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowRappelModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmRappel}
                  disabled={!rappelDateFastCall || !commentOk}
                  title={!commentOk ? "Commentaire obligatoire" : undefined}
                  className="flex-1 px-4 py-2.5 bg-orange-400 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
                >
                  🟠 Confirmer
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
