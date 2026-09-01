import { z } from "zod";

export const PublicUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().trim().min(1).max(100),
  })
  .strict();

export type PublicUser = z.infer<typeof PublicUserSchema>;

export const RegisterRequestSchema = z
  .object({
    email: z.email().max(254),
    displayName: z.string().trim().min(1).max(100),
    password: z
      .string()
      .min(12)
      .max(128)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/\d/)
      .regex(/[^A-Za-z0-9]/),
  })
  .strict();

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthSessionResponseSchema = z
  .object({
    user: PublicUserSchema,
    accessToken: z.string().min(1),
    refreshTokenExpiresAt: z.iso.datetime(),
  })
  .strict();

export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

export const CurrentUserResponseSchema = z
  .object({ user: PublicUserSchema })
  .strict();

export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;
