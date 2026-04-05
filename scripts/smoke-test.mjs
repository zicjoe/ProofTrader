const API_BASE = process.env.PROOFTRADER_API_URL || "http://localhost:4010";

async function hit(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}

const checks = [
  ["GET", "/health"],
  ["GET", "/api/kraken/status"],
  ["GET", "/api/kraken/paper/status"],
  ["GET", "/api/snapshot?sync=1"],
  ["POST", "/api/strategy/runner/dry-run"]
];

for (const [method, path] of checks) {
  const result = await hit(path, { method });
  console.log(`\n${method} ${path} -> ${result.status}`);
  console.log(typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2));
}
