export const currentEncryptionMode = "password-based AES-GCM bundle encryption";
export const currentStorageMode = "Protected Trade3 proof storage";
export const currentVerificationMode = "signed manifest plus deterministic hashing";

export const appCapabilities = [
  "Mobile camera capture in the Trade3 proof app",
  "Visible watermark generation for a shareable derivative",
  "EXIF-derived provenance capture from the original file",
  "Password-protected private provenance bundle",
  "Public authenticity verification without decrypting private data"
];

export const plannedUpgrades = [
  "Stronger key custody via passkeys, device keys, or recipient encryption",
  "Optional IPFS storage adapter without changing the proof model",
  "EVM anchoring and NFT minting from finalized proof records"
];

export const verificationChecklist = [
  "Load candidate image and compute deterministic hash",
  "Fetch the stored public manifest by proof id or lookup key",
  "Validate the signature over the manifest payload",
  "Compare the candidate image hash to the signed record",
  "Optionally request password to decrypt the private provenance bundle"
];
