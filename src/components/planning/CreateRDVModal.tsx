"use client";

import { useState, useEffect } from "react";
import { X, Search, Calendar, Clock, User, Users, FileText, CheckCircle } from "lucide-react";
import clsx from "clsx";

interface CreateRDVModalProps {
  onClose: () => void;
  onCreated: () => void;
  initialDate?: string; // Format YYYY-MM-DD
  initialTime?: string; // Format HH:MM
}

interface Client {
  id: number;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  city: string | null;
}

interface User {
  id: number;
  name: string;
  role: string;
}

export default function CreateRDVModal({
  onClose,
  onCreated,
  initialDate,
  initialTime = "14:00",
}: CreateRDVModalProps) {
  // Form state
  const [step, setStep] = useState<"client" | "details">("client");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searching, setSearching] = useState(false);

  // RDV details
  const [rdvDate, setRdvDate] = useState(initialDate || getTodayString());
  const [rdvTime, setRdvTime] = useState(initialTime);
  const [rdvDuration, setRdvDuration] = useState("60");
  const [rdvType, setRdvType] = useState("");
  const [commercial1Id, setCommercial1Id] = useState<number | null>(null);
  const [commercial2Id, setCommercial2Id] = useState<number | null>(null);
  const [infosRDV, setInfosRDV] = useState("");

  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [rdvTypes, setRdvTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch users and RDV types
  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/rdv-types").then((r) => r.json()),
    ]).then(([usersData, typesData]) => {
      setUsers(usersData.users || []);
      setRdvTypes(typesData.rdvTypes || []);
    });
  }, []);

  // Search clients
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/clients?search=${encodeURIComponent(searchQuery)}&limit=10`
        );
        const data = await res.json();
        setSearchResults(data.clients || []);
      } catch (err) {
        console.error("Erreur recherche:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSearchQuery("");
    setSearchResults([]);
    setStep("details");
  };

  const handleCreateRDV = async () => {
    if (!selectedClient) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/rdv/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          rdvDate,
          rdvTime,
          rdvDuration: parseInt(rdvDuration),
          typeRDV: rdvType || null,
          commercial1Id,
          commercial2Id,
          infosRDV: infosRDV || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const commercials = users.filter((u) => u.role === "commercial");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Créer un RDV</h2>
            {selectedClient && (
              <p className="text-blue-100 text-sm mt-0.5">
                {selectedClient.firstName} {selectedClient.lastName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                step === "client"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-600"
              )}
            >
              <User size={16} />
              Sélectionner client
            </div>
            <div className="h-px flex-1 bg-gray-300"></div>
            <div
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                step === "details"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-600"
              )}
            >
              <Calendar size={16} />
              Détails du RDV
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Select Client */}
          {step === "client" && (
            <div>
              {!selectedClient ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rechercher un client
                  </label>
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Nom, prénom, téléphone, email..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Search results */}
                  {searchQuery && (
                    <div className="mt-3 border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                      {searching && (
                        <div className="p-4 text-center text-gray-500">
                          Recherche...
                        </div>
                      )}

                      {!searching && searchResults.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                          Aucun client trouvé
                        </div>
                      )}

                      {!searching &&
                        searchResults.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="w-full p-4 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {client.firstName} {client.lastName}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  {client.mobile && (
                                    <span className="text-sm text-gray-600">
                                      {client.mobile}
                                    </span>
                                  )}
                                  {client.city && (
                                    <span className="text-sm text-gray-500">
                                      {client.city}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <CheckCircle
                                size={20}
                                className="text-blue-500"
                              />
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedClient.firstName} {selectedClient.lastName}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {selectedClient.mobile && (
                          <span className="text-sm text-gray-600">
                            {selectedClient.mobile}
                          </span>
                        )}
                        {selectedClient.city && (
                          <span className="text-sm text-gray-500">
                            {selectedClient.city}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedClient(null);
                        setStep("client");
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Changer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: RDV Details */}
          {step === "details" && selectedClient && (
            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  Date du RDV
                </label>
                <input
                  type="date"
                  value={rdvDate}
                  onChange={(e) => setRdvDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Time + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock size={16} className="inline mr-1" />
                    Heure
                  </label>
                  <input
                    type="time"
                    value={rdvTime}
                    onChange={(e) => setRdvTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durée (min)
                  </label>
                  <select
                    value={rdvDuration}
                    onChange={(e) => setRdvDuration(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="30">30 min</option>
                    <option value="60">1h</option>
                    <option value="90">1h30</option>
                    <option value="120">2h</option>
                  </select>
                </div>
              </div>

              {/* Type RDV */}
              {rdvTypes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de RDV
                  </label>
                  <select
                    value={rdvType}
                    onChange={(e) => setRdvType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Choisir --</option>
                    {rdvTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Commercials */}
              {commercials.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User size={16} className="inline mr-1" />
                    Commercial principal
                  </label>
                  <select
                    value={commercial1Id || ""}
                    onChange={(e) =>
                      setCommercial1Id(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Non assigné --</option>
                    {commercials.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {commercials.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users size={16} className="inline mr-1" />
                    Commercial binôme (optionnel)
                  </label>
                  <select
                    value={commercial2Id || ""}
                    onChange={(e) =>
                      setCommercial2Id(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Non assigné --</option>
                    {commercials
                      .filter((u) => u.id !== commercial1Id)
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText size={16} className="inline mr-1" />
                  Infos / Notes
                </label>
                <textarea
                  value={infosRDV}
                  onChange={(e) => setInfosRDV(e.target.value)}
                  rows={3}
                  placeholder="Détails du RDV, rappels, informations importantes..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Annuler
          </button>

          <div className="flex items-center gap-2">
            {step === "details" && (
              <button
                onClick={() => setStep("client")}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Retour
              </button>
            )}

            {step === "client" && selectedClient && (
              <button
                onClick={() => setStep("details")}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-sm"
              >
                Suivant
              </button>
            )}

            {step === "details" && (
              <button
                onClick={handleCreateRDV}
                disabled={loading}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Création..." : "Créer le RDV"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
