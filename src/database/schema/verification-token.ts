import type { TableSchema } from "open-bauth";
import { Schema,z } from "open-bauth";
export const verificationTokenSchema2: TableSchema = {
    tableName: "verification_tokens",
    columns: [
        { name: "id", type: "TEXT", primaryKey: true },
        { name: "user_id", type: "TEXT" },
        { name: "token", type: "TEXT" },
        { name: "type", type: "TEXT" },
        { name: "expires_at", type: "DATETIME" },
        { name: "created_at", type: "DATETIME" }
    ],
    indexes: [
        { name: "idx_verification_token", columns: ["token"], unique: true },
        { name: "idx_verification_user", columns: ["user_id"], unique: false }
    ]
};

export const verifyTokenSchema = new Schema({
    id:String,
    user_id:String,
    token:String,
    type:String,
    expires_at:Date,
    created_at:Date
},{
    indexes:[
        { name: "idx_verification_token", columns: ["token"], unique: true },
        { name: "idx_verification_user", columns: ["user_id"], unique: false }
    ]
});
export const verificationTokenSchema = verifyTokenSchema.toTableSchema("verification_tokens");

// Usa este directamente:
export const ZodSchemaToken = verifyTokenSchema.toZodTyped();

// Ahora sí funcionará:
export type TokenType = z.infer<typeof ZodSchemaToken.read>;
export type CreateTokenType = z.infer<typeof ZodSchemaToken.create>;
export type UpdateTokenType = z.infer<typeof ZodSchemaToken.update>; 
//console.log("TokenType",ZodSchemaToken)
