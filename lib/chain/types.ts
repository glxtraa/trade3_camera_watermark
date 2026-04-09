import type { PublicProofManifest } from "@/lib/proof/types";

export interface ChainAnchor {
  anchor(manifest: PublicProofManifest): Promise<{ reference: string }>;
}
