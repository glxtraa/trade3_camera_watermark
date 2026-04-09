import type { PublicProofManifest } from "@/lib/proof/types";
import type { ChainAnchor } from "@/lib/chain/types";

export class EvmChainAnchor implements ChainAnchor {
  async anchor(_manifest: PublicProofManifest): Promise<{ reference: string }> {
    throw new Error("EVM anchoring is not implemented yet.");
  }
}
