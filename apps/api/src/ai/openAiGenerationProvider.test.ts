import { describe, expect, it, vi } from "vitest";
import {
  GenerationProviderError,
  OpenAiGenerationProvider,
} from "./openAiGenerationProvider.js";

const input = {
  question: "How much annual leave is provided?",
  sources: [
    { id: "source-1", content: "Employees receive twenty days." },
    { id: "source-2", content: "Carry-over requires approval." },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function provider(request: typeof fetch) {
  return new OpenAiGenerationProvider(
    {
      apiKey: "test-key",
      endpoint: "https://provider.example/v1/chat/completions",
      model: "test-chat-model",
      timeoutMs: 100,
    },
    request,
  );
}

describe("OpenAiGenerationProvider", () => {
  it("requests a structured grounded answer and accepts allowed source ids", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "Employees receive twenty days of annual leave.",
                citationIds: ["source-1"],
              }),
            },
          },
        ],
      }),
    );

    await expect(provider(request).generate(input)).resolves.toEqual({
      answer: "Employees receive twenty days of annual leave.",
      citationIds: ["source-1"],
    });

    const [, init] = request.mock.calls[0]!;
    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ model: "test-chat-model", temperature: 0 });
    expect(JSON.stringify(body)).toContain("source-1");
    expect(JSON.stringify(body)).toContain("untrusted source data");
    expect(init!.headers).toEqual({
      authorization: "Bearer test-key",
      "content-type": "application/json",
    });
  });

  it.each([
    { answer: "", citationIds: ["source-1"] },
    { answer: "Supported answer", citationIds: [] },
    { answer: "Unsupported answer", citationIds: ["source-99"] },
    { answer: "Malformed citations", citationIds: "source-1" },
    { answer: "Repeated citations", citationIds: ["source-1", "source-1"] },
  ])("rejects invalid or ungrounded structured output %#", async (content) => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: JSON.stringify(content) } }] }),
      );

    await expect(provider(request).generate(input)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects malformed provider envelopes without leaking their contents", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ upstreamSecret: "do-not-leak" }));

    const error = await provider(request).generate(input).catch((cause) => cause);
    expect(error).toBeInstanceOf(GenerationProviderError);
    expect(error).toMatchObject({ code: "INVALID_RESPONSE" });
    expect(String(error)).not.toContain("do-not-leak");
  });

  it("normalizes non-success and network failures", async () => {
    const failedResponse = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ detail: "sensitive upstream detail" }, 429));
    await expect(provider(failedResponse).generate(input)).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
    });

    const failedNetwork = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("provider host and credential detail"));
    const error = await provider(failedNetwork).generate(input).catch((cause) => cause);
    expect(error).toMatchObject({ code: "PROVIDER_FAILURE" });
    expect(String(error)).not.toContain("credential");
  });

  it("times out a pending provider request", async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>().mockImplementation(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const expectation = expect(provider(request).generate(input)).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
    });
    await vi.advanceTimersByTimeAsync(101);
    await expectation;
    vi.useRealTimers();
  });

  it("keeps the same timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    const response = {
      ok: true,
      json: () => new Promise<never>(() => undefined),
    } as unknown as Response;
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);

    const expectation = expect(provider(request).generate(input)).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
    });
    await vi.advanceTimersByTimeAsync(101);
    await expectation;
    vi.useRealTimers();
  });
});
