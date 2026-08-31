import { randomUUID } from "node:crypto";
import type {
  AuthRepository,
  PublicUser,
  RefreshSession,
} from "./authTypes.js";
import { AuthRepositoryError } from "./authTypes.js";
import {
  createPasswordService,
  DUMMY_PASSWORD_HASH,
  type PasswordService,
} from "./passwords.js";
import {
  createRefreshToken,
  hashRefreshToken,
  issueAccessToken,
} from "./tokens.js";

export type AuthErrorCode =
  | "WEAK_PASSWORD"
  | "EMAIL_IN_USE"
  | "INVALID_CREDENTIALS"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_REPLAYED";

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

interface AuthServiceOptions {
  repository: AuthRepository;
  accessTokenSecret: Uint8Array;
  passwordService?: PasswordService;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlMs?: number;
  now?: () => Date;
  createId?: () => string;
}

interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isStrongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function publicUser(user: PublicUser): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export class AuthService {
  private readonly repository: AuthRepository;
  private readonly passwordService: PasswordService;
  private readonly accessTokenSecret: Uint8Array;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlMs: number;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: AuthServiceOptions) {
    this.repository = options.repository;
    this.passwordService = options.passwordService ?? createPasswordService();
    this.accessTokenSecret = options.accessTokenSecret;
    this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? 300;
    this.refreshTokenTtlMs = options.refreshTokenTtlMs ?? 30 * 24 * 60 * 60 * 1_000;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async register(input: RegisterInput) {
    if (!isStrongPassword(input.password)) {
      throw new AuthError("WEAK_PASSWORD");
    }
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwordService.hash(input.password);
    try {
      const user = await this.repository.createUser({
        id: this.createId(),
        email,
        displayName: input.displayName.trim(),
        passwordHash,
      });
      return this.issueSession(publicUser(user));
    } catch (error) {
      if (error instanceof AuthRepositoryError && error.code === "EMAIL_IN_USE") {
        throw new AuthError("EMAIL_IN_USE");
      }
      throw error;
    }
  }

  async login(input: LoginInput) {
    const user = await this.repository.findUserByEmail(normalizeEmail(input.email));
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const valid = await this.passwordService.verify(input.password, passwordHash);
    if (!user || !user.passwordHash || !valid) {
      throw new AuthError("INVALID_CREDENTIALS");
    }
    return this.issueSession(publicUser(user));
  }

  async refresh(refreshToken: string) {
    const now = this.now();
    const tokenHash = hashRefreshToken(refreshToken);
    const current = await this.repository.findRefreshSessionByHash(tokenHash);
    if (!current) {
      throw new AuthError("INVALID_REFRESH_TOKEN");
    }
    if (current.revokedAt) {
      await this.repository.revokeAllRefreshSessions(current.userId, now);
      throw new AuthError("REFRESH_REPLAYED");
    }
    if (current.expiresAt.getTime() <= now.getTime()) {
      await this.repository.revokeRefreshSession(tokenHash, now);
      throw new AuthError("INVALID_REFRESH_TOKEN");
    }
    const user = await this.findUserForSession(current);
    const replacement = this.createRefreshSession(user.id, now);
    const rotated = await this.repository.rotateRefreshSession(
      tokenHash,
      replacement.session,
      now,
    );
    if (!rotated) {
      await this.repository.revokeAllRefreshSessions(current.userId, now);
      throw new AuthError("REFRESH_REPLAYED");
    }
    return this.buildResult(user, replacement.token, replacement.session.expiresAt, now);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    return this.repository.revokeRefreshSession(tokenHash, this.now());
  }

  async getPublicUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AuthError("INVALID_CREDENTIALS");
    }
    return publicUser(user);
  }

  private async findUserForSession(session: RefreshSession) {
    const user = await this.repository.findUserById(session.userId);
    if (user) {
      return publicUser(user);
    }
    throw new AuthError("INVALID_REFRESH_TOKEN");
  }

  private async issueSession(user: PublicUser) {
    const now = this.now();
    const refresh = this.createRefreshSession(user.id, now);
    await this.repository.createRefreshSession(refresh.session);
    return this.buildResult(user, refresh.token, refresh.session.expiresAt, now);
  }

  private createRefreshSession(userId: string, now: Date) {
    const token = createRefreshToken();
    const session: RefreshSession = {
      id: this.createId(),
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(now.getTime() + this.refreshTokenTtlMs),
      revokedAt: null,
    };
    return { token, session };
  }

  private async buildResult(
    user: PublicUser,
    refreshToken: string,
    refreshTokenExpiresAt: Date,
    now: Date,
  ): Promise<AuthResult> {
    return {
      user: publicUser(user),
      accessToken: await issueAccessToken({
        user,
        secret: this.accessTokenSecret,
        now,
        ttlSeconds: this.accessTokenTtlSeconds,
      }),
      refreshToken,
      refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
    };
  }
}
