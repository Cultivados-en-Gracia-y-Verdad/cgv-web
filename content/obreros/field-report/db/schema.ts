import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  version: integer('version').notNull(),
  updatedAt: text('updated_at').notNull(),
});
