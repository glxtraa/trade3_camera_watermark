import type {
  EncryptedBinaryAsset,
  EncryptionMetadata,
  PrivateProvenanceBundle
} from "@/lib/proof/types";

export interface EncryptionProvider {
  kind: EncryptionMetadata["kind"];
  encrypt(bundle: PrivateProvenanceBundle, password: string): Promise<EncryptedBundle>;
  decrypt(bundle: EncryptedBundle, password: string): Promise<PrivateProvenanceBundle>;
  encryptBytes(
    bytes: ArrayBuffer,
    password: string,
    filename: string,
    contentType: string
  ): Promise<EncryptedBinaryAsset>;
  decryptBytes(asset: EncryptedBinaryAsset, password: string): Promise<ArrayBuffer>;
}

export interface EncryptedBundle {
  ciphertextBase64: string;
  metadata: EncryptionMetadata;
}

export class PasswordEncryptionProvider implements EncryptionProvider {
  kind = "password-aes-gcm" as const;

  async encrypt(bundle: PrivateProvenanceBundle, password: string): Promise<EncryptedBundle> {
    const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
    return encryptPayload(plaintext.buffer, password, this.kind);
  }

  async decrypt(bundle: EncryptedBundle, password: string): Promise<PrivateProvenanceBundle> {
    const plaintext = await decryptPayload(bundle, password);
    return JSON.parse(new TextDecoder().decode(plaintext)) as PrivateProvenanceBundle;
  }

  async encryptBytes(
    bytes: ArrayBuffer,
    password: string,
    filename: string,
    contentType: string
  ): Promise<EncryptedBinaryAsset> {
    const encrypted = await encryptPayload(bytes, password, this.kind);

    return {
      filename,
      contentType,
      ciphertextBase64: encrypted.ciphertextBase64,
      metadata: encrypted.metadata
    };
  }

  async decryptBytes(asset: EncryptedBinaryAsset, password: string): Promise<ArrayBuffer> {
    return decryptPayload(
      {
        ciphertextBase64: asset.ciphertextBase64,
        metadata: asset.metadata
      },
      password
    );
  }
}

async function encryptPayload(
  plaintextBuffer: ArrayBuffer,
  password: string,
  kind: EncryptionMetadata["kind"]
): Promise<EncryptedBundle> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 250000;
    const key = await derivePasswordKey(password, salt, iterations);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBuffer);

    return {
      ciphertextBase64: toBase64(ciphertext),
      metadata: {
        kind,
        algorithm: "AES-GCM",
        kdf: "PBKDF2",
        saltBase64: toBase64(salt.buffer),
        ivBase64: toBase64(iv.buffer),
        iterations
      }
    };
  }

async function decryptPayload(bundle: EncryptedBundle, password: string) {
  const salt = new Uint8Array(fromBase64(bundle.metadata.saltBase64));
  const iv = new Uint8Array(fromBase64(bundle.metadata.ivBase64));
  const key = await derivePasswordKey(password, salt, bundle.metadata.iterations);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(bundle.ciphertextBase64));
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
  const bytes = new Uint8Array(input);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function fromBase64(input: string) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}
