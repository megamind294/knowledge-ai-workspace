import { DataType, newDb } from "pg-mem";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import type { AuthRepository } from "./authTypes.js";
import { InMemoryAuthRepository } from "./inMemoryAuthRepository.js";
import { PostgresAuthRepository } from "./postgresAuthRepository.js";

const user = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "rinkle@example.com",
  displayName: "Rinkle Sharma",
  passwordHash: "$2b$04$test-hash",
};

const firstSession = {
  id: "00000000-0000-4000-8000-000000000201",
  userId: user.id,
  tokenHash: "first-token-hash",
  expiresAt: new Date("2099-09-01T00:00:00.000Z"),
  revokedAt: null,
};

function createMemoryPool(): DatabasePool {
  const database = newDb({ noAstCoverageCheck: true });
  database.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 1,
  });
  return new (database.adapters.createPg().Pool)() as DatabasePool;
}

describe.sequential("AuthRepository parity", () => {
  let pool: DatabasePool;

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      await admin.query("DROP SCHEMA IF EXISTS auth_repository_test CASCADE");
      await admin.query("CREATE SCHEMA auth_repository_test");
      await admin.end();
      pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        options: "-c search_path=auth_repository_test",
      });
    } else {
      pool = createMemoryPool();
    }
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const factories: Array<[string, () => AuthRepository]> = [
    ["memory", () => new InMemoryAuthRepository()],
    ["PostgreSQL", () => new PostgresAuthRepository(pool)],
  ];

  for (const [name, createRepository] of factories) {
    it(`${name} enforces normalized email uniqueness and returns defensive user values`, async () => {
      const repository = createRepository();
      const created = await repository.createUser(user);

      await expect(repository.createUser({ ...user, id: user.id.replace("101", "102") }))
        .rejects.toMatchObject({ code: "EMAIL_IN_USE" });
      created.email = "mutated@example.com";
      await expect(repository.findUserByEmail(user.email)).resolves.toMatchObject({
        email: user.email,
      });
    });

    it(`${name} atomically rotates and revokes refresh sessions`, async () => {
      const repository = createRepository();
      const owner = await repository.findUserByEmail(user.email);
      if (!owner) {
        await repository.createUser(user);
      }
      await repository.createRefreshSession(firstSession);

      const replacement = {
        ...firstSession,
        id: firstSession.id.replace("201", "202"),
        tokenHash: "second-token-hash",
      };
      await expect(
        repository.rotateRefreshSession(firstSession.tokenHash, replacement, new Date()),
      ).resolves.toBe(true);
      await expect(
        repository.rotateRefreshSession(firstSession.tokenHash, replacement, new Date()),
      ).resolves.toBe(false);
      await expect(
        repository.revokeAllRefreshSessions(user.id, new Date()),
      ).resolves.toBeGreaterThanOrEqual(1);
      await expect(repository.findRefreshSessionByHash(replacement.tokenHash))
        .resolves.toMatchObject({ revokedAt: expect.any(Date) });
    });

    it(`${name} links external identities once and resolves their user`, async () => {
      const repository = createRepository();
      const owner = await repository.findUserByEmail(user.email);
      if (!owner) {
        await repository.createUser(user);
      }
      const identity = {
        id: firstSession.id.replace("201", "301"),
        userId: user.id,
        provider: "google" as const,
        providerSubject: `${name.toLowerCase()}-google-subject`,
        email: user.email,
      };

      await repository.createExternalIdentity(identity);

      await expect(
        repository.findUserByExternalIdentity("google", identity.providerSubject),
      ).resolves.toMatchObject({ id: user.id });
      await expect(repository.createExternalIdentity({ ...identity, id: identity.id.replace("301", "302") }))
        .rejects.toMatchObject({ code: "IDENTITY_IN_USE" });
    });
  }
});
