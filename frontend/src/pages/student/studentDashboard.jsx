import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Library,
  Activity,
  ClipboardList,
  FileText,
  Stethoscope,
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  Megaphone,
  Radio,
  CalendarDays,
  Pill,
  CheckCircle2,
  Clock,
  MapPin
} from 'lucide-react';
import HealthTipsModal from '../../components/student/HealthTips';
import MyQueue from '../../components/student/MyQueue';
import QueueStatus, { QueuePill } from '../../components/student/QueueStatus';
import DashboardCalendar, { todayKey } from '../../components/student/DashboardCalendar';
import { useQueueStatus } from '../../hooks/useQueueStatus';
import { formatDate as formatDateBase, formatDateTime as formatDateTimeBase, formatTime as formatTimeBase, formatCurrentDate } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';
import { to12h } from '../../utils/scheduling';
import '../../styles/student/StudentDashboard.css';

const API_BASE = 'https://localhost-cms.onrender.com/api';
const BASE_URL = 'https://localhost-cms.onrender.com';
const LIVE_REFRESH_MS = 10000;
// events shown in "Coming up"; the full calendar opens from its icon
const AGENDA_LIMIT = 4;

// requirement statuses that still need something from the student
const INCOMPLETE_STATUSES = ['Pending', 'Rejected', 'Resubmit', 'Not Submitted', 'Incomplete'];
// handed in, the nurse has not approved it yet
const WAITING_STATUSES = ['Submitted', 'Submitted Late'];

// a requirement is one of three things: still to do, waiting for the nurse's approval, or approved
const reqStateOf = (status) => (INCOMPLETE_STATUSES.includes(status) ? 'todo' : WAITING_STATUSES.includes(status) ? 'waiting' : 'done');
const REQ_LABELS = { Pending: 'To submit', Submitted: 'Waiting for approval', 'Submitted Late': 'Waiting for approval (late)', Completed: 'Approved' };
const reqLabel = (status) => REQ_LABELS[status] || status;
// tone shared by the badge and the calendar
const reqTone = (status) => {
  const state = reqStateOf(status);
  if (state === 'done') return 'ok';
  if (state === 'waiting') return 'info';
  return status === 'Pending' ? 'warn' : 'bad';
};
const REQ_ORDER = { todo: 0, waiting: 1, done: 2 };

// Daily Health Tips (mapped from clinic complaints)
const DAILY_HEALTH_TIPS = [
  { id: 1, category: 'Respiratory', title: 'Asthma Care', text: 'Always carry your prescribed quick-relief inhaler and stay clear of environmental triggers like dust and smoke.' },
  { id: 2, category: 'Physical Health', title: 'Relieve Body Pain', text: 'Maintain proper posture during long classes and take short stretching breaks to prevent muscle tension.' },
  { id: 3, category: 'Respiratory', title: 'Cough Relief', text: 'Sip warm fluids throughout the day and wear a mask in crowded spaces to prevent spreading germs.' },
  { id: 4, category: 'First Aid', title: 'Breathing Ease', text: 'If breathing feels tight, sit upright in a well-ventilated area, stay calm, and report to the clinic.' },
  { id: 5, category: 'Wellness', title: 'Prevent Dizziness', text: 'Avoid standing up too quickly and keep hydrated, especially during outdoor or afternoon activities.' },
  { id: 6, category: 'General Health', title: 'Fever Care', text: 'Rest well, sip water regularly, and visit the clinic if your body temperature rises or chills persist.' },
  { id: 7, category: 'Digestive', title: 'Gastrointestinal Care', text: 'Drink clean or bottled water, avoid unhygienic foods, and consider oral rehydration solutions if needed.' },
  { id: 8, category: 'Wellness', title: 'Headache Relief', text: 'Take screen breaks every 20 minutes, reduce eye strain, and drink plenty of water.' },
  { id: 9, category: 'Digestive', title: 'Heartburn Prevention', text: 'Avoid heavy, greasy, or spicy meals before long class sessions or going straight to bed.' },
  { id: 10, category: 'Cardiovascular', title: 'Blood Pressure Control', text: 'Limit salty campus snacks, practice deep breathing during stressful exams, and stay active.' },
  { id: 11, category: 'First Aid', title: 'Injury First Aid', text: 'Apply cold compresses to minor bumps or sprains immediately and visit the clinic for wound dressing.' },
  { id: 12, category: 'Emergency', title: 'Fainting Awareness', text: 'Ensure good airflow, loosen tight clothing around the neck, and seek immediate clinic assistance if someone faints.' },
  { id: 13, category: "Women's Health", title: 'Menstrual Cramp Relief', text: 'Use a warm compress on your lower abdomen, rest when needed, and drink warm water.' },
  { id: 14, category: 'Digestive', title: 'Nausea & Vomiting', text: 'Sip small amounts of water or ginger tea slowly and stay seated upright until your stomach settles.' },
  { id: 15, category: 'Prevention', title: 'Runny Nose Hygiene', text: 'Cover sneezes with tissues or your elbow and wash hands frequently to maintain campus hygiene.' },
  { id: 16, category: 'Respiratory', title: 'Sore Throat Relief', text: 'Gargle warm salt water and stay hydrated with warm beverages to soothe throat irritation.' },
  { id: 17, category: 'Oral Health', title: 'Toothache Prevention', text: 'Brush twice daily, floss regularly, and avoid extremely hot, cold, or sugary snacks.' }
];

const MISSING_LABELS = {
  gender: 'Gender', birth_date: 'Birth date', address: 'Address', contact_number: 'Contact number',
  height_cm: 'Height', weight_kg: 'Weight', father_name: "Father's name", mother_name: "Mother's name"
};

// the calendar day (Philippine time) of a date or datetime coming from the API
const dayOf = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !/[TZ]/.test(value.slice(10))) return value.slice(0, 10);
  const d = new Date(value);
  return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
};

const utcOf = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const daysBetween = (fromKey, toKey) => Math.round((utcOf(toKey) - utcOf(fromKey)) / 86400000);

// the day number and short weekday of a 'YYYY-MM-DD' key, for the agenda chip
const dayParts = (key) => ({
  num: Number(key.slice(8, 10)),
  weekday: new Date(utcOf(key)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
});

// "Due today", "Due in 3 days", "Overdue by 2 days"
const dueText = (deadlineKey, todayStr) => {
  const diff = daysBetween(todayStr, deadlineKey);
  if (diff === 0) return { text: 'Due today', tone: 'warn' };
  if (diff > 0) return { text: `Due in ${diff} ${diff === 1 ? 'day' : 'days'}`, tone: diff <= 3 ? 'warn' : 'info' };
  return { text: `Overdue by ${-diff} ${diff === -1 ? 'day' : 'days'}`, tone: 'bad' };
};

// where a check-up or screening stands right now, from its own start and end
const phaseOf = (start, end, now = new Date()) => {
  const s = new Date(String(start).replace(' ', 'T'));
  const e = new Date(String(end).replace(' ', 'T'));
  if (isNaN(s) || isNaN(e)) return 'upcoming';
  if (now >= e) return 'ended';
  return now >= s ? 'ongoing' : 'upcoming';
};

const PHASE_TEXT = { ongoing: 'Happening now', upcoming: 'Upcoming', ended: 'Finished', cancelled: 'Cancelled' };
const PHASE_TONE = { ongoing: 'ok', upcoming: 'info', ended: 'default', cancelled: 'bad' };

const StudentDashboard = () => {
  const navigate = useNavigate();

  // Extract context values from StudentLayout
  const context = useOutletContext() || {};
  const { studentId = '', firstName = '' } = context;

  // the student's numbers in the check-up waiting list and in a session queue; refreshed every few seconds
  const queue = useQueueStatus(studentId, { intervalMs: LIVE_REFRESH_MS });
  // a number leaves the dashboard once its check-up is done (documented) or its session is over: the end confirmed, or the date passed
  const liveAppointments = queue.appointments.filter((a) => !a.session_over && !a.documented && a.state !== 'Done');

  // API Data States
  const [visitsData, setVisitsData] = useState({ clinic_visits: [], direct_dispensations: [] });
  const [requirementsData, setRequirementsData] = useState({ all_requirements: [], incomplete_requirements: [], total_assigned: 0, total_incomplete: 0 });
  const [documentRequestsData, setDocumentRequestsData] = useState({ excuse_slip_requests: [], referral_slip_requests: [], recent_updates: [] });
  const [healthScreenings, setHealthScreenings] = useState([]);
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [openListings, setOpenListings] = useState([]);
  const [advance, setAdvance] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [account, setAccount] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [queueNote, setQueueNote] = useState('');
  const mounted = useRef(true);
  const queueSeen = useRef({});
  const queueRefreshRef = useRef(null);
  queueRefreshRef.current = queue.refresh;

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [recTab, setRecTab] = useState('requests');

  // Helper to format uploaded document URLs using standard base URL
  const getFileUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Fetch all dashboard endpoints. The first load shows the spinner; the refreshes that follow (every few seconds, and when the tab is shown again)
  // are silent so health screenings, check-ups and the queue stay current without the page blinking.
  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!studentId) return;
    if (!silent) { setLoading(true); setError(null); }
    try {
      // each part loads on its own: one failing endpoint must not blank the rest of the dashboard
      const load = async (name, url, apply) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const json = await res.json();
          if (json.success) apply('data' in json ? json.data : json);
          return true;
        } catch (e) {
          console.error(`API Error on [${name}]:`, e.message);
          return false;
        }
      };

      const results = await Promise.all([
        load('Visits & Dispensation', `${API_BASE}/student/dashboard/visits-dispensation/${studentId}`, setVisitsData),
        load('Requirements', `${API_BASE}/student/dashboard/requirements/${studentId}`, setRequirementsData),
        load('Document Requests', `${API_BASE}/student/dashboard/document-requests/${studentId}`, setDocumentRequestsData),
        load('Health Screenings', `${API_BASE}/student/dashboard/live-screenings/${studentId}`, setHealthScreenings),
        load('Doctor Appointments', `${API_BASE}/student/dashboard/doctor-appointments/${studentId}`, setDoctorAppointments),
        load('Open Listings', `${API_BASE}/student/${studentId}/open-listings`, (json) => setOpenListings(json.listings || [])),
        load('Advance Listing', `${API_BASE}/advance-listing?student_id=${encodeURIComponent(studentId)}`, setAdvance),
        load('Announcements', `${API_BASE}/student/dashboard/announcements/${studentId}`, setAnnouncements),
        load('Student Account', `${API_BASE}/student/dashboard/account/${studentId}`, setAccount)
      ]);
      if (!mounted.current) return;
      setError(results.some((ok) => !ok) ? 'Some parts of your dashboard could not be loaded. The rest is shown below.' : null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching student dashboard data:', err);
      if (!silent) setError('Failed to load dashboard data. Please try again.');
    } finally {
      if (!silent && mounted.current) setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    mounted.current = true;
    fetchDashboardData(false);
    const timer = setInterval(() => { if (!document.hidden) fetchDashboardData(true); }, LIVE_REFRESH_MS);
    const onShow = () => { if (!document.hidden) { fetchDashboardData(true); queueRefreshRef.current?.(); } };
    document.addEventListener('visibilitychange', onShow);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
  }, [fetchDashboardData]);

  // say what changed in the queue (your turn, people ahead, now serving) in a polite live region
  useEffect(() => {
    if (queue.loading) return;
    const prev = queueSeen.current;
    const next = {};
    let note = '';
    queue.appointments.filter((a) => !a.session_over).forEach((a) => {
      next[a.appointment_id] = { state: a.state, ahead: a.ahead, serving: a.now_serving };
      const was = prev[a.appointment_id];
      if (!was) return;
      if (a.state === 'Serving' && was.state !== 'Serving') note = `It is your turn: ${a.label} is being served now.`;
      else if (a.state === 'Void' && was.state !== 'Void') note = `Your number ${a.label} was skipped. Tell the nurse you are here.`;
      else if (a.state === 'Done' && was.state !== 'Done') note = `Your check-up ${a.label} is done.`;
      else if (a.state === 'Waiting' && a.ahead !== was.ahead && !note) note = a.ahead === 0 ? `You are next (${a.label}).` : `${a.ahead} ahead of you (${a.label}). Now serving ${a.now_serving || '-'}.`;
    });
    queueSeen.current = next;
    if (note) setQueueNote(note);
  }, [queue.appointments, queue.loading]);

  const handleQuickRequest = (modalType) => {
    navigate('/RequestModule', { state: { openModal: modalType } });
  };

  // requirement badges follow reqTone; the document request statuses below
  const reqBadgeClass = (status) => `badge-sd badge-${reqTone(status)}-sd`;

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'approved':
      case 'issued':
      case 'attended':
        return 'badge-sd badge-ok-sd';
      case 'pending':
      case 'submitted':
        return 'badge-sd badge-warn-sd';
      case 'incomplete':
      case 'rejected':
      case 'resubmit':
      case 'missed':
      case 'not submitted':
        return 'badge-sd badge-bad-sd';
      default:
        return 'badge-sd badge-default-sd';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return formatDateBase(new Date(dateStr));
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return formatDateTimeBase(new Date(dateStr));
  };

  const today = todayKey();

  // everything with a date goes on the calendar: screenings, check-ups (queue numbers + doctor appointments) and requirement deadlines
  const calendarEvents = useMemo(() => {
    const events = [];

    healthScreenings.forEach((s) => {
      const date = dayOf(s.scheduled_date);
      if (!date) return;
      const badges = [{ text: PHASE_TEXT[s.phase] || s.phase, tone: PHASE_TONE[s.phase] || 'default' }];
      if (s.attendance_status === 'PRESENT') badges.push({ text: 'Present', tone: 'ok' });
      else if (s.attendance_status === 'ABSENT') badges.push({ text: 'Marked absent', tone: 'bad' });
      else if (s.phase === 'ongoing') badges.push({ text: 'Go to the clinic to time in', tone: 'warn' });
      events.push({
        id: `scr-${s.screening_schedule_id}`, date, kind: 'screening', sort: String(s.start_time || ''),
        title: s.title || `${s.screening_type || 'Health'} screening`,
        time: `${to12h(s.start_time)} - ${to12h(s.end_time)}`,
        detail: [s.screening_type, s.announcement].filter(Boolean).join(': '),
        badges, to: '/ClinicLogsAndRecords'
      });
    });

    liveAppointments.forEach((a) => {
      if (!a.date) return;
      events.push({
        id: `q-${a.appointment_id}`, date: a.date, kind: 'checkup', sort: String(a.session_start || ''),
        title: `${visitLabel(a.visit_type)}, number ${a.label}`,
        time: `${to12h(a.session_start)} - ${to12h(a.session_end)}`,
        detail: [a.doctor_name, a.location].filter(Boolean).join(', '),
        badges: [a.state === 'Done' ? { text: 'Done', tone: 'ok' } : a.state === 'Serving' ? { text: 'Your turn', tone: 'ok' } : a.in_session ? { text: 'In session', tone: 'ok' } : { text: 'Queue number', tone: 'info' }],
        to: '/BookCheckup'
      });
    });

    // listings the nurse posted for a check-up session; the ones the student already has a number in are shown as queue numbers above
    openListings.forEach((l) => {
      if (!l.date || l.mine?.status === 'Appointed') return;
      const badges = [];
      if (l.mine) badges.push({ text: 'Request sent', tone: 'info' });
      else if (l.listing_full) badges.push({ text: 'Full', tone: 'bad' });
      else badges.push({ text: 'Open for requests', tone: 'ok' });
      events.push({
        id: `lst-${l.schedule_id}-${l.date}`, date: l.date, kind: 'listing', sort: String(l.start_time || ''),
        title: `${l.doctor_name}, ${l.purposes.map((p) => visitLabel(p)).join(', ') || 'Check-up'}`,
        time: `${to12h(l.start_time)} - ${to12h(l.end_time)}`,
        // the advance listing students hold the first numbers; the open places come after them
        detail: [
          l.listing_limit ? `${l.accepted} of ${l.listing_limit} places taken` : `${l.accepted} accepted`,
          l.advance > 0 && `advance listing ${l.advance}, open places ${l.regular}, ${l.places_left} left`,
          l.location
        ].filter(Boolean).join(', '),
        badges, to: '/BookCheckup'
      });
    });

    // the advance listing: the day it opened and the day it closes (or closed), so the student knows when to register
    if (advance) {
      const services = (advance.services || []).filter((x) => x.offered).map((x) => x.visit_type).join(', ');
      const openedOn = dayOf(advance.opened_at);
      if (openedOn) {
        events.push({
          id: 'adv-open', date: openedOn, kind: 'advance', sort: String(advance.opened_at).slice(11, 19),
          title: 'Advance listing opens', time: advance.opened_at ? formatTimeBase(advance.opened_at) : '', detail: services,
          badges: [advance.is_open ? { text: 'Open now', tone: 'ok' } : { text: 'Closed', tone: 'default' }], to: '/BookCheckup'
        });
      }
      const closedAt = advance.is_open ? advance.closes_at : advance.listing?.closed_at;
      const closesOn = dayOf(closedAt);
      if (closesOn) {
        events.push({
          id: 'adv-close', date: closesOn, kind: 'advance', sort: String(closedAt).slice(11, 19),
          title: advance.is_open ? 'Advance listing closes' : 'Advance listing closed', time: formatTimeBase(closedAt), detail: services,
          badges: [advance.is_open ? { text: 'Register before this', tone: 'warn' } : { text: 'Closed', tone: 'default' }], to: '/BookCheckup'
        });
      } else if (advance.is_open && !advance.opened_at) {
        events.push({
          id: 'adv-open-now', date: today, kind: 'advance', sort: '', title: 'Advance listing is open', time: '', detail: services,
          badges: [{ text: 'Open now', tone: 'ok' }], to: '/BookCheckup'
        });
      }
    }

    doctorAppointments.forEach((appt) => {
      const date = dayOf(appt.start_time);
      if (!date) return;
      const phase = phaseOf(appt.start_time, appt.end_time);
      const badges = [{ text: PHASE_TEXT[phase], tone: PHASE_TONE[phase] }];
      if (appt.attendance_status === 'Present') badges.push({ text: 'Present', tone: 'ok' });
      events.push({
        id: `appt-${appt.appointment_id}`, date, kind: 'checkup', sort: String(appt.start_time || '').slice(11, 19),
        title: appt.title || 'Doctor check-up',
        time: `${formatTimeBase(appt.start_time)} - ${formatTimeBase(appt.end_time)}`,
        detail: appt.announcement || appt.notes || '',
        badges, to: '/ClinicLogsAndRecords'
      });
    });

    requirementsData.all_requirements.forEach((r, i) => {
      const date = dayOf(r.submission_deadline);
      if (!date) return;
      const badges = [{ text: reqLabel(r.status), tone: reqTone(r.status) }];
      if (reqStateOf(r.status) === 'todo') { const due = dueText(date, today); badges.push({ text: due.text, tone: due.tone }); }
      events.push({
        id: `req-${i}-${r.requirement_name}`, date, kind: 'deadline', sort: '',
        title: r.requirement_name, time: '', detail: r.nurse_remarks ? `Remarks: ${r.nurse_remarks}` : '',
        badges, to: '/MyRequirements'
      });
    });

    return events;
  }, [healthScreenings, liveAppointments, openListings, advance, doctorAppointments, requirementsData, today]);

  if (loading || !studentId) {
    return (
      <div className="loading-wrapper-sd">
        <div className="loading-spinner-sd" role="status">Loading your student health dashboard...</div>
      </div>
    );
  }

  const totalReq = requirementsData.all_requirements.length;
  const todoReq = requirementsData.all_requirements.filter((r) => reqStateOf(r.status) === 'todo').length;
  const waitingReq = requirementsData.all_requirements.filter((r) => reqStateOf(r.status) === 'waiting').length;
  const doneReq = totalReq - todoReq - waitingReq;
  const overdueReq = requirementsData.all_requirements.filter((r) => {
    const key = dayOf(r.submission_deadline);
    return reqStateOf(r.status) === 'todo' && key && daysBetween(today, key) < 0;
  }).length;
  // only what is still open: to do first, then waiting for approval, each by deadline; approved ones fold into the progress bar
  const openReqs = requirementsData.all_requirements
    .filter((r) => reqStateOf(r.status) !== 'done')
    .sort((a, b) => (
      REQ_ORDER[reqStateOf(a.status)] - REQ_ORDER[reqStateOf(b.status)]
      || (dayOf(a.submission_deadline) || '9').localeCompare(dayOf(b.submission_deadline) || '9')
    ));
  const reqPercent = totalReq ? Math.round((doneReq / totalReq) * 100) : 0;
  const reqSummary = [
    todoReq > 0 && `${todoReq} to submit`,
    waitingReq > 0 && `${waitingReq} waiting for approval`
  ].filter(Boolean).join(', ');

  const profile = account?.profile;
  const profileGaps = profile
    ? [...profile.missing.map((m) => MISSING_LABELS[m] || m), ...(account?.health?.has_record ? [] : ['Health history'])]
    : [];

  // one list for everything that needs the student: requirements, advance listing, health profile
  const attention = [];
  if (todoReq > 0) {
    attention.push({
      id: 'req', tone: overdueReq > 0 ? 'bad' : 'warn', Icon: AlertCircle, to: '/MyRequirements',
      lead: `${todoReq} ${todoReq === 1 ? 'requirement' : 'requirements'} to submit.`,
      rest: overdueReq > 0 ? `${overdueReq} overdue.` : ''
    });
  }
  if (advance?.mine?.status === 'Waiting') {
    attention.push({
      id: 'adv-wait', tone: 'info', Icon: ClipboardList, to: '/BookCheckup',
      lead: `Advance listing number ${advance.mine.label}.`, rest: `${advance.mine.visit_type}. Waiting for a doctor's schedule.`
    });
  }
  if (advance?.mine?.status === 'Pending') {
    attention.push({
      id: 'adv-pending', tone: 'info', Icon: ClipboardList, to: '/BookCheckup',
      lead: 'Advance listing request sent.', rest: `${advance.mine.visit_type}. Waiting for the nurse.`
    });
  }
  if (advance && advance.is_open && !advance.mine) {
    attention.push({
      id: 'adv-open', tone: 'info', Icon: ClipboardList, to: '/BookCheckup',
      lead: 'Advance listing is open.', rest: advance.closes_at ? `Register before ${formatDate(advance.closes_at)}.` : 'Register for a check-up service.'
    });
  }
  if (profileGaps.length > 0) {
    attention.push({
      id: 'profile', tone: 'warn', Icon: AlertCircle, to: '/MyProfile',
      lead: `Profile ${profile.done} of ${profile.total} filled.`, rest: `Missing: ${profileGaps.join(', ')}.`
    });
  }

  const updates = documentRequestsData.recent_updates.slice(0, 3);

  // the three most recent visits, clinic visits and direct medicine together, newest first
  const recentVisits = [
    ...visitsData.clinic_visits.map((v) => ({ type: 'visit', key: `v-${v.visit_id}`, at: v.visit_date, data: v })),
    ...visitsData.direct_dispensations.map((d) => ({ type: 'direct', key: `d-${d.direct_dispense_id}`, at: d.dispensed_at, data: d }))
  ].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).slice(0, 3);

  // the next few events from today on
  const agenda = calendarEvents
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.sort || '')).localeCompare(b.date + (b.sort || '')))
    .slice(0, AGENDA_LIMIT);

  const hasLive = liveAppointments.length > 0;
  const tip = DAILY_HEALTH_TIPS[currentTipIndex];
  const latestNotice = announcements[0];

  // left / right arrows move between the two tabs
  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = recTab === 'requests' ? 'visits' : 'requests';
    setRecTab(next);
    document.getElementById(`tab-${next}-sd`)?.focus();
  };

  return (
    <div className="wrapper-sd">

      <header className="header-sd">
        <div className="header-info-sd">
          <h1>{firstName ? `Hello, ${firstName}` : 'Student Dashboard'}</h1>
          <p>
            Student ID: <span className="id-sd">{studentId}</span> &middot; {formatCurrentDate()}
          </p>
        </div>

        <div className="header-actions-sd">
          <span className="live-note-sd" role="status" aria-label="Live updates">
            <Radio size={14} aria-hidden="true" /> Live{lastUpdated && <>, updated {formatTimeBase(lastUpdated)}</>}
          </span>
          <button
            type="button"
            className="ibtn-sd"
            onClick={() => setShowTip((v) => !v)}
            aria-expanded={showTip}
            aria-controls="tip-panel-sd"
            aria-label="Daily health tip"
            title="Daily health tip"
          >
            <Lightbulb size={20} aria-hidden="true" />
          </button>
          <button type="button" className="ibtn-sd ibtn-fill-sd" onClick={() => handleQuickRequest('excuse')} aria-label="Request excuse slip" title="Request excuse slip">
            <FileSpreadsheet size={20} aria-hidden="true" />
          </button>
          <button type="button" className="ibtn-sd ibtn-fill-sd" onClick={() => handleQuickRequest('referral')} aria-label="Request referral slip" title="Request referral slip">
            <Stethoscope size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* DAILY HEALTH TIP: folded away until the header icon is pressed */}
      {showTip && (
        <section id="tip-panel-sd" className="tips-card-sd" aria-label="Daily health tip">
          <div className="tip-content-sd">
            <div className="tip-header-sd">
              <span className="tip-category-sd">{tip.category}</span>
              <span className="tip-title-sd">{tip.title}</span>
            </div>
            <p className="tip-text-sd">{tip.text}</p>
          </div>
          <div className="tip-actions-sd">
            <button
              type="button"
              onClick={() => setCurrentTipIndex((prev) => (prev + 1) % DAILY_HEALTH_TIPS.length)}
              className="ibtn-sd"
              title="Next tip"
              aria-label="Next tip"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsTipsOpen(true)}
              className="ibtn-sd ibtn-fill-sd"
              title="All tips"
              aria-label="All health tips"
            >
              <Library size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {error && <div className="alert-error-sd" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</div>}

      {/* NURSE ANNOUNCEMENTS: one line, opens on demand */}
      <section className="notice-bar-sd" aria-label="Nurse announcements">
        <div className="notice-head-sd">
          <Megaphone size={18} aria-hidden="true" />
          {announcements.length === 0 ? (
            <p className="notice-none-sd">No active announcements.</p>
          ) : annOpen ? (
            <h2>Nurse Announcements</h2>
          ) : (
            <p className="notice-line-sd"><strong>{latestNotice.title}.</strong> {latestNotice.content}</p>
          )}
          {announcements.length > 0 && (
            <>
              <span className="meta-count-sd" aria-label={`${announcements.length} announcements`}>{announcements.length}</span>
              <button
                type="button"
                className={`ibtn-sd ibtn-flat-sd${annOpen ? ' is-open-sd' : ''}`}
                onClick={() => setAnnOpen((v) => !v)}
                aria-expanded={annOpen}
                aria-controls="ann-list-sd"
                aria-label={annOpen ? 'Hide announcements' : 'Show announcements'}
                title={annOpen ? 'Hide announcements' : 'Show announcements'}
              >
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {annOpen && announcements.length > 0 && (
          <ul id="ann-list-sd" className="notice-list-sd">
            {announcements.map((ann) => (
              <li key={ann.announcement_id} className="notice-item-sd">
                <strong>{ann.title}</strong>
                <span>{ann.content}</span>
                <small>{ann.nurse_name || 'Clinic Staff'} &middot; {formatDateTime(ann.created_at)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* NEEDS ATTENTION: requirements, advance listing and profile gaps in one list */}
      {attention.length > 0 && (
        <section className="card-section-sd" aria-labelledby="attn-title-sd">
          <div className="card-header-sd">
            <h2 id="attn-title-sd"><AlertCircle size={18} aria-hidden="true" /> Needs attention <span className="meta-count-sd">{attention.length}</span></h2>
          </div>
          <ul className="attn-list-sd">
            {attention.map(({ id, tone, Icon, to, lead, rest }) => (
              <li key={id}>
                <Link to={to} className="attn-row-sd">
                  <span className={`attn-dot-sd badge-${tone}-sd`}><Icon size={16} aria-hidden="true" /></span>
                  <span className="attn-text-sd"><strong>{lead}</strong> {rest}</span>
                  <ArrowRight size={18} aria-hidden="true" className="attn-go-sd" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cols-sd">

        {/* LEFT: queue number, then what is coming up */}
        <div className="col-main-sd">
          {hasLive ? (
            <section className="hero-sd" aria-labelledby="queue-title-sd">
              <div className="hero-head-sd">
                <h2 id="queue-title-sd"><ClipboardList size={18} aria-hidden="true" /> My Check-up Queue</h2>
                <Link to="/BookCheckup" className="ibtn-sd ibtn-dark-sd" aria-label="Open check-up listings" title="Open check-up listings">
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <p className="hero-live-sd" role="status" aria-live="polite">{queueNote}</p>

              {liveAppointments.map((a) => {
                const waiting = a.state === 'Waiting' && a.in_session;
                return (
                  <div key={a.appointment_id} className="hero-item-sd">
                    <div className="hero-main-sd">
                      <div className="hero-num-sd">
                        <span className="hero-small-sd">{a.lane === 'Walk-in' ? 'Walk-in' : 'Your number'}, {visitLabel(a.visit_type)}</span>
                        <div className="hero-numrow-sd">
                          <strong className="hero-no-sd" aria-label={`Your queue number ${a.label}`}>{a.label}</strong>
                          <QueuePill a={a} hero />
                        </div>
                      </div>

                      <dl className="hero-stats-sd">
                        <div><dt>Now serving</dt><dd>{a.state === 'Serving' ? 'You' : a.now_serving || '-'}</dd></div>
                        {waiting && <div><dt>Ahead of you</dt><dd>{a.ahead}</dd></div>}
                      </dl>

                      <ul className="hero-meta-sd">
                        {a.doctor_name && <li><Stethoscope size={16} aria-hidden="true" /> {a.doctor_name}</li>}
                        <li><Clock size={16} aria-hidden="true" /> {formatDate(a.date)}, {to12h(a.session_start)} - {to12h(a.session_end)}</li>
                        {a.location && <li><MapPin size={16} aria-hidden="true" /> {a.location}</li>}
                      </ul>
                    </div>

                    <QueueStatus a={a} hero />

                    {waiting && (
                      <ol className="qstrip-sd" aria-label="Queue order">
                        <li className="qchip-sd qchip-serve-sd">{a.now_serving || '-'}<span>In session</span></li>
                        {a.ahead > 0 && <li className="qchip-sd">{a.ahead}<span>ahead</span></li>}
                        <li className="qchip-sd qchip-me-sd">{a.label}<span>You</span></li>
                      </ol>
                    )}
                  </div>
                );
              })}
            </section>
          ) : (
            <section className="card-section-sd" aria-labelledby="queue-title-sd">
              <div className="card-header-sd">
                <h2 id="queue-title-sd"><ClipboardList size={18} aria-hidden="true" /> My Check-up Queue</h2>
                <Link to="/BookCheckup" className="ibtn-sd" aria-label="Open check-up listings" title="Open check-up listings">
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <p className="live-status-sd" role="status" aria-live="polite">{queueNote}</p>
              {queue.loading ? (
                <p className="empty-state-sd">Loading your queue...</p>
              ) : (
                <MyQueue
                  appointments={[]}
                  requests={queue.requests}
                  compact
                  emptyText="You are not on a check-up waiting list. Join one from the Check-up page to get a number."
                />
              )}
            </section>
          )}

          {hasLive && queue.requests.length > 0 && (
            <section className="card-section-sd" aria-label="Waiting list">
              <MyQueue appointments={[]} requests={queue.requests} compact />
            </section>
          )}

          {/* COMING UP: the next events; the full month opens from the icon */}
          <section id="sec-cal-sd" className="card-section-sd" aria-labelledby="calendar-title-sd">
            <div className="card-header-sd">
              <h2 id="calendar-title-sd"><CalendarDays size={18} aria-hidden="true" /> Coming up</h2>
              <button
                type="button"
                className="ibtn-sd"
                onClick={() => setShowCalendar((v) => !v)}
                aria-expanded={showCalendar}
                aria-controls="full-calendar-sd"
                aria-label={showCalendar ? 'Hide full calendar' : 'Show full calendar'}
                title={showCalendar ? 'Hide full calendar' : 'Show full calendar'}
              >
                <CalendarDays size={18} aria-hidden="true" />
              </button>
            </div>

            {agenda.length === 0 ? (
              <p className="empty-state-sd">Nothing coming up.</p>
            ) : (
              <ul className="agenda-sd">
                {agenda.map((e) => {
                  const { num, weekday } = dayParts(e.date);
                  const isToday = e.date === today;
                  return (
                    <li key={e.id}>
                      <Link to={e.to} className="ev-sd">
                        <span className={`ev-day-sd${isToday ? ' ev-today-sd' : ''}`}>
                          <b>{num}</b>
                          <span>{isToday ? 'Today' : weekday}</span>
                        </span>
                        <span className="ev-body-sd">
                          <span className="ev-title-sd">{e.title}</span>
                          {(e.time || e.detail) && <span className="ev-sub-sd">{[e.time, e.detail].filter(Boolean).join(' · ')}</span>}
                        </span>
                        <span className="ev-badges-sd">
                          {e.badges.map((b) => <span key={b.text} className={`badge-sd badge-${b.tone}-sd`}>{b.text}</span>)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {showCalendar && (
              <div id="full-calendar-sd">
                <DashboardCalendar events={calendarEvents} />
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: what is still to do, then requests and visits */}
        <div className="col-side-sd">

          <section id="sec-req-sd" className="card-section-sd" aria-labelledby="req-title-sd">
            <div className="card-header-sd">
              <h2 id="req-title-sd"><ClipboardList size={18} aria-hidden="true" /> Requirements</h2>
              <Link to="/MyRequirements" className="ibtn-sd" aria-label="Open requirements page" title="Open requirements page">
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>

            {totalReq === 0 ? (
              <p className="empty-state-sd">No requirements assigned.</p>
            ) : (
              <>
                <div className="req-summary-sd">
                  <strong>{doneReq} of {totalReq} approved</strong>
                  <span>{reqSummary}</span>
                </div>
                <div
                  className="bar-sd"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={reqPercent}
                  aria-label="Requirements approved"
                >
                  <i style={{ width: `${reqPercent}%` }} />
                </div>

                {openReqs.length === 0 ? (
                  <p className="empty-state-sd"><CheckCircle2 size={16} aria-hidden="true" /> All requirements are approved</p>
                ) : (
                  <ul className="card-content-stack-sd">
                    {openReqs.map((req, idx) => {
                      const key = dayOf(req.submission_deadline);
                      const due = key && reqStateOf(req.status) === 'todo' ? dueText(key, today) : null;
                      return (
                        <li key={`${req.requirement_name}-${idx}`} className="item-card-sd">
                          <div className="item-card-row-sd">
                            <span className="item-title-sd">{req.requirement_name}</span>
                            <span className={reqBadgeClass(req.status)}>{reqLabel(req.status)}</span>
                          </div>
                          <p className="item-subtext-sd">
                            Deadline: <span>{formatDate(req.submission_deadline)}</span>
                            {due && <span className={`due-sd due-${due.tone}-sd`}>{due.text}</span>}
                            {req.file_url && (
                              <a href={getFileUrl(req.file_url)} target="_blank" rel="noopener noreferrer" className="inline-link-sd" aria-label={`View submitted document for ${req.requirement_name}`}>
                                <Eye size={14} aria-hidden="true" /> View submitted
                              </a>
                            )}
                          </p>
                          {req.nurse_remarks && <div className="item-remarks-sd"><strong>Remarks:</strong> {req.nurse_remarks}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>

          {/* REQUESTS + VISITS: two tabs in one card */}
          <section className="card-section-sd" aria-label="Requests and visits">
            <div className="tabs-row-sd">
              <div className="tabs-sd" role="tablist" aria-label="Requests and visits">
                <button
                  type="button"
                  role="tab"
                  id="tab-requests-sd"
                  className="tab-sd"
                  aria-selected={recTab === 'requests'}
                  aria-controls="panel-requests-sd"
                  tabIndex={recTab === 'requests' ? 0 : -1}
                  onClick={() => setRecTab('requests')}
                  onKeyDown={onTabKey}
                >
                  <FileText size={16} aria-hidden="true" /> Requests
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-visits-sd"
                  className="tab-sd"
                  aria-selected={recTab === 'visits'}
                  aria-controls="panel-visits-sd"
                  tabIndex={recTab === 'visits' ? 0 : -1}
                  onClick={() => setRecTab('visits')}
                  onKeyDown={onTabKey}
                >
                  <Activity size={16} aria-hidden="true" /> Visits
                </button>
              </div>
              {recTab === 'requests' ? (
                <Link to="/RequestModule" className="ibtn-sd" aria-label="View all requests" title="View all requests">
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              ) : (
                <Link to="/ClinicLogsAndRecords" className="ibtn-sd" aria-label="Open clinic records" title="Open clinic records">
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              )}
            </div>

            {recTab === 'requests' ? (
              <div id="panel-requests-sd" role="tabpanel" aria-labelledby="tab-requests-sd">
                {updates.length === 0 ? (
                  <p className="empty-state-sd">No request updates yet.</p>
                ) : (
                  <ul className="card-content-stack-sd">
                    {updates.map((doc) => {
                      const link = doc.issued_slip_url
                        ? { href: doc.issued_slip_url, text: 'View issued' }
                        : doc.student_proof_url ? { href: doc.student_proof_url, text: 'View proof' } : null;
                      return (
                        <li key={`${doc.request_type}-${doc.request_id}`} className="item-card-sd">
                          <div className="item-card-row-sd">
                            <span className="item-title-sd">{doc.request_type}</span>
                            <span className={getStatusBadgeClass(doc.status || 'Pending')}>{!doc.status || doc.status === 'Pending' ? 'Waiting for approval' : doc.status}</span>
                          </div>
                          <p className="item-subtext-sd">
                            Requested {formatDate(doc.created_at)}
                            {link && (
                              <a href={getFileUrl(link.href)} target="_blank" rel="noopener noreferrer" className="inline-link-sd" aria-label={`${link.text}: ${doc.request_type}`}>
                                <Eye size={14} aria-hidden="true" /> {link.text}
                              </a>
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div id="panel-visits-sd" role="tabpanel" aria-labelledby="tab-visits-sd">
                {recentVisits.length === 0 ? (
                  <p className="empty-state-sd">No recent clinic visits.</p>
                ) : (
                  <ul className="card-content-stack-sd">
                    {recentVisits.map((item) => {
                      if (item.type === 'direct') {
                        const direct = item.data;
                        return (
                          <li key={item.key} className="item-card-sd">
                            <span className="item-title-sd"><Pill size={14} aria-hidden="true" /> {direct.medicine_name || direct.generic_name || direct.brand_name || 'Medicine'}, {direct.dosage_consumption_unit_value} {direct.dosage_consumption_unit_of_measure || 'pcs'}</span>
                            <p className="item-subtext-sd">{formatDateTime(direct.dispensed_at)}</p>
                          </li>
                        );
                      }
                      const visit = item.data;
                      const meds = (visit.dispensed_medicines || []).map((m) => `${m.medicine_name || m.generic_name || m.brand_name || 'Medicine'} (${m.dosage_value} ${m.dosage_unit || 'pcs'})`);
                      return (
                        <li key={item.key} className="item-card-sd">
                          <span className="item-title-sd">
                            {visit.complaint_name
                              ? `${visit.complaint_name}${visit.specify_complaint_text ? `, ${visit.specify_complaint_text}` : ''}`
                              : visit.specify_complaint_text || 'Clinic visit'}
                          </span>
                          <p className="item-subtext-sd">{formatDate(visit.visit_date)}</p>
                          {meds.length > 0 && <p className="item-subtext-sd"><Pill size={14} aria-hidden="true" /> {meds.join(', ')}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <HealthTipsModal
        isOpen={isTipsOpen}
        onClose={() => setIsTipsOpen(false)}
      />
    </div>
  );
};

export default StudentDashboard;
