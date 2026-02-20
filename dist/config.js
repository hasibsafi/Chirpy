process.loadEnvFile();
//functions
export const migrationConfig = {
    migrationsFolder: "./src/db/migrations",
};
export const config = {
    api: {
        fileServerHits: 0,
        dbURL: process.env.DB_URL || "",
        platform: process.env.PLATFORM || "prod",
    },
    db: {
        dbURL: process.env.DB_URL || "",
        migrationConfig,
    }
};
