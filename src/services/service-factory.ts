import {
  DatabaseInitializer,
  JWTServiceBun,
  AuthService,
  PermissionService,
  OAuthService,
  SecurityService,
  EnhancedUserService
} from 'open-bauth';
import { dbInitializer, jwtService, authService, permissionService } from '../db';
import { NotificationService } from './notification';
import { AuditService } from './audit';
import { RateLimitService } from './rate-limit';
import { StorageService } from './storage';
import { VerificationService } from './verification';

// Service Factory for dependency injection and centralized service management
export class ServiceFactory {
  private static instance: ServiceFactory;
  private services: Map<string, any> = new Map();
  private _dbInitializer: DatabaseInitializer;
  private _jwtService: JWTServiceBun;
  private _authService: AuthService;
  private _permissionService: PermissionService;
  private _oauthService?: OAuthService;
  private _securityService?: SecurityService;
  private _enhancedUserService?: EnhancedUserService;
  private _notificationService?: NotificationService;
  private _auditService?: AuditService;
  private _rateLimitService?: RateLimitService;
  private _storageService?: StorageService;
  private _verificationService?: VerificationService;

  private constructor() {
    this._dbInitializer = dbInitializer;
    this._jwtService = jwtService;
    this._authService = authService;
    this._permissionService = permissionService;
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  // Get all services
  getServices() {
    return {
      dbInitializer: this._dbInitializer,
      jwtService: this._jwtService,
      authService: this._authService,
      permissionService: this._permissionService,
      oauthService: this.getOAuthService(),
      securityService: this.getSecurityService(),
      enhancedUserService: this.getEnhancedUserService(),
      notificationService: this.getNotificationService(),
      auditService: this.getAuditService(),
      rateLimitService: this.getRateLimitService(),
      storageService: this.getStorageService(),
      verificationService: this.getVerificationService()
    };
  }

  getVerificationService(): VerificationService {
    if (!this._verificationService) {
      this._verificationService = new VerificationService(this._dbInitializer);
    }
    return this._verificationService;
  }

  // Lazy initialization of services
  getOAuthService(): OAuthService {
    if (!this._oauthService) {
      this._oauthService = new OAuthService(
        this._dbInitializer,
        this.getSecurityService(),
        this._jwtService,
        this._authService
      );
    }
    return this._oauthService;
  }

  getSecurityService(): SecurityService {
    if (!this._securityService) {
      this._securityService = new SecurityService();
    }
    return this._securityService;
  }

  getEnhancedUserService(): EnhancedUserService {
    if (!this._enhancedUserService) {
      this._enhancedUserService = new EnhancedUserService(
        this._dbInitializer,
        this.getSecurityService()
      );
    }
    return this._enhancedUserService;
  }

  getNotificationService(): NotificationService {
    if (!this._notificationService) {
      this._notificationService = new NotificationService({
        smtp: {
          host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
          port: parseInt(process.env['SMTP_PORT'] || '587'),
          secure: process.env['SMTP_SECURE'] === 'true',
          user: process.env['SMTP_USER'] || '',
          pass: process.env['SMTP_PASS'] || '',
          from: process.env['SMTP_FROM'] || 'noreply@yourapp.com'
        }
      });
    }
    return this._notificationService;
  }

  getAuditService(): AuditService {
    if (!this._auditService) {
      this._auditService = new AuditService(this._dbInitializer);
    }
    return this._auditService;
  }

  getRateLimitService(): RateLimitService {
    if (!this._rateLimitService) {
      this._rateLimitService = new RateLimitService({
        windowMs: parseInt(process.env['RATE_LIMIT_WINDOW'] || '60') * 1000,
        maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '10')
      });
    }
    return this._rateLimitService;
  }

  getStorageService(): StorageService {
    if (!this._storageService) {
      this._storageService = new StorageService({
        provider: 'local',
        uploadDir: './uploads',
        baseUrl: process.env['FRONTEND_URL'] || 'http://localhost:3000'
      });
    }
    return this._storageService;
  }

  // Register custom service
  registerService(name: string, service: any) {
    this.services.set(name, service);
  }

  // Get custom service
  getService<T>(name: string): T | undefined {
    return this.services.get(name);
  }
}

// Export singleton instance
export const getServiceFactory = () => ServiceFactory.getInstance();