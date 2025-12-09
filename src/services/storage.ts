import { randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, access } from 'fs/promises';
import { join, extname } from 'path';
import { defaultLogger } from '../utils/logger';

export interface StorageProvider {
  upload(file: File | Blob | Buffer, filename: string, folder?: string): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs';
  uploadDir: string;
  baseUrl: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private baseUrl: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor(config: { uploadDir: string; baseUrl: string; maxFileSize?: number; allowedMimeTypes?: string[] }) {
    this.uploadDir = config.uploadDir;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowedMimeTypes = config.allowedMimeTypes || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/json'
    ];
  }

  async upload(file: File | Blob | Buffer, filename: string, folder: string = 'default'): Promise<{ url: string; key: string }> {
    try {
      // Handle different file types
      let fileSize: number;
      let buffer: Buffer;
      let mimeType: string;

      if (file instanceof Buffer) {
        fileSize = file.length;
        buffer = file;
        mimeType = 'application/octet-stream';
      } else {
        // Handle File or Blob - cast to access properties safely
        const fileOrBlob = file as File | Blob;
        fileSize = fileOrBlob.size;
        mimeType = fileOrBlob.type;
        
        // Convert to buffer
        if ('arrayBuffer' in fileOrBlob) {
          buffer = Buffer.from(await fileOrBlob.arrayBuffer());
        } else {
          // Fallback for older File/Blob implementations
          throw new Error('File/Blob does not support arrayBuffer method');
        }
      }

      if (fileSize > this.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
      }

      if (mimeType !== 'application/octet-stream' && !this.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`);
      }

      // Create directory if it doesn't exist
      const folderPath = join(this.uploadDir, folder);
      await mkdir(folderPath, { recursive: true });

      // Generate unique filename
      const fileExtension = extname(filename);
      const uniqueFilename = `${randomUUID()}${fileExtension}`;
      const filePath = join(folderPath, uniqueFilename);

      await writeFile(filePath, buffer);

      const key = `${folder}/${uniqueFilename}`;
      const url = `${this.baseUrl}/uploads/${key}`;

      defaultLogger.info('File uploaded successfully', {
        key,
        url,
        size: buffer.length,
        mimeType
      });

      return { url, key };
    } catch (error) {
      defaultLogger.error('Failed to upload file', error as Error, {
        filename,
        folder
      });
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = join(this.uploadDir, key);
      await unlink(filePath);
      
      defaultLogger.info('File deleted successfully', { key });
      return true;
    } catch (error) {
      defaultLogger.error('Failed to delete file', error as Error, { key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = join(this.uploadDir, key);
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export class StorageService {
  private provider: StorageProvider;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    
    switch (config.provider) {
      case 'local':
        this.provider = new LocalStorageProvider(config);
        break;
      case 's3':
        throw new Error('S3 provider not implemented yet');
      case 'gcs':
        throw new Error('Google Cloud Storage provider not implemented yet');
      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  }

  async uploadFile(file: File | Blob | Buffer, filename: string, folder?: string): Promise<{ url: string; key: string }> {
    return this.provider.upload(file, filename, folder);
  }

  async deleteFile(key: string): Promise<boolean> {
    return this.provider.delete(key);
  }

  async fileExists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  getConfig(): StorageConfig {
    return this.config;
  }

  // Helper method to generate a safe filename
  static sanitizeFilename(filename: string): string {
    // Remove any path components and special characters
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase()
      .substring(0, 255);
  }

  // Helper method to generate a unique filename
  static generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const random = randomUUID().substring(0, 8);
    const extension = extname(originalFilename);
    const nameWithoutExt = originalFilename.replace(extension, '');
    const sanitized = this.sanitizeFilename(nameWithoutExt);
    
    return `${sanitized}_${timestamp}_${random}${extension}`;
  }
}

// Middleware for handling file uploads
export function createFileUploadMiddleware(storageService: StorageService, options: {
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  folder?: string;
} = {}) {
  const { maxFiles = 5, maxFileSize, allowedTypes, folder = 'uploads' } = options;

  return async (c: any, next: any) => {
    try {
      const contentType = c.req.header('content-type') || '';
      
      if (!contentType.includes('multipart/form-data')) {
        return c.json({ error: 'Content-Type must be multipart/form-data' }, 400);
      }

      const formData = await c.req.parseBody();
      const files: any[] = [];
      
      // Process uploaded files
      for (const [key, value] of Object.entries(formData)) {
        if (value instanceof File || value instanceof Blob) {
          const file = value as File;
          
          // Validate file
          if (maxFileSize && file.size > maxFileSize) {
            return c.json({ 
              error: `File ${file.name} exceeds maximum size of ${maxFileSize} bytes` 
            }, 400);
          }
          
          if (allowedTypes && !allowedTypes.includes(file.type)) {
            return c.json({ 
              error: `File type ${file.type} is not allowed for ${file.name}` 
            }, 400);
          }
          
          // Upload file
          const filename = StorageService.generateUniqueFilename(file.name);
          const result = await storageService.uploadFile(file, filename, folder);
          
          files.push({
            fieldName: key,
            originalName: file.name,
            filename: filename,
            url: result.url,
            key: result.key,
            size: file.size,
            type: file.type
          });
        }
      }

      if (files.length === 0) {
        return c.json({ error: 'No files uploaded' }, 400);
      }

      if (files.length > maxFiles) {
        return c.json({ error: `Maximum ${maxFiles} files allowed` }, 400);
      }

      // Attach uploaded files to context
      c.set('uploadedFiles', files);
      
      await next();
    } catch (error) {
      defaultLogger.error('File upload error', error as Error);
      return c.json({ error: 'File upload failed' }, 500);
    }
  };
}