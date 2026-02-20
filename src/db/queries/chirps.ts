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

export async function getAllChirps() {
    return await db.select().from(chirps).orderBy(asc(chirps.createdAt));
}

export async function getChirpById(id: string) {
    const result = await db.select().from(chirps).where(eq(chirps.id, id));
    return result[0] || null;
}