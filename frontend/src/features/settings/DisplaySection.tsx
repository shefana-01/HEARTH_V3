import { useSyncExternalStore } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardHeader, FormField, RadioCards, Select, Switch } from '@/components/ui';
import { getDisplayPrefs, saveDisplayPrefs, subscribeDisplayPrefs, TEXT_SIZES, THEMES, VOICE_LANGUAGES, type DisplayPrefs, type TextSize, type ThemePreference, type VoiceLanguage } from '@/lib/prefs';
import { isVoiceTypingSupported } from '@/lib/speech';

export function DisplaySection() {
  // Shared with the sun/moon button in the header, so the two always agree.
  const prefs = useSyncExternalStore(subscribeDisplayPrefs, getDisplayPrefs, getDisplayPrefs);
  const change = (patch: Partial<DisplayPrefs>) => saveDisplayPrefs({ ...prefs, ...patch });
  const voiceSupported = isVoiceTypingSupported();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card as="section" aria-labelledby="display-heading">
        <CardHeader title={<span id="display-heading">Display</span>} description="Make Hearth easier on the eyes. Saved on this device." icon={<Eye aria-hidden="true" className="h-5 w-5" />} />
        <div className="space-y-6">
          <RadioCards<ThemePreference>
            name="theme"
            legend="Theme"
            columns={3}
            value={prefs.theme}
            onChange={(theme) => change({ theme })}
            options={THEMES.map(({ value, label, description }) => ({ value, label, description }))}
          />
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
          <div className="border-t border-line pt-5">
            <FormField
              label="Voice typing language"
              hint={
                voiceSupported
                  ? 'Used when you tap the microphone in a text box. Your browser’s speech service turns your voice into text, so your voice may be sent to it (for example to Google in Chrome). Hearth never receives or keeps the audio.'
                  : 'Voice typing isn’t available in this browser. Try Chrome, Edge or Safari.'
              }
            >
              {(p) => (
                <Select {...p} value={prefs.voiceLanguage} disabled={!voiceSupported} onChange={(e) => change({ voiceLanguage: e.target.value as VoiceLanguage })}>
                  {VOICE_LANGUAGES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
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
