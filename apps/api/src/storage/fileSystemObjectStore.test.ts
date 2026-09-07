import { mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSystemObjectStore } from "./fileSystemObjectStore.js";
import { createDocumentObjectKey, ObjectStoreError } from "./objectStore.js";

const temporaryDirectories: string[] = [];

async function createStorageDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "keystone-object-store-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function expectStoreError(
  operation: Promise<unknown>,
  code: ObjectStoreError["code"],
) {
  await expect(operation).rejects.toMatchObject({ code });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("filesystem object storage", () => {
  it("persists bytes and content type across store instances", async () => {
    const directory = await createStorageDirectory();
    const key = createDocumentObjectKey("workspace-1", "document-2");
    await new FileSystemObjectStore(directory).put({
      key,
      bytes: new Uint8Array([37, 80, 68, 70]),
      contentType: "application/pdf",
    });

    await expect(new FileSystemObjectStore(directory).get(key)).resolves.toEqual({
      key,
      bytes: new Uint8Array([37, 80, 68, 70]),
      contentType: "application/pdf",
    });
  });

  it("returns byte copies that cannot mutate durable content", async () => {
    const directory = await createStorageDirectory();
    const store = new FileSystemObjectStore(directory);
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

  it("atomically accepts only one immutable concurrent write", async () => {
    const directory = await createStorageDirectory();
    const store = new FileSystemObjectStore(directory);
    const key = createDocumentObjectKey("workspace-1", "document-2");

    const writes = await Promise.allSettled([
      store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" }),
      store.put({ key, bytes: new Uint8Array([2]), contentType: "text/plain" }),
    ]);

    expect(writes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "ALREADY_EXISTS" },
    });
    const stored = await store.get(key);
    expect(stored?.bytes).toHaveLength(1);
    expect([1, 2]).toContain(stored?.bytes[0]);
  });

  it("cleans temporary artifacts after a rejected duplicate write", async () => {
    const directory = await createStorageDirectory();
    const store = new FileSystemObjectStore(directory);
    const key = createDocumentObjectKey("workspace-1", "document-2");
    await store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" });

    await expectStoreError(
      store.put({ key, bytes: new Uint8Array([2]), contentType: "text/plain" }),
      "ALREADY_EXISTS",
    );

    await expect(readdir(join(directory, ".tmp"))).resolves.toEqual([]);
  });

  it("deletes durable content and reports missing objects", async () => {
    const directory = await createStorageDirectory();
    const store = new FileSystemObjectStore(directory);
    const key = createDocumentObjectKey("workspace-1", "document-2");
    await store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" });

    await expect(store.delete(key)).resolves.toBe(true);
    await expect(store.delete(key)).resolves.toBe(false);
    await expect(new FileSystemObjectStore(directory).get(key)).resolves.toBeNull();
  });

  it.each(["", "/absolute", "../secret", "workspaces//source", "safe/../secret"])(
    "rejects an unsafe object key: %j",
    async (key) => {
      const store = new FileSystemObjectStore(await createStorageDirectory());
      await expectStoreError(
        store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" }),
        "INVALID_KEY",
      );
    },
  );

  it("rejects writes through a symlinked key ancestor", async () => {
    const directory = await createStorageDirectory();
    const outside = await createStorageDirectory();
    await symlink(outside, join(directory, "workspaces"), "dir");
    const store = new FileSystemObjectStore(directory);
    const key = createDocumentObjectKey("workspace-1", "document-2");

    await expectStoreError(
      store.put({ key, bytes: new Uint8Array([1]), contentType: "text/plain" }),
      "INVALID_KEY",
    );
    await expect(readdir(outside)).resolves.toEqual([]);
  });

  it("rejects reads through a symlinked key ancestor", async () => {
    const directory = await createStorageDirectory();
    const outside = await createStorageDirectory();
    await symlink(outside, join(directory, "workspaces"), "dir");
    const store = new FileSystemObjectStore(directory);
    const key = createDocumentObjectKey("workspace-1", "document-2");

    await expectStoreError(store.get(key), "INVALID_KEY");
  });

  it("rejects deletion through a symlinked key ancestor", async () => {
    const directory = await createStorageDirectory();
    const outside = await createStorageDirectory();
    await symlink(outside, join(directory, "workspaces"), "dir");
    const store = new FileSystemObjectStore(directory);
    const key = createDocumentObjectKey("workspace-1", "document-2");

    await expectStoreError(store.delete(key), "INVALID_KEY");
  });
});
