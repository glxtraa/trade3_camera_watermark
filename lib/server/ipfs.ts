import type { StorageDescriptor } from "@/lib/proof/types";

interface PinataJsonResponse {
  IpfsHash: string;
}

export async function pinJsonToIpfs(name: string, body: unknown): Promise<StorageDescriptor> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is required when IPFS upload is enabled.");
  }

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pinataMetadata: {
        name
      },
      pinataContent: body
    })
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${response.status}`);
  }

  const payload = (await response.json()) as PinataJsonResponse;
  const cid = payload.IpfsHash;

  return {
    kind: "ipfs",
    locator: `https://gateway.pinata.cloud/ipfs/${cid}`,
    contentType: "application/json"
  };
}
