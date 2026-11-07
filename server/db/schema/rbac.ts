import { pgTable, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './organisation';

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false),
  privileges: jsonb('privileges'), // Array of strings
  reports: jsonb('reports'), // Array of strings
  orderSummaryColumns: jsonb('order_summary_columns'), // Array of strings
  ...timestamps,
});

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(),
  code: text('code').unique().notNull(),
  description: text('description'),
});

export const rolePermissions = pgTable('role_permissions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').references(() => roles.id).notNull(),
  permissionId: text('permission_id').references(() => permissions.id).notNull(),
});
