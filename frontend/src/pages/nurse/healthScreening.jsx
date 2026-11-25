// healthScreening.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Calendar, Clock, Users, Eye, Activity, Smile, HeartPulse, Ear, 
  X, CheckCircle, Edit3, Trash2, FileText, ArrowLeft, ArrowRight, Megaphone, Printer,
  Play, UserRoundPlus, Search, ClipboardList, BellRing, History, LogIn, FolderPlus,
  Plus, RotateCcw, CalendarDays, Folder, AlertTriangle, Lock, Scale, Upload, Layers, Archive, ArchiveRestore, Flag, Dumbbell, ShieldCheck, Check, Ban, RefreshCw
} from 'lucide-react';

import { openReportWindow, writeReport, escapeHtml } from '../../utils/printReport';
import stiLogo from '../../assets/sti-logof.png';
import { formatDate, formatTime } from '../../utils/datetime';
import { outWord } from '../../utils/vitals';
import '../../styles/nurse/HealthScreening.css';
import { FolderCrumbs, Pager, sectionFolderName, paginate, scopeCounts, groupByDay, dayKey, dayHeading, DaySection } from '../../components/common/RecordFolders';
import ScreeningCalendar from '../../components/nurse/ScreeningCalendar';
import ScreeningParticipantsModal from '../../components/nurse/ScreeningParticipantsModal';
import ScreeningImportModal from '../../components/nurse/ScreeningImportModal';
import AutoTimeFields from '../../components/nurse/AutoTimeFields';
import SectionStudents from '../../components/nurse/SectionStudents';
import StudentScreeningHistoryModal from '../../components/nurse/StudentScreeningHistoryModal';
import { calculate } from '../../utils/formula';
import { bpFieldsOf, buildAutoRemark, playDecision, playRangeText, bloodPressureLabel, playClearance, PLAY_STATUS_LABELS, PLAY_SENTENCE_RE, bpPair, bpText, bpParse, BP_PATTERN } from '../../utils/screeningRemarks';
import { classLabel } from '../../utils/scheduling';
import { FormPdfButton } from '../../components/common/FormDocument';
import { buildScreeningModel } from '../../utils/formModels';
import SessionEndPrompt from '../../components/scheduling/SessionEndPrompt';
import { HsDialog, HsDialogHeader } from '../../components/nurse/HsDialog';
import ConfirmModal from '../../components/common/ConfirmModal';
import AlertModal from '../../components/common/AlertModal';
import TabDot from '../../components/common/TabDot';
import { useUnseenDots } from '../../hooks/useUnseenDots';
import { useScreeningSync, notifyScreeningChanged } from '../../hooks/useScreeningSync';
import { setPageDotCount } from '../../utils/pageDots';

// The screening types come from GET /api/screening-types (screening_types table). A type's form_kind picks the result form.
// Dental / Vision moved to Doctor Visits. Old schedules still show up (read-only) as legacy; the server answers form_kind DENTAL / VISION for them.
const LEGACY_FORM_KINDS = ['DENTAL', 'VISION'];
const isLegacySchedule = (sch) => LEGACY_FORM_KINDS.includes(sch?.form_kind);
const typeLabel = (type) => (['Dental', 'Vision'].includes(type) ? `${type} (legacy)` : type);
// The only screening type for new screenings (BMI + Vital Signs in one form)
const SCREENING_TYPE = 'BMI & Vital Signs';
const KIND_ICONS ={ BMI: Activity, VITAL_SIGNS: HeartPulse, HEARING: Ear, CUSTOM: ClipboardList, DENTAL: Smile, VISION: Eye };
const hasResult = (st) => !!(st.bmi_log_id || st.custom_record_id || st.vital_record_id || st.hearing_record_id || st.dental_record_id || st.vision_record_id);

// Two-dot step bar for the schedule form (replaces "Step 1 of 2" in the title)
const StepDots = ({ step }) => (
  <ol className="pk-steps-hs" aria-label={`Step ${step} of 2`}>
    <li className={step === 1 ? 'cur-hs' : 'done-hs'} aria-current={step === 1 ? 'step' : undefined}>
      <span className="pk-step-n-hs">{step > 1 ? <CheckCircle size={16} aria-label="Done" role="img" /> : '1'}</span>Details
    </li>
    <li className="pk-step-line-hs" aria-hidden="true" />
    <li className={step === 2 ? 'cur-hs' : ''} aria-current={step === 2 ? 'step' : undefined}>
      <span className="pk-step-n-hs">2</span>Students
    </li>
  </ol>
);

// Cosmetic icon of a screening type by name (the result form still comes from form_kind)
const TYPE_NAME_ICONS = { 'Vital Signs': HeartPulse, BMI: Scale, 'BMI & Vital Signs': Activity, Hearing: Ear };
const typeIcon = (name, formKind) => TYPE_NAME_ICONS[name] || KIND_ICONS[formKind] || ClipboardList;

const FOLDER_VARIANT_ICONS = { all: CalendarDays, custom: Layers, archive: Archive };
const PHASE_META = { upcoming: [Calendar, 'Upcoming', 'chip-info-hs'], ongoing: [Clock, 'Ongoing', 'chip-ok-hs'], past: [CheckCircle, 'Past', ''] };

// Folder cards: icon tile, name, one line below, then the pill of the open status tab (upcoming / ongoing / past) with icon + number.
// A folder is only listed under a status when it has a screening in that status (the page filters the items).
const ScreeningFolders = ({ items, phase }) => {
  if (items.length === 0) return <div className="no-records-hs"><Folder size={28} aria-hidden="true" /><p>None</p></div>;
  return (
    <div className="fld-grid-hs">
      {items.map((f) => {
        const c = f.counts;
        const running = !!c && Number(c.ongoing) > 0;
        const Icon = FOLDER_VARIANT_ICONS[f.variant] || Folder;
        const [PhaseIcon, phaseName, phaseTone] = PHASE_META[phase] || PHASE_META.upcoming;
        return (
          <button type="button" key={f.key} className="fld-hs" onClick={f.onClick}>
            <span className="fld-top-hs">
              <span className="fld-ico-hs"><Icon size={20} aria-hidden="true" /></span>
              <span className="fld-text-hs">
                <span className="fld-title-hs">{f.title}</span>
                {f.subtitle && <span className="fld-sub-hs">{f.subtitle}</span>}
              </span>
              {running && <span className="fld-dot-hs" title="Ongoing"><span className="sr-only-hs">Ongoing</span></span>}
            </span>
            {c && (
              <span className="fld-counts-hs">
                <span className={`chip-hs ${phaseTone}`} title={phaseName}><PhaseIcon size={14} aria-hidden="true" />{Number(c[phase]) || 0}<span className="sr-only-hs"> {phaseName.toLowerCase()}</span></span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};


// Red asterisk after the label of a required field (the input itself carries `required`)
const Req = () => <span className="req-hs" aria-hidden="true">*</span>;

// Short range text for a number outside its normal range
const rangeFlagText = (f) => {
  const unit = f.unit ? ` ${f.unit}` : '';
  if (f.min === undefined) return `up to ${f.max}${unit}`;
  if (f.max === undefined) return `from ${f.min}${unit}`;
  return `${f.min} to ${f.max}${unit}`;
};
// Badge beside a field: color + icon + word, never color alone
// bp: a blood pressure reading, so a value outside the range reads "Low blood" / "High blood"; else "Low" / "High" ("High Temperature")
const StateChip = ({ state, id, bp = false, label = '' }) => {
  if (!state) return null;
  const normal = state === 'Normal';
  const text = normal ? 'Normal' : bp ? `${state} blood` : outWord(label, state === 'Low');
  return (
    <span id={id} className={`chip-hs ${normal ? 'chip-ok-hs' : 'chip-warn-hs'}`} role="status">
      {normal ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />} {text}
    </span>
  );
};
// Normal / Low / High of a value against the field's normal range ('' = no range or no value)
const rangeState = (f, v) => {
  if (v === '' || v === undefined || v === null || (f.min === undefined && f.max === undefined)) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return f.min !== undefined && n < f.min ? 'Low' : f.max !== undefined && n > f.max ? 'High' : 'Normal';
};

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

const isPhysicalSchedule = (sch) => sch?.screening_category === 'PHYSICAL';
const CATEGORY_LABELS = { GENERAL: 'General Screening', PHYSICAL: 'Physical Activities' };
const PLAY_TONES = { ALLOWED: 'chip-ok-hs', NOT_ALLOWED: 'chip-bad-hs' };

// A form template (CUSTOM) gives one column per field, in the order of the form; systolic + diastolic become one BP column
const templateColumns = (template) => {
  const pair = bpPair(template?.fields);
  const cols = [];
  (template?.fields || []).forEach((f) => {
    if (pair && f.key === pair.dia.key) return;
    if (pair && f.key === pair.sys.key) {
      cols.push(['BP (mmHg)', (r) => (r.answers && (r.answers[pair.sys.key] !== undefined || r.answers[pair.dia.key] !== undefined) ? `${r.answers[pair.sys.key] ?? ''}/${r.answers[pair.dia.key] ?? ''}` : '')]);
      return;
    }
    cols.push(templateColumn(f));
  });
  return cols;
};
const templateColumn = (f) => [
  f.unit ? `${f.label} (${f.unit})` : f.label,
  (r) => {
    if (!r.answers || r.answers[f.key] === undefined) return '';
    const label = r.answers[`${f.key}__label`];
    return label ? `${r.answers[f.key]} (${label})` : r.answers[f.key];
  }
];

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
const PICKER_PER_PAGE = 40;



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

// Past Screenings lists every finished screening of the folder (a folder sits under Past because it has one), narrow it with the dates
const defaultPastRange = () => ({ from: '', to: '' });


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
    screening_type: SCREENING_TYPE,
    screening_category: 'GENERAL', // 'GENERAL' = one class, class folder | 'PHYSICAL' = Physical Activities, random participants, allow-to-play list
    scheduled_date: getTodayString(), // today; the time fills itself with the next free time from now
    start_time: '',
    end_time: '',
    announcement: '',
    target_program_id: '',
    target_year_level: '',
    target_section: '',
    grouping: 'SECTION', // 'SECTION' = one class (by-section folder) | 'CUSTOM' = a named folder, any mix of students
    folder_mode: 'existing', // 'existing' = file it in a folder that exists | 'new' = start a new folder
    section_key: '',     // existing by-section folder, "PROGRAM|year|section"
    folder_id: '',       // existing custom folder id, or 'new'
    folder_name: ''      // name of the new custom folder
  });
  const [importData, setImportData] = useState(null); // { schedule, students } of the screening being imported into

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
  // the remark writes itself from the answers until the nurse types in it
  const [remarksTouched, setRemarksTouched] = useState(false);
  const docFields = activeSchedule?.form_kind === 'CUSTOM' ? (activeSchedule?.template?.fields || []) : [];
  const docAsthma = selectedStudent ? { has: Number(selectedStudent.has_asthma_history) === 1, triggers: selectedStudent.asthma_triggers || '' } : null;
  // Physical Activities: the clearance decision, always automatic (vital signs; a heart problem or seizure history also blocks)
  const isPhysicalDoc = isPhysicalSchedule(activeSchedule) && docFields.length > 0;
  const docHealth = selectedStudent?.health_play || null;
  const docClearance = isPhysicalDoc ? playClearance(docFields, docData.answers, docHealth) : null;
  const docPlayStatus = docClearance ? docClearance.status : '';
  const docPlaySentence = docClearance ? docClearance.sentence : '';
  const bpDocPair = bpPair(docFields);
  const docBp = bpFieldsOf(docFields);
  const [bpDraft, setBpDraft] = useState('');
  useEffect(() => {
    if (!showDocModal || remarksTouched || docFields.length === 0) return;
    const auto = buildAutoRemark(docFields, docData.answers, { category: activeSchedule?.screening_category, health: docHealth });
    setDocData((prev) => (prev.remarks === auto ? prev : { ...prev, remarks: auto }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDocModal, remarksTouched, docData.answers, selectedStudent, activeSchedule]);
  // a remark the nurse already has keeps her words, but its status line follows the decision shown above
  useEffect(() => {
    if (!showDocModal || !remarksTouched || !docPlaySentence) return;
    const line = docPlaySentence;
    setDocData((prev) => {
      const text = prev.remarks || '';
      if (!PLAY_SENTENCE_RE.test(text)) return prev;
      const next = text.replace(PLAY_SENTENCE_RE, line);
      return next === text ? prev : { ...prev, remarks: next };
    });
  }, [showDocModal, remarksTouched, docPlaySentence]);

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
  const [classTab, setClassTab] = useState('screenings'); // inside a section folder: 'screenings' | 'students'

  const [mainView, setMainView] = useState('screenings'); // 'screenings' | 'calendar' | 'archive'
  const [calendarSchedules, setCalendarSchedules] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerShow, setPickerShow] = useState('all'); // by-section roster filter: 'all' | 'added' | 'left'
  const isPhysical = scheduleForm.screening_category === 'PHYSICAL';


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
    return String(sch.scheduled_date).split('T')[0] < new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
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
    const win = openReportWindow(() => showAlert('Allow popups to print.', 'Popup Blocked', 'warning'));
    if (!win) return;

    const rowsToExport = await fetchAllScheduleRows();
    if (!rowsToExport) {
      win.close();
      showAlert('Could not load the screenings for the report.', 'Error', 'error');
      return;
    }

    const q = queryRef.current;
    const folderName = q.view.kind === 'custom' ? q.view.folder_name : q.view.kind === 'section' ? sectionFolderName(q.view.program_id, q.view) : 'All folders';
    writeReport(win, {
      title: 'Health Screening Summary Report',
      details: [
        ['Folder', folderName],
        ['Status', { upcoming: 'Upcoming', ongoing: 'Ongoing', past: 'Past' }[q.activeTab] || ''],
        ['Screenings', String(rowsToExport.length)]
      ],
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
    const win = openReportWindow(() => showAlert('Allow popups to print.', 'Popup Blocked', 'warning'));
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
  // the All folder only holds the other folders (a list of folder cards); screenings list inside a section / custom folder or while searching
  const listMode = view.kind === 'section' || view.kind === 'custom' || searching;

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

  // Red dots on the tabs: a tab shows one while it holds a screening / type / template / archive entry the nurse has not seen there; opening the tab clears it
  const phaseOfSchedule = (sch) => {
    if (sch.status === 'Cancelled' || screeningOver(sch)) return 'past';
    const start = getScheduleDateTime(sch.scheduled_date, sch.start_time);
    return start && start > new Date(clock) ? 'upcoming' : 'ongoing';
  };
  const idsOfPhase = (phase) => (calendarLoading ? null : calendarSchedules.filter((sch) => phaseOfSchedule(sch) === phase).map((sch) => sch.screening_schedule_id));
  const tabDots = useUnseenDots(`healthScreening:${userId || ''}`, {
    'phase:upcoming': idsOfPhase('upcoming'),
    'phase:ongoing': idsOfPhase('ongoing'),
    'phase:past': idsOfPhase('past'),
    calendar: calendarLoading ? null : calendarSchedules.filter((sch) => sch.status !== 'Cancelled').map((sch) => sch.screening_schedule_id),
    archive: foldersLoading ? null : [
      ...(folders.archived_folders || []).map((f) => f.folder_id),
      ...(folders.archived_screenings || []).map((s) => `s${s.screening_schedule_id}`)
    ]
  }, [mainView, ...(mainView === 'screenings' ? [`phase:${activeTab}`] : [])]);
  const screeningsDot = ['upcoming', 'ongoing', 'past'].some((p) => tabDots[`phase:${p}`]);
  // the sidebar item shows how many dots the page holds
  const dotCount = ['calendar', 'archive'].filter((k) => tabDots[k] && k !== mainView).length
    + (mainView === 'screenings'
      ? ['upcoming', 'ongoing', 'past'].filter((p) => tabDots[`phase:${p}`] && p !== activeTab).length
      : (screeningsDot ? 1 : 0));
  useEffect(() => { setPageDotCount('/HealthScreening', dotCount); }, [dotCount]);

  // Loads the current page (and refreshes the folder counts and the calendar)
  const fetchSchedules = useCallback(async () => {
    fetchFolders();
    fetchCalendar();
    const q = queryRef.current;
    const inList = q.view.kind === 'section' || q.view.kind === 'custom' || q.search !== '';
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
      showAlert('Could not load screenings.', 'Error', 'error');
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

  const goAll = () => { setView({ kind: 'all' }); setSearchTerm(''); };

  const crumbTrail = (() => {
    const trail = [{ label: 'Screenings', onClick: goRoot }];
    // Past Screening: every folder sits inside the All folder
    if (activeTab === 'past' && ['custom', 'program', 'section'].includes(view.kind)) trail.push({ label: 'All screenings', onClick: goAll });
    if (view.kind === 'custom') trail.push({ label: view.folder_name });
    if (view.kind === 'program' || view.kind === 'section') {
      trail.push({
        label: view.program_id,
        onClick: view.kind === 'section' ? () => setView({ kind: 'program', program_id: view.program_id, program_name: view.program_name }) : undefined
      });
    }
    if (view.kind === 'section') trail.push({ label: sectionFolderName(view.program_id, view) });
    if (view.kind === 'all') trail.push({ label: 'All screenings' });
    if (searching && view.kind !== 'section' && view.kind !== 'custom') trail.push({ label: `Search: "${debouncedSearch}"` });
    return trail;
  })();

  // a folder is listed under a status only when it has a screening in that status
  const inPhase = (c) => Number(c?.[activeTab]) > 0;

  const folderItems = (() => {
    if (view.kind === 'program') {
      const prog = folders.programs.find(p => p.program_id === view.program_id);
      return (prog ? prog.sections : []).filter(inPhase).map(s => ({
        key: `${s.year_level}-${s.section}`,
        title: sectionFolderName(view.program_id, s),
        counts: s,
        onClick: () => openSection(prog, s)
      }));
    }
    const items = folders.programs.filter(inPhase).map(p => ({
      key: p.program_id,
      title: p.program_id,
      subtitle: p.program_name,
      counts: p,
      onClick: () => openProgram(p)
    }));
    (folders.custom_folders || []).filter(inPhase).forEach(f => items.push({
      key: `custom-${f.folder_id}`,
      variant: 'custom',
      title: f.name,
      subtitle: 'Custom folder',
      counts: f,
      onClick: () => openCustomFolder(f)
    }));
    // Past Screening: the nurse opens the All folder first, the program / custom folders are inside it
    if (activeTab === 'past' && view.kind !== 'all') {
      return [{
        key: 'all',
        variant: 'all',
        title: 'All screenings',
        subtitle: 'Every screening, newest first',
        counts: null,
        onClick: goAll
      }];
    }
    return items;
  })();

  // the All folder exists only under Past Screening
  useEffect(() => {
    if (view.kind === 'all' && activeTab !== 'past') goRoot();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // an open folder with nothing left in the chosen status (another tab picked, or its last screening was cancelled) closes to the level above
  useEffect(() => {
    if (foldersLoading || !['program', 'section', 'custom'].includes(view.kind)) return;
    const prog = folders.programs.find(p => p.program_id === view.program_id);
    const c = view.kind === 'program' ? prog : scopeCounts(folders, view, false);
    if (c && Number(c[activeTab]) > 0) return;
    if (view.kind === 'section' && Number(prog?.[activeTab]) > 0) {
      setView({ kind: 'program', program_id: view.program_id, program_name: view.program_name });
      return;
    }
    goRoot();
  }, [activeTab, folders, foldersLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // totals behind the status tabs: the open folder, the open program, or every folder
  const phaseCounts = (() => {
    if (view.kind === 'section' || view.kind === 'custom' || view.kind === 'all') return scopeCounts(folders, view, false);
    const src = view.kind === 'program'
      ? folders.programs.filter(p => p.program_id === view.program_id)
      : [...folders.programs, ...(folders.custom_folders || [])];
    return src.reduce((acc, r) => {
      ['upcoming', 'ongoing', 'past'].forEach(k => { acc[k] += Number(r[k]) || 0; });
      return acc;
    }, { upcoming: 0, ongoing: 0, past: 0 });
  })();

  // ---- participants of the open screening: search + paging ----
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantPage, setParticipantPage] = useState(1);
  const [attFilter, setAttFilter] = useState('ALL'); // ALL | PRESENT | ABSENT | PENDING
  const [playFilter, setPlayFilter] = useState('ALL'); // Physical Activities: ALL | ALLOWED | NOT_ALLOWED | NONE
  const activeScheduleId = activeSchedule?.screening_schedule_id;
  useEffect(() => {
    setParticipantSearch('');
    setParticipantPage(1);
    setAttFilter('ALL');
    setPlayFilter('ALL');
  }, [activeScheduleId]);

  // a pending student of a finished screening counts as absent
  const attendanceOf = (st) => {
    const status = st.attendance_status || 'PENDING';
    return status === 'PENDING' && screeningOver(activeSchedule) ? 'ABSENT' : status;
  };

  const participantPageData = (() => {
    const q = participantSearch.trim().toLowerCase();
    const list = scheduleStudents.filter(st =>
      (attFilter === 'ALL' || attendanceOf(st) === attFilter) &&
      (playFilter === 'ALL' || (st.play_status || 'NONE') === playFilter) &&
      (!q || `${st.first_name || ''} ${st.last_name || ''} ${st.student_id || ''} ${st.program_name || ''} ${st.program_id || ''} ${st.section || ''}`.toLowerCase().includes(q))
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

  const isCustomGrouping = isPhysical || scheduleForm.grouping === 'CUSTOM';
  // an existing by-section folder fixes the class: program, year level and section cannot change on the student step
  const lockedClass = !isCustomGrouping && scheduleForm.folder_mode === 'existing' && !!scheduleForm.section_key;

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
  const addedInView = visibleStudents.filter(st => selectedStudentIds.includes(st.student_id)).length;
  // by section only: show everyone, who is added or who is left out (a mixed group has the tray instead)
  const listedStudents = (!isCustomGrouping && pickerShow !== 'all')
    ? visibleStudents.filter(st => (pickerShow === 'added') === selectedStudentIds.includes(st.student_id))
    : visibleStudents;
  const pickerPageData = paginate(listedStudents, pickerPage, PICKER_PER_PAGE);
  const pickedStudents = selectedStudentIds.map(id => studentCache[id]).filter(Boolean);

  useEffect(() => {
    if (showStudentSelectModal) {
      handleFilterStudents();
    }
  }, [showStudentSelectModal, handleFilterStudents]);

  useEffect(() => { if (showStudentSelectModal) setPickerShow('all'); }, [showStudentSelectModal]);

  // existing custom folder: the screening starts with the people of the folder's latest screening; the nurse adds or removes for this one only
  const [folderSource, setFolderSource] = useState(null); // { title, scheduled_date } of the screening the list came from
  const prefilledFolderRef = useRef('');
  useEffect(() => {
    if (!showStudentSelectModal) return;
    const fid = scheduleForm.folder_id;
    if (!(isCustomGrouping && scheduleForm.folder_mode === 'existing' && fid && fid !== 'new')) {
      prefilledFolderRef.current = '';
      setFolderSource(null);
      return;
    }
    if (prefilledFolderRef.current === String(fid)) return;
    prefilledFolderRef.current = String(fid);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/screening-folders/${fid}/members`);
        const data = await res.json();
        if (cancelled || !res.ok || !Array.isArray(data.students)) return;
        setStudentCache(prev => {
          const next = { ...prev };
          data.students.forEach(st => { next[st.student_id] = st; });
          return next;
        });
        setSelectedStudentIds(data.students.map(st => st.student_id));
        setFolderSource(data.source);
      } catch (err) {
        console.error('Error loading the folder members:', err);
        prefilledFolderRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [showStudentSelectModal, scheduleForm.folder_id, scheduleForm.folder_mode, isCustomGrouping]);

  useEffect(() => { setPickerPage(1); }, [scheduleForm.target_program_id, scheduleForm.target_year_level, scheduleForm.target_section, pickerSearch, pickerShow]);

  const handleNextToStudents = (e) => {
    e.preventDefault();

    if (scheduleForm.scheduled_date < getTodayString()) {
      showAlert('Scheduled date cannot be in the past.', 'Invalid Date', 'warning');
      return;
    }

    if (!scheduleForm.start_time || !scheduleForm.end_time) {
      showAlert('Pick a date. The time fills itself.', 'Time Required', 'warning');
      return;
    }

    if (scheduleForm.end_time <= scheduleForm.start_time) {
      showAlert('End time must be after start time.', 'Invalid Time Range', 'warning');
      return;
    }

    if (isPhysical) {
      if (!scheduleForm.screening_type) {
        showAlert('Physical Activities needs a screening type with a form template.', 'Type Required', 'warning');
        return;
      }
    } else if (isCustomGrouping) {
      if (!scheduleForm.folder_id) {
        showAlert('Choose a folder, or create a new one.', 'Folder Required', 'warning');
        return;
      }
      if (scheduleForm.folder_id === 'new' && !scheduleForm.folder_name.trim()) {
        showAlert('Type a name for the new folder.', 'Folder Name Required', 'warning');
        return;
      }
    } else if (scheduleForm.folder_mode === 'existing' && !scheduleForm.section_key) {
      showAlert('Choose an existing folder, or start a new one.', 'Folder Required', 'warning');
      return;
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
      const filteredIds = listedStudents.map(st => st.student_id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    } else {
      const filteredSet = new Set(listedStudents.map(st => st.student_id));
      setSelectedStudentIds(prev => prev.filter(id => !filteredSet.has(id)));
    }
  };

  const areAllFilteredSelected = listedStudents.length > 0 &&
    listedStudents.every(st => selectedStudentIds.includes(st.student_id));

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      showAlert('Select a student.', 'Selection Required', 'warning');
      return;
    }

    // a new by-section folder must be a class that has no folder yet; otherwise it belongs in the existing one
    if (!isCustomGrouping && scheduleForm.folder_mode === 'new') {
      const taken = sectionFolders.find(f => f.key === `${scheduleForm.target_program_id}|${scheduleForm.target_year_level}|${scheduleForm.target_section}`);
      if (taken) {
        showAlert(`${taken.label} already has a folder. Choose Existing folder.`, 'Folder Exists', 'warning');
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/screenings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleForm,
          grouping: isPhysical ? 'CUSTOM' : 'SECTION',
          folder_id: isPhysical || scheduleForm.folder_id === 'new' ? '' : scheduleForm.folder_id,
          folder_name: isPhysical ? scheduleForm.title.trim().slice(0, 80) : (scheduleForm.folder_id === 'new' ? scheduleForm.folder_name.trim() : ''),
          student_ids: selectedStudentIds,
          sender_id: userId
        })
      });

      const data = await res.json();
      if (res.ok) {
        notifyScreeningChanged();
        const sent = scheduleForm;
        setShowStudentSelectModal(false);
        resetScheduleForm();
        // the new screening is upcoming: show it under Upcoming, in its folder
        await fetchFolders();
        fetchCalendar();
        setActiveTab('upcoming');
        setSearchTerm('');
        if (sent.grouping === 'SECTION') {
          setClassTab('screenings');
          setView({
            kind: 'section', program_id: sent.target_program_id,
            program_name: programs.find(p => p.program_id === sent.target_program_id)?.program_name || '',
            year_level: Number(sent.target_year_level), section: sent.target_section
          });
        } else {
          setView({ kind: 'root' });
        }
        showAlert('Screening saved. Students notified.', 'Success', 'success');
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

    if (!editingSchedule.start_time || !editingSchedule.end_time) {
      showAlert('Pick a date. The time fills itself.', 'Time Required', 'warning');
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
        notifyScreeningChanged();
        setShowEditModal(false);
        fetchSchedules();
        showAlert('Screening saved.', 'Success', 'success');
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
    title: 'Cancel screening?',
    message: `${sch.title} · ${sch.scheduled_date ? formatDate(String(sch.scheduled_date).split('T')[0]) : ''}`,
    label: <>Reason <Req /></>,
    required: true,
    danger: true,
    confirmText: 'Cancel screening',
    onSubmit: async (reason) => {
      try {
        const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}/cancel`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, sender_id: userId })
        });
        const data = await res.json();
        if (res.ok) {
          notifyScreeningChanged();
          fetchSchedules();
          showAlert('Cancelled. Students notified.', 'Cancelled', 'success');
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
      `Delete "${sch.title}"? This cannot be undone.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            notifyScreeningChanged();
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

  // Past screenings: archive (out of Past Screening), restore, delete for good (the results stay in the student records)
  const archivedScreenings = folders.archived_screenings || [];
  const screeningArchiveRequest = async (id, action, okMessage, okTitle) => {
    try {
      const del = action === 'delete';
      const url = del
        ? `${API_BASE}/screenings/${id}/archived?sender_id=${encodeURIComponent(userId || '')}`
        : `${API_BASE}/screenings/${id}/${action}`;
      const res = await fetch(url, del
        ? { method: 'DELETE' }
        : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showAlert(data.error || 'The screening could not be changed.', 'Error', 'error'); return; }
      notifyScreeningChanged();
      fetchSchedules();
      showAlert(okMessage, okTitle, 'success');
    } catch (err) {
      showAlert('The screening could not be changed.', 'Error', 'error');
    }
  };
  // Archive tab: open an archived folder to see its screenings (each one opens its records)
  const [folderView, setFolderView] = useState(null); // { folder, schedules, loading }
  const openArchivedFolder = async (folder) => {
    setFolderView({ folder, schedules: [], loading: true });
    try {
      const res = await fetch(`${API_BASE}/screening-folders/${folder.folder_id}/schedules`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the folder.');
      setFolderView({ folder, schedules: data.schedules || [], loading: false });
    } catch (err) {
      setFolderView(null);
      showAlert(err.message || 'Could not load the folder.', 'Error', 'error');
    }
  };
  const handleArchiveSchedule = (sch) => {
    showConfirm(
      `Archive "${sch.title}"? You can restore it from Archive.`,
      () => screeningArchiveRequest(sch.screening_schedule_id, 'archive', 'Screening archived.', 'Archived'),
      'Archive screening', 'Archive'
    );
  };
  const handleDeleteArchivedSchedule = (sch) => {
    showConfirm(
      `Delete "${sch.title}" for good? It leaves every list and cannot be restored. The results stay in the student records.`,
      () => screeningArchiveRequest(sch.screening_schedule_id, 'delete', 'Screening deleted.', 'Deleted'),
      'Delete screening', 'Delete'
    );
  };

  const handleStartBatch = (sch) => {
    showConfirm(
      `Notify students not yet checked in for "${sch.title}"?`,
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
      'Send reminders for today and tomorrow?',
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
    message: `${st.first_name} ${st.last_name} · ${status}`,
    label: <>Reason <Req /></>,
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
          notifyScreeningChanged();
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
      showAlert(`${activeSchedule.screening_type} is now a Doctor Visit. Read only.`, 'Moved to Doctor Visits', 'warning');
      return;
    }
    showConfirm(
      `Time in ${st.first_name} ${st.last_name} now?`,
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
        notifyScreeningChanged();
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
            notifyScreeningChanged();
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
      // the time fills itself with the next free time of that day
      start_time: '',
      end_time: '',
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
        notifyScreeningChanged();
        setMakeupModal(null);
        setShowViewModal(false);
        // the make-up stays in the same folder, so the folder now also has an upcoming screening
        await fetchFolders();
        fetchCalendar();
        setActiveTab('upcoming');
        showAlert(`${data.message}`, 'Make-up Scheduled', 'success');
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
        notifyScreeningChanged();
        setReferModal(null);
        openViewModal(activeSchedule);
        showAlert('Referral scheduled.', 'Referred', 'success');
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

  // another nurse, tab or device changed a screening record: keep the open history and participant list current
  useScreeningSync(() => {
    fetchSchedules();
    if (historyModal && !historyModal.loading) {
      fetch(`${API_BASE}/students/${encodeURIComponent(historyModal.student.student_id)}/screening-history`)
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setHistoryModal((cur) => (cur && cur.student.student_id === historyModal.student.student_id ? { ...cur, rows: data } : cur)); })
        .catch(() => {});
    }
    if (showViewModal && activeSchedule) {
      fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/students`)
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data.students)) setScheduleStudents(data.students); })
        .catch(() => {});
    }
  });

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
    const physical = isPhysicalSchedule(data.schedule || schedule);
    const header = ['Student ID', 'Last name', 'First name', 'Program', 'Year', 'Section', 'Attendance', ...cols.map(c => c[0]), 'Result', ...(physical ? ['Allow-to-Play'] : []), 'Health history', 'Remarks'];
    const body = data.rows.map(r => [
      r.student_id, r.last_name, r.first_name, r.program_name, r.year_level, r.section, r.attendance_status,
      ...cols.map(c => (r.documented ? c[1](r) : '')),
      r.documented ? (r.is_abnormal ? r.flags || 'Not normal' : 'Normal') : '',
      ...(physical ? [r.documented ? (PLAY_STATUS_LABELS[r.play_status] || '') : ''] : []),
      (r.health_conditions || []).join('; '), r.remarks || r.attendance_note || ''
    ]);
    const safeTitle = (schedule.title || 'screening').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    downloadCsv(`${safeTitle}_results.csv`, [header, ...body]);
  };

  // Physical Activities: who may play and who may not (Allowed, Not Allowed), for the report and the CSV
  const playGroupsOf = (rows) => {
    const decided = (r) => r.documented && PLAY_STATUS_LABELS[r.play_status];
    return [
      ['ALLOWED', rows.filter(r => decided(r) && r.play_status === 'ALLOWED')],
      ['NOT_ALLOWED', rows.filter(r => decided(r) && r.play_status === 'NOT_ALLOWED')],
      ['NONE', rows.filter(r => !decided(r))]
    ];
  };

  const exportPlayCsv = async (schedule) => {
    const data = await fetchResults(schedule);
    if (!data) return;
    const header = ['Student ID', 'Last name', 'First name', 'Program', 'Year', 'Section', 'Allow-to-Play', 'Precautions / Reason', 'Health history', 'Remarks'];
    const body = playGroupsOf(data.rows).flatMap(([key, list]) => list.map(r => [
      r.student_id, r.last_name, r.first_name, r.program_name, r.year_level, r.section,
      key === 'NONE' ? 'No decision yet' : PLAY_STATUS_LABELS[key], r.play_notes || '', (r.health_conditions || []).join('; '), r.remarks || ''
    ]));
    const safeTitle = (schedule.title || 'screening').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    downloadCsv(`${safeTitle}_allow_to_play.csv`, [header, ...body]);
  };

  const printResultsReport = async (schedule) => {
    const data = await fetchResults(schedule);
    if (!data) return;

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      showAlert('Allow popups to print.', 'Popup Blocked', 'warning');
      return;
    }

    const cols = resultColumnsFor(data.schedule?.form_kind || schedule.form_kind, data.schedule?.template);
    const physicalReport = isPhysicalSchedule(data.schedule || schedule);
    const s = data.summary;
    const dist = Object.entries(s.distribution).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('');
    const rowsHtml = data.rows.map(r => `
      <tr${r.is_abnormal ? ' class="abn"' : ''}>
        <td>${escapeHtml(r.student_id)}</td>
        <td>${escapeHtml(`${r.last_name}, ${r.first_name}`)}</td>
        <td>${escapeHtml(classLabel(r.program_id, r.year_level, r.section))}</td>
        <td>${escapeHtml(r.attendance_status)}</td>
        ${cols.map(c => `<td>${escapeHtml(r.documented ? c[1](r) : '')}</td>`).join('')}
        <td>${escapeHtml(r.documented ? (r.is_abnormal ? r.flags || 'Not normal' : 'Normal') : 'Not documented')}</td>
        ${physicalReport ? `<td>${escapeHtml(r.documented ? (PLAY_STATUS_LABELS[r.play_status] || '') : '')}</td>` : ''}
        <td>${escapeHtml((r.health_conditions || []).join(', '))}</td>
      </tr>`).join('');

    // Physical Activities: who may play and who may not, with the precautions or the reason
    const playHtml = !physicalReport ? '' : playGroupsOf(data.rows).filter(([key]) => key !== 'NONE').map(([key, list]) => `
      <h3>${PLAY_STATUS_LABELS[key]} (${list.length})</h3>
      <table><thead><tr><th>Student ID</th><th>Name</th><th>Class</th><th>Precautions / Reason</th><th>Health history</th></tr></thead>
      <tbody>${list.map(r => `<tr>${[r.student_id, `${r.last_name}, ${r.first_name}`, classLabel(r.program_id, r.year_level, r.section), r.play_notes || '', (r.health_conditions || []).join(', ')].map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5">None</td></tr>'}</tbody></table>`).join('');

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
      h3 { margin: 0 0 8px; font-size: 14px; color: #1e3a8a; break-after: avoid; }
      .signature { margin-top: 40px; font-size: 13px; } .signature b { display: block; margin-top: 30px; }
      @media print { body { margin: 0; } }
    </style></head><body>
      <div class="report-header"><img src="${stiLogo}" alt="STI Logo" />
        <div class="report-title"><h2>STI COLLEGE BALIUAG</h2><p>Health Screening Results Report</p></div></div>
      <div class="details-card">
        <div><strong>Screening:</strong> ${escapeHtml(schedule.title)}</div>
        <div><strong>Type:</strong> ${escapeHtml(typeLabel(schedule.screening_type))}${physicalReport ? ' (Physical Activities)' : ''}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatDate(String(schedule.scheduled_date).split('T')[0]))}</div>
        <div><strong>Time:</strong> ${escapeHtml(formatTime(schedule.start_time))} - ${escapeHtml(formatTime(schedule.end_time))}</div>
      </div>
      <div class="cards">
        <div class="card"><b>${s.total}</b>Participants</div>
        <div class="card"><b>${s.present}</b>Present</div>
        <div class="card"><b>${s.absent}</b>Absent</div>
        <div class="card"><b>${s.documented}</b>Documented</div>
        <div class="card"><b>${s.abnormal}</b>${data.schedule?.form_kind === 'HEARING' ? 'Not normal' : 'High / Low'}</div>
        ${physicalReport ? `<div class="card"><b>${s.play.allowed}</b>Allowed</div><div class="card"><b>${s.play.not_allowed}</b>Not allowed</div>` : ''}
      </div>
      ${dist ? `<table class="small"><thead><tr><th>Result</th><th>Students</th></tr></thead><tbody>${dist}</tbody></table>` : ''}
      <table><thead><tr><th>Student ID</th><th>Name</th><th>Program / Section</th><th>Attendance</th>${cols.map(c => `<th>${escapeHtml(c[0])}</th>`).join('')}<th>Result</th>${physicalReport ? '<th>Allow-to-Play</th>' : ''}<th>Health history</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="14">No participants.</td></tr>'}</tbody></table>
      ${playHtml}
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
      showAlert('Mark the student present first.', 'Action Required', 'warning');
      return;
    }

    if (isLegacySchedule(activeSchedule)) {
      showAlert(`${activeSchedule.screening_type} is now a Doctor Visit. Read only.`, 'Moved to Doctor Visits', 'warning');
      return;
    }

    setSelectedStudent(student);
    // a result saved before keeps its own remark; a new one gets the automatic remark
    setRemarksTouched(!!student.remarks);
    // a new result starts from the student's latest BMI and vital signs; a saved one shows only what was saved
    const startAnswers = (hasResult(student) ? student.answers : student.recent_answers) || {};
    setDocData({
      left_ear_result: student.left_ear_result || '',
      right_ear_result: student.right_ear_result || '',
      remarks: student.remarks || '',
      answers: Object.fromEntries(Object.entries(startAnswers).map(([k, v]) => [k, String(v)]))
    });
    setDocLocked(locked);
    const pair = bpPair(activeSchedule?.template?.fields);
    setBpDraft(pair ? bpText(startAnswers, pair) : '');
    setShowDocModal(true);
  };

  // the result in the Document Result modal as the filled-in screening form (for the PDF icon)
  const screeningFormModel = () => {
    const sch = activeSchedule;
    const st = selectedStudent;
    const answers = docData.answers || {};
    const bpf = bpFieldsOf(sch.template?.fields || []);
    const results = sch.form_kind === 'CUSTOM'
      ? (sch.template?.fields || []).map((f) => {
        const hasRange = (f.type === 'number' || f.type === 'calculated') && (f.min !== undefined || f.max !== undefined);
        const meta = (v) => {
          if (v === '' || v === undefined) return { status: '', range: '' };
          const st = rangeState(f, v);
          const isBp = (bpf.sys && bpf.sys.key === f.key) || (bpf.dia && bpf.dia.key === f.key);
          if (hasRange) return { status: st === 'Normal' ? 'Normal' : isBp ? `${st} blood` : outWord(f.label, st === 'Low'), range: `Range ${f.min !== undefined && f.max !== undefined ? `${f.min}-${f.max}` : f.min !== undefined ? `${f.min} or more` : `up to ${f.max}`}${f.unit ? ` ${f.unit}` : ''}` };
          if ((f.abnormal_options || []).length > 0) return { status: f.abnormal_options.includes(String(v)) ? 'Not normal' : 'Normal', range: '' };
          return { status: '', range: '' };
        };
        if (f.type === 'calculated') {
          const c = calculate(f, answers);
          return { label: f.label, value: c ? c.value : '', unit: f.unit, note: c ? c.label : '', ...meta(c ? c.value : '') };
        }
        return { label: f.label, value: answers[f.key] ?? '', unit: f.unit, ...meta(answers[f.key]) };
      })
      : [{ label: 'Left ear', value: docData.left_ear_result }, { label: 'Right ear', value: docData.right_ear_result }];
    return buildScreeningModel({
      student: `${st.first_name || ''} ${st.last_name || ''}`.trim(),
      studentId: st.student_id,
      classText: classLabel(st.program_id, st.year_level, st.section),
      type: sch.screening_type,
      title: sch.title && sch.title !== sch.screening_type ? sch.title : '',
      date: sch.scheduled_date,
      time: sch.start_time && sch.end_time ? `${formatTime(sch.start_time)} - ${formatTime(sch.end_time)}` : '',
      status: 'Completed',
      attendance: 'Present',
      results,
      remarks: docData.remarks,
      abnormal: !!st.is_abnormal,
      playStatus: isPhysicalDoc ? docPlayStatus : ''
    });
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
        notifyScreeningChanged();
        showAlert(data.is_abnormal ? `Saved. ${data.flags || 'Result is not normal'}.` : 'Result saved.', 'Success', 'success');
      } else {
        showAlert(data.error || 'Failed to save document.', 'Error', 'error');
      }
    } catch (err) {
      console.error('Error submitting document:', err);
      showAlert('Error saving document.', 'Error', 'error');
    }
  };

  // the folders a new screening can be filed in: by-section folders (a class that has screenings) and custom folders
  const sectionFolders = folders.programs.flatMap(p => (p.sections || []).map(s => ({
    key: `${p.program_id}|${s.year_level}|${s.section}`,
    program_id: p.program_id,
    year_level: s.year_level,
    section: s.section,
    label: sectionFolderName(p.program_id, s)
  })));
  const customFolderList = folders.custom_folders || [];

  const resetScheduleForm = () => {
    setScheduleForm({
      title: '', screening_type: SCREENING_TYPE, screening_category: 'GENERAL', scheduled_date: getTodayString(), start_time: '', end_time: '',
      announcement: '', target_program_id: '', target_year_level: '', target_section: '',
      grouping: 'SECTION', folder_mode: sectionFolders.length ? 'existing' : 'new', section_key: '', folder_id: '', folder_name: ''
    });
    setSelectedStudentIds([]);
    setPickerSearch('');
    prefilledFolderRef.current = '';
  };

  // "New screening in this folder" (Past tab of an open folder): the form opens with that folder chosen
  const scheduleInFolder = () => {
    resetScheduleForm();
    setScheduleForm(prev => (view.kind === 'custom'
      ? { ...prev, grouping: 'CUSTOM', folder_mode: 'existing', folder_id: String(view.folder_id) }
      : {
        ...prev, grouping: 'SECTION', folder_mode: 'existing', section_key: `${view.program_id}|${view.year_level}|${view.section}`,
        target_program_id: view.program_id, target_year_level: String(view.year_level), target_section: view.section
      }));
    setShowScheduleModal(true);
  };

  // existing folder or a new one; the options of an existing folder match the kind (by section / custom)
  const changeFolderMode = (mode) => {
    if (mode === scheduleForm.folder_mode) return;
    prefilledFolderRef.current = '';
    setSelectedStudentIds([]);
    setPickerSearch('');
    setScheduleForm(prev => {
      // an existing folder needs a group that has folders: fall back to the other group when this one is empty
      let grouping = prev.grouping;
      if (mode === 'existing' && prev.screening_category !== 'PHYSICAL') {
        grouping = 'SECTION';
      } else if (mode === 'existing') {
        if (grouping === 'CUSTOM' && customFolderList.length === 0) grouping = 'SECTION';
        else if (grouping === 'SECTION' && sectionFolders.length === 0) grouping = 'CUSTOM';
      }
      return {
        ...prev, grouping, folder_mode: mode, section_key: '', target_program_id: '', target_year_level: '', target_section: '',
        folder_id: grouping === 'CUSTOM' && mode === 'new' ? 'new' : '', folder_name: ''
      };
    });
  };

  const pickSectionFolder = (key) => {
    const f = sectionFolders.find(x => x.key === key);
    setSelectedStudentIds([]);
    setPickerSearch('');
    setScheduleForm(prev => ({
      ...prev, section_key: key,
      target_program_id: f ? f.program_id : '', target_year_level: f ? String(f.year_level) : '', target_section: f ? f.section : ''
    }));
  };

  // the folder a screening is filed in, as a label (make-up and import show it locked)
  const folderLabelOf = (sch) => {
    if (!sch) return '';
    if (sch.folder_id) return customFolderList.find(f => String(f.folder_id) === String(sch.folder_id))?.name || 'Custom folder';
    return sch.target_program_id ? sectionFolderName(sch.target_program_id, { year_level: sch.target_year_level, section: sch.target_section }) : '';
  };

  const openImport = async (sch) => {
    try {
      const res = await fetch(`${API_BASE}/screenings/${sch.screening_schedule_id}/students`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load participants');
      setImportData({ schedule: { ...sch, ...(data.schedule || {}) }, students: data.students || [] });
    } catch (err) {
      showAlert(err.message || 'Could not load the participants.', 'Error', 'error');
    }
  };

  // "Schedule screening" on a day of the calendar: the form opens with that date
  const scheduleOnDay = (day) => {
    resetScheduleForm();
    setScheduleForm(prev => ({ ...prev, scheduled_date: day || getTodayString() }));
    setShowScheduleModal(true);
  };

  // General Screening = one class (class folder, existing or new); Physical Activities = random participants in a new list
  const changeCategory = (category) => {
    if (category === scheduleForm.screening_category) return;
    prefilledFolderRef.current = '';
    setSelectedStudentIds([]);
    setPickerSearch('');
    setScheduleForm(prev => {
      const clean = { target_program_id: '', target_year_level: '', target_section: '', section_key: '', folder_name: '' };
      if (category === 'PHYSICAL') {
        return { ...prev, ...clean, screening_category: 'PHYSICAL', grouping: 'CUSTOM', folder_mode: 'new', folder_id: 'new', screening_type: SCREENING_TYPE };
      }
      return { ...prev, ...clean, screening_category: 'GENERAL', grouping: 'SECTION', folder_mode: sectionFolders.length ? 'existing' : 'new', folder_id: '' };
    });
  };

  // archive / restore / delete for good (custom folders)
  const folderRequest = async (url, options, okMessage, okTitle) => {
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(data.error || 'The folder could not be changed.', 'Error', 'error');
        return false;
      }
      notifyScreeningChanged();
      await fetchFolders();
      showAlert(okMessage, okTitle, 'success');
      return true;
    } catch (err) {
      showAlert('The folder could not be changed.', 'Error', 'error');
      return false;
    }
  };

  const handleArchiveFolder = () => {
    showConfirm(
      `Archive the folder "${view.folder_name}"? You can restore it later.`,
      async () => {
        const ok = await folderRequest(
          `${API_BASE}/screening-folders/${view.folder_id}/archive`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId }) },
          'Folder archived.', 'Archived'
        );
        if (ok) goRoot();
      },
      'Archive folder', 'Archive'
    );
  };

  const handleRestoreFolder = (f) => {
    folderRequest(
      `${API_BASE}/screening-folders/${f.folder_id}/restore`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId }) },
      'Folder restored.', 'Restored'
    );
  };

  const handleDeleteArchivedFolder = (f) => {
    showConfirm(
      f.schedule_count > 0
        ? `Delete "${f.name}" for good? Its ${f.schedule_count} screening${f.schedule_count === 1 ? '' : 's'} leave every list. The results stay in the student records. This cannot be undone.`
        : `Delete "${f.name}" for good? This cannot be undone.`,
      () => folderRequest(
        `${API_BASE}/screening-folders/${f.folder_id}?sender_id=${encodeURIComponent(userId || '')}`,
        { method: 'DELETE' },
        'Folder deleted.', 'Deleted'
      ),
      'Delete folder', 'Delete'
    );
  };

  const handleDeleteFolder = () => {
    showConfirm(
      `Delete the folder "${view.folder_name}"? It has no screenings. This cannot be undone.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/screening-folders/${view.folder_id}?sender_id=${encodeURIComponent(userId || '')}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            notifyScreeningChanged();
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error || 'Could not save the change.';
      notifyScreeningChanged();
      // reload the calendar first: the prompt reads it, so it must show the new end time (or vanish) before the nurse can click again
      await fetchCalendar();
      fetchSchedules();
      showAlert(data.message || 'Saved.', 'Done', 'success');
      return '';
    } catch (err) {
      return 'Could not reach the server.';
    }
  };

  // the nurse can end an on going screening at any time, even before the end time or with students not documented
  const handleEndNow = (sch) => {
    const total = Number(sch.total_students || scheduleStudents.length || 0);
    const documented = Number(sch.result_count || 0);
    const left = Math.max(0, total - documented);
    showConfirm(
      `End "${sch.title}" now?${left > 0 ? `\n${left} of ${total} students are not documented. They stay pending.` : ''}`,
      async () => {
        const error = await sendEnd(sch, 'confirm-end', {});
        if (error) showAlert(error, 'Error', 'error');
        else setShowViewModal(false);
      },
      'End screening', 'Yes, End', 'Keep'
    );
  };

  const schoolYearSelect = (
    <select value={schoolYear} onChange={e => setSchoolYear(e.target.value)} aria-label="School year">
      <option value="">All school years</option>
      {(schoolYearInfo?.years || []).map(y => (
        <option key={y.school_year} value={y.school_year}>{y.school_year}{y.is_current ? ' (current)' : ''}</option>
      ))}
    </select>
  );

  // one toolbar for the folder view and the list view: search, school year, type (chips, or a select when there are many types)
  const screeningToolbar = (
    <div className="folder-toolbar-hs">
      <div className="folder-search-hs">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search"
          placeholder="Search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      {schoolYearSelect}
      <button
        type="button"
        className="btn-hs btn-secondary-hs btn-icon-hs"
        onClick={() => fetchSchedules()}
        aria-label="Refresh"
        title="Refresh"
      >
        <RefreshCw size={18} aria-hidden="true" />
      </button>
    </div>
  );

  // records of one student (all school years)
  const openStudentRecords = (st) => openHistory(st);

  // numbers of the open folder (from the folder summary) and the cards of this page cut into days
  const tabCounts = scopeCounts(folders, view, searching);
  const screeningDays = groupByDay(schedules, (sch) => dayKey(sch.scheduled_date));

  // side panel of an open folder (desktop): what it is, its counts, and its actions
  const inFolder = (view.kind === 'section' || view.kind === 'custom') && !searching;
  const folderTitle = view.kind === 'custom' ? view.folder_name : view.kind === 'section' ? sectionFolderName(view.program_id, view) : '';
  const folderAside = inFolder ? (
    <aside className="hs-aside-hs" aria-label="Folder">
      <div className="hs-aside-head-hs">
        <span className={`fld-ico-hs ${view.kind === 'custom' ? 'fld-ico-custom-hs' : ''}`}>
          {view.kind === 'custom' ? <Layers size={20} aria-hidden="true" /> : <Folder size={20} aria-hidden="true" />}
        </span>
        <div className="fld-text-hs">
          <h2 className="hs-aside-title-hs">{folderTitle}</h2>
          <span className="fld-sub-hs">{view.kind === 'custom' ? 'Custom folder' : 'By section'}</span>
        </div>
      </div>
      <dl className="hs-kv-hs">
        {view.kind === 'section' && (
          <>
            <dt>Program</dt><dd>{view.program_id}</dd>
            <dt>Year</dt><dd>{view.year_level}</dd>
            <dt>Section</dt><dd>{view.section}</dd>
          </>
        )}
        <dt>Upcoming</dt><dd>{Number(tabCounts?.upcoming) || 0}</dd>
        <dt>Ongoing</dt><dd>{Number(tabCounts?.ongoing) || 0}</dd>
        <dt>Past</dt><dd>{Number(tabCounts?.past) || 0}</dd>
      </dl>
      <div className="hs-aside-actions-hs">
        {activeTab === 'past' && (
          <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" onClick={scheduleInFolder} aria-label="New screening in this folder" title="New screening in this folder">
            <Plus size={18} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={handleExportAllReport} aria-label="Export folder report (PDF)" title="Export folder report (PDF)">
          <Printer size={18} aria-hidden="true" />
        </button>
        {view.kind === 'custom' && (
          <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={handleArchiveFolder} aria-label="Archive folder" title="Archive folder">
            <Archive size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  ) : null;

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
          <h1>Health Screening</h1>
        </div>
        <div className="header-actions-hs">
          <button
            type="button"
            className="btn-hs btn-icon-hs btn-primary-hs"
            onClick={() => scheduleOnDay('')}
            aria-label="New screening"
            title="New screening"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Page sections */}
      <div className="tabs-hs" role="tablist" aria-label="Health screening sections">
        {[
          ['screenings', Folder, 'Screenings'],
          ['calendar', CalendarDays, 'Calendar'],
          ['archive', Archive, 'Archive']
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={`tab-btn-hs ${mainView === key ? 'active-hs' : ''}`}
            aria-selected={mainView === key}
            onClick={() => setMainView(key)}
          >
            <Icon size={16} aria-hidden="true" /> {label}
            {key === 'archive' && (folders.archived_folders || []).length + (folders.archived_screenings || []).length > 0 && (
              <span className="phase-n-hs">{(folders.archived_folders || []).length + (folders.archived_screenings || []).length}</span>
            )}
            <TabDot show={mainView !== key && (key === 'screenings' ? screeningsDot : !!tabDots[key])} label={`New in ${label}`} />
          </button>
        ))}
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

      {/* Status first: Upcoming / Ongoing / Past. The folders under a status are the ones that have a screening in it. */}
      {mainView === 'screenings' && !(view.kind === 'section' && !searching && classTab === 'students') && (
        <div className="phase-tabs-hs" role="tablist" aria-label="Status">
          {[
            ['upcoming', Calendar, 'Upcoming Screening'],
            ['ongoing', Clock, 'Ongoing Screening'],
            ['past', CheckCircle, 'Past Screening']
          ].map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={`phase-tab-hs ${activeTab === key ? 'active-hs' : ''}`}
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
            >
              <span className="phase-ico-hs"><Icon size={18} aria-hidden="true" /></span>
              <span className="phase-label-hs">{label}</span>
              <span className="phase-n-hs">{Number(phaseCounts?.[key]) || 0}</span>
              <TabDot show={activeTab !== key && !!tabDots[`phase:${key}`]} label={`New in ${label}`} />
            </button>
          ))}
        </div>
      )}

      {/* Folders: Program > Year-Section */}
      {mainView === 'screenings' && <FolderCrumbs trail={crumbTrail} />}

      {mainView === 'screenings' && view.kind === 'custom' && tabCounts && tabCounts.total === 0 && (
        <div className="folder-actions-hs">
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

      {mainView === 'archive' && (folders.archived_folders || []).length === 0 && archivedScreenings.length === 0 && (
        <div className="no-records-hs"><Archive size={28} aria-hidden="true" /><p>None</p></div>
      )}

      {mainView === 'archive' && archivedScreenings.length > 0 && (
        <div className="pk-arch-list-hs">
          {archivedScreenings.map(sch => (
            <div key={sch.screening_schedule_id} className="pk-arch-row-hs">
              <span className="fld-ico-hs"><FileText size={20} aria-hidden="true" /></span>
              <span className="pk-name-hs">
                <span className="pk-name-main-hs">{sch.title}</span>
                <span className="pk-id-hs">{typeLabel(sch.screening_type)} &middot; {formatDate(String(sch.scheduled_date).split('T')[0])} &middot; {sch.total_students} student{Number(sch.total_students) === 1 ? '' : 's'}</span>
              </span>
              <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openViewModal(sch)} aria-label={`View ${sch.title}`} title="View">
                <Eye size={18} aria-hidden="true" />
              </button>
              <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => screeningArchiveRequest(sch.screening_schedule_id, 'restore', 'Screening restored.', 'Restored')} aria-label={`Restore ${sch.title}`} title="Restore">
                <ArchiveRestore size={18} aria-hidden="true" />
              </button>
              <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleDeleteArchivedSchedule(sch)} aria-label={`Delete ${sch.title} permanently`} title="Delete permanently">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mainView === 'archive' && (folders.archived_folders || []).length > 0 && (
        <div className="pk-arch-list-hs">
          {(folders.archived_folders || []).map(f => (
            <div key={f.folder_id} className="pk-arch-row-hs">
              <span className="fld-ico-hs fld-ico-custom-hs"><Layers size={20} aria-hidden="true" /></span>
              <span className="pk-name-hs">
                <span className="pk-name-main-hs">{f.name}</span>
                <span className="pk-id-hs">{f.schedule_count} screening{f.schedule_count === 1 ? '' : 's'} &middot; {formatDate(f.archived_at)}</span>
              </span>
              <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openArchivedFolder(f)} aria-label={`View ${f.name}`} title="View">
                <Eye size={18} aria-hidden="true" />
              </button>
              <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => handleRestoreFolder(f)} aria-label={`Restore ${f.name}`} title="Restore">
                <ArchiveRestore size={18} aria-hidden="true" />
              </button>
              <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleDeleteArchivedFolder(f)} aria-label={`Delete ${f.name} permanently`} title="Delete permanently">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mainView === 'screenings' && !listMode && (
        <>
          {screeningToolbar}
          {foldersLoading ? (
            <p className="hint-hs" role="status">Loading</p>
          ) : (
            <ScreeningFolders items={folderItems} phase={activeTab} />
          )}
        </>
      )}

      {mainView === 'screenings' && listMode && !(view.kind === 'section' && !searching && classTab === 'students') && (
      <div className={`hs-split-hs ${inFolder ? 'hs-split-aside-hs' : ''}`}>
      <div className="hs-main-hs">
      {screeningToolbar}

      {/* Date range: only past screenings need one (the type filter lives in the toolbar above) */}
      {activeTab === 'past' && (
        <div className="filter-bar-hs">
          <label>
            From
            <input type="date" value={filterStartDate} max={filterEndDate || undefined} onChange={handleStartDateChange} />
          </label>

          <label>
            To
            <input type="date" value={filterEndDate} min={filterStartDate || undefined} onChange={handleEndDateChange} />
          </label>

          {(filterStartDate || filterEndDate) && (
            <button type="button" onClick={handleShowAllDates} className="btn-hs btn-icon-hs btn-secondary-hs" aria-label="Show all dates" title="Show all dates">
              <CalendarDays size={16} aria-hidden="true" />
            </button>
          )}

          {(filterType !== 'ALL' || filterStartDate !== defaultPastRange().from || filterEndDate !== defaultPastRange().to) && (
            <button type="button" onClick={handleResetFilters} className="btn-hs btn-icon-hs btn-secondary-hs" aria-label="Reset filters" title="Reset filters">
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Cards, one block per day */}
      {schedules.length === 0 ? (
        <div className="no-records-hs">
          <ClipboardList size={28} aria-hidden="true" />
          <p>None</p>
        </div>
      ) : screeningDays.map(day => (
        <DaySection key={day.key || 'no-date'} heading={dayHeading(day.key, formatDate)} count={day.items.length} noun="screenings">
        <div className="rows-hs">
          {day.items.map(sch => {
            const presentCount = Number(sch.present_count ?? sch.present_students ?? 0);
            const totalCount = Number(sch.total_students || 0);
            const resultCount = Number(sch.result_count || 0);
            const absentCount = Number(sch.absent_count || 0);
            const ended = activeTab === 'ongoing' && awaitingEnd(sch);
            const cancelled = sch.status === 'Cancelled';
            const phase = cancelled ? 'cancel' : ended ? 'awaiting' : activeTab;
            const KindIcon = typeIcon(sch.screening_type, sch.form_kind);

            return (
              <article key={sch.screening_schedule_id} className={`sc-hs sc-${phase}-hs`}>
                <span className="sc-bar-hs" aria-hidden="true" />
                <div className="sc-main-hs">
                  <div className="sc-top-hs">
                    <span className="chip-hs chip-info-hs">
                      <KindIcon size={14} aria-hidden="true" />
                      {typeLabel(sch.screening_type)}
                      {!isLegacySchedule(sch) && !Number(sch.type_active) && ' (inactive)'}
                    </span>
                    {isPhysicalSchedule(sch) && <span className="chip-hs"><Dumbbell size={14} aria-hidden="true" /> Physical Activities</span>}
                    <h3 className="sc-title-hs">{sch.title}</h3>
                    {ended && <span className="chip-hs chip-warn-hs"><AlertTriangle size={14} aria-hidden="true" /> Ended</span>}
                    {cancelled && <span className="chip-hs chip-bad-hs"><X size={14} aria-hidden="true" /> Cancelled{sch.cancelled_reason ? `: ${sch.cancelled_reason}` : ''}</span>}
                    {sch.makeup_of && <span className="chip-hs chip-info-hs">Make-up</span>}
                  </div>
                  <div className="sc-meta-hs">
                    <span><Calendar size={14} aria-hidden="true" /> {sch.scheduled_date ? formatDate(sch.scheduled_date.split('T')[0]) : ''}</span>
                    <span><Clock size={14} aria-hidden="true" /> {formatTime(sch.start_time)} - {formatTime(sch.end_time)}</span>
                    {sch.announcement && (
                      <span className="sc-note-hs" title={sch.announcement}>
                        <Megaphone size={14} aria-hidden="true" /> {sch.announcement}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sc-meter-hs">
                  {cancelled ? null : activeTab === 'upcoming' ? (
                    <span className="sc-count-hs"><Users size={14} aria-hidden="true" /> {totalCount} <small>students</small></span>
                  ) : (
                    <>
                      <span className="sc-count-hs">{presentCount}/{totalCount} <small>present</small></span>
                      <div className="track-hs" role="img" aria-label={`${presentCount} of ${totalCount} present`}>
                        <i style={{ width: `${totalCount ? Math.min(100, Math.round((presentCount / totalCount) * 100)) : 0}%` }} />
                      </div>
                      {activeTab === 'past' && (
                        <span className="sc-chips-hs">
                          <span className={`chip-hs ${absentCount ? 'chip-bad-hs' : ''}`}>Absent {absentCount}</span>
                          <span className={`chip-hs ${resultCount >= presentCount ? 'chip-ok-hs' : 'chip-warn-hs'}`}>Doc {resultCount}/{presentCount}</span>
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="sc-actions-hs">
                  {activeTab === 'upcoming' && !cancelled && (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => setParticipantsSchedule(sch)} title="Participants" aria-label="Participants">
                        <Users size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => { setEditingSchedule(sch); setShowEditModal(true); }} title="Edit" aria-label="Edit">
                        <Edit3 size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleCancelSchedule(sch)} title="Cancel screening" aria-label="Cancel screening">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}

                  {activeTab === 'ongoing' && (
                    <>
                      {ended && (
                        <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" onClick={() => setDismissedEnds((list) => list.filter((k) => k !== endKey(sch)))} title="Confirm end time" aria-label="Confirm end time">
                          <BellRing size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" className={`btn-hs btn-icon-hs ${ended ? 'btn-secondary-hs' : 'btn-primary-hs'}`} onClick={() => openViewModal(sch)} title="Document" aria-label="Document">
                        <FileText size={16} aria-hidden="true" />
                      </button>
                      {!cancelled && !isLegacySchedule(sch) && (
                        <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => setParticipantsSchedule(sch)} title="Add students" aria-label="Add students">
                          <UserRoundPlus size={16} aria-hidden="true" />
                        </button>
                      )}
                      {!cancelled && !isLegacySchedule(sch) && sch.form_kind && (
                        <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openImport(sch)} title="Import CSV" aria-label="Import CSV">
                          <Upload size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => handleStartBatch(sch)} title="Start" aria-label="Start">
                        <Play size={16} aria-hidden="true" />
                      </button>
                      {!cancelled && (
                        <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleEndNow(sch)} title="End screening" aria-label="End screening">
                          <Flag size={16} aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}

                  {activeTab === 'past' && (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" onClick={() => openViewModal(sch)} title="Records" aria-label="Records">
                        <FileText size={16} aria-hidden="true" />
                      </button>
                      {!cancelled && (
                        <>
                          {isPhysicalSchedule(sch) && (
                            <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => printResultsReport(sch)} title="Results report with play lists (PDF)" aria-label="Results report with play lists, PDF">
                              <Printer size={16} aria-hidden="true" />
                            </button>
                          )}
                          {(absentCount + Number(sch.pending_count || 0)) > 0 && sch.form_kind && !isLegacySchedule(sch) && (
                            <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openMakeup(sch)} title="Make-up" aria-label="Make-up">
                              <UserRoundPlus size={16} aria-hidden="true" />
                            </button>
                          )}
                        </>
                      )}
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => handleArchiveSchedule(sch)} title="Archive" aria-label="Archive">
                        <Archive size={16} aria-hidden="true" />
                      </button>
                      {resultCount === 0 && (
                        <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleDeleteSchedule(sch)} title="Delete" aria-label="Delete">
                          <X size={16} aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        </DaySection>
      ))}

      <Pager page={page} pageCount={pageInfo.pageCount} total={pageInfo.total} pageSize={pageInfo.pageSize} onPage={setPage} noun="screenings" />
      </div>
      {inFolder && folderAside}
      </div>
      )}

      {/* MODAL 1: Schedule Screening Details */}
      {showScheduleModal && (
        <HsDialog onClose={() => setShowScheduleModal(false)}>
          <HsDialogHeader onClose={() => setShowScheduleModal(false)} icon={Plus} center={<StepDots step={1} />}>New screening</HsDialogHeader>
          <form onSubmit={handleNextToStudents} className="modal-form-hs">
            <div className="modal-body-hs">
              <div className="form-group-hs">
                <label htmlFor="hs-fld-1">Title <Req /></label>
                <input id="hs-fld-1"
                  type="text"
                  required
                  value={scheduleForm.title}
                  onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})}
                  placeholder="Title"
                />
              </div>

              {/* Category: General Screening (one class, class folder) or Physical Activities (random participants, allow-to-play list) */}
              <fieldset className="pk-block-hs">
                <legend>Category</legend>
                <div className="pk-cards-hs">
                  <label className="pk-card-hs">
                    <input type="radio" name="hs-category" checked={!isPhysical} onChange={() => changeCategory('GENERAL')} />
                    <span className="pk-card-text-hs">
                      <span className="pk-card-title-hs"><ClipboardList size={18} aria-hidden="true" /> General Screening</span>
                      <span className="pk-card-sub-hs">One class, class folder</span>
                    </span>
                  </label>
                  <label className="pk-card-hs">
                    <input type="radio" name="hs-category" checked={isPhysical} onChange={() => changeCategory('PHYSICAL')} />
                    <span className="pk-card-text-hs">
                      <span className="pk-card-title-hs"><Dumbbell size={18} aria-hidden="true" /> Physical Activities</span>
                      <span className="pk-card-sub-hs">Random students, allow to play</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {/* Folder: existing or new class folder (General Screening only; Physical Activities always starts a new list) */}
              {!isPhysical && (
              <div className="pk-block-hs">
                <div className="pk-folder-head-hs">
                  <span className="pk-block-title-hs">Folder</span>
                  <div className="pk-seg-hs" role="group" aria-label="Existing or new folder">
                    <button
                      type="button"
                      aria-pressed={scheduleForm.folder_mode === 'existing'}
                      disabled={sectionFolders.length === 0}
                      onClick={() => changeFolderMode('existing')}
                    >
                      <Folder size={16} aria-hidden="true" /> Existing
                    </button>
                    <button type="button" aria-pressed={scheduleForm.folder_mode === 'new'} onClick={() => changeFolderMode('new')}>
                      <FolderPlus size={16} aria-hidden="true" /> New
                    </button>
                  </div>
                </div>

                {scheduleForm.folder_mode === 'existing' && !isCustomGrouping && (
                  <div className="form-group-hs">
                    <select
                      id="hs-folder-pick"
                      aria-label="Section folder"
                      required
                      value={scheduleForm.section_key}
                      onChange={e => pickSectionFolder(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {sectionFolders.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                )}
                {scheduleForm.folder_mode === 'new' && (
                  <p className="hint-hs pk-hint-hs"><Lock size={14} aria-hidden="true" /> Class is set on the next step</p>
                )}
              </div>
              )}

              {/* When: date and time on one row */}
              <div className="pk-when-hs">
                <div className="form-group-hs">
                  <label htmlFor="hs-fld-3">Date <Req /></label>
                  <input id="hs-fld-3"
                    type="date"
                    required
                    min={getTodayString()}
                    value={scheduleForm.scheduled_date}
                    onChange={e => {
                      const newDate = e.target.value;
                      if (newDate && newDate < getTodayString()) {
                        showAlert('Scheduled date cannot be in the past.', 'Invalid Date', 'warning');
                        return;
                      }
                      setScheduleForm(prev => ({ ...prev, scheduled_date: newDate, start_time: '', end_time: '' }));
                    }}
                  />
                </div>
                <AutoTimeFields
                  followNow
                  date={scheduleForm.scheduled_date}
                  value={{ start_time: scheduleForm.start_time, end_time: scheduleForm.end_time }}
                  onChange={(t) => setScheduleForm(prev => ({ ...prev, ...t }))}
                  onDateChange={(d) => setScheduleForm(prev => ({ ...prev, scheduled_date: d }))}
                  onNotice={(msg) => showAlert(msg, 'No Free Time', 'warning')}
                />
              </div>

              <div className="form-group-hs">
                <label htmlFor="hs-fld-6">Notes</label>
                <textarea id="hs-fld-6"
                  rows={2}
                  value={scheduleForm.announcement}
                  onChange={e => setScheduleForm({...scheduleForm, announcement: e.target.value})}
                  placeholder="Notes"
                />
              </div>
            </div>

            <div className="modal-footer-hs">
              <div className="foot-sum-hs">
                {scheduleForm.screening_type && <span className="chip-hs">{scheduleForm.screening_type}</span>}
                {scheduleForm.scheduled_date && <span className="chip-hs">{formatDate(scheduleForm.scheduled_date)}</span>}
                {scheduleForm.start_time && scheduleForm.end_time && (
                  <span className="chip-hs">{formatTime(scheduleForm.start_time)} - {formatTime(scheduleForm.end_time)}</span>
                )}
              </div>
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowScheduleModal(false)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs">
                Next <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL 2: Select Target Students */}
      {showStudentSelectModal && (
        <HsDialog onClose={() => setShowStudentSelectModal(false)} size={isCustomGrouping ? 'lg' : ''}>
          <HsDialogHeader onClose={() => setShowStudentSelectModal(false)} icon={Users} center={<StepDots step={2} />}>New screening</HsDialogHeader>
          <form onSubmit={handleCreateSchedule} className="modal-form-hs">
            <div className="modal-body-hs">
              <div className="pk-ctx-hs">
                <span className="chip-hs chip-info-hs">
                  {lockedClass ? <Lock size={14} aria-hidden="true" /> : <Folder size={14} aria-hidden="true" />}
                  {isPhysical
                    ? 'Physical Activities'
                    : (sectionFolders.find(f => f.key === scheduleForm.section_key)?.label || 'New class folder')}
                </span>
                {folderSource && (
                  <span className="chip-hs" title="The list starts from the latest screening of this folder">
                    <History size={14} aria-hidden="true" /> {folderSource.title}
                  </span>
                )}
                {scheduleForm.screening_type && <span className="chip-hs">{scheduleForm.screening_type}</span>}
                {scheduleForm.scheduled_date && <span className="chip-hs">{formatDate(scheduleForm.scheduled_date)}</span>}
                {scheduleForm.start_time && scheduleForm.end_time && (
                  <span className="chip-hs">{formatTime(scheduleForm.start_time)} - {formatTime(scheduleForm.end_time)}</span>
                )}
              </div>

              <div className={`pk-panes-hs${isCustomGrouping ? ' pk-two-hs' : ''}`}>
                {/* LEFT: find and tick */}
                <section className="pk-find-hs" aria-label="Find students">
                  {!lockedClass && (
                    <div className="pk-filters-hs">
                      <select
                        id="pick-program-hs"
                        aria-label="Academic Program"
                        required={!isCustomGrouping}
                        value={scheduleForm.target_program_id}
                        onChange={e => { if (!isCustomGrouping) setSelectedStudentIds([]); setScheduleForm({...scheduleForm, target_program_id: e.target.value, target_year_level: '', target_section: ''}); }}
                      >
                        <option value="">{isCustomGrouping ? 'All programs' : '-- Program --'}</option>
                        {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                      </select>
                      <select
                        id="pick-year-hs"
                        aria-label="Year Level"
                        required={!isCustomGrouping}
                        disabled={!isCustomGrouping && !scheduleForm.target_program_id}
                        value={scheduleForm.target_year_level}
                        onChange={e => { if (!isCustomGrouping) setSelectedStudentIds([]); setScheduleForm({...scheduleForm, target_year_level: e.target.value, target_section: ''}); }}
                      >
                        <option value="">{isCustomGrouping ? 'All years' : '-- Year --'}</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        {String(programs.find(p => p.program_id === scheduleForm.target_program_id)?.type || '').toLowerCase() !== 'strand' && (
                          <>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                          </>
                        )}
                      </select>
                      <select
                        id="pick-section-hs"
                        aria-label="Section"
                        required={!isCustomGrouping}
                        disabled={!isCustomGrouping && !scheduleForm.target_year_level}
                        value={scheduleForm.target_section}
                        onChange={e => { if (!isCustomGrouping) setSelectedStudentIds([]); setScheduleForm({...scheduleForm, target_section: e.target.value}); }}
                      >
                        <option value="">{isCustomGrouping ? 'All sections' : '-- Section --'}</option>
                        {sectionOptions.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                      {isCustomGrouping && (scheduleForm.target_program_id || scheduleForm.target_year_level || scheduleForm.target_section) && (
                        <button
                          type="button"
                          className="btn-hs btn-icon-hs btn-secondary-hs"
                          aria-label="Reset filters"
                          title="Reset filters"
                          onClick={() => setScheduleForm({ ...scheduleForm, target_program_id: '', target_year_level: '', target_section: '' })}
                        >
                          <RotateCcw size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pk-search-hs">
                    <Search size={18} aria-hidden="true" />
                    <input
                      id="pick-search-hs"
                      type="search"
                      aria-label="Search by name or ID"
                      placeholder="Name or ID"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                    />
                  </div>

                  <div className="pk-bar-hs">
                    <label className="pk-all-hs">
                      <input
                        type="checkbox"
                        checked={areAllFilteredSelected}
                        onChange={handleSelectAllFiltered}
                        disabled={listedStudents.length === 0}
                        aria-label="Select or deselect all shown students"
                      />
                      <span>{isCustomGrouping ? `${listedStudents.length} shown` : 'Whole class'}</span>
                    </label>
                    {!isCustomGrouping && visibleStudents.length > 0 && (
                      <>
                        <span
                          className="pk-progress-hs"
                          role="progressbar"
                          aria-label="Students selected"
                          aria-valuemin={0}
                          aria-valuemax={visibleStudents.length}
                          aria-valuenow={addedInView}
                        >
                          <span style={{ width: `${Math.round((addedInView / visibleStudents.length) * 100)}%` }} />
                        </span>
                        <span className="pk-count-hs" role="status">{addedInView} of {visibleStudents.length}</span>
                      </>
                    )}
                    {isCustomGrouping && <span className="pk-count-hs" role="status">{selectedStudentIds.length} added</span>}
                  </div>

                  {!isCustomGrouping && visibleStudents.length > 0 && (
                    <div className="pk-seg-hs" role="group" aria-label="Show">
                      <button type="button" aria-pressed={pickerShow === 'all'} onClick={() => setPickerShow('all')}>All {visibleStudents.length}</button>
                      <button type="button" aria-pressed={pickerShow === 'added'} onClick={() => setPickerShow('added')}>Added {addedInView}</button>
                      <button type="button" aria-pressed={pickerShow === 'left'} onClick={() => setPickerShow('left')}>Left out {visibleStudents.length - addedInView}</button>
                    </div>
                  )}

                  <div className={`pk-list-hs${isCustomGrouping ? '' : ' pk-cols-hs'}`}>
                    {listedStudents.length === 0 ? (
                      <div className="pk-empty-hs">
                        <Search size={24} aria-hidden="true" />
                        {!isCustomGrouping && !scheduleForm.target_section ? 'Pick a class' : 'No match'}
                      </div>
                    ) : (
                      pickerPageData.items.map(st => {
                        const on = selectedStudentIds.includes(st.student_id);
                        const fullName = `${st.first_name} ${st.last_name}`;
                        return (
                          <label key={st.student_id} className={`pk-row-hs${on ? ' on-hs' : ''}`}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${fullName}`}
                              checked={on}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, st.student_id]);
                                else setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.student_id));
                              }}
                            />
                            <span className="pk-avatar-hs" aria-hidden="true">{`${(st.first_name || '').charAt(0)}${(st.last_name || '').charAt(0)}`.toUpperCase()}</span>
                            <span className="pk-name-hs">
                              <span className="pk-name-main-hs">{fullName}</span>
                              <span className="pk-id-hs">{st.student_id}</span>
                            </span>
                            {isCustomGrouping && <span className="chip-hs">{classLabel(st.program_id, st.year_level, st.section)}</span>}
                          </label>
                        );
                      })
                    )}
                  </div>
                  <Pager page={pickerPageData.page} pageCount={pickerPageData.pageCount} total={pickerPageData.total} pageSize={PICKER_PER_PAGE} onPage={setPickerPage} noun="students" />
                </section>

                {/* RIGHT (mixed group): who is picked */}
                {isCustomGrouping && (
                  <section className="pk-tray-hs" aria-label="Selected students">
                    <div className="pk-tray-head-hs">
                      <Users size={18} aria-hidden="true" />
                      <h3>Selected <span className="pk-badge-hs" role="status">{selectedStudentIds.length}</span></h3>
                      {pickedStudents.length > 0 && (
                        <button
                          type="button"
                          className="btn-hs btn-icon-hs btn-danger-hs"
                          aria-label="Clear all"
                          title="Clear all"
                          onClick={() => showConfirm('Clear all selected students?', () => setSelectedStudentIds([]))}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {pickedStudents.length > 0 && (
                      <div className="pk-groups-hs">
                        {Object.entries(pickedStudents.reduce((acc, st) => {
                          const k = classLabel(st.program_id, st.year_level, st.section);
                          acc[k] = (acc[k] || 0) + 1;
                          return acc;
                        }, {})).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([label, n]) => (
                          <span key={label} className="chip-hs chip-info-hs">{label} &middot; {n}</span>
                        ))}
                      </div>
                    )}
                    <div className="pk-list-hs">
                      {pickedStudents.length === 0 ? (
                        <div className="pk-empty-hs">
                          <UserRoundPlus size={28} aria-hidden="true" />
                          Tick students on the left
                        </div>
                      ) : (
                        pickedStudents.map(st => (
                          <div key={st.student_id} className="pk-row-hs pk-picked-hs">
                            <span className="pk-name-hs">
                              <span className="pk-name-main-hs">{st.first_name} {st.last_name}</span>
                              <span className="pk-id-hs">{classLabel(st.program_id, st.year_level, st.section)}</span>
                            </span>
                            <button
                              type="button"
                              className="btn-hs btn-icon-hs"
                              aria-label={`Remove ${st.first_name} ${st.last_name}`}
                              title="Remove"
                              onClick={() => setSelectedStudentIds(prev => prev.filter(id => id !== st.student_id))}
                            >
                              <X size={18} aria-hidden="true" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className="modal-footer-hs">
              <span className="pill-count-hs" role="status">
                <Users size={14} aria-hidden="true" /> {selectedStudentIds.length}
              </span>
              <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={handleBackToSchedule} aria-label="Back" title="Back">
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="submit"
                className="btn-hs btn-primary-hs"
                disabled={selectedStudentIds.length === 0}
                title={selectedStudentIds.length === 0 ? "Select a student" : "Save"}
              >
                Save
              </button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL 2b: View & edit participants of an upcoming schedule; an on going one only takes new students */}
      {participantsSchedule && (
        <ScreeningParticipantsModal
          schedule={participantsSchedule}
          addOnly={activeTab === 'ongoing'}
          programs={programs}
          apiBase={API_BASE}
          senderId={userId}
          showAlert={showAlert}
          showConfirm={showConfirm}
          onClose={() => setParticipantsSchedule(null)}
          onSaved={() => {
            setParticipantsSchedule(null);
            notifyScreeningChanged();
            fetchSchedules();
            showAlert('Participants saved.', 'Success', 'success');
          }}
        />
      )}

      {/* MODAL 3: Edit Upcoming Schedule */}
      {showEditModal && editingSchedule && (
        <HsDialog onClose={() => setShowEditModal(false)}>
          <HsDialogHeader onClose={() => setShowEditModal(false)}>Edit screening</HsDialogHeader>
          <form onSubmit={handleUpdateSchedule} className="modal-form-hs">
            <div className="modal-body-hs">
              <div className="form-group-hs">
                <label htmlFor="hs-fld-7">Title</label>
                <input id="hs-fld-7" type="text" required maxLength={150} value={editingSchedule.title || ''} onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })} />
              </div>
              <div className="form-group-hs">
                <span className="chip-hs chip-info-hs">{isPhysicalSchedule(editingSchedule) ? <Dumbbell size={14} aria-hidden="true" /> : <ClipboardList size={14} aria-hidden="true" />} {CATEGORY_LABELS[editingSchedule.screening_category] || CATEGORY_LABELS.GENERAL}</span>
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
                    setEditingSchedule(prev => ({ ...prev, scheduled_date: newDate, start_time: '', end_time: '' }));
                  }}
                />
              </div>
              <div className="form-grid-hs">
                <AutoTimeFields
                  date={editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : ''}
                  value={{ start_time: (editingSchedule.start_time || '').slice(0, 5), end_time: (editingSchedule.end_time || '').slice(0, 5) }}
                  onChange={(t) => setEditingSchedule(prev => ({ ...prev, ...t }))}
                  excludeId={editingSchedule.screening_schedule_id}
                  onDateChange={(d) => setEditingSchedule(prev => ({ ...prev, scheduled_date: d }))}
                  onNotice={(msg) => showAlert(msg, 'No Free Time', 'warning')}
                />
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-12">Notes</label>
                <textarea id="hs-fld-12" rows={3} value={editingSchedule.announcement || ''} onChange={e => setEditingSchedule({...editingSchedule, announcement: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs">Save</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* Archived folder: its screenings */}
      {folderView && (
        <HsDialog onClose={() => setFolderView(null)} size="lg">
          <HsDialogHeader onClose={() => setFolderView(null)} icon={Layers}>{folderView.folder.name}</HsDialogHeader>
          <div className="modal-body-hs">
            {folderView.loading ? (
              <p className="hint-hs" role="status">Loading</p>
            ) : folderView.schedules.length === 0 ? (
              <div className="no-records-hs"><Archive size={28} aria-hidden="true" /><p>None</p></div>
            ) : (
              <div className="pk-arch-list-hs">
                {folderView.schedules.map(sch => (
                  <div key={sch.screening_schedule_id} className="pk-arch-row-hs">
                    <span className="fld-ico-hs"><FileText size={20} aria-hidden="true" /></span>
                    <span className="pk-name-hs">
                      <span className="pk-name-main-hs">{sch.title}</span>
                      <span className="pk-id-hs">{typeLabel(sch.screening_type)} &middot; {formatDate(String(sch.scheduled_date).split('T')[0])} &middot; {sch.total_students} student{Number(sch.total_students) === 1 ? '' : 's'}</span>
                    </span>
                    <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openViewModal(sch)} aria-label={`View ${sch.title}`} title="View">
                      <Eye size={18} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </HsDialog>
      )}

      {/* MODAL 4: View & Document Ongoing/Past Screening */}
      {showViewModal && activeSchedule && (
        <HsDialog onClose={() => setShowViewModal(false)} size="lg">
          <HsDialogHeader
            onClose={() => setShowViewModal(false)}
            icon={typeIcon(activeSchedule.screening_type, activeSchedule.form_kind)}
            sub={(
              <div className="modal-sub-hs">
                {activeSchedule.scheduled_date ? formatDate(String(activeSchedule.scheduled_date).split('T')[0]) : ''} &middot; {formatTime(activeSchedule.start_time)} - {formatTime(activeSchedule.end_time)}
              </div>
            )}
            actions={(
              <>
                <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => printResultsReport(activeSchedule)} title="Results report with summary" aria-label="Results report with summary">
                  <FileText size={16} aria-hidden="true" />
                </button>
                {activeSchedule.status !== 'Cancelled' && (Number(activeSchedule.absent_count) + Number(activeSchedule.pending_count)) > 0 && screeningOver(activeSchedule) && activeSchedule.form_kind && !isLegacySchedule(activeSchedule) && (
                  <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openMakeup(activeSchedule)} title="Schedule a make-up session" aria-label="Schedule a make-up session">
                    <UserRoundPlus size={16} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          >
            {activeSchedule.title} <span className="chip-hs chip-info-hs">{typeLabel(activeSchedule.screening_type)}</span>
          </HsDialogHeader>
          <div className="modal-body-hs">
            {activeSchedule.status === 'Cancelled' && (
              <div className="cancelled-banner-hs">Cancelled{activeSchedule.cancelled_reason ? ': ' + activeSchedule.cancelled_reason : ''}</div>
            )}
            {(() => {
              const presentN = scheduleStudents.filter(st => attendanceOf(st) === 'PRESENT').length;
              const absentN = scheduleStudents.filter(st => attendanceOf(st) === 'ABSENT').length;
              const pendingN = scheduleStudents.length - presentN - absentN;
              const docN = scheduleStudents.filter(st => attendanceOf(st) === 'PRESENT' && hasResult(st)).length;
              const todoN = presentN - docN;
              const totalN = scheduleStudents.length;
              const pct = (n) => `${totalN ? (n / totalN) * 100 : 0}%`;
              const countOf = (key) => (key === 'ALL' ? totalN : key === 'PRESENT' ? presentN : key === 'ABSENT' ? absentN : pendingN);
              return (
                <>
                  <div className="kpis-hs">
                    <div className="kpi-hs"><b>{presentN}/{totalN}</b><span>Present</span></div>
                    <div className="kpi-hs kpi-bad-hs"><b>{absentN}</b><span>Absent</span></div>
                    <div className="kpi-hs kpi-ok-hs"><b>{docN}</b><span>Documented</span></div>
                    <div className="kpi-hs kpi-warn-hs"><b>{todoN}</b><span>To document</span></div>
                    <div className="stack-hs" role="img" aria-label={`${docN} documented, ${todoN} to document, ${absentN} absent`}>
                      <i className="stack-ok-hs" style={{ width: pct(docN) }} />
                      <i className="stack-warn-hs" style={{ width: pct(todoN) }} />
                      <i className="stack-bad-hs" style={{ width: pct(absentN) }} />
                    </div>
                  </div>
                  <div className="chips-hs" role="group" aria-label="Attendance">
                    {[['ALL', 'All'], ['PRESENT', 'Present'], ['ABSENT', 'Absent'], ['PENDING', 'Pending']].map(([key, label]) => (
                      <button key={key} type="button" className="chip-btn-hs" aria-pressed={attFilter === key} onClick={() => { setAttFilter(key); setParticipantPage(1); }}>
                        {label} <span className="chip-n-hs">{countOf(key)}</span>
                      </button>
                    ))}
                  </div>
                  {isPhysicalSchedule(activeSchedule) && (
                    <div className="chips-hs" role="group" aria-label="Allow to play">
                      {[['ALL', 'All'], ['ALLOWED', 'Allowed'], ['NOT_ALLOWED', 'Not allowed'], ['NONE', 'No decision']].map(([key, label]) => (
                        <button key={key} type="button" className="chip-btn-hs" aria-pressed={playFilter === key} onClick={() => { setPlayFilter(key); setParticipantPage(1); }}>
                          {label} <span className="chip-n-hs">{key === 'ALL' ? totalN : scheduleStudents.filter(st => (st.play_status || 'NONE') === key).length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {scheduleStudents.length > 0 && (
              <div className="folder-search-hs participant-search-hs">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search participants"
                  placeholder="Search"
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
                    const effectiveAttendanceStatus = attendanceOf(st);
                    const AttIcon = effectiveAttendanceStatus === 'PRESENT' ? CheckCircle : effectiveAttendanceStatus === 'ABSENT' ? X : Clock;
                    const isPresent = effectiveAttendanceStatus === 'PRESENT';

                    return (
                      <tr key={st.student_id}>
                        <td className="who-cell-hs">
                          <span className="pk-avatar-hs" aria-hidden="true">{`${(st.first_name || '').charAt(0)}${(st.last_name || '').charAt(0)}`.toUpperCase()}</span>
                          <span className="pk-name-hs">
                            <span className="pk-name-main-hs">{st.first_name} {st.last_name}</span>
                            <span className="pk-id-hs">{st.student_id}</span>
                            {(st.health_play?.conditions || []).length > 0 && (
                              <span className="pk-id-hs" title={st.health_play.conditions.join(', ')}>
                                Health: {st.health_play.conditions.slice(0, 2).join(', ')}{st.health_play.conditions.length > 2 ? ` +${st.health_play.conditions.length - 2}` : ''}
                              </span>
                            )}
                          </span>
                        </td>
                        <td>{classLabel(st.program_id, st.year_level, st.section)}</td>
                        <td>
                          <span className={`badge-hs badge-status-${effectiveAttendanceStatus.toLowerCase()}-hs`}>
                            <AttIcon size={14} aria-hidden="true" /> {effectiveAttendanceStatus.charAt(0) + effectiveAttendanceStatus.slice(1).toLowerCase()}
                          </span>
                          {isPresent && st.attended_at && <div className="sub-note-hs">Time in: {formatTime(st.attended_at)}</div>}
                          {st.attendance_note && <div className="sub-note-hs">{st.attendance_note}</div>}
                        </td>
                        <td>
                          <span className={`badge-hs ${isDocumented ? 'badge-success-hs' : 'badge-warning-hs'}`}>
                            {isDocumented ? 'Documented' : 'Pending'}
                          </span>
                          {isPhysicalSchedule(activeSchedule) && isDocumented && st.play_status && (
                            <div className="sub-note-hs"><span className={`chip-hs ${PLAY_TONES[st.play_status] || ''}`}>{PLAY_STATUS_LABELS[st.play_status]}</span></div>
                          )}
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
            {participantPageData.total === 0 && <p className="hint-hs hint-center-hs">No match</p>}
            <Pager page={participantPageData.page} pageCount={participantPageData.pageCount} total={participantPageData.total} pageSize={PARTICIPANTS_PER_PAGE} onPage={setParticipantPage} noun="students" />
          </div>
          <div className="modal-footer-hs">
            {activeTab === 'ongoing' && activeSchedule.status !== 'Cancelled' && !screeningOver(activeSchedule) && (
              <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleEndNow(activeSchedule)} title="End screening" aria-label="End screening">
                <Flag size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowViewModal(false)}>
              Close
            </button>
          </div>
        </HsDialog>
      )}

      {/* MODAL 6: Dynamic Screening Entry Form */}
      {showDocModal && selectedStudent && activeSchedule && (
        <HsDialog onClose={docLocked ? undefined : () => setShowDocModal(false)}>
          <HsDialogHeader
            onClose={docLocked ? undefined : () => setShowDocModal(false)}
            icon={typeIcon(activeSchedule.screening_type, activeSchedule.form_kind)}
            sub={<div className="modal-sub-hs">{selectedStudent.student_id} &middot; {classLabel(selectedStudent.program_id, selectedStudent.year_level, selectedStudent.section)}</div>}
            actions={hasResult(selectedStudent) ? <FormPdfButton model={screeningFormModel()} /> : null}
          >
            {selectedStudent.first_name} {selectedStudent.last_name}
          </HsDialogHeader>
          <form onSubmit={handleDocSubmit} className="modal-form-hs">
            {/* context + health history stay pinned above the scrolling form, so they never cover a field */}
            <div className="doc-strip-hs">
              <span className="chip-hs chip-info-hs">{typeLabel(activeSchedule.screening_type)}</span>
              {activeSchedule.scheduled_date && <span className="chip-hs">{formatDate(String(activeSchedule.scheduled_date).split('T')[0])}</span>}
              {selectedStudent.attended_at && <span className="chip-hs"><Clock size={14} aria-hidden="true" /> Time in {formatTime(selectedStudent.attended_at)}</span>}
              {!hasResult(selectedStudent) && selectedStudent.recent_at && (
                <span className="chip-hs chip-info-hs"><RotateCcw size={14} aria-hidden="true" /> Prefilled from {formatDate(selectedStudent.recent_at)}</span>
              )}
              <span className="doc-strip-sep-hs" aria-hidden="true" />
              <div className="doc-health-hs" role="group" aria-label="Health history">
                <strong className="doc-health-title-hs"><HeartPulse size={14} aria-hidden="true" /> Health history</strong>
                {docAsthma?.has && !(docHealth?.conditions || []).some((c) => /asthma/i.test(c)) && (
                  <span className="chip-hs chip-warn-hs" title={docAsthma.triggers || 'History of asthma'}>
                    <AlertTriangle size={14} aria-hidden="true" /> Asthma{docAsthma.triggers ? `: ${docAsthma.triggers}` : ''}
                  </span>
                )}
                {(docHealth?.conditions || []).length > 0
                  ? docHealth.conditions.map((c) => <span key={c} className="chip-hs chip-warn-hs"><AlertTriangle size={14} aria-hidden="true" /> {c}</span>)
                  : !docAsthma?.has && <span className="chip-hs chip-ok-hs"><Check size={14} aria-hidden="true" /> None reported</span>}
              </div>
            </div>
            <div className="modal-body-hs">
              {/* FORM TEMPLATE (CUSTOM) */}
              {activeSchedule.form_kind === 'CUSTOM' && (
                <>
                  {!activeSchedule.template && <p className="hint-hs" role="alert">Template missing</p>}
                  <div className="doc-grid-hs">
                  {(activeSchedule.template?.fields || []).map((f) => {
                    const id = `cf-${f.key}`;
                    const value = docData.answers?.[f.key] ?? '';
                    const setAnswer = (v) => setDocData(prev => ({ ...prev, answers: { ...(prev.answers || {}), [f.key]: v } }));
                    const label = (
                      <label htmlFor={id}>
                        {f.label}{f.required ? <> <Req /></> : null}{f.unit ? <span className="cf-unit-hs">({f.unit})</span> : null}
                      </label>
                    );
                    if (bpDocPair && f.key === bpDocPair.dia.key) return null;
                    if (bpDocPair && f.key === bpDocPair.sys.key) {
                      const { sys, dia } = bpDocPair;
                      const bpLabel = bloodPressureLabel(docFields, docData.answers);
                      const range = (x) => rangeFlagText({ min: x.min, max: x.max });
                      const playRange = isPhysicalDoc && (playRangeText(sys) || playRangeText(dia)) ? ` · Play ${playRangeText(sys) || '-'} / ${playRangeText(dia) || '-'}` : '';
                      return (
                        <div className="form-group-hs" key={sys.key}>
                          <div className="doc-lblrow-hs">
                            <label htmlFor="cf-bp-hs">BP (mmHg){(sys.required || dia.required) ? <> <Req /></> : null}</label>
                            <StateChip state={bpLabel === 'Normal' ? 'Normal' : bpLabel === 'Low Blood' ? 'Low' : bpLabel === 'High Blood' ? 'High' : ''} id="cf-bp-flag-hs" bp />
                          </div>
                          <input
                            id="cf-bp-hs"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="120/80"
                            pattern={BP_PATTERN}
                            title="Systolic/Diastolic, for example 120/80"
                            required={!!(sys.required || dia.required)}
                            value={bpDraft}
                            onChange={e => {
                              const text = e.target.value.replace(/[^\d/]/g, '').slice(0, 7);
                              setBpDraft(text);
                              setDocData(prev => ({ ...prev, answers: { ...(prev.answers || {}), ...bpParse(text, bpDocPair) } }));
                            }}
                            aria-describedby="cf-bp-range-hs cf-bp-flag-hs"
                          />
                          <small id="cf-bp-range-hs" className="range-hint-hs">Normal {range(sys)} / {range(dia)}{playRange}</small>
                        </div>
                      );
                    }
                    if (f.type === 'calculated') {
                      const calc = calculate(f, docData.answers);
                      const calcState = calc ? rangeState(f, calc.value) : '';
                      return (
                        <div className="form-group-hs" key={f.key}>
                          <div className="doc-lblrow-hs">{label}<StateChip state={calcState} id={`${id}-flag`} label={f.label} /></div>
                          <input id={id} type="text" readOnly value={calc ? `${calc.value}${calc.label ? ` (${calc.label})` : ''}` : ''} placeholder="Auto" aria-describedby={calcState ? `${id}-flag` : undefined} />
                          {(f.min !== undefined || f.max !== undefined) && <small className="range-hint-hs">Normal {rangeFlagText(f)}</small>}
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
                    const numState = f.type === 'number' ? rangeState(f, value) : '';
                    const noPlay = isPhysicalDoc && playDecision([f], docData.answers).blocked;
                    const hasRange = f.type === 'number' && (f.min !== undefined || f.max !== undefined || (isPhysicalDoc && playRangeText(f)));
                    return (
                      <div className="form-group-hs" key={f.key}>
                        <div className="doc-lblrow-hs">{label}<StateChip state={numState} id={`${id}-flag`} label={f.label} bp={f.key === docBp.sys?.key || f.key === docBp.dia?.key} /></div>
                        <input
                          id={id}
                          type={f.type === 'number' ? 'number' : 'text'}
                          step={f.type === 'number' ? 'any' : undefined}
                          maxLength={f.type === 'text' ? 255 : undefined}
                          required={f.required}
                          value={value}
                          onChange={e => setAnswer(e.target.value)}
                          aria-describedby={`${id}-range ${numState ? `${id}-flag` : ''}`.trim()}
                        />
                        {hasRange && (
                          <small id={`${id}-range`} className="range-hint-hs">
                            {(f.min !== undefined || f.max !== undefined) && <>Normal {rangeFlagText(f)}</>}
                            {isPhysicalDoc && playRangeText(f) && <>{(f.min !== undefined || f.max !== undefined) ? ' · ' : ''}Play {playRangeText(f)}</>}
                          </small>
                        )}
                        {noPlay && (
                          <small className="flag-hs" role="status">
                            <Ban size={14} aria-hidden="true" /> Not allowed to play
                          </small>
                        )}
                      </div>
                    );
                  })}
                  </div>
                  {!bpDocPair && (() => {
                    const bp = bloodPressureLabel(docFields, docData.answers);
                    if (!bp) return null;
                    return (
                      <div className="doc-verdict-hs" role="status">
                        <span className={`chip-hs ${bp === 'Normal' ? 'chip-ok-hs' : 'chip-warn-hs'}`}>{bp !== 'Normal' && <AlertTriangle size={14} aria-hidden="true" />} Blood pressure: {bp}</span>
                      </div>
                    );
                  })()}
                  {isPhysicalDoc && docClearance && (
                    <div className={`play-box-hs play-${docPlayStatus.toLowerCase()}-hs`} role="status">
                      <div className="play-head-hs">
                        <ShieldCheck size={18} aria-hidden="true" /> Allow-to-Play
                        <span className={`chip-hs ${PLAY_TONES[docPlayStatus]}`}>
                          {docPlayStatus === 'ALLOWED' ? <Check size={14} aria-hidden="true" /> : <Ban size={14} aria-hidden="true" />} {docClearance.label}
                        </span>
                      </div>
                      <ul className="play-list-hs">
                        {(docPlayStatus === 'ALLOWED' ? docClearance.restrictions : [docClearance.sentence]).map((t) => <li key={t}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="form-group-hs">
                    <label htmlFor="cf-remarks-hs">Remarks</label>
                    <textarea
                      id="cf-remarks-hs"
                      value={docData.remarks}
                      onChange={e => { setRemarksTouched(true); setDocData({ ...docData, remarks: e.target.value }); }}
                      rows={4}
                      placeholder="Remarks"
                    />
                  </div>
                </>
              )}

              {/* HEARING FORM */}
              {activeSchedule.form_kind === 'HEARING' && (
                <>
                  <div className="form-group-hs">
                    <label htmlFor="hs-fld-13">Left ear <Req /></label>
                    <select id="hs-fld-13" required value={docData.left_ear_result} onChange={e => setDocData({...docData, left_ear_result: e.target.value})}>
                      <option value="">-- Select result --</option>
                      <option value="Pass">Pass</option>
                      <option value="Refer">Refer</option>
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label htmlFor="hs-fld-14">Right ear <Req /></label>
                    <select id="hs-fld-14" required value={docData.right_ear_result} onChange={e => setDocData({...docData, right_ear_result: e.target.value})}>
                      <option value="">-- Select result --</option>
                      <option value="Pass">Pass</option>
                      <option value="Refer">Refer</option>
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label htmlFor="hs-fld-15">Remarks</label>
                    <textarea id="hs-fld-15" value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Remarks" />
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer-hs">
              {(() => {
                const fields = activeSchedule.form_kind === 'CUSTOM' ? (activeSchedule.template?.fields || []) : [];
                const outN = fields.filter((f) => {
                  if (f.type === 'calculated') {
                    const c = calculate(f, docData.answers);
                    return c && ((f.min !== undefined && c.value < f.min) || (f.max !== undefined && c.value > f.max));
                  }
                  const v = docData.answers?.[f.key];
                  return f.type === 'number' && v !== undefined && v !== '' && ((f.min !== undefined && Number(v) < f.min) || (f.max !== undefined && Number(v) > f.max));
                }).length;
                return outN > 0 ? (
                  <span className="foot-note-hs" role="status"><AlertTriangle size={14} aria-hidden="true" /> {outN} out of range</span>
                ) : null;
              })()}
              {!docLocked && <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowDocModal(false)}>Cancel</button>}
              <button type="submit" className="btn-hs btn-primary-hs">Save</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL: Reason prompt (cancel screening / attendance override) */}
      {reasonModal && (
        <HsDialog onClose={() => setReasonModal(null)} size="sm" zIndex={1050}>
          <HsDialogHeader onClose={() => setReasonModal(null)}>{reasonModal.title}</HsDialogHeader>
          <div className="modal-body-hs">
            {reasonModal.message && <p className="ack-hs">{reasonModal.message}</p>}
            <div className="form-group-hs">
              <label htmlFor="hs-fld-16">{reasonModal.label}</label>
              <textarea id="hs-fld-16" rows={3} autoFocus value={reasonText} onChange={e => setReasonText(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer-hs">
            <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setReasonModal(null)}>Back</button>
            <button type="button" className={`btn-hs ${reasonModal.danger ? 'btn-danger-hs' : 'btn-primary-hs'}`} onClick={submitReason}>
              {reasonModal.danger && <Trash2 size={16} aria-hidden="true" />}{reasonModal.confirmText}
            </button>
          </div>
        </HsDialog>
      )}

      {/* MODAL: Import results (CSV) into the screening of a folder */}
      {importData && (() => {
        const sch = importData.schedule;
        const first = importData.students[0];
        const custom = !!sch.folder_id;
        const cls = custom ? { custom: true } : {
          program_id: sch.target_program_id || first?.program_id,
          year_level: sch.target_year_level || first?.year_level,
          section: sch.target_section || first?.section
        };
        const label = custom ? folderLabelOf(sch) : sectionFolderName(cls.program_id, cls);
        return (
          <ScreeningImportModal
            schedule={sch}
            students={importData.students}
            folderLabel={label}
            folderClass={cls}
            programs={programs}
            senderId={userId}
            onClose={() => setImportData(null)}
            onMessage={(message, title, type) => showAlert(message, title, type)}
            onDone={({ saved, rejected, failed }) => {
              setImportData(null);
              fetchSchedules();
              if (saved > 0) notifyScreeningChanged();
              const lines = [`${saved} saved`, rejected ? `${rejected} rejected` : '', ...failed.slice(0, 5)].filter(Boolean);
              showAlert(lines.join('\n'), 'Import Finished', failed.length || rejected ? 'warning' : 'success');
            }}
          />
        );
      })()}

      {/* MODAL: Make-up session for absent students */}
      {makeupModal && (
        <HsDialog onClose={() => setMakeupModal(null)} zIndex={1050}>
          <HsDialogHeader onClose={() => setMakeupModal(null)}>Make-up <span className="chip-hs chip-bad-hs">{Number(makeupModal.schedule.absent_count || 0) + Number(makeupModal.schedule.pending_count || 0)} absent</span></HsDialogHeader>
          <form onSubmit={submitMakeup} className="modal-form-hs">
            <div className="modal-body-hs">
              {folderLabelOf(makeupModal.schedule) && (
                <p className="picker-chip-hs">
                  <span className="chip-hs chip-info-hs" title="A make-up stays in the folder of the screening">
                    <Lock size={14} aria-hidden="true" /> {folderLabelOf(makeupModal.schedule)}
                  </span>
                </p>
              )}
              <div className="form-group-hs">
                <label htmlFor="hs-fld-17">Title</label>
                <input id="hs-fld-17" type="text" required maxLength={150} value={makeupModal.title} onChange={e => setMakeupModal({ ...makeupModal, title: e.target.value })} />
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-18">Date</label>
                <input id="hs-fld-18" type="date" required min={getTodayString()} value={makeupModal.scheduled_date} onChange={e => setMakeupModal({ ...makeupModal, scheduled_date: e.target.value, start_time: '', end_time: '' })} />
              </div>
              <div className="form-grid-hs">
                <AutoTimeFields
                  date={makeupModal.scheduled_date}
                  value={{ start_time: makeupModal.start_time, end_time: makeupModal.end_time }}
                  onChange={(t) => setMakeupModal(prev => (prev ? { ...prev, ...t } : prev))}
                  autoOnMount
                  followNow
                  onDateChange={(d) => setMakeupModal(prev => (prev ? { ...prev, scheduled_date: d } : prev))}
                  onNotice={(msg) => showAlert(msg, 'No Free Time', 'warning')}
                />
              </div>
              <div className="form-group-hs">
                <label htmlFor="hs-fld-21">Notes</label>
                <textarea id="hs-fld-21" rows={2} value={makeupModal.announcement} onChange={e => setMakeupModal({ ...makeupModal, announcement: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setMakeupModal(null)}>Cancel</button>
              <button type="submit" className="btn-hs btn-primary-hs">Create</button>
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
              <div className="form-group-hs">
                <label htmlFor="hs-fld-22">Doctor</label>
                <select id="hs-fld-22" required value={referModal.doctor_id} onChange={e => setReferModal({ ...referModal, doctor_id: e.target.value, slot: null })}>
                  <option value="">-- Select --</option>
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
                  {referSlotsLoading ? <p className="hint-hs" role="status">Loading</p> : referSlots.length === 0 ? (
                    <p className="hint-hs warn-hs">No schedule</p>
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
              <button type="submit" className="btn-hs btn-primary-hs" disabled={!referModal.slot}>Refer</button>
            </div>
          </form>
        </HsDialog>
      )}

      {/* MODAL: Student screening history */}
      {historyModal && (
        <StudentScreeningHistoryModal student={historyModal.student} rows={historyModal.rows} loading={historyModal.loading} onClose={() => setHistoryModal(null)} />
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
