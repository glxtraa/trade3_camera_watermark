"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getEncryptionProvider, type EncryptedBundle } from "@/lib/crypto/encryption";
import { sha256Hex } from "@/lib/proof/hash";
import type { EncryptedBinaryAsset, PublicProofManifest } from "@/lib/proof/types";

interface LoadedRecord {
  manifest: PublicProofManifest;
  manifestVerified: boolean;
}

export function VerifyProofForm() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") ?? "";
  const initialManifestUrl = searchParams.get("manifest") ?? "";
  const [proofId, setProofId] = useState(initialId);
  const [manifestUrl, setManifestUrl] = useState(initialManifestUrl);
  const [record, setRecord] = useState<LoadedRecord | null>(null);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [decryptedBundle, setDecryptedBundle] = useState<string | null>(null);
  const [protectedPreviewUrl, setProtectedPreviewUrl] = useState<string | null>(null);
  const [showManualCompare, setShowManualCompare] = useState(false);
  const [showBundle, setShowBundle] = useState(false);

  const previewUrl = useMemo(
    () => (candidateFile ? URL.createObjectURL(candidateFile) : null),
    [candidateFile]
  );

  const loadRecord = useCallback(async (idOverride?: string) => {
    const id = (idOverride ?? proofId).trim();
    const manifest = manifestUrl.trim();
    if (!id && !manifest) {
      setError("Enter a proof id or manifest URL first.");
      return;
    }

    setStatus("Loading proof record...");
    setError(null);
    setVerificationResult(null);
    setDecryptedBundle(null);
    setProtectedPreviewUrl(null);

    try {
      const response = manifest
        ? await fetch(`/api/proofs/resolve?manifestUrl=${encodeURIComponent(manifest)}`)
        : await fetch(`/api/proofs/${id}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load proof record.");
      }

      setRecord(payload as LoadedRecord);
      setStatus("Proof record loaded.");
    } catch (loadError) {
      setRecord(null);
      setStatus(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load proof record.");
    }
  }, [proofId, manifestUrl]);

  useEffect(() => {
    if (initialId || initialManifestUrl) {
      void loadRecord(initialId);
    }
  }, [initialId, initialManifestUrl, loadRecord]);

  async function verifyCandidate() {
    if (!candidateFile || !record) {
      setError("Load a proof and select the candidate image.");
      return;
    }

    setError(null);
    setStatus("Hashing candidate image...");

    try {
      const hash = await sha256Hex(await candidateFile.arrayBuffer());
      const matches = hash === record.manifest.watermarkedImageHash;
      setVerificationResult(
        matches
          ? "Authentic: the uploaded image matches the signed watermarked proof."
          : "Mismatch: the uploaded image does not match the signed watermarked proof."
      );
      setStatus("Verification complete.");
    } catch (verifyError) {
      setStatus(null);
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
    }
  }

  async function decryptBundle() {
    if (!record) {
      setError("Load a proof record before attempting decryption.");
      return;
    }

    if (!password) {
      setError("Enter the bundle password.");
      return;
    }

    setStatus("Fetching encrypted provenance bundle...");
    setError(null);

    try {
      const response = await fetch(record.manifest.storage.encryptedBundle.locator, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch encrypted bundle.");
      }

      const payload = (await response.json()) as EncryptedBundle;
      const decrypted = await getEncryptionProvider("password-aes-gcm").decrypt(payload, password);

      setDecryptedBundle(JSON.stringify(decrypted, null, 2));
      setShowBundle(true);
      setStatus("Private bundle decrypted.");
    } catch (decryptError) {
      setStatus(null);
      setError(
        decryptError instanceof Error ? decryptError.message : "Failed to decrypt private bundle."
      );
    }
  }

  async function decryptProtectedImage() {
    if (!record) {
      setError("Load a proof record before decrypting the image.");
      return;
    }

    if (!password) {
      setError("Enter the image password.");
      return;
    }

    setStatus("Fetching protected image...");
    setError(null);

    try {
      const response = await fetch(record.manifest.storage.watermarkedAsset.locator, {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch protected image package.");
      }

      const payload = (await response.json()) as EncryptedBinaryAsset;
      const provider = getEncryptionProvider("password-aes-gcm");
      const decryptedBytes = await provider.decryptBytes(payload, password);
      const hash = await sha256Hex(decryptedBytes);

      if (hash !== record.manifest.watermarkedImageHash) {
        throw new Error("Decrypted image does not match the signed proof record.");
      }

      const blob = new Blob([decryptedBytes], { type: payload.contentType });
      setProtectedPreviewUrl(URL.createObjectURL(blob));
      setVerificationResult("Authentic: protected image decrypted and matched the signed proof.");
      setStatus("Protected image decrypted.");
    } catch (decryptError) {
      setProtectedPreviewUrl(null);
      setStatus(null);
      setError(
        decryptError instanceof Error ? decryptError.message : "Failed to decrypt protected image."
      );
    }
  }

  return (
    <div className="panel-grid create-grid">
      <section className="panel">
        <p className="eyebrow">Unlock</p>
        <h1>Open and authenticate the protected image</h1>
        <p className="lede">
          Open the shared proof link, enter the password, and the app will
          decrypt the protected image and verify it against the signed proof.
        </p>

        <div className="stack">
          <label className="field">
            <span>Proof id</span>
            <input
              type="text"
              value={proofId}
              onChange={(event) => setProofId(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Manifest URL</span>
            <input
              type="text"
              value={manifestUrl}
              onChange={(event) => setManifestUrl(event.target.value)}
            />
          </label>

          <button type="button" className="button primary" onClick={() => void loadRecord()}>
            Load proof
          </button>
        </div>

        {record ? (
          <div className="result-card">
            <h2>Ready to unlock</h2>
            <p className="lede">
              {record.manifestVerified ? "Server signature valid." : "Server signature invalid."}
            </p>
            <p className="lede">Watermark label: {record.manifest.watermarkLabel}</p>
            <p className="lede">Created: {record.manifest.createdAt}</p>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button primary"
              onClick={() => void decryptProtectedImage()}
            >
              Unlock image and authenticate
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowManualCompare((current) => !current)}
            >
              {showManualCompare ? "Hide manual compare" : "Compare another file"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => void decryptBundle()}
            >
              Show provenance bundle
            </button>
          </div>
        ) : null}

        {record && showManualCompare ? (
          <div className="result-card">
            <h2>Manual compare</h2>
            <p className="lede">
              Optional: upload another image file to check whether it matches the
              signed protected image.
            </p>
            <label className="field">
              <span>Candidate image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={(event) => setCandidateFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button type="button" className="button secondary" onClick={() => void verifyCandidate()}>
              Verify uploaded file
            </button>
          </div>
        ) : null}

        {verificationResult ? <p className="status">{verificationResult}</p> : null}
        {status ? <p className="status">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <p className="eyebrow">Result</p>
        <h2>Unlocked image</h2>
        {!record ? (
          <p className="lede">
            Open a proof link or load a proof id first. Then enter the password
            to reveal the protected image.
          </p>
        ) : null}
        {protectedPreviewUrl ? (
          <Image
            src={protectedPreviewUrl}
            alt="Decrypted protected preview"
            width={1200}
            height={900}
            className="preview"
            unoptimized
          />
        ) : null}
        {showManualCompare && previewUrl ? (
          <Image
            src={previewUrl}
            alt="Candidate preview"
            width={1200}
            height={900}
            className="preview"
            unoptimized
          />
        ) : null}
        {showBundle && decryptedBundle ? <pre className="code-block">{decryptedBundle}</pre> : null}
      </section>
    </div>
  );
}
