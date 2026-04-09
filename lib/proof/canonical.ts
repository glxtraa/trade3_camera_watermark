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

export function buildVisibleExifLines(groups: Record<string, unknown>) {
  const gps = readGroup(groups, "gps");
  const exif = readGroup(groups, "exif");
  const image = readGroup(groups, "image");
  const file = readGroup(groups, "file");

  return [
    buildSummaryLine("Camera", [
      readFirstTag(exif, ["LensModel"]),
      readFirstTag(image, ["Make"]),
      readFirstTag(image, ["Model"])
    ]),
    buildSummaryLine("Captured", [
      readFirstTag(exif, ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"]),
      readFirstTag(exif, ["OffsetTimeOriginal", "TimeZoneOffset"])
    ]),
    buildSummaryLine("GPS", [
      formatGpsCoordinate(
        readFirstTag(gps, ["GPSLatitude", "Latitude", "latitude"]),
        readFirstTag(gps, ["GPSLatitudeRef", "LatitudeRef"])
      ),
      formatGpsCoordinate(
        readFirstTag(gps, ["GPSLongitude", "Longitude", "longitude"]),
        readFirstTag(gps, ["GPSLongitudeRef", "LongitudeRef"])
      )
    ]),
    buildSummaryLine("Altitude", [readFirstTag(gps, ["GPSAltitude", "Altitude"])]),
    buildSummaryLine("Software", [
      readFirstTag(image, ["Software"]),
      readFirstTag(exif, ["Software"]),
      readFirstTag(file, ["Software", "FileType"])
    ]),
    buildSummaryLine("Device", [
      readFirstTag(image, ["HostComputer", "Artist"])
    ]),
    buildSummaryLine("Exposure", [
      readFirstTag(exif, ["ExposureTime"]),
      readFirstTag(exif, ["FNumber"]),
      readFirstTag(exif, ["ISOSpeedRatings", "ISO"])
    ]),
    buildSummaryLine("Image", [
      readFirstTag(file, ["FileType"]),
      readFirstTag(image, ["Orientation"]),
      readFirstTag(image, ["XResolution"]),
      readFirstTag(image, ["YResolution"])
    ])
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);
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

function dedupeLines(lines: string[]) {
  return [...new Set(lines)];
}

function trimLine(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function formatTagName(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");
}

function extractVisibleValue(entry: unknown): string | undefined {
  if (entry === null || entry === undefined) {
    return undefined;
  }

  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
    return String(entry);
  }

  if (Array.isArray(entry)) {
    const joined = entry
      .map((item) => extractVisibleValue(item))
      .filter((item): item is string => Boolean(item))
      .join(", ");
    return joined || undefined;
  }

  if (typeof entry === "object") {
    const candidate = entry as {
      description?: unknown;
      value?: unknown;
      id?: unknown;
    };

    if (typeof candidate.description === "string" || typeof candidate.description === "number") {
      return String(candidate.description);
    }

    if (
      typeof candidate.value === "string" ||
      typeof candidate.value === "number" ||
      typeof candidate.value === "boolean"
    ) {
      return String(candidate.value);
    }

    if (Array.isArray(candidate.value)) {
      const joined = candidate.value
        .map((item) => extractVisibleValue(item))
        .filter((item): item is string => Boolean(item))
        .join(", ");
      return joined || undefined;
    }
  }

  return undefined;
}

function readGroup(groups: Record<string, unknown>, key: string) {
  const group = groups[key];
  return group && typeof group === "object" ? (group as Record<string, unknown>) : {};
}

function buildSummaryLine(label: string, values: Array<string | undefined>) {
  const parts = values.filter((value): value is string => Boolean(value));
  if (!parts.length) {
    return undefined;
  }

  return trimLine(`${label}: ${parts.join(" | ")}`);
}

function formatGpsCoordinate(value?: string, ref?: string) {
  if (!value) {
    return undefined;
  }

  return ref ? `${value} ${ref}` : value;
}

function readFirstTag(group: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = extractVisibleValue(group[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
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
