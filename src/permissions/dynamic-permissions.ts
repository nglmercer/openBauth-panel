// src/permissions/dynamic-permissions.ts
import { permissionService } from "../db";
import { getTableRelations } from "../database/base-controller";

// Definición de tipos para permisos
export interface TablePermission {
  table: string;
  actions: PermissionAction[];
  conditions?: PermissionCondition[];
}

export type PermissionAction =
  | "list"
  | "view"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "import";

export interface PermissionCondition {
  field: string;
  operator:
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "nin"
    | "contains";
  value: any;
}

// Clase para gestionar permisos dinámicos
export class DynamicPermissions {
  // Generar permisos para todas las tablas disponibles
  static async generateAllTablePermissions(): Promise<TablePermission[]> {
    const { getSchemas } = await import("../database/base-controller");
    const schemas = await getSchemas();
    const tablePermissions: TablePermission[] = [];

    for (const schema of schemas) {
      // Permisos básicos por tabla
      tablePermissions.push({
        table: schema.tableName,
        actions: ["list", "view", "create", "update", "delete"],
      });

      // Permisos especiales para tablas con relaciones
      const relations = await getTableRelations();
      const tableRelations = relations[schema.tableName] || [];

      if (tableRelations.length > 0) {
        // Si hay relaciones, añadir permisos de exportación/importación
        const existingTable = tablePermissions.find(
          (t) => t.table === schema.tableName,
        );
        if (existingTable) {
          existingTable.actions.push("export", "import");
        }
      }

      // Permisos condicionales para campos específicos
      const conditionalPermissions =
        this.generateConditionalPermissions(schema);
      if (conditionalPermissions.length > 0) {
        const existingTable = tablePermissions.find(
          (t) => t.table === schema.tableName,
        );
        if (existingTable) {
          existingTable.conditions = conditionalPermissions;
        }
      }
    }

    return tablePermissions;
  }

  // Generar permisos condicionales basados en el esquema
  private static generateConditionalPermissions(
    schema: any,
  ): PermissionCondition[] {
    const conditions: PermissionCondition[] = [];

    // Si hay un campo 'status', solo se pueden actualizar registros activos
    const statusColumn = schema.columns.find(
      (c: any) => c.name === "status" || c.name === "active",
    );
    if (statusColumn) {
      conditions.push({
        field: statusColumn.name,
        operator: "eq",
        value: "active",
      });
    }

    // Si hay un campo 'user_id', solo se pueden ver/editar los registros del usuario
    const userIdColumn = schema.columns.find(
      (c: any) => c.name === "user_id" || c.name === "userId",
    );
    if (userIdColumn) {
      conditions.push({
        field: userIdColumn.name,
        operator: "eq",
        value: "{current_user_id}", // Placeholder que se reemplazará con el ID del usuario actual
      });
    }

    return conditions;
  }

  // Verificar si un usuario tiene permiso para una acción en una tabla
  static async checkPermission(
    userId: string,
    table: string,
    action: PermissionAction,
    resourceId?: string,
  ): Promise<boolean> {
    try {
      // Primero verificar si tiene permisos básicos para la tabla
      const hasBasicPermission = await permissionService.userHasPermission(
        userId,
        `${table}:${action}`,
      );

      if (!hasBasicPermission) {
        return false;
      }

      // Si es una acción sobre un recurso específico, verificar condiciones
      if (resourceId && ["view", "update", "delete"].includes(action)) {
        const { getDefaultSchemas } =
          await import("../database/base-controller");
        const schemas = getDefaultSchemas();
        const schema = schemas.find((s) => s.tableName === table);

        if (!schema) {
          return false;
        }

        // Obtener condiciones para esta tabla
        const conditions = this.generateConditionalPermissions(schema);

        if (conditions.length > 0) {
          const { BaseController } = await import("open-bauth");
          const { db } = await import("../db");

          const controller = new BaseController(table, {
            database: db,
            isSQLite: true,
          });

          // Construir consulta con condiciones
          const whereConditions: any = { id: resourceId };

          for (const condition of conditions) {
            // Reemplazar placeholders con valores reales
            let value = condition.value;
            if (value === "{current_user_id}") {
              value = userId;
            }

            whereConditions[condition.field] = {
              [condition.operator]: value,
            };
          }

          const result = await controller.findAll({
            where: whereConditions,
            limit: 1,
          });

          // Si no se encuentra el recurso con estas condiciones, denegar acceso
          return (
            (result.success === true &&
              result.data &&
              result.data.length > 0) ||
            false
          );
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }

  // Crear middlewares de permisos para Hono
  static createPermissionMiddleware(
    table: string,
    action: PermissionAction,
    resourceIdParam: string | null = null,
  ) {
    return async (c: any, next: any) => {
      const { jwtService, authService } = await import("../db");

      try {
        // Obtener token de la cookie o header
        const token =
          c.req.header("authorization")?.replace("Bearer ", "") ||
          c.get("cookie")?.access_token;

        if (!token) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        // Verificar token y obtener usuario
        const payload = await jwtService.verifyToken(token);
        if (!payload || !payload.userId) {
          return c.json({ error: "Invalid token" }, 401);
        }

        const user = await authService.findUserById(payload.userId);
        if (!user) {
          return c.json({ error: "User not found" }, 401);
        }

        // Obtener ID del recurso si es necesario
        let resourceId = null;
        if (resourceIdParam) {
          resourceId = c.req.param(resourceIdParam);
        }

        // Verificar permiso
        const hasPermission = await this.checkPermission(
          user.id,
          table,
          action,
          resourceId,
        );

        if (!hasPermission) {
          return c.json({ error: "Forbidden" }, 403);
        }

        // Almacenar usuario en el contexto para uso posterior
        c.set("user", user);
        await next();
      } catch (error) {
        console.error("Permission middleware error:", error);
        return c.json({ error: "Authentication failed" }, 401);
      }
    };
  }
}

// Función para inicializar permisos en el sistema
export async function initializePermissions() {
  const { permissionService } = await import("../db");

  try {
    // Generar permisos para todas las tablas
    const tablePermissions =
      await DynamicPermissions.generateAllTablePermissions();

    // Crear permisos en el sistema
    for (const tablePerm of tablePermissions) {
      for (const action of tablePerm.actions) {
        const permissionName = `${tablePerm.table}:${action}`;
        await permissionService.createPermission({
          name: permissionName,
          description: `${action} permission for ${tablePerm.table} table`,
        });
      }
    }

    console.log("Permissions initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing permissions:", error);
    return false;
  }
}

// Exportar función de inicialización
export { initializePermissions as default };
