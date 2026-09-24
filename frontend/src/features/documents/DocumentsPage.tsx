import { useRef, useState, type DragEvent } from 'react';
import { Ellipsis, FileText, FolderLock, Lock, Search, ShieldCheck, Trash2, Upload, UploadCloud, Users } from 'lucide-react';
import { useFamily } from '@/app/FamilyProvider';
import { ACCEPTED_TYPES, documentService } from '@/services/care/documentService';
import { appointmentService } from '@/services/care/appointmentService';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatFullDate } from '@/lib/dates';
import { listNames, plural } from '@/lib/format';
import { DOCUMENT_CATEGORIES } from '@/constants/labels';
import { cn } from '@/lib/cn';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, IconButton, Input, ListSkeleton, Menu, PageHeader, Select, Tabs, TabPanel, useToast } from '@/components/ui';
import { AccessDialog, UploadDialog } from './DocumentDialogs';
import { formatSize } from './documentText';
import type { FamilyDocument } from '@/types/domain';

type View = 'all' | 'category' | 'person' | 'appointment';

const ROW_COLUMNS = 'md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_auto]';
const ALL = 'all';
const HOUSEHOLD = 'household';

function DocumentRow({ doc, appointmentTitle, onChangeAccess, onDelete }: { doc: FamilyDocument; appointmentTitle?: string; onChangeAccess: () => void; onDelete: () => void }) {
  const { me, personName } = useFamily();
  const who = (id: string) => (id === me?.id ? 'you' : personName(id).split(' ')[0]);
  return (
    <li className={cn('grid gap-3 border-b border-line px-4 py-4 last:border-0 md:items-center md:px-5', ROW_COLUMNS)}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <FileText aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{doc.title}</p>
          <p className="truncate text-[0.8125rem] text-ink-muted">{doc.ownerId ? `About ${personName(doc.ownerId)}` : 'Household'}</p>
          <p className="truncate text-xs text-ink-subtle">
            {doc.fileName}
            {appointmentTitle && ` · ${appointmentTitle}`}
          </p>
        </div>
      </div>
      <p className="text-[0.8125rem] text-ink-muted">
        <span className="block font-medium text-ink">{doc.category}</span>
        {formatSize(doc.sizeKB)}
      </p>
      <p className="text-[0.8125rem] text-ink-muted">
        {formatFullDate(doc.uploadedAt)}
        <span className="block text-xs text-ink-subtle">by {personName(doc.uploadedById).split(' ')[0]}</span>
      </p>
      <div>
        {doc.access === 'family' ? (
          <Badge tone="mint" dot>
            My family
          </Badge>
        ) : (
          <>
            <Badge tone="rose">
              <Lock aria-hidden="true" className="mr-1 h-3 w-3" />
              Restricted
            </Badge>
            <p className="mt-1 truncate text-xs text-ink-subtle">Only {listNames(doc.allowedIds.map(who))}</p>
          </>
        )}
      </div>
      <div className="flex justify-end">
        <Menu
          items={[
            { label: 'Change access', icon: <Lock aria-hidden="true" />, onSelect: onChangeAccess },
            { label: 'Delete', icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: onDelete },
          ]}
          trigger={({ ref, ...props }) => (
            <IconButton ref={ref} {...props} label={`Actions for ${doc.title}`}>
              <Ellipsis aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          )}
        />
      </div>
    </li>
  );
}

export default function DocumentsPage() {
  useDocumentTitle('Documents');
  const { me, people, personName } = useFamily();
  const { toast } = useToast();
  const data = useAsync(() => Promise.all([documentService.list(), appointmentService.list()]), []);
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [about, setAbout] = useState(ALL);
  const [uploadFile, setUploadFile] = useState<File | null | undefined>(undefined);
  const [accessDoc, setAccessDoc] = useState<FamilyDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<FamilyDocument | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const remove = useMutation(documentService.remove);

  const [docs = [], appts = []] = data.data ?? [];
  const matchesAbout = (d: FamilyDocument) => about === ALL || (about === HOUSEHOLD ? !d.ownerId : d.ownerId === about);
  const matchesText = (d: FamilyDocument) => !query.trim() || `${d.title} ${d.fileName}`.toLowerCase().includes(query.trim().toLowerCase());
  const filtered = docs.filter((d) => (category === ALL || d.category === category) && matchesAbout(d) && matchesText(d));
  const totalKB = docs.reduce((sum, d) => sum + d.sizeKB, 0);
  const apptTitle = (id?: string) => appts.find((a) => a.id === id)?.title;

  const groupKey = (d: FamilyDocument) =>
    view === 'category' ? d.category : view === 'person' ? (d.ownerId ? personName(d.ownerId) : 'Household') : (apptTitle(d.appointmentId) ?? 'Not linked to a visit');
  const groups: [string, FamilyDocument[]][] =
    view === 'all'
      ? [['', filtered]]
      : Object.entries(
          filtered.reduce<Record<string, FamilyDocument[]>>((acc, d) => {
            (acc[groupKey(d)] ??= []).push(d);
            return acc;
          }, {}),
        );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setUploadFile(f);
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Reports, prescriptions and important papers, in one place."
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
                <p className="font-display text-lg">{plural(docs.length, 'document')} you can see</p>
                <p className="text-sm text-ink-muted">{formatSize(totalKB)} in total</p>
              </div>
            </div>
            <Badge tone="mint" size="md" className="gap-1">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Access is set per document
            </Badge>
          </Card>

          <div className="space-y-3">
            <Tabs
              label="Group documents"
              idPrefix="docs"
              value={view}
              onChange={setView}
              items={[
                { id: 'all', label: 'All' },
                { id: 'category', label: 'By category' },
                { id: 'person', label: 'By person' },
                { id: 'appointment', label: 'By appointment' },
              ]}
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
              <div>
                <label htmlFor="doc-search" className="sr-only">
                  Search documents
                </label>
                <Input id="doc-search" type="search" leftIcon={<Search />} placeholder="Search documents…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div>
                <label htmlFor="doc-category" className="sr-only">
                  Filter by category
                </label>
                <Select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value={ALL}>All categories</option>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="doc-about" className="sr-only">
                  Filter by who it is about
                </label>
                <Select id="doc-about" value={about} onChange={(e) => setAbout(e.target.value)}>
                  <option value={ALL}>About: everyone</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      About: {p.id === me?.id ? 'me' : p.name}
                    </option>
                  ))}
                  <option value={HOUSEHOLD}>About: the household</option>
                </Select>
              </div>
            </div>
          </div>

          <TabPanel idPrefix="docs" id={view}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<FolderLock aria-hidden="true" />}
                title={docs.length ? 'No documents match' : 'No documents yet'}
                description={docs.length ? 'Try a different search, category or person.' : 'Upload reports, prescriptions or letters so the right people can find them.'}
                action={!docs.length ? <Button onClick={() => setUploadFile(null)}>Upload a document</Button> : undefined}
              />
            ) : (
              <div className="space-y-6">
                {groups.map(([label, list]) => (
                  <section key={label || 'all'} aria-label={label || 'All documents'}>
                    {label && <h2 className="mb-2 font-display text-lg">{label}</h2>}
                    <Card padding="none">
                      <div
                        className={cn('hidden gap-3 border-b border-line bg-surface-muted/60 px-5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle md:grid', ROW_COLUMNS)}
                        aria-hidden="true"
                      >
                        <span>Document</span>
                        <span>Category</span>
                        <span>Added</span>
                        <span>Access</span>
                        <span className="w-8" />
                      </div>
                      <ul>
                        {list.map((d) => (
                          <DocumentRow key={d.id} doc={d} appointmentTitle={apptTitle(d.appointmentId)} onChangeAccess={() => setAccessDoc(d)} onDelete={() => setDeleteDoc(d)} />
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
            className={cn(
              'flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:flex-row sm:text-left',
              dragging ? 'border-primary-400 bg-primary-50' : 'border-line-strong bg-surface-muted/60',
            )}
          >
            <UploadCloud aria-hidden="true" className="h-8 w-8 text-primary-500" />
            <div className="flex-1">
              <p className="font-semibold text-ink">Drag & drop a file here</p>
              <p className="text-[0.8125rem] text-ink-muted">You’ll choose who it is about and who can open it.</p>
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

          <p className="flex items-center justify-center gap-2 text-[0.8125rem] text-ink-subtle">
            <Users aria-hidden="true" className="h-4 w-4" /> Restricted documents are only listed for the people who can open them.
          </p>
        </div>
      )}

      {uploadFile !== undefined && <UploadDialog onClose={() => setUploadFile(undefined)} initialFile={uploadFile} onUploaded={data.reload} />}
      {accessDoc && <AccessDialog doc={accessDoc} onClose={() => setAccessDoc(null)} onSaved={data.reload} />}
      <ConfirmDialog
        open={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        title="Delete this document?"
        description={deleteDoc ? `“${deleteDoc.title}” will be removed for everyone who can see it.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        loading={remove.pending}
        onConfirm={async () => {
          if (!deleteDoc) return;
          const ok = await remove.attempt(deleteDoc.id);
          toast(ok ? { title: 'Document deleted' } : { tone: 'error', title: 'Couldn’t delete the document', description: 'Please try again.' });
          setDeleteDoc(null);
          void data.reload();
        }}
      />
    </>
  );
}
