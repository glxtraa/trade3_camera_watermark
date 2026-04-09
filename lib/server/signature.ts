import { createHmac, timingSafeEqual } from "node:crypto";

export function signManifestPayload(payload: string) {
  const secret = process.env.PROOF_HMAC_SECRET;
  if (!secret) {
    throw new Error("PROOF_HMAC_SECRET is required.");
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyManifestPayload(payload: string, signature: string) {
  const expected = signManifestPayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
