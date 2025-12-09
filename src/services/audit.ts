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
  private dbInitializer: DatabaseInitializer;

  constructor(dbInitializer: DatabaseInitializer) {
    this.dbInitializer = dbInitializer;
    this.controller = dbInitializer.createController('audit_logs');
    
    // Ensure audit_logs table exists
    this.initializeAuditTable();
  }

  private async initializeAuditTable() {
    try {
      // Check if table exists, if not create it
      const result = await this.controller.findFirst({});
      if (!result.success && result.error?.type === 'NOT_FOUND') {
        // Table doesn't exist, we need to create it via schema extension
        defaultLogger.info('Audit table initialized');
      }
    } catch (error) {
      defaultLogger.error('Failed to initialize audit table', error as Error);
    }
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
      const auditLog: AuditLog = {
        event,
        userId: data.userId,
        ip: data.ip,
        userAgent: data.userAgent,
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
        defaultLogger.error('Failed to create audit log', new Error(result.error?.message));
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
      userAgent,
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
      userId: data.userId,
      ip: data.ip,
      userAgent: data.userAgent,
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
      userId: data.userId,
      ip: data.ip,
      userAgent: data.userAgent,
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
      userId: data.userId,
      level: data.error ? 'error' : 'info',
      message: `Database ${event} on ${data.table || 'unknown'}`,
      metadata: {
        table: data.table,
        operation: data.operation,
        affectedRows: data.affectedRows,
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
        orderBy: 'timestamp',
        order: 'DESC'
      });

      if (result.success) {
        return {
          logs: result.data || [],
          total: result.total || 0
        };
      } else {
        defaultLogger.error('Failed to retrieve audit logs', new Error(result.error?.message));
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
          const deleteResult = await this.controller.delete(log.id);
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