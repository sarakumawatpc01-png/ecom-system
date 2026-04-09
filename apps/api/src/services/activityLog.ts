import { db } from '../lib/db';

export const logAdminActivity = async (input: {
  user_id: string;
  site_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  meta?: Record<string, unknown>;
}) => {
  await db.admin_activity_logs.create({
    data: {
      user_id: input.user_id,
      site_id: input.site_id || null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id || null,
      meta: (input.meta || {}) as any
    }
  });
};
