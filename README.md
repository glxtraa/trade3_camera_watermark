# Trade3 Camera Watermark

Vercel-first mobile web app for:
- capturing an image on a phone
- generating a visible watermarked derivative
- extracting provenance metadata from the original image
- encrypting the private provenance bundle with a user password
- storing the MVP assets on Vercel services first
- verifying whether a shared image matches its signed proof record

## MVP boundaries

The first version uses:
- Next.js on Vercel
- Vercel Blob for file storage
- Vercel Postgres or KV for public manifests
- password-based client-side encryption for the private bundle

The first version does **not** require:
- IPFS
- wallet-based encryption
- NFT minting

## Planned upgrade paths

The architecture is intentionally split so the app can later add:
- stronger encryption and key custody
- IPFS as an additional or alternative storage backend
- EVM anchoring and NFT minting for proof records

See [`docs/architecture.md`](/Users/lamat/Documents/OpenAI/trade3_camera_watermark/docs/architecture.md) for the current system plan.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required for deployment:
- `PROOF_HMAC_SECRET`
- `BLOB_READ_WRITE_TOKEN`

Without a Blob token, local development falls back to `/tmp/trade3-camera-watermark` storage.

Optional for IPFS pinning:
- `PINATA_JWT`
