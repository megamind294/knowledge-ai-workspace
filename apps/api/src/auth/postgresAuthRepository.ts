import type { QueryResultRow } from "pg";
import type { DatabasePool } from "../database/pool.js";
import {
  AuthRepositoryError,
  type AuthRepository,
  type RefreshSession,
  type StoredUser,
} from "./authTypes.js";

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
}

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

function mapUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
  };
}

function mapSession(row: SessionRow): RefreshSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: DatabasePool) {}

  async findUserByEmail(email: string) {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, password_hash
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserById(id: string) {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, display_name, password_hash
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createUser(user: StoredUser) {
    try {
      const result = await this.pool.query<UserRow>(
        `INSERT INTO users (id, email, display_name, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, display_name, password_hash`,
        [user.id, user.email, user.displayName, user.passwordHash],
      );
      return mapUser(result.rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthRepositoryError("EMAIL_IN_USE");
      }
      throw error;
    }
  }

  async findRefreshSessionByHash(tokenHash: string) {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_sessions WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async createRefreshSession(session: RefreshSession) {
    await this.pool.query(
      `INSERT INTO refresh_sessions
        (id, user_id, token_hash, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, session.userId, session.tokenHash, session.expiresAt, session.revokedAt],
    );
  }

  async rotateRefreshSession(
    currentTokenHash: string,
    replacement: RefreshSession,
    revokedAt: Date,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ user_id: string }>(
        `UPDATE refresh_sessions SET revoked_at = $2
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2
         RETURNING user_id`,
        [currentTokenHash, revokedAt],
      );
      if (current.rowCount !== 1 || current.rows[0]?.user_id !== replacement.userId) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        `INSERT INTO refresh_sessions
          (id, user_id, token_hash, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          replacement.id,
          replacement.userId,
          replacement.tokenHash,
          replacement.expiresAt,
          replacement.revokedAt,
        ],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeRefreshSession(tokenHash: string, revokedAt: Date) {
    const result = await this.pool.query(
      `UPDATE refresh_sessions SET revoked_at = $2
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash, revokedAt],
    );
    return result.rowCount === 1;
  }

  async revokeAllRefreshSessions(userId: string, revokedAt: Date) {
    const result = await this.pool.query(
      `UPDATE refresh_sessions SET revoked_at = $2
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, revokedAt],
    );
    return result.rowCount ?? 0;
  }
}
