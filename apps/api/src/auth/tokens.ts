import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
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

export interface AccessTokenClaims {
  userId: string;
  email: string;
}

export async function verifyAccessToken(
  token: string,
  secret: Uint8Array,
): Promise<AccessTokenClaims> {
  const verified = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (!verified.payload.sub || typeof verified.payload.email !== "string") {
    throw new Error("Invalid access-token claims");
  }
  return { userId: verified.payload.sub, email: verified.payload.email };
}
