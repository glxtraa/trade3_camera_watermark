import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import type { StorageDescriptor } from "@/lib/proof/types";

const localRoot = "/tmp/trade3-camera-watermark";

export async function putJson(pathname: string, value: unknown, access: "public" | "private") {
  return putAsset(pathname, JSON.stringify(value, null, 2), "application/json", access);
}

export async function putAsset(
  pathname: string,
  body: Blob | Buffer | ArrayBuffer | string,
  contentType: string,
  access: "public" | "private"
): Promise<StorageDescriptor> {
  if (hasBlobToken()) {
    const blob = await put(pathname, body, {
      access,
      contentType,
      addRandomSuffix: false
    });

    return {
      kind: "vercel-blob",
      locator: blob.url,
      contentType
    };
  }

  const fullPath = path.join(localRoot, pathname);
  await mkdir(path.dirname(fullPath), { recursive: true });

  const bytes =
    typeof body === "string"
      ? Buffer.from(body)
      : body instanceof Blob
        ? Buffer.from(await body.arrayBuffer())
        : body instanceof ArrayBuffer
          ? Buffer.from(body)
          : body;

  await writeFile(fullPath, bytes);

  return {
    kind: "local-dev",
    locator: fullPath,
    contentType
  };
}

export async function readJson<T>(descriptor: StorageDescriptor) {
  if (descriptor.kind === "local-dev") {
    const payload = await readFile(descriptor.locator, "utf8");
    return JSON.parse(payload) as T;
  }

  const response = await fetch(descriptor.locator, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch blob asset: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function readAsset(descriptor: StorageDescriptor) {
  if (descriptor.kind === "local-dev") {
    const payload = await readFile(descriptor.locator);
    return {
      bytes: payload,
      contentType: descriptor.contentType || "application/octet-stream"
    };
  }

  const response = await fetch(descriptor.locator, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch blob asset: ${response.status}`);
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType:
      response.headers.get("content-type") || descriptor.contentType || "application/octet-stream"
  };
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
