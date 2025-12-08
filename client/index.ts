// client/index.ts - Main client export file
export { OpenBauthPanelClient, createOpenBauthPanelClient } from './api/OpenBauthPanelClient';
export { RealtimeClient } from './api/RealtimeClient';
export { AuthClient } from './api/AuthClient';
export { PostgrestQueryBuilder } from './api/PostgrestQueryBuilder';
export type { User, AuthContext } from './types/auth';
export type { ApiConfig } from './config/apiConfig';
export { default as apiConfig } from './config/apiConfig';

// Export the main client as default
export { default } from './api/OpenBauthPanelClient';
