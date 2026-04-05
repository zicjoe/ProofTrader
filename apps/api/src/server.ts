import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { snapshotRoutes } from "./routes/snapshot.js";
import { actionRoutes } from "./routes/actions.js";
import { krakenRoutes } from "./routes/kraken.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true
  });

  await app.register(healthRoutes);
  await app.register(snapshotRoutes);
  await app.register(actionRoutes);
  await app.register(krakenRoutes);

  return app;
}
