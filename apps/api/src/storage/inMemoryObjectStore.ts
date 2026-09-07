import {
  assertSafeObjectKey,
  ObjectStoreError,
  type ObjectStore,
  type PutObjectInput,
  type StoredObject,
} from "./objectStore.js";

function copyObject(object: StoredObject): StoredObject {
  return {
    key: object.key,
    bytes: new Uint8Array(object.bytes),
    contentType: object.contentType,
  };
}

export class InMemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, StoredObject>();

  async put(input: PutObjectInput) {
    assertSafeObjectKey(input.key);
    if (this.objects.has(input.key)) {
      throw new ObjectStoreError(
        "ALREADY_EXISTS",
        "Object already exists at this key",
      );
    }
    this.objects.set(input.key, copyObject(input));
  }

  async get(key: string) {
    assertSafeObjectKey(key);
    const object = this.objects.get(key);
    return object ? copyObject(object) : null;
  }

  async delete(key: string) {
    assertSafeObjectKey(key);
    return this.objects.delete(key);
  }
}
