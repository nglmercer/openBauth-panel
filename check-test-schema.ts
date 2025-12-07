import { Database } from 'bun:sqlite';
import { DatabaseInitializer } from 'open-bauth';
import { testSchemas } from './tests/test-schemas';

const db = new Database(':memory:');
const dbInitializer = new DatabaseInitializer({ database: db });
dbInitializer.registerSchemas(testSchemas);
await dbInitializer.initialize();

// Check users table schema
const result = db.prepare("PRAGMA table_info(users)").all();
console.log('Users table schema with test schemas:');
console.log(JSON.stringify(result, null, 2));