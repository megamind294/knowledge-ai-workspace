import { describe, expect, it } from "vitest";
import {
  createDocumentObjectKey,
  ObjectStoreError,
} from "./objectStore.js";
import { InMemoryObjectStore } from "./inMemoryObjectStore.js";

async function expectStoreError(
  operation: Promise<unknown>,
  code: ObjectStoreError["code"],
) {
  await expect(operation).rejects.toMatchObject({ code });
}

describe("in-memory object storage", () => {
  it("stores content under a server-generated document key", async () => {
    const store = new InMemoryObjectStore();
    const key = createDocumentObjectKey("workspace-1", "document-2");

    await store.put({
      key,
      bytes: new Uint8Array([37, 80, 68, 70]),
      contentType: "application/pdf",
    });

    await expect(store.get(key)).resolves.toEqual({
      key: "workspaces/workspace-1/documents/document-2/source",
      bytes: new Uint8Array([37, 80, 68, 70]),
      contentType: "application/pdf",
    });
  });

  it("copies bytes on write and read so callers cannot mutate stored content", async () => {
    const store = new InMemoryObjectStore();
    const key = createDocumentObjectKey("workspace-1", "document-2");
    const input = new Uint8Array([1, 2, 3]);
    await store.put({ key, bytes: input, contentType: "text/plain" });

    input[0] = 9;
    const firstRead = await store.get(key);
    if (!firstRead) throw new Error("Expected stored object");
    firstRead.bytes[1] = 8;

    await expect(store.get(key)).resolves.toMatchObject({
      bytes: new Uint8Array([1, 2, 3]),
    });
  });

  it("rejects duplicate writes instead of silently replacing source bytes", async () => {
    const store = new InMemoryObjectStore();
    const key = createDocumentObjectKey("workspace-1", "document-2");
    await store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" });

    await expectStoreError(
      store.put({ key, bytes: new Uint8Array([2]), contentType: "text/plain" }),
      "ALREADY_EXISTS",
    );
    await expect(store.get(key)).resolves.toMatchObject({
      bytes: new Uint8Array([1]),
    });
  });

  it("deletes existing content and reports whether an object was removed", async () => {
    const store = new InMemoryObjectStore();
    const key = createDocumentObjectKey("workspace-1", "document-2");
    await store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" });

    await expect(store.delete(key)).resolves.toBe(true);
    await expect(store.delete(key)).resolves.toBe(false);
    await expect(store.get(key)).resolves.toBeNull();
  });

  it.each(["", "/absolute", "../secret", "workspaces//source", "safe/../secret"])(
    "rejects an unsafe object key: %j",
    async (key) => {
      const store = new InMemoryObjectStore();
      await expectStoreError(
        store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" }),
        "INVALID_KEY",
      );
    },
  );

  it("rejects unsafe identifiers before constructing a document key", () => {
    expect(() => createDocumentObjectKey("../workspace", "document-2")).toThrow(
      ObjectStoreError,
    );
  });
});
