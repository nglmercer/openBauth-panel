// scripts/setup-test-data.ts
import { Database } from "bun:sqlite";
import { DatabaseInitializer } from "open-bauth";
import { JWTService, AuthService, PermissionService, getOAuthSchemas } from "open-bauth";
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
      { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true, notNull: true },
      { name: "name", type: "TEXT", notNull: true },
      { name: "description", type: "TEXT", notNull: false },
      { name: "price", type: "REAL", notNull: true },
      { name: "in_stock", type: "BOOLEAN", notNull: true, defaultValue: false },
      { name: "category_id", type: "INTEGER", notNull: false },
      { name: "created_at", type: "DATETIME", notNull: false, defaultValue: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", notNull: false, defaultValue: "CURRENT_TIMESTAMP" },
    ],
  },
  {
    tableName: "categories",
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true, notNull: true },
      { name: "name", type: "TEXT", notNull: true, unique: true },
      { name: "description", type: "TEXT", notNull: false },
      { name: "parent_id", type: "INTEGER", notNull: false, references: { table: "categories", column: "id" } },
      { name: "created_at", type: "DATETIME", notNull: false, defaultValue: "CURRENT_TIMESTAMP" },
      { name: "updated_at", type: "DATETIME", notNull: false, defaultValue: "CURRENT_TIMESTAMP" },
    ],
  },
];

// Register custom schemas
dbInitializer.registerSchemas(customSchemas);

async function setupTestData() {
  try {
    console.log("Initializing database...");
    await dbInitializer.initialize();
    console.log("Database initialized successfully.");

    // Create roles
    console.log("Creating roles...");
    const adminRole = await dbInitializer.roleService.createRole({
      name: "admin",
      description: "Administrator with full access",
    });

    const userRole = await dbInitializer.roleService.createRole({
      name: "user",
      description: "Regular user with limited access",
    });

    // Create permissions for tables
    console.log("Creating permissions for tables...");
    const tableNames = ["users", "oauth_clients", "oauth_authorization_codes", "oauth_refresh_tokens", "oauth_tokens", "products", "categories"];
    const permissions = [];

    for (const tableName of tableNames) {
      const listPermission = await dbInitializer.permissionService.createPermission({
        name: `${tableName}:list`,
        description: `List ${tableName}`,
      });

      const viewPermission = await dbInitializer.permissionService.createPermission({
        name: `${tableName}:view`,
        description: `View ${tableName}`,
      });

      const createPermission = await dbInitializer.permissionService.createPermission({
        name: `${tableName}:create`,
        description: `Create ${tableName}`,
      });

      const updatePermission = await dbInitializer.permissionService.createPermission({
        name: `${tableName}:update`,
        description: `Update ${tableName}`,
      });

      const deletePermission = await dbInitializer.permissionService.createPermission({
        name: `${tableName}:delete`,
        description: `Delete ${tableName}`,
      });

      permissions.push(...[
        listPermission,
        viewPermission,
        createPermission,
        updatePermission,
        deletePermission,
      ]);
    }

    // Create additional permissions
    const tablesListPermission = await dbInitializer.permissionService.createPermission({
      name: "tables:list",
      description: "List all tables",
    });

    const schemasViewPermission = await dbInitializer.permissionService.createPermission({
      name: "schemas:view",
      description: "View table schemas",
    });

    permissions.push(tablesListPermission, schemasViewPermission);

    // Assign all permissions to admin role
    console.log("Assigning permissions to admin role...");
    for (const permission of permissions) {
      await dbInitializer.roleService.assignPermissionToRole(adminRole.id, permission.id);
    }

    // Assign limited permissions to user role
    console.log("Assigning permissions to user role...");
    for (const permission of permissions) {
      if (permission.name.includes("users:") && permission.name.includes("view") && !permission.name.includes("list")) {
        await dbInitializer.roleService.assignPermissionToRole(userRole.id, permission.id);
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
    await authService.assignRoleToUser(adminUser.id, adminRole.id);
    await authService.assignRoleToUser(normalUser.id, userRole.id);

    // Create categories
    console.log("Creating categories...");
    const categories = [];
    const categoryNames = ["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"];

    for (const categoryName of categoryNames) {
      const category = await dbInitializer.query(`
        INSERT INTO categories (name, description)
        VALUES (?, ?)
        RETURNING id
      `, [categoryName, `All kinds of ${categoryName.toLowerCase()}`]);

      categories.push({
        id: category[0].id,
        name: categoryName,
      });
    }

    // Create products
    console.log("Creating products...");
    const productCount = 50;

    for (let i = 0; i < productCount; i++) {
      const randomCategory = faker.helpers.arrayElement(categories);
      const productName = faker.commerce.productName();
      const productDescription = faker.commerce.productDescription();
      const productPrice = parseFloat(faker.commerce.price());
      const inStock = faker.datatype.boolean();

      await dbInitializer.query(`
        INSERT INTO products (name, description, price, in_stock, category_id)
        VALUES (?, ?, ?, ?, ?)
      `, [productName, productDescription, productPrice, inStock, randomCategory.id]);
    }

    console.log("Test data setup completed successfully!");
    console.log("\n=== Test Accounts ===");
    console.log(`Admin: admin@example.com / adminPassword123`);
    console.log(`User: user@example.com / userPassword123`);
    console.log("\n=== Database Summary ===");
    console.log(`Users: ${await dbInitializer.query("SELECT COUNT(*) as count FROM users").then(r => r[0].count)}`);
    console.log(`Categories: ${await dbInitializer.query("SELECT COUNT(*) as count FROM categories").then(r => r[0].count)}`);
    console.log(`Products: ${await dbInitializer.query("SELECT COUNT(*) as count FROM products").then(r => r[0].count)}`);

    // Close database connection
    db.close();
  } catch (error) {
    console.error("Error setting up test data:", error);
    process.exit(1);
  }
}

// Run the setup
setupTestData();
