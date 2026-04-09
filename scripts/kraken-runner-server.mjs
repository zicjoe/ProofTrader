import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 4011);
let paperQueue = Promise.resolve();
const BINARY = process.env.KRAKEN_CLI_PATH || "kraken";
const enabled = String(process.env.KRAKEN_CLI_ENABLED).toLowerCase() === "true";

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function runCli(args) {
  if (!enabled) {
    throw new Error("Kraken CLI is disabled on the runner.");
  }
  try {
    const { stdout, stderr } = await execFileAsync(BINARY, args, {
      env: process.env,
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024
    });
    const output = (stdout || stderr || "").trim();
    try {
      return JSON.parse(output);
    } catch {
      return { raw: output };
    }
  } catch (error) {
    const processError = error;
    const output = `${processError.stdout ?? ""}
${processError.stderr ?? ""}
${processError.message ?? ""}`.trim();
    throw new Error(output || "Kraken CLI command failed.");
  }
}

function runPaperCli(args) {
  const next = paperQueue.then(() => runCli(args));
  paperQueue = next.then(() => undefined, () => undefined);
  return next;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function modeArgs(mode, command) {
  return mode === "futures" ? ["futures", "paper", command, "-o", "json"] : ["paper", command, "-o", "json"];
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    console.log(`[runner] ${req.method} ${url.pathname}${url.search}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, service: "kraken-runner", cliEnabled: enabled, binary: BINARY });
    }

    if (req.method === "GET" && url.pathname === "/v1/market/ticker") {
      const symbol = String(url.searchParams.get("symbol") || "BTCUSD").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      return sendJson(res, 200, await runCli(["ticker", symbol, "-o", "json"]));
    }

    if (req.method === "GET" && url.pathname === "/v1/market/ohlc") {
      const symbol = String(url.searchParams.get("symbol") || "XBTUSD");
      const interval = String(url.searchParams.get("interval") || "5");
      const response = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`);
      return sendJson(res, response.status, await response.json());
    }

    if (req.method === "GET" && url.pathname === "/v1/market/depth") {
      const symbol = String(url.searchParams.get("symbol") || "XBTUSD");
      const count = String(url.searchParams.get("count") || "10");
      const response = await fetch(`https://api.kraken.com/0/public/Depth?pair=${encodeURIComponent(symbol)}&count=${encodeURIComponent(count)}`);
      return sendJson(res, response.status, await response.json());
    }

    if (req.method === "POST" && url.pathname === "/v1/paper/init") {
      const body = await readBody(req);
      const balance = Number(body.balance ?? 10000);
      const mode = body.mode === "futures" ? "futures" : "spot";
      const args = mode === "futures" ? ["futures", "paper", "init", "--balance", String(balance), "-o", "json"] : ["paper", "init", "--balance", String(balance), "-o", "json"];
      return sendJson(res, 200, await runPaperCli(args));
    }

    if (req.method === "GET" && url.pathname === "/v1/paper/status") {
      const mode = url.searchParams.get("mode") === "futures" ? "futures" : "spot";
      return sendJson(res, 200, await runPaperCli(modeArgs(mode, "status")));
    }

    if (req.method === "GET" && url.pathname === "/v1/paper/history") {
      const mode = url.searchParams.get("mode") === "futures" ? "futures" : "spot";
      if (mode === "futures") {
        return sendJson(res, 200, { history: [] });
      }
      return sendJson(res, 200, await runPaperCli(["paper", "history", "-o", "json"]));
    }

    if (req.method === "GET" && url.pathname === "/v1/paper/balance") {
      const mode = url.searchParams.get("mode") === "futures" ? "futures" : "spot";
      return sendJson(res, 200, await runPaperCli(modeArgs(mode, "status")));
    }

    if (req.method === "GET" && url.pathname === "/v1/paper/positions") {
      return sendJson(res, 200, await runPaperCli(["futures", "paper", "positions", "-o", "json"]));
    }

    if (req.method === "POST" && url.pathname === "/v1/paper/order") {
      const body = await readBody(req);
      const mode = body.mode === "futures" ? "futures" : "spot";
      const side = body.side === "SHORT" ? "sell" : "buy";
      const orderType = body.orderType === "limit" ? "limit" : "market";
      const size = Number(body.size ?? 0);
      const leverage = Math.max(Number(body.leverage ?? 2), 1);
      const symbol = String(body.symbol || "BTC/USD");
      const normalizeSpot = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const normalized = mode === "futures"
        ? (() => {
            const base = normalizeSpot.replace(/^PF_/, "");
            if (base === "BTCUSD" || base === "XBTUSD") return "PF_XBTUSD";
            if (base === "ETHUSD") return "PF_ETHUSD";
            if (base === "SOLUSD") return "PF_SOLUSD";
            return base.startsWith("PF_") ? base : `PF_${base}`;
          })()
        : normalizeSpot;
      const args = mode === "futures"
        ? ["futures", "paper", side, normalized, String(size), "--leverage", String(leverage), "--type", orderType]
        : ["paper", side, normalized, String(size), "--type", orderType];
      if (orderType === "limit" && typeof body.limitPrice === "number") {
        args.push("--price", String(body.limitPrice));
      }
      args.push("-o", "json");
      return sendJson(res, 200, await runPaperCli(args));
    }

    return sendJson(res, 404, { ok: false, message: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown runner error.";
    console.error(`[runner] error: ${message}`);
    return sendJson(res, 500, { ok: false, message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[runner] listening on ${PORT}`);
});
