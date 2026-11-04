import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarSection } from './CalendarSection';
import { PageHeader, TabPanel, Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { AiSection } from './AiSection';
import { AlertsSection } from './AlertsSection';
import { DataSection } from './DataSection';
import { DisplaySection } from './DisplaySection';
import { FamilySection } from './FamilySection';
import { ProfileSection } from './ProfileSection';
import { PushSection } from './PushSection';
import { SecuritySection } from './SecuritySection';

const SECTIONS = [
  { id: 'profile', label: 'Profile', content: <ProfileSection /> },
  { id: 'display', label: 'Display', content: <DisplaySection /> },
  { id: 'family', label: 'Family', content: <FamilySection /> },
  {
    id: 'alerts',
    label: 'Alerts & reminders',
    content: (
      <div className="space-y-6">
        <PushSection />
        <AlertsSection />
      </div>
    ),
  },
  { id: 'calendar', label: 'Calendar sync', content: <CalendarSection /> },
  { id: 'ai', label: 'AI help', content: <AiSection /> },
  { id: 'security', label: 'Sign-in & security', content: <SecuritySection /> },
  { id: 'data', label: 'Data & privacy', content: <DataSection /> },
] as const;

type Section = (typeof SECTIONS)[number]['id'];

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const [params] = useSearchParams();
  const requested = params.get('section');
  const [section, setSection] = useState<Section>(SECTIONS.some((s) => s.id === requested) ? (requested as Section) : 'profile');

  return (
    <>
      <PageHeader title="Settings" description="Your details, how Hearth looks, your family’s details, and the data kept on this device." />
      <Tabs label="Settings sections" idPrefix="settings" value={section} onChange={setSection} className="mb-6" items={SECTIONS.map(({ id, label }) => ({ id, label }))} />
      {SECTIONS.map(({ id, content }) => (
        <TabPanel key={id} idPrefix="settings" id={id} className={section === id ? '' : 'hidden'}>
          {content}
        </TabPanel>
      ))}
    </>
  );
}
