// healthScreening.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Calendar, Clock, Users, Eye, Activity, Smile, HeartPulse, Ear, 
  X, CheckCircle, Edit3, Trash2, FileText, ArrowLeft, ArrowRight, Megaphone, Printer, Filter,
  Play, UserRoundPlus, Download, Search, ClipboardList, BellRing, History, LogIn, FolderPlus
} from 'lucide-react';

import { openReportWindow, writeReport, escapeHtml } from '../../utils/printReport';
import stiLogo from '../../assets/sti-logof.png';
import { formatDate, formatTime } from '../../utils/datetime';
import '../../styles/nurse/HealthScreening.css';
import { FolderCrumbs, FolderGrid, Pager, sectionFolderName, paginate, scopeCounts, TabCount, groupByDay, dayKey, dayHeading, DaySection } from '../../components/common/RecordFolders';
import ScreeningTypesManager from '../../components/nurse/ScreeningTypesManager';
import ScreeningCalendar from '../../components/nurse/ScreeningCalendar';
import ScreeningParticipantsModal from '../../components/nurse/ScreeningParticipantsModal';
import ScreeningTemplatesManager from '../../components/nurse/ScreeningTemplatesManager';
import ScreeningArchive from '../../components/nurse/ScreeningArchive';
import SectionStudents from '../../components/nurse/SectionStudents';
import SchoolYearDialog from '../../components/nurse/SchoolYearDialog';
import StudentScreeningHistoryModal from '../../components/nurse/StudentScreeningHistoryModal';
import { calculate } from '../../utils/formula';
import { classLabel } from '../../utils/scheduling';
import SessionEndPrompt from '../../components/scheduling/SessionEndPrompt';
import { HsDialog, HsDialogHeader } from '../../components/nurse/HsDialog';
import ConfirmModal from '../../components/common/ConfirmModal';
import AlertModal from '../../components/common/AlertModal';

// The screening types come from GET /api/screening-types (screening_types table). A type's form_kind picks the result form.
// Dental / Vision moved to Doctor Visits. Old schedules still show up (read-only) as legacy; the server answers form_kind DENTAL / VISION for them.
const LEGACY_FORM_KINDS = ['DENTAL', 'VISION'];
const isLegacySchedule = (sch) => LEGACY_FORM_KINDS.includes(sch?.form_kind);
const typeLabel = (type) => (['Dental', 'Vision'].includes(type) ? `${type} (legacy)` : type);
const KIND_ICONS = { BMI: Activity, VITAL_SIGNS: HeartPulse, HEARING: Ear, CUSTOM: ClipboardList, DENTAL: Smile, VISION: Eye };
const hasResult = (st) => !!(st.bmi_log_id || st.custom_record_id || st.vital_record_id || st.hearing_record_id || st.dental_record_id || st.vision_record_id);

const flagColor = (flag) => (flag === 'Normal' ? 'var(--status-adequate-text)' : flag ? 'var(--status-critical-text)' : 'var(--text-secondary)');

const time12 = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Columns of the results report / CSV for each result form (form_kind)
const RESULT_COLUMNS = {
  HEARING: [
    ['Left ear', (r) => r.left_ear_result],
    ['Right ear', (r) => r.right_ear_result]
  ]
};

// A form template (CUSTOM) gives one column per field, in the order of the form
const templateColumns = (template) => (template?.fields || []).map((f) => [
  f.unit ? `${f.label} (${f.unit})` : f.label,
  (r) => {
    if (!r.answers || r.answers[f.key] === undefined) return '';
    const label = r.answers[`${f.key}__label`];
    return label ? `${r.answers[f.key]} (${label})` : r.answers[f.key];
  }
]);

const resultColumnsFor = (formKind, template) => (formKind === 'CUSTOM' ? templateColumns(template) : RESULT_COLUMNS[formKind]) || [['Result', (r) => r.result_summary]];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename, rows) => {
  const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const API_BASE = 'http://localhost:3001/api';

// Query string for GET /api/screenings/page from the current folder / tab / type / search / dates
const buildScreeningParams = (q) => {
  const p = new URLSearchParams();
  if (q.view.kind === 'custom') {
    p.set('folder_id', String(q.view.folder_id));
  } else if (q.view.kind === 'section') {
    p.set('program_id', q.view.program_id);
    p.set('year_level', q.view.year_level);
    p.set('section', q.view.section);
  } else if (q.view.kind === 'program') {
    p.set('program_id', q.view.program_id);
  }
  p.set('tab', q.activeTab);
  if (q.schoolYear) p.set('school_year', q.schoolYear);
  if (q.filterType && q.filterType !== 'ALL') p.set('type', q.filterType);
  if (q.search) p.set('q', q.search);
  if (q.activeTab === 'past') {
    if (q.filterStartDate) p.set('from', q.filterStartDate);
    if (q.filterEndDate) p.set('to', q.filterEndDate);
  }
  return p;
};

const SCREENINGS_PER_PAGE = 12;
const PARTICIPANTS_PER_PAGE = 15;
const PICKER_PER_PAGE = 10;



// Helper to get a local date in YYYY-MM-DD format, offset days from today
const getDateString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayString = () => getDateString(0);

// Past Screenings opens on yesterday and today
const defaultPastRange = () => ({ from: getDateString(-1), to: getDateString(0) });

// Helper to get current local time in HH:MM format
const getCurrentTimeString = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to calculate minimum end time (1 minute after start time)
const getMinEndTime = (startTime) => {
  if (!startTime) return undefined;
  const [h, m] = startTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return startTime;
  const totalMinutes = h * 60 + m + 1;
  if (totalMinutes >= 24 * 60) return '23:59';
  const nextH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const nextM = String(totalMinutes % 60).padStart(2, '0');
  return `${nextH}:${nextM}`;
};

export default function HealthScreening() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);

  // Filtering States
  const [filterType, setFilterType] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState(() => defaultPastRange().from);
  const [filterEndDate, setFilterEndDate] = useState(() => defaultPastRange().to);

  // Modal States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStudentSelectModal, setShowStudentSelectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [docLocked, setDocLocked] = useState(false); // opened by Time in: no close until the result is saved

  // Custom Notification & Confirmation Modal State
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'info', // 'info', 'success', 'warning', 'error', 'confirm'
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  // Form States
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    screening_type: 'BMI',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    announcement: '',
    target_program_id: '',
    target_year_level: '',
    target_section: '',
    grouping: 'SECTION', // 'SECTION' = one class (by-section folder) | 'CUSTOM' = a named folder, any mix of students
    folder_id: '',       // existing custom folder id, or 'new'
    folder_name: ''      // name of the new custom folder
  });

  const [filterStudents, setFilterStudents] = useState([]);
  const [studentCache, setStudentCache] = useState({}); // every student seen in the picker, so picks from other filters stay listed
  const [pickerPage, setPickerPage] = useState(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Active Schedule & Selected Student for Documentation
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [scheduleStudents, setScheduleStudents] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [participantsSchedule, setParticipantsSchedule] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // QR Scanner States & Refs

  // Documentation Dynamic Form State
  const [docData, setDocData] = useState({});

  // Extra screening transactions: reasons, make-up, doctor referral, history, results report
  const { nurseId, userId } = useOutletContext() || {};
  const [reasonModal, setReasonModal] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [makeupModal, setMakeupModal] = useState(null);
  const [referModal, setReferModal] = useState(null);
  const [referDoctors, setReferDoctors] = useState([]);
  const [referSlots, setReferSlots] = useState([]);
  const [referSlotsLoading, setReferSlotsLoading] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);

  // School years: the lists show one school year at a time (the current one first); past years stay viewable
  const [schoolYearInfo, setSchoolYearInfo] = useState(null);
  const [schoolYear, setSchoolYear] = useState('');
  const [showSchoolYearDialog, setShowSchoolYearDialog] = useState(false);
  const [classTab, setClassTab] = useState('screenings'); // inside a section folder: 'screenings' | 'students'

  // Screening types (nurse-managed): the list for the type filters, and the active ones for the schedule forms
  const [mainView, setMainView] = useState('screenings'); // 'screenings' | 'calendar' | 'types' | 'templates'
  const [calendarSchedules, setCalendarSchedules] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [pickerSearch, setPickerSearch] = useState('');
  const [screeningTypes, setScreeningTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState('');
  const activeTypes = screeningTypes.filter(t => t.is_active);

  const fetchScreeningTypes = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/screening-types?sender_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Failed to load the screening types');
      setScreeningTypes(data);
      setTypesError('');
    } catch (err) {
      console.error('Error fetching screening types:', err);
      setTypesError(err.message || 'Could not load the screening types.');
    } finally {
      setTypesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchScreeningTypes();
  }, [fetchScreeningTypes]);

  // form templates the nurse built (the result form of a CUSTOM type)
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');

  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/screening-form-templates?sender_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Failed to load the form templates');
      setTemplates(data);
      setTemplatesError('');
    } catch (err) {
      console.error('Error fetching form templates:', err);
      setTemplatesError(err.message || 'Could not load the form templates.');
    } finally {
      setTemplatesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // a template saved or deleted changes the "used by" counts of the types too
  const templatesChanged = async () => { await Promise.all([fetchTemplates(), fetchScreeningTypes()]); };

  // the type picked in the new-schedule form must be an active one
  useEffect(() => {
    if (activeTypes.length > 0 && !activeTypes.some(t => t.name === scheduleForm.screening_type)) {
      setScheduleForm(prev => ({ ...prev, screening_type: activeTypes[0].name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screeningTypes]);


  // Helper to parse Date and Time into a single JavaScript Date object
  const getScheduleDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const cleanDate = dateStr.split('T')[0];
    return new Date(`${cleanDate}T${timeStr}`);
  };

  // A screening is over once its end was confirmed or its date passed; after the end time it is still on going until then
  const screeningOver = (sch) => {
    if (!sch) return false;
    if (sch.end_confirmed_at) return true;
    return String(sch.scheduled_date).split('T')[0] < new Date().toLocaleDateString('sv-SE');
  };

  // Helper Modal Trigger Functions
  const showAlert = (message, title = 'Notice', type = 'info') => {
    setAlertModal({
      show: true,
      title,
      message,
      type,
      onConfirm: null,
      confirmText: 'OK',
      cancelText: 'Cancel'
    });
  };

  const showConfirm = (message, onConfirm, title = 'Confirmation Required', confirmText = 'Confirm', cancelText = 'Cancel') => {
    setAlertModal({
      show: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
      confirmText,
      cancelText
    });
  };

  const closeAlertModal = () => {
    setAlertModal(prev => ({ ...prev, show: false, onConfirm: null }));
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  // Handle Date Filter Changes with Validation
  const handleStartDateChange = (e) => {
    const val = e.target.value;
    if (filterEndDate && val > filterEndDate) {
      showAlert('Start date cannot be after End date.', 'Invalid Date Range', 'warning');
      return;
    }
    setFilterStartDate(val);
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    if (filterStartDate && val < filterStartDate) {
      showAlert('End date cannot be before Start date.', 'Invalid Date Range', 'warning');
      return;
    }
    setFilterEndDate(val);
  };

  // Reset goes back to the default view: yesterday and today
  const handleResetFilters = () => {
    const range = defaultPastRange();
    setFilterType('ALL');
    setFilterStartDate(range.from);
    setFilterEndDate(range.to);
  };

  const handleShowAllDates = () => {
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Print the screenings of the open folder / tab as a summary report
  const handleExportAllReport = async () => {
    const win = openReportWindow(() => showAlert('Please allow popups in your browser to preview and print the report.', 'Popup Blocked', 'warning'));
    if (!win) return;

    const rowsToExport = await fetchAllScheduleRows();
    if (!rowsToExport) {
      win.close();
      showAlert('Could not load the screenings for the report.', 'Error', 'error');
      return;
    }

    writeReport(win, {
      title: 'Health Screening Summary Report',
      columns: ['Screening Title', 'Type', 'Date', 'Time', 'Attendance (Present / Total)'],
      rows: rowsToExport.map(sch => [
        sch.title || 'N/A',
        sch.screening_type || 'N/A',
        sch.scheduled_date ? formatDate(sch.scheduled_date.split('T')[0]) : 'N/A',
        `${formatTime(sch.start_time)} - ${formatTime(sch.end_time)}`,
        `${sch.present_count ?? sch.present_students ?? 0} / ${sch.total_students || 0} Present`
      ]),
      emptyText: 'No health screenings found.'
    });
  };

  // Print the participants of the open screening
  const handleExportSingleReport = () => {
    if (!activeSchedule) return;
    const win = openReportWindow(() => showAlert('Please allow popups in your browser to preview and print the report.', 'Popup Blocked', 'warning'));
    if (!win) return;

    const isScheduleEnded = screeningOver(activeSchedule);

    let presentCount = 0;
    const rows = scheduleStudents.map(st => {
      let attendance = st.attendance_status || 'PENDING';
      if (isScheduleEnded && attendance === 'PENDING') attendance = 'ABSENT';
      if (attendance === 'PRESENT') presentCount++;

      return [
        st.student_id || '',
        `${st.first_name || ''} ${st.last_name || ''}`.trim(),
        classLabel(st.program_id, st.year_level, st.section),
        attendance,
        hasResult(st) ? 'Documented' : 'Pending'
      ];
    });

    writeReport(win, {
      title: 'Individual Screening Participant Report',
      details: [
        ['Screening Title', activeSchedule.title || 'N/A'],
        ['Screening Type', activeSchedule.screening_type || 'N/A'],
        ['Scheduled Date', activeSchedule.scheduled_date ? formatDate(activeSchedule.scheduled_date.split('T')[0]) : 'N/A'],
        ['Time', `${formatTime(activeSchedule.start_time)} - ${formatTime(activeSchedule.end_time)}`],
        ['Attendance Rate', `${presentCount} / ${scheduleStudents.length} Present`]
      ],
      columns: ['Student ID', 'Student Name', 'Program & Year/Section', 'Attendance Status', 'Record Status'],
      rows,
      emptyText: 'No participants found.'
    });
  };

  // ---- folders (Program > Year-Section), search and paging ----
  // The server filters and pages the screenings, so the browser only holds one page at a time.
  const [view, setView] = useState({ kind: 'root' });
  const [folders, setFolders] = useState({ programs: [] });
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, pageCount: 1, pageSize: SCREENINGS_PER_PAGE });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const searching = debouncedSearch !== '';
  const listMode = view.kind === 'section' || view.kind === 'custom' || view.kind === 'all' || searching;

  const queryRef = useRef({});
  queryRef.current = { view, activeTab, search: debouncedSearch, filterType, filterStartDate, filterEndDate, page, schoolYear };

  const fetchFolders = useCallback(async () => {
    try {
      const q = queryRef.current;
      const fp = new URLSearchParams();
      if (q.filterType && q.filterType !== 'ALL') fp.set('type', q.filterType);
      if (q.schoolYear) fp.set('school_year', q.schoolYear);
      const qs = fp.toString() ? `?${fp.toString()}` : '';
      const res = await fetch(`${API_BASE}/screenings/folders${qs}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.programs)) setFolders(data);
    } catch (err) {
      console.error('Error fetching folders:', err);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  // every screening, for the calendar
  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/screenings`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setCalendarSchedules(data);
    } catch (err) {
      console.error('Error fetching calendar:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  // the school years (the current one is picked first)
  const fetchSchoolYears = useCallback(async (pickCurrent = false) => {
    try {
      const res = await fetch(`${API_BASE}/school-years`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.years)) throw new Error(data?.error || 'Failed to load the school years');
      setSchoolYearInfo(data);
      if (pickCurrent) setSchoolYear(data.current || '');
    } catch (err) {
      console.error('Error fetching school years:', err);
    }
  }, []);

  useEffect(() => {
    fetchSchoolYears(true);
  }, [fetchSchoolYears]);

  // the end time of a screening passes while the nurse is on this page: look again every half minute, so the question is asked on time
  const [clock, setClock] = useState(() => Date.now());
  const [dismissedEnds, setDismissedEnds] = useState([]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) { fetchCalendar(); fetchFolders(); setClock(Date.now()); } }, 30000);
    return () => clearInterval(timer);
  }, [fetchCalendar, fetchFolders]);

  // Loads the current page (and refreshes the folder counts and the calendar)
  const fetchSchedules = useCallback(async () => {
    fetchFolders();
    fetchCalendar();
    const q = queryRef.current;
    const inList = q.view.kind === 'section' || q.view.kind === 'custom' || q.view.kind === 'all' || q.search !== '';
    if (!inList) {
      setSchedules([]);
      return;
    }
    try {
      const p = buildScreeningParams(q);
      p.set('page', String(q.page));
      p.set('pageSize', String(SCREENINGS_PER_PAGE));
      const res = await fetch(`${API_BASE}/screenings/page?${p.toString()}`);
      const data = await res.json();
      // an error response is an object, not a list: never let it reach the render
      if (!res.ok || !Array.isArray(data.schedules)) throw new Error(data?.error || 'Failed to load screenings');
      // an action emptied the last page: go back one
      if (data.schedules.length === 0 && data.total > 0 && q.page > 1) {
        setPage(data.pageCount);
        return;
      }
      setSchedules(data.schedules);
      setPageInfo({ total: data.total, pageCount: data.pageCount, pageSize: data.pageSize });
    } catch (err) {
      console.error('Error fetching schedules:', err);
      showAlert('Could not load the screening schedules. Please refresh the page.', 'Error', 'error');
    }
  }, [fetchFolders, fetchCalendar]);

  // every screening of the current folder / tab / filters (for the export)
  const fetchAllScheduleRows = async () => {
    try {
      const p = buildScreeningParams(queryRef.current);
      p.set('pageSize', 'all');
      const res = await fetch(`${API_BASE}/screenings/page?${p.toString()}`);
      const data = await res.json();
      return res.ok && Array.isArray(data.schedules) ? data.schedules : null;
    } catch (err) {
      return null;
    }
  };

  // A new folder / tab / search / filter starts at page 1; a page change just reloads.
  const queryKey = JSON.stringify([view, activeTab, debouncedSearch, filterType, filterStartDate, filterEndDate, schoolYear]);
  const lastQueryKeyRef = useRef(queryKey);
  useEffect(() => {
    if (lastQueryKeyRef.current !== queryKey) {
      lastQueryKeyRef.current = queryKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    fetchSchedules();
  }, [queryKey, page, fetchSchedules]);

  const goRoot = () => { setView({ kind: 'root' }); setSearchTerm(''); };
  const openProgram = (p) => { setView({ kind: 'program', program_id: p.program_id, program_name: p.program_name }); setSearchTerm(''); };
  const openSection = (p, s) => { setClassTab('screenings'); setView({ kind: 'section', program_id: p.program_id, program_name: p.program_name, year_level: s.year_level, section: s.section }); setSearchTerm(''); };

  const openCustomFolder = (f) => { setView({ kind: 'custom', folder_id: f.folder_id, folder_name: f.name }); setSearchTerm(''); };

  const crumbTrail = (() => {
    const trail = [{ label: 'Health Screening', onClick: goRoot }];
    if (view.kind === 'custom') trail.push({ label: view.folder_name });
    if (view.kind === 'program' || view.kind === 'section') {
      trail.push({
        label: view.program_id,
        onClick: view.kind === 'section' ? () => setView({ kind: 'program', program_id: view.program_id, program_name: view.program_name }) : undefined
      });
    }
    if (view.kind === 'section') trail.push({ label: sectionFolderName(view.program_id, view) });
    if (view.kind === 'all') trail.push({ label: 'All screenings' });
    if (view.kind === 'archive') trail.push({ label: 'Archive (graduated)' });
    if (searching && view.kind !== 'section' && view.kind !== 'custom' && view.kind !== 'all') trail.push({ label: `Search: "${debouncedSearch}"` });
    return trail;
  })();

  const folderItems = (() => {
    if (view.kind === 'program') {
      const prog = folders.programs.find(p => p.program_id === view.program_id);
      return (prog ? prog.sections : []).map(s => ({
        key: `${s.year_level}-${s.section}`,
        title: sectionFolderName(view.program_id, s),
        counts: s,
        onClick: () => openSection(prog, s)
      }));
    }
    const items = folders.programs.map(p => ({
      key: p.program_id,
      title: p.program_id,
      subtitle: p.program_name,
      counts: p,
      onClick: () => openProgram(p)
    }));
    (folders.custom_folders || []).forEach(f => items.push({
      key: `custom-${f.folder_id}`,
      variant: 'custom',
      title: f.name,
      subtitle: 'Custom folder',
      counts: f,
      onClick: () => openCustomFolder(f)
    }));
    items.push({
      key: 'archive',
      variant: 'archive',
      title: 'Archive',
      subtitle: `Graduated students (${folders.archived || 0})`,
      counts: null,
      onClick: () => { setView({ kind: 'archive' }); setSearchTerm(''); }
    });
    items.unshift({
      key: 'all',
      variant: 'all',
      title: 'All screenings',
      subtitle: 'Every screening, newest first',
      counts: null,
      onClick: () => { setView({ kind: 'all' }); setSearchTerm(''); }
    });
    return items;
  })();

  // ---- participants of the open screening: search + paging ----
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantPage, setParticipantPage] = useState(1);
  const activeScheduleId = activeSchedule?.screening_schedule_id;
  useEffect(() => {
    setParticipantSearch('');
    setParticipantPage(1);
  }, [activeScheduleId]);

  const participantPageData = (() => {
    const q = participantSearch.trim().toLowerCase();
    const list = scheduleStudents.filter(st =>
      !q || `${st.first_name || ''} ${st.last_name || ''} ${st.student_id || ''} ${st.program_name || ''} ${st.program_id || ''} ${st.section || ''}`.toLowerCase().includes(q)
    );
    return paginate(list, participantPage, PARTICIPANTS_PER_PAGE);
  })();

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`${API_BASE}/programs`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Failed to load programs');
      setPrograms(data);
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const isCustomGrouping = scheduleForm.grouping === 'CUSTOM';

  const handleFilterStudents = useCallback(async () => {
    try {
      // by section: a screening is for one class, so nothing is listed until the program and the year level are chosen.
      // custom folder: the program and year level are only filters, everyone can be listed.
      if (!isCustomGrouping && (!scheduleForm.target_program_id || !scheduleForm.target_year_level)) {
        setFilterStudents([]);
        return;
      }
      const queryParams = new URLSearchParams();

      if (scheduleForm.target_program_id) queryParams.append('program_id', scheduleForm.target_program_id);
      if (scheduleForm.target_year_level) queryParams.append('year_level', scheduleForm.target_year_level);

      const res = await fetch(`${API_BASE}/filtered-students?${queryParams.toString()}`);
      const data = await res.json();

      const studentArray = Array.isArray(data) ? data : (data.students || data.data || []);
      setFilterStudents(studentArray);
      setStudentCache(prev => {
        const next = { ...prev };
        studentArray.forEach(st => { next[st.student_id] = st; });
        return next;
      });
    } catch (err) {
      console.error('Error filtering students:', err);
      setFilterStudents([]);
    }
  }, [scheduleForm.target_program_id, scheduleForm.target_year_level, isCustomGrouping]);

  // The sections to pick from are the ones the chosen program / year really has; the section and the search then narrow the list.
  const sectionOptions = Array.from(new Set(filterStudents.map(st => st.section).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  const pickerQuery = pickerSearch.trim().toLowerCase();
  const visibleStudents = (!isCustomGrouping && !scheduleForm.target_section) ? [] : filterStudents.filter(st =>
    (!scheduleForm.target_section || st.section === scheduleForm.target_section) &&
    (!pickerQuery || `${st.first_name || ''} ${st.last_name || ''} ${st.student_id || ''}`.toLowerCase().includes(pickerQuery))
  );
  const pickerPageData = paginate(visibleStudents, pickerPage, PICKER_PER_PAGE);
  const pickedStudents = selectedStudentIds.map(id => studentCache[id]).filter(Boolean);

  useEffect(() => {
    if (showStudentSelectModal) {
      handleFilterStudents();
    }
  }, [showStudentSelectModal, handleFilterStudents]);

  useEffect(() => { setPickerPage(1); }, [scheduleForm.target_program_id, scheduleForm.target_year_level, scheduleForm.target_section, pickerSearch]);

  const handleNextToStudents = (e) => {
    e.preventDefault();

    if (scheduleForm.scheduled_date < getTodayString()) {
      showAlert('Scheduled date cannot be in the past.', 'Invalid Date', 'warning');
      return;
    }

    if (scheduleForm.scheduled_date === getTodayString() && scheduleForm.start_time < getCurrentTimeString()) {
      showAlert('Start time cannot be in the past for today.', 'Invalid Time', 'warning');
      return;
    }

    if (scheduleForm.end_time <= scheduleForm.start_time) {
      showAlert('End time must be after start time.', 'Invalid Time Range', 'warning');
      return;
    }

    if (isCustomGrouping) {
      if (!scheduleForm.folder_id) {
        showAlert('Choose a folder, or create a new one.', 'Folder Required', 'warning');
        return;
      }
      if (scheduleForm.folder_id === 'new' && !scheduleForm.folder_name.trim()) {
        showAlert('Type a name for the new folder.', 'Folder Name Required', 'warning');
        return;
      }
    }

    setShowScheduleModal(false);
    setShowStudentSelectModal(true);
  };

  const handleBackToSchedule = () => {
    setShowStudentSelectModal(false);
    setShowScheduleModal(true);
  };

  const handleSelectAllFiltered = (e) => {
    if (e.target.checked) {
      const filteredIds = visibleStudents.map(st => st.student_id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    } else {
      const filteredSet = new Set(visibleStudents.map(st => st.student_id));
      setSelectedStudentIds(prev => prev.filter(id => !filteredSet.has(id)));
    }
  };

  const areAllFilteredSelected = visibleStudents.length > 0 &&
    visibleStudents.every(st => selectedStudentIds.includes(st.student_id));

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      showAlert('Screening cannot be created without at least one target student selected.', 'Selection Required', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/screenings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleForm,
          folder_id: scheduleForm.folder_id === 'new' ? '' : scheduleForm.folder_id,
          folder_name: scheduleForm.folder_id === 'new' ? scheduleForm.folder_name.trim() : '',
          student_ids: selectedStudentIds,
          sender_id: userId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setShowStudentSelectModal(false);
        resetScheduleForm();
        fetchSchedules();
        showAlert('Health screening schedule created and students notified successfully!', 'Success', 'success');
      } else {
        showAlert(data.error || 'Failed to create screening schedule.', 'Error', 'error');
      }
    } catch (err) {
      console.error('Error creating schedule:', err);
      showAlert('Failed to create screening schedule.', 'Error', 'error');
    }
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();

    const cleanDate = editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : '';
    if (cleanDate < getTodayString()) {
      showAlert('Scheduled date cannot be in the past.', 'Invalid Date', 'warning');
      return;
    }

    if (cleanDate === getTodayString() && editingSchedule.start_time < getCurrentTimeString()) {
      showAlert('Start time cannot be in the past for today.', 'Invalid Time', 'warning');
      return;
    }

    if (editingSchedule.end_time <= editingSchedule.start_time) {
      showAlert('End time must be after start time.', 'Invalid Time Range', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/screenings/${editingSchedule.screening_schedule_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingSchedule, sender_id: userId })
      });
      if (res.ok) {
        setShowEditModal(false);
        fetchSchedules();
        showAlert('Screening schedule updated successfully!', 'Success', 'success');
      } else {
        const data = await res.json();
        showAlert(data.error || 'Failed to update schedule.', 'Error', 'error');
      }
    } catch (err) {
      console.error('Error updating schedule:', err);
      showAlert('Failed to update schedule.', 'Error', 'error');
    }
  };

  const askReason = (opts) => {
    setReasonText('');
    setReasonModal(opts);
  };

  const submitReason = async () => {
    if (reasonModal.required && !reasonText.trim()) {
      showAlert('A reason is required.', 'Reason Required', 'warning');
      return;
    }
    const callback = reasonModal.onSubmit;
    const text = reasonText.trim();
    setReasonModal(null);
    setReasonText('');
    await callback(text);
  };

  // Cancel keeps the schedule and any results on record (soft cancel)
  const handleCancelSchedule = (sch) => askReason({
    title: 'Cancel Screening',
    message: `Cancel "${sch.title}"? The students and parents will be notified, and the record is kept.`,
    label: 'Reason (shown to students)',
    required: false,
    confirmText: 'Cancel Screening',
    onSubmit: async (reason) => {
      try {
        const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}/cancel`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, sender_id: userId })
        });
        const data = await res.json();
        if (res.ok) {
          fetchSchedules();
          showAlert('Screening cancelled. Students and parents were notified.', 'Cancelled', 'success');
        } else {
          showAlert(data.error || 'Failed to cancel screening.', 'Error', 'error');
        }
      } catch (err) {
        console.error('Error cancelling schedule:', err);
        showAlert('Failed to cancel screening schedule.', 'Error', 'error');
      }
    }
  });

  const handleDeleteSchedule = (sch) => {
    showConfirm(
      `Permanently delete "${sch.title}"? No results were recorded for it. This cannot be undone.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            fetchSchedules();
            showAlert('Screening deleted.', 'Deleted', 'success');
          } else {
            showAlert(data.error || 'Failed to delete screening.', 'Error', 'error');
          }
        } catch (err) {
          showAlert('Failed to delete screening.', 'Error', 'error');
        }
      },
      'Delete Screening',
      'Yes, Delete',
      'Keep'
    );
  };

  const handleStartBatch = (sch) => {
    showConfirm(
      `Notify the students of "${sch.title}" who have not checked in that the screening is starting now?`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: userId })
          });
          const data = await res.json();
          showAlert(data.message || data.error, res.ok ? 'Students Notified' : 'Error', res.ok ? 'success' : 'error');
        } catch (err) {
          showAlert('Failed to send notifications.', 'Error', 'error');
        }
      },
      'Start Screening',
      'Send Notification',
      'Cancel'
    );
  };

  const handleSendReminders = () => {
    showConfirm(
      'Send reminders now for screenings today and tomorrow? Reminders already sent today are skipped. They also go out automatically every morning at 7:00 AM.',
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screenings/send-reminders`, { method: 'POST' });
          const data = await res.json();
          showAlert(data.message || data.error, res.ok ? 'Reminders' : 'Error', res.ok ? 'success' : 'error');
        } catch (err) {
          showAlert('Failed to send reminders.', 'Error', 'error');
        }
      },
      'Send Reminders',
      'Send Reminders',
      'Cancel'
    );
  };

  // ---------- attendance override and results ----------
  const overrideAttendance = (st, status) => askReason({
    title: `Mark ${status}`,
    message: `Change the attendance of ${st.first_name} ${st.last_name} to ${status}. This is recorded with your reason.`,
    label: 'Reason (required)',
    required: true,
    confirmText: `Mark ${status}`,
    onSubmit: async (reason) => {
      try {
        const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/students/${st.student_id}/attendance`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance_status: status, reason })
        });
        const data = await res.json();
        if (res.ok) {
          openViewModal(activeSchedule);
          fetchSchedules();
        } else {
          showAlert(data.error || 'Failed to change attendance.', 'Error', 'error');
        }
      } catch (err) {
        showAlert('Failed to change attendance.', 'Error', 'error');
      }
    }
  });

  // manual time in: asks first, then the same call the QR scan makes (marks the student PRESENT with the time now; outside the schedule the nurse confirms again).
  // The result form opens right after and stays open until it is saved, so one participant is recorded before the next time in.
  const timeIn = (st) => {
    if (isLegacySchedule(activeSchedule)) {
      showAlert(`${activeSchedule.screening_type} examinations are now Doctor Visits. This is a legacy schedule, so no new results can be recorded here.`, 'Moved to Doctor Visits', 'warning');
      return;
    }
    showConfirm(
      `Time in ${st.first_name} ${st.last_name} now?\n\nThe screening result must be recorded right after, before you can continue with the next participant.`,
      () => sendTimeIn(st),
      'Confirm Time in',
      'Yes, Time In',
      'Cancel'
    );
  };

  const sendTimeIn = async (st, force = false) => {
    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: st.student_id, force })
      });
      const data = await res.json();
      if (res.ok) {
        openViewModal(activeSchedule);
        fetchSchedules();
        // a missing form template would trap the nurse in a form that cannot be filled, so only a usable form is locked
        const usable = activeSchedule.form_kind === 'HEARING' || (activeSchedule.form_kind === 'CUSTOM' && activeSchedule.template);
        openDocumentModal({ ...st, attendance_status: 'PRESENT' }, Boolean(usable));
      } else if (res.status === 409 && data.outside_window) {
        showConfirm(`${data.error}\n\nTime in anyway?`, () => sendTimeIn(st, true), 'Outside Scheduled Time', 'Yes, Time In', 'No');
      } else {
        showAlert(data.error || 'Failed to time in.', 'Error', 'error');
      }
    } catch (err) {
      showAlert('Failed to time in.', 'Error', 'error');
    }
  };

  const handleDeleteResult = (st) => {
    showConfirm(
      `Delete the recorded result of ${st.first_name} ${st.last_name}? Their attendance stays, and the result can be documented again.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/students/${st.student_id}/result`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            openViewModal(activeSchedule);
            fetchSchedules();
          } else {
            showAlert(data.error || 'Failed to delete the result.', 'Error', 'error');
          }
        } catch (err) {
          showAlert('Failed to delete the result.', 'Error', 'error');
        }
      },
      'Delete Result',
      'Yes, Delete',
      'Keep'
    );
  };

  // ---------- make-up session for absentees ----------
  const openMakeup = (sch) => {
    const d = new Date(Date.now() + 86400000);
    const pad = (n) => String(n).padStart(2, '0');
    setMakeupModal({
      schedule: sch,
      title: `Make-up: ${sch.title}`.slice(0, 150),
      scheduled_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      start_time: (sch.start_time || '09:00').slice(0, 5),
      end_time: (sch.end_time || '10:00').slice(0, 5),
      announcement: ''
    });
  };

  const submitMakeup = async (e) => {
    e.preventDefault();
    const m = makeupModal;
    if (m.end_time <= m.start_time) {
      showAlert('End time must be after start time.', 'Invalid Time Range', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/screenings/${m.schedule.screening_schedule_id}/makeup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: m.title, scheduled_date: m.scheduled_date, start_time: m.start_time, end_time: m.end_time, announcement: m.announcement, sender_id: userId })
      });
      const data = await res.json();
      if (res.ok) {
        setMakeupModal(null);
        setShowViewModal(false);
        fetchSchedules();
        setActiveTab('upcoming');
        showAlert(`${data.message} They and their parents were notified.`, 'Make-up Scheduled', 'success');
      } else {
        showAlert(data.error || 'Failed to create the make-up session.', 'Error', 'error');
      }
    } catch (err) {
      showAlert('Failed to create the make-up session.', 'Error', 'error');
    }
  };

  // ---------- refer to a doctor ----------
  const openRefer = async (st) => {
    setReferModal({ student: st, doctor_id: '', date: '', slot: null });
    setReferSlots([]);
    if (referDoctors.length === 0) {
      try {
        const res = await fetch(`${API_BASE}/doctors`);
        const data = await res.json();
        if (data.success) setReferDoctors(data.doctors);
      } catch (err) {
        showAlert('Could not load the doctor list.', 'Error', 'error');
      }
    }
  };

  const referDoctorId = referModal?.doctor_id;
  const referDate = referModal?.date;
  useEffect(() => {
    if (!referDoctorId || !referDate) { setReferSlots([]); return undefined; }
    let cancelled = false;
    setReferSlotsLoading(true);
    (async () => {
      try {
        const wres = await fetch(`${API_BASE}/doctor-schedules/availability?doctor_id=${referDoctorId}&date=${referDate}&visit_type=Referral`);
        const w = await wres.json();
        const all = [];
        for (const win of (w.windows || [])) {
          const sres = await fetch(`${API_BASE}/doctor-schedules/${win.schedule_id}/slots?date=${referDate}`);
          const s = await sres.json();
          if (s.success) all.push(...s.slots.map(x => ({ ...x, slot_minutes: win.slot_duration_min })));
        }
        if (!cancelled) setReferSlots(all);
      } catch (err) {
        if (!cancelled) setReferSlots([]);
      } finally {
        if (!cancelled) setReferSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [referDoctorId, referDate]);

  const submitRefer = async (e) => {
    e.preventDefault();
    if (!referModal.slot) {
      showAlert('Pick a time slot for the referral.', 'Missing Details', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/students/${referModal.student.student_id}/refer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nurse_id: nurseId, sender_id: userId, doctor_id: referModal.doctor_id, start_time: referModal.slot.start_time, duration_min: referModal.slot.slot_minutes })
      });
      const data = await res.json();
      if (res.ok) {
        setReferModal(null);
        openViewModal(activeSchedule);
        showAlert('Doctor referral scheduled. The student and parents were notified.', 'Referred', 'success');
      } else {
        showAlert(data.error || 'Failed to schedule the referral.', 'Error', 'error');
      }
    } catch (err) {
      showAlert('Failed to schedule the referral.', 'Error', 'error');
    }
  };

  // ---------- student screening history ----------
  const openHistory = async (st) => {
    setHistoryModal({ student: st, rows: [], loading: true });
    try {
      const res = await fetch(`${API_BASE}/students/${encodeURIComponent(st.student_id)}/screening-history`);
      const data = await res.json();
      setHistoryModal({ student: st, rows: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      setHistoryModal({ student: st, rows: [], loading: false });
      showAlert('Could not load the screening history.', 'Error', 'error');
    }
  };

  // ---------- results report (print) and CSV ----------
  const fetchResults = async (schedule) => {
    try {
      const res = await fetch(`${API_BASE}/screenings/${schedule.screening_schedule_id}/results`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load results');
      return data;
    } catch (err) {
      showAlert(err.message || 'Could not load the results.', 'Error', 'error');
      return null;
    }
  };

  const exportResultsCsv = async (schedule) => {
    const data = await fetchResults(schedule);
    if (!data) return;
    const cols = resultColumnsFor(data.schedule?.form_kind || schedule.form_kind, data.schedule?.template);
    const header = ['Student ID', 'Last name', 'First name', 'Program', 'Year', 'Section', 'Attendance', ...cols.map(c => c[0]), 'Abnormal', 'Remarks'];
    const body = data.rows.map(r => [
      r.student_id, r.last_name, r.first_name, r.program_name, r.year_level, r.section, r.attendance_status,
      ...cols.map(c => (r.documented ? c[1](r) : '')),
      r.documented ? (r.is_abnormal ? 'Yes' : 'No') : '', r.remarks || r.attendance_note || ''
    ]);
    const safeTitle = (schedule.title || 'screening').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    downloadCsv(`${safeTitle}_results.csv`, [header, ...body]);
  };

  const printResultsReport = async (schedule) => {
    const data = await fetchResults(schedule);
    if (!data) return;

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      showAlert('Please allow popups in your browser to preview and print the report.', 'Popup Blocked', 'warning');
      return;
    }

    const cols = resultColumnsFor(data.schedule?.form_kind || schedule.form_kind, data.schedule?.template);
    const s = data.summary;
    const dist = Object.entries(s.distribution).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('');
    const rowsHtml = data.rows.map(r => `
      <tr${r.is_abnormal ? ' class="abn"' : ''}>
        <td>${escapeHtml(r.student_id)}</td>
        <td>${escapeHtml(`${r.last_name}, ${r.first_name}`)}</td>
        <td>${escapeHtml(classLabel(r.program_id, r.year_level, r.section))}</td>
        <td>${escapeHtml(r.attendance_status)}</td>
        ${cols.map(c => `<td>${escapeHtml(r.documented ? c[1](r) : '')}</td>`).join('')}
        <td>${r.documented ? (r.is_abnormal ? 'Abnormal' : 'Normal') : 'Not documented'}</td>
      </tr>`).join('');

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Screening Results</title><style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
      .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
      .report-header img { height: 60px; margin-right: 20px; }
      .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
      .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
      .details-card { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
      .cards { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
      .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 16px; min-width: 110px; }
      .card b { display: block; font-size: 22px; color: #1e3a8a; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
      th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
      td { padding: 7px 8px; border: 1px solid #e2e8f0; }
      tr.abn td { background: #fef2f2; }
      .small { width: auto; min-width: 260px; }
      .signature { margin-top: 40px; font-size: 13px; } .signature b { display: block; margin-top: 30px; }
      @media print { body { margin: 0; } }
    </style></head><body>
      <div class="report-header"><img src="${stiLogo}" alt="STI Logo" />
        <div class="report-title"><h2>STI COLLEGE BALIUAG</h2><p>Health Screening Results Report</p></div></div>
      <div class="details-card">
        <div><strong>Screening:</strong> ${escapeHtml(schedule.title)}</div>
        <div><strong>Type:</strong> ${escapeHtml(typeLabel(schedule.screening_type))}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatDate(String(schedule.scheduled_date).split('T')[0]))}</div>
        <div><strong>Time:</strong> ${escapeHtml(formatTime(schedule.start_time))} - ${escapeHtml(formatTime(schedule.end_time))}</div>
      </div>
      <div class="cards">
        <div class="card"><b>${s.total}</b>Participants</div>
        <div class="card"><b>${s.present}</b>Present</div>
        <div class="card"><b>${s.absent}</b>Absent</div>
        <div class="card"><b>${s.documented}</b>Documented</div>
        <div class="card"><b>${s.abnormal}</b>Abnormal</div>
      </div>
      ${dist ? `<table class="small"><thead><tr><th>Result</th><th>Students</th></tr></thead><tbody>${dist}</tbody></table>` : ''}
      <table><thead><tr><th>Student ID</th><th>Name</th><th>Program / Section</th><th>Attendance</th>${cols.map(c => `<th>${escapeHtml(c[0])}</th>`).join('')}<th>Result</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="12">No participants.</td></tr>'}</tbody></table>
      <div class="signature">Prepared by:<b>Marilou H. Balarao</b><i>School Nurse</i></div>
      <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
    printWindow.document.close();
  };

  const openViewModal = async (schedule) => {
    setActiveSchedule(schedule);
    try {
      const res = await fetch(`${API_BASE}/screenings/${schedule.screening_schedule_id}/students`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load participants');
      setScheduleStudents(data.students || []);
      setActiveSchedule(prev => (prev && prev.screening_schedule_id === data.schedule?.screening_schedule_id ? { ...prev, ...data.schedule } : prev));
      setShowViewModal(true);
    } catch (err) {
      console.error('Error opening participant list:', err);
      showAlert(err.message || 'Could not load the participant list.', 'Error', 'error');
    }
  };

  const openDocumentModal = (student, locked = false) => {
    if (student.attendance_status !== 'PRESENT') {
      showAlert('Student must be marked as PRESENT in order to document screening results.', 'Action Required', 'warning');
      return;
    }

    if (isLegacySchedule(activeSchedule)) {
      showAlert(`${activeSchedule.screening_type} examinations are now Doctor Visits. This is a legacy schedule, so no new results can be recorded here.`, 'Moved to Doctor Visits', 'warning');
      return;
    }

    setSelectedStudent(student);
    setDocData({
      left_ear_result: student.left_ear_result || '',
      right_ear_result: student.right_ear_result || '',
      remarks: student.remarks || '',
      answers: Object.fromEntries(Object.entries(student.answers || {}).map(([k, v]) => [k, String(v)]))
    });
    setDocLocked(locked);
    setShowDocModal(true);
  };

  const handleDocSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.student_id,
          screening_type: activeSchedule.screening_type,
          formData: activeSchedule.form_kind === 'CUSTOM' ? { answers: docData.answers, remarks: docData.remarks } : docData
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowDocModal(false);
        setDocLocked(false);
        openViewModal(activeSchedule);
        fetchSchedules();
        showAlert(data.is_abnormal ? 'Result saved and flagged ABNORMAL. The student and parents were notified. You can refer the student to a doctor from the row menu.' : 'Screening result saved successfully!', 'Success', 'success');
      } else {
        showAlert(data.error || 'Failed to save document.', 'Error', 'error');
      }
    } catch (err) {
      console.error('Error submitting document:', err);
      showAlert('Error saving document.', 'Error', 'error');
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      title: '', screening_type: activeTypes[0]?.name || '', scheduled_date: '', start_time: '', end_time: '',
      announcement: '', target_program_id: '', target_year_level: '', target_section: '',
      grouping: 'SECTION', folder_id: '', folder_name: ''
    });
    setSelectedStudentIds([]);
    setPickerSearch('');
  };

  // "Schedule screening" on a day of the calendar: the form opens with that date
  const scheduleOnDay = (day) => {
    resetScheduleForm();
    setScheduleForm(prev => ({ ...prev, scheduled_date: day }));
    setShowScheduleModal(true);
  };

  // switching between by-section and custom starts the student picks again (the class rule differs)
  const changeGrouping = (grouping) => {
    if (grouping === scheduleForm.grouping) return;
    setSelectedStudentIds([]);
    setPickerSearch('');
    setScheduleForm(prev => ({
      ...prev, grouping, target_program_id: '', target_year_level: '', target_section: '',
      folder_id: grouping === 'CUSTOM' ? prev.folder_id : '', folder_name: grouping === 'CUSTOM' ? prev.folder_name : ''
    }));
  };

  const handleDeleteFolder = () => {
    showConfirm(
      `Delete the folder "${view.folder_name}"? It has no screenings. This cannot be undone.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screening-folders/${view.folder_id}?sender_id=${encodeURIComponent(userId || '')}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            goRoot();
            fetchFolders();
            showAlert('Folder deleted.', 'Deleted', 'success');
          } else {
            showAlert(data.error || 'Failed to delete the folder.', 'Error', 'error');
          }
        } catch (err) {
          showAlert('Failed to delete the folder.', 'Error', 'error');
        }
      },
      'Delete Folder', 'Yes, Delete', 'Keep'
    );
  };

  // the end time passed and nobody confirmed the end yet: the screening stays on going, with a question
  const awaitingEnd = (sch) => {
    if (sch.status === 'Cancelled' || screeningOver(sch)) return false;
    const end = getScheduleDateTime(sch.scheduled_date, sch.end_time);
    const start = getScheduleDateTime(sch.scheduled_date, sch.start_time);
    return !!(end && start && start <= new Date(clock) && end <= new Date(clock));
  };
  const endKey = (sch) => `${sch.screening_schedule_id}|${sch.end_time}`;
  const endAsk = calendarSchedules.find((sch) => awaitingEnd(sch) && !dismissedEnds.includes(endKey(sch))) || null;

  const sendEnd = async (sch, path, body) => {
    try {
      const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}/${path}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, sender_id: userId })
      });
      const data = await res.json();
      if (!res.ok) return data.error || 'Could not save the change.';
      showAlert(data.message, 'Done', 'success');
      fetchSchedules();
      return '';
    } catch (err) {
      return 'Could not reach the server.';
    }
  };

  const schoolYearSelect = (
    <select value={schoolYear} onChange={e => setSchoolYear(e.target.value)} aria-label="School year">
      <option value="">All school years</option>
      {(schoolYearInfo?.years || []).map(y => (
        <option key={y.school_year} value={y.school_year}>{y.school_year}{y.is_current ? ' (current)' : ''}</option>
      ))}
    </select>
  );

  // records of one student (all school years)
  const openStudentRecords = (st) => openHistory(st);

  // numbers on the status tabs (from the folder summary) and the cards of this page cut into days
  const tabCounts = scopeCounts(folders, view, searching);
  const screeningDays = groupByDay(schedules, (sch) => dayKey(sch.scheduled_date));

  return (
    <div className="container-hs">
      {endAsk && (
        <SessionEndPrompt
          item={{ key: endKey(endAsk), kind: 'screening', endTime: endAsk.end_time, title: `"${endAsk.title}" (${endAsk.screening_type}) on ${formatDate(endAsk.scheduled_date)}` }}
          onConfirm={() => sendEnd(endAsk, 'confirm-end', {})}
          onExtend={(minutes) => sendEnd(endAsk, 'extend', { extra_minutes: minutes })}
          onLater={() => setDismissedEnds((list) => [...list, endKey(endAsk)])}
        />
      )}

      {/* Header */}
      <header className="header-hs">
        <div className="title-group-hs">
          <h1>Health Screening Management</h1>
          <p>Schedule, manage, and document student health assessments</p>
        </div>
      </header>

      {/* Page sections */}
      <div className="tabs-hs" role="group" aria-label="Health screening sections">
        <button
          type="button"
          className={`tab-btn-hs ${mainView === 'screenings' ? 'active-hs' : ''}`}
          aria-pressed={mainView === 'screenings'}
          onClick={() => setMainView('screenings')}
        >
          <Calendar size={16} aria-hidden="true" /> Screenings
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${mainView === 'calendar' ? 'active-hs' : ''}`}
          aria-pressed={mainView === 'calendar'}
          onClick={() => setMainView('calendar')}
        >
          <Calendar size={16} aria-hidden="true" /> Calendar
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${mainView === 'types' ? 'active-hs' : ''}`}
          aria-pressed={mainView === 'types'}
          onClick={() => setMainView('types')}
        >
          <ClipboardList size={16} aria-hidden="true" /> Screening Types
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${mainView === 'templates' ? 'active-hs' : ''}`}
          aria-pressed={mainView === 'templates'}
          onClick={() => setMainView('templates')}
        >
          <FileText size={16} aria-hidden="true" /> Form Templates
        </button>
      </div>

      {mainView === 'calendar' && (
        <ScreeningCalendar
          schedules={calendarSchedules}
          loading={calendarLoading}
          onSchedule={scheduleOnDay}
          onOpen={openViewModal}
          onEdit={(sch) => { setEditingSchedule(sch); setShowEditModal(true); }}
          onCancel={handleCancelSchedule}
          typeLabel={typeLabel}
        />
      )}

      {mainView === 'types' && (
        <ScreeningTypesManager
          types={screeningTypes}
          templates={templates}
          loading={typesLoading}
          loadError={typesError}
          senderId={userId}
          onChanged={fetchScreeningTypes}
        />
      )}

      {mainView === 'templates' && (
        <ScreeningTemplatesManager
          templates={templates}
          loading={templatesLoading}
          loadError={templatesError}
          senderId={userId}
          onChanged={templatesChanged}
        />
      )}

      {/* Folders: Program > Year-Section */}
      {mainView === 'screenings' && <FolderCrumbs trail={crumbTrail} />}

      {mainView === 'screenings' && view.kind === 'custom' && tabCounts && tabCounts.total === 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
          <button
            type="button"
            className="btn-hs btn-danger-hs hs-icon-btn"
            onClick={handleDeleteFolder}
            aria-label="Delete empty folder"
            title="Delete empty folder"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {mainView === 'screenings' && view.kind === 'archive' && (
        <ScreeningArchive apiBase={API_BASE} programs={programs} onOpenRecords={openStudentRecords} />
      )}

      {mainView === 'screenings' && view.kind === 'section' && !searching && (
        <div className="tabs-hs class-view-toggle-hs" role="group" aria-label="Show screenings or students">
          <button type="button" className={`tab-btn-hs ${classTab === 'screenings' ? 'active-hs' : ''}`} aria-pressed={classTab === 'screenings'} onClick={() => setClassTab('screenings')}>
            <Calendar size={16} aria-hidden="true" /> Screenings
          </button>
          <button type="button" className={`tab-btn-hs ${classTab === 'students' ? 'active-hs' : ''}`} aria-pressed={classTab === 'students'} onClick={() => setClassTab('students')}>
            <Users size={16} aria-hidden="true" /> Students &amp; records
          </button>
        </div>
      )}

      {mainView === 'screenings' && view.kind === 'section' && !searching && classTab === 'students' && (
        <SectionStudents apiBase={API_BASE} view={view} onOpenRecords={openStudentRecords} />
      )}

      {mainView === 'screenings' && view.kind !== 'archive' && !listMode && (
        <>
          <div className="folder-toolbar-hs">
            <div className="folder-search-hs">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                aria-label="Search all screenings"
                placeholder="Search all screenings by title, student name or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {schoolYearSelect}
<select value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Screening type">
              <option value="ALL">All types</option>
              {screeningTypes.map(t => <option key={t.screening_type_id} value={t.name}>{t.name}{t.is_active ? '' : ' (inactive)'}</option>)}
            </select>
          </div>
          {foldersLoading ? (
            <p className="hint-hs">Loading folders...</p>
          ) : (
            <FolderGrid items={folderItems} noun="screenings" emptyText="No screenings yet. Schedule one to create the first folder." />
          )}
        </>
      )}

      {mainView === 'screenings' && listMode && !(view.kind === 'section' && !searching && classTab === 'students') && (
      <>
      <div className="folder-toolbar-hs">
        <div className="folder-search-hs">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            aria-label="Search screenings"
            placeholder="Search by title, student name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {schoolYearSelect}
<select value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Screening type">
          <option value="ALL">All types</option>
          {screeningTypes.map(t => <option key={t.screening_type_id} value={t.name}>{t.name}{t.is_active ? '' : ' (inactive)'}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs-hs">
        <button
          type="button"
          className={`tab-btn-hs ${activeTab === 'upcoming' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={16} aria-hidden="true" /> Upcoming Screenings <TabCount value={tabCounts?.upcoming} />
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${activeTab === 'ongoing' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          <Clock size={16} aria-hidden="true" /> Ongoing Screenings <TabCount value={tabCounts?.ongoing} />
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${activeTab === 'past' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <CheckCircle size={16} aria-hidden="true" /> Past Screenings <TabCount value={tabCounts?.past} />
        </button>
      </div>

      {/* Date range: only past screenings need one (the type filter lives in the toolbar above) */}
      {activeTab === 'past' && (
        <div className="filter-bar-hs">
          <span className="filter-title-hs"><Filter size={16} aria-hidden="true" /> Date range</span>

          <label>
            From
            <input type="date" value={filterStartDate} max={filterEndDate || undefined} onChange={handleStartDateChange} />
          </label>

          <label>
            To
            <input type="date" value={filterEndDate} min={filterStartDate || undefined} onChange={handleEndDateChange} />
          </label>

          {(filterStartDate || filterEndDate) && (
            <button type="button" onClick={handleShowAllDates} className="btn-hs btn-secondary-hs reset-hs">
              Show all dates
            </button>
          )}

          {(filterType !== 'ALL' || filterStartDate !== defaultPastRange().from || filterEndDate !== defaultPastRange().to) && (
            <button type="button" onClick={handleResetFilters} className="btn-hs btn-secondary-hs reset-hs">
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Cards, one block per day */}
      {schedules.length === 0 ? (
        <div className="card-grid-hs">
          <div className="no-records-hs">
            <p>No screening schedules found for this status or date range.</p>
          </div>
        </div>
      ) : screeningDays.map(day => (
        <DaySection key={day.key || 'no-date'} heading={dayHeading(day.key, formatDate)} count={day.items.length} noun="screenings">
        <div className="card-grid-hs">
          {day.items.map(sch => {
            const presentCount = sch.present_count ?? sch.present_students ?? 0;
            const totalCount = sch.total_students || 0;

            return (
              <div key={sch.screening_schedule_id} className="card-hs">
                <div className="card-badge-hs">
                  {React.createElement(KIND_ICONS[sch.form_kind] || ClipboardList, { size: 14, 'aria-hidden': true })}
                  {typeLabel(sch.screening_type)}
                  {!isLegacySchedule(sch) && !Number(sch.type_active) && ' (inactive type)'}
                </div>
                <h3 className="card-title-hs">{sch.title}</h3>
                <p className="card-info-hs"><Calendar size={14} aria-hidden="true" /> {sch.scheduled_date ? formatDate(sch.scheduled_date.split('T')[0]) : ''}</p>
                <p className="card-info-hs"><Clock size={14} aria-hidden="true" /> {formatTime(sch.start_time)} - {formatTime(sch.end_time)}</p>
                <p className="card-info-hs">
                  <Users size={14} aria-hidden="true" /> <strong>{presentCount} / {totalCount}</strong> Present
                </p>
                {sch.announcement && (
                  <p className="card-info-hs announcement-preview-hs">
                    <Megaphone size={14} aria-hidden="true" /> {sch.announcement}
                  </p>
                )}
                
                <div className="card-actions-hs">
                  {sch.status === 'Cancelled' && (
                    <div className="cancelled-note-hs">Cancelled{sch.cancelled_reason ? `: ${sch.cancelled_reason}` : ''}</div>
                  )}
                  {sch.makeup_of && <div className="cancelled-note-hs makeup-tag-hs">Make-up session</div>}

                  {activeTab === 'upcoming' && sch.status !== 'Cancelled' && (
                    <>
                      <button
                        type="button"
                        className="btn-hs btn-icon-hs btn-secondary-hs"
                        onClick={() => setParticipantsSchedule(sch)}
                        title="View & Edit Participants"
                        aria-label="View and edit participants"
                      >
                        <Users size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn-hs btn-icon-hs btn-secondary-hs"
                        onClick={() => { setEditingSchedule(sch); setShowEditModal(true); }}
                        title="Edit Schedule"
                        aria-label="Edit Schedule"
                      >
                        <Edit3 size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn-hs btn-icon-hs btn-danger-hs"
                        onClick={() => handleCancelSchedule(sch)}
                        title="Cancel Schedule"
                        aria-label="Cancel Schedule"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}

                  {(activeTab === 'ongoing' || activeTab === 'past') && (
                    <button
                      type="button"
                      className="btn-hs btn-icon-hs btn-primary-hs"
                      onClick={() => openViewModal(sch)}
                      title="View & Document Screening"
                      aria-label="View & Document Screening"
                    >
                      <FileText size={16} aria-hidden="true" />
                    </button>
                  )}

                  {activeTab === 'ongoing' && (
                    <>
                      {awaitingEnd(sch) && (
                        <button type="button" className="btn-hs btn-primary-hs" onClick={() => setDismissedEnds((list) => list.filter((k) => k !== endKey(sch)))} title="The end time has passed: confirm the end or extend it" aria-label="Confirm end time or extend">
                          <BellRing size={16} aria-hidden="true" /> Confirm end time
                        </button>
                      )}
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => handleStartBatch(sch)} title="Notify students that this screening is starting" aria-label="Start Screening">
                        <Play size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleCancelSchedule(sch)} title="Cancel Schedule" aria-label="Cancel Schedule">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}

                  {activeTab === 'past' && sch.status !== 'Cancelled' && (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => printResultsReport(sch)} title="Print results report" aria-label="Print results report">
                        <Printer size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => exportResultsCsv(sch)} title="Download results (CSV)" aria-label="Download results CSV">
                        <Download size={16} aria-hidden="true" />
                      </button>
                      {(Number(sch.absent_count) + Number(sch.pending_count)) > 0 && sch.form_kind && !isLegacySchedule(sch) && (
                        <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openMakeup(sch)} title="Schedule a make-up session for absent students" aria-label="Make-up session">
                          <UserRoundPlus size={16} aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}

                  {activeTab === 'past' && Number(sch.result_count) === 0 && (
                    <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleDeleteSchedule(sch)} title="Delete (no results were recorded)" aria-label="Delete screening">
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </DaySection>
      ))}

      <Pager page={page} pageCount={pageInfo.pageCount} total={pageInfo.total} pageSize={pageInfo.pageSize} onPage={setPage} noun="screenings" />
      </>
      )}

      {/* MODAL 1: Schedule Screening Details */}
      {showScheduleModal && (
        <HsDialog onClose={() => setShowScheduleModal(false)}>
          <HsDialogHeader onClose={() => setShowScheduleModal(false)}>Schedule Health Screening (Step 1 of 2)</HsDialogHeader>
          <form onSubmit={handleNextToStudents} className="modal-form-hs">
            <div className="modal-body-hs">
              <div className="form-group-hs">
                <label htmlFor="hs-fld-1">Title</label>
                <input id="hs-fld-1" 
                  type="text" 
                  required 
                  value={scheduleForm.title} 
                  onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} 
                  placeholder="e.g. Annual Vital Signs Check" 
                />
              </div>

              <fieldset className="form-group-hs hs-group-fieldset">
                <legend>Group</legend>
                <div className="hs-choice-row">
                  <label className="hs-choice">
                    <input type="radio" name="hs-grouping" checked={!isCustomGrouping} onChange={() => changeGrouping('SECTION')} />
                    <span>By section</span>
                  </label>
                  <label className="hs-choice">
                    <input type="radio" name="hs-grouping" checked={isCustomGrouping} onChange={() => changeGrouping('CUSTOM')} />
                    <span>Custom folder</span>
                  </label>
                </div>

                {isCustomGrouping && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="hs-folder-pick">Folder</label>
                    <select
                      id="hs-folder-pick"
                      required
                      value={scheduleForm.folder_id}
                      onChange={e => setScheduleForm({ ...scheduleForm, folder_id: e.target.value })}
                    >
                      <option value="">-- Select a folder --</option>
                      {(folders.custom_folders || []).map(f => <option key={f.folder_id} value={String(f.folder_id)}>{f.name}</option>)}
                      <option value="new">+ Create a new folder...</option>
                    </select>
                    {scheduleForm.folder_id === 'new' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <label htmlFor="hs-folder-name">New folder name</label>
                        <input
                          id="hs-folder-name"
                          type="text"
                          required
                          maxLength={80}
                          value={scheduleForm.folder_name}
                          onChange={e => setScheduleForm({ ...scheduleForm, folder_name: e.target.value })}
                          placeholder="e.g. Sportsfest Player Screening"
                        />
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              <div className="form-group-hs">
                <label htmlFor="hs-fld-2">Screening Type</label>
                <select id="hs-fld-2"
                  value={scheduleForm.screening_type}
                  required
                  aria-describedby={typesError ? 'screening-type-help-hs' : undefined}
                  onChange={e => setScheduleForm({...scheduleForm, screening_type: e.target.value})}
                >
                  {activeTypes.length === 0 && <option value="">No active screening type</option>}
                  {activeTypes.map(t => <option key={t.screening_type_id} value={t.name}>{t.name}</option>)}
                </select>
                {typesError && (
                  <small id="screening-type-help-hs" style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                    {typesError}
                  </small>
                )}
              </div>

              <div className="form-group-hs">
                <label htmlFor="hs-fld-3">Scheduled Date</label>
                <input id="hs-fld-3" 
                  type="date" 
                  required 
                  min={getTodayString()}
                  value={scheduleForm.scheduled_date} 
                  onChange={e => {
                    const newDate = e.target.value;
                    setScheduleForm(prev => ({
                      ...prev,
                      scheduled_date: newDate,
                      start_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.start_time,
                      end_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.end_time
                    }));
                  }} 
                />
              </div>

              <div className="form-grid-hs">
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-4">Start Time</label>
                  <input id="hs-fld-4" 
                    type="time" 
                    required 
                    min={scheduleForm.scheduled_date === getTodayString() ? getCurrentTimeString() : undefined}
                    max={scheduleForm.end_time || undefined}
                    value={scheduleForm.start_time} 
                    onChange={e => {
                      const newStart = e.target.value;
                      setScheduleForm(prev => ({
                        ...prev,
                        start_time: newStart,
                        end_time: prev.end_time && newStart && prev.end_time <= newStart ? '' : prev.end_time
                      }));
                    }} 
                  />
                </div>
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-5">End Time</label>
                  <input id="hs-fld-5" 
                    type="time" 
                    required 
                    disabled={!scheduleForm.start_time}
                    min={getMinEndTime(scheduleForm.start_time)}
                    value={scheduleForm.end_time} 
                    onChange={e => {
                      const newEnd = e.target.value;
                      if (newEnd && scheduleForm.start_time && newEnd <= scheduleForm.start_time) {
                        showAlert('End time must be after Start time.', 'Invalid Time Range', 'warning');
                        setScheduleForm(prev => ({ ...prev, end_time: '' }));
                        return;
                      }
                      setScheduleForm(prev => ({ ...prev, end_time: newEnd }));
                    }} 
                    placeholder={!scheduleForm.start_time ? "Select Start Time first" : ""}
                  />
                </div>
              </div>

              <div className="form-group-hs">
                <label htmlFor="hs-fld-6">Announcement / Instructions (Optional)</label>
                <textarea id="hs-fld-6" 
                  rows={3}
                  value={scheduleForm.announcement} 
                  onChange={e => setScheduleForm({...scheduleForm, announcement: e.target.value})} 
                  placeholder="e.g. Please wear proper sports attire and bring your student ID card." 
                />
              </div>
            </div>

            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowScheduleModal(false)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs">
                Next: Select Target Students <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL 2: Select Target Students */}
      {showStudentSelectModal && (
        <HsDialog onClose={() => setShowStudentSelectModal(false)} size="lg">
          <HsDialogHeader onClose={() => setShowStudentSelectModal(false)}>Select Target Students (Step 2 of 2)</HsDialogHeader>
          <form onSubmit={handleCreateSchedule} className="modal-form-hs">
            <div className="modal-body-hs">
              <p className="picker-note-hs">
                {isCustomGrouping
                  ? `Folder: ${scheduleForm.folder_id === 'new' ? scheduleForm.folder_name.trim() : ((folders.custom_folders || []).find(f => String(f.folder_id) === String(scheduleForm.folder_id))?.name || '')}. Students can come from different programs, year levels and sections. Use the program, year level and section only to find students; the ticks stay when you change them. Everyone ticked is listed under "Selected students".`
                  : 'A screening is for one class: choose the program, the year level and the section, then tick the students who take part. Everyone in a screening must be from the same program, year level and section; changing the class clears the ticks.'}
              </p>
              <div className="picker-bar-hs">
                <div className="form-group-hs">
                  <label htmlFor="pick-program-hs">Academic Program</label>
                  <select
                    id="pick-program-hs"
                    required={!isCustomGrouping}
                    value={scheduleForm.target_program_id}
                    onChange={e => { if (!isCustomGrouping) setSelectedStudentIds([]); setScheduleForm({...scheduleForm, target_program_id: e.target.value, target_year_level: '', target_section: ''}); }}
                  >
                    <option value="">{isCustomGrouping ? '-- All programs --' : '-- Select program --'}</option>
                    {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                  </select>
                </div>
                <div className="form-group-hs">
                  <label htmlFor="pick-year-hs">Year Level</label>
                  <select
                    id="pick-year-hs"
                    required={!isCustomGrouping}
                    disabled={!isCustomGrouping && !scheduleForm.target_program_id}
                    value={scheduleForm.target_year_level}
                    onChange={e => { if (!isCustomGrouping) setSelectedStudentIds([]); setScheduleForm({...scheduleForm, target_year_level: e.target.value, target_section: ''}); }}
                  >
                    <option value="">{isCustomGrouping ? '-- All year levels --' : '-- Select year --'}</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    {String(programs.find(p => p.program_id === scheduleForm.target_program_id)?.type || '').toLowerCase() !== 'strand' && (
                      <>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group-hs">
                  <label htmlFor="pick-section-hs">Section</label>
                  <select
                    id="pick-section-hs"
                    required={!isCustomGrouping}
                    disabled={!isCustomGrouping && !scheduleForm.target_year_level}
                    value={scheduleForm.target_section}
                    onChange={e => { if (!isCustomGrouping) setSelectedStudentIds([]); setScheduleForm({...scheduleForm, target_section: e.target.value}); }}
                  >
                    <option value="">{isCustomGrouping ? '-- All sections --' : '-- Select section --'}</option>
                    {sectionOptions.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                  </select>
                </div>
                <div className="form-group-hs">
                  <label htmlFor="pick-search-hs">Search student</label>
                  <input
                    id="pick-search-hs"
                    type="text"
                    placeholder="Name or student ID"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="student-select-list-hs">
                <span className="list-title-hs">
                  Matching Students ({visibleStudents.length}) — {selectedStudentIds.length} Total Selected
                </span>
                <div className="table-wrapper-hs">
                  <table className="table-hs">
                    <thead>
                      <tr>
                        <th className="col-checkbox-hs">
                          <input 
                            type="checkbox" 
                            checked={areAllFilteredSelected} 
                            onChange={handleSelectAllFiltered}
                            disabled={visibleStudents.length === 0}
                            aria-label="Select or deselect all matching students"
                            title="Select/Deselect all matching students"
                          />
                        </th>
                        <th>Student Name</th>
                        <th>Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudents.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="empty-table-msg-hs">
                            {(isCustomGrouping || scheduleForm.target_section) ? 'No students match the selected filters or search.' : 'Select the program, year level and section to list the students.'}
                          </td>
                        </tr>
                      ) : (
                        pickerPageData.items.map(st => (
                          <tr key={st.student_id}>
                            <td className="col-checkbox-hs">
                              <input
                                type="checkbox"
                                aria-label={`Select ${st.first_name} ${st.last_name}`}
                                checked={selectedStudentIds.includes(st.student_id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, st.student_id]);
                                  else setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.student_id));
                                }}
                              />
                            </td>
                            <td>{st.first_name} {st.last_name}</td>
                            <td>{classLabel(st.program_id, st.year_level, st.section)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pager page={pickerPageData.page} pageCount={pickerPageData.pageCount} total={pickerPageData.total} pageSize={PICKER_PER_PAGE} onPage={setPickerPage} noun="students" />
              </div>

              {isCustomGrouping && (
                <div className="student-select-list-hs">
                  <span className="list-title-hs" role="status">Selected students ({selectedStudentIds.length})</span>
                  {pickedStudents.length === 0 ? (
                    <p className="hint-hs">No student selected yet.</p>
                  ) : (
                    <div className="table-wrapper-hs">
                      <table className="table-hs">
                        <thead>
                          <tr><th scope="col">Student Name</th><th scope="col">Class</th><th scope="col">Action</th></tr>
                        </thead>
                        <tbody>
                          {pickedStudents.map(st => (
                            <tr key={st.student_id}>
                              <td>{st.first_name} {st.last_name}</td>
                              <td>{classLabel(st.program_id, st.year_level, st.section)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-hs btn-danger-hs"
                                  aria-label={`Remove ${st.first_name} ${st.last_name}`}
                                  onClick={() => setSelectedStudentIds(prev => prev.filter(id => id !== st.student_id))}
                                >
                                  <X size={16} aria-hidden="true" /> Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={handleBackToSchedule}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <button 
                type="submit" 
                className="btn-hs btn-primary-hs"
                disabled={selectedStudentIds.length === 0}
                title={selectedStudentIds.length === 0 ? "Select at least 1 student to create schedule" : ""}
              >
                Save & Notify Students
              </button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL 2b: View & edit participants of an upcoming schedule */}
      {participantsSchedule && (
        <ScreeningParticipantsModal
          schedule={participantsSchedule}
          programs={programs}
          apiBase={API_BASE}
          senderId={userId}
          showAlert={showAlert}
          showConfirm={showConfirm}
          onClose={() => setParticipantsSchedule(null)}
          onSaved={() => {
            setParticipantsSchedule(null);
            fetchSchedules();
            showAlert('Participants updated and the students were notified.', 'Success', 'success');
          }}
        />
      )}

      {/* MODAL 3: Edit Upcoming Schedule */}
      {showEditModal && editingSchedule && (
        <HsDialog onClose={() => setShowEditModal(false)}>
          <HsDialogHeader onClose={() => setShowEditModal(false)}>Update Screening Schedule</HsDialogHeader>
          <form onSubmit={handleUpdateSchedule} className="modal-form-hs">
            <div className="modal-body-hs">
              <div className="form-group-hs">
                <label htmlFor="hs-fld-7">Title</label>
                <input id="hs-fld-7" type="text" required maxLength={150} value={editingSchedule.title || ''} onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })} />
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-8">Screening Type</label>
                <select id="hs-fld-8"
                  value={editingSchedule.screening_type}
                  disabled={Number(editingSchedule.result_count) > 0 || isLegacySchedule(editingSchedule)}
                  onChange={e => setEditingSchedule({ ...editingSchedule, screening_type: e.target.value })}
                >
                  {/* the schedule's own type stays in the list even when it is legacy or deactivated */}
                  {!activeTypes.some(t => t.name === editingSchedule.screening_type) && (
                    <option value={editingSchedule.screening_type}>{typeLabel(editingSchedule.screening_type)}{isLegacySchedule(editingSchedule) ? '' : ' (inactive)'}</option>
                  )}
                  {activeTypes.map(t => <option key={t.screening_type_id} value={t.name}>{t.name}</option>)}
                </select>
                {Number(editingSchedule.result_count) > 0 && <small className="hint-hs">Results were already recorded, so the type is locked.</small>}
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-9">Scheduled Date</label>
                <input id="hs-fld-9" 
                  type="date" 
                  required 
                  min={getTodayString()}
                  value={editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : ''} 
                  onChange={e => {
                    const newDate = e.target.value;
                    setEditingSchedule(prev => ({
                      ...prev,
                      scheduled_date: newDate,
                      start_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.start_time,
                      end_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.end_time
                    }));
                  }} 
                />
              </div>
              <div className="form-grid-hs">
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-10">Start Time</label>
                  <input id="hs-fld-10" 
                    type="time" 
                    required 
                    min={editingSchedule.scheduled_date?.split('T')[0] === getTodayString() ? getCurrentTimeString() : undefined}
                    max={editingSchedule.end_time || undefined}
                    value={editingSchedule.start_time} 
                    onChange={e => {
                      const newStart = e.target.value;
                      setEditingSchedule(prev => ({
                        ...prev,
                        start_time: newStart,
                        end_time: prev.end_time && newStart && prev.end_time <= newStart ? '' : prev.end_time
                      }));
                    }} 
                  />
                </div>
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-11">End Time</label>
                  <input id="hs-fld-11" 
                    type="time" 
                    required 
                    disabled={!editingSchedule.start_time}
                    min={getMinEndTime(editingSchedule.start_time)}
                    value={editingSchedule.end_time} 
                    onChange={e => {
                      const newEnd = e.target.value;
                      if (newEnd && editingSchedule.start_time && newEnd <= editingSchedule.start_time) {
                        showAlert('End time must be after Start time.', 'Invalid Time Range', 'warning');
                        setEditingSchedule(prev => ({ ...prev, end_time: '' }));
                        return;
                      }
                      setEditingSchedule(prev => ({ ...prev, end_time: newEnd }));
                    }} 
                  />
                </div>
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-12">Announcement / Instructions</label>
                <textarea id="hs-fld-12" rows={3} value={editingSchedule.announcement || ''} onChange={e => setEditingSchedule({...editingSchedule, announcement: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs">Update &amp; Notify</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL 4: View & Document Ongoing/Past Screening */}
      {showViewModal && activeSchedule && (
        <HsDialog onClose={() => setShowViewModal(false)} size="lg">
          <HsDialogHeader
            onClose={() => setShowViewModal(false)}
            sub={(
              <div className="modal-sub-hs">
                Attendance Rate: <strong>
                  {scheduleStudents.filter(st => st.attendance_status === 'PRESENT').length} / {scheduleStudents.length}
                </strong> Present
              </div>
            )}
            actions={(
              <>
                <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={handleExportSingleReport} title="Export participant list" aria-label="Export participant list">
                  <Printer size={16} aria-hidden="true" />
                </button>
                <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => printResultsReport(activeSchedule)} title="Results report with summary" aria-label="Results report with summary">
                  <FileText size={16} aria-hidden="true" />
                </button>
                <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => exportResultsCsv(activeSchedule)} title="Download results as CSV" aria-label="Download results as CSV">
                  <Download size={16} aria-hidden="true" />
                </button>
                {activeSchedule.status !== 'Cancelled' && (Number(activeSchedule.absent_count) + Number(activeSchedule.pending_count)) > 0 && screeningOver(activeSchedule) && activeSchedule.form_kind && !isLegacySchedule(activeSchedule) && (
                  <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openMakeup(activeSchedule)} title="Schedule a make-up session" aria-label="Schedule a make-up session">
                    <UserRoundPlus size={16} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          >
            {activeSchedule.title} - Participant List ({activeSchedule.screening_type})
          </HsDialogHeader>
          <div className="modal-body-hs">
            {activeSchedule.status === 'Cancelled' && (
              <div className="cancelled-banner-hs">This screening was cancelled{activeSchedule.cancelled_reason ? ': ' + activeSchedule.cancelled_reason : ''}. Its record is kept, but attendance and results can no longer be changed.</div>
            )}
            {scheduleStudents.length > PARTICIPANTS_PER_PAGE && (
              <div className="folder-search-hs" style={{ marginBottom: '0.75rem' }}>
                <Search size={16} aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Search participants"
                  placeholder="Search participants by name, ID or section..."
                  value={participantSearch}
                  onChange={e => { setParticipantSearch(e.target.value); setParticipantPage(1); }}
                />
              </div>
            )}

            <div className="table-wrapper-hs">
              <table className="table-hs">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Attendance Status</th>
                    <th>Record Status</th>
                    <th className="col-action-hs">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {participantPageData.items.map(st => {
                    const isDocumented = hasResult(st);
                    const isScheduleEnded = screeningOver(activeSchedule);

                    let effectiveAttendanceStatus = st.attendance_status || 'PENDING';
                    if (isScheduleEnded && effectiveAttendanceStatus === 'PENDING') {
                      effectiveAttendanceStatus = 'ABSENT';
                    }

                    const isPresent = effectiveAttendanceStatus === 'PRESENT';

                    return (
                      <tr key={st.student_id}>
                        <td>{st.first_name} {st.last_name}</td>
                        <td>{classLabel(st.program_id, st.year_level, st.section)}</td>
                        <td>
                          <span className={`badge-hs badge-status-${effectiveAttendanceStatus.toLowerCase()}-hs`}>
                            {effectiveAttendanceStatus}
                          </span>
                          {isPresent && st.attended_at && <div className="sub-note-hs">Time in: {formatTime(st.attended_at)}</div>}
                          {st.attendance_note && <div className="sub-note-hs">{st.attendance_note}</div>}
                        </td>
                        <td>
                          <span className={`badge-hs ${isDocumented ? 'badge-success-hs' : 'badge-warning-hs'}`}>
                            {isDocumented ? 'Documented' : 'Pending'}
                          </span>
                          {st.referral_appointment_id && ['Scheduled', 'Waiting for Approval', 'Completed'].includes(st.referral_status) && (
                            <div className="sub-note-hs">Referred to doctor ({st.referral_status}{st.referral_start_time ? ', ' + formatDate(String(st.referral_start_time).slice(0, 10)) : ''})</div>
                          )}
                        </td>
                        <td className="col-action-hs">
                          {(() => {
                            const cancelled = activeSchedule.status === 'Cancelled';

                            return (
                              <div className="row-actions-hs">
                                <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openHistory(st)} title="Screening records of this student" aria-label={`Screening records of ${st.first_name} ${st.last_name}`}>
                                  <History size={16} aria-hidden="true" />
                                </button>
                                {activeTab === 'ongoing' && !cancelled && !isPresent && (
                                  <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" onClick={() => timeIn(st)} title={`Time in ${st.first_name} ${st.last_name} now`} aria-label={`Time in ${st.first_name} ${st.last_name}`}>
                                    <LogIn size={16} aria-hidden="true" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`btn-hs btn-icon-hs ${isPresent && !cancelled ? 'btn-primary-hs' : 'btn-disabled-hs'}`}
                                  onClick={() => openDocumentModal({ ...st, attendance_status: effectiveAttendanceStatus })}
                                  disabled={!isPresent || cancelled}
                                  title={cancelled ? 'This screening was cancelled' : !isPresent ? 'Student must be marked PRESENT before documenting' : (isDocumented ? 'Edit result' : 'Document result')}
                                  aria-label="Document Result"
                                >
                                  <FileText size={16} aria-hidden="true" />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {participantPageData.total === 0 && <p className="hint-hs" style={{ textAlign: 'center' }}>No participants match your search.</p>}
            <Pager page={participantPageData.page} pageCount={participantPageData.pageCount} total={participantPageData.total} pageSize={PARTICIPANTS_PER_PAGE} onPage={setParticipantPage} noun="students" />
          </div>
          <div className="modal-footer-hs">
            <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowViewModal(false)}>
              Close
            </button>
          </div>
        </HsDialog>
      )}

      {/* MODAL 6: Dynamic Screening Entry Form */}
      {showDocModal && selectedStudent && activeSchedule && (
        <HsDialog onClose={docLocked ? undefined : () => setShowDocModal(false)}>
          <HsDialogHeader onClose={docLocked ? undefined : () => setShowDocModal(false)}>Document Screening: {selectedStudent.first_name} {selectedStudent.last_name}</HsDialogHeader>
          <form onSubmit={handleDocSubmit} className="modal-form-hs">
            <div className="modal-body-hs">
              {/* FORM TEMPLATE (CUSTOM) */}
              {activeSchedule.form_kind === 'CUSTOM' && (
                <>
                  {!activeSchedule.template && <p className="hint-hs" role="alert">The form template of this screening type is missing. Edit the type and pick a template.</p>}
                  {(activeSchedule.template?.fields || []).map((f) => {
                    const id = `cf-${f.key}`;
                    const value = docData.answers?.[f.key] ?? '';
                    const setAnswer = (v) => setDocData(prev => ({ ...prev, answers: { ...(prev.answers || {}), [f.key]: v } }));
                    const label = (
                      <label htmlFor={id}>
                        {f.label}{f.required ? ' *' : ''}{f.unit ? <span className="cf-unit-hs">({f.unit})</span> : null}
                      </label>
                    );
                    if (f.type === 'calculated') {
                      const calc = calculate(f, docData.answers);
                      const abnormal = calc && ((f.min !== undefined && calc.value < f.min) || (f.max !== undefined && calc.value > f.max));
                      return (
                        <div className="form-group-hs" key={f.key}>
                          {label}
                          <input id={id} type="text" readOnly value={calc ? `${calc.value}${calc.label ? ` (${calc.label})` : ''}` : ''} placeholder="Worked out from the fields above" aria-describedby={abnormal ? `${id}-flag` : undefined} />
                          {abnormal && (
                            <small id={`${id}-flag`} style={{ color: flagColor('High'), fontWeight: 600 }}>
                              Outside the normal range ({f.min !== undefined ? f.min : '...'} to {f.max !== undefined ? f.max : '...'}{f.unit ? ` ${f.unit}` : ''})
                            </small>
                          )}
                        </div>
                      );
                    }
                    if (f.type === 'select' || f.type === 'yesno') {
                      return (
                        <div className="form-group-hs" key={f.key}>
                          {label}
                          <select id={id} required={f.required} value={value} onChange={e => setAnswer(e.target.value)}>
                            <option value="">-- Select --</option>
                            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      );
                    }
                    const outside = f.type === 'number' && value !== '' && ((f.min !== undefined && Number(value) < f.min) || (f.max !== undefined && Number(value) > f.max));
                    return (
                      <div className="form-group-hs" key={f.key}>
                        {label}
                        <input
                          id={id}
                          type={f.type === 'number' ? 'number' : 'text'}
                          step={f.type === 'number' ? 'any' : undefined}
                          maxLength={f.type === 'text' ? 255 : undefined}
                          required={f.required}
                          value={value}
                          onChange={e => setAnswer(e.target.value)}
                          aria-describedby={outside ? `${id}-flag` : undefined}
                        />
                        {outside && (
                          <small id={`${id}-flag`} style={{ color: flagColor('High'), fontWeight: 600 }}>
                            Outside the normal range ({f.min !== undefined ? f.min : '...'} to {f.max !== undefined ? f.max : '...'}{f.unit ? ` ${f.unit}` : ''})
                          </small>
                        )}
                      </div>
                    );
                  })}
                  <div className="form-group-hs">
                    <label htmlFor="cf-remarks-hs">Remarks</label>
                    <textarea id="cf-remarks-hs" value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Observations / advice..." />
                  </div>
                </>
              )}

              {/* HEARING FORM */}
              {activeSchedule.form_kind === 'HEARING' && (
                <>
                  <div className="form-group-hs">
                    <label htmlFor="hs-fld-13">Left Ear</label>
                    <select id="hs-fld-13" required value={docData.left_ear_result} onChange={e => setDocData({...docData, left_ear_result: e.target.value})}>
                      <option value="">-- Select result --</option>
                      <option value="Pass">Pass</option>
                      <option value="Refer">Refer</option>
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label htmlFor="hs-fld-14">Right Ear</label>
                    <select id="hs-fld-14" required value={docData.right_ear_result} onChange={e => setDocData({...docData, right_ear_result: e.target.value})}>
                      <option value="">-- Select result --</option>
                      <option value="Pass">Pass</option>
                      <option value="Refer">Refer</option>
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label htmlFor="hs-fld-15">Remarks</label>
                    <textarea id="hs-fld-15" value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Referral notes / follow-up advice..." />
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer-hs">
              {docLocked
                ? <p className="hint-hs" role="status">Fill in the required fields and save to continue.</p>
                : <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowDocModal(false)}>Cancel</button>}
              <button type="submit" className="btn-hs btn-primary-hs">Save Document</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL: Reason prompt (cancel screening / attendance override) */}
      {reasonModal && (
        <HsDialog onClose={() => setReasonModal(null)} size="sm" zIndex={1050}>
          <HsDialogHeader onClose={() => setReasonModal(null)}>{reasonModal.title}</HsDialogHeader>
          <div className="modal-body-hs">
            {reasonModal.message && <p className="hint-hs">{reasonModal.message}</p>}
            <div className="form-group-hs">
              <label htmlFor="hs-fld-16">{reasonModal.label}</label>
              <textarea id="hs-fld-16" rows={3} autoFocus value={reasonText} onChange={e => setReasonText(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer-hs">
            <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setReasonModal(null)}>Back</button>
            <button type="button" className="btn-hs btn-primary-hs" onClick={submitReason}>{reasonModal.confirmText}</button>
          </div>
        </HsDialog>
      )}

      {/* MODAL: Make-up session for absent students */}
      {makeupModal && (
        <HsDialog onClose={() => setMakeupModal(null)} zIndex={1050}>
          <HsDialogHeader onClose={() => setMakeupModal(null)}>Schedule Make-up Session</HsDialogHeader>
          <form onSubmit={submitMakeup} className="modal-form-hs">
            <div className="modal-body-hs">
              <p className="hint-hs">
                A new {makeupModal.schedule.screening_type} screening is created only for the students who were absent from
                &quot;{makeupModal.schedule.title}&quot;. Students already booked into another make-up are skipped.
              </p>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-17">Title</label>
                <input id="hs-fld-17" type="text" required maxLength={150} value={makeupModal.title} onChange={e => setMakeupModal({ ...makeupModal, title: e.target.value })} />
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-18">Date</label>
                <input id="hs-fld-18" type="date" required min={getTodayString()} value={makeupModal.scheduled_date} onChange={e => setMakeupModal({ ...makeupModal, scheduled_date: e.target.value })} />
              </div>
              <div className="form-grid-hs">
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-19">Start Time</label>
                  <input id="hs-fld-19" type="time" required value={makeupModal.start_time} onChange={e => setMakeupModal({ ...makeupModal, start_time: e.target.value })} />
                </div>
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-20">End Time</label>
                  <input id="hs-fld-20" type="time" required value={makeupModal.end_time} onChange={e => setMakeupModal({ ...makeupModal, end_time: e.target.value })} />
                </div>
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-21">Announcement / Instructions</label>
                <textarea id="hs-fld-21" rows={2} value={makeupModal.announcement} onChange={e => setMakeupModal({ ...makeupModal, announcement: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setMakeupModal(null)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs">Create &amp; Notify</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL: Refer a student to a doctor */}
      {referModal && (
        <HsDialog onClose={() => setReferModal(null)} zIndex={1050}>
          <HsDialogHeader onClose={() => setReferModal(null)}>Refer to Doctor: {referModal.student.first_name} {referModal.student.last_name}</HsDialogHeader>
          <form onSubmit={submitRefer} className="modal-form-hs">
            <div className="modal-body-hs">
              <p className="hint-hs">Creates a Referral visit in the doctor&apos;s open schedule. The result of this screening is attached to the visit.</p>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-22">Doctor</label>
                <select id="hs-fld-22" required value={referModal.doctor_id} onChange={e => setReferModal({ ...referModal, doctor_id: e.target.value, slot: null })}>
                  <option value="">-- Select Doctor --</option>
                  {referDoctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                </select>
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-23">Date</label>
                <input id="hs-fld-23" type="date" required min={getTodayString()} value={referModal.date} onChange={e => setReferModal({ ...referModal, date: e.target.value, slot: null })} />
              </div>
              {referModal.doctor_id && referModal.date && (
                <div className="form-group-hs">
                  <span className="list-title-hs" id="refer-slots-label-hs">Available Slots</span>
                  {referSlotsLoading ? <p className="hint-hs">Loading slots...</p> : referSlots.length === 0 ? (
                    <p className="hint-hs warn-hs">This doctor has no open schedule on that date. Set one up under Doctor Schedule.</p>
                  ) : (
                    <div className="slot-list-hs" role="group" aria-labelledby="refer-slots-label-hs">
                      {referSlots.map(s => (
                        <button
                          key={s.start_time}
                          type="button"
                          aria-pressed={referModal.slot?.start_time === s.start_time}
                          disabled={!s.available}
                          className={`slot-btn-hs ${referModal.slot?.start_time === s.start_time ? 'slot-selected-hs' : ''}`}
                          onClick={() => setReferModal({ ...referModal, slot: s })}
                        >
                          {time12(s.start_time.slice(11))}
                          <small>{s.available ? 'Open' : s.past ? 'Passed' : 'Full'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setReferModal(null)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs" disabled={!referModal.slot}>Schedule Referral</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL: Student screening history */}
      {historyModal && (
        <StudentScreeningHistoryModal student={historyModal.student} rows={historyModal.rows} loading={historyModal.loading} onClose={() => setHistoryModal(null)} />
      )}

      {showSchoolYearDialog && (
        <SchoolYearDialog
          info={schoolYearInfo}
          apiBase={API_BASE}
          senderId={userId}
          onClose={() => setShowSchoolYearDialog(false)}
          onSaved={(data) => {
            setShowSchoolYearDialog(false);
            fetchSchoolYears(true);
            fetchSchedules();
            showAlert(data.message, 'School Year Updated', 'success');
          }}
        />
      )}

      {/* MODAL 7: Unified Alert & Confirmation Dialog (shared modals: focus trap, Esc, focus return) */}
      {alertModal.type === 'confirm' ? (
        <ConfirmModal
          isOpen={alertModal.show}
          onCancel={closeAlertModal}
          onConfirm={() => {
            const action = alertModal.onConfirm;
            closeAlertModal();
            if (action) action();
          }}
          title={alertModal.title}
          message={alertModal.message}
          confirmLabel={alertModal.confirmText || 'Confirm'}
          cancelLabel={alertModal.cancelText || 'Cancel'}
        />
      ) : (
        <AlertModal
          isOpen={alertModal.show}
          onClose={closeAlertModal}
          variant={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
        />
      )}
    </div>
  );
}