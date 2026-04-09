import type { StorageAdapter, UploadableAsset } from "@/lib/storage/types";
import type { StorageDescriptor } from "@/lib/proof/types";

export class IpfsStorageAdapter implements StorageAdapter {
  kind = "ipfs" as const;

  async put(_asset: UploadableAsset): Promise<StorageDescriptor> {
    throw new Error("IPFS storage is reserved for a later phase.");
  }
}
