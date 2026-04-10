export type StorageKind = "vercel-blob" | "ipfs" | "local-dev";
export type RegistryKind = "vercel-postgres" | "vercel-kv" | "ipfs";
export type EncryptionKind =
  | "password-aes-gcm"
  | "passkey-envelope"
  | "wallet-recipient"
  | "team-public-key";
export type ChainKind = "none" | "evm";

export interface StorageDescriptor {
  kind: StorageKind;
  locator: string;
  contentType?: string;
}

export interface EncryptionMetadata {
  kind: EncryptionKind;
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  saltBase64: string;
  ivBase64: string;
  iterations: number;
}

export interface SignatureEnvelope {
  algorithm: "hmac-sha256" | "ed25519";
  keyId: string;
  signature: string;
}

export interface PublicProofManifest {
  id: string;
  version: "1";
  createdAt: string;
  originalImageHash: string;
  watermarkedImageHash: string;
  exifSubsetHash: string;
  watermarkLabel: string;
  storage: {
    watermarkedAsset: StorageDescriptor;
    encryptedBundle: StorageDescriptor;
  };
  signature: SignatureEnvelope;
  chain: {
    kind: ChainKind;
    reference?: string;
  };
}

export interface PrivateProvenanceBundle {
  originalFilename: string;
  capturedAt?: string;
  exif: Record<string, unknown>;
  context?: Record<string, unknown>;
  notes?: string;
}

export interface EncryptedBinaryAsset {
  filename: string;
  contentType: string;
  ciphertextBase64: string;
  metadata: EncryptionMetadata;
}
