/**
 * Module de chiffrement DÉSACTIVÉ
 * Les fonctions sont des pass-through (retournent les données telles quelles)
 * pour ne pas casser les imports existants.
 */

// @ts-nocheck
export function encrypt(text) {
  return text;
}

export function decrypt(text) {
  return text;
}

export function isEncrypted(_text) {
  return false;
}

export function generateEncryptionKey() {
  return '';
}

export const ENCRYPTED_CLIENT_FIELDS = [];
export const ENCRYPTED_USER_FIELDS = [];

export function encryptClient(client) {
  return client;
}

export function decryptClient(client) {
  return client;
}

export function encryptUser(user) {
  return user;
}

export function decryptUser(user) {
  return user;
}
