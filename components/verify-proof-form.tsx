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
  const [proofId, setProofId] = useState(initialId);
  const [record, setRecord] = useState<LoadedRecord | null>(null);
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [decryptedBundle, setDecryptedBundle] = useState<string | null>(null);
  const [protectedPreviewUrl, setProtectedPreviewUrl] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (candidateFile ? URL.createObjectURL(candidateFile) : null),
    [candidateFile]
  );

  const loadRecord = useCallback(async (idOverride?: string) => {
    const id = (idOverride ?? proofId).trim();
    if (!id) {
      setError("Enter a proof id first.");
      return;
    }

    setStatus("Loading proof record...");
    setError(null);
    setVerificationResult(null);
    setDecryptedBundle(null);
    setProtectedPreviewUrl(null);

    try {
      const response = await fetch(`/api/proofs/${id}`);
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
  }, [proofId]);

  useEffect(() => {
    if (initialId) {
      void loadRecord(initialId);
    }
  }, [initialId, loadRecord]);

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
      const response = await fetch(`/api/proofs/${record.manifest.id}/bundle`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch encrypted bundle.");
      }

      const payload = (await response.json()) as EncryptedBundle;
      const decrypted = await getEncryptionProvider("password-aes-gcm").decrypt(payload, password);

      setDecryptedBundle(JSON.stringify(decrypted, null, 2));
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
      const response = await fetch(`/api/proofs/${record.manifest.id}/watermarked`, {
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
        <p className="eyebrow">Lookup</p>
        <h1>Verify a shared image</h1>
        <p className="lede">
          Load a proof id, compare the candidate file against the signed record,
          and optionally decrypt the protected provenance bundle with the password.
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

          <button type="button" className="button primary" onClick={() => void loadRecord()}>
            Load proof
          </button>

          <label className="field">
            <span>Candidate image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) => setCandidateFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <button type="button" className="button secondary" onClick={() => void verifyCandidate()}>
            Verify candidate image
          </button>

          <button
            type="button"
            className="button secondary"
            onClick={() => void decryptProtectedImage()}
          >
            Decrypt protected image
          </button>
        </div>

        {record ? (
          <div className="result-card">
            <h2>Manifest status</h2>
            <p className="lede">
              {record.manifestVerified ? "Server signature valid." : "Server signature invalid."}
            </p>
            <p className="lede">Watermark label: {record.manifest.watermarkLabel}</p>
            <p className="lede">Created: {record.manifest.createdAt}</p>
          </div>
        ) : null}

        {verificationResult ? <p className="status">{verificationResult}</p> : null}
        {status ? <p className="status">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <p className="eyebrow">Protected provenance</p>
        <h2>Protected image and bundle</h2>
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
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Candidate preview"
            width={1200}
            height={900}
            className="preview"
            unoptimized
          />
        ) : null}

        <div className="stack">
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="button" className="button secondary" onClick={() => void decryptBundle()}>
            Decrypt private bundle
          </button>
        </div>

        {decryptedBundle ? <pre className="code-block">{decryptedBundle}</pre> : null}
      </section>
    </div>
  );
}
