// doctorDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Users, ClipboardCheck, Inbox, CalendarCheck, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useAlert } from '../../context/AlertContext';
import { visitLabel, localDateStr, time12, initials, fullName } from '../../utils/visitPurpose';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/doctor/DoctorDashboard.css';

const API = 'http://localhost:3001';

const PURPOSE_COLORS = {
    'General Check Up': '#004b87',
    Dental: '#ffcc00',
    Vision: '#22a06b',
    Other: '#8b5cf6',
    'Follow-up': '#94a3b8',
    Referral: '#f97316'
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DoctorArt = () => (
    <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="112" r="96" fill="rgba(255,255,255,0.08)" />
        <path d="M34 220 C34 160 68 140 110 140 C152 140 186 160 186 220 Z" fill="#ffffff" />
        <path d="M94 140 L110 178 L126 140 Z" fill="#ffcc00" />
        <path d="M78 146 C66 190 102 200 110 178" stroke="#00205b" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="110" cy="180" r="7" fill="#ffcc00" stroke="#00205b" strokeWidth="3" />
        <rect x="100" y="116" width="20" height="28" rx="8" fill="#f1c3a0" />
        <path d="M80 98 C72 124 80 138 92 141 L90 104 Z" fill="#1a2b4c" />
        <path d="M140 98 C148 124 140 138 128 141 L130 104 Z" fill="#1a2b4c" />
        <circle cx="110" cy="94" r="31" fill="#f6d3b3" />
        <path d="M78 94 C72 52 148 52 142 94 C138 72 124 66 110 66 C96 66 82 72 78 94 Z" fill="#1a2b4c" />
        <circle cx="99" cy="98" r="8" fill="none" stroke="#00205b" strokeWidth="2.5" />
        <circle cx="121" cy="98" r="8" fill="none" stroke="#00205b" strokeWidth="2.5" />
        <path d="M107 98 H113" stroke="#00205b" strokeWidth="2.5" />
        <path d="M100 111 Q110 120 120 111" stroke="#b5533c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
);

const MonthCalendar = ({ month, selected, calendar, absences, onSelect, onMonth }) => {
    const [y, m] = month.split('-').map(Number);
    const today = localDateStr();
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const lead = first.getDay();
    const cells = [];
    const prevDays = new Date(y, m - 1, 0).getDate();
    for (let i = lead - 1; i >= 0; i--) cells.push({ key: `p${i}`, day: prevDays - i, muted: true });
    for (let d = 1; d <= daysInMonth; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        const off = absences.some((a) => !a.start_time && a.start_date <= date && a.end_date >= date);
        cells.push({ key: date, day: d, date, off });
    }
    for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ key: `n${d}`, day: d, muted: true });

    return (
        <div className="dd-cal-body">
            <div className="dd-cal-nav">
                <strong>{MONTHS[m - 1]}, {y}</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => onMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
                    <button type="button" onClick={() => onMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
                </div>
            </div>
            <div className="dd-cal-grid" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`}>
                {DOW.map((d, i) => <div key={i} className="dd-cal-dow">{d}</div>)}
                {cells.map((c) => c.muted ? (
                    <span key={c.key} className="dd-cal-day muted" aria-hidden="true">{c.day}</span>
                ) : (
                    <button
                        key={c.key}
                        type="button"
                        className={`dd-cal-day ${c.date === today ? 'today' : ''} ${c.date === selected ? 'selected' : ''} ${calendar[c.date] ? 'has' : ''} ${c.off ? 'off' : ''}`}
                        onClick={() => onSelect(c.date)}
                        aria-label={`${MONTHS[m - 1]} ${c.day}${calendar[c.date] ? `, ${calendar[c.date]} appointments` : ''}${c.off ? ', unavailable' : ''}`}
                        aria-pressed={c.date === selected}
                    >
                        {c.day}
                    </button>
                ))}
            </div>
            <div className="dd-cal-key">
                <span><i style={{ background: 'var(--sti-yellow)' }} />Has appointments</span>
                <span><i style={{ background: 'rgba(239,68,68,0.5)' }} />Unavailable</span>
            </div>
        </div>
    );
};

const DoctorDashboard = () => {
    const { doctor, doctorId } = useOutletContext();
    const { showAlert } = useAlert();
    const navigate = useNavigate();

    const [range, setRange] = useState('week');
    const [month, setMonth] = useState(localDateStr().slice(0, 7));
    const [selected, setSelected] = useState(localDateStr());
    const [data, setData] = useState(null);
    const [dayList, setDayList] = useState([]);
    const [dayLoading, setDayLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/dashboard?range=${range}&month=${month}`);
            const json = await res.json();
            if (json.success) setData(json);
            else showAlert(json.message || 'Could not load the dashboard.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        }
    }, [doctorId, range, month, showAlert]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        let live = true;
        setDayLoading(true);
        fetch(`${API}/api/doctor/${doctorId}/appointments?scope=all&from=${selected}&to=${selected}&pageSize=30`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setDayList(d.appointments.filter((a) => !['Cancelled', 'Declined'].includes(a.status))); })
            .catch(() => {})
            .finally(() => { if (live) setDayLoading(false); });
        return () => { live = false; };
    }, [doctorId, selected]);

    const shiftMonth = (delta) => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setMonth(next);
        setSelected(`${next}-01`);
    };

    const totals = data?.totals || {};
    const purposes = useMemo(() => (data?.purposes || []).filter((p) => p.count > 0), [data]);
    const purposeTotal = purposes.reduce((n, p) => n + p.count, 0);
    const isToday = selected === localDateStr();

    return (
        <div className="dd-grid">
            <div className="dd-col">
                <section className="dd-banner" aria-label="Welcome">
                    <span className="dd-spark" style={{ top: 22, right: 230 }}>✦</span>
                    <span className="dd-spark" style={{ bottom: 26, right: 60, fontSize: '0.8rem' }}>✦</span>
                    <div className="dd-banner-text">
                        <small>Welcome back,</small>
                        <h2>Dr. {doctor.first_name} {doctor.last_name}</h2>
                        <span className="spec">{doctor.specialization || 'Physician'} - STI College Baliuag Clinic</span>
                        <p>
                            {totals.today_total > 0
                                ? <>You have total <b>{totals.today_total} appointment{totals.today_total === 1 ? '' : 's'}</b> today{totals.today_remaining > 0 ? ` (${totals.today_remaining} still to see)` : ''}!</>
                                : <>You have <b>no appointments</b> today.</>}
                            {totals.pending_requests > 0 && <> <b>{totals.pending_requests}</b> booking request{totals.pending_requests === 1 ? ' is' : 's are'} waiting.</>}
                        </p>
                    </div>
                    <div className="dd-art"><DoctorArt /></div>
                </section>

                <section className="dp-card" aria-label="Report">
                    <div className="dd-report-head"><h3>Report</h3></div>
                    <div className="dd-stats">
                        <button type="button" className="dd-stat blue" onClick={() => navigate('/DoctorPatients')}>
                            <span className="lbl"><Users size={16} /> Total Patients</span>
                            <span className="num">{totals.patients ?? '-'}</span>
                            <span className="sub">seen by you</span>
                        </button>
                        <button type="button" className="dd-stat yellow" onClick={() => navigate('/DoctorConsultations')}>
                            <span className="lbl"><ClipboardCheck size={16} /> Consultations</span>
                            <span className="num">{totals.consultations_month ?? '-'}</span>
                            <span className="sub">this month ({totals.consultations ?? 0} in total)</span>
                        </button>
                        <button type="button" className="dd-stat rose" onClick={() => navigate('/DoctorAppointments?tab=requests')}>
                            <span className="lbl"><Inbox size={16} /> Requests</span>
                            <span className="num">{totals.pending_requests ?? '-'}</span>
                            <span className="sub">waiting for approval</span>
                        </button>
                        <button type="button" className="dd-stat green" onClick={() => navigate('/DoctorAppointments?tab=today')}>
                            <span className="lbl"><CalendarCheck size={16} /> Today</span>
                            <span className="num">{totals.today_total ?? '-'}</span>
                            <span className="sub">{totals.today_remaining ?? 0} remaining</span>
                        </button>
                    </div>
                </section>

                <div className="dd-charts">
                    <section className="dp-card" aria-label="Appointments chart">
                        <div className="dd-chart-head">
                            <h3>Appointments</h3>
                            <select className="dp-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Chart range">
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>
                        <div className="dd-chart-box">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data?.series || []} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                                    <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: 'currentColor' }} tickLine={false} axisLine={false} interval={range === 'month' ? 2 : 0} />
                                    <YAxis tick={{ fill: 'currentColor' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                    <Line type="monotone" dataKey="appointments" name="Appointments" stroke="#004b87" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#22a06b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="dd-legend"><span><i style={{ background: '#004b87' }} />Appointments</span><span><i style={{ background: '#22a06b' }} />Completed</span></div>
                    </section>

                    <section className="dp-card" aria-label="Visit purposes">
                        <div className="dd-chart-head"><h3>Visit purposes</h3></div>
                        {purposeTotal === 0 ? (
                            <div className="dd-empty">No visits yet.</div>
                        ) : (
                            <>
                                <div className="dd-donut">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={purposes} dataKey="count" nameKey="visit_type" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                                                {purposes.map((p) => <Cell key={p.visit_type} fill={PURPOSE_COLORS[p.visit_type] || '#94a3b8'} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mid"><b>{purposeTotal}</b><span>Total</span></div>
                                </div>
                                <div className="dd-legend">
                                    {purposes.map((p) => <span key={p.visit_type}><i style={{ background: PURPOSE_COLORS[p.visit_type] || '#94a3b8' }} />{p.visit_type} ({p.count})</span>)}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>

            <div className="dd-col">
                <section className="dp-card dd-cal" aria-label="Your appointments calendar">
                    <h3 className="dd-cal-title">Your Appointments</h3>
                    <MonthCalendar
                        month={month}
                        selected={selected}
                        calendar={data?.calendar || {}}
                        absences={data?.absences || []}
                        onSelect={setSelected}
                        onMonth={shiftMonth}
                    />
                </section>

                <section aria-label={isToday ? "Today's appointments" : 'Appointments of the selected day'}>
                    <div className="dd-appts">
                        {dayLoading ? (
                            <div className="dp-card dd-empty">Loading...</div>
                        ) : dayList.length === 0 ? (
                            <div className="dp-card dd-empty">No appointments {isToday ? 'today' : 'on this day'}.</div>
                        ) : dayList.map((a) => (
                            <div key={`${a.appointment_id}-${a.student_id}`} className="dd-appt">
                                <span className="av">{initials(a.student_first_name, a.student_last_name)}</span>
                                <div className="who">
                                    <strong>{fullName(a.student_first_name, a.student_last_name)}</strong>
                                    <span>{time12(a.start_time)} - {time12(a.end_time)} - {visitLabel(a.visit_type, a.purpose_other)}{a.status === 'Waiting for Approval' ? ' (pending)' : ''}</span>
                                </div>
                                <button type="button" className="go" onClick={() => navigate(`/DoctorAppointments?tab=all&focus=${a.appointment_id}`)} aria-label={`Open the appointment of ${a.student_first_name}`}><ChevronRight size={16} /></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" className="dp-btn dp-btn-ghost dd-view-all" onClick={() => navigate('/DoctorAppointments')}>View All Appointments <ArrowRight size={16} /></button>
                </section>
            </div>
        </div>
    );
};

export default DoctorDashboard;
