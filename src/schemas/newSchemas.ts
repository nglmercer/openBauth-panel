import { Schema, type TableSchema } from "open-bauth";
const StandardFields = {
  UUID: {
    type: String,
    primaryKey: true,
    default: "(lower(hex(randomblob(16))))",
  },
  Timestamps: {
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  CreatedAt: { type: Date, default: Date.now },
  Active: { type: Boolean, default: true },
};

const newUserSchema = new Schema({
  id: { type: String, primaryKey: true },
  email: { type: String, unique: true, notNull: true },
  password_hash: { type: String, notNull: true },
  first_name: { type: String, notNull: true },
  last_name: { type: String, notNull: true },
  username: { type: String, notNull: true },
  is_active: { type: Boolean, defaultValue: true, notNull: true },
  is_superuser: { type: Boolean, defaultValue: false },
  created_at: { type: String, defaultValue: "CURRENT_TIMESTAMP", notNull: true },
  updated_at: { type: String, defaultValue: "CURRENT_TIMESTAMP", notNull: true },
  bio: { type: String, notNull: false, defaultValue: null },
  timezone: { type: String, notNull: false, defaultValue: null },
  language: { type: String, notNull: false, defaultValue: null },
  avatar_url: { type: String, notNull: false, defaultValue: null },
  phone_number: { type: String, notNull: false, defaultValue: null }
}, {
  indexes: [
    { name: "idx_users_email", columns: ["email"], unique: true },
    { name: "idx_users_active", columns: ["is_active"], unique: false }
  ]
});
const Roles = new Schema(
    {
      id: StandardFields.UUID,
      name: { type: String, required: true, unique: true },
      description: String,
      ...StandardFields.Timestamps,
      is_active: StandardFields.Active,
    },
    {
      indexes: [{ name: "idx_roles_name", columns: ["name"], unique: true }],
    },
  );
const userRoles = new Schema(
    {
      id: StandardFields.UUID,
      user_id: {
        type: "TEXT",
        required: true,
        ref: "users",
        onDelete: "CASCADE",
      },
      role_id: {
        type: "TEXT",
        required: true,
        ref: "roles",
        onDelete: "CASCADE",
      },
      ...StandardFields.Timestamps,
    },
    {
      indexes: [
        { name: "idx_user_roles_user_id", columns: ["user_id"] },
        { name: "idx_user_roles_role_id", columns: ["role_id"] },
        {
          name: "idx_user_roles_unique",
          columns: ["user_id", "role_id"],
          unique: true,
        },
      ],
    },
  )

const extendedUserSchema: TableSchema = newUserSchema.toTableSchema("users");
const extendedRolesSchema: TableSchema = Roles.toTableSchema("roles");
const extendedUserRolesSchema: TableSchema = userRoles.toTableSchema("user_roles");
export {
    extendedUserSchema,
    extendedRolesSchema,
    extendedUserRolesSchema,
    userRoles,
    newUserSchema,
    Roles
}