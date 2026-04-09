import type { PublicProofManifest } from "@/lib/proof/types";
import type { ProofRegistry } from "@/lib/registry/types";

export class VercelRegistry implements ProofRegistry {
  kind = "vercel-postgres" as const;

  async create(_manifest: PublicProofManifest): Promise<void> {
    throw new Error("Vercel registry persistence is not implemented yet.");
  }

  async getById(_id: string): Promise<PublicProofManifest | null> {
    throw new Error("Vercel registry lookup is not implemented yet.");
  }
}
