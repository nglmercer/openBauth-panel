import { Database } from 'bun:sqlite';
import { DatabaseInitializer } from 'open-bauth';
import { getOAuthSchemas } from 'open-bauth';

const db = new Database(':memory:');
const dbInitializer = new DatabaseInitializer({ database: db });
const oauthSchemas = getOAuthSchemas();
dbInitializer.registerSchemas(oauthSchemas);
await dbInitializer.initialize();

// Check users table schema
const result = db.prepare("PRAGMA table_info(users)").all();
console.log('Users table schema:');
console.log(JSON.stringify(result, null, 2));