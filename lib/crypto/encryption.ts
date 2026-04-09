import type { EncryptionMetadata, PrivateProvenanceBundle } from "@/lib/proof/types";

export interface EncryptionProvider {
  kind: EncryptionMetadata["kind"];
  encrypt(bundle: PrivateProvenanceBundle, password: string): Promise<EncryptedBundle>;
  decrypt(bundle: EncryptedBundle, password: string): Promise<PrivateProvenanceBundle>;
}

export interface EncryptedBundle {
  ciphertextBase64: string;
  metadata: EncryptionMetadata;
}

export class PasswordEncryptionProvider implements EncryptionProvider {
  kind = "password-aes-gcm" as const;

  async encrypt(bundle: PrivateProvenanceBundle, password: string): Promise<EncryptedBundle> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 250000;
    const key = await derivePasswordKey(password, salt, iterations);
    const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

    return {
      ciphertextBase64: toBase64(ciphertext),
      metadata: {
        kind: this.kind,
        algorithm: "AES-GCM",
        kdf: "PBKDF2",
        saltBase64: toBase64(salt.buffer),
        ivBase64: toBase64(iv.buffer),
        iterations
      }
    };
  }

  async decrypt(bundle: EncryptedBundle, password: string): Promise<PrivateProvenanceBundle> {
    const salt = new Uint8Array(fromBase64(bundle.metadata.saltBase64));
    const iv = new Uint8Array(fromBase64(bundle.metadata.ivBase64));
    const key = await derivePasswordKey(password, salt, bundle.metadata.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      fromBase64(bundle.ciphertextBase64)
    );

    return JSON.parse(new TextDecoder().decode(plaintext)) as PrivateProvenanceBundle;
  }
}

export function getEncryptionProvider(kind: EncryptionMetadata["kind"]) {
  switch (kind) {
    case "password-aes-gcm":
      return new PasswordEncryptionProvider();
    default:
      throw new Error(`Unsupported encryption provider: ${kind}`);
  }
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(input: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(input)));
}

function fromBase64(input: string) {
  return Uint8Array.from(atob(input), (char) => char.charCodeAt(0)).buffer;
}
