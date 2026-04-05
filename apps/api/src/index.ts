import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { buildServer } from "./server.js";
import { strategyRunnerService } from "./services/strategy-runner.service.js";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const port = Number(process.env.PORT || 4010);
const host = "0.0.0.0";

const server = await buildServer();
await server.listen({ port, host });

await strategyRunnerService.bootstrap();
