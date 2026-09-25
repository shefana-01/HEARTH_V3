import { useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { ACCEPTED_TYPES, documentService, MAX_UPLOAD_MB } from '@/services/care/documentService';
import { appointmentService } from '@/services/care/appointmentService';
import { isDemoMode } from '@/services/config';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { DOCUMENT_CATEGORIES } from '@/constants/labels';
import { Button, Callout, Dialog, FormError, FormField, Input, Select, useToast } from '@/components/ui';
import { PersonSelect } from '@/components/domain/People';
import { AccessPicker } from './AccessPicker';
import { accessFor, formatSize, NO_ONE_CHOSEN, sharingOf, type Sharing } from './documentText';
import type { DocumentCategory, FamilyDocument } from '@/types/domain';

const nameFromFile = (file: File) => file.name.replace(/\.[^.]+$/, '');

export function UploadDialog({ onClose, initialFile, onUploaded }: { onClose: () => void; initialFile: File | null; onUploaded: () => void }) {
  const { me } = useFamily();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(initialFile);
  const [title, setTitle] = useState(initialFile ? nameFromFile(initialFile) : '');
  const [category, setCategory] = useState<DocumentCategory>('Medical report');
  const [ownerId, setOwnerId] = useState(me?.id ?? '');
  const [sharing, setSharing] = useState<Sharing>('family');
  const [chosen, setChosen] = useState<string[]>([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [errors, setErrors] = useState<{ file?: string; title?: string; chosen?: string }>({});
  const appts = useAsync(() => appointmentService.list(), []);
  const upload = useMutation(documentService.upload);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      file: !file
        ? 'Choose a file to upload.'
        : file.size > MAX_UPLOAD_MB * 1024 * 1024
          ? `Files must be ${MAX_UPLOAD_MB} MB or smaller.`
          : file.type && !ACCEPTED_TYPES.includes(file.type)
            ? 'Use a PDF, image or Word document.'
            : undefined,
      title: title.trim() ? undefined : 'Give the document a name.',
      chosen: sharing === 'chosen' && chosen.length === 0 ? NO_ONE_CHOSEN : undefined,
    };
    setErrors(next);
    if (next.file || next.title || next.chosen || !file) return;
    const doc = await upload.run({ file, title, category, ownerId: ownerId || undefined, appointmentId: appointmentId || undefined, ...accessFor(sharing, chosen) });
    if (doc) {
      toast({ title: 'Document added', description: doc.title });
      onUploaded();
      onClose();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Upload a document"
      description="Add a report, prescription or letter. You choose who it is about and who can open it."
      dismissible={!upload.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={upload.pending}>
            Cancel
          </Button>
          <Button type="submit" form="upload-form" loading={upload.pending} leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />}>
            Upload
          </Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={upload.error} />
        <FormField label="File" required error={errors.file} hint={`PDF, image or Word · up to ${MAX_UPLOAD_MB} MB`}>
          {(p) => (
            <input
              {...p}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(nameFromFile(f));
              }}
              className="block w-full rounded-xl border border-dashed border-line-strong bg-surface-muted p-3 text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
          )}
        </FormField>
        {file && (
          <p className="-mt-2 text-[0.8125rem] text-ink-subtle">
            Selected: {file.name} ({formatSize(Math.max(1, Math.round(file.size / 1024)))})
          </p>
        )}
        <FormField label="Name" required error={errors.title}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </FormField>
        <PersonSelect label="Who is it about?" value={ownerId} onChange={setOwnerId} emptyLabel="The household (nobody in particular)" />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Category">
            {(p) => (
              <Select {...p} value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Related appointment" aside="Optional">
            {(p) => (
              <Select {...p} value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                <option value="">None</option>
                {(appts.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <AccessPicker sharing={sharing} onSharing={setSharing} chosen={chosen} onChosen={setChosen} error={errors.chosen} />
        {isDemoMode && (
          <Callout tone="amber" className="text-[0.8125rem]">
            Preview limitation: only the file’s details are saved until Hearth’s secure document storage is connected.
          </Callout>
        )}
      </form>
    </Dialog>
  );
}

export function AccessDialog({ doc, onClose, onSaved }: { doc: FamilyDocument; onClose: () => void; onSaved: () => void }) {
  const { me } = useFamily();
  const { toast } = useToast();
  const [sharing, setSharing] = useState<Sharing>(sharingOf(doc));
  const [chosen, setChosen] = useState(doc.allowedIds.filter((id) => id !== me?.id));
  const [error, setError] = useState<string>();
  const save = useMutation(documentService.updateAccess);

  const onSave = async () => {
    if (sharing === 'chosen' && chosen.length === 0) {
      setError(NO_ONE_CHOSEN);
      return;
    }
    setError(undefined);
    const { access, allowedIds } = accessFor(sharing, chosen);
    if (await save.run(doc.id, access, allowedIds)) {
      toast({ title: 'Access changed', description: doc.title });
      onSaved();
      onClose();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change access"
      description={doc.title}
      dismissible={!save.pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button loading={save.pending} onClick={onSave}>
            Save access
          </Button>
        </>
      }
    >
      <FormError message={save.error} />
      <AccessPicker sharing={sharing} onSharing={setSharing} chosen={chosen} onChosen={setChosen} error={error} />
    </Dialog>
  );
}
