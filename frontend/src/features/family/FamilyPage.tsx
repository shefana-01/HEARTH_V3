import { useState } from 'react';
import { Download, Pencil, UserPlus } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { plural } from '@/lib/format';
import { Button, ErrorState, PageHeader, PageSkeleton, useToast } from '@/components/ui';
import { InviteMemberDialog } from './InviteMemberDialog';
import { FamilyDetailsDialog } from './FamilyDetailsDialog';
import { PeopleSection } from './PeopleSection';
import { DependantsSection } from './DependantsSection';
import { TodayAtAGlance } from './TodayAtAGlance';
import { InviteCodeCard } from './InviteCodeCard';
import { NeedsSomeoneCard } from './NeedsSomeoneCard';
import { ChatPreviewCard } from './ChatPreviewCard';
import { exportRoster } from './roster';

/** The shared home of the family: who is in it, who it looks after, today's plan and the latest chat. */
export default function FamilyPage() {
  useDocumentTitle('Family hub');
  const { family, members, people, isLead, refresh, status } = useFamily();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (status === 'error') return <ErrorState headingLevel="h1" message="We couldn’t load your family." onRetry={refresh} />;
  if (!family) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        eyebrow="Family hub"
        title={family.name}
        description={[family.location, plural(people.length, 'person', 'people')].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button variant="secondary" className="h-11" onClick={() => exportRoster(family.name, members)} leftIcon={<Download aria-hidden="true" className="h-4 w-4" />}>
              Export list
            </Button>
            {isLead && (
              <>
                <Button variant="secondary" className="h-11" onClick={() => setDetailsOpen(true)} leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}>
                  Edit details
                </Button>
                <Button className="h-11" onClick={() => setInviteOpen(true)} leftIcon={<UserPlus aria-hidden="true" className="h-4 w-4" />}>
                  Invite someone
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <PeopleSection onInvite={() => setInviteOpen(true)} />
          <DependantsSection />
          <TodayAtAGlance />
        </div>
        <aside aria-label="Family updates" className="space-y-6">
          <NeedsSomeoneCard />
          <ChatPreviewCard />
          <InviteCodeCard />
        </aside>
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(m) => {
          toast({ title: 'Invitation recorded', description: `${m.name} is now listed as invited.` });
          void refresh();
        }}
      />
      <FamilyDetailsDialog
        family={family}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onSaved={() => {
          toast({ title: 'Family details saved' });
          void refresh();
        }}
      />
    </>
  );
}
