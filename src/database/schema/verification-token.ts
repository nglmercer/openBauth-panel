import type { TableSchema } from "open-bauth";

export const verificationTokenSchema: TableSchema = {
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
