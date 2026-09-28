import { useEffect, useState } from 'react';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { TextField, TextareaField } from '../components/Form';
import { EmptyState, LoadingState } from '../components/Feedback';
import { useConfirm } from '../components/ConfirmDialog';
import { announcementsApi } from '../api/endpoints';
import type { Announcement } from '../types';
import { serverTime } from '@/lib/time';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function NoticeList({ items, onDelete }: { items: Announcement[]; onDelete?: (a: Announcement) => void }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.announcementid} className={cn('rounded-lg border bg-background p-4', a.pinned && 'border-primary/30 bg-primary/5')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {a.pinned && <Pin className="size-3.5 text-primary" aria-label="Pinned" />}
                {a.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {serverTime(a.createdat).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(a)} aria-label={`Delete ${a.title}`}>
                <Trash2 />
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function NoticesPage() {
  const { user } = useAuth();
  const canPost = user?.role === 'Admin' || user?.role === 'Warden';
  const { showToast, showError } = useToast();
  const { confirm, dialog } = useConfirm();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setItems(await announcementsApi.list());
    } catch (err) {
      showError(err, 'Failed to load notices.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post() {
    setSaving(true);
    try {
      await announcementsApi.create(form.title, form.body, form.pinned);
      showToast('Notice posted.', 'success');
      setOpen(false);
      setForm({ title: '', body: '', pinned: false });
      load();
    } catch (err) {
      showError(err, 'Failed to post.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Announcement) {
    if (!(await confirm({ title: `Delete “${a.title}”?`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await announcementsApi.remove(a.announcementid);
      setItems((prev) => prev.filter((x) => x.announcementid !== a.announcementid));
      showToast('Notice deleted.', 'success');
    } catch (err) {
      showError(err, 'Failed to delete.');
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notice board"
        subtitle="Hostel announcements and information"
        actions={
          canPost ? (
            <Button onClick={() => setOpen(true)}>
              <Plus /> Post notice
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No notices" hint={canPost ? 'Post rent reminders, maintenance shutdowns and hostel news here.' : 'Announcements from the office will appear here.'} />
        </Card>
      ) : (
        <NoticeList items={items} onDelete={canPost ? remove : undefined} />
      )}

      <Modal
        open={open}
        title="Post a notice"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={post} loading={saving} disabled={!form.title.trim() || !form.body.trim()}>
              <Megaphone /> Post
            </Button>
          </>
        }
      >
        <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <TextareaField label="Message" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
          Pin to the top
        </label>
      </Modal>
      {dialog}
    </div>
  );
}
