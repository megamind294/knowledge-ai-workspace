import { compare, hash } from "bcryptjs";

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

interface PasswordServiceOptions {
  rounds?: number;
}

export const DUMMY_PASSWORD_HASH =
  "$2b$12$0EuI7BfL5RAHOe8gN1mJ2eLwj1C5z1nVb9uWZKxGv3Q2xZqH3sYQK";

export function createPasswordService(
  options: PasswordServiceOptions = {},
): PasswordService {
  const rounds = options.rounds ?? 12;
  if (!Number.isInteger(rounds) || rounds < 4 || rounds > 15) {
    throw new Error("bcrypt rounds must be between 4 and 15");
  }

  return {
    hash: (password) => hash(password, rounds),
    verify: (password, passwordHash) => compare(password, passwordHash),
  };
}
