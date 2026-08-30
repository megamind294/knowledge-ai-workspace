export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export interface StoredUser extends PublicUser {
  passwordHash: string | null;
}

export interface RefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createUser(user: StoredUser): Promise<StoredUser>;
  findRefreshSessionByHash(tokenHash: string): Promise<RefreshSession | null>;
  createRefreshSession(session: RefreshSession): Promise<void>;
  rotateRefreshSession(
    currentTokenHash: string,
    replacement: RefreshSession,
    revokedAt: Date,
  ): Promise<boolean>;
  revokeRefreshSession(tokenHash: string, revokedAt: Date): Promise<boolean>;
  revokeAllRefreshSessions(userId: string, revokedAt: Date): Promise<number>;
}

export class AuthRepositoryError extends Error {
  constructor(readonly code: "EMAIL_IN_USE") {
    super(code);
    this.name = "AuthRepositoryError";
  }
}
