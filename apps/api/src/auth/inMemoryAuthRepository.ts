import {
  AuthRepositoryError,
  type AuthRepository,
  type RefreshSession,
  type StoredUser,
} from "./authTypes.js";

function cloneUser(user: StoredUser): StoredUser {
  return { ...user };
}

function cloneSession(session: RefreshSession): RefreshSession {
  return {
    ...session,
    expiresAt: new Date(session.expiresAt),
    revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
  };
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly usersByEmail = new Map<string, StoredUser>();
  private readonly sessionsByHash = new Map<string, RefreshSession>();

  async findUserByEmail(email: string) {
    const user = this.usersByEmail.get(email);
    return user ? cloneUser(user) : null;
  }

  async findUserById(id: string) {
    const user = [...this.usersByEmail.values()].find((candidate) => candidate.id === id);
    return user ? cloneUser(user) : null;
  }

  async createUser(user: StoredUser) {
    if (this.usersByEmail.has(user.email)) {
      throw new AuthRepositoryError("EMAIL_IN_USE");
    }
    this.usersByEmail.set(user.email, cloneUser(user));
    return cloneUser(user);
  }

  async findRefreshSessionByHash(tokenHash: string) {
    const session = this.sessionsByHash.get(tokenHash);
    return session ? cloneSession(session) : null;
  }

  async createRefreshSession(session: RefreshSession) {
    this.sessionsByHash.set(session.tokenHash, cloneSession(session));
  }

  async rotateRefreshSession(
    currentTokenHash: string,
    replacement: RefreshSession,
    revokedAt: Date,
  ) {
    const current = this.sessionsByHash.get(currentTokenHash);
    if (
      !current ||
      current.revokedAt ||
      current.expiresAt.getTime() <= revokedAt.getTime()
    ) {
      return false;
    }
    current.revokedAt = new Date(revokedAt);
    this.sessionsByHash.set(replacement.tokenHash, cloneSession(replacement));
    return true;
  }

  async revokeRefreshSession(tokenHash: string, revokedAt: Date) {
    const session = this.sessionsByHash.get(tokenHash);
    if (!session || session.revokedAt) {
      return false;
    }
    session.revokedAt = new Date(revokedAt);
    return true;
  }

  async revokeAllRefreshSessions(userId: string, revokedAt: Date) {
    let revoked = 0;
    for (const session of this.sessionsByHash.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date(revokedAt);
        revoked += 1;
      }
    }
    return revoked;
  }
}
