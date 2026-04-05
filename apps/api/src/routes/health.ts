import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, service: "prooftrader-api", database: "connected" };
    } catch (error) {
      return reply.status(503).send({
        ok: false,
        service: "prooftrader-api",
        database: "disconnected",
        message: error instanceof Error ? error.message : "Database health check failed."
      });
    }
  });
}
