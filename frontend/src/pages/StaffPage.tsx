import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { SelectField, TextField } from '../components/Form';
import { PersonCell } from '../components/PersonCell';
import { FormSection } from '../components/FormSection';
import { hostelsApi, staffApi } from '../api/endpoints';
import type { Hostel, Staff, StaffCreate } from '../types';

const DESIGNATIONS = ['Warden', 'Security', 'Cleaner', 'Maintenance', 'Technician'];

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
  const [designationFilter, setDesignationFilter] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
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
      showToast(`${form.fullname} can now sign in as ${form.username}.`, 'success');
      setModalOpen(false);
      load();
    } catch (err) {
      showError(err, 'Failed to create staff account.');
    } finally {
      setSaving(false);
    }
  }

  const hostelName = (id: number) => hostels.find((h) => h.hostelid === id)?.hostelname ?? `Block #${id}`;
  const wardenOf = useMemo(() => new Map(hostels.filter((h) => h.wardenstaffid).map((h) => [h.wardenstaffid!, h.hostelname])), [hostels]);
  const rows = designationFilter ? staff.filter((s) => s.designation === designationFilter) : staff;

  const columns: Column<Staff>[] = [
    { key: 'name', header: 'Name', render: (s) => <PersonCell name={s.fullname} sub={s.designation} />, sortValue: (s) => s.fullname },
    { key: 'block', header: 'Assigned block', render: (s) => hostelName(s.assignedblock), sortValue: (s) => hostelName(s.assignedblock) },
    {
      key: 'warden',
      header: 'Warden of',
      render: (s) => wardenOf.get(s.staffid) ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={loading ? 'Loading…' : `${staff.length} wardens, security and maintenance staff`}
        actions={
          <Button onClick={openCreate} disabled={!hostels.length}>
            <Plus /> Add staff
          </Button>
        }
      />
      <Table
        columns={columns}
        rows={rows}
        rowKey={(s) => s.staffid}
        loading={loading}
        emptyMessage="No staff yet"
        emptyHint="Add wardens, security and maintenance staff so complaints and gate duties can be assigned."
        searchText={(s) => `${s.fullname} ${s.designation} ${hostelName(s.assignedblock)}`}
        searchPlaceholder="Search staff"
        toolbar={
          <SelectField
            label=""
            placeholder="All designations"
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            options={DESIGNATIONS.map((d) => ({ value: d, label: d }))}
            className="w-44"
          />
        }
      />

      <Modal
        open={modalOpen}
        title="Add staff member"
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} disabled={!form.username || !form.plain_password || !form.fullname || !form.assignedblock}>
              Create account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSection title="Person">
            <TextField label="Full name" value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
            <SelectField
              label="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value, role: e.target.value === 'Warden' ? 'Warden' : 'Staff' })}
              options={DESIGNATIONS.map((d) => ({ value: d, label: d }))}
            />
            <SelectField
              label="Assigned block"
              value={String(form.assignedblock)}
              onChange={(e) => setForm({ ...form, assignedblock: Number(e.target.value) })}
              options={hostels.map((h) => ({ value: String(h.hostelid), label: h.hostelname }))}
            />
          </FormSection>
          <FormSection
            title="Login"
            description={form.role === 'Warden' ? 'Signs in with the Warden workspace: approvals, roll call and block monitoring.' : 'Signs in with the Staff workspace: gate, visitors, roll call and assigned tickets.'}
          >
            <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
            <TextField
              label="Password"
              type="password"
              value={form.plain_password}
              onChange={(e) => setForm({ ...form, plain_password: e.target.value })}
              autoComplete="new-password"
            />
          </FormSection>
        </div>
      </Modal>
    </div>
  );
}
