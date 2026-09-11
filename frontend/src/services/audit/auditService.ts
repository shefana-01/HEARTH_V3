/**
 * Activity & audit history. In the target architecture each service writes its
 * own audit log and publishes events; this read model aggregates them.
 * REST contract: not defined yet.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { db, respond } from '../mockStore';
import type { AuditEvent } from '@/types/domain';

export const auditService = {
  async list(): Promise<AuditEvent[]> {
    if (!config.useMocks) return backendNotConnected('audit', 'listAuditEvents');
    return respond([...db.audit].sort((a, b) => b.at.localeCompare(a.at)));
  },
};
