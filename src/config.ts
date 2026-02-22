import { platform } from "node:os";

process.loadEnvFile()
// types
export type ApiConfig = {
    fileServerHits: number;
    dbURL: string;
}

export type MigrationConfig = {
  migrationsFolder: string;
}
export type DBConfig = {
  dbURL: string;
  migrationConfig: MigrationConfig;
}

//functions

export const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
}
export const config = {
  api: {
    fileServerHits: 0,
    dbURL: process.env.DB_URL || "",
    platform: process.env.PLATFORM || "prod",
    jwtSecret: process.env.JWT_SECRET || "",
    polkaKey: process.env.POLKA_KEY || "",
  },
  db: {
    dbURL: process.env.DB_URL || "",
    migrationConfig,
  
}
};





export { };
