import { useState } from 'react';
import { PageHeader, TabPanel, Tabs } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { AlertsSection } from './AlertsSection';
import { DataSection } from './DataSection';
import { DisplaySection } from './DisplaySection';
import { FamilySection } from './FamilySection';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';

const SECTIONS = [
  { id: 'profile', label: 'Profile', content: <ProfileSection /> },
  { id: 'display', label: 'Display', content: <DisplaySection /> },
  { id: 'family', label: 'Family', content: <FamilySection /> },
  { id: 'alerts', label: 'Alerts & reminders', content: <AlertsSection /> },
  { id: 'security', label: 'Sign-in & security', content: <SecuritySection /> },
  { id: 'data', label: 'Data & privacy', content: <DataSection /> },
] as const;

type Section = (typeof SECTIONS)[number]['id'];

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const [section, setSection] = useState<Section>('profile');

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
