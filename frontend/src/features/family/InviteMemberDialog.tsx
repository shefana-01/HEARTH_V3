import { Dialog } from '@/components/ui';
import type { FamilyMember } from '@/types/domain';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: (member: FamilyMember) => void;
}

export function InviteMemberDialog({ open, onClose, onInvited }: InviteMemberDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      {/* Dialog content */}
    </Dialog>
  );
}
