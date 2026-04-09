import { NextResponse } from "next/server";
import { createProofRecord } from "@/lib/server/proof-record";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const watermarkedFile = formData.get("watermarkedFile");
    const encryptedBundle = formData.get("encryptedBundle");
    const originalImageHash = formData.get("originalImageHash");
    const watermarkedImageHash = formData.get("watermarkedImageHash");
    const exifSubsetHash = formData.get("exifSubsetHash");
    const watermarkLabel = formData.get("watermarkLabel");

    if (!(watermarkedFile instanceof File)) {
      return NextResponse.json({ error: "Missing watermarked file." }, { status: 400 });
    }

    if (
      typeof encryptedBundle !== "string" ||
      typeof originalImageHash !== "string" ||
      typeof watermarkedImageHash !== "string" ||
      typeof exifSubsetHash !== "string" ||
      typeof watermarkLabel !== "string"
    ) {
      return NextResponse.json({ error: "Invalid proof payload." }, { status: 400 });
    }

    const result = await createProofRecord({
      watermarkedFile,
      encryptedBundle: JSON.parse(encryptedBundle),
      originalImageHash,
      watermarkedImageHash,
      exifSubsetHash,
      watermarkLabel
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create proof record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
