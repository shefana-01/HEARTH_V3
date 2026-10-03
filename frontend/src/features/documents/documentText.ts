import type { DocumentAccess, FamilyDocument } from '@/types/domain';

export const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

/** What the person picks: the whole family, nobody else, or named people. */
export type Sharing = 'family' | 'me' | 'chosen';

/** Which choice describes a document as it is now. Restricted documents always list their uploader, so only others count. */
export function sharingOf(doc: FamilyDocument): Sharing {
  if (doc.access === 'family') return 'family';
  return doc.allowedIds.some((id) => id !== doc.uploadedById) ? 'chosen' : 'me';
}

/** The access and list of people the service expects for a choice. */
export function accessFor(sharing: Sharing, chosenIds: string[]): { access: DocumentAccess; allowedIds: string[] } {
  if (sharing === 'family') return { access: 'family', allowedIds: [] };
  return { access: 'restricted', allowedIds: sharing === 'chosen' ? chosenIds : [] };
}

/** Shown when "Chosen people" is picked without choosing anyone. */
export const NO_ONE_CHOSEN = 'Choose at least one person, or pick “Only me”.';
