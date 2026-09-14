import { Dialog } from '@/components/ui';
import type { FamilyMember } from '@/types/domain';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: (member: FamilyMember) => void;
}

export function InviteMemberDialog({ open, onClose, onInvited }: InviteMemberDialogProps) {
  const handleInvite = (member: FamilyMember) => {
    onInvited(member);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Invite Family Member">
      {/* Dialog content - call handleInvite when member is invited */}
    </Dialog>
  );
}
