import type { PublicProofManifest } from "@/lib/proof/types";

export interface CanonicalExifSubset {
  make?: string;
  model?: string;
  dateTimeOriginal?: string;
  offsetTimeOriginal?: string;
  latitude?: number;
  longitude?: number;
  orientation?: string;
}

export function normalizeExifSubset(tags: Record<string, unknown>): CanonicalExifSubset {
  return removeUndefined({
    make: readDescription(tags.Make),
    model: readDescription(tags.Model),
    dateTimeOriginal: readDescription(tags.DateTimeOriginal),
    offsetTimeOriginal: readDescription(tags.OffsetTimeOriginal),
    latitude: readNumeric(tags.latitude),
    longitude: readNumeric(tags.longitude),
    orientation: readDescription(tags.Orientation)
  });
}

export function canonicalizeValue(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function manifestPayloadForSigning(
  manifest: Omit<PublicProofManifest, "signature">
): string {
  return canonicalizeValue(manifest);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
    if (entry !== undefined && entry !== null && entry !== "") {
      accumulator[key] = entry;
    }

    return accumulator;
  }, {}) as T;
}

function readDescription(entry: unknown) {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  const candidate = (entry as { description?: unknown }).description;
  return typeof candidate === "string" ? candidate : undefined;
}

function readNumeric(entry: unknown) {
  if (typeof entry === "number") {
    return entry;
  }

  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  const value = (entry as { description?: unknown; value?: unknown }).value;
  if (typeof value === "number") {
    return value;
  }

  const description = (entry as { description?: unknown }).description;
  if (typeof description === "number") {
    return description;
  }

  return undefined;
}
