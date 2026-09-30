import { createServer } from "node:http";

// Deliberately local-only service shell. Browser streaming and credential prompts are not enabled yet.
const port = Number(process.env.SESSION_PORT ?? 3333);
const server = createServer((req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "disabled", feature: "human_browser_intervention", message: "Real account sessions are not connected in this build." }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});
server.listen(port, "0.0.0.0", () => console.log(JSON.stringify({ level: "info", event: "session_service_started", host: "container-private", port, mode: "disabled" })));
function close() { server.close(() => process.exit(0)); }
process.once("SIGTERM", close); process.once("SIGINT", close);
