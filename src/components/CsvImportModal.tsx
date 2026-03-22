"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader, ExternalLink } from "lucide-react";

interface CsvImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "pick" | "preview" | "importing" | "done";

interface SkippedDetail {
  id: number;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  statusCall: string | null;
  campaign: string | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  skippedDetails: SkippedDetail[];
  total: number;
}

const KNOWN_FIELDS: Record<string, string> = {
  firstName: "Prénom", lastName: "Nom", mobile: "Mobile", phone1: "Tél fixe",
  email: "Email", address: "Adresse", zipCode: "Code postal", city: "Ville",
  campaign: "Campagne", civilite: "Civilité", observation: "Observation",
};

const COLUMN_MAP: Record<string, string> = {
  prenom: "firstName", firstname: "firstName", first_name: "firstName", "first name": "firstName",
  nom: "lastName", lastname: "lastName", last_name: "lastName", "last name": "lastName", name: "lastName", "nom de famille": "lastName",
  mobile: "mobile", tel: "mobile", telephone: "mobile", phone: "mobile",
  portable: "mobile", gsm: "mobile", tel_mobile: "mobile", telephone_mobile: "mobile",
  "tel mobile": "mobile", "telephone mobile": "mobile", "num tel": "mobile", "numero tel": "mobile",
  "numero de telephone": "mobile", "n de telephone": "mobile", "n telephone": "mobile",
  phone1: "phone1", fixe: "phone1", tel2: "phone1", telephone_fixe: "phone1", telephone2: "phone1",
  "tel fixe": "phone1", "telephone fixe": "phone1",
  email: "email", mail: "email", courriel: "email", "adresse mail": "email", "adresse email": "email",
  adresse: "address", address: "address", rue: "address", "adresse postale": "address",
  code_postal: "zipCode", codepostal: "zipCode", zip: "zipCode", cp: "zipCode",
  "code postal": "zipCode", departement: "zipCode", department: "zipCode", dept: "zipCode", dep: "zipCode", "code dep": "zipCode",
  ville: "city", city: "city", commune: "city",
  campagne: "campaign", campaign: "campaign", source: "campaign", origine: "campaign",
  civilite: "civilite", genre: "civilite", sexe: "civilite",
  observation: "observation", notes: "observation", commentaire: "observation", remarque: "observation",
};

function detectSep(line: string): string {
  const c: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  for (const ch of line) if (ch in c) c[ch]++;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

function parseLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (ch === sep && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[éèê]/g, "e")
    .replace(/[àâ]/g, "a")
    .replace(/[ôó]/g, "o")
    .replace(/[îï]/g, "i")
    .replace(/[ùûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/['"°#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMappedLabel(header: string): string | null {
  const key = normalizeHeader(header);
  const field = COLUMN_MAP[key];
  return field ? KNOWN_FIELDS[field] || field : null;
}

const STATUS_COLORS: Record<string, string> = {
  "NEW": "bg-blue-100 text-blue-700",
  "NOUVEAU LEAD": "bg-blue-100 text-blue-700",
  "NRP": "bg-orange-100 text-orange-700",
  "RDV SMS CONFIRMATION NRP 1": "bg-orange-100 text-orange-700",
  "A RAPPELER": "bg-yellow-100 text-yellow-700",
  "À REPLACER": "bg-yellow-100 text-yellow-700",
  "À QUALIFIER": "bg-yellow-100 text-yellow-700",
  "RDV PRIS": "bg-cyan-100 text-cyan-700",
  "RDV CONFIRMÉ": "bg-teal-100 text-teal-700",
  "PAS INTERESSE": "bg-red-100 text-red-600",
  "PAS ELIGIBLE": "bg-red-100 text-red-600",
  "INFINANÇABLE": "bg-red-100 text-red-600",
  "RÉTRACTATION": "bg-red-100 text-red-600",
  "FAUX NUM": "bg-gray-100 text-gray-600",
  "FAUX NUMERO": "bg-gray-100 text-gray-600",
  "HORS ZONE": "bg-gray-100 text-gray-600",
};

export default function CsvImportModal({ onClose, onSuccess }: CsvImportModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [campaign, setCampaign] = useState("");
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Options d'import
  const [teleposId, setTeleposId] = useState("");
  const [users, setUsers] = useState<{ id: number; name: string; role: string }[]>([]);

  // Charger la liste des users au montage
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(data => {
      if (data.users) setUsers(data.users.filter((u: any) => u.active !== false));
    }).catch(() => {});
  }, []);

  const loadPreview = useCallback((f: File) => {
    const process = (raw: string) => {
      const text = raw.replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) return;
      const sep = detectSep(lines[0]);
      const headers = parseLine(lines[0], sep).map(h => h.replace(/['"]/g, "").trim());
      const rows = lines.slice(1, 6).map(l => parseLine(l, sep));
      setPreview({ headers, rows });
      setStep("preview");
    };
    // Essai UTF-8 d'abord, fallback Latin-1 (Windows-1252) si caractères corrompus
    const readerUtf8 = new FileReader();
    readerUtf8.onload = (e) => {
      const raw = (e.target?.result as string) || "";
      // Si des caractères "replacement" sont présents → fichier Latin-1 mal lu en UTF-8
      if (raw.includes("\uFFFD")) {
        const readerLatin = new FileReader();
        readerLatin.onload = (e2) => process((e2.target?.result as string) || "");
        readerLatin.readAsText(f, "windows-1252");
      } else {
        process(raw);
      }
    };
    readerUtf8.readAsText(f, "utf-8");
  }, []);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(csv|txt)$/i)) { setError("Fichier CSV uniquement (.csv ou .txt)"); return; }
    setFile(f); setError(""); loadPreview(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStep("importing");
    const fd = new FormData();
    fd.append("file", file);
    if (campaign) fd.append("campaign", campaign);
    if (teleposId) fd.append("teleposId", teleposId);
    try {
      const r = await fetch("/api/clients/import", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) {
        let msg = data.error || "Erreur import";
        if (data.detectedHeaders?.length) {
          msg += ` — colonnes reçues : "${data.detectedHeaders.join('", "')}"`;
        }
        setError(msg);
        setStep("preview");
        return;
      }
      setResult(data);
      setStep("done");
      if (data.imported > 0) onSuccess();
    } catch (e: any) { setError(e.message); setStep("preview"); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <Upload size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Importer des leads CSV</h2>
                <p className="text-xs text-gray-500 mt-0.5">Séparateurs , ; tabulation — doublons auto-ignorés</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Étape 1 : sélection fichier */}
            {step === "pick" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => inputRef.current?.click()}
                className={
                  "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors " +
                  (dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50")
                }
              >
                <FileText size={44} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-600 font-medium">Glissez votre fichier CSV ici</p>
                <p className="text-gray-400 text-sm mt-1">ou cliquez pour choisir</p>
                <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            )}

            {/* Étape 2 : aperçu + mapping */}
            {step === "preview" && (
              <>
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                  <FileText size={15} />
                  <span className="font-medium truncate">{file?.name}</span>
                  <span className="ml-auto text-green-500 shrink-0">{preview.rows.length}+ lignes</span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Colonnes détectées</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.headers.map((h, i) => {
                      const lbl = getMappedLabel(h);
                      return (
                        <span key={i} className={
                          "px-2 py-1 rounded-lg text-xs font-medium " +
                          (lbl ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400")
                        }>
                          {h}
                          {lbl
                            ? <span className="opacity-60"> → {lbl}</span>
                            : <span className="opacity-40"> (ignoré)</span>
                          }
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          {preview.headers.map((_, j) => (
                            <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[120px] truncate">
                              {row[j] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Source / Campagne <span className="text-gray-400 font-normal">(optionnel)</span>
                    </label>
                    <input
                      type="text" value={campaign} onChange={e => setCampaign(e.target.value)}
                      placeholder="ex: Fournisseur XYZ — Mars 2026"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Assigner au telepro <span className="text-gray-400 font-normal">(optionnel)</span>
                    </label>
                    <select value={teleposId} onChange={e => setTeleposId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                      <option value="">Non assigne</option>
                      {users.filter(u => u.role === "telepos" || u.role === "admin").map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-green-200 bg-green-50">
                  <span className="text-sm font-semibold text-green-700">Tous les leads importes sont automatiquement marques comme proprietaires de maison individuelle</span>
                </div>
              </>
            )}

            {/* Étape 3 : import en cours */}
            {step === "importing" && (
              <div className="text-center py-14">
                <Loader size={44} className="mx-auto mb-4 text-blue-500 animate-spin" />
                <p className="text-gray-600 font-medium">Import en cours...</p>
                <p className="text-gray-400 text-sm mt-1">Ne fermez pas cette fenêtre</p>
              </div>
            )}

            {/* Étape 4 : résultats */}
            {step === "done" && result && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <CheckCircle size={44} className="mx-auto mb-2 text-green-500" />
                  <p className="text-xl font-bold text-gray-900">Import terminé !</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{result.imported}</div>
                    <div className="text-sm text-green-500 mt-1">Importés</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-orange-500">{result.skipped}</div>
                    <div className="text-sm text-orange-400 mt-1">Doublons ignorés</div>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-500">{result.errors}</div>
                    <div className="text-sm text-red-400 mt-1">Erreurs</div>
                  </div>
                </div>

                {/* Liste des doublons ignorés */}
                {result.skippedDetails && result.skippedDetails.length > 0 && (
                  <div className="border border-orange-100 rounded-xl overflow-hidden">
                    <div className="bg-orange-50 px-4 py-2.5 flex items-center justify-between">
                      <p className="text-sm font-semibold text-orange-700">
                        Doublons détectés — déjà dans le CRM
                      </p>
                      <span className="text-xs text-orange-500 font-medium">
                        Cliquer pour voir la fiche
                      </span>
                    </div>
                    <div className="divide-y divide-orange-50 max-h-52 overflow-y-auto">
                      {result.skippedDetails.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => { onClose(); router.push(`/clients?openClient=${d.id}`); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {[d.firstName, d.lastName].filter(Boolean).join(" ") || "Sans nom"}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{d.mobile || d.email || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {d.statusCall && (
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${STATUS_COLORS[d.statusCall] || "bg-gray-100 text-gray-600"}`}>
                                {d.statusCall}
                              </span>
                            )}
                            <ExternalLink size={13} className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {result.errorDetails.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 space-y-1">
                    {result.errorDetails.map((e, i) => <div key={i}>⚠ {e}</div>)}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle size={16} />{error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 flex gap-3 justify-end">
            {step === "done" ? (
              <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                Fermer
              </button>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                {step === "preview" && (
                  <button onClick={handleImport} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                    <Upload size={16} />Importer
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
