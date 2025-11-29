// Re-export all middleware from the unified index for easier imports
export {
  authMiddleware,
  requireAuth,
  requireRoles,
  requirePermissions,
  requireSelfOrAdmin,
  type ExtendedContext,
} from "./index";
