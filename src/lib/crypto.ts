export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-512",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keyPair;
}

export async function exportPublicKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(pem: string) {
  const binaryDerString = window.atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-512",
    },
    true,
    ["encrypt"]
  );
}

export async function exportPrivateKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPrivateKey(pem: string) {
  const binaryDerString = window.atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-512",
    },
    true,
    ["decrypt"]
  );
}

export async function encryptMessage(message: string, publicKey: CryptoKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export async function decryptMessage(encryptedBase64: string, privateKey: CryptoKey) {
  const binaryString = window.atob(encryptedBase64);
  const data = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    data[i] = binaryString.charCodeAt(i);
  }
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    data
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export async function generateAESKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importAESKey(base64: string) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "raw",
    bytes.buffer,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptWithAES(text: string, key: CryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encoder.encode(text)
  );
  return {
    content: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
  };
}

export async function decryptWithAES(encryptedBase64: string, ivBase64: string, key: CryptoKey) {
  const encryptedBinary = window.atob(encryptedBase64);
  const encryptedBytes = new Uint8Array(encryptedBinary.length);
  for (let i = 0; i < encryptedBinary.length; i++) {
    encryptedBytes[i] = encryptedBinary.charCodeAt(i);
  }

  const ivBinary = window.atob(ivBase64);
  const ivBytes = new Uint8Array(ivBinary.length);
  for (let i = 0; i < ivBinary.length; i++) {
    ivBytes[i] = ivBinary.charCodeAt(i);
  }

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
    key,
    encryptedBytes
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptAESKeyForUser(aesKey: CryptoKey, userPublicKey: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("raw", aesKey);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    userPublicKey,
    exported
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export async function decryptAESKeyWithUserPrivateKey(encryptedAESKeyBase64: string, userPrivateKey: CryptoKey) {
  const binaryString = window.atob(encryptedAESKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    userPrivateKey,
    bytes
  );
  return await window.crypto.subtle.importKey(
    "raw",
    decrypted,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
}

export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-512', dataBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 310000,
      hash: "SHA-512"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
