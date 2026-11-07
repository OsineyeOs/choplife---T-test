import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './organisation';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  staffId: text('staff_id'),
  staffName: text('staff_name'),
  staffRole: text('staff_role'),
  branchId: text('branch_id'),
  action: text('action').notNull(),
  details: text('details'),
  metadata: jsonb('metadata'),
  ...timestamps,
});
