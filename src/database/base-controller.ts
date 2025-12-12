import { SQLiteSchemaExtractor,type TableInfo,type TableSchema } from "open-bauth";
import { dbInitializer,db } from "../db";
export const extractor = new SQLiteSchemaExtractor(db);

export async function getSchemas():Promise<TableInfo[]> {
    const allSchemas = await extractor.getAllTablesInfo();
    return allSchemas;
}
export async function getTableInfo(tableName:string):Promise<TableInfo | null>{
    const tableInfo = await extractor.getTableInfo(tableName);
    return tableInfo;
}
export function getDefaultSchemas():TableSchema[]{
    return dbInitializer.getSchemas();
}
export function getZodSchema(schemas:TableSchema){
    const extractor = new SQLiteSchemaExtractor(db);
    return extractor.generateZodSchema(schemas)
}