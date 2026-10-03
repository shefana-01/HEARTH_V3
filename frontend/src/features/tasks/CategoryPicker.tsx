import { cn } from '@/lib/cn';
import { TASK_CATEGORIES } from '@/constants/labels';
import type { TaskCategory } from '@/types/domain';

/** All task categories as selectable tiles: two across on a phone, more on wider screens. */
export function CategoryPicker({ value, onChange }: { value: TaskCategory; onChange: (category: TaskCategory) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">What kind of task is it?</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map((c) => {
          const { label, icon: Icon } = TASK_CATEGORIES[c];
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(c)}
              className={cn(
                'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[0.8125rem] font-semibold transition-colors',
                active ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line text-ink-muted hover:border-primary-300 hover:text-ink',
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
