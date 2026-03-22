#!/usr/bin/env node
// Fix statuts manquants dans la table Status + donnees incohérentes
// Exécuter sur VPS: node scripts/fix-statuses-and-data.js

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'prisma', 'dev.db');
const db = new Database(DB_PATH);

console.log('=== Fix Statuts & Data ===\n');

// Helper: insert status if not exists
function insertIfMissing(type, name, color, order) {
  const exists = db.prepare('SELECT 1 FROM Status WHERE type = ? AND name = ?').get(type, name);
  if (!exists) {
    db.prepare('INSERT INTO Status (id, type, name, color, "order") VALUES (?, ?, ?, ?, ?)')
      .run(require('crypto').randomUUID(), type, name, color, order);
    console.log(`  + Added ${type}: "${name}" (${color})`);
  } else {
    console.log(`  = Already exists: ${type}: "${name}"`);
  }
}

// 1. Ajouter statusCall manquants
console.log('1. StatusCall (statut1) manquants:');
insertIfMissing('statut1', 'NEW', '#3b82f6', 0);
insertIfMissing('statut1', 'REINSCRIT', '#8b5cf6', 14);
insertIfMissing('statut1', 'RDV A CONFIRMER', '#60a5fa', 15);
insertIfMissing('statut1', 'RDV CONFIRME', '#22c55e', 16);
insertIfMissing('statut1', 'HORS ZONE', '#94a3b8', 17);

// 2. Ajouter statusRDV manquants
console.log('\n2. StatusRDV (statut2) manquants:');
insertIfMissing('statut2', 'SIGNE', '#22c55e', 2);
insertIfMissing('statut2', 'RETRACTATION', '#ef4444', 3);
insertIfMissing('statut2', 'A RETRAVAILLER', '#f59e0b', 11);
insertIfMissing('statut2', 'POSE PROGRAMME', '#166534', 10);
insertIfMissing('statut2', 'POSÉ', '#166534', 19);

// 3. Corriger donnees incohérentes
console.log('\n3. Corrections donnees:');

// statusRDV = "RDV PRIS" -> NULL (c'est un statusCall, pas un statusRDV)
const rdvPrisFixed = db.prepare("UPDATE Client SET statusRDV = NULL WHERE statusRDV = 'RDV PRIS'").run();
console.log(`  Clients avec statusRDV='RDV PRIS' corrigés: ${rdvPrisFixed.changes}`);

// statusCall vide -> NEW
const emptyCallFixed = db.prepare("UPDATE Client SET statusCall = 'NEW' WHERE statusCall IS NULL OR statusCall = ''").run();
console.log(`  Clients avec statusCall vide -> NEW: ${emptyCallFixed.changes}`);

console.log('\n=== Terminé ===');
db.close();
