import { createHash, randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import type { PublicUser } from "./authTypes.js";

export function createRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

interface IssueAccessTokenOptions {
  user: PublicUser;
  secret: Uint8Array;
  now: Date;
  ttlSeconds: number;
}

export async function issueAccessToken(options: IssueAccessTokenOptions) {
  if (options.secret.byteLength < 32) {
    throw new Error("Access-token secret must contain at least 32 bytes");
  }
  const issuedAt = Math.floor(options.now.getTime() / 1_000);

  return new SignJWT({ email: options.user.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(options.user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + options.ttlSeconds)
    .sign(options.secret);
}
