// tests/setup.ts
// Global test setup to ensure clean state for each test file

// Set environment variables for testing
process.env.NODE_ENV = "test";
process.env.USE_MEMORY_DB = "true";
process.env.JWT_SECRET = "test-secret-key-for-testing-only";

// Ensure each test file gets a fresh database instance
let dbInstance: any = null;

export function getFreshDatabase() {
  if (dbInstance) {
    // Close existing connection if any
    try {
      dbInstance.close();
    } catch (e) {
      // Ignore errors on close
    }
  }
  
  // Create new database instance
  const { Database } = require("bun:sqlite");
  dbInstance = new Database(":memory:");
  return dbInstance;
}

// Reset database before each test file
export function setupTestDatabase() {
  const db = getFreshDatabase();
  
  // Initialize the database
  const { DatabaseInitializer } = require("open-bauth");
  const { getOAuthSchemas } = require("open-bauth");
  
  const dbInitializer = new DatabaseInitializer({ database: db });
  const oauthSchemas = getOAuthSchemas();
  dbInitializer.registerSchemas(oauthSchemas);
  
  return { db, dbInitializer };
}