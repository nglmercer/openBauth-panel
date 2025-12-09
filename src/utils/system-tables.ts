// System tables that should not be accessible via the generic API
export const SYSTEM_TABLES = [
  'users',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
  'sessions',
  'oauth_clients',
  'authorization_codes',
  'refresh_tokens',
  'device_secrets',
  'biometric_credentials',
  'anonymous_users',
  'user_devices',
  'mfa_configurations',
  'security_challenges',
  'oauth_sessions',
  'audit_logs',
  'rate_limits',
  'files',
  'notifications'
];

export function isSystemTable(tableName: string): boolean {
  return SYSTEM_TABLES.includes(tableName.toLowerCase());
}

export function getSystemTables(): string[] {
  return [...SYSTEM_TABLES];
}