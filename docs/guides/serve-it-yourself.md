---
title: Serve it yourself
section: how-to
order: 31
description: Run a small JSON service on your own computer.
---

[日本語](ja/serve-it-yourself.md)

You host this service yourself; we do not host it. Build the package and run `node examples/serve/server.mjs`. It listens on `127.0.0.1:8310`; set `PORT` to choose another port.

- `GET /body?id=mars` returns facts.
- `GET /position?body=mars&date=2026-11-08T00:00Z` returns heliocentric ecliptic J2000 coordinates in au.
- `GET /distance?a=earth&b=mars&date=2026-11-08T00:00Z` returns the package's distance result.

Dates need `Z` or a numeric UTC offset. Bad input gets 400; an unknown route gets 404.

## Server

```js no-run
import { createServer } from "node:http";
import { BODIES, BODY_IDS, stopPlaceAu } from "@johnmorrisdotca/wakusei-planets";
import { distance } from "@johnmorrisdotca/wakusei-planets/nearest";

const port = Number(process.env.PORT ?? 8310);
createServer((request, response) => {
  const send = (status, value) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(value));
  };
  if (request.method !== "GET") return send(400, { error: "GET only" });
  const url = new URL(request.url ?? "/", "http://localhost");
  const body = (key) => {
    const id = url.searchParams.get(key);
    return id && BODY_IDS.includes(id) ? id : undefined;
  };
  const date = () => {
    const value = url.searchParams.get("date") ?? "";
    return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;
  };
  if (url.pathname === "/body") {
    const id = body("id");
    return id ? send(200, BODIES[id]) : send(400, { error: "Unknown or missing body" });
  }
  if (url.pathname === "/position") {
    const id = body("body"), time = date();
    if (!id || !Number.isFinite(time)) return send(400, { error: "Valid body and dated instant are required" });
    const [xAu, yAu, zAu] = stopPlaceAu(id, time);
    return send(200, { body: id, time, origin: "heliocentric", frame: "eclipticJ2000", xAu, yAu, zAu });
  }
  if (url.pathname === "/distance") {
    const a = body("a"), b = body("b"), time = date();
    if (!a || !b || a === b || !Number.isFinite(time)) return send(400, { error: "Two different bodies and a dated instant are required" });
    return send(200, distance(a, b, time));
  }
  return send(404, { error: "Unknown route" });
}).listen(port, "127.0.0.1", () => console.log(`Listening on http://127.0.0.1:${port}`));
```
