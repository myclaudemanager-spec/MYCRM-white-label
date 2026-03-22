"use client";

import { useState, useEffect } from "react";
import { X, Zap, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface QuickQualifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    mobile?: string | null;
  };
  onSuccess: () => void;
}

export default function QuickQualifyModal({
  isOpen,
  onClose,
  client,
  onSuccess,
}: QuickQualifyModalProps) {
  const [step, setStep] = useState(1);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);

  // Réponses
  const [proprietaire, setProprietaire] = useState("");
  const [typeLogement, setTypeLogement] = useState("");
  const [codePostal, setCodePostal] = useState("");

  // Résultat
  const [result, setResult] = useState<{
    status: "qualified" | "disqualified";
    reason?: string;
    message: string;
    qualificationTime?: number;
  } | null>(null);

  // Timer
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, startTime]);

  // Reset au montage
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setStartTime(Date.now());
      setElapsedTime(0);
      setProprietaire("");
      setTypeLogement("");
      setCodePostal("");
      setResult(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Soumettre la qualification
  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/clients/${client.id}/quick-qualify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proprietaire,
          typeLogement,
          codePostal,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          status: data.status,
          reason: data.reason,
          message: data.message,
          qualificationTime: data.qualificationTime,
        });
      } else {
        alert(`Erreur : ${data.error || "Erreur inconnue"}`);
        setLoading(false);
      }
    } catch (error) {
      console.error("Erreur qualification:", error);
      alert("Erreur lors de la qualification");
      setLoading(false);
    }
  };

  // Question 1 : Proprio maison ? (fusionne Q1 + Q2)
  const handleQuestion1 = (answer: string) => {
    if (answer === "oui") {
      setProprietaire("Oui");
      setTypeLogement("Maison individuelle");
      setStep(3); // Sauter Q2, aller direct au code postal
    } else {
      setProprietaire("Non");
      setTypeLogement("Autre");
      // Soumettre directement — pas besoin du code postal pour un non-eligible
      setStep(2); // Affichera le submit auto
    }
  };

  // Question 2 : Auto-submit pour non-eligible
  useEffect(() => {
    if (step === 2 && proprietaire === "Non") {
      setCodePostal("00000"); // placeholder pour l'API
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Question 3 : Code postal
  const handleQuestion3 = () => {
    if (codePostal.length !== 5) {
      alert("Code postal invalide (5 chiffres requis)");
      return;
    }
    handleSubmit();
  };

  // Fermer et rafraîchir
  const handleClose = () => {
    if (result && result.status === "qualified") {
      onSuccess(); // Rafraîchir la liste
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Qualification Express
              </h2>
              <p className="text-sm text-gray-500">
                {client.firstName} {client.lastName} - {client.mobile}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Timer et Progress */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Temps écoulé : {(elapsedTime / 1000).toFixed(1)}s
              </span>
              {elapsedTime < 10000 && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ Objectif &lt; 10s
                </span>
              )}
              {elapsedTime >= 10000 && (
                <span className="text-xs text-orange-600 font-medium">
                  ⚠ Dépasse l'objectif
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              Étape {step <= 1 ? 1 : 2}/2
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(Math.min(step, 3) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Résultat */}
          {result && (
            <div className="mb-6">
              {result.status === "qualified" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-green-900 mb-1">
                        ✅ Lead Qualifié !
                      </h3>
                      <p className="text-sm text-green-700 mb-2">
                        {result.message}
                      </p>
                      <p className="text-xs text-green-600">
                        Temps de qualification : {((result.qualificationTime || 0) / 1000).toFixed(1)}s
                      </p>
                      <button
                        onClick={handleClose}
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Fermer et continuer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {result.status === "disqualified" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-900 mb-1">
                        ❌ Lead Non Qualifié
                      </h3>
                      <p className="text-sm text-red-700 mb-2">
                        {result.message}
                      </p>
                      <p className="text-xs text-red-600">
                        Raison : <strong>{result.reason}</strong>
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Lead archivé automatiquement
                      </p>
                      <button
                        onClick={handleClose}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Questions */}
          {!result && (
            <>
              {/* Question 1 : Proprio maison individuelle ? */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      1
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Proprietaire de maison individuelle ?
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleQuestion1("oui")}
                      className="px-6 py-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
                    >
                      <div className="text-3xl mb-2">&#x1F3E1;</div>
                      <div className="font-bold text-gray-900 text-lg">Oui</div>
                      <div className="text-sm text-gray-500 mt-1">Proprietaire de maison</div>
                    </button>

                    <button
                      onClick={() => handleQuestion1("non")}
                      className="px-6 py-6 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-center"
                    >
                      <div className="text-3xl mb-2">&#x274C;</div>
                      <div className="font-bold text-gray-900 text-lg">Non</div>
                      <div className="text-sm text-gray-500 mt-1">Locataire / Appartement / Autre</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 : auto-submit pour non-eligible (loading) */}
              {step === 2 && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Disqualification en cours...</p>
                </div>
              )}

              {/* Question 3 : Code postal */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      3
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Code postal du logement ?
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={codePostal}
                      onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      placeholder="Ex: 13001"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                      maxLength={5}
                      autoFocus
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && codePostal.length === 5) {
                          handleQuestion3();
                        }
                      }}
                    />

                    <button
                      onClick={handleQuestion3}
                      disabled={codePostal.length !== 5 || loading}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg"
                    >
                      {loading ? "Qualification en cours..." : "Valider la qualification"}
                    </button>
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-700 space-y-1">
                        <p><strong>Zone d'intervention :</strong> Départements 13, 30, 83, 84 (PACA)</p>
                        <p className="text-blue-600">
                          ✓ Bouches-du-Rhône (13) • Gard (30) • Var (83) • Vaucluse (84)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
