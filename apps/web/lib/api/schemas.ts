import { z } from "zod";

// Only the fields the web app uses. Unknown fields are ignored (zod strips them), so the API can
// add fields without breaking the client. Note there is no refresh_token anywhere: web requests
// send `X-Client: web`, and the API then returns the refresh token only in the httpOnly cookie.

export const roleSchema = z.enum(["DRIVER", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

/** POST /auth/login */
export const loginResponseSchema = z.object({
  access_token: z.string(),
  user: userSchema,
});

/** POST /auth/refresh */
export const refreshResponseSchema = z.object({
  access_token: z.string(),
});

/** GET /auth/me */
export const meResponseSchema = userSchema;

/** GET /admin/users */
export const adminUserSchema = userSchema.extend({
  createdAt: z.string(),
  activeSessionCount: z.number().int(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** PATCH /admin/users/:id/role returns the updated user (without the session count). */
export const updatedUserSchema = adminUserSchema.omit({ activeSessionCount: true });
export type UpdatedUser = z.infer<typeof updatedUserSchema>;

export const adminUsersListSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminUsersList = z.infer<typeof adminUsersListSchema>;

/** GET /admin/users/:id/sessions: one entry per active session (refresh-token family). */
export const sessionSchema = z.object({
  familyId: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(), // null for sessions that predate the column
  userAgent: z.string().nullable(),
});
export type UserSession = z.infer<typeof sessionSchema>;
export const sessionsListSchema = z.array(sessionSchema);
