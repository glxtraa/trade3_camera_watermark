import type { StorageDescriptor } from "@/lib/proof/types";

export interface UploadableAsset {
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
}

export interface StorageAdapter {
  kind: StorageDescriptor["kind"];
  put(asset: UploadableAsset): Promise<StorageDescriptor>;
}
