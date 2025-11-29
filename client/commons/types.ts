// types.ts - Tipos para la configuración de proxy
export interface ProxyConfig {
  enabled: boolean;
  url: string;
  auth?: {
    username: string;
    password: string;
  };
  timeout?: number;
}

export interface ApiConfig {
  host: string;
  port: number | string;
  protocol: "http" | "https";
  getFullUrl: () => string;
  update: (
    newConfig: Partial<Omit<ApiConfig, "getFullUrl" | "update">>,
  ) => void;
  proxy?: ProxyConfig;
}

// Types for OpenBauthPanelClient
export interface User {
  id: string;
  email: string;
  name: string;
  roles?: Role[];
  permissions?: Permission[];
  [key: string]: any;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
  [key: string]: any;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource?: string;
  action?: string;
  [key: string]: any;
}

export interface AuthContext {
  user?: User;
  token?: string;
  permissions: Permission[];
  isAuthenticated: boolean;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: User;
  message?: string;
  [key: string]: any;
}

export interface LoginRequest {
  email: string;
  password: string;
  [key: string]: any;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  [key: string]: any;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  [key: string]: any;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: any;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
