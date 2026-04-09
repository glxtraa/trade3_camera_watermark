"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import ExifReader from "exifreader";
import { getEncryptionProvider } from "@/lib/crypto/encryption";
import {
  normalizeExifSubset,
  canonicalizeValue,
  buildVisibleExifLines
} from "@/lib/proof/canonical";
import type { EncryptedBinaryAsset } from "@/lib/proof/types";
import { sha256Hex } from "@/lib/proof/hash";
import { createWatermarkedJpeg } from "@/lib/proof/watermark";
import type { PrivateProvenanceBundle } from "@/lib/proof/types";

interface ResultState {
  id: string;
  verifyUrl: string;
  manifestUrl: string;
  protectedImageUrl: string;
}

export function CreateProofForm() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkLabel, setWatermarkLabel] = useState("Trade3 Authentic");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [copied, setCopied] = useState(false);

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
      const visibleExifLines = buildVisibleExifLines(exifTags as unknown as Record<string, unknown>);
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
          <label className="field">
            <span>Take picture</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="field-hint">
            On mobile this opens the camera first. You can still choose an existing image if needed.
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
          </div>
        ) : null}
      </section>
    </div>
  );
}
