// scripts/setup-test-data.ts
import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import {
  JWTService,
  AuthService,
  PermissionService,
  getOAuthSchemas,
} from "open-bauth";
import { faker } from "@faker-js/faker";

// Initialize database
const db = new Database("./database/test-data.db");
const dbInitializer = new DatabaseInitializer({ database: db });
const jwtService = new JWTService(process.env.JWT_SECRET || "dev-secret", "7d");
const authService = new AuthService(dbInitializer, jwtService);
const permissionService = new PermissionService(dbInitializer);

// Register OAuth schemas
const oauthSchemas = getOAuthSchemas();
dbInitializer.registerSchemas(oauthSchemas);

// Custom schemas for test data
const customSchemas = [
  {
    tableName: "products",
    columns: [
      {
        name: "id",
        type: "INTEGER",
        primaryKey: true,
        autoIncrement: true,
        notNull: true,
      },
      { name: "name", type: "TEXT", notNull: true },
      { name: "description", type: "TEXT", notNull: false },
      { name: "price", type: "REAL", notNull: true },
      { name: "in_stock", type: "BOOLEAN", notNull: true, defaultValue: false },
      { name: "category_id", type: "INTEGER", notNull: false },
      {
        name: "created_at",
        type: "DATETIME",
        notNull: false,
        defaultValue: "CURRENT_TIMESTAMP",
      },
      {
        name: "updated_at",
        type: "DATETIME",
        notNull: false,
        defaultValue: "CURRENT_TIMESTAMP",
      },
    ],
  },
  {
    tableName: "categories",
    columns: [
      {
        name: "id",
        type: "INTEGER",
        primaryKey: true,
        autoIncrement: true,
        notNull: true,
      },
      { name: "name", type: "TEXT", notNull: true, unique: true },
      { name: "description", type: "TEXT", notNull: false },
      {
        name: "parent_id",
        type: "INTEGER",
        notNull: false,
        references: { table: "categories", column: "id" },
      },
      {
        name: "created_at",
        type: "DATETIME",
        notNull: false,
        defaultValue: "CURRENT_TIMESTAMP",
      },
      {
        name: "updated_at",
        type: "DATETIME",
        notNull: false,
        defaultValue: "CURRENT_TIMESTAMP",
      },
    ],
  },
];

// Register custom schemas
dbInitializer.registerSchemas(customSchemas as any);

async function setupTestData() {
  try {
    console.log("Initializing database...");
    await dbInitializer.initialize();
    console.log("Database initialized successfully.");

    // Create roles
    console.log("Creating roles...");
    const roleService = new PermissionService(dbInitializer);
    const adminRole = await roleService.createRole({
      name: "admin",
      description: "Administrator with full access",
    });

    const userRole = await roleService.createRole({
      name: "user",
      description: "Regular user with limited access",
    });

    // Create permissions for tables
    console.log("Creating permissions for tables...");
    const tableNames = [
      "users",
      "oauth_clients",
      "oauth_authorization_codes",
      "oauth_refresh_tokens",
      "oauth_tokens",
      "products",
      "categories",
    ];
    const permissions = [];

    for (const tableName of tableNames) {
      const listPermission = await roleService.createPermission({
        name: `${tableName}:list`,
        description: `List ${tableName}`,
      });

      const viewPermission = await roleService.createPermission({
        name: `${tableName}:view`,
        description: `View ${tableName}`,
      });

      const createPermission = await roleService.createPermission({
        name: `${tableName}:create`,
        description: `Create ${tableName}`,
      });

      const updatePermission = await roleService.createPermission({
        name: `${tableName}:update`,
        description: `Update ${tableName}`,
      });

      const deletePermission = await roleService.createPermission({
        name: `${tableName}:delete`,
        description: `Delete ${tableName}`,
      });

      permissions.push(
        ...[
          listPermission,
          viewPermission,
          createPermission,
          updatePermission,
          deletePermission,
        ],
      );
    }

    // Create additional permissions
    const tablesListPermission = await roleService.createPermission({
      name: "tables:list",
      description: "List all tables",
    });

    const schemasViewPermission = await roleService.createPermission({
      name: "schemas:view",
      description: "View table schemas",
    });

    permissions.push(tablesListPermission, schemasViewPermission);

    // Assign all permissions to admin role
    console.log("Assigning permissions to admin role...");
    for (const permission of permissions) {
      await roleService.assignPermissionToRole(
        (adminRole as any).id,
        (permission as any).id,
      );
    }

    // Assign limited permissions to user role
    console.log("Assigning permissions to user role...");
    for (const permission of permissions) {
      if (
        (permission as any).name.includes("users:") &&
        (permission as any).name.includes("view") &&
        !(permission as any).name.includes("list")
      ) {
        await roleService.assignPermissionToRole(
          (userRole as any).id,
          (permission as any).id,
        );
      }
    }

    // Create users
    console.log("Creating users...");
    const adminUser = await authService.register({
      email: "admin@example.com",
      password: "adminPassword123",
      username: "admin",
      first_name: "Admin",
      last_name: "User",
    });

    const normalUser = await authService.register({
      email: "user@example.com",
      password: "userPassword123",
      username: "user",
      first_name: "Normal",
      last_name: "User",
    });

    // Assign roles to users
    console.log("Assigning roles to users...");
    // Type assertion for AuthResult which may have different structure
    const adminUserId = (adminUser as any).id || (adminUser as any).user?.id;
    const normalUserId = (normalUser as any).id || (normalUser as any).user?.id;
    const adminRoleId = (adminRole as any).id;
    const userRoleId = (userRole as any).id;

    // Use roleService to assign roles to users
    await roleService.assignRoleToUser(adminUserId, adminRoleId);
    await roleService.assignRoleToUser(normalUserId, userRoleId);

    // Create categories
    console.log("Creating categories...");
    const categories = [];
    const categoryNames = [
      "Electronics",
      "Clothing",
      "Books",
      "Home & Kitchen",
      "Sports",
    ];

    for (const categoryName of categoryNames) {
      const category = await db
        .query(
          `
         INSERT INTO categories (name, description)
         VALUES (?, ?)
         RETURNING id
       `.trim(),
        )
        .run([
          categoryName,
          `All kinds of ${categoryName.toLowerCase()}`,
        ] as any);

      categories.push({
        id: (category as any).lastInsertRowid,
        name: categoryName,
      });
    }

    // Create products
    console.log("Creating products...");
    const productToCreate = 50;

    for (let i = 0; i < productToCreate; i++) {
      const randomCategory = faker.helpers.arrayElement(categories);
      const productName = faker.commerce.productName();
      const productDescription = faker.commerce.productDescription();
      const productPrice = parseFloat(faker.commerce.price());
      const inStock = faker.datatype.boolean();

      await db
        .query(
          `
         INSERT INTO products (name, description, price, in_stock, category_id)
         VALUES (?, ?, ?, ?, ?)
       `.trim(),
        )
        .run([
          productName,
          productDescription,
          productPrice,
          inStock,
          randomCategory.id,
        ] as any);
    }

    console.log("Test data setup completed successfully!");
    console.log("\n=== Test Accounts ===");
    console.log(`Admin: admin@example.com / adminPassword123`);
    console.log(`User: user@example.com / userPassword123`);
    console.log("\n=== Database Summary ===");
    const userCount = db.query("SELECT COUNT(*) as count FROM users").get() as {
      count: number;
    };
    console.log(`Users: ${userCount.count}`);
    const categoryCount = db
      .query("SELECT COUNT(*) as count FROM categories")
      .get() as { count: number };
    console.log(`Categories: ${categoryCount.count}`);
    const productsTotal = db
      .query("SELECT COUNT(*) as count FROM products")
      .get() as { count: number };
    console.log(`Products: ${productsTotal.count}`);

    // Close database connection
    db.close();
  } catch (error) {
    console.error("Error setting up test data:", error);
    process.exit(1);
  }
}

// Run the setup
setupTestData();
