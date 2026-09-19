/**
 * Activity & audit history. In the target architecture each service writes its
 * own audit log and publishes events; this read model aggregates them.
 *
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { db, respond } from '../mockStore';
import type { AuditEvent } from '@/types/domain';

export const auditService = {
  async list(): Promise<AuditEvent[]> {
    if (!config.useMocks) return apiRequest<AuditEvent[]>('/audit-events');
    return respond([...db.audit].sort((a, b) => b.at.localeCompare(a.at)));
  },
};
