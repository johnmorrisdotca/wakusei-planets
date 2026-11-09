---
title: 自分でサーバーを動かす
section: how-to
order: 31
description: 自分のコンピューターで小さな JSON サービスを動かします。
---

[English](../serve-it-yourself.md)

このサービスは自分で動かします。私たちはホストしません。パッケージをビルドしてから `node examples/serve/server.mjs` を実行してください。`127.0.0.1:8240` で待ち受けます。`PORT` でポートを変えられます。

- `GET /body?id=mars` は天体の情報を返します。
- `GET /position?body=mars&date=2026-11-08T00:00Z` は太陽中心、黄道 J2000 の座標を au で返します。
- `GET /distance?a=earth&b=mars&date=2026-11-08T00:00Z` はパッケージの距離の結果を返します。

日時には `Z` または UTC からの時差を付けます。入力が正しくないと 400、知らないパスには 404 を返します。

## サーバー

```js no-run
import { createServer } from "node:http";
import { BODIES, BODY_IDS, stopPlaceAu } from "@johnmorrisdotca/wakusei-planets";
import { distance } from "@johnmorrisdotca/wakusei-planets/nearest";

const port = Number(process.env.PORT ?? 8240);
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
