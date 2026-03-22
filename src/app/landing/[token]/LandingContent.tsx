"use client";

import { useState, useEffect } from "react";
import {
  Sun, TrendingDown, Shield, Clock, CheckCircle, Zap,
  Award, Users, Phone, Mail, MapPin, Home, Euro,
  ChevronRight, Star, Play, ArrowRight, Check, X,
  Building, Calendar, Briefcase, CreditCard
} from "lucide-react";

interface Props {
  token: string;
  campaignName: string;
}

export default function LandingContent({ token }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    civilite: "M",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    city: "",
    zipCode: "",
    electricBill: "",
    isOwner: "",
    propertyType: "",
    urgency: "1-3 mois",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Compteur animé
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const target = 847;
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCounter(target);
        clearInterval(timer);
      } else {
        setCounter(Math.floor(current));
      }
    }, 16);

    return () => clearInterval(timer);
  }, []);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.firstName) newErrors.firstName = "Prénom requis";
      if (!formData.lastName) newErrors.lastName = "Nom requis";
      if (!formData.civilite) newErrors.civilite = "Civilité requise";
    }

    if (step === 2) {
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Email valide requis";
      }
      if (!formData.mobile || !/^0[1-9]\d{8}$/.test(formData.mobile.replace(/\s/g, ''))) {
        newErrors.mobile = "Téléphone valide requis (10 chiffres)";
      }
    }

    if (step === 3) {
      if (!formData.city) newErrors.city = "Ville requise";
      if (!formData.zipCode || !/^\d{5}$/.test(formData.zipCode)) {
        newErrors.zipCode = "Code postal valide requis";
      }
      if (!formData.electricBill) newErrors.electricBill = "Facture requise";
    }

    if (step === 4) {
      if (!formData.isOwner) newErrors.isOwner = "Statut requis";
      if (!formData.propertyType) newErrors.propertyType = "Type de bien requis";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...formData }),
      });

      if (res.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert("Erreur lors de l'envoi. Veuillez réessayer.");
      }
    } catch (error) {
      console.error(error);
      alert("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-emerald-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-12 text-center animate-[fadeIn_0.5s_ease-in]">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-[bounce_1s_ease-in-out]">
            <CheckCircle size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Demande enregistrée avec succès ! 🎉
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Un de nos experts en énergie solaire vous contactera dans les <strong className="text-green-400">24 heures</strong> pour votre étude personnalisée gratuite.
          </p>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-bold text-white mb-4">📋 Vos prochaines étapes</h3>
            <div className="space-y-4 text-left">
              {[
                "Analyse détaillée de votre toiture et ensoleillement",
                "Calcul précis de vos économies sur 25 ans",
                "Simulation des aides d'État disponibles",
                "Proposition d'installation personnalisée"
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-green-400" />
                  </div>
                  <p className="text-white/90 text-sm pt-1">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/5 rounded-xl p-4">
              <Clock className="mx-auto text-blue-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">24h</p>
              <p className="text-xs text-white/70">Réponse garantie</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <Shield className="mx-auto text-green-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">25 ans</p>
              <p className="text-xs text-white/70">Garantie totale</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <Euro className="mx-auto text-yellow-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">0€</p>
              <p className="text-xs text-white/70">Étude gratuite</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-emerald-900">
      {/* Barre de confiance flottante */}
      <div className="fixed top-0 left-0 right-0 bg-white/10 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-yellow-400" />
              <span className="font-semibold">Certifié RGE QualiPV</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Users size={16} className="text-green-400" />
              <span><strong className="text-green-400">{counter}+</strong> installations</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Star size={16} className="text-yellow-400" />
              <span><strong>4.9/5</strong> (342 avis)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-yellow-300 animate-pulse">
            <Zap size={16} />
            <span className="font-bold hidden sm:inline">Places limitées ce mois</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold px-4 py-2 rounded-full mb-6 animate-[bounce_2s_ease-in-out_infinite]">
              🔥 Offre limitée : Étude gratuite + Aides jusqu'à 40%
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
              Divisez votre facture
              <br />
              <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                d'électricité par 2
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto">
              Produisez votre propre énergie verte et économisez jusqu'à <strong className="text-green-400">1200€/an</strong> avec les panneaux solaires
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 border border-white/20">
                <CheckCircle size={20} className="text-green-400" />
                <span className="text-white font-semibold">Installation en 48h</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 border border-white/20">
                <CheckCircle size={20} className="text-green-400" />
                <span className="text-white font-semibold">Garantie 25 ans</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 border border-white/20">
                <CheckCircle size={20} className="text-green-400" />
                <span className="text-white font-semibold">Financement 0€</span>
              </div>
            </div>

            {/* Video placeholder */}
            <div className="relative max-w-4xl mx-auto mb-12 group cursor-pointer">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/30 transition-all group-hover:scale-110">
                      <Play size={32} className="text-white ml-1" />
                    </div>
                    <p className="text-white font-semibold">Découvrez comment ça marche (2 min)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats impressionnants */}
          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {[
              { icon: Euro, value: "1200€", label: "Économies/an", color: "text-green-400" },
              { icon: Sun, value: "25 ans", label: "Durée de vie", color: "text-yellow-400" },
              { icon: Shield, value: "100%", label: "Garanti", color: "text-blue-400" },
              { icon: TrendingDown, value: "-50%", label: "Facture", color: "text-purple-400" },
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 text-center hover:bg-white/20 transition-all hover:scale-105">
                <stat.icon size={40} className={`${stat.color} mx-auto mb-4`} />
                <p className={`text-4xl font-black ${stat.color} mb-2`}>{stat.value}</p>
                <p className="text-white/70 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Formulaire Multi-étapes Premium */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
              {/* Progress bar */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
                <div className="flex items-center justify-between mb-4">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                        currentStep >= step
                          ? 'bg-white text-blue-600 scale-110'
                          : 'bg-white/20 text-white/50'
                      }`}>
                        {currentStep > step ? <Check size={20} /> : step}
                      </div>
                      {step < 4 && (
                        <div className={`flex-1 h-1 mx-2 rounded ${
                          currentStep > step ? 'bg-white' : 'bg-white/20'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-white/90 text-sm">
                    Étape {currentStep}/4 · {currentStep === 1 ? "Identité" : currentStep === 2 ? "Contact" : currentStep === 3 ? "Localisation" : "Éligibilité"}
                  </p>
                  <div className="w-full bg-white/20 rounded-full h-2 mt-3">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(currentStep / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-8">
                {/* Étape 1 : Identité */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-[fadeIn_0.3s_ease-in]">
                    <h3 className="text-2xl font-bold text-white mb-6">
                      👋 Commençons par faire connaissance
                    </h3>

                    <div className="flex gap-4">
                      {["M", "Mme"].map((civ) => (
                        <label key={civ} className={`flex-1 cursor-pointer`}>
                          <input
                            type="radio"
                            name="civilite"
                            value={civ}
                            checked={formData.civilite === civ}
                            onChange={(e) => setFormData({ ...formData, civilite: e.target.value })}
                            className="hidden"
                          />
                          <div className={`px-6 py-3 rounded-xl text-center font-semibold transition-all ${
                            formData.civilite === civ
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }`}>
                            {civ}.
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <input
                          type="text"
                          placeholder="Prénom *"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className={`w-full px-5 py-4 bg-white/10 border ${errors.firstName ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder:text-white/50 focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                        />
                        {errors.firstName && <p className="text-red-400 text-sm mt-1">{errors.firstName}</p>}
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Nom *"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className={`w-full px-5 py-4 bg-white/10 border ${errors.lastName ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder:text-white/50 focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                        />
                        {errors.lastName && <p className="text-red-400 text-sm mt-1">{errors.lastName}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Étape 2 : Contact */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-[fadeIn_0.3s_ease-in]">
                    <h3 className="text-2xl font-bold text-white mb-6">
                      📞 Comment vous joindre ?
                    </h3>

                    <div>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                        <input
                          type="email"
                          placeholder="Email *"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full pl-12 pr-5 py-4 bg-white/10 border ${errors.email ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder:text-white/50 focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                        />
                      </div>
                      {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                        <input
                          type="tel"
                          placeholder="Téléphone (06 12 34 56 78) *"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className={`w-full pl-12 pr-5 py-4 bg-white/10 border ${errors.mobile ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder:text-white/50 focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                        />
                      </div>
                      {errors.mobile && <p className="text-red-400 text-sm mt-1">{errors.mobile}</p>}
                    </div>

                    <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4 flex items-start gap-3">
                      <Shield className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                      <p className="text-white/80 text-sm">
                        Vos données sont sécurisées et utilisées uniquement pour votre étude. Aucune revente à des tiers.
                      </p>
                    </div>
                  </div>
                )}

                {/* Étape 3 : Localisation */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-[fadeIn_0.3s_ease-in]">
                    <h3 className="text-2xl font-bold text-white mb-6">
                      📍 Où se trouve votre bien ?
                    </h3>

                    <div>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                        <input
                          type="text"
                          placeholder="Ville *"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className={`w-full pl-12 pr-5 py-4 bg-white/10 border ${errors.city ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder:text-white/50 focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                        />
                      </div>
                      {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Code postal *"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        className={`w-full px-5 py-4 bg-white/10 border ${errors.zipCode ? 'border-red-500' : 'border-white/20'} rounded-xl text-white placeholder:text-white/50 focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                      />
                      {errors.zipCode && <p className="text-red-400 text-sm mt-1">{errors.zipCode}</p>}
                    </div>

                    <div>
                      <label className="text-white/80 text-sm mb-2 block">Votre facture mensuelle</label>
                      <select
                        value={formData.electricBill}
                        onChange={(e) => setFormData({ ...formData, electricBill: e.target.value })}
                        className={`w-full px-5 py-4 bg-white/10 border ${errors.electricBill ? 'border-red-500' : 'border-white/20'} rounded-xl text-white focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                      >
                        <option value="" className="bg-slate-800">Choisissez votre tranche</option>
                        <option value="<100" className="bg-slate-800">Moins de 100€/mois</option>
                        <option value="100-150" className="bg-slate-800">100-150€/mois (🔥 Économies max)</option>
                        <option value="150-200" className="bg-slate-800">150-200€/mois (⭐ Très rentable)</option>
                        <option value=">200" className="bg-slate-800">Plus de 200€/mois (💎 ROI optimal)</option>
                      </select>
                      {errors.electricBill && <p className="text-red-400 text-sm mt-1">{errors.electricBill}</p>}
                    </div>
                  </div>
                )}

                {/* Étape 4 : Éligibilité */}
                {currentStep === 4 && (
                  <div className="space-y-6 animate-[fadeIn_0.3s_ease-in]">
                    <h3 className="text-2xl font-bold text-white mb-6">
                      🏠 Dernière étape : votre éligibilité
                    </h3>

                    <div>
                      <label className="text-white/80 text-sm mb-2 block">Vous êtes</label>
                      <select
                        value={formData.isOwner}
                        onChange={(e) => setFormData({ ...formData, isOwner: e.target.value })}
                        className={`w-full px-5 py-4 bg-white/10 border ${errors.isOwner ? 'border-red-500' : 'border-white/20'} rounded-xl text-white focus:bg-white/20 focus:border-blue-400 outline-none transition-all`}
                      >
                        <option value="" className="bg-slate-800">Sélectionnez</option>
                        <option value="Oui" className="bg-slate-800">✅ Propriétaire (éligible)</option>
                        <option value="Non" className="bg-slate-800">❌ Locataire (non éligible)</option>
                      </select>
                      {errors.isOwner && <p className="text-red-400 text-sm mt-1">{errors.isOwner}</p>}
                    </div>

                    <div>
                      <label className="text-white/80 text-sm mb-2 block">Type de bien</label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { value: "Maison", icon: Home, label: "Maison" },
                          { value: "Appartement", icon: Building, label: "Appartement" }
                        ].map((type) => (
                          <label key={type.value} className="cursor-pointer">
                            <input
                              type="radio"
                              name="propertyType"
                              value={type.value}
                              checked={formData.propertyType === type.value}
                              onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                              className="hidden"
                            />
                            <div className={`p-6 rounded-xl text-center transition-all ${
                              formData.propertyType === type.value
                                ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                                : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                            }`}>
                              <type.icon size={32} className="mx-auto mb-2" />
                              <p className="font-semibold">{type.label}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      {errors.propertyType && <p className="text-red-400 text-sm mt-1">{errors.propertyType}</p>}
                    </div>

                    <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                          <p className="text-white font-semibold mb-1">✅ Vous êtes éligible aux aides !</p>
                          <p className="text-white/80 text-sm">
                            MaPrimeRénov', CEE, TVA réduite = jusqu'à <strong className="text-green-400">40% d'économies</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Boutons navigation */}
                <div className="flex gap-4 mt-8">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all border border-white/20"
                    >
                      ← Retour
                    </button>
                  )}

                  {currentStep < 4 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                      Continuer
                      <ArrowRight size={20} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? "Envoi en cours..." : (
                        <>
                          <CheckCircle size={20} />
                          Obtenir mon étude gratuite
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-center text-white/50 mt-6">
                  🔒 Vos données sont sécurisées SSL · Aucune revente · Conformité RGPD
                </p>
              </form>
            </div>
          </div>

          {/* Témoignages Premium */}
          <div className="mt-20">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              ⭐ Ils sont passés au solaire
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: "Sophie Durand",
                  location: "Marseille (13)",
                  rating: 5,
                  text: "Installation impeccable en 2 jours. J'économise 85€/mois, c'est incroyable ! L'équipe est très professionnelle.",
                  savings: "85€/mois",
                  date: "Il y a 2 mois"
                },
                {
                  name: "Marc Lefebvre",
                  location: "Lyon (69)",
                  rating: 5,
                  text: "Grâce aux aides de l'État, j'ai payé seulement 60% du prix. Rentabilisé en 7 ans, et après c'est du bonus !",
                  savings: "105€/mois",
                  date: "Il y a 1 mois"
                },
                {
                  name: "Claire Martin",
                  location: "Toulouse (31)",
                  rating: 5,
                  text: "Je recommande à 100%. Suivi parfait du début à la fin, installation soignée. Ma facture EDF a fondu !",
                  savings: "92€/mois",
                  date: "Il y a 3 semaines"
                }
              ].map((testimonial, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-white/90 mb-4 italic">"{testimonial.text}"</p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      <p className="text-white font-semibold text-sm">{testimonial.name}</p>
                      <p className="text-white/60 text-xs">{testimonial.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-sm">{testimonial.savings}</p>
                      <p className="text-white/60 text-xs">{testimonial.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              ❓ Questions fréquentes
            </h2>

            <div className="space-y-4">
              {[
                {
                  q: "Combien ça coûte vraiment ?",
                  a: "Avec les aides de l'État (MaPrimeRénov' + CEE), le coût réel est réduit de 30-40%. Une installation moyenne coûte 8000-12000€ après aides, et se rentabilise en 7-10 ans."
                },
                {
                  q: "Est-ce que ça marche vraiment en France ?",
                  a: "Oui ! Même avec notre climat tempéré, les panneaux produisent toute l'année. Le sud produit plus, mais le nord est aussi rentable. 400 000 foyers français sont déjà équipés."
                },
                {
                  q: "Que se passe-t-il la nuit ou en hiver ?",
                  a: "Vous restez connecté au réseau EDF. La nuit, vous consommez l'électricité du réseau. Le surplus produit le jour est revendu à EDF (tarif garanti 25 ans)."
                },
                {
                  q: "Combien de temps dure l'installation ?",
                  a: "L'installation physique prend 1-2 jours. Le processus complet (étude, démarches admin, pose) prend 2-3 mois. Nous gérons toutes les démarches administratives."
                }
              ].map((faq, i) => (
                <details key={i} className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden group">
                  <summary className="p-6 cursor-pointer flex items-center justify-between text-white font-semibold hover:bg-white/15 transition-all">
                    {faq.q}
                    <ChevronRight className="group-open:rotate-90 transition-transform" size={20} />
                  </summary>
                  <div className="px-6 pb-6 text-white/80 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Trust badges footer */}
          <div className="mt-20 text-center">
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
              <div className="text-white text-sm">
                <Award className="mx-auto mb-2" size={32} />
                <p className="font-semibold">RGE QualiPV</p>
              </div>
              <div className="text-white text-sm">
                <Shield className="mx-auto mb-2" size={32} />
                <p className="font-semibold">Assurance Décennale</p>
              </div>
              <div className="text-white text-sm">
                <CheckCircle className="mx-auto mb-2" size={32} />
                <p className="font-semibold">Garantie 25 ans</p>
              </div>
              <div className="text-white text-sm">
                <Users className="mx-auto mb-2" size={32} />
                <p className="font-semibold">847+ clients</p>
              </div>
            </div>

            <p className="text-white/40 text-xs mt-8">
              © 2026 Energie Solaire France · Tous droits réservés
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
