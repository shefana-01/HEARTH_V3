import { cn } from '@/lib/cn';
import { initials } from '@/lib/initials';

const palettes = [
  'bg-primary-100 text-primary-800',
  'bg-rose-100 text-rose-700',
  'bg-mint-100 text-mint-800',
  'bg-amber-100 text-amber-700',
  'bg-primary-200 text-primary-900',
  'bg-rose-200 text-rose-700',
];

/** Stable colour per person, derived from their id or name. */
function paletteFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palettes[Math.abs(hash) % palettes.length];
}

const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };

export interface AvatarProps {
  name: string;
  seed?: string;
  size?: keyof typeof sizes;
  className?: string;
  /** Decorative when the name is already shown next to it. */
  decorative?: boolean;
  /** Profile picture; falls back to initials when missing. */
  src?: string;
}

export function Avatar({ name, seed, size = 'md', className, decorative = true, src }: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', sizes[size], paletteFor(seed ?? name), className)}
    >
      {src ? <img src={src} alt="" className="h-full w-full rounded-full object-cover" /> : initials(name)}
    </span>
  );
}

export function AvatarGroup({ people, max = 4, size = 'sm' }: { people: { id: string; name: string }[]; max?: number; size?: AvatarProps['size'] }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex -space-x-2" role="img" aria-label={people.map((p) => p.name).join(', ')}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} seed={p.id} size={size} className="ring-2 ring-surface" />
      ))}
      {extra > 0 && (
        <span aria-hidden="true" className={cn('inline-flex items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted ring-2 ring-surface', sizes[size ?? 'sm'])}>
          +{extra}
        </span>
      )}
    </span>
  );
}
