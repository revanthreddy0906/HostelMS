import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { SelectField, TextField, TextareaField } from '../components/Form';
import { useConfirm } from '../components/ConfirmDialog';
import { RowActions } from '../components/RowActions';
import { PersonCell, initials } from '../components/PersonCell';
import { FormSection } from '../components/FormSection';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  const { confirm, dialog } = useConfirm();

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
    const ok = await confirm({
      title: `Delete ${s.firstname} ${s.lastname}?`,
      description: 'Their login, profile and records will be removed. This cannot be undone.',
      confirmLabel: 'Delete student',
      destructive: true,
    });
    if (!ok) return;
    try {
      await studentsApi.remove(s.studentid);
      showToast('Student deleted.', 'success');
      load();
    } catch (err) {
      showError(err, 'Failed to delete student.');
    }
  }

  const columns: Column<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      render: (s) => <PersonCell name={`${s.firstname} ${s.lastname}`} sub={s.rollnumber} />,
      sortValue: (s) => `${s.firstname} ${s.lastname}`,
    },
    { key: 'gender', header: 'Gender', render: (s) => s.gender, sortValue: (s) => s.gender },
    { key: 'phone', header: 'Contact', render: (s) => s.contactphone },
    { key: 'guardian', header: 'Guardian', render: (s) => s.guardianphone },
    { key: 'blood', header: 'Blood group', render: (s) => s.bloodgroup || <span className="text-muted-foreground">—</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (s) => (
        <RowActions
          label={`Actions for ${s.firstname} ${s.lastname}`}
          actions={[
            { label: 'View profile', icon: Eye, onSelect: () => setProfile(s) },
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(s) },
            { label: 'Delete', icon: Trash2, onSelect: () => remove(s), destructive: true },
          ]}
        />
      ),
    },
  ];

  const set = (patch: Partial<StudentCreate>) => setForm({ ...form, ...patch });

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={loading ? 'Loading residents…' : `${students.length} residents enrolled`}
        actions={
          <Button onClick={openCreate}>
            <Plus /> Add student
          </Button>
        }
      />
      <Table
        columns={columns}
        rows={students}
        rowKey={(s) => s.studentid}
        loading={loading}
        emptyMessage="No students yet"
        emptyHint="Add a student to create their login and resident profile."
        searchText={(s) => `${s.firstname} ${s.lastname} ${s.rollnumber} ${s.contactphone} ${s.guardianphone}`}
        searchPlaceholder="Search by name, roll no. or phone"
      />

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.firstname} ${editing.lastname}` : 'Add student'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? 'Save changes' : 'Create student'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <FormSection title="Login" description="The student signs in with these credentials.">
              <TextField label="Username" value={form.username} onChange={(e) => set({ username: e.target.value })} autoComplete="off" />
              <TextField
                label="Password"
                type="password"
                value={form.plain_password}
                onChange={(e) => set({ plain_password: e.target.value })}
                autoComplete="new-password"
              />
            </FormSection>
          )}
          <FormSection title="Personal">
            <TextField label="First name" value={form.firstname ?? ''} onChange={(e) => set({ firstname: e.target.value })} />
            <TextField label="Last name" value={form.lastname ?? ''} onChange={(e) => set({ lastname: e.target.value })} />
            <TextField label="Roll number" value={form.rollnumber ?? ''} onChange={(e) => set({ rollnumber: e.target.value })} />
            <SelectField
              label="Gender"
              value={form.gender ?? ''}
              onChange={(e) => set({ gender: e.target.value })}
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
              ]}
            />
            <TextField label="Date of birth" type="date" value={form.dateofbirth ?? ''} onChange={(e) => set({ dateofbirth: e.target.value })} />
          </FormSection>
          <FormSection title="Contact">
            <TextField label="Contact phone" type="tel" value={form.contactphone ?? ''} onChange={(e) => set({ contactphone: e.target.value })} />
            <TextField label="Guardian phone" type="tel" value={form.guardianphone ?? ''} onChange={(e) => set({ guardianphone: e.target.value })} />
            <TextField label="Emergency contact" value={form.emergencycontact ?? ''} onChange={(e) => set({ emergencycontact: e.target.value })} />
          </FormSection>
          <FormSection title="Medical">
            <TextField label="Blood group" value={form.bloodgroup ?? ''} onChange={(e) => set({ bloodgroup: e.target.value })} />
            <div className="sm:col-span-2">
              <TextareaField label="Medical history" value={form.medicalhistory ?? ''} onChange={(e) => set({ medicalhistory: e.target.value })} />
            </div>
          </FormSection>
        </div>
      </Modal>

      <Modal open={!!profile} title="Student profile" onClose={() => setProfile(null)} wide>
        {profile && <ProfileView s={profile} onApprove={load} />}
      </Modal>
      {dialog}
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

  const name = `${s.firstname} ${s.lastname}`;
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarFallback className="bg-primary/10 font-medium text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-base font-semibold">{name}</div>
          <div className="text-muted-foreground">
            {s.rollnumber} · {s.gender}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border p-4">
        <Detail label="Date of birth" value={s.dateofbirth} />
        <Detail label="Blood group" value={s.bloodgroup || '—'} />
        <Detail label="Contact phone" value={s.contactphone} />
        <Detail label="Guardian phone" value={s.guardianphone} />
        <Detail label="Emergency contact" value={s.emergencycontact || '—'} />
        <div className="col-span-2">
          <Detail label="Medical history" value={s.medicalhistory || 'None on file.'} />
        </div>
      </dl>
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <div className="mb-3 flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900">Apply an approved critical-field change</p>
            <p className="text-xs text-amber-800">Roll number, name, gender and date of birth change only with admin approval.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
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
      <PageHeader title="My profile" subtitle={`${profile.firstname} ${profile.lastname} · ${profile.rollnumber}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Contact and medical details" description="You can update these any time.">
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

        <Card
          title="Request a correction"
          description="Roll number, name, gender and date of birth change only after admin approval. Fill in just the fields to correct."
          className="h-fit"
        >
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
