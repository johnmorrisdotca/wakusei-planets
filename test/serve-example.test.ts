import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { test } from "node:test";

test("the self-hosted example answers queries and rejects bad input", async () => {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(8240, "127.0.0.1", resolve); });
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!existsSync("dist/index.js")) execFileSync("pnpm", ["build"], { stdio: "pipe" });
  const server = spawn(process.execPath, ["examples/serve/server.mjs"], { env: { ...process.env, PORT: "8240" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await Promise.race([once(server.stdout, "data"), once(server, "exit").then(([code]) => { throw new Error(`server exited: ${String(code)}`); })]);
    const get = (path: string) => fetch(`http://127.0.0.1:8240${path}`);
    const body = await get("/body?id=mars"); assert.equal(body.status, 200); assert.equal((await body.json() as { id: string }).id, "mars");
    const position = await get("/position?body=mars&date=2026-11-08T00:00Z"); assert.equal(position.status, 200);
    const point = await position.json() as { xAu: number; yAu: number; zAu: number; frame: string };
    assert.equal(point.frame, "eclipticJ2000"); assert.ok([point.xAu, point.yAu, point.zAu].every(Number.isFinite));
    const between = await get("/distance?a=earth&b=mars&date=2026-11-08T00:00Z"); assert.equal(between.status, 200); assert.ok((await between.json() as { distanceAu: number }).distanceAu > 0);
    for (const path of ["/body?id=__proto__", "/body", "/position?body=mars&date=invalid", "/distance?a=earth&b=earth&date=2026-11-08T00:00Z"]) assert.equal((await get(path)).status, 400, path);
    assert.equal((await get("/missing")).status, 404);
  } finally {
    server.kill("SIGTERM");
    if (server.exitCode === null && server.signalCode === null) await once(server, "exit");
  }
});
