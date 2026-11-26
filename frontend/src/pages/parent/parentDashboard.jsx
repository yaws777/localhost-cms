import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Activity,
  Pill,
  FileText,
  FileCheck,
  Calendar,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Megaphone,
  AlertTriangle,
  X,
  Info,
  ShieldAlert,
  Users,
  Check
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { useRecordSync, ALL_RECORD_KINDS } from '../../hooks/useRecordSync';
import {
  formatDate as formatDateBase,
  formatDateTime as formatDateTimeBase,
  formatCurrentDate,
  formatMonthDay,
  formatTime as formatTimeBase
} from '../../utils/datetime';
import '../../styles/parent/ParentDashboard.css';

const DONE_STATUSES = ['approved', 'completed', 'submitted', 'verified'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY_VISITS = { clinic_visits: [], direct_dispensations: [] };
const EMPTY_REQS = { all_requirements: [], total_assigned: 0, total_incomplete: 0 };
const EMPTY_DOCS = { recent_updates: [] };

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD" in Manila time, same zone as utils/datetime.
const manilaKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

const RING_LEN = 163.36; // circumference of r=26
const ATTENTION_DAYS = 7;

const dayNum = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000;
const daysUntil = (key, todayKey) => dayNum(key) - dayNum(todayKey);
const whenLabel = (n) => {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${Math.abs(n)} days ago`;
  return `In ${n} days`;
};

const initialsOf = (student) => {
  const a = (student?.first_name || '').trim().charAt(0);
  const b = (student?.last_name || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
};

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  // Retrieve linked students & parentId passed down from ParentLayout outlet context
  const { linkedStudents = [], parentId = '' } = useOutletContext() || {};

  // Combined Dashboard state hooks
  const [visitsData, setVisitsData] = useState(EMPTY_VISITS);
  const [requirementsData, setRequirementsData] = useState(EMPTY_REQS);
  const [documentRequestsData, setDocumentRequestsData] = useState(EMPTY_DOCS);
  const [screeningsData, setScreeningsData] = useState([]);
  const [appointmentsData, setAppointmentsData] = useState([]);
  const [announcementsData, setAnnouncementsData] = useState([]);

  // Frequent Illness Alert states
  const [frequentAlerts, setFrequentAlerts] = useState([]);
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState([]);
  const [selectedAlertModal, setSelectedAlertModal] = useState(null);
  const [alertVisitsList, setAlertVisitsList] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // View state: child filter + calendar
  const [selectedChild, setSelectedChild] = useState('all');
  const todayKey = manilaKey(new Date());
  const [calYear, setCalYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [calMonth, setCalMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1);
  const [selectedDay, setSelectedDay] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const openerRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Errors are shown as a modal, never inline.
  useEffect(() => {
    if (error) showAlert(error, 'error');
  }, [error, showAlert]);

  // 1. Fetch Frequent Illness Alerts for Parent's Linked Students
  useEffect(() => {
    if (!parentId) return;

    const fetchFrequentAlerts = async () => {
      try {
        const res = await fetch(`https://localhost-cms.onrender.com/api/parent/frequent-complaints/${parentId}`);
        const json = await res.json();
        if (json.success) {
          setFrequentAlerts(json.data || []);
        }
      } catch (err) {
        console.error('Error fetching frequent illness alerts:', err);
      }
    };

    fetchFrequentAlerts();
  }, [parentId]);

  // 2. Fetch and aggregate dashboard metrics for ALL linked students
  // silent = reload in the background after a record changed (no spinner, no error modal)
  const fetchAllStudentsData = useCallback(async (silent = false) => {
      if (!linkedStudents || linkedStudents.length === 0) {
        setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const studentPromises = linkedStudents.map(async (student) => {
          const queryParams = new URLSearchParams({
            programId: student?.program_id || student?.target_program_id || '',
            yearLevel: student?.year_level || student?.target_year_level || '',
            section: student?.section || student?.target_section || ''
          }).toString();

          const [visitsRes, reqsRes, docsRes, screeningsRes, apptsRes, annRes] = await Promise.all([
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/visits-dispensation/${student.student_id}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/requirements/${student.student_id}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/document-requests/${student.student_id}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/upcoming-health-screenings?${queryParams}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/doctor-appointments/${student.student_id}`),
            parentId
              ? fetch(`https://localhost-cms.onrender.com/api/parent/dashboard/announcements/${parentId}`)
              : fetch(`https://localhost-cms.onrender.com/api/student/dashboard/announcements/${student.student_id}`)
          ]);

          const [visitsJson, reqsJson, docsJson, screeningsJson, apptsJson, annJson] = await Promise.all([
            visitsRes.json(),
            reqsRes.json(),
            docsRes.json(),
            screeningsRes.json(),
            apptsRes.json(),
            annRes.json()
          ]);

          const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${student.student_id}`;

          return {
            studentId: student.student_id,
            studentName,
            visits: visitsJson.success ? visitsJson.data : EMPTY_VISITS,
            reqs: reqsJson.success ? reqsJson.data : EMPTY_REQS,
            docs: docsJson.success ? docsJson.data : EMPTY_DOCS,
            screenings: screeningsJson.success ? screeningsJson.data : [],
            appts: apptsJson.success ? apptsJson.data : [],
            announcements: annJson.success ? annJson.data : []
          };
        });

        const results = await Promise.all(studentPromises);

        let combinedVisits = [];
        let combinedDirectDispenses = [];
        let combinedReqs = [];
        let totalAssigned = 0;
        let combinedDocs = [];
        let combinedScreenings = [];
        let combinedAppts = [];
        let combinedAnnouncementsMap = new Map();

        results.forEach((res) => {
          const tag = { studentId: res.studentId, studentName: res.studentName };

          if (res.visits?.clinic_visits) {
            combinedVisits.push(...res.visits.clinic_visits.map(v => ({ ...v, ...tag })));
          }
          if (res.visits?.direct_dispensations) {
            combinedDirectDispenses.push(...res.visits.direct_dispensations.map(dd => ({ ...dd, ...tag })));
          }

          if (res.reqs?.all_requirements) {
            combinedReqs.push(...res.reqs.all_requirements.map(r => ({ ...r, ...tag })));
          }
          totalAssigned += (res.reqs?.total_assigned || 0);

          if (res.docs?.recent_updates) {
            combinedDocs.push(...res.docs.recent_updates.map(d => ({ ...d, ...tag })));
          }

          if (res.screenings) {
            combinedScreenings.push(...res.screenings.map(s => ({ ...s, ...tag })));
          }

          if (res.appts) {
            combinedAppts.push(...res.appts.map(a => ({ ...a, ...tag })));
          }

          if (res.announcements) {
            res.announcements.forEach((ann) => {
              if (!combinedAnnouncementsMap.has(ann.announcement_id)) {
                combinedAnnouncementsMap.set(ann.announcement_id, { ...ann, ...tag });
              }
            });
          }
        });

        const combinedAnnouncements = Array.from(combinedAnnouncementsMap.values());

        const totalPending = combinedReqs.filter(
          (req) => req.status && req.status.trim().toLowerCase() === 'pending'
        ).length;

        combinedVisits.sort((a, b) => new Date(b.visit_date || 0) - new Date(a.visit_date || 0));
        combinedDirectDispenses.sort((a, b) => new Date(b.dispensed_at || 0) - new Date(a.dispensed_at || 0));
        combinedDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        combinedAppts.sort((a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));
        combinedScreenings.sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));
        combinedAnnouncements.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        setVisitsData({ clinic_visits: combinedVisits, direct_dispensations: combinedDirectDispenses });
        setRequirementsData({ all_requirements: combinedReqs, total_assigned: totalAssigned, total_incomplete: totalPending });
        setDocumentRequestsData({ recent_updates: combinedDocs });
        setScreeningsData(combinedScreenings);
        setAppointmentsData(combinedAppts);
        setAnnouncementsData(combinedAnnouncements);

      } catch (err) {
        console.error('Error fetching combined dashboard data:', err);
        if (!silent) setError('Cannot load dashboard.');
      } finally {
        setIsLoading(false);
      }
  }, [linkedStudents, parentId]);

  useEffect(() => {
    fetchAllStudentsData();
  }, [fetchAllStudentsData]);

  // a screening, check-up, visit or incident changed: reload the dashboard quietly
  useRecordSync(ALL_RECORD_KINDS, useCallback(() => { fetchAllStudentsData(true); }, [fetchAllStudentsData]), { enabled: linkedStudents.length > 0 });

  // Frequent Illness Detail Modal Trigger
  const handleOpenAlertDetails = async (alert, event) => {
    openerRef.current = event?.currentTarget || null;
    setSelectedAlertModal(alert);
    setIsLoadingDetails(true);
    setAlertVisitsList([]);

    try {
      const res = await fetch(
        `https://localhost-cms.onrender.com/api/frequent-complaints/details?studentId=${alert.studentId}&complaint=${encodeURIComponent(alert.complaint)}`
      );
      const json = await res.json();
      if (json.success) {
        setAlertVisitsList(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch visit details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const closeAlertModal = useCallback(() => {
    setSelectedAlertModal(null);
    if (openerRef.current && document.contains(openerRef.current)) openerRef.current.focus();
  }, []);

  // Modal: focus the close button, close on Esc.
  useEffect(() => {
    if (!selectedAlertModal) return undefined;
    if (closeBtnRef.current) closeBtnRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeAlertModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedAlertModal, closeAlertModal]);

  const handleDismissAlert = (alertKey) => {
    setDismissedAlertKeys((prev) => [...prev, alertKey]);
  };

  // Navigation handlers
  const handleNavigateToClinic = () => navigate('/ChildClinicRecords');
  const handleNavigateToProfile = () => navigate('/ChildProfile');

  // Formatters
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateBase(new Date(dateString));
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return formatDateTimeBase(new Date(dateString));
  };

  // Children: initials + tone, used by chips and tags
  const kids = useMemo(() => {
    const map = new Map();
    linkedStudents.forEach((s, i) => {
      map.set(String(s.student_id), {
        id: String(s.student_id),
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || `Student #${s.student_id}`,
        first: (s.first_name || '').trim() || `#${s.student_id}`,
        initials: initialsOf(s),
        sub: [s.program_id || s.target_program_id, s.year_level || s.target_year_level ? `${s.year_level || s.target_year_level} Year` : '']
          .filter(Boolean)
          .join(' · '),
        tone: (i % 2) + 1
      });
    });
    return map;
  }, [linkedStudents]);

  const inFilter = useCallback(
    (item) => selectedChild === 'all' || String(item.studentId) === selectedChild,
    [selectedChild]
  );

  const renderKid = (studentId, fallbackName) => {
    const kid = kids.get(String(studentId));
    if (!kid) {
      return <span className="pd-kid pd-tone-1">{fallbackName || 'Student'}</span>;
    }
    return (
      <span className={`pd-kid pd-tone-${kid.tone}`}>
        <span className="pd-av" aria-hidden="true">{kid.initials}</span>
        {kid.first}
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    const label = status || 'Pending';
    const s = label.toLowerCase();
    let badgeClass = 'pd-badge-pending';
    let icon = <Clock size={14} aria-hidden="true" />;

    if (DONE_STATUSES.includes(s)) {
      badgeClass = 'pd-badge-success';
      icon = <CheckCircle2 size={14} aria-hidden="true" />;
    } else if (['rejected', 'incomplete', 'overdue'].includes(s)) {
      badgeClass = 'pd-badge-danger';
      icon = <XCircle size={14} aria-hidden="true" />;
    } else if (['resubmit', 'action required'].includes(s)) {
      badgeClass = 'pd-badge-warning';
      icon = <AlertCircle size={14} aria-hidden="true" />;
    }

    return (
      <span className={`pd-status-badge ${badgeClass}`}>
        {icon}
        <span>{label}</span>
      </span>
    );
  };

  const renderViewButton = (label, onClick) => (
    <button type="button" className="pd-icon-btn" aria-label={label} title={label} onClick={onClick}>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );

  // ---- Filtered data ----
  const activeAlerts = frequentAlerts.filter(
    (a) => !dismissedAlertKeys.includes(`${a.studentId}-${a.complaint}`) && inFilter(a)
  );

  const visibleVisits = (visitsData.clinic_visits || []).filter(inFilter);
  const latestVisit = visibleVisits[0] || null;
  const recentVisitCount = visibleVisits.filter((v) => {
    const t = new Date(v.visit_date || 0).getTime();
    return t && Date.now() - t <= THIRTY_DAYS_MS;
  }).length;

  const visibleReqs = (requirementsData.all_requirements || []).filter(inFilter);
  const reqDone = visibleReqs.filter((r) => DONE_STATUSES.includes((r.status || '').trim().toLowerCase())).length;
  const reqTodo = visibleReqs.length - reqDone;
  const reqPct = visibleReqs.length ? Math.round((reqDone / visibleReqs.length) * 100) : 0;
  const reqRows = [...visibleReqs]
    .sort((a, b) => {
      const ad = DONE_STATUSES.includes((a.status || '').trim().toLowerCase()) ? 1 : 0;
      const bd = DONE_STATUSES.includes((b.status || '').trim().toLowerCase()) ? 1 : 0;
      return ad - bd;
    })
    .slice(0, 4);

  const visibleDocs = (documentRequestsData.recent_updates || []).filter(inFilter).slice(0, 3);

  // Clinic visits per week over the last 30 days, oldest to newest.
  const visitBars = [0, 0, 0, 0];
  visibleVisits.forEach((v) => {
    const t = new Date(v.visit_date || 0).getTime();
    if (!t) return;
    const age = (Date.now() - t) / 86400000;
    if (age > 30) return;
    visitBars[age <= 7 ? 3 : age <= 14 ? 2 : age <= 21 ? 1 : 0] += 1;
  });
  const barMax = Math.max(1, ...visitBars);

  // Needs attention: illness alerts first, then requirements due within a week (or late).
  const attention = [
    ...activeAlerts.map((alert) => ({ type: 'alert', alert, alertKey: `${alert.studentId}-${alert.complaint}` })),
    ...visibleReqs
      .map((req) => ({ type: 'req', req, key: manilaKey(req.submission_deadline) }))
      .filter(({ req, key }) => key
        && !DONE_STATUSES.includes((req.status || '').trim().toLowerCase())
        && daysUntil(key, todayKey) <= ATTENTION_DAYS)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .slice(0, 3)
      .map((x) => ({ ...x, days: daysUntil(x.key, todayKey) }))
  ];

  // Calendar events: screenings + doctor appointments
  const events = useMemo(() => {
    const list = [];
    screeningsData.filter(inFilter).forEach((s, i) => {
      const key = manilaKey(s.scheduled_date);
      if (!key) return;
      list.push({
        id: `s-${s.screening_schedule_id || i}-${s.studentId}`,
        key,
        type: 'screening',
        title: s.title || 'Health screening',
        time: s.start_time
          ? `${formatTimeBase(s.start_time)}${s.end_time ? ` - ${formatTimeBase(s.end_time)}` : ''}`
          : '',
        sort: `${key} ${s.start_time || ''}`,
        studentId: s.studentId,
        studentName: s.studentName,
        status: null,
        attendance: null
      });
    });
    appointmentsData.filter(inFilter).forEach((a, i) => {
      const key = manilaKey(a.start_time);
      if (!key) return;
      list.push({
        id: `d-${a.appointment_id || i}-${a.studentId}`,
        key,
        type: 'doctor',
        title: a.title || 'Doctor check-up',
        time: formatTimeBase(a.start_time),
        sort: `${key} ${formatTimeBase(a.start_time)}`,
        studentId: a.studentId,
        studentName: a.studentName,
        status: a.appointment_status,
        attendance: a.attendance_status
      });
    });
    return list.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
  }, [screeningsData, appointmentsData, inFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      if (!map.has(e.key)) map.set(e.key, []);
      map.get(e.key).push(e);
    });
    return map;
  }, [events]);

  const nextDoctor = events.find((e) => e.type === 'doctor' && e.key >= todayKey) || null;
  const nextScreening = events.find((e) => e.type === 'screening' && e.key >= todayKey) || null;

  const monthPrefix = `${calYear}-${pad(calMonth + 1)}-`;
  const firstEventInMonth = events.find((e) => e.key.startsWith(monthPrefix) && e.key >= todayKey)
    || events.find((e) => e.key.startsWith(monthPrefix));
  const activeDay = selectedDay
    || (todayKey.startsWith(monthPrefix) && !firstEventInMonth ? todayKey : null)
    || (firstEventInMonth ? firstEventInMonth.key : `${monthPrefix}01`);
  const dayEvents = eventsByDay.get(activeDay) || [];

  const firstWeekday = new Date(Date.UTC(calYear, calMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();
  const calCells = [];
  for (let i = 0; i < firstWeekday; i += 1) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) calCells.push(d);

  const shiftMonth = (delta) => {
    const next = new Date(Date.UTC(calYear, calMonth + delta, 1));
    setCalYear(next.getUTCFullYear());
    setCalMonth(next.getUTCMonth());
    setSelectedDay(null);
  };

  const activeDayLabel = formatMonthDay(`${activeDay}T12:00:00+08:00`) + (activeDay === todayKey ? ' (today)' : '');

  if (isLoading) {
    return (
      <div className="pd-loading-container" role="status" aria-live="polite">
        <div className="pd-spinner"></div>
        <p>Loading…</p>
      </div>
    );
  }

  const showChips = kids.size > 1;
  const kidList = Array.from(kids.values());
  const reqTodoOf = (id) => (requirementsData.all_requirements || []).filter(
    (r) => String(r.studentId) === id && !DONE_STATUSES.includes((r.status || '').trim().toLowerCase())
  ).length;

  const renderNextTile = (Icon, label, ev) => (
    <div className="pd-card pd-tile">
      <span className="pd-tile-lbl"><Icon size={16} aria-hidden="true" />{label}</span>
      <div className="pd-tile-val">
        <span className="pd-tile-num">{ev ? formatMonthDay(`${ev.key}T12:00:00+08:00`) : 'None'}</span>
      </div>
      <span className="pd-tile-sub">{ev ? `${ev.title}${ev.time ? ` · ${ev.time}` : ''}` : 'Nothing scheduled'}</span>
      {ev && (
        <span className="pd-status-badge pd-badge-info">
          <Clock size={14} aria-hidden="true" />
          <span>{whenLabel(daysUntil(ev.key, todayKey))}</span>
        </span>
      )}
    </div>
  );

  return (
    <div className="pd-wrapper">

      {/* HEADER + CHILD SWITCHER */}
      <header className="pd-top">
        <div>
          <h1 className="pd-title">Dashboard</h1>
          <p className="pd-date">{formatCurrentDate()}</p>
        </div>
        {showChips && (
          <div className="pd-kids" role="group" aria-label="Show records for">
            <button
              type="button"
              className={`pd-kidbtn${selectedChild === 'all' ? ' is-on' : ''}`}
              aria-pressed={selectedChild === 'all'}
              onClick={() => { setSelectedChild('all'); setSelectedDay(null); }}
            >
              <span className="pd-av pd-av-all" aria-hidden="true"><Users size={18} /></span>
              <span className="pd-kidtext">
                <span className="pd-kidname">All children</span>
                <span className="pd-kidsub">{kidList.length} linked</span>
              </span>
              {selectedChild === 'all' && <Check size={18} className="pd-kidck" aria-hidden="true" />}
            </button>
            {kidList.map((kid) => (
              <button
                type="button"
                key={kid.id}
                className={`pd-kidbtn${selectedChild === kid.id ? ' is-on' : ''}`}
                aria-pressed={selectedChild === kid.id}
                onClick={() => { setSelectedChild(kid.id); setSelectedDay(null); }}
              >
                <span className={`pd-av pd-tone-${kid.tone}`} aria-hidden="true">{kid.initials}</span>
                <span className="pd-kidtext">
                  <span className="pd-kidname">{kid.name}</span>
                  <span className="pd-kidsub">{kid.sub ? `${kid.sub} · ` : ''}{reqTodoOf(kid.id)} to do</span>
                </span>
                {selectedChild === kid.id && <Check size={18} className="pd-kidck" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* NURSE ANNOUNCEMENTS: first thing the parent sees */}
      <section className="pd-card pd-ann-card" aria-labelledby="pd-h-ann">
        <div className="pd-card-header">
          <div className="pd-card-title">
            <span className="pd-card-ico pd-ico-blue"><Megaphone size={18} aria-hidden="true" /></span>
            <h2 id="pd-h-ann">Nurse announcements</h2>
          </div>
        </div>
        {announcementsData.length === 0 ? (
          <p className="pd-empty-state pd-ann-empty">No announcements.</p>
        ) : (
          <div className="pd-ann-list">
            {announcementsData.slice(0, 3).map((ann, idx) => (
              <article key={ann.announcement_id || idx} className="pd-ann">
                <h3>{ann.title}</h3>
                <p>{ann.content}</p>
                <span className="pd-meta">
                  {ann.nurse_name || 'Clinic Staff'} · {formatDateTime(ann.created_at)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* NEEDS ATTENTION: illness alerts + requirements due soon */}
      {attention.length > 0 && (
        <section className="pd-card pd-attn" aria-labelledby="pd-h-attn">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <span className="pd-card-ico"><AlertTriangle size={18} aria-hidden="true" /></span>
              <h2 id="pd-h-attn">Needs attention</h2>
            </div>
            <span className="pd-count" aria-label={`${attention.length} items`}>{attention.length}</span>
          </div>
          <ul className="pd-attn-list">
            {attention.map((item) => {
              if (item.type === 'alert') {
                const { alert, alertKey } = item;
                const visits = Math.max(Number(alert.visitCount) || 0, 0);
                return (
                  <li key={`a-${alertKey}`} className="pd-arow">
                    <span className="pd-arow-ico pd-ico-warn"><ShieldAlert size={20} aria-hidden="true" /></span>
                    <div className="pd-arow-body">
                      <h3>{alert.complaint}</h3>
                      {alert.advice && <span className="pd-meta">{alert.advice}</span>}
                    </div>
                    {renderKid(alert.studentId, alert.studentName)}
                    <span className="pd-status-badge pd-badge-warning">
                      <span className="pd-alert-dots" aria-hidden="true">
                        {Array.from({ length: Math.min(visits, 6) }).map((_, i) => <i key={i} />)}
                      </span>
                      <span>{visits} visits this month</span>
                    </span>
                    <div className="pd-actions">
                      <button
                        type="button"
                        className="pd-icon-btn pd-icon-btn-solid"
                        aria-label="View visit details"
                        title="View visit details"
                        onClick={(e) => handleOpenAlertDetails(alert, e)}
                      >
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="pd-icon-btn pd-icon-btn-plain"
                        aria-label="Dismiss alert"
                        title="Dismiss alert"
                        onClick={() => handleDismissAlert(alertKey)}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              }
              const { req, days } = item;
              const late = days < 0;
              const urgent = days <= 3;
              return (
                <li key={`r-${req.requirement_id || `${req.studentId}-${req.requirement_name}`}`} className="pd-arow">
                  <span className="pd-arow-ico pd-ico-blue"><FileCheck size={20} aria-hidden="true" /></span>
                  <div className="pd-arow-body">
                    <h3>{req.requirement_name}</h3>
                    <span className="pd-meta">Due {formatDate(req.submission_deadline)}</span>
                  </div>
                  {renderKid(req.studentId, req.studentName)}
                  <span className={`pd-status-badge ${urgent ? 'pd-badge-danger' : 'pd-badge-warning'}`}>
                    {urgent ? <AlertCircle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
                    <span>{late ? 'Overdue' : `Due ${whenLabel(days).toLowerCase()}`}</span>
                  </span>
                  <div className="pd-actions">
                    {renderViewButton('Open child profile', handleNavigateToProfile)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* SUMMARY TILES */}
      <section className="pd-tiles" aria-label="Summary">
        <div className="pd-card pd-tile">
          <span className="pd-tile-lbl"><FileCheck size={16} aria-hidden="true" />Requirements</span>
          <div className="pd-tile-val">
            <span className="pd-tile-num">{reqTodo} to do</span>
            <span className="pd-ring" role="img" aria-label={`${reqPct} percent complete`}>
              <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
                <circle cx="30" cy="30" r="26" className="pd-ring-track" />
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  className="pd-ring-bar"
                  strokeDasharray={`${((reqPct / 100) * RING_LEN).toFixed(1)} ${RING_LEN}`}
                />
              </svg>
              <span>{reqPct}%</span>
            </span>
          </div>
          <span className="pd-tile-sub">of {visibleReqs.length} assigned</span>
        </div>
        {renderNextTile(Stethoscope, 'Next doctor visit', nextDoctor)}
        {renderNextTile(Calendar, 'Next screening', nextScreening)}
        <div className="pd-card pd-tile">
          <span className="pd-tile-lbl"><Activity size={16} aria-hidden="true" />Clinic visits</span>
          <div className="pd-tile-val">
            <span className="pd-tile-num">{recentVisitCount}</span>
            <span className="pd-bars" role="img" aria-label={`Visits per week, oldest to newest: ${visitBars.join(', ')}`}>
              {visitBars.map((n, i) => (
                <i key={i} className={n ? '' : 'is-zero'} style={{ height: n ? `${Math.round((n / barMax) * 100)}%` : '10%' }} />
              ))}
            </span>
          </div>
          <span className="pd-tile-sub">last 30 days</span>
        </div>
      </section>

      <div className="pd-cols">

        {/* MAIN COLUMN */}
        <div className="pd-col pd-col-main">

          {/* CALENDAR + DAY AGENDA */}
          <section className="pd-card" aria-labelledby="pd-h-cal">
            <div className="pd-card-header">
              <div className="pd-card-title">
                <span className="pd-card-ico pd-ico-violet"><Calendar size={18} aria-hidden="true" /></span>
                <h2 id="pd-h-cal">{MONTH_NAMES[calMonth]} {calYear}</h2>
              </div>
              <div className="pd-actions">
                <button type="button" className="pd-icon-btn" aria-label="Previous month" title="Previous month" onClick={() => shiftMonth(-1)}>
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" className="pd-icon-btn" aria-label="Next month" title="Next month" onClick={() => shiftMonth(1)}>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="pd-card-body">
              <div className="pd-calwrap">
                <div className="pd-cal" role="group" aria-label={`${MONTH_NAMES[calMonth]} ${calYear} calendar`}>
                  {WEEKDAYS.map((w) => <span key={w} className="pd-cal-wd" aria-hidden="true">{w}</span>)}
                  {calCells.map((day, idx) => {
                    if (day === null) return <span key={`b-${idx}`} aria-hidden="true" />;
                    const key = `${monthPrefix}${pad(day)}`;
                    const evs = eventsByDay.get(key) || [];
                    const hasDoctor = evs.some((e) => e.type === 'doctor');
                    const hasScreening = evs.some((e) => e.type === 'screening');
                    const isSel = key === activeDay;
                    const isToday = key === todayKey;
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`pd-day${isSel ? ' is-sel' : ''}${isToday ? ' is-today' : ''}`}
                        aria-pressed={isSel}
                        aria-label={`${MONTH_NAMES[calMonth]} ${day}${isToday ? ', today' : ''}, ${evs.length ? `${evs.length} ${evs.length > 1 ? 'events' : 'event'}` : 'no events'}`}
                        onClick={() => setSelectedDay(key)}
                      >
                        <span className="pd-day-num">{day}</span>
                        <span className="pd-day-dots" aria-hidden="true">
                          {hasDoctor && <i className="pd-dot-doctor" />}
                          {hasScreening && <i className="pd-dot-screen" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pd-agenda">
                  <h3 className="pd-section-subtitle">{activeDayLabel}</h3>
                  {dayEvents.length === 0 ? (
                    <p className="pd-empty-state">Nothing scheduled.</p>
                  ) : (
                    <ul className="pd-event-list">
                      {dayEvents.map((ev) => (
                        <li key={ev.id} className="pd-event">
                          <span className={`pd-event-ico ${ev.type === 'doctor' ? 'pd-ico-ok' : 'pd-ico-violet'}`}>
                            {ev.type === 'doctor' ? <Stethoscope size={18} aria-hidden="true" /> : <Calendar size={18} aria-hidden="true" />}
                          </span>
                          <div className="pd-event-body">
                            <div className="pd-event-head">
                              <h4>{ev.title}</h4>
                              {renderKid(ev.studentId, ev.studentName)}
                            </div>
                            <p className="pd-event-time">
                              <Clock size={14} aria-hidden="true" />
                              {ev.time || 'All day'}
                            </p>
                            <p className="pd-meta">{ev.type === 'doctor' ? 'Doctor visit' : 'Health screening'}</p>
                            {(ev.status || ev.attendance) && (
                              <div className="pd-status-meta">
                                {ev.status && renderStatusBadge(ev.status)}
                                {ev.attendance && <span className="pd-attendance-pill">{ev.attendance}</span>}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pd-legend">
                  <span><i className="pd-dot-doctor" />Doctor visit</span>
                  <span><i className="pd-dot-screen" />Screening</span>
                </div>
              </div>
            </div>
          </section>

          {/* LATEST CLINIC VISIT ONLY */}
          <section className="pd-card" aria-labelledby="pd-h-vis">
            <div className="pd-card-header">
              <div className="pd-card-title">
                <span className="pd-card-ico pd-ico-blue"><Activity size={18} aria-hidden="true" /></span>
                <h2 id="pd-h-vis">Recent clinic visit</h2>
              </div>
              {renderViewButton('Open clinic records', handleNavigateToClinic)}
            </div>
            <div className="pd-card-body">
              {!latestVisit ? (
                <p className="pd-empty-state">No clinic visits.</p>
              ) : (
                <article className="pd-visit">
                  <div className="pd-when">
                    <strong>{formatDate(latestVisit.visit_date)}</strong>
                    <span>{latestVisit.time_in ? formatTimeBase(latestVisit.time_in) : '--'}</span>
                  </div>
                  <div className="pd-visit-body">
                    <div className="pd-visit-head">
                      <h3>{latestVisit.complaint_name || latestVisit.specify_complaint_text || 'General Consultation'}</h3>
                      {renderKid(latestVisit.studentId, latestVisit.studentName)}
                    </div>

                    {(latestVisit.vitals?.temperature || latestVisit.vitals?.blood_pressure || latestVisit.vitals?.pulse_rate) && (
                      <ul className="pd-vitals">
                        {latestVisit.vitals?.temperature && (
                          <li className="pd-vit"><span className="pd-vit-k">Temp</span><span className="pd-vit-v">{latestVisit.vitals.temperature}°C</span></li>
                        )}
                        {latestVisit.vitals?.blood_pressure && (
                          <li className="pd-vit"><span className="pd-vit-k">BP</span><span className="pd-vit-v">{latestVisit.vitals.blood_pressure}</span></li>
                        )}
                        {latestVisit.vitals?.pulse_rate && (
                          <li className="pd-vit"><span className="pd-vit-k">Pulse</span><span className="pd-vit-v">{latestVisit.vitals.pulse_rate} bpm</span></li>
                        )}
                      </ul>
                    )}

                    {latestVisit.assessment && (
                      <p className="pd-visit-note"><strong>Assessment:</strong> {latestVisit.assessment}</p>
                    )}

                    {latestVisit.dispensed_medicines && latestVisit.dispensed_medicines.length > 0 && (
                      <div className="pd-meds">
                        <Pill size={16} aria-label="Dispensed" />
                        {latestVisit.dispensed_medicines.map((med) => (
                          <span key={med.dispense_id} className="pd-med-tag">
                            {med.medicine_name} - {med.dosage_value} {med.dosage_unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )}
            </div>
          </section>

        </div>

        {/* SIDE COLUMN */}
        <div className="pd-col pd-col-side">

          {/* MEDICAL REQUIREMENTS */}
          <section className="pd-card" aria-labelledby="pd-h-req">
            <div className="pd-card-header">
              <div className="pd-card-title">
                <span className="pd-card-ico pd-ico-ok"><FileCheck size={18} aria-hidden="true" /></span>
                <h2 id="pd-h-req">Requirements</h2>
              </div>
              {renderViewButton('Open child profile', handleNavigateToProfile)}
            </div>
            <div className="pd-card-body">
              {visibleReqs.length === 0 ? (
                <p className="pd-empty-state">No requirements.</p>
              ) : (
                <>
                  <div className="pd-progress">
                    <div className="pd-progress-row">
                      <span>{reqDone} of {visibleReqs.length} complete</span>
                      <span>{reqPct}%</span>
                    </div>
                    <div
                      className="pd-bar"
                      role="progressbar"
                      aria-label="Requirements complete"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={reqPct}
                    >
                      <i style={{ width: `${reqPct}%` }} />
                    </div>
                  </div>
                  <ul className="pd-rows">
                    {reqRows.map((req, idx) => (
                      <li key={req.requirement_id || `${req.studentId}-${req.requirement_name}-${idx}`} className="pd-row">
                        <div className="pd-row-info">
                          <strong>{req.requirement_name}</strong>
                          <span className="pd-meta">
                            Due {req.submission_deadline ? formatDate(req.submission_deadline) : 'No deadline'}
                          </span>
                          {renderKid(req.studentId, req.studentName)}
                        </div>
                        {renderStatusBadge(req.status)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          {/* DOCUMENT REQUESTS */}
          <section className="pd-card" aria-labelledby="pd-h-doc">
            <div className="pd-card-header">
              <div className="pd-card-title">
                <span className="pd-card-ico pd-ico-warn"><FileText size={18} aria-hidden="true" /></span>
                <h2 id="pd-h-doc">Document requests</h2>
              </div>
              {renderViewButton('Open clinic records', handleNavigateToClinic)}
            </div>
            <div className="pd-card-body">
              {visibleDocs.length === 0 ? (
                <p className="pd-empty-state">No document requests.</p>
              ) : (
                <ul className="pd-rows">
                  {visibleDocs.map((doc, idx) => (
                    <li key={`${doc.request_type}-${doc.request_id || idx}`} className="pd-row">
                      <div className="pd-row-info">
                        <span><span className="pd-type-badge">{doc.request_type}</span></span>
                        <strong>{doc.reason_for_excuse || doc.reason_for_referral || 'Request record'}</strong>
                        <span className="pd-meta">Requested {formatDate(doc.created_at)}</span>
                        {renderKid(doc.studentId, doc.studentName)}
                      </div>
                      {renderStatusBadge(doc.status)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* FREQUENT ILLNESS VISIT BREAKDOWN MODAL */}
      {selectedAlertModal && (
        <div className="pd-modal-backdrop" onClick={closeAlertModal}>
          <div
            className="pd-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pd-modal-header">
              <div className="pd-modal-title-group">
                <AlertTriangle size={18} className="pd-text-warning" aria-hidden="true" />
                <h3 id="pd-modal-title">{selectedAlertModal.complaint} visits</h3>
              </div>
              <button
                type="button"
                ref={closeBtnRef}
                className="pd-icon-btn pd-icon-btn-plain"
                aria-label="Close"
                title="Close"
                onClick={closeAlertModal}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="pd-modal-body">
              <div className="pd-modal-summary">
                <p><strong>Student</strong> {selectedAlertModal.studentName} ({selectedAlertModal.studentId})</p>
                <p><strong>Visits</strong> {selectedAlertModal.visitCount} this month</p>
              </div>

              {selectedAlertModal.advice && (
                <div className="pd-modal-advice-banner">
                  <Info size={18} aria-hidden="true" />
                  <span>{selectedAlertModal.advice}</span>
                </div>
              )}

              {isLoadingDetails ? (
                <div className="pd-modal-loading" role="status" aria-live="polite">
                  <div className="pd-spinner-sm"></div>
                  <span>Loading…</span>
                </div>
              ) : alertVisitsList.length === 0 ? (
                <p className="pd-empty-state">No records.</p>
              ) : (
                <div className="pd-modal-visits-table-wrapper">
                  <table className="pd-modal-visits-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Vitals</th>
                        <th scope="col">Care given</th>
                        <th scope="col">Assessment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertVisitsList.map((visit) => (
                        <tr key={visit.visitId}>
                          <td>
                            <strong>{formatDate(visit.visitDate)}</strong>
                            <div className="pd-table-sub">{visit.timeIn || 'N/A'} - {visit.timeOut || 'N/A'}</div>
                          </td>
                          <td>
                            <div className="pd-vitals-mini">
                              {visit.temperature && <span>Temp: {visit.temperature}°C</span>}
                              {visit.bloodPressure && <span>BP: {visit.bloodPressure}</span>}
                              {visit.pulseRate && <span>Pulse: {visit.pulseRate} bpm</span>}
                            </div>
                          </td>
                          <td>{visit.nursingIntervention || 'Rest / Observation'}</td>
                          <td>{visit.assessment || 'Monitored at clinic'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pd-modal-footer">
              <button type="button" className="pd-btn-secondary" onClick={closeAlertModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParentDashboard;
