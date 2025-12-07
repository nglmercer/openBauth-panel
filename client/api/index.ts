// API clients index file - Exports all API client classes
export { AuthClient, createAuthClient } from "./AuthClient";
export { PostgrestQueryBuilder } from "./PostgrestQueryBuilder";
export {
  default as OpenBauthPanelClient,
  createOpenBauthPanelClient,
} from "./OpenBauthPanelClient";

// Legacy exports (kept for backward compatibility during migration)
export { default as AuthApi, createAuthApi } from "./auth";
export { default as UsersApi, createUsersApi } from "./users";
export { default as RolesApi, createRolesApi } from "./roles";
export { default as GenericApi, createGenericApi } from "./generic";

// Factory function to create all API clients with shared config
import type { ApiConfig } from "../config/apiConfig";
import apiConfig from "../config/apiConfig";
import { AuthClient } from "./AuthClient";
import { OpenBauthPanelClient } from "./OpenBauthPanelClient";

// Legacy imports
import { AuthApi } from "./auth";
import { UsersApi } from "./users";
import { RolesApi } from "./roles";
import { GenericApi } from "./generic";

export interface ApiClients {
  auth: AuthClient;
  client: OpenBauthPanelClient;
  // Legacy clients
  authLegacy: AuthApi;
  usersLegacy: UsersApi;
  rolesLegacy: RolesApi;
  genericLegacy: GenericApi;
}

/**
 * Create all API clients with shared configuration
 * @param config - Optional configuration override
 * @returns Object containing all API client instances
 */
export function createApiClients(config?: Partial<ApiConfig>): ApiClients {
  const sharedConfig = config || {};

  return {
    auth: new AuthClient(sharedConfig),
    client: new OpenBauthPanelClient(sharedConfig),
    // Legacy clients
    authLegacy: new AuthApi(sharedConfig),
    usersLegacy: new UsersApi(sharedConfig),
    rolesLegacy: new RolesApi(sharedConfig),
    genericLegacy: new GenericApi(sharedConfig),
  };
}
