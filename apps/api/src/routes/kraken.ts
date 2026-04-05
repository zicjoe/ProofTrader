import type { FastifyInstance } from "fastify";
import { krakenCliService } from "../services/kraken-cli.service.js";
import { stateStore } from "../services/state-store.js";

export async function krakenRoutes(app: FastifyInstance) {
  app.get("/api/kraken/status", async () => krakenCliService.status());

  app.get<{ Querystring: { symbol?: string } }>("/api/kraken/ticker", async (request) => {
    return krakenCliService.ticker(request.query.symbol || "BTCUSD");
  });

  app.get("/api/kraken/paper/status", async () => {
    const snapshot = await stateStore.getSnapshot(false);
    return krakenCliService.paperStatus(snapshot.settings.exchange.accountMode ?? "spot");
  });

  app.get("/api/kraken/paper/history", async () => {
    const snapshot = await stateStore.getSnapshot(false);
    return krakenCliService.paperHistory(snapshot.settings.exchange.accountMode ?? "spot");
  });
}
