import { loadApiConfig } from "./config.js";
import { createApiRuntime } from "./runtime.js";

const config = loadApiConfig();
const runtime = await createApiRuntime(config);

const server = runtime.app.listen(config.port, () => {
  console.log(`Knowledge AI API listening on port ${config.port}`);
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await runtime.close();
    process.exitCode = 0;
  });
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
