import { describe, expect, it } from "vitest";
import {
  EmbeddingProviderError,
  OpenAiEmbeddingProvider,
} from "./openAiEmbeddingProvider.js";

const vector = (value: number) => Array.from({ length: 1536 }, () => value);

describe("OpenAI-compatible embedding provider", () => {
  it("returns embeddings in input order from a validated provider response", async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
      },
      async (url, init) => {
        request = { url: String(url), init: init! };
        return new Response(
          JSON.stringify({
            data: [
              { index: 1, embedding: vector(2) },
              { index: 0, embedding: vector(1) },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    await expect(provider.embed(["alpha", "beta"])).resolves.toEqual([
      vector(1),
      vector(2),
    ]);
    expect(request).toMatchObject({
      url: "https://embeddings.example.com/v1/embeddings",
      init: {
        method: "POST",
        headers: {
          authorization: "Bearer private-key",
          "content-type": "application/json",
        },
      },
    });
    expect(JSON.parse(String(request?.init.body))).toEqual({
      input: ["alpha", "beta"],
      model: "text-embedding-3-small",
      dimensions: 1536,
    });
  });

  it("does not call the provider for an empty batch", async () => {
    let called = false;
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
      },
      async () => {
        called = true;
        return new Response();
      },
    );

    await expect(provider.embed([])).resolves.toEqual([]);
    expect(called).toBe(false);
  });

  it("normalizes provider failures without exposing response details", async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
      },
      async () =>
        new Response("upstream-secret-debug-body", { status: 429 }),
    );

    const error = await provider.embed(["alpha"]).catch((cause) => cause);
    expect(error).toBeInstanceOf(EmbeddingProviderError);
    expect(error).toMatchObject({
      code: "PROVIDER_FAILURE",
      message: "Embedding provider failed",
    });
    expect(JSON.stringify(error)).not.toContain("upstream-secret-debug-body");
  });

  it("rejects malformed embedding counts and dimensions", async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
      },
      async () =>
        new Response(
          JSON.stringify({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    await expect(provider.embed(["alpha"])).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "Embedding provider returned an invalid response",
    });
  });

  it("rejects zero vectors that cosine indexes cannot search", async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
      },
      async () =>
        new Response(
          JSON.stringify({ data: [{ index: 0, embedding: vector(0) }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    await expect(provider.embed(["alpha"])).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("aborts provider requests that exceed the configured timeout", async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
        timeoutMs: 5,
      },
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    await expect(provider.embed(["alpha"])).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
      message: "Embedding provider failed",
    });
  });

  it("keeps the timeout active while consuming the response body", async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        apiKey: "private-key",
        endpoint: "https://embeddings.example.com/v1/embeddings",
        model: "text-embedding-3-small",
        dimensions: 1536,
        timeoutMs: 5,
      },
      async (_url, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener(
                "abort",
                () => controller.error(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    await expect(provider.embed(["alpha"])).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
      message: "Embedding provider failed",
    });
  });
});
