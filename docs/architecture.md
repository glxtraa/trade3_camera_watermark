# Architecture

## Goal

Build a Vercel-deployable mobile-first web app that can:
- capture a photo
- create a visible watermarked derivative
- extract provenance data from the original image
- protect the sensitive provenance bundle with encryption
- let another user verify the authenticity of a shared image

## MVP system model

### Public proof

The public proof is the part used for authenticity checks. It should contain:
- proof record id
- manifest version
- signer public key or verifier identifier
- original image hash
- watermarked image hash
- canonical EXIF subset hash
- capture timestamp
- storage pointers for the watermarked asset and encrypted bundle
- signature over the manifest payload

### Private provenance bundle

The encrypted bundle is the protected audit payload. It should contain:
- original image bytes or a reference strategy if size forces chunking later
- full EXIF extraction
- optional geolocation and device fields
- internal provenance notes
- encryption metadata such as salt, iv, algorithm, and kdf params

### Authenticity model

Visible watermark and EXIF are supporting signals, not the root of trust.

The proof decision is based on:
1. deterministic hashing of image and metadata payloads
2. cryptographic signature over the manifest
3. comparison between the candidate image hash and the signed manifest

## Runtime boundaries

### Client

The browser client is responsible for:
- camera capture
- image preview
- watermark rendering
- EXIF extraction
- hashing
- password entry
- client-side encryption
- candidate-image verification

### Server

The Vercel server layer is responsible for:
- issuing stable proof record ids
- persisting manifests
- generating upload targets when required
- serving verification records
- future access control and rate limiting

## Storage abstraction

MVP storage must use only Vercel-managed assets, but storage is abstracted behind an adapter.

### MVP adapter

`vercel-blob`
- stores watermarked image
- stores encrypted provenance bundle

`vercel-registry`
- stores public manifest and proof lookup state

### Future adapter

`ipfs`
- stores public manifest and encrypted bundle as content-addressed objects
- preserves the same manifest shape with a different storage descriptor

## Encryption abstraction

### MVP

Password-based encryption:
- derive a symmetric key from user password
- encrypt the private bundle in the browser
- upload only ciphertext and parameters

### Future

Replaceable key providers:
- passkeys or device-bound keys
- wallet-linked or DID-linked encryption
- team recipient public-key encryption
- recovery and escrow policies

The app should isolate key derivation and encryption behind a provider interface so migration does not change the rest of the flow.

## Chain abstraction

MVP does not mint NFTs. It only prepares a proof model that can later be anchored on-chain.

### Future EVM path

Possible extensions:
- write manifest hash or bundle CID equivalent to an EVM contract
- mint an NFT whose metadata points to the proof manifest
- support multiple EVM chains with a chain adapter

The on-chain layer should consume a finalized proof record rather than altering proof generation itself.

## Recommended module boundaries

- `lib/proof`: manifest schema, hashing inputs, canonicalization helpers
- `lib/crypto`: encryption provider and signature provider interfaces
- `lib/storage`: blob storage and future IPFS storage adapters
- `lib/registry`: public manifest persistence and lookup adapters
- `lib/chain`: future EVM anchoring and NFT mint interfaces
- `app/create`: capture and proof generation flow
- `app/verify`: authenticity verification flow

## MVP development order

1. Scaffold app shell and architecture primitives
2. Build capture flow
3. Add watermark generation
4. Add EXIF extraction and canonical hashing
5. Add password-based encryption for private bundle
6. Persist assets with Vercel storage adapters
7. Build public verification flow
8. Harden for mobile browser edge cases
