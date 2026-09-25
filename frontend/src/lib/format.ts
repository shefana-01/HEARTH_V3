import { config } from '@/services/config';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: config.currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });

/** Whole amounts in the app currency (taka by default), e.g. "৳150". */
export const currency = (value: number) => money.format(Math.round(value));

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "Afsara", "Afsara and Rafid", "Afsara, Rafid and Amina". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
