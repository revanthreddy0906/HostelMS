import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { TextField } from '../components/Form';
import { LoadingState } from '../components/Feedback';
import { settingsApi } from '../api/endpoints';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SECTIONS: { title: string; description: string; fields: { key: string; label: string; hint?: string; min?: number; max?: number }[] }[] = [
  {
    title: 'Rent and late fine',
    description: 'Rent is due on this day each month; the fine is added for every day after it until the bill is paid.',
    fields: [
      { key: 'rent_due_day', label: 'Rent due day of month', min: 1, max: 28 },
      { key: 'late_fine_per_day', label: 'Late fine per day (₹)', min: 0 },
      { key: 'security_deposit', label: 'Security deposit (₹)', hint: 'Raised once when a student is first allocated', min: 0 },
    ],
  },
  {
    title: 'Monthly rent by sharing type',
    description: 'Per student. Changing a sharing rent updates every room of that type; bills already raised keep their amount.',
    fields: [
      { key: 'rent_3_sharing', label: '3 Sharing (₹)', min: 0 },
      { key: 'rent_4_sharing', label: '4 Sharing (₹)', min: 0 },
      { key: 'rent_5_sharing', label: '5 Sharing (₹)', min: 0 },
      { key: 'rent_pentahouse', label: 'Pentahouse default (₹)', hint: 'Each Pentahouse room can have its own rent', min: 0 },
    ],
  },
  {
    title: 'AC electricity',
    description: 'Monthly AC bill = units consumed × this rate, split equally among the room’s occupants.',
    fields: [{ key: 'ac_rate_per_unit', label: 'Rate per unit (₹)', min: 0 }],
  },
];

export function SettingsPage() {
  const { showToast, showError } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .get()
      .then((r) => {
        setValues(r.values);
        setInitial(r.values);
      })
      .catch((err) => showError(err, 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, [showError]);

  const changed = Object.keys(values).filter((k) => values[k] !== initial[k]);
  const invalid = SECTIONS.flatMap((s) => s.fields).some((f) => {
    const n = Number(values[f.key]);
    return values[f.key] === '' || Number.isNaN(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max);
  });

  async function save() {
    setSaving(true);
    try {
      const r = await settingsApi.update(Object.fromEntries(changed.map((k) => [k, Number(values[k])])));
      setValues(r.values);
      setInitial(r.values);
      showToast('Settings saved.', 'success');
    } catch (err) {
      showError(err, 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Rent, fines, deposit and AC billing rates"
        actions={
          <Button onClick={save} loading={saving} disabled={!changed.length || invalid}>
            <Save /> Save changes
          </Button>
        }
      />
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((f) => (
              <div key={f.key}>
                <TextField
                  label={f.label}
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  error={
                    values[f.key] !== '' && ((f.min != null && Number(values[f.key]) < f.min) || (f.max != null && Number(values[f.key]) > f.max))
                      ? `Between ${f.min ?? 0} and ${f.max ?? '∞'}`
                      : undefined
                  }
                />
                {f.hint && <p className="-mt-3 mb-4 text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
