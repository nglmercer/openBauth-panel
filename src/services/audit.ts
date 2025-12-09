import { DatabaseInitializer, BaseController } from 'open-bauth';
import { defaultLogger } from '../utils/logger';

export interface AuditLog {
  id?: string;
  event: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: any;
  timestamp?: Date;
}

export class AuditService {
  private controller: BaseController;
  private initialized: boolean = false;

  constructor(dbInitializer: DatabaseInitializer) {
    try {
      this.controller = dbInitializer.createController('audit_logs');

      // Initialize asynchronously to avoid blocking constructor
      //@ts-ignore
      this.initializeAuditTable().catch(error => {
        //defaultLogger.warn('Audit table not available, audit logging disabled', error as Error);
        this.initialized = false;
      });
    } catch (error) {
      defaultLogger.warn('Failed to create audit controller, audit logging disabled', error as Error);
      this.initialized = false;
      // Create a dummy controller that does nothing
      this.controller = {
        create: async () => ({ success: true }),
        findFirst: async () => ({ success: false, error: 'Audit disabled' }),
        findAll: async () => ({ success: false, error: 'Audit disabled', data: [], total: 0 }),
        search: async () => ({ success: false, error: 'Audit disabled', data: [], total: 0 }),
        delete: async () => ({ success: true })
      } as any;
    }
  }

  private async initializeAuditTable(): Promise<void> {
    try {
      // Check if table exists by trying to query it
      const result = await this.controller.findFirst({});
      if (result.success) {
        this.initialized = true;
        defaultLogger.info('Audit table initialized successfully');
      } else {
        // Table might not exist or have issues
        //defaultLogger.warn('Audit table may not be properly initialized', result.error);
        this.initialized = false;
      }
    } catch (error) {
      defaultLogger.error('Failed to initialize audit table', error as Error);
      this.initialized = false;
    }
  }

  private async ensureInitialized(): Promise<boolean> {
    if (!this.initialized) {
      await this.initializeAuditTable();
    }
    return this.initialized;
  }

  async log(event: string, data: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
    message?: string;
    metadata?: any;
  }): Promise<boolean> {
    try {
      // Ensure audit table is initialized
      const isInitialized = await this.ensureInitialized();
      if (!isInitialized) {
        //defaultLogger.warn('Audit service not initialized, skipping audit log', { event, userId: data.userId });
        return false;
      }

      const auditLog: AuditLog = {
        event,
        userId: data.userId || 'system',
        ip: data.ip || 'unknown',
        userAgent: data.userAgent || '',
        level: data.level || 'info',
        message: data.message || event,
        metadata: data.metadata,
        timestamp: new Date()
      };

      const result = await this.controller.create(auditLog);

      if (result.success) {
        defaultLogger.info(`Audit log created: ${event}`, {
          userId: data.userId,
          level: data.level || 'info'
        });
        return true;
      } else {
        // Log the error but don't throw it to avoid breaking the main flow
        defaultLogger.error('Failed to create audit log', new Error(result.error ? String(result.error) : 'Unknown error'));
        return false;
      }
    } catch (error) {
      defaultLogger.error('Error creating audit log', error as Error);
      return false;
    }
  }

  async logAuthEvent(event: string, userId: string, ip: string, userAgent?: string, success: boolean = true): Promise<boolean> {
    return this.log(event, {
      userId,
      ip,
      userAgent: userAgent || '',
      level: success ? 'info' : 'error',
      message: `User ${userId} ${event} ${success ? 'successfully' : 'failed'}`,
      metadata: { success }
    });
  }

  async logSecurityEvent(event: string, data: {
    userId?: string;
    ip: string;
    userAgent?: string;
    threatLevel?: 'low' | 'medium' | 'high' | 'critical';
    details?: any;
  }): Promise<boolean> {
    const level = this.getSecurityLevel(data.threatLevel);

    return this.log(event, {
      userId: data.userId || '',
      ip: data.ip,
      userAgent: data.userAgent || '',
      level,
      message: `Security event: ${event}`,
      metadata: {
        threatLevel: data.threatLevel || 'low',
        details: data.details
      }
    });
  }

  async logApiEvent(method: string, path: string, data: {
    userId?: string;
    ip: string;
    userAgent?: string;
    statusCode?: number;
    responseTime?: number;
    error?: any;
  }): Promise<boolean> {
    const event = `api.${method.toLowerCase()}.${path.replace(/\//g, '.')}`;
    const level = data.statusCode && data.statusCode >= 400 ? 'error' : 'info';

    return this.log(event, {
      userId: data.userId || '',
      ip: data.ip,
      userAgent: data.userAgent || '',
      level,
      message: `${method} ${path} - ${data.statusCode || 'unknown'}`,
      metadata: {
        method,
        path,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        error: data.error
      }
    });
  }

  async logDatabaseEvent(event: string, data: {
    table?: string;
    operation?: string;
    userId?: string;
    affectedRows?: number;
    error?: any;
  }): Promise<boolean> {
    return this.log(`database.${event}`, {
      userId: data.userId || '',
      level: data.error ? 'error' : 'info',
      message: `Database ${event} on ${data.table || 'unknown'}`,
      metadata: {
        table: data.table || '',
        operation: data.operation || '',
        affectedRows: data.affectedRows || 0,
        error: data.error
      }
    });
  }

  private getSecurityLevel(threatLevel?: string): 'info' | 'warn' | 'error' | 'debug' {
    switch (threatLevel) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
      default:
        return 'info';
    }
  }

  async getAuditLogs(filters: {
    userId?: string;
    event?: string;
    level?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.event) where.event = filters.event;
      if (filters.level) where.level = filters.level;

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.$gte = filters.startDate.toISOString();
        if (filters.endDate) where.timestamp.$lte = filters.endDate.toISOString();
      }

      const result = await this.controller.findAll({
        where,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        orderBy: 'timestamp'
      });

      if (result.success) {
        return {
          logs: (result.data as any as AuditLog[]) || [],
          total: result.total || 0
        };
      } else {
        defaultLogger.error('Failed to retrieve audit logs', new Error((result.error as any)?.message));
        return { logs: [], total: 0 };
      }
    } catch (error) {
      defaultLogger.error('Error retrieving audit logs', error as Error);
      return { logs: [], total: 0 };
    }
  }

  async cleanupAuditLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.controller.search({
        timestamp: { $lt: cutoffDate.toISOString() }
      });

      if (result.success && result.data) {
        let deletedCount = 0;
        for (const log of result.data) {
          const deleteResult = await this.controller.delete((log as any).id);
          if (deleteResult.success) deletedCount++;
        }

        defaultLogger.info(`Cleaned up ${deletedCount} audit logs older than ${olderThanDays} days`);
        return deletedCount;
      }

      return 0;
    } catch (error) {
      defaultLogger.error('Error cleaning up audit logs', error as Error);
      return 0;
    }
  }
}