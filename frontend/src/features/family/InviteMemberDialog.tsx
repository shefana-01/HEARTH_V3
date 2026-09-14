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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const name = String(formData.get('name') ?? '');
          if (!name.trim()) return;
          handleInvite({ id: crypto.randomUUID(), name } as FamilyMember);
        }}
      >
        <input name="name" placeholder="Member name" required />
        <button type="submit">Send Invite</button>
      </form>
    </Dialog>
  );
}
