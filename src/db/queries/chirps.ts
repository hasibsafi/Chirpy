import { db } from "../index.js";
import { chirps } from "../schema.js";
import { asc, eq } from "drizzle-orm";

export async function createChirp({ body, userId }: { body: string; userId: string }) {
  const [result] = await db
    .insert(chirps)
    .values({ body, userId })
    .returning();
  return result;
}
// get all chirps
export async function getAllChirps(authorId?: string) {
  if (authorId) {
    return await db
      .select()
      .from(chirps)
      .where(eq(chirps.userId, authorId))
      .orderBy(asc(chirps.createdAt));
  }
  return await db.select().from(chirps).orderBy(asc(chirps.createdAt));
}
// get a single chirp by id
export async function getChirpById(id: string) {
    const result = await db.select().from(chirps).where(eq(chirps.id, id));
    return result[0] || null;
}

// delete a chirp by id
export async function deleteChirpById(id: string) {
  const result = await db.delete(chirps).where(eq(chirps.id, id)).returning();
  return result[0] || null;
}
