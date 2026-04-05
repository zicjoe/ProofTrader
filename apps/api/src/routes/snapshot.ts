import type { FastifyInstance } from "fastify";
import { stateStore } from "../services/state-store.js";
import { buildAgentRegistrationFile } from "../services/erc8004.service.js";

export async function snapshotRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { sync?: string } }>("/api/snapshot", async (request) => {
    const sync = request.query.sync === "1" || request.query.sync === "true";
    return stateStore.getSnapshot(sync);
  });

  app.get("/api/identity/registration", async () => {
    const snapshot = await stateStore.getSnapshot();
    return {
      ok: true,
      registration: buildAgentRegistrationFile(snapshot)
    };
  });
}
