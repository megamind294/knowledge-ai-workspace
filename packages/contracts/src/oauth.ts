import { z } from "zod";

export const AuthCapabilitiesResponseSchema=z.object({googleOAuth:z.boolean()}).strict();
export type AuthCapabilitiesResponse=z.infer<typeof AuthCapabilitiesResponseSchema>;
export const OAuthIdentitySchema=z.object({provider:z.literal("google"),subject:z.string().min(1),email:z.email(),displayName:z.string().trim().min(1).max(100)}).strict();
export type OAuthIdentity=z.infer<typeof OAuthIdentitySchema>;
