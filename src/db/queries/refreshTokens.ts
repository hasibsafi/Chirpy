import { db } from "../index.js";
import { refreshTokens , users} from "../schema.js";
import { eq } from "drizzle-orm";

// create refresh token
export async function createRefreshToken(token: string, userId: string, expiresAt: Date) {
  const [result] = await db
    .insert(refreshTokens)
    .values({ token, userId, expiresAt })
    .returning();
  return result;
}
// get refresh token with user
export async function getRefreshTokenWithUser(token: string) {
  const [result] = await db
    .select({
      token: refreshTokens.token,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
      revokedAt: refreshTokens.revokedAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token));
  return result;
}

// revoke refresh token
export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(refreshTokens.token, token));
}

// get user from refresh token
export async function getUserFromRefreshToken(token: string) {
    const [result] = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        expiresAt: refreshTokens.expiresAt,
        revokedAt: refreshTokens.revokedAt,
      })
      .from(refreshTokens)
      .innerJoin(users, eq(refreshTokens.userId, users.id))
      .where(eq(refreshTokens.token, token));
    return result;
  }