import path from "node:path";
import { list } from "@vercel/blob";
import { putAsset, putJson, readAsset, readJson } from "@/lib/server/blob-store";
import { pinJsonToIpfs } from "@/lib/server/ipfs";
import { manifestPayloadForSigning } from "@/lib/proof/canonical";
import type { EncryptedBinaryAsset, PublicProofManifest } from "@/lib/proof/types";
import { signManifestPayload, verifyManifestPayload } from "@/lib/server/signature";

const localRoot = "/tmp/trade3-camera-watermark/proofs";

export interface CreateProofInput {
  originalImageHash: string;
  watermarkedImageHash: string;
  exifSubsetHash: string;
  watermarkLabel: string;
  encryptedBundle: {
    ciphertextBase64: string;
    metadata: {
      kind: "password-aes-gcm";
      algorithm: "AES-GCM";
      kdf: "PBKDF2";
      saltBase64: string;
      ivBase64: string;
      iterations: number;
    };
  };
  encryptedWatermarkedAsset: EncryptedBinaryAsset;
  storageMode?: "trade3" | "trade3-ipfs-mirror" | "ipfs-only";
}

export async function createProofRecord(input: CreateProofInput) {
  const id = crypto.randomUUID();
  const storageMode = input.storageMode ?? "trade3";
  const useTrade3 = storageMode !== "ipfs-only";
  const useIpfs = storageMode !== "trade3";

  const watermarkedAsset = useTrade3
    ? await putJson(`proofs/${id}/watermarked.json`, input.encryptedWatermarkedAsset, "public")
    : await pinJsonToIpfs(`${id}-watermarked.json`, input.encryptedWatermarkedAsset);
  const encryptedBundle = useTrade3
    ? await putJson(`proofs/${id}/bundle.json`, input.encryptedBundle, "public")
    : await pinJsonToIpfs(`${id}-bundle.json`, input.encryptedBundle);

  const unsignedManifest = {
    id,
    version: "1" as const,
    createdAt: new Date().toISOString(),
    originalImageHash: input.originalImageHash,
    watermarkedImageHash: input.watermarkedImageHash,
    exifSubsetHash: input.exifSubsetHash,
    watermarkLabel: input.watermarkLabel,
    storage: {
      watermarkedAsset,
      encryptedBundle
    },
    mirrors: undefined as PublicProofManifest["mirrors"],
    chain: {
      kind: "none" as const
    }
  };

  if (useIpfs && useTrade3) {
    const ipfsWatermarkedAsset = await pinJsonToIpfs(
      `${id}-watermarked.json`,
      input.encryptedWatermarkedAsset
    );
    const ipfsEncryptedBundle = await pinJsonToIpfs(`${id}-bundle.json`, input.encryptedBundle);

    unsignedManifest.mirrors = {
      ipfs: {
        watermarkedAsset: ipfsWatermarkedAsset,
        encryptedBundle: ipfsEncryptedBundle
      }
    };
  }

  const payload = manifestPayloadForSigning(unsignedManifest);
  const manifest: PublicProofManifest = {
    ...unsignedManifest,
    signature: {
      algorithm: "hmac-sha256",
      keyId: "app-server-v1",
      signature: signManifestPayload(payload)
    }
  };

  let ipfsManifestUrl: string | null = null;
  if (useIpfs) {
    const ipfsManifest = await pinJsonToIpfs(`${id}-manifest.json`, manifest);
    if (useTrade3 && manifest.mirrors?.ipfs) {
      manifest.mirrors.ipfs.manifest = ipfsManifest;
    }
    ipfsManifestUrl = ipfsManifest.locator;
  } 

  const manifestAsset = useTrade3
    ? await putJson(`proofs/${id}/manifest.json`, manifest, "public")
    : null;

  return {
    id,
    verifyUrl:
      useTrade3 || !ipfsManifestUrl
        ? `/verify?id=${id}`
        : `/verify?manifest=${encodeURIComponent(ipfsManifestUrl)}`,
    manifestUrl: manifestAsset?.locator ?? ipfsManifestUrl,
    protectedImageUrl: useTrade3 ? `/api/proofs/${id}/watermarked` : watermarkedAsset.locator,
    ipfsManifestUrl
  };
}

export async function getProofRecord(id: string) {
  const descriptor = await findManifestDescriptor(id);
  if (!descriptor) {
    return null;
  }

  const manifest = await readJson<PublicProofManifest>(descriptor);
  const payload = manifestPayloadForSigning({
    id: manifest.id,
    version: manifest.version,
    createdAt: manifest.createdAt,
    originalImageHash: manifest.originalImageHash,
    watermarkedImageHash: manifest.watermarkedImageHash,
    exifSubsetHash: manifest.exifSubsetHash,
    watermarkLabel: manifest.watermarkLabel,
    storage: manifest.storage,
    chain: manifest.chain
  });

  return {
    manifest,
    manifestVerified: verifyManifestPayload(payload, manifest.signature.signature)
  };
}

export async function getProofBundle(id: string) {
  const record = await getProofRecord(id);
  if (!record) {
    return null;
  }

  return readJson(record.manifest.storage.encryptedBundle);
}

export async function getWatermarkedAsset(id: string) {
  const record = await getProofRecord(id);
  if (!record) {
    return null;
  }

  return readJson(record.manifest.storage.watermarkedAsset);
}

async function findManifestDescriptor(id: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const pathname = path.join(localRoot, id, "manifest.json");
    return {
      kind: "local-dev" as const,
      locator: pathname,
      contentType: "application/json"
    };
  }

  const result = await list({
    prefix: `proofs/${id}/manifest.json`,
    limit: 1
  });

  const blob = result.blobs[0];
  if (!blob) {
    return null;
  }

  return {
    kind: "vercel-blob" as const,
    locator: blob.url,
    contentType: "application/json"
  };
}
