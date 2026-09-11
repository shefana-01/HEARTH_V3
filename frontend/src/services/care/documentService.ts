/**
 * Care documents — care-service + S3-compatible object storage.
 * REST contract: not defined yet.
 *
 * MOCK: only the file's metadata is recorded. The file itself is not stored
 * until the storage service is connected; the UI says so.
 */
import { backendNotConnected } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, fail, newId, notFound, nowIso, persist, requireFamily, respond } from '../mockStore';
import type { CareDocument, DocumentAccess, DocumentCategory } from '@/types/domain';

export const MAX_UPLOAD_MB = 20;
export const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export interface UploadInput {
  file: File;
  title: string;
  category: DocumentCategory;
  access: DocumentAccess;
  allowedIds: string[];
  appointmentId?: string;
}

/** Documents the signed-in member is allowed to see. */
const visible = (d: CareDocument) => d.access === 'circle' || d.allowedIds.includes(actorId()) || d.uploadedById === actorId();

export const documentService = {
  async list(): Promise<CareDocument[]> {
    if (!config.useMocks) return backendNotConnected('care-service', 'listDocuments');
    return respond(db.documents.filter(visible).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
  },

  async upload(input: UploadInput): Promise<CareDocument> {
    if (!config.useMocks) return backendNotConnected('care-service', 'uploadDocument');
    requireFamily();
    if (input.file.size > MAX_UPLOAD_MB * 1024 * 1024) return fail(`Files must be ${MAX_UPLOAD_MB} MB or smaller.`, 413);
    const doc: CareDocument = {
      id: newId('d'),
      title: input.title.trim() || input.file.name,
      category: input.category,
      fileName: input.file.name,
      sizeKB: Math.max(1, Math.round(input.file.size / 1024)),
      uploadedAt: nowIso(),
      uploadedById: actorId(),
      access: input.access,
      allowedIds: input.access === 'restricted' ? Array.from(new Set([actorId(), ...input.allowedIds])) : [],
      appointmentId: input.appointmentId || undefined,
    };
    db.documents.push(doc);
    audit({ category: 'care', action: 'Uploaded a document', subject: doc.title, after: input.access === 'circle' ? 'Whole circle' : 'Restricted' });
    persist();
    return respond(doc);
  },

  async updateAccess(id: string, access: DocumentAccess, allowedIds: string[]): Promise<CareDocument> {
    if (!config.useMocks) return backendNotConnected('care-service', 'updateDocumentAccess');
    const doc = db.documents.find((d) => d.id === id);
    if (!doc) return notFound('That document');
    doc.access = access;
    doc.allowedIds = access === 'restricted' ? Array.from(new Set([actorId(), ...allowedIds])) : [];
    audit({ category: 'care', action: 'Changed document access', subject: doc.title, after: access === 'circle' ? 'Whole circle' : 'Restricted' });
    persist();
    return respond(doc);
  },

  async remove(id: string): Promise<void> {
    if (!config.useMocks) return backendNotConnected('care-service', 'deleteDocument');
    const doc = db.documents.find((d) => d.id === id);
    if (!doc) return notFound('That document');
    db.documents = db.documents.filter((d) => d.id !== id);
    audit({ category: 'care', action: 'Deleted a document', subject: doc.title });
    persist();
    return respond(undefined);
  },
};
