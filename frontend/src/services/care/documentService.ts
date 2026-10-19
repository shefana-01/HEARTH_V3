/**
 * Documents — care-service + its file storage.
 *
 * Reports, prescriptions, insurance papers and anything else worth keeping.
 * Each document can be about one person (or the household) and is either
 * open to family members with document access or restricted to named people.
 *
 * With the API, the file is uploaded and kept by care-service.
 * MOCK: only the file's details are recorded.
 */
import { apiRequest } from '../api/client';
import { config } from '../config';
import { actorId, audit, db, fail, isLead, me, newId, notFound, nowIso, persist, requireFamily, respond } from '../mockStore';
import type { FamilyDocument, DocumentAccess, DocumentCategory } from '@/types/domain';

export const MAX_UPLOAD_MB = 20;
export const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export interface UploadInput {
  file: File;
  title: string;
  category: DocumentCategory;
  /** Who it is about. Leave out for a household document. */
  ownerId?: string;
  access: DocumentAccess;
  allowedIds: string[];
  appointmentId?: string;
}

/** The file and its details as one multipart form, which is how the API receives uploads. */
function uploadForm(input: UploadInput): FormData {
  const form = new FormData();
  form.append('file', input.file);
  form.append('title', input.title);
  form.append('category', input.category);
  if (input.ownerId) form.append('ownerId', input.ownerId);
  form.append('access', input.access);
  input.allowedIds.forEach((id) => form.append('allowedIds', id));
  if (input.appointmentId) form.append('appointmentId', input.appointmentId);
  return form;
}

/**
 * Documents the signed-in member is allowed to see: their own uploads and
 * papers about them always; family documents if they have document access;
 * restricted ones only when named.
 */
function visible(d: FamilyDocument): boolean {
  const viewer = actorId();
  if (d.uploadedById === viewer || d.ownerId === viewer) return true;
  if (d.access === 'restricted') return d.allowedIds.includes(viewer);
  return isLead() || Boolean(me()?.access.documents);
}

export const documentService = {
  async list(): Promise<FamilyDocument[]> {
    if (!config.useMocks) return apiRequest<FamilyDocument[]>('/documents');
    return respond(db.documents.filter(visible).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
  },

  async upload(input: UploadInput): Promise<FamilyDocument> {
    if (!config.useMocks) return apiRequest<FamilyDocument>('/documents', { method: 'POST', body: uploadForm(input) });
    requireFamily();
    if (input.file.size > MAX_UPLOAD_MB * 1024 * 1024) return fail(`Files must be ${MAX_UPLOAD_MB} MB or smaller.`, 413);
    const doc: FamilyDocument = {
      id: newId('d'),
      title: input.title.trim() || input.file.name,
      category: input.category,
      fileName: input.file.name,
      sizeKB: Math.max(1, Math.round(input.file.size / 1024)),
      uploadedAt: nowIso(),
      uploadedById: actorId(),
      ownerId: input.ownerId || undefined,
      access: input.access,
      allowedIds: input.access === 'restricted' ? Array.from(new Set([actorId(), ...input.allowedIds])) : [],
      appointmentId: input.appointmentId || undefined,
    };
    db.documents.push(doc);
    // The title of a restricted document is not for everyone, so only family documents are logged.
    if (doc.access === 'family') audit({ category: 'care', action: 'Added a document', subject: doc.title });
    persist();
    return respond(doc);
  },

  async updateAccess(id: string, access: DocumentAccess, allowedIds: string[]): Promise<FamilyDocument> {
    if (!config.useMocks) return apiRequest<FamilyDocument>(`/documents/${id}/access`, { method: 'PUT', body: { access, allowedIds } });
    const doc = db.documents.find((d) => d.id === id && visible(d));
    if (!doc) return notFound('That document');
    doc.access = access;
    doc.allowedIds = access === 'restricted' ? Array.from(new Set([actorId(), ...allowedIds])) : [];
    if (access === 'family') audit({ category: 'care', action: 'Shared a document with the family', subject: doc.title });
    persist();
    return respond(doc);
  },

  async remove(id: string): Promise<void> {
    if (!config.useMocks) return apiRequest<void>(`/documents/${id}`, { method: 'DELETE' });
    const doc = db.documents.find((d) => d.id === id && visible(d));
    if (!doc) return notFound('That document');
    db.documents = db.documents.filter((d) => d.id !== id);
    if (doc.access === 'family') audit({ category: 'care', action: 'Deleted a document', subject: doc.title });
    persist();
    return respond(undefined);
  },
};
