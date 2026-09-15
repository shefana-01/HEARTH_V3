import { cn } from '@/lib/cn';

export function Spinner({ size = 'md', className, label }: { size?: 'sm' | 'md' | 'lg'; className?: string; label?: string }) {
  const px = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-8 w-8 border-[3px]' : 'h-5 w-5 border-2';
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex items-center', className)}>
      <span aria-hidden="true" className={cn('animate-spin rounded-full border-current border-r-transparent opacity-80', px)} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
