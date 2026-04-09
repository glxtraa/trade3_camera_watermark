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

    return NextResponse.json(asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load watermarked asset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
