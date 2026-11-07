import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { staff } from './staff';
import { timestamps } from './organisation';

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  token: text('token').unique().notNull(),
  role: text('role').notNull(),
  branchId: text('branch_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  lastActivity: timestamp('last_activity').notNull(),
  ...timestamps,
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false),
  ...timestamps,
});
