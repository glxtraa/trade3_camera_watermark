import { NextResponse } from "next/server";
import { createProofRecord } from "@/lib/server/proof-record";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const watermarkedFile = formData.get("watermarkedFile");
    const encryptedBundle = formData.get("encryptedBundle");
    const encryptedWatermarkedAsset = formData.get("encryptedWatermarkedAsset");
    const originalImageHash = formData.get("originalImageHash");
    const watermarkedImageHash = formData.get("watermarkedImageHash");
    const exifSubsetHash = formData.get("exifSubsetHash");
    const watermarkLabel = formData.get("watermarkLabel");
    const storageMode = formData.get("storageMode");

    if (
      typeof encryptedBundle !== "string" ||
      typeof encryptedWatermarkedAsset !== "string" ||
      typeof originalImageHash !== "string" ||
      typeof watermarkedImageHash !== "string" ||
      typeof exifSubsetHash !== "string" ||
      typeof watermarkLabel !== "string"
    ) {
      return NextResponse.json({ error: "Invalid proof payload." }, { status: 400 });
    }

    const result = await createProofRecord({
      encryptedBundle: JSON.parse(encryptedBundle),
      encryptedWatermarkedAsset: JSON.parse(encryptedWatermarkedAsset),
      originalImageHash,
      watermarkedImageHash,
      exifSubsetHash,
      watermarkLabel,
      storageMode:
        storageMode === "trade3-ipfs-mirror" || storageMode === "ipfs-only"
          ? storageMode
          : "trade3"
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create proof record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
