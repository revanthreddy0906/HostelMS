import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { SelectField, TextField, TextareaField } from '../components/Form';
import { studentsApi } from '../api/endpoints';
import type { Student, StudentCreate, StudentSelfUpdate, CriticalChangeRequest } from '../types';

export function StudentsPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'Student') return <StudentSelfPage studentId={user.entity_id} />;
  return <StudentsAdminPage />;
}

const emptyForm: StudentCreate = {
  username: '',
  plain_password: '',
  rollnumber: '',
  firstname: '',
  lastname: '',
  gender: 'Male',
  contactphone: '',
  guardianphone: '',
  dateofbirth: '',
  emergencycontact: '',
  bloodgroup: '',
  medicalhistory: '',
};

function StudentsAdminPage() {
  const { showToast, showError } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentCreate>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Student | null>(null);

  async function load() {
    setLoading(true);
    try {
      setStudents(await studentsApi.list());
    } catch (err) {
      showError(err, 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({ ...emptyForm, ...s, plain_password: '' });
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await studentsApi.update(editing.studentid, form);
        showToast('Student updated.', 'success');
      } else {
        await studentsApi.create(form);
        showToast('Student created.', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showError(err, 'Failed to save student.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Student) {
    if (!confirm(`Delete student ${s.firstname} ${s.lastname}? This cannot be undone.`)) return;
    try {
      await studentsApi.remove(s.studentid);
      showToast('Student deleted.', 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to delete student.');
    }
  }

  const columns: Column<Student>[] = [
    { key: 'roll', header: 'Roll No.', render: (s) => s.rollnumber, sortValue: (s) => s.rollnumber },
    { key: 'name', header: 'Name', render: (s) => `${s.firstname} ${s.lastname}`, sortValue: (s) => s.firstname },
    { key: 'gender', header: 'Gender', render: (s) => s.gender },
    { key: 'phone', header: 'Contact', render: (s) => s.contactphone },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setProfile(s)}>
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => remove(s)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} students enrolled`}
        actions={<Button onClick={openCreate}>+ Add student</Button>}
      />
      <Card>
        <Table columns={columns} rows={students} rowKey={(s) => s.studentid} loading={loading} />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit student' : 'Add student'}
        onClose={() => setModalOpen(false)}
        wide
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
        <div className="grid grid-cols-2 gap-x-4">
          {!editing && (
            <>
              <TextField label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <TextField
                label="Password"
                type="password"
                value={form.plain_password}
                onChange={(e) => setForm({ ...form, plain_password: e.target.value })}
              />
            </>
          )}
          <TextField label="Roll number" value={form.rollnumber ?? ''} onChange={(e) => setForm({ ...form, rollnumber: e.target.value })} />
          <SelectField
            label="Gender"
            value={form.gender ?? ''}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
          />
          <TextField label="First name" value={form.firstname ?? ''} onChange={(e) => setForm({ ...form, firstname: e.target.value })} />
          <TextField label="Last name" value={form.lastname ?? ''} onChange={(e) => setForm({ ...form, lastname: e.target.value })} />
          <TextField label="Contact phone" value={form.contactphone ?? ''} onChange={(e) => setForm({ ...form, contactphone: e.target.value })} />
          <TextField label="Guardian phone" value={form.guardianphone ?? ''} onChange={(e) => setForm({ ...form, guardianphone: e.target.value })} />
          <TextField
            label="Date of birth"
            type="date"
            value={form.dateofbirth ?? ''}
            onChange={(e) => setForm({ ...form, dateofbirth: e.target.value })}
          />
          <TextField
            label="Blood group"
            value={form.bloodgroup ?? ''}
            onChange={(e) => setForm({ ...form, bloodgroup: e.target.value })}
          />
          <TextField
            label="Emergency contact"
            value={form.emergencycontact ?? ''}
            onChange={(e) => setForm({ ...form, emergencycontact: e.target.value })}
          />
          <div className="col-span-2">
            <TextareaField
              label="Medical history"
              value={form.medicalhistory ?? ''}
              onChange={(e) => setForm({ ...form, medicalhistory: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal open={!!profile} title="Student profile" onClose={() => setProfile(null)} wide>
        {profile && <ProfileView s={profile} onApprove={load} />}
      </Modal>
    </div>
  );
}

function ProfileView({ s, onApprove }: { s: Student; onApprove: () => void }) {
  const { showToast, showError } = useToast();
  const [field, setField] = useState('rollnumber');
  const [value, setValue] = useState('');
  const [applying, setApplying] = useState(false);

  async function approve() {
    setApplying(true);
    try {
      await studentsApi.approveChange(s.studentid, { [field]: value });
      showToast('Change approved and applied.', 'success');
      onApprove();
    } catch (err) {
      showError(err, 'Failed to apply change.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <Detail label="Name" value={`${s.firstname} ${s.lastname}`} />
        <Detail label="Roll number" value={s.rollnumber} />
        <Detail label="Gender" value={s.gender} />
        <Detail label="Date of birth" value={s.dateofbirth} />
        <Detail label="Contact phone" value={s.contactphone} />
        <Detail label="Guardian phone" value={s.guardianphone} />
        <Detail label="Blood group" value={s.bloodgroup || '—'} />
        <Detail label="Emergency contact" value={s.emergencycontact || '—'} />
      </dl>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Medical history</dt>
        <dd className="mt-1 text-neutral-700">{s.medicalhistory || 'None on file.'}</dd>
      </div>
      <div className="rounded-lg border border-warning-100 bg-warning-50 p-3">
        <p className="mb-2 text-xs font-semibold text-warning-700">
          Approve a pending critical-field change (roll number / name / gender / DOB)
        </p>
        <div className="flex gap-2">
          <SelectField
            label="Field"
            value={field}
            onChange={(e) => setField(e.target.value)}
            options={[
              { value: 'rollnumber', label: 'Roll number' },
              { value: 'firstname', label: 'First name' },
              { value: 'lastname', label: 'Last name' },
              { value: 'gender', label: 'Gender' },
              { value: 'dateofbirth', label: 'Date of birth' },
            ]}
          />
          <TextField label="New value" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button size="sm" onClick={approve} loading={applying} disabled={!value}>
          Approve change
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-neutral-700">{value}</dd>
    </div>
  );
}

function StudentSelfPage({ studentId }: { studentId: number | null }) {
  const { showToast, showError } = useToast();
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<StudentSelfUpdate>({});
  const [saving, setSaving] = useState(false);
  const [changeReq, setChangeReq] = useState<CriticalChangeRequest>({});
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await studentsApi.me();
        setProfile(p);
        setForm({
          contactphone: p.contactphone,
          guardianphone: p.guardianphone,
          emergencycontact: p.emergencycontact,
          bloodgroup: p.bloodgroup,
          medicalhistory: p.medicalhistory,
        });
      } catch (err) {
        showError(err, 'Failed to load your profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId, showError]);

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await studentsApi.updateMyProfile(form);
      setProfile(updated);
      showToast('Profile updated.', 'success');
    } catch (err) {
      showError(err, 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  async function submitChangeRequest() {
    setRequesting(true);
    try {
      await studentsApi.requestChange(changeReq);
      showToast('Change request submitted for admin approval.', 'success');
      setChangeReq({});
    } catch (err) {
      showError(err, 'Failed to submit change request.');
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!profile) return <EmptyState title="Profile unavailable" />;

  return (
    <div>
      <PageHeader title="My Profile" subtitle={`Roll number ${profile.rollnumber}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Editable details">
          <TextField label="Contact phone" value={form.contactphone ?? ''} onChange={(e) => setForm({ ...form, contactphone: e.target.value })} />
          <TextField label="Guardian phone" value={form.guardianphone ?? ''} onChange={(e) => setForm({ ...form, guardianphone: e.target.value })} />
          <TextField
            label="Emergency contact"
            value={form.emergencycontact ?? ''}
            onChange={(e) => setForm({ ...form, emergencycontact: e.target.value })}
          />
          <TextField label="Blood group" value={form.bloodgroup ?? ''} onChange={(e) => setForm({ ...form, bloodgroup: e.target.value })} />
          <TextareaField
            label="Medical history"
            value={form.medicalhistory ?? ''}
            onChange={(e) => setForm({ ...form, medicalhistory: e.target.value })}
          />
          <Button onClick={saveProfile} loading={saving}>
            Save changes
          </Button>
        </Card>

        <Card title="Request a critical-field change" className="h-fit">
          <p className="mb-3 text-xs text-neutral-500">
            Roll number, name, gender, and date of birth require admin approval. Fill only the field(s) you want changed.
          </p>
          <TextField
            label="Roll number"
            value={changeReq.rollnumber ?? ''}
            onChange={(e) => setChangeReq({ ...changeReq, rollnumber: e.target.value || null })}
          />
          <TextField
            label="First name"
            value={changeReq.firstname ?? ''}
            onChange={(e) => setChangeReq({ ...changeReq, firstname: e.target.value || null })}
          />
          <TextField
            label="Last name"
            value={changeReq.lastname ?? ''}
            onChange={(e) => setChangeReq({ ...changeReq, lastname: e.target.value || null })}
          />
          <SelectField
            label="Gender"
            value={changeReq.gender ?? ''}
            onChange={(e) => setChangeReq({ ...changeReq, gender: e.target.value || null })}
            placeholder="No change"
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
          />
          <TextField
            label="Date of birth"
            type="date"
            value={changeReq.dateofbirth ?? ''}
            onChange={(e) => setChangeReq({ ...changeReq, dateofbirth: e.target.value || null })}
          />
          <Button variant="secondary" onClick={submitChangeRequest} loading={requesting}>
            Submit request
          </Button>
        </Card>
      </div>
    </div>
  );
}
