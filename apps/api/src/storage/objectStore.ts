const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SAFE_KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u;

export type ObjectStoreErrorCode = "ALREADY_EXISTS" | "INVALID_KEY";

export class ObjectStoreError extends Error {
  constructor(
    public readonly code: ObjectStoreErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface PutObjectInput {
  key: string;
  bytes: Uint8Array;
  contentType: string;
}

export type StoredObject = PutObjectInput;

export interface ObjectStore {
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<boolean>;
}

export function assertSafeObjectKey(key: string) {
  if (!SAFE_KEY_PATTERN.test(key)) {
    throw new ObjectStoreError("INVALID_KEY", "Object key is invalid");
  }
}

function assertSafeSegment(value: string) {
  if (!SAFE_SEGMENT_PATTERN.test(value)) {
    throw new ObjectStoreError("INVALID_KEY", "Object key identifier is invalid");
  }
}

export function createDocumentObjectKey(
  workspaceId: string,
  documentId: string,
) {
  assertSafeSegment(workspaceId);
  assertSafeSegment(documentId);
  return `workspaces/${workspaceId}/documents/${documentId}/source`;
}
