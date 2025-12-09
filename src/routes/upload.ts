import { Hono } from "hono";
import { getServiceFactory } from "../services/service-factory";
import { createAuthMiddlewareForHono } from "../middleware";
import { createFileUploadMiddleware } from "../services/storage";
import { defaultLogger } from "../utils/logger";

export const upload = new Hono();
const factory = getServiceFactory();
const services = factory.getServices();

const authMiddleware = createAuthMiddlewareForHono();
const uploadMiddleware = createFileUploadMiddleware(services.storageService, {
    maxFiles: 1,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
});

// POST /api/v1/upload
upload.post("/", authMiddleware, uploadMiddleware, async (c) => {
    try {
        const files = (c as any).uploadedFiles;

        if (!files || files.length === 0) {
            return c.json({ success: false, error: "No files uploaded" }, 400);
        }

        const file = files[0];

        await services.auditService.log('file.upload', {
            userId: (c as any).auth.user.id,
            message: `File uploaded: ${file.originalName}`,
            metadata: {
                filename: file.originalName,
                key: file.key
            }
        });

        return c.json({
            success: true,
            data: {
                url: file.url,
                key: file.key,
                filename: file.originalName
            }
        });
    } catch (error) {
        defaultLogger.error("Upload handler error", error as Error);
        return c.json({ success: false, error: "Internal server error" }, 500);
    }
});

export { upload as uploadRoutes };
