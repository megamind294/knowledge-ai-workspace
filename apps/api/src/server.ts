import { loadApiConfig } from "./config.js";
import { createApiLifecycle } from "./operations/lifecycle.js";
import { createApiRuntime } from "./runtime.js";

const config = loadApiConfig();
const runtime = await createApiRuntime(config);

const server = runtime.app.listen(config.port);
const lifecycle = createApiLifecycle({
  logger: runtime.operationalLogger,
  closeServer: () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  closeRuntime: runtime.close,
});
server.once("listening", () => lifecycle.startup());

async function shutdown() {
  await lifecycle.shutdown();
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
