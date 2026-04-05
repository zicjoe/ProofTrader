import type { ProofTraderSnapshot } from "@prooftrader/shared";
import { keccak256, stringToHex } from "viem";

export function buildAgentRegistrationFile(snapshot: ProofTraderSnapshot) {
  const identity = snapshot.settings.identity;
  const chain = snapshot.settings.blockchain;

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: identity.agentName,
    description: identity.agentDescription,
    image: "https://placehold.co/512x512/png?text=ProofTrader",
    services: [
      { name: "web", endpoint: "http://localhost:5173" },
      { name: "MCP", endpoint: "local://kraken-cli", version: "local" },
      { name: "api", endpoint: "http://localhost:4010" }
    ],
    x402Support: false,
    active: true,
    registrations: [
      {
        agentId: snapshot.validation.identity.agentId,
        agentRegistry: `eip155:${chain.chainId}:${chain.identityRegistry}`
      }
    ],
    supportedTrust: ["reputation", "crypto-economic", "tee-attestation"]
  };
}

export function buildValidationRequestPayload(referenceId: string, body: Record<string, unknown>) {
  const payload = {
    referenceId,
    createdAt: new Date().toISOString(),
    body
  };

  return {
    requestURI: `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`,
    requestHash: keccak256(stringToHex(JSON.stringify(payload)))
  };
}
