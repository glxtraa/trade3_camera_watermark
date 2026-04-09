import type { StorageAdapter, UploadableAsset } from "@/lib/storage/types";
import type { StorageDescriptor } from "@/lib/proof/types";

export class VercelBlobStorageAdapter implements StorageAdapter {
  kind = "vercel-blob" as const;

  async put(_asset: UploadableAsset): Promise<StorageDescriptor> {
    throw new Error("Vercel Blob upload is not implemented yet.");
  }
}
