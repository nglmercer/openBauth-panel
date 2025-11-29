// API clients index file - Exports all API client classes
export { default as AuthApi, createAuthApi } from "./auth";
export { default as UsersApi, createUsersApi } from "./users";
export { default as RolesApi, createRolesApi } from "./roles";
export { default as GenericApi, createGenericApi } from "./generic";
export {
  default as OpenBauthPanelClient,
  createOpenBauthPanelClient,
} from "./OpenBauthPanelClient";

// Factory function to create all API clients with shared config
import type { ApiConfig } from "../config/apiConfig";
import apiConfig from "../config/apiConfig";
import { AuthApi } from "./auth";
import { UsersApi } from "./users";
import { RolesApi } from "./roles";
import { GenericApi } from "./generic";
import { OpenBauthPanelClient } from "./OpenBauthPanelClient";

export interface ApiClients {
  auth: AuthApi;
  users: UsersApi;
  roles: RolesApi;
  generic: GenericApi;
  client: OpenBauthPanelClient;
}

/**
 * Create all API clients with shared configuration
 * @param config - Optional configuration override
 * @returns Object containing all API client instances
 */
export function createApiClients(config?: Partial<ApiConfig>): ApiClients {
  const sharedConfig = config || {};

  return {
    auth: new AuthApi(sharedConfig),
    users: new UsersApi(sharedConfig),
    roles: new RolesApi(sharedConfig),
    generic: new GenericApi(sharedConfig),
    client: new OpenBauthPanelClient(sharedConfig),
  };
}
