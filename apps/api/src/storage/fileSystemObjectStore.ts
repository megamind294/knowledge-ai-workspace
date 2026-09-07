import {
  mkdir,
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  assertSafeObjectKey,
  ObjectStoreError,
  type ObjectStore,
  type PutObjectInput,
} from "./objectStore.js";

const CONTENT_FILE = "content";
const METADATA_FILE = "metadata.json";

interface StoredMetadata {
  contentType: string;
}

function isMissing(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isExistingDestination(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) return false;
  return ["EEXIST", "ENOTEMPTY"].includes(
    (error as NodeJS.ErrnoException).code ?? "",
  );
}

export class FileSystemObjectStore implements ObjectStore {
  private readonly rootDirectory: string;
  private readonly temporaryDirectory: string;

  constructor(directory: string) {
    if (!directory.trim()) {
      throw new Error("Object storage directory must not be empty");
    }
    this.rootDirectory = resolve(directory);
    this.temporaryDirectory = join(this.rootDirectory, ".tmp");
  }

  async put(input: PutObjectInput) {
    const destination = this.resolveKey(input.key);
    await this.assertNoSymbolicLinks(destination);
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await this.assertNoSymbolicLinks(this.rootDirectory);
    await mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 });
    await this.assertNoSymbolicLinks(this.temporaryDirectory);
    const stagingDirectory = await mkdtemp(
      join(this.temporaryDirectory, "object-"),
    );

    try {
      await writeFile(join(stagingDirectory, CONTENT_FILE), input.bytes, {
        mode: 0o600,
        flag: "wx",
      });
      await writeFile(
        join(stagingDirectory, METADATA_FILE),
        JSON.stringify({ contentType: input.contentType }),
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await this.assertNoSymbolicLinks(destination);
      try {
        await rename(stagingDirectory, destination);
      } catch (error) {
        if (isExistingDestination(error)) {
          throw new ObjectStoreError(
            "ALREADY_EXISTS",
            "Object already exists at this key",
          );
        }
        throw error;
      }
    } finally {
      await rm(stagingDirectory, { recursive: true, force: true });
    }
  }

  async get(key: string) {
    const directory = this.resolveKey(key);
    await this.assertNoSymbolicLinks(directory);
    try {
      await stat(directory);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }

    const [bytes, rawMetadata] = await Promise.all([
      readFile(join(directory, CONTENT_FILE)),
      readFile(join(directory, METADATA_FILE), "utf8"),
    ]);
    const metadata = JSON.parse(rawMetadata) as StoredMetadata;
    if (typeof metadata.contentType !== "string") {
      throw new Error("Stored object metadata is invalid");
    }

    return {
      key,
      bytes: new Uint8Array(bytes),
      contentType: metadata.contentType,
    };
  }

  async delete(key: string) {
    const directory = this.resolveKey(key);
    await this.assertNoSymbolicLinks(directory);
    try {
      await rm(directory, { recursive: true, force: false });
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  private resolveKey(key: string) {
    assertSafeObjectKey(key);
    const path = resolve(this.rootDirectory, ...key.split("/"));
    const child = relative(this.rootDirectory, path);
    if (!child || child === ".." || child.startsWith(`..${sep}`)) {
      throw new ObjectStoreError("INVALID_KEY", "Object key is invalid");
    }
    return path;
  }

  private async assertNoSymbolicLinks(path: string) {
    const child = relative(this.rootDirectory, path);
    const segments = child ? child.split(sep) : [];
    let current = this.rootDirectory;

    for (const segment of ["", ...segments]) {
      if (segment) current = join(current, segment);
      try {
        const metadata = await lstat(current);
        if (metadata.isSymbolicLink()) {
          throw new ObjectStoreError(
            "INVALID_KEY",
            "Object key traverses an unsafe filesystem path",
          );
        }
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
    }
  }
}
