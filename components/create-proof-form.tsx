"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import ExifReader from "exifreader";
import { getEncryptionProvider } from "@/lib/crypto/encryption";
import {
  normalizeExifSubset,
  canonicalizeValue,
  buildVisibleExifLines
} from "@/lib/proof/canonical";
import { LocationPreviewMap } from "@/components/location-preview-map";
import type { EncryptedBinaryAsset } from "@/lib/proof/types";
import { sha256Hex } from "@/lib/proof/hash";
import { createWatermarkedJpeg } from "@/lib/proof/watermark";
import type { PrivateProvenanceBundle } from "@/lib/proof/types";

interface ResultState {
  id: string;
  verifyUrl: string;
  manifestUrl: string;
  protectedImageUrl: string;
  ipfsManifestUrl: string | null;
}

export function CreateProofForm() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkLabel, setWatermarkLabel] = useState("Trade3 Authentic");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadToIpfs, setUploadToIpfs] = useState(false);
  const [metadataPreview, setMetadataPreview] = useState<string[]>([]);
  const [metadataStatus, setMetadataStatus] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [reverseLocation, setReverseLocation] = useState<{
    displayName: string | null;
  } | null>(null);
  const [reverseLocationStatus, setReverseLocationStatus] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const shareUrl = useMemo(() => {
    if (!result) {
      return "";
    }

    if (typeof window === "undefined") {
      return result.verifyUrl;
    }

    return new URL(result.verifyUrl, window.location.origin).toString();
  }, [result]);
  const runtimeMetadataLines = useMemo(() => {
    const lines: string[] = [];

    if (liveLocation) {
      lines.push(
        `Live GPS: ${liveLocation.latitude.toFixed(6)}, ${liveLocation.longitude.toFixed(6)}`
      );
      lines.push(`GPS accuracy: ${Math.round(liveLocation.accuracy)} m`);
      lines.push(`GPS captured: ${liveLocation.capturedAt}`);
    }

    if (reverseLocation?.displayName) {
      lines.push(`Address: ${reverseLocation.displayName}`);
    }

    const deviceLine = getDeviceContextLine();
    if (deviceLine) {
      lines.push(deviceLine);
    }

    return lines;
  }, [liveLocation, reverseLocation]);
  const combinedMetadataLines = useMemo(
    () => [...metadataPreview, ...runtimeMetadataLines],
    [metadataPreview, runtimeMetadataLines]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMetadataPreview() {
      if (!file) {
        setMetadataPreview([]);
        setMetadataStatus(null);
        setReverseLocation(null);
        setReverseLocationStatus(null);
        return;
      }

      setMetadataStatus("Reading metadata from captured image...");

      try {
        const exifTags = await ExifReader.load(file, { expanded: true });
        const lines = buildVisibleExifLines(exifTags as unknown as Record<string, unknown>);

        if (cancelled) {
          return;
        }

        setMetadataPreview(lines);
        setMetadataStatus(
          lines.length
            ? "These are the metadata lines that will be stamped onto the protected image."
            : "No readable EXIF/GPS metadata was found in this image."
        );
      } catch {
        if (cancelled) {
          return;
        }

        setMetadataPreview([]);
        setMetadataStatus("This image does not expose readable metadata to the browser.");
      }
    }

    void loadMetadataPreview();

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    let cancelled = false;

    async function captureLiveLocation() {
      if (!file) {
        setLiveLocation(null);
        setLocationStatus(null);
        setReverseLocation(null);
        setReverseLocationStatus(null);
        return;
      }

      if (!navigator.geolocation) {
        setLiveLocation(null);
        setLocationStatus("This browser does not support live location capture.");
        return;
      }

      setLocationStatus("Requesting live location from the device...");

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
          });
        });

        if (cancelled) {
          return;
        }

        setLiveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString()
        });
        setLocationStatus("Live device location captured and will be added to the watermark.");
      } catch (locationError) {
        if (cancelled) {
          return;
        }

        setLiveLocation(null);
        setLocationStatus(
          locationError instanceof GeolocationPositionError
            ? `Live location unavailable: ${formatGeolocationError(locationError)}`
            : "Live location unavailable on this device/browser session."
        );
      }
    }

    void captureLiveLocation();

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    let cancelled = false;

    async function reverseGeocodeLiveLocation() {
      if (!liveLocation) {
        setReverseLocation(null);
        setReverseLocationStatus(null);
        return;
      }

      setReverseLocationStatus("Looking up the nearest OpenStreetMap address...");

      try {
        const response = await fetch(
          `/api/location/reverse?lat=${encodeURIComponent(String(liveLocation.latitude))}&lon=${encodeURIComponent(String(liveLocation.longitude))}`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Reverse geocoding failed.");
        }

        if (cancelled) {
          return;
        }

        setReverseLocation({
          displayName: payload.displayName ?? null
        });
        setReverseLocationStatus(
          payload.displayName
            ? "Nearest OpenStreetMap address found and added to the watermark."
            : "No nearby OpenStreetMap address was found for this location."
        );
      } catch (reverseError) {
        if (cancelled) {
          return;
        }

        setReverseLocation(null);
        setReverseLocationStatus(
          reverseError instanceof Error ? reverseError.message : "Reverse geocoding unavailable."
        );
      }
    }

    void reverseGeocodeLiveLocation();

    return () => {
      cancelled = true;
    };
  }, [liveLocation]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Take a picture first.");
      return;
    }

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setStatus("Extracting metadata and generating watermark...");

    try {
      const exifTags = await ExifReader.load(file, { expanded: true });
      const visibleExifLines =
        combinedMetadataLines.length > 0
          ? combinedMetadataLines
          : [
              ...buildVisibleExifLines(exifTags as unknown as Record<string, unknown>),
              ...runtimeMetadataLines
            ];
      const exifSubset = normalizeExifSubset({
        ...(exifTags.exif ?? {}),
        ...(exifTags.gps ?? {})
      });
      const originalImageHash = await sha256Hex(await file.arrayBuffer());

      const watermarkedFile = await createWatermarkedJpeg(file, watermarkLabel, visibleExifLines);
      const watermarkedImageHash = await sha256Hex(await watermarkedFile.arrayBuffer());
      const exifSubsetHash = await sha256Hex(canonicalizeValue(exifSubset));

      const bundle: PrivateProvenanceBundle = {
        originalFilename: file.name,
        capturedAt: exifSubset.dateTimeOriginal,
        exif: exifTags as unknown as Record<string, unknown>,
        context: {
          liveLocation,
          device: getDeviceContextLine()
        },
        notes: "MVP password-protected provenance bundle."
      };

      setStatus("Encrypting provenance bundle...");
      const provider = getEncryptionProvider("password-aes-gcm");
      const encryptedBundle = await provider.encrypt(bundle, password);
      const encryptedWatermarkedAsset: EncryptedBinaryAsset = await provider.encryptBytes(
        await watermarkedFile.arrayBuffer(),
        password,
        watermarkedFile.name,
        watermarkedFile.type || "image/jpeg"
      );

      setStatus("Uploading proof record...");
      const formData = new FormData();
      formData.set("encryptedBundle", JSON.stringify(encryptedBundle));
      formData.set("encryptedWatermarkedAsset", JSON.stringify(encryptedWatermarkedAsset));
      formData.set("originalImageHash", originalImageHash);
      formData.set("watermarkedImageHash", watermarkedImageHash);
      formData.set("exifSubsetHash", exifSubsetHash);
      formData.set("watermarkLabel", watermarkLabel);
      formData.set("uploadToIpfs", String(uploadToIpfs));

      const response = await fetch("/api/proofs", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create the proof record.");
      }

      setResult(payload as ResultState);
      setCopied(false);
      setStatus("Proof created. Share the verification link and send the password separately.");
    } catch (submitError) {
      setStatus(null);
      setError(submitError instanceof Error ? submitError.message : "Proof creation failed.");
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  async function handleShareLink() {
    if (!shareUrl) {
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: "Trade3 proof link",
        text: "Open this link and enter the password to view and authenticate the image.",
        url: shareUrl
      });
      return;
    }

    await handleCopyLink();
  }

  return (
    <div className="panel-grid create-grid">
      <section className="panel">
        <p className="eyebrow">Capture</p>
        <h1>Create a protected proof</h1>
        <p className="lede">
          Take a photo, choose a password, and create one link you can send to
          someone else. They will open the link, enter the password, and the app
          will show and authenticate the protected image.
        </p>

        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <span>Take picture</span>
            <input
              id="trade3-capture-input"
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <label htmlFor="trade3-capture-input" className="button primary button-label">
              Take picture
            </label>
            <p className="field-hint">
              {file ? `Selected: ${file.name}` : "This opens the camera first on mobile."}
            </p>
          </div>
          <p className="field-hint">
            You can still choose an existing image if needed.
          </p>

          <label className="field">
            <span>Watermark label</span>
            <input
              type="text"
              value={watermarkLabel}
              maxLength={60}
              onChange={(event) => setWatermarkLabel(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Password for recipient access</span>
            <input
              type="password"
              value={password}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={uploadToIpfs}
              onChange={(event) => setUploadToIpfs(event.target.checked)}
            />
            <span>Also pin encrypted proof assets to IPFS</span>
          </label>
          {uploadToIpfs ? (
            <p className="field-hint">
              This keeps the normal Trade3 storage flow and also sends encrypted assets to IPFS.
            </p>
          ) : null}

          <button type="submit" className="button primary">
            Create proof
          </button>
        </form>

        {status ? <p className="status">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <p className="eyebrow">Share</p>
        <h2>Picture preview</h2>
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Selected preview"
            width={1200}
            height={900}
            className="preview"
            unoptimized
          />
        ) : null}
        {!previewUrl ? <p className="lede">No picture captured yet.</p> : null}
        {metadataStatus ? <p className="status">{metadataStatus}</p> : null}
        {locationStatus ? <p className="status">{locationStatus}</p> : null}
        {reverseLocationStatus ? <p className="status">{reverseLocationStatus}</p> : null}
        {combinedMetadataLines.length ? (
          <div className="result-card">
            <h2>EXIF and live metadata found immediately after capture</h2>
            <ul className="meta-list">
              {combinedMetadataLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {!combinedMetadataLines.some((line) => line.includes("GPS")) ? (
              <p className="lede">
                GPS was not found in this file. That usually means location data
                was not saved by the camera or was stripped before upload.
              </p>
            ) : null}
          </div>
        ) : null}
        {liveLocation ? (
          <div className="result-card">
            <h2>Location preview</h2>
            <p className="lede">
              Confidence area: approximately {Math.round(liveLocation.accuracy)} meters from the
              captured point.
            </p>
            {reverseLocation?.displayName ? (
              <p className="lede">Possible address: {reverseLocation.displayName}</p>
            ) : (
              <p className="lede">
                Possible address is not available yet. The map still shows the captured area.
              </p>
            )}
            <div className="map-frame">
              <LocationPreviewMap
                latitude={liveLocation.latitude}
                longitude={liveLocation.longitude}
                accuracy={liveLocation.accuracy}
              />
            </div>
            <a
              className="button secondary"
              href={buildOpenStreetMapOpenUrl(liveLocation.latitude, liveLocation.longitude)}
              target="_blank"
              rel="noreferrer"
            >
              Open in OpenStreetMap
            </a>
          </div>
        ) : null}

        {result ? (
          <div className="result-card">
            <h2>Send this link</h2>
            <p className="lede">
              Anyone with this link can open the proof page. Only someone with
              the password can unlock and authenticate the image.
            </p>
            <label className="field">
              <span>Verification link</span>
              <input type="text" readOnly value={shareUrl} />
            </label>
            <div className="actions">
              <button type="button" className="button primary" onClick={() => void handleShareLink()}>
                Share link
              </button>
              <button type="button" className="button secondary" onClick={() => void handleCopyLink()}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="lede">Send the password separately, not in the same message.</p>
            <p className="lede">Record id: {result.id}</p>
            {result.ipfsManifestUrl ? (
              <a href={result.ipfsManifestUrl} className="button secondary" target="_blank" rel="noreferrer">
                Open IPFS manifest
              </a>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function buildOpenStreetMapOpenUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}

function getDeviceContextLine() {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  const ua = navigator.userAgent;
  const isIphone = /iPhone/i.test(ua);
  const isIpad = /iPad/i.test(ua);
  const iosVersionMatch = ua.match(/OS (\d+[_\d]*) like Mac OS X/i);
  const iosVersion = iosVersionMatch?.[1]?.replace(/_/g, ".");
  const browser =
    /CriOS/i.test(ua) ? "Chrome" :
    /FxiOS/i.test(ua) ? "Firefox" :
    /EdgiOS/i.test(ua) ? "Edge" :
    /Safari/i.test(ua) ? "Safari" :
    "Browser";

  if (isIphone) {
    return `Device: iPhone${iosVersion ? ` | iOS ${iosVersion}` : ""} | ${browser}`;
  }

  if (isIpad) {
    return `Device: iPad${iosVersion ? ` | iPadOS ${iosVersion}` : ""} | ${browser}`;
  }

  return `Device: ${browser}`;
}

function formatGeolocationError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "permission denied";
    case error.POSITION_UNAVAILABLE:
      return "position unavailable";
    case error.TIMEOUT:
      return "request timed out";
    default:
      return "unknown error";
  }
}
