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
import { sha256Hex } from "@/lib/proof/hash";
import { createWatermarkedJpeg } from "@/lib/proof/watermark";
import type { PrivateProvenanceBundle } from "@/lib/proof/types";

interface ResultState {
  id: string;
  verifyUrl: string;
  manifestUrl: string;
  watermarkedUrl: string;
}

export function CreateProofForm() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkLabel, setWatermarkLabel] = useState("Trade3 Authentic");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Choose a photo first.");
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
      const encryptedBundle = await getEncryptionProvider("password-aes-gcm").encrypt(
        bundle,
        password
      );

      setStatus("Uploading proof record...");
      const formData = new FormData();
      formData.set("watermarkedFile", watermarkedFile);
      formData.set("encryptedBundle", JSON.stringify(encryptedBundle));
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
      setStatus("Proof created.");
    } catch (submitError) {
      setStatus(null);
      setError(submitError instanceof Error ? submitError.message : "Proof creation failed.");
    }
  }

  return (
    <div className="panel-grid create-grid">
      <section className="panel">
        <p className="eyebrow">Capture</p>
        <h1>Create a proof record</h1>
        <p className="lede">
          Select or capture a photo, set the visible watermark text, and protect
          the provenance bundle with a password before upload.
        </p>

        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span>Photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

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
            <span>Bundle password</span>
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
        <p className="eyebrow">Preview</p>
        <h2>Selected image</h2>
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
        {!previewUrl ? <p className="lede">No image selected yet.</p> : null}

        {result ? (
          <div className="result-card">
            <h2>Proof created</h2>
            <p className="lede">Record id: {result.id}</p>
            <a href={result.verifyUrl} className="button secondary">
              Open verification page
            </a>
            <a href={result.watermarkedUrl} className="button secondary">
              Open watermarked image
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
