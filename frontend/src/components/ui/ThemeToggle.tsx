import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { IconButton } from './Button';

/** One-tap light/dark switch for headers. The full choice (including "match my device") is in Settings → Display. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const toDark = resolved === 'light';
  return (
    <IconButton label={toDark ? 'Switch to dark theme' : 'Switch to light theme'} onClick={toggle} className={className}>
      {toDark ? <Moon aria-hidden="true" className="h-5 w-5" /> : <Sun aria-hidden="true" className="h-5 w-5" />}
    </IconButton>
  );
}
