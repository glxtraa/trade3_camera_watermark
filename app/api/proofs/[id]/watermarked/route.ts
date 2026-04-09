import { NextResponse } from "next/server";
import { getWatermarkedAsset } from "@/lib/server/proof-record";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const asset = await getWatermarkedAsset(params.id);
    if (!asset) {
      return NextResponse.json({ error: "Proof record not found." }, { status: 404 });
    }

    return new NextResponse(asset.bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load watermarked asset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
