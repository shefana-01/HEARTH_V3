import type { Account } from '@/types/domain';

/** The API sends `memberId: null` until the account has created or joined a family. */
export type ApiAccount = Omit<Account, 'memberId'> & { memberId: string | null };

export const toAccount = (account: ApiAccount): Account => ({ ...account, memberId: account.memberId ?? '' });
