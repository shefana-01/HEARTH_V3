import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardHeader, RadioCards, Switch } from '@/components/ui';
import { getDisplayPrefs, saveDisplayPrefs, TEXT_SIZES, type DisplayPrefs, type TextSize } from '@/lib/prefs';

export function DisplaySection() {
  const [prefs, setPrefs] = useState<DisplayPrefs>(getDisplayPrefs);

  const change = (patch: Partial<DisplayPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveDisplayPrefs(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card as="section" aria-labelledby="display-heading">
        <CardHeader title={<span id="display-heading">Display</span>} description="Make Hearth easier on the eyes. Saved on this device." icon={<Eye aria-hidden="true" className="h-5 w-5" />} />
        <div className="space-y-6">
          <RadioCards<TextSize>
            name="text-size"
            legend="Text size"
            columns={3}
            value={prefs.textSize}
            onChange={(textSize) => change({ textSize })}
            options={TEXT_SIZES.map(({ value, label, description }) => ({ value, label, description }))}
          />
          <div className="border-t border-line pt-5">
            <Switch label="Stronger contrast" description="Darker text and clearer outlines." checked={prefs.highContrast} onChange={(highContrast) => change({ highContrast })} />
          </div>
        </div>
      </Card>

      <Card as="aside" aria-label="Display sample" tone="muted">
        <p className="eyebrow mb-3">Sample</p>
        <p className="font-display text-lg">Chemistry class ends at 2:30 PM</p>
        <p className="mt-1 text-sm text-ink-muted">Buy rice on the way home. Your family sees you are free after 4:00 PM.</p>
        <p className="mt-3 text-xs text-ink-subtle">This is how text looks with your choices.</p>
      </Card>
    </div>
  );
}
