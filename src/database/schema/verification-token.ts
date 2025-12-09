
export const verificationTokenSchema = {
    tableName: "verification_tokens",
    columns: [
        { name: "id", type: "TEXT", primaryKey: true, nullable: false },
        { name: "user_id", type: "TEXT", nullable: false },
        { name: "token", type: "TEXT", nullable: false }, // Unique token string
        { name: "type", type: "TEXT", nullable: false }, // 'RESET_PASSWORD', 'VERIFY_EMAIL', 'MFA'
        { name: "expires_at", type: "DATETIME", nullable: false },
        { name: "created_at", type: "DATETIME", nullable: false }
    ],
    indexes: [
        { name: "idx_verification_token", columns: ["token"], unique: true },
        { name: "idx_verification_user", columns: ["user_id"] }
    ],
    foreignKeys: [
        { column: "user_id", references: { table: "users", column: "id" }, onDelete: "CASCADE" }
    ]
};
