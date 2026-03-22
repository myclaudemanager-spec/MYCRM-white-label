"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";

interface ClientComment {
  id: string;
  date: string;
  userId: number;
  userName: string;
  text: string;
}

interface CommentsPanelProps {
  clientId: number;
  comments: ClientComment[];
  userRole: string;
  onCommentsChange: (comments: ClientComment[]) => void;
}

// Génère une couleur d'avatar cohérente basée sur le nom
function avatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function CommentsPanel({ clientId, comments, userRole, onCommentsChange }: CommentsPanelProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isAdmin = userRole === "admin";

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic: ClientComment = {
      id: tempId,
      date: new Date().toISOString(),
      userId: 0,
      userName: "Vous",
      text: trimmed,
    };
    onCommentsChange([optimistic, ...comments]);
    setText("");
    setSending(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        // Remplacer le commentaire temporaire par le vrai
        onCommentsChange([data.comment, ...comments]);
      } else {
        // Rollback
        onCommentsChange(comments);
      }
    } catch {
      onCommentsChange(comments);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!isAdmin || deletingId) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/clients/${clientId}/comments?commentId=${commentId}`, { method: "DELETE" });
      if (res.ok) {
        onCommentsChange(comments.filter(c => c.id !== commentId));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Zone de saisie */}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
          placeholder="Ajouter un commentaire... (Ctrl+Entrée pour envoyer)"
          rows={3}
          className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1 self-start"
          title="Envoyer (Ctrl+Entrée)"
        >
          <Send size={14} />
        </button>
      </div>

      {/* Liste des commentaires */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted italic text-center py-4">Aucun commentaire. Soyez le premier !</p>
      ) : (
        <div className="space-y-2">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3 p-3 bg-bg border border-border rounded-lg group">
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(comment.userName)}`}>
                {initials(comment.userName)}
              </div>
              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-secondary">{comment.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{formatDate(comment.date)}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-danger hover:bg-danger/10 disabled:opacity-30"
                        title="Supprimer (admin)"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
