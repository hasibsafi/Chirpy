import { db } from "../index.js";
import { NewUser, users } from "../schema.js";
import { eq } from "drizzle-orm";

// create user

export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();
  return result;
}
// get user by email
export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}
// delete all users
export async function deleteAllUsers() {
  await db.delete(users);
}

// update user
export async function updateUser(userId: string, data: { email?: string; hashedPassword?: string }) {
  const [result] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, userId))
    .returning();
  return result;
}

// update user's chirpy red status
export async function upgradeUserToChirpyRed(userId: string) {
  const [result] = await db
    .update(users)
    .set({ isChirpyRed: true })
    .where(eq(users.id, userId))
    .returning();
  return result;
}