import assert from "node:assert/strict";
import proxy from "../pages-proxy/public/_worker.js";

const request = new Request("https://formularios.discipuladocgv.org/participar/P01/example", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prueba: true }),
});

let forwardedRequest;
const response = await proxy.fetch(request, {
  FORM_SERVICE: {
    async fetch(incoming) {
      forwardedRequest = incoming;
      return new Response("respuesta", {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      });
    },
  },
});

assert.equal(forwardedRequest, request);
assert.equal(response.status, 201);
assert.equal(await response.text(), "respuesta");
assert.equal(response.headers.get("Cache-Control"), "private, no-store");
assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");

console.log("PASS: el proxy conserva solicitud, respuesta, privacidad y streaming.");
