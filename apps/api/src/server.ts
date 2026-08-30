import { createApp } from "./app.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Knowledge AI API listening on port ${config.port}`);
});
