import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Plus, RefreshCw, Trash2, UserX } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface WeeklyEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
}

interface Doctor {
  id: string;
  fullName: string;
}

interface Leave {
  id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason?: string | null;
  status: string;
  doctor?: { fullName: string };
}

function defaultWeekly(): WeeklyEntry[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    slotMinutes: 30,
    isActive: true,
  }));
}

export function CrmSchedulePage() {
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState('');
  const [tab, setTab] = useState<'weekly' | 'slots' | 'leaves'>('weekly');
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [weekly, setWeekly] = useState<WeeklyEntry[]>(defaultWeekly());
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', type: 'CASUAL', reason: '' });
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  const doctorsQuery = useQuery({ queryKey: ['crm-doctors'], queryFn: () => api.get('/doctors?limit=100') });
  const doctors = (doctorsQuery.data?.data as Doctor[] | undefined) ?? [];

  const weeklyQuery = useQuery({
    queryKey: ['crm-weekly-schedule', doctorId],
    queryFn: () => api.get<WeeklyEntry[]>(`/crm/doctors/${doctorId}/weekly-schedule`),
    enabled: !!doctorId,
  });

  const slotsQuery = useQuery({
    queryKey: ['crm-slots', doctorId],
    queryFn: () => api.get(`/crm/slots?doctorId=${doctorId}`),
    enabled: !!doctorId && tab === 'slots',
  });

  const leavesQuery = useQuery({
    queryKey: ['crm-leaves', doctorId],
    queryFn: () => api.get<Leave[]>(`/crm/doctors/${doctorId}/leaves`),
    enabled: !!doctorId && tab === 'leaves',
  });

  const orgLeavesQuery = useQuery({
    queryKey: ['crm-org-leaves'],
    queryFn: () => api.get<Leave[]>('/crm/leaves?status=PENDING'),
    enabled: tab === 'leaves',
  });

  const loadedWeekly = weeklyQuery.data?.data;
  const activeWeekly = useMemo(() => {
    if (loadedWeekly && loadedWeekly.length > 0) return loadedWeekly;
    return weekly;
  }, [loadedWeekly, weekly]);

  const slots = (slotsQuery.data?.data as Record<string, unknown>[]) || [];
  const leaves = (leavesQuery.data?.data as Leave[] | undefined) ?? [];
  const pendingLeaves = (orgLeavesQuery.data?.data as Leave[] | undefined) ?? [];

  const updateDay = (dayOfWeek: number, patch: Partial<WeeklyEntry>) => {
    setWeekly((prev) => {
      const base = loadedWeekly && loadedWeekly.length > 0 ? [...loadedWeekly] : [...prev];
      const idx = base.findIndex((e) => e.dayOfWeek === dayOfWeek);
      if (idx >= 0) base[idx] = { ...base[idx], ...patch };
      else base.push({ dayOfWeek, startTime: '09:00', endTime: '17:00', slotMinutes: 30, isActive: true, ...patch });
      return base.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
  };

  const saveWeekly = async () => {
    if (!doctorId) return;
    setSaving(true);
    setMsg('');
    try {
      const entries = activeWeekly.filter((e) => e.isActive);
      const res = await api.put(`/crm/doctors/${doctorId}/weekly-schedule`, { entries });
      if (!res.success) throw new Error(res.error || 'Save failed');
      setMsg('Weekly schedule saved');
      qc.invalidateQueries({ queryKey: ['crm-weekly-schedule', doctorId] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const generateSlots = async () => {
    if (!doctorId) return;
    setGenerating(true);
    setMsg('');
    try {
      const res = await api.post(`/crm/doctors/${doctorId}/generate-slots`, { fromDate, toDate });
      if (!res.success) throw new Error(res.error || 'Generation failed');
      const data = res.data as { created: number; skipped: number };
      setMsg(`Generated ${data.created} slots (${data.skipped} skipped)`);
      qc.invalidateQueries({ queryKey: ['crm-slots', doctorId] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const deleteSlot = async (id: string) => {
    const res = await api.delete(`/crm/slots/${id}`);
    if (!res.success) {
      setMsg(res.error || 'Delete failed');
      return;
    }
    qc.invalidateQueries({ queryKey: ['crm-slots', doctorId] });
  };

  const submitLeave = async () => {
    if (!doctorId) return;
    const res = await api.post(`/crm/doctors/${doctorId}/leaves`, leaveForm);
    if (!res.success) {
      setMsg(res.error || 'Leave request failed');
      return;
    }
    setShowLeaveForm(false);
    setLeaveForm({ startDate: '', endDate: '', type: 'CASUAL', reason: '' });
    qc.invalidateQueries({ queryKey: ['crm-leaves', doctorId] });
    qc.invalidateQueries({ queryKey: ['crm-org-leaves'] });
    qc.invalidateQueries({ queryKey: ['crm-doctor-stats'] });
  };

  const updateLeaveStatus = async (id: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED') => {
    const res = await api.patch(`/crm/leaves/${id}`, { status });
    if (!res.success) {
      setMsg(res.error || 'Update failed');
      return;
    }
    qc.invalidateQueries({ queryKey: ['crm-leaves', doctorId] });
    qc.invalidateQueries({ queryKey: ['crm-org-leaves'] });
    qc.invalidateQueries({ queryKey: ['crm-doctor-stats'] });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Doctor Schedule" subtitle="Weekly availability, slot generation, and leave management" />

      <div className="card mb-4 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Doctor</label>
        <select className="input max-w-md" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">Choose a doctor...</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
        </select>
      </div>

      {msg && <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">{msg}</div>}

      {doctorId && (
        <>
          <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
            {(['weekly', 'slots', 'leaves'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-4 py-2 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-800')}>
                {t === 'weekly' ? 'Weekly Schedule' : t}
              </button>
            ))}
          </div>

          {tab === 'weekly' && (
            <div className="space-y-4">
              {weeklyQuery.isLoading ? <LoadingState /> : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Day</th>
                        <th className="px-4 py-3">Active</th>
                        <th className="px-4 py-3">Start</th>
                        <th className="px-4 py-3">End</th>
                        <th className="px-4 py-3">Slot (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day, dayOfWeek) => {
                        const entry = activeWeekly.find((e) => e.dayOfWeek === dayOfWeek) || {
                          dayOfWeek, startTime: '09:00', endTime: '17:00', slotMinutes: 30, isActive: false,
                        };
                        return (
                          <tr key={day} className="border-t border-gray-100">
                            <td className="px-4 py-3 font-medium">{day}</td>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={entry.isActive}
                                onChange={(e) => updateDay(dayOfWeek, { isActive: e.target.checked })} />
                            </td>
                            <td className="px-4 py-3">
                              <input type="time" className="input py-1" value={entry.startTime} disabled={!entry.isActive}
                                onChange={(e) => updateDay(dayOfWeek, { startTime: e.target.value })} />
                            </td>
                            <td className="px-4 py-3">
                              <input type="time" className="input py-1" value={entry.endTime} disabled={!entry.isActive}
                                onChange={(e) => updateDay(dayOfWeek, { endTime: e.target.value })} />
                            </td>
                            <td className="px-4 py-3">
                              <select className="input py-1" value={entry.slotMinutes} disabled={!entry.isActive}
                                onChange={(e) => updateDay(dayOfWeek, { slotMinutes: Number(e.target.value) })}>
                                {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button className="btn-primary text-sm" onClick={saveWeekly} disabled={saving}>
                  <Clock className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Weekly Schedule'}
                </button>
              </div>

              <div className="card p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Generate Appointment Slots</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                  <button className="btn-primary text-sm" onClick={generateSlots} disabled={generating}>
                    <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
                    {generating ? 'Generating...' : 'Generate Slots'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">Slots are created from the weekly schedule. Approved leave days are skipped automatically.</p>
              </div>
            </div>
          )}

          {tab === 'slots' && (
            slotsQuery.isLoading ? <LoadingState /> : (
              <AdminTable columns={[
                { key: 'date', label: 'Date', render: (r) => formatDate(String(r.date)) },
                { key: 'startTime', label: 'Start' },
                { key: 'endTime', label: 'End' },
                { key: 'isBooked', label: 'Status', render: (r) => <StatusBadge status={r.isBooked ? 'BOOKED' : 'AVAILABLE'} /> },
                {
                  key: 'actions', label: '', render: (r) => !r.isBooked ? (
                    <button className="text-red-600 hover:underline text-xs inline-flex items-center gap-1"
                      onClick={() => deleteSlot(String(r.id))}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  ) : null,
                },
              ]} rows={slots} emptyMessage="No slots configured — save a weekly schedule and generate slots" />
            )
          )}

          {tab === 'leaves' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2"><UserX className="h-4 w-4" /> Leave Records</h3>
                <button className="btn-primary text-sm" onClick={() => setShowLeaveForm(true)}><Plus className="h-4 w-4" /> Add Leave</button>
              </div>

              {pendingLeaves.length > 0 && (
                <div className="card p-4 border-amber-200 bg-amber-50">
                  <p className="text-sm font-medium text-amber-800 mb-2">{pendingLeaves.length} pending leave request(s)</p>
                  <div className="space-y-2">
                    {pendingLeaves.map((l) => (
                      <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-white rounded-lg p-3 border">
                        <span>{l.doctor?.fullName || 'Doctor'} — {formatDate(l.startDate)} to {formatDate(l.endDate)} ({l.type})</span>
                        <div className="flex gap-2">
                          <button className="text-xs text-green-600 font-medium hover:underline" onClick={() => updateLeaveStatus(l.id, 'APPROVED')}>Approve</button>
                          <button className="text-xs text-red-600 font-medium hover:underline" onClick={() => updateLeaveStatus(l.id, 'REJECTED')}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {leavesQuery.isLoading ? <LoadingState /> : (
                <AdminTable columns={[
                  { key: 'startDate', label: 'From', render: (r) => formatDate(String(r.startDate)) },
                  { key: 'endDate', label: 'To', render: (r) => formatDate(String(r.endDate)) },
                  { key: 'type', label: 'Type' },
                  { key: 'reason', label: 'Reason', render: (r) => String(r.reason || '—') },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
                  {
                    key: 'actions', label: '', render: (r) => r.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button className="text-xs text-green-600 hover:underline" onClick={() => updateLeaveStatus(String(r.id), 'APPROVED')}>Approve</button>
                        <button className="text-xs text-red-600 hover:underline" onClick={() => updateLeaveStatus(String(r.id), 'REJECTED')}>Reject</button>
                      </div>
                    ) : r.status === 'APPROVED' ? (
                      <button className="text-xs text-gray-600 hover:underline" onClick={() => updateLeaveStatus(String(r.id), 'CANCELLED')}>Cancel</button>
                    ) : null,
                  },
                ]} rows={leaves as unknown as Record<string, unknown>[]} emptyMessage="No leave records" />
              )}

              {showLeaveForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="card w-full max-w-md p-6">
                    <h3 className="font-semibold mb-4">Add Leave</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                        <input type="date" className="input w-full" value={leaveForm.startDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">End Date</label>
                        <input type="date" className="input w-full" value={leaveForm.endDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select className="input w-full" value={leaveForm.type}
                          onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}>
                          {['SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Reason</label>
                        <textarea className="input w-full" rows={2} value={leaveForm.reason}
                          onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button className="btn-secondary text-sm" onClick={() => setShowLeaveForm(false)}>Cancel</button>
                      <button className="btn-primary text-sm" onClick={submitLeave}
                        disabled={!leaveForm.startDate || !leaveForm.endDate}>Submit</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
