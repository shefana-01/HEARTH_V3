import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Ellipsis, FileText, FolderLock, Lock, Search, ShieldCheck, Trash2, Upload, UploadCloud, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { ACCEPTED_TYPES, documentService, MAX_UPLOAD_MB } from '@/services/care/documentService';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatFullDate } from '@/lib/dates';
import { DOCUMENT_CATEGORIES } from '@/constants/labels';
import { cn } from '@/lib/cn';
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  FormError,
  FormField,
  IconButton,
  Input,
  ListSkeleton,
  Menu,
  PageHeader,
  RadioCards,
  Select,
  Tabs,
  TabPanel,
  ToggleChip,
  useToast,
} from '@/components/ui';
import type { CareDocument, DocumentAccess, DocumentCategory } from '@/types/domain';

const formatSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

function AccessPicker({ access, setAccess, allowed, setAllowed }: { access: DocumentAccess; setAccess: (a: DocumentAccess) => void; allowed: string[]; setAllowed: (ids: string[]) => void }) {
  const { members, me } = useFamily();
  return (
    <div className="space-y-3">
      <RadioCards
        name="access"
        legend="Who can open it?"
        columns={2}
        value={access}
        onChange={setAccess}
        options={[
          { value: 'circle', label: 'Whole circle', description: 'Everyone in the family circle.' },
          { value: 'restricted', label: 'Only selected people', description: 'For sensitive or legal documents.' },
        ]}
      />
      {access === 'restricted' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="People with access">
          {members
            .filter((m) => m.id !== me?.id && m.status === 'active')
            .map((m) => (
              <ToggleChip key={m.id} pressed={allowed.includes(m.id)} onClick={() => setAllowed(allowed.includes(m.id) ? allowed.filter((x) => x !== m.id) : [...allowed, m.id])}>
                {m.name}
              </ToggleChip>
            ))}
          <p className="w-full text-xs text-ink-subtle">You always keep access to documents you upload.</p>
        </div>
      )}
    </div>
  );
}

function UploadDialog({ open, onClose, initialFile, onUploaded }: { open: boolean; onClose: () => void; initialFile: File | null; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [title, setTitle] = useState(initialFile?.name.replace(/\.[^.]+$/, '') ?? '');
  const [category, setCategory] = useState<DocumentCategory>('Clinical summary');
  const [access, setAccess] = useState<DocumentAccess>('circle');
  const [allowed, setAllowed] = useState<string[]>([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const appts = useAsync(() => appointmentService.list(), []);
  const upload = useMutation(documentService.upload);
  const { toast } = useToast();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      file: !file ? 'Choose a file to upload.' : file.size > MAX_UPLOAD_MB * 1024 * 1024 ? `Files must be ${MAX_UPLOAD_MB} MB or smaller.` : file.type && !ACCEPTED_TYPES.includes(file.type) ? 'Use a PDF, image or Word document.' : undefined,
      title: title.trim() ? undefined : 'Give the document a name.',
    };
    setErrors(next);
    if (next.file || next.title || !file) return;
    const doc = await upload.run({ file, title, category, access, allowedIds: allowed, appointmentId });
    if (doc) {
      toast({ title: 'Document added', description: doc.title });
      onUploaded();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload a document"
      description="Add a care record, prescription or letter for the circle."
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
        <FormField label="File" required error={errors.file} hint={`PDF, image or Word ┬╖ up to ${MAX_UPLOAD_MB} MB`}>
          {(p) => (
            <input
              {...p}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
              className="block w-full rounded-xl border border-dashed border-line-strong bg-surface-muted p-3 text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
          )}
        </FormField>
        {file && <p className="-mt-2 text-[13px] text-ink-subtle">Selected: {file.name} ({formatSize(Math.max(1, Math.round(file.size / 1024)))})</p>}
        <FormField label="Name" required error={errors.title}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </FormField>
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
        <AccessPicker access={access} setAccess={setAccess} allowed={allowed} setAllowed={setAllowed} />
        <Callout tone="amber" className="text-[13px]">
          Preview limitation: only the fileΓÇÖs details are saved until HearthΓÇÖs secure document storage is connected.
        </Callout>
      </form>
    </Dialog>
  );
}

function AccessDialog({ doc, onClose, onSaved }: { doc: CareDocument; onClose: () => void; onSaved: () => void }) {
  const [access, setAccess] = useState(doc.access);
  const [allowed, setAllowed] = useState(doc.allowedIds);
  const save = useMutation(documentService.updateAccess);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Change access"
      description={doc.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.pending}
            onClick={async () => {
              if (await save.run(doc.id, access, allowed)) {
                onSaved();
                onClose();
              }
            }}
          >
            Save access
          </Button>
        </>
      }
    >
      <FormError message={save.error} />
      <AccessPicker access={access} setAccess={setAccess} allowed={allowed} setAllowed={setAllowed} />
    </Dialog>
  );
}

type View = 'all' | 'category' | 'appointment';

export default function DocumentsPage() {
  useDocumentTitle('Documents');
  const { family, nameOf } = useFamily();
  const { toast } = useToast();
  const data = useAsync(() => Promise.all([documentService.list(), appointmentService.list()]), []);
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [uploadFile, setUploadFile] = useState<File | null | undefined>(undefined);
  const [accessDoc, setAccessDoc] = useState<CareDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<CareDocument | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const remove = useMutation(documentService.remove);

  const [docs = [], appts = []] = data.data ?? [];
  const filtered = docs.filter((d) => (category === 'all' || d.category === category) && (!query.trim() || `${d.title} ${d.fileName}`.toLowerCase().includes(query.trim().toLowerCase())));
  const totalKB = docs.reduce((s, d) => s + d.sizeKB, 0);
  const apptTitle = (id?: string) => appts.find((a) => a.id === id)?.title;

  const groups: [string, CareDocument[]][] =
    view === 'all'
      ? [['', filtered]]
      : Object.entries(
          filtered.reduce<Record<string, CareDocument[]>>((acc, d) => {
            const key = view === 'category' ? d.category : apptTitle(d.appointmentId) ?? 'Not linked to a visit';
            (acc[key] ??= []).push(d);
            return acc;
          }, {}),
        );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setUploadFile(f);
  };

  const DocRow = ({ d }: { d: CareDocument }) => (
    <li className="grid gap-3 border-b border-line px-4 py-4 last:border-0 md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_auto] md:items-center md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <FileText aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{d.title}</p>
          <p className="truncate text-[13px] text-ink-subtle">
            {d.fileName}
            {d.appointmentId && apptTitle(d.appointmentId) && ` ┬╖ ${apptTitle(d.appointmentId)}`}
          </p>
        </div>
      </div>
      <p className="text-[13px] text-ink-muted">
        <span className="block font-medium text-ink">{d.category}</span>
        {formatSize(d.sizeKB)}
      </p>
      <p className="text-[13px] text-ink-muted">
        {formatFullDate(d.uploadedAt)}
        <span className="block text-xs text-ink-subtle">by {nameOf(d.uploadedById).split(' ')[0]}</span>
      </p>
      <div>
        <Badge tone={d.access === 'circle' ? 'mint' : 'rose'} dot>
          {d.access === 'circle' ? 'Whole circle' : 'Restricted'}
        </Badge>
        {d.access === 'restricted' && <p className="mt-1 truncate text-xs text-ink-subtle">{d.allowedIds.map((id) => nameOf(id).split(' ')[0]).join(', ')}</p>}
      </div>
      <div className="flex justify-end">
        <Menu
          items={[
            { label: 'Change access', icon: <Lock aria-hidden="true" />, onSelect: () => setAccessDoc(d) },
            { label: 'Delete', icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => setDeleteDoc(d) },
          ]}
          trigger={({ ref, ...props }) => (
            <IconButton ref={ref} {...props} label={`Actions for ${d.title}`} size="sm">
              <Ellipsis aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          )}
        />
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        eyebrow="Protected care archive"
        title="Care documents"
        description={`Summaries, prescriptions and important papers for ${family?.recipient.name}.`}
        actions={
          <Button leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />} onClick={() => setUploadFile(null)}>
            Upload document
          </Button>
        }
      />

      {data.status === 'error' ? (
        <ErrorState message={data.error?.message} onRetry={data.reload} />
      ) : !data.data ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          <Card tone="muted" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FolderLock aria-hidden="true" className="h-8 w-8 text-primary-600" />
              <div>
                <p className="font-display text-lg">{family?.recipient.name}</p>
                <p className="text-sm text-ink-muted">
                  {docs.length} document{docs.length === 1 ? '' : 's'} you can see ┬╖ {formatSize(totalKB)}
                </p>
              </div>
            </div>
            <Badge tone="mint" size="md" className="gap-1">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Access is set per document
            </Badge>
          </Card>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              label="Group documents"
              idPrefix="docs"
              value={view}
              onChange={setView}
              items={[
                { id: 'all', label: 'All' },
                { id: 'category', label: 'By category' },
                { id: 'appointment', label: 'By appointment' },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="sm:w-64">
                <label htmlFor="doc-search" className="sr-only">
                  Search documents
                </label>
                <Input id="doc-search" type="search" leftIcon={<Search />} placeholder="Search documentsΓÇª" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="sm:w-48">
                <label htmlFor="doc-category" className="sr-only">
                  Filter by category
                </label>
                <Select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <TabPanel idPrefix="docs" id={view}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<FolderLock aria-hidden="true" />}
                title={docs.length ? 'No documents match' : 'No documents yet'}
                description={docs.length ? 'Try a different search or category.' : 'Upload care summaries, prescriptions or letters so the right people can find them.'}
                action={!docs.length ? <Button onClick={() => setUploadFile(null)}>Upload a document</Button> : undefined}
              />
            ) : (
              <div className="space-y-6">
                {groups.map(([label, list]) => (
                  <section key={label || 'all'} aria-label={label || 'All documents'}>
                    {label && <h2 className="mb-2 font-display text-lg">{label}</h2>}
                    <Card padding="none">
                      <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_auto] gap-3 border-b border-line bg-surface-muted/60 px-5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle md:grid" aria-hidden="true">
                        <span>Document</span>
                        <span>Category</span>
                        <span>Added</span>
                        <span>Access</span>
                        <span className="w-8" />
                      </div>
                      <ul>
                        {list.map((d) => (
                          <DocRow key={d.id} d={d} />
                        ))}
                      </ul>
                    </Card>
                  </section>
                ))}
              </div>
            )}
          </TabPanel>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn('flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:flex-row sm:text-left', dragging ? 'border-primary-400 bg-primary-50' : 'border-line-strong bg-surface-muted/60')}
          >
            <UploadCloud aria-hidden="true" className="h-8 w-8 text-primary-500" />
            <div className="flex-1">
              <p className="font-semibold text-ink">Drag & drop a file here</p>
              <p className="text-[13px] text-ink-muted">YouΓÇÖll choose its category and who can see it.</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setUploadFile(f);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              Browse files
            </Button>
          </div>

          <p className="flex items-center justify-center gap-2 text-[13px] text-ink-subtle">
            <Users aria-hidden="true" className="h-4 w-4" /> Restricted documents are only listed for the people who can open them.
          </p>
        </div>
      )}

      {uploadFile !== undefined && <UploadDialog open onClose={() => setUploadFile(undefined)} initialFile={uploadFile} onUploaded={data.reload} />}
      {accessDoc && <AccessDialog doc={accessDoc} onClose={() => setAccessDoc(null)} onSaved={data.reload} />}
      <ConfirmDialog
        open={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        title="Delete this document?"
        description={deleteDoc ? `ΓÇ£${deleteDoc.title}ΓÇ¥ will be removed for everyone. This is recorded in the activity history.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        loading={remove.pending}
        onConfirm={async () => {
          if (!deleteDoc) return;
          const ok = await remove.attempt(deleteDoc.id);
          toast(ok ? { title: 'Document deleted' } : { tone: 'error', title: 'CouldnΓÇÖt delete the document', description: 'Please try again.' });
          setDeleteDoc(null);
          data.reload();
        }}
      />
    </>
  );
}
