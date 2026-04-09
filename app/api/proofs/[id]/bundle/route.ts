import { NextResponse } from "next/server";
import { getProofBundle } from "@/lib/server/proof-record";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bundle = await getProofBundle(params.id);
    if (!bundle) {
      return NextResponse.json({ error: "Proof record not found." }, { status: 404 });
    }

    return NextResponse.json(bundle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load encrypted bundle.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
