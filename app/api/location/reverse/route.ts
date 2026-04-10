import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      {
        headers: {
          "User-Agent": "Trade3ProofCamera/1.0"
        },
        cache: "no-store"
      }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Reverse geocoding failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    const payload = await upstream.json();

    return NextResponse.json({
      displayName: typeof payload.display_name === "string" ? payload.display_name : null,
      address: payload.address ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reverse geocoding failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
