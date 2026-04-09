import { NextResponse } from "next/server";
import { getProofRecord } from "@/lib/server/proof-record";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const record = await getProofRecord(params.id);
    if (!record) {
      return NextResponse.json({ error: "Proof record not found." }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load proof record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
