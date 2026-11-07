import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { timestamps } from './organisation';

export const cmsContent = pgTable('cms_content', {
  id: text('id').primaryKey(),
  section: text('section').notNull(),
  content: text('content').notNull(),
  isActive: boolean('is_active').default(true),
  ...timestamps,
});
