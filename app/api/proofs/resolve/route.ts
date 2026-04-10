import { NextResponse } from "next/server";
import { manifestPayloadForSigning } from "@/lib/proof/canonical";
import type { PublicProofManifest } from "@/lib/proof/types";
import { verifyManifestPayload } from "@/lib/server/signature";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const manifestUrl = searchParams.get("manifestUrl");

  if (!manifestUrl) {
    return NextResponse.json({ error: "manifestUrl is required." }, { status: 400 });
  }

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch manifest." }, { status: 502 });
    }

    const manifest = (await response.json()) as PublicProofManifest;
    const payload = manifestPayloadForSigning({
      id: manifest.id,
      version: manifest.version,
      createdAt: manifest.createdAt,
      originalImageHash: manifest.originalImageHash,
      watermarkedImageHash: manifest.watermarkedImageHash,
      exifSubsetHash: manifest.exifSubsetHash,
      watermarkLabel: manifest.watermarkLabel,
      storage: manifest.storage,
      mirrors: manifest.mirrors,
      chain: manifest.chain
    });

    return NextResponse.json({
      manifest,
      manifestVerified: verifyManifestPayload(payload, manifest.signature.signature)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve manifest.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
