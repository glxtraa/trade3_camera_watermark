import type { PublicProofManifest, RegistryKind } from "@/lib/proof/types";

export interface ProofRegistry {
  kind: RegistryKind;
  create(manifest: PublicProofManifest): Promise<void>;
  getById(id: string): Promise<PublicProofManifest | null>;
}
