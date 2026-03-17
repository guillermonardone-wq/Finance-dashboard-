import dotenv from "dotenv";
dotenv.config();

const config = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "signalforge",
      user: process.env.DB_USER || "signalforge",
      password: process.env.DB_PASSWORD || "dev_password",
    },
    migrations: {
      directory: "./server/db/migrations",
      tableName: "knex_migrations",
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  test: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "signalforge_test",
      user: process.env.DB_USER || "signalforge",
      password: process.env.DB_PASSWORD || "dev_password",
    },
    migrations: {
      directory: "./server/db/migrations",
      tableName: "knex_migrations",
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  production: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    },
    migrations: {
      directory: "./server/db/migrations",
      tableName: "knex_migrations",
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};

export default config;
