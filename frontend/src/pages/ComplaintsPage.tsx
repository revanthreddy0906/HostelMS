import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import { SelectField, TextField, TextareaField } from '../components/Form';
import { complaintsApi } from '../api/endpoints';
import type { Complaint } from '../types';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];

export function ComplaintsPage() {
  const { user } = useAuth();
  const { showToast, showError } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ category: '', description: '' });
  const [saving, setSaving] = useState(false);

  const canManage = user?.role === 'Admin' || user?.role === 'Warden' || user?.role === 'Staff';
  const canCreate = user?.role === 'Student';

  async function load() {
    setLoading(true);
    try {
      setComplaints(canManage ? await complaintsApi.list() : await complaintsApi.me());
    } catch (err) {
      showError(err, 'Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setSaving(true);
    try {
      await complaintsApi.create(form.category, form.description);
      showToast('Complaint registered.', 'success');
      setCreateModal(false);
      setForm({ category: '', description: '' });
      load();
    } catch (err) {
      showError(err, 'Failed to register complaint.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(c: Complaint, status: string) {
    try {
      await complaintsApi.setStatus(c.complaintid, status);
      showToast(`Complaint marked ${status}.`, 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to update complaint status.');
    }
  }

  const columns: Column<Complaint>[] = [
    { key: 'category', header: 'Category', render: (c) => c.category },
    { key: 'desc', header: 'Description', render: (c) => <span className="line-clamp-2 max-w-xs">{c.description}</span> },
    { key: 'created', header: 'Created', render: (c) => new Date(c.createdat).toLocaleString(), sortValue: (c) => c.createdat },
    { key: 'assigned', header: 'Assigned staff', render: (c) => c.assignedstaffid ?? '—' },
    { key: 'status', header: 'Status', render: (c) => <Badge status={c.status} /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            render: (c: Complaint) => (
              <SelectField
                label=""
                value={c.status}
                onChange={(e) => setStatus(c, e.target.value)}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                className="!py-1"
              />
            ),
          } as Column<Complaint>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Complaints"
        subtitle={canManage ? 'All registered complaints' : 'Your complaints'}
        actions={canCreate ? <Button onClick={() => setCreateModal(true)}>+ Register complaint</Button> : undefined}
      />
      <Card>
        <Table columns={columns} rows={complaints} rowKey={(c) => c.complaintid} loading={loading} />
      </Card>

      <Modal
        open={createModal}
        title="Register a complaint"
        onClose={() => setCreateModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} disabled={!form.category || !form.description}>
              Submit
            </Button>
          </>
        }
      >
        <TextField label="Category" placeholder="e.g. Electrical, Plumbing, Cleaning" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <TextareaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Modal>
    </div>
  );
}
