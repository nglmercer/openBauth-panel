import { BaseController } from "open-bauth";
import { DatabaseInitializer } from "open-bauth";
import { randomUUID } from "crypto";
import { defaultLogger } from "../utils/logger";

export type TokenType = 'RESET_PASSWORD' | 'VERIFY_EMAIL' | 'MFA';

export class VerificationService {
    private controller: BaseController;

    constructor(dbInitializer: DatabaseInitializer) {
        this.controller = dbInitializer.createController("verification_tokens");
    }

    async createToken(userId: string, type: TokenType, expiresInMinutes: number = 60): Promise<string> {
        const token = randomUUID(); // Use a secure random string generator
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

        // Invalidate existing tokens of same type for user? Optional policy.
        // For now, let's just create a new one.

        const result = await this.controller.create({
            id: randomUUID(),
            user_id: userId,
            token: token,
            type: type,
            expires_at: expiresAt,
            created_at: new Date().toISOString()
        });

        if (!result.success) {
            defaultLogger.error("Failed to store verification token", new Error(result.error));
            throw new Error("Failed to generate token");
        }

        return token;
    }

    async verifyToken(token: string, type: TokenType): Promise<{ valid: boolean; userId?: string }> {
        // Use findAll instead of findFirst to avoid potential issue with multiple where clauses
        const result = await this.controller.findAll();

        if (!result.success || !result.data) {
            return { valid: false };
        }

        const record = (result.data as any[]).find(r => r.token === token && r.type === type);

        if (!record) {
            return { valid: false };
        }

        if (new Date() > new Date(record.expires_at)) {
            // Token expired
            await this.controller.delete(record.id); // Cleanup
            return { valid: false };
        }

        // Token is valid
        // Optionally consume (delete) it
        await this.controller.delete(record.id);

        return { valid: true, userId: record.user_id };
    }
}
