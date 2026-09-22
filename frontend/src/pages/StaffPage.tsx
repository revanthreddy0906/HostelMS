import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { SelectField, TextField } from '../components/Form';
import { hostelsApi, staffApi } from '../api/endpoints';
import type { Hostel, Staff, StaffCreate } from '../types';

const emptyForm: StaffCreate = {
  username: '',
  plain_password: '',
  fullname: '',
  designation: 'Security',
  assignedblock: 0,
  role: 'Staff',
};

export function StaffPage() {
  const { showToast, showError } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StaffCreate>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([staffApi.list(), hostelsApi.list()]);
      setStaff(s);
      setHostels(h);
    } catch (err) {
      showError(err, 'Failed to load staff.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm({ ...emptyForm, assignedblock: hostels[0]?.hostelid ?? 0 });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await staffApi.create(form);
      showToast('Staff account created.', 'success');
      setModalOpen(false);
      load();
    } catch (err) {
      showError(err, 'Failed to create staff account.');
    } finally {
      setSaving(false);
    }
  }

  function hostelName(id: number) {
    return hostels.find((h) => h.hostelid === id)?.hostelname ?? `#${id}`;
  }

  const columns: Column<Staff>[] = [
    { key: 'name', header: 'Name', render: (s) => s.fullname, sortValue: (s) => s.fullname },
    { key: 'designation', header: 'Designation', render: (s) => s.designation },
    { key: 'block', header: 'Assigned block', render: (s) => hostelName(s.assignedblock) },
  ];

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} staff/warden accounts`}
        actions={<Button onClick={openCreate}>+ Add staff</Button>}
      />
      <Card>
        <Table columns={columns} rows={staff} rowKey={(s) => s.staffid} loading={loading} />
      </Card>

      <Modal
        open={modalOpen}
        title="Add staff account"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <TextField
          label="Password"
          type="password"
          value={form.plain_password}
          onChange={(e) => setForm({ ...form, plain_password: e.target.value })}
        />
        <TextField label="Full name" value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
        <SelectField
          label="Login role"
          value={form.role ?? 'Staff'}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          options={[
            { value: 'Staff', label: 'Staff' },
            { value: 'Warden', label: 'Warden' },
          ]}
        />
        <SelectField
          label="Designation"
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
          options={[
            { value: 'Warden', label: 'Warden' },
            { value: 'Security', label: 'Security' },
            { value: 'Cleaner', label: 'Cleaner' },
            { value: 'Maintenance', label: 'Maintenance' },
            { value: 'Technician', label: 'Technician' },
          ]}
        />
        <SelectField
          label="Assigned block"
          value={String(form.assignedblock)}
          onChange={(e) => setForm({ ...form, assignedblock: Number(e.target.value) })}
          options={hostels.map((h) => ({ value: String(h.hostelid), label: h.hostelname }))}
        />
      </Modal>
    </div>
  );
}
