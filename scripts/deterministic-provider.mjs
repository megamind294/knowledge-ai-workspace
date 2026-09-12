import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const dimensions = 1536;
const port = 8081;
const maxBodyBytes = 1_000_000;

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createGroundedAnswer(prompt) {
  if (!/how long|retained|retention/i.test(prompt?.question ?? "")) {
    throw new Error("supported question required");
  }
  const source = prompt?.sources?.find((candidate) =>
    typeof candidate?.id === "string"
    && /company records must be retained for seven years\./i.test(candidate?.content ?? ""));
  if (!source) throw new Error("supporting source required");
  return {
    answer: "The supplied source states that company records must be retained for seven years.",
    citationIds: [source.id],
  };
}

export function startServer() {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      send(response, 200, { status: "ok" });
      return;
    }
    if (request.method !== "POST") {
      send(response, 404, { error: "not_found" });
      return;
    }

    try {
      const body = await readJson(request);
      if (request.url === "/v1/embeddings" && Array.isArray(body.input)) {
        const embedding = Array.from({ length: dimensions }, (_, index) => index === 0 ? 1 : 0);
        send(response, 200, {
          data: body.input.map((_input, index) => ({ index, embedding })),
        });
        return;
      }
      if (request.url === "/v1/chat/completions") {
        const userMessage = body.messages?.find((message) => message.role === "user");
        const prompt = JSON.parse(userMessage?.content ?? "{}");
        send(response, 200, {
          choices: [{
            message: {
              content: JSON.stringify(createGroundedAnswer(prompt)),
            },
          }],
        });
        return;
      }
      send(response, 404, { error: "not_found" });
    } catch {
      send(response, 400, { error: "invalid_request" });
    }
  }).listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ event: "deterministic_provider_started", port }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startServer();
