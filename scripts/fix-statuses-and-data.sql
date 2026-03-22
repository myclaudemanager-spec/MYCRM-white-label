-- ============================================
-- MyCRM: Fix statuts manquants + donnees incohérentes
-- Date: 2026-03-10
-- ============================================

-- 1. Ajouter les statuts manquants dans la table Status (type=statut2)
-- On vérifie d'abord si ils n'existent pas déjà

INSERT INTO Status (type, name, color, "order")
SELECT 'statut2', 'SIGNE', '#22c55e', 2
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut2' AND name='SIGNE');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut2', 'RETRACTATION', '#ef4444', 3
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut2' AND name='RETRACTATION');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut2', 'A RETRAVAILLER', '#f59e0b', 11
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut2' AND name='A RETRAVAILLER');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut2', 'POSE PROGRAMME', '#166534', 10
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut2' AND name='POSE PROGRAMME');

-- Ajouter les statusCall manquants
INSERT INTO Status (type, name, color, "order")
SELECT 'statut1', 'NEW', '#3b82f6', 0
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut1' AND name='NEW');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut1', 'REINSCRIT', '#8b5cf6', 14
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut1' AND name='REINSCRIT');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut1', 'RDV A CONFIRMER', '#60a5fa', 15
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut1' AND name='RDV A CONFIRMER');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut1', 'RDV CONFIRME', '#22c55e', 16
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut1' AND name='RDV CONFIRME');

INSERT INTO Status (type, name, color, "order")
SELECT 'statut1', 'HORS ZONE', '#94a3b8', 17
WHERE NOT EXISTS (SELECT 1 FROM Status WHERE type='statut1' AND name='HORS ZONE');

-- 2. Corriger les données incohérentes

-- 10 clients avec statusRDV = "RDV PRIS" -> mettre a vide (c'est un statusCall)
UPDATE Client SET statusRDV = NULL WHERE statusRDV = 'RDV PRIS';

-- 3 clients avec statusCall vide -> mettre NEW
UPDATE Client SET statusCall = 'NEW' WHERE statusCall IS NULL OR statusCall = '';
