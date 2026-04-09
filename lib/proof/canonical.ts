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

  const lines = [
    buildSummaryLine("Camera", [
      readTag(exif.LensModel),
      readTag(image.Make),
      readTag(image.Model)
    ]),
    buildSummaryLine("Captured", [
      readTag(exif.DateTimeOriginal),
      readTag(exif.OffsetTimeOriginal)
    ]),
    buildSummaryLine("GPS", [
      formatGpsCoordinate(readTag(gps.GPSLatitude), readTag(gps.GPSLatitudeRef)),
      formatGpsCoordinate(readTag(gps.GPSLongitude), readTag(gps.GPSLongitudeRef))
    ]),
    buildSummaryLine("Altitude", [readTag(gps.GPSAltitude)]),
    buildSummaryLine("Software", [
      readTag(image.Software),
      readTag(exif.Software),
      readTag(file.Software)
    ]),
    buildSummaryLine("Device", [
      readTag(image.HostComputer),
      readTag(image.Artist)
    ]),
    buildSummaryLine("Exposure", [
      readTag(exif.ExposureTime),
      readTag(exif.FNumber),
      readTag(exif.ISOSpeedRatings) || readTag(exif.ISO)
    ]),
    buildSummaryLine("Image", [
      readTag(file.FileType),
      readTag(image.Orientation),
      readTag(image.XResolution),
      readTag(image.YResolution)
    ])
  ].filter((value): value is string => Boolean(value));

  const rawLines = collectRawVisibleLines(groups);
  return dedupeLines([...lines, ...rawLines]);
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

function readTag(entry: unknown) {
  return extractVisibleValue(entry);
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

function collectRawVisibleLines(groups: Record<string, unknown>) {
  const preferredGroups = ["gps", "exif", "image", "file"];
  const lines: string[] = [];

  for (const groupName of preferredGroups) {
    const group = groups[groupName];
    if (!group || typeof group !== "object") {
      continue;
    }

    const entries = Object.entries(group as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [formatTagName(key), extractVisibleValue(value)] as const)
      .filter(([, value]) => Boolean(value));

    for (const [key, value] of entries) {
      lines.push(trimLine(`${key}: ${value}`));
    }
  }

  return lines;
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
