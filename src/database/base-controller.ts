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
export function getZodSchema(schemas:TableSchema){
        const extractor = new SQLiteSchemaExtractor(db);
    return extractor.generateZodSchema(schemas)
}