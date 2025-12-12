import { AuthService, DatabaseInitializer, JWTServiceBun, type User } from 'open-bauth';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export interface ExtendedUserData {
  email: string;
  password: string;
  username: string;
  first_name: string;
  last_name: string;
  bio?: string;
  timezone?: string;
  language?: string;
  avatar_url?: string;
  phone_number?: string;
}

export interface ExtendedAuthResult {
  success: boolean;
  user?: any;
  token?: string;
  error?: {
    type: string;
    message: string;
  };
}

export class ExtendedAuthService {
  private authService: AuthService;
  private dbInitializer: DatabaseInitializer;
  private jwtService: JWTServiceBun;

  constructor(dbInitializer: DatabaseInitializer, jwtService: JWTServiceBun) {
    this.authService = new AuthService(dbInitializer, jwtService);
    this.dbInitializer = dbInitializer;
    this.jwtService = jwtService;
  }

  async register(userData: ExtendedUserData): Promise<ExtendedAuthResult> {
    try {
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        return {
          success: false,
          error: {
            type: 'DATABASE_ERROR',
            message: 'Invalid email format'
          }
        };
      }

      // Validar longitud de contraseña
      if (userData.password.length < 8) {
        return {
          success: false,
          error: {
            type: 'DATABASE_ERROR',
            message: 'Password must be at least 8 characters long'
          }
        };
      }

      // Verificar si el usuario ya existe
      const existingUser = await this.dbInitializer.createController('users').findFirst({
        email: userData.email
      });

      if (existingUser.data) {
        return {
          success: false,
          error: {
            type: 'DATABASE_ERROR',
            message: 'User already exists'
          }
        };
      }

      // Hash de la contraseña
      const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '10');
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      // Crear el usuario con todos los campos extendidos
      const userController = this.dbInitializer.createController('users');
      const result = await userController.create({
        id: randomUUID(),
        email: userData.email,
        password_hash: passwordHash,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name,
        bio: userData.bio || '',
        timezone: userData.timezone || 'UTC',
        language: userData.language || 'en',
        avatar_url: userData.avatar_url || '',
        phone_number: userData.phone_number || '',
        is_active: true
      });

      if (!result.data) {
        return {
          success: false,
          error: {
            type: 'DATABASE_ERROR',
            message: result.error || 'Failed to create user'
          }
        };
      }

      const userRecord = result.data as any;

      // Generar token JWT con la estructura correcta
      const userForToken: User = {
        id: userRecord['id'],
        email: userRecord['email'],
        username: userRecord['username'],
        is_active: userRecord['is_active'],
        created_at: userRecord['created_at'],
        updated_at: userRecord['updated_at']
      };
      const token = await this.jwtService.generateToken(userForToken);

      // Eliminar el password_hash del objeto de usuario
      const { password_hash, ...userWithoutPassword } = userRecord;

      // Asegurarnos de que el username esté incluido
      const userWithUsername = {
        ...userWithoutPassword,
        username: userWithoutPassword.username || userData.username
      };

      return {
        success: true,
        user: userWithUsername,
        token
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Registration failed'
        }
      };
    }
  }

  async login(credentials: { email: string; password: string }): Promise<ExtendedAuthResult> {
    try {
      // Buscar usuario por email
      const userController = this.dbInitializer.createController('users');
      const result = await userController.findFirst({
        email: credentials.email
      });

      if (!result.data) {
        return {
          success: false,
          error: {
            type: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials'
          }
        };
      }

      const userRecord = result.data as any;

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(credentials.password, userRecord['password_hash']);

      if (!isPasswordValid) {
        return {
          success: false,
          error: {
            type: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials'
          }
        };
      }

      // Generar token JWT con la estructura correcta
      const userForToken: User = {
        id: userRecord['id'],
        email: userRecord['email'],
        username: userRecord['username'],
        is_active: userRecord['is_active'],
        created_at: userRecord['created_at'],
        updated_at: userRecord['updated_at']
      };
      const token = await this.jwtService.generateToken(userForToken);

      // Eliminar el password_hash del objeto de usuario
      const { password_hash, ...userWithoutPassword } = userRecord;

      return {
        success: true,
        user: userWithoutPassword as any,
        token
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Login failed'
        }
      };
    }
  }

  // Add findUserById method for compatibility with auth middleware
  async findUserById(userId: string): Promise<(User & { roles: any[]; first_name: string; last_name: string; bio: string; timezone: string; language: string; avatar_url: string; phone_number: string; }) | null> {
    try {
      const userController = this.dbInitializer.createController('users');
      const result = await userController.findById(userId);
      
      if (!result.success || !result.data) {
        return null;
      }

      const userRecord = result.data as any;
      
      // Return user in format expected by middleware
      return {
        id: userRecord['id'],
        email: userRecord['email'],
        username: userRecord['username'],
        is_active: userRecord['is_active'],
        created_at: userRecord['created_at'],
        updated_at: userRecord['updated_at'],
        // Include additional fields that might be needed
        roles: userRecord['roles'] || [],
        first_name: userRecord['first_name'],
        last_name: userRecord['last_name'],
        bio: userRecord['bio'],
        timezone: userRecord['timezone'],
        language: userRecord['language'],
        avatar_url: userRecord['avatar_url'],
        phone_number: userRecord['phone_number']
      };
    } catch (error) {
      console.error('findUserById error:', error);
      return null;
    }
  }

  // Add findUserByEmail method for compatibility
  async findUserByEmail(email: string): Promise<(User & { roles: any[]; first_name: string; last_name: string; bio: string; timezone: string; language: string; avatar_url: string; phone_number: string; }) | null> {
    try {
      const userController = this.dbInitializer.createController('users');
      const result = await userController.findFirst({ email });
      
      if (!result.success || !result.data) {
        return null;
      }

      const userRecord = result.data as any;
      
      // Return user in format expected by middleware
      return {
        id: userRecord['id'],
        email: userRecord['email'],
        username: userRecord['username'],
        is_active: userRecord['is_active'],
        created_at: userRecord['created_at'],
        updated_at: userRecord['updated_at'],
        roles: userRecord['roles'] || [],
        first_name: userRecord['first_name'],
        last_name: userRecord['last_name'],
        bio: userRecord['bio'],
        timezone: userRecord['timezone'],
        language: userRecord['language'],
        avatar_url: userRecord['avatar_url'],
        phone_number: userRecord['phone_number']
      };
    } catch (error) {
      console.error('findUserByEmail error:', error);
      return null;
    }
  }

  // Add getUserRoles method for compatibility
  async getUserRoles(userId: string): Promise<any[]> {
    try {
      const userRolesController = this.dbInitializer.createController('user_roles');
      const rolesController = this.dbInitializer.createController('roles');
      
      const userRolesResult = await userRolesController.findAll({
        where: { user_id: userId }
      });
      
      const roles = [];
      if (userRolesResult.data) {
        for (const userRole of userRolesResult.data as any[]) {
          const roleResult = await rolesController.findById(userRole.role_id);
          if (roleResult.success && roleResult.data) {
            roles.push(roleResult.data);
          }
        }
      }
      
      return roles;
    } catch (error) {
      console.error('getUserRoles error:', error);
      return [];
    }
  }

  // Add updateUser method for compatibility
  async updateUser(userId: string, updates: Partial<any>): Promise<{ success: boolean; error?: string }> {
    try {
      const userController = this.dbInitializer.createController('users');
      const result = await userController.update(userId, updates);
      
      return {
        success: result.success,
        error: result.error || undefined
      };
    } catch (error) {
      console.error('updateUser error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  // Add getUsers method for OAuth compatibility
  async getUsers(page?: number, limit?: number, filters?: any): Promise<{ users: any[]; total: number }> {
    try {
      const userController = this.dbInitializer.createController('users');
      
      // Build query options
      const options: any = {};
      
      if (page) {
        options.offset = ((page - 1) * (limit || 10));
        options.limit = limit || 10;
      }
      
      if (limit) {
        options.limit = limit;
      }
      
      if (filters) {
        options.where = filters;
      }
      
      const result = await userController.findAll(options);
      
      return {
        users: result.data || [],
        total: result.total || 0
      };
    } catch (error) {
      console.error('getUsers error:', error);
      return {
        users: [],
        total: 0
      };
    }
  }
}
