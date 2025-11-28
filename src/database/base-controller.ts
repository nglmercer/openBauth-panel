import { BaseController } from "open-bauth";
import { SQLiteSchemaExtractor,type TableInfo,type TableSchema } from "open-bauth";
import { dbInitializer,db } from "../db";
export async function getSchemas():Promise<TableInfo[]> {
    const extractor = new SQLiteSchemaExtractor(db);
    const allSchemas = await extractor.getAllTablesInfo();
    return allSchemas;
}
export function getDefaultSchemas():TableSchema[]{
    return dbInitializer.getSchemas();
}