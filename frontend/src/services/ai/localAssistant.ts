/**
 * The offline assistant: a rule-based reader for short notes, used in demo mode and whenever AI help is
 * switched off on the server. It understands everyday English and common Bengali time words, so
 * "Buy rice tomorrow 6pm; Rafid takes Dadu to the dentist Tue 4:30" still becomes two drafts.
 */
import type { Skill, TaskCategory, TaskPriority } from '@/types/domain';
import type { QuickAddResult, TaskDraft } from './aiService';

export interface RosterPerson {
  id: string;
  name: string;
  kind: 'member' | 'dependant';
  /** Members who are not observers. */
  takesTasks: boolean;
  /** Optional skills listed on the member profile (e.g. driving, meals, errands, medication, clinical). */
  skills?: Skill[];
}

const CATEGORY_SKILLS: Record<TaskCategory, Skill[]> = {
  medication: ['medication', 'clinical'],
  health: ['clinical', 'medication'],
  meals: ['meals'],
  errands: ['errands', 'driving'],
  household: ['household'],
  childcare: ['childcare'],
  transport: ['driving'],
  study: [],
  work: [],
  exercise: ['mobility'],
  family: ['companionship'],
  other: [],
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  medication: 'Medication',
  health: 'Health & care',
  meals: 'Meals',
  errands: 'Errands & shopping',
  household: 'Household',
  childcare: 'Childcare',
  transport: 'Transport',
  study: 'Study',
  work: 'Work',
  exercise: 'Exercise',
  family: 'Family',
  other: 'General',
};

const CATEGORY_WORDS: [TaskCategory, RegExp][] = [
  ['medication', /\b(medicine|medicines|meds|pill|pills|tablet|tablets|insulin|dose|inhaler)\b|ওষুধ|ঔষধ/i],
  ['health', /\b(doctor|dentist|clinic|hospital|check-?up|physio|therapy|appointment|test|lab|vaccine|blood)\b|ডাক্তার|হাসপাতাল/i],
  ['meals', /\b(cook|cooking|dinner|lunch|breakfast|meal|bake|tiffin)\b|রান্না|খাবার/i],
  ['errands', /\b(buy|shop|shopping|grocer(y|ies)|market|pharmacy|post office|bank|collect)\b|বাজার|কেনা/i],
  ['childcare', /\b(school|kids?|children|homework help|tutor|nursery|daycare|pick ?up (the )?(kids?|children))\b|স্কুল/i],
  ['transport', /\b(drive|drop|pick ?up|airport|station|ride|lift|taxi|car)\b/i],
  ['household', /\b(clean|cleaning|laundry|wash|bill|bills|repair|fix|plumber|electrician|rent|tidy|iron)\b|পরিষ্কার|বিল/i],
  ['study', /\b(study|exam|revise|revision|assignment|class|lecture|homework|quiz)\b|পড়া|পরীক্ষা/i],
  ['work', /\b(work|meeting|office|client|deadline|shift|report)\b|অফিস/i],
  ['exercise', /\b(gym|walk|run|yoga|exercise|swim|workout)\b|হাঁটা/i],
  ['family', /\b(call|visit|birthday|anniversary|dawat|wedding|family)\b|দাওয়াত|জন্মদিন/i],
];

const DURATIONS: Record<TaskCategory, number> = {
  medication: 5,
  health: 90,
  meals: 60,
  errands: 60,
  childcare: 30,
  transport: 45,
  household: 45,
  study: 60,
  work: 60,
  exercise: 45,
  family: 30,
  other: 30,
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Bengali digits to Latin, so "৪টা" reads as "4টা". */
const toLatinDigits = (text: string) => text.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

const pad = (n: number) => String(n).padStart(2, '0');
const localIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

interface Found<T> {
  value: T;
  /** The words that said it, removed from the title. */
  phrase?: string;
}

function findDate(text: string, now: Date): Found<Date> | null {
  const day = (offset: number) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };
  const rules: [RegExp, () => Date][] = [
    [/\bday after tomorrow\b|পরশু/i, () => day(2)],
    // কাল on its own (not inside বিকাল) means tomorrow when planning.
    [/\btomorrow\b|\btmrw\b|আগামীকাল|(?<![\u0980-\u09FF])কাল(?![\u0980-\u09FF])/i, () => day(1)],
    [/\btoday\b|\btonight\b|(?<![\u0980-\u09FF])আজ/i, () => day(0)],
  ];
  for (const [pattern, make] of rules) {
    const m = text.match(pattern);
    if (m) return { value: make(), phrase: m[0] };
  }
  const weekday = text.match(/\b(next |this |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)\b/i);
  if (weekday) {
    const target = WEEKDAYS.findIndex((w) => w.startsWith(weekday[2].toLowerCase().slice(0, 3)));
    // The coming one: "Tuesday" on a Tuesday means a week today.
    const offset = (target - now.getDay() + 7) % 7 || 7;
    return { value: day(offset), phrase: weekday[0] };
  }
  const dayMonth =
    text.match(new RegExp(`\\b(?:on )?(\\d{1,2})(?:st|nd|rd|th)? (${MONTHS.join('|')})[a-z]*\\b`, 'i')) ??
    text.match(new RegExp(`\\b(?:on )?(${MONTHS.join('|')})[a-z]* (\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  if (dayMonth) {
    const [a, b] = [dayMonth[1], dayMonth[2]];
    const monthWord = /\d/.test(a) ? b : a;
    const dayNumber = Number(/\d/.test(a) ? a : b);
    const month = MONTHS.indexOf(monthWord.slice(0, 3).toLowerCase());
    const d = new Date(now.getFullYear(), month, dayNumber);
    if (d.getTime() < day(0).getTime()) d.setFullYear(d.getFullYear() + 1);
    return { value: d, phrase: dayMonth[0] };
  }
  const numeric = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : now.getFullYear();
    const d = new Date(year, Number(numeric[2]) - 1, Number(numeric[1]));
    if (!Number.isNaN(d.getTime())) return { value: d, phrase: numeric[0] };
  }
  return null;
}

function findTime(text: string): Found<{ h: number; m: number }> | null {
  const t = toLatinDigits(text);
  const clock = t.match(/\b(?:at |by |@)?(\d{1,2})(?::|\.)(\d{2}) ?(am|pm|a\.m\.|p\.m\.)?/i) ?? t.match(/\b(?:at |by |@)?(\d{1,2}) ?(am|pm|a\.m\.|p\.m\.)(?![a-z])/i);
  if (clock) {
    let h = Number(clock[1]);
    const hasMinutes = clock.length > 3 && clock[2] !== undefined && /^\d{2}$/.test(clock[2]);
    const m = hasMinutes ? Number(clock[2]) : 0;
    const meridiem = (hasMinutes ? clock[3] : clock[2])?.toLowerCase().replace(/\./g, '');
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    if (!meridiem && h >= 1 && h <= 6) h += 12;
    if (h <= 23 && m <= 59) return { value: { h, m }, phrase: clock[0] };
  }
  const bengali = t.match(/(সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)\s*(\d{1,2})?\s*(টা(?:য়|য়)?)?/);
  if (bengali) {
    const base: Record<string, number> = { সকাল: 9, দুপুর: 13, বিকাল: 16, বিকেল: 16, সন্ধ্যা: 18, রাত: 21 };
    let h = bengali[2] ? Number(bengali[2]) : base[bengali[1]];
    if (bengali[2] && ['দুপুর', 'বিকাল', 'বিকেল', 'সন্ধ্যা', 'রাত'].includes(bengali[1]) && h < 12) h += 12;
    return { value: { h, m: 0 }, phrase: bengali[0] };
  }
  const at = t.match(/\bat (\d{1,2})\b/i);
  if (at) {
    let h = Number(at[1]);
    if (h >= 1 && h <= 6) h += 12;
    if (h <= 23) return { value: { h, m: 0 }, phrase: at[0] };
  }
  const parts: [RegExp, number][] = [
    [/\b(this )?morning\b/i, 9],
    [/\bnoon\b|\blunchtime\b/i, 13],
    [/\b(this )?afternoon\b/i, 15],
    [/\b(this )?evening\b/i, 18],
    [/\btonight\b|\bat night\b/i, 20],
  ];
  for (const [pattern, h] of parts) {
    const m = t.match(pattern);
    if (m) return { value: { h, m: 0 }, phrase: /tonight/i.test(m[0]) ? undefined : m[0] };
  }
  return null;
}

function findDuration(text: string): Found<number> | null {
  const m = text.match(/\bfor (\d+(?:\.\d+)?) ?(hours?|hrs?|h|minutes?|mins?|m)\b/i) ?? text.match(/\b(\d+(?:\.\d+)?) ?(hours?|hrs?|minutes?|mins?)\b/i);
  if (!m) return null;
  const amount = Number(m[1]);
  const minutes = /^h/i.test(m[2]) ? Math.round(amount * 60) : Math.round(amount);
  return { value: Math.min(1440, Math.max(5, minutes)), phrase: m[0] };
}

function findPeople(text: string, roster: RosterPerson[]): { assignee?: RosterPerson; forPerson?: RosterPerson; mentioned: RosterPerson[]; phrases: string[] } {
  const mentioned: RosterPerson[] = [];
  const phrases: string[] = [];
  for (const person of roster) {
    const first = person.name.split(' ')[0];
    if (first.length < 2) continue;
    const m = text.match(new RegExp(`(^|[^\\p{L}])(${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[^\\p{L}]|$)`, 'iu'));
    if (m) {
      mentioned.push(person);
      phrases.push(m[2]);
    }
  }
  const forMatch = mentioned.find((p) => new RegExp(`\\b(for|take|taking|with|drop|pick up)\\s+${p.name.split(' ')[0]}`, 'i').test(text));
  const forPerson = mentioned.find((p) => p.kind === 'dependant') ?? forMatch;
  const assignee = mentioned.find((p) => p.kind === 'member' && p !== forPerson && p.takesTasks);
  return { assignee, forPerson, mentioned, phrases };
}

function cleanTitle(text: string, phrases: (string | undefined)[], people: RosterPerson[]): string {
  let title = text;
  for (const phrase of phrases) {
    if (phrase) title = title.replace(phrase, ' ');
  }
  // "Rafid drives" / "ask Rafid" / "Rafid to" read as who does it, not as part of the title.
  for (const p of people) {
    const first = p.name.split(' ')[0];
    title = title
      .replace(new RegExp(`\\b${first}\\s+(takes|will take)\\b`, 'gi'), 'Take')
      .replace(new RegExp(`\\b(ask|by|get)\\s+${first}\\b|\\b${first}\\s+(drives|will do( it)?|does( it)?|to do it)\\b`, 'gi'), ' ');
  }
  title = title
    .replace(/\b(please|remind me to|remember to|i need to|need to|don't forget to|dont forget to)\b/gi, ' ')
    .replace(/\b(urgent|asap|urgently)\b|জরুরি/gi, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[,;:\s]+$/g, '')
    .replace(/^[,;:\s-]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!title) return 'New task';
  return (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 80);
}

function buildDraftReason(params: {
  category: TaskCategory;
  priority: TaskPriority;
  urgent: boolean;
  durationMin: number;
  assignee: RosterPerson;
  explicitAssignee: boolean;
  forPerson?: RosterPerson;
  observerNamed?: RosterPerson;
}): string {
  const { category, priority, urgent, durationMin, assignee, explicitAssignee, forPerson, observerNamed } = params;
  const first = assignee.name.split(' ')[0];
  const needed = CATEGORY_SKILLS[category];
  const matchedSkills = (assignee.skills ?? []).filter((s) => needed.includes(s));
  const skillNote = matchedSkills.length > 0 ? ` (matches ${matchedSkills.join(' & ')} skill)` : '';

  const whoPart = observerNamed
    ? `Assigned to you (${first}) because ${observerNamed.name.split(' ')[0]} cannot take tasks`
    : explicitAssignee
      ? `Assigned to ${first} as named in your note${skillNote}`
      : `Assigned to ${first}${skillNote}`;

  const forPart = forPerson && forPerson.id !== assignee.id ? ` for ${forPerson.name.split(' ')[0]}` : '';

  const whyPriority = urgent ? 'marked Urgent from your note' : priority === 'important' ? 'marked Important because health and medication tasks affect family care' : 'marked Routine';

  return `${whoPart}${forPart} · Categorised under ${CATEGORY_LABELS[category]} (${durationMin} min, ${whyPriority}).`;
}

/** Splits a note into separate things to do: one per line, semicolon or sentence. */
export function splitNote(note: string): string[] {
  return note
    .split(/\n|;|(?<=[.!?।])\s+(?=[A-Zঀ-৿])/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[\s.,;!?।]/g, '').length > 1)
    .slice(0, 10);
}

export function readNote(note: string, roster: RosterPerson[], me: RosterPerson, now: Date = new Date()): QuickAddResult {
  const drafts: TaskDraft[] = [];
  const assumptions: string[] = [];
  for (const raw of splitNote(note)) {
    const part = toLatinDigits(raw);
    const date = findDate(part, now);
    const time = findTime(part);
    const duration = findDuration(part);
    const people = findPeople(part, roster);
    const category = CATEGORY_WORDS.find(([, re]) => re.test(part))?.[0] ?? 'other';
    const urgent = /\b(urgent|asap|urgently)\b|জরুরি/i.test(part);
    const priority: TaskPriority = urgent ? 'urgent' : category === 'medication' || category === 'health' ? 'important' : 'routine';
    const title = cleanTitle(part, [date?.phrase, time?.phrase, duration?.phrase], people.mentioned);

    let { h, m } = time?.value ?? { h: 9, m: 0 };
    const isToday = date && date.value.toDateString() === now.toDateString();
    if (!time && isToday && now.getHours() >= 9) {
      // "today" with no time: the next full hour, if the day isn't over.
      h = Math.min(now.getHours() + 1, 21);
      m = 0;
      assumptions.push(`No time was given for “${title}”, so it is set for later today.`);
    } else if (!time) {
      assumptions.push(`No time was given for “${title}”, so it is set for 9:00 AM.`);
    }
    let day = date?.value;
    if (!day) {
      day = new Date(now);
      day.setHours(0, 0, 0, 0);
      const candidate = new Date(day);
      candidate.setHours(h, m, 0, 0);
      if (candidate.getTime() <= now.getTime()) day.setDate(day.getDate() + 1);
    }
    const start = new Date(day);
    start.setHours(h, m, 0, 0);

    const assignee = people.assignee ?? me;
    const named = people.mentioned.filter((p) => p.kind === 'member' && !p.takesTasks && p !== people.forPerson);
    for (const p of named) assumptions.push(`${p.name.split(' ')[0]} can’t take tasks in Hearth, so “${title}” is given to you.`);

    const durationMin = duration?.value ?? DURATIONS[category];
    const reason = buildDraftReason({
      category,
      priority,
      urgent,
      durationMin,
      assignee,
      explicitAssignee: Boolean(people.assignee),
      forPerson: people.forPerson,
      observerNamed: named[0],
    });

    drafts.push({
      title,
      notes: '',
      category,
      priority,
      start: start.toISOString(),
      durationMin,
      assigneeId: assignee.id,
      forId: people.forPerson && people.forPerson.id !== assignee.id ? people.forPerson.id : undefined,
      visibility: 'family',
      reminder: Boolean(time) || category === 'medication' || category === 'health',
      reason,
    });
  }
  return { drafts, assumptions: [...new Set(assumptions)].slice(0, 6) };
}

export { localIso };
