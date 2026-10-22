// healthScreening.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Calendar, Clock, Plus, Users, Eye, Activity, Smile, HeartPulse, Ear, 
  X, CheckCircle, Edit3, Trash2, FileText, ArrowLeft, ArrowRight, QrCode, AlertCircle, Megaphone, Printer, Filter,
  Bell, Play, MoreVertical, UserRoundPlus, Download, Search
} from 'lucide-react';
import jsQR from 'jsqr';

import { openReportWindow, writeReport, escapeHtml } from '../../utils/printReport';
import stiLogo from '../../assets/sti-logof.png';
import { formatDate, formatTime } from '../../utils/datetime';
import '../../styles/nurse/HealthScreening.css';
import { FolderCrumbs, FolderGrid, Pager, MoreMenu, sectionLabel, paginate, scopeCounts, TabCount, groupByDay, dayKey, dayHeading, DaySection } from '../../components/common/RecordFolders';

// Dental / Vision moved to Doctor Visits. Old schedules still show up (read-only) as legacy.
const SCREENING_TYPES = [
  { value: 'BMI', label: 'BMI Monitoring' },
  { value: 'Vital Signs', label: 'Vital Signs' },
  { value: 'Hearing', label: 'Hearing Screening' }
];
const LEGACY_TYPES = ['Dental', 'Vision'];
const typeLabel = (type) => (LEGACY_TYPES.includes(type) ? `${type} (legacy)` : type);
const hasResult = (st) => !!(st.bmi_log_id || st.vital_record_id || st.hearing_record_id || st.dental_record_id || st.vision_record_id);

// Same reference ranges as the server (resting, school-age / young adult).
const vitalFlag = (kind, a, b) => {
  const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  if (kind === 'bp') {
    const sys = n(a), dia = n(b);
    if (sys === null || dia === null) return '';
    if (sys < 90 || dia < 60) return 'Low';
    if (sys >= 130 || dia >= 80) return 'High';
    if (sys >= 120) return 'Elevated';
    return 'Normal';
  }
  const v = n(a);
  if (v === null) return '';
  if (kind === 'pulse') return v < 60 ? 'Low' : v > 100 ? 'High' : 'Normal';
  if (kind === 'temp') return v < 36.1 ? 'Low' : v >= 38 ? 'High' : v > 37.5 ? 'Elevated' : 'Normal';
  if (kind === 'resp') return v < 12 ? 'Low' : v > 20 ? 'High' : 'Normal';
  return '';
};
const flagColor = (flag) => (flag === 'Normal' ? '#15803d' : flag ? '#b91c1c' : '#64748b');

const time12 = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Columns of the results report / CSV for each screening type
const RESULT_COLUMNS = {
  'BMI': [
    ['Height (cm)', (r) => r.height_cm],
    ['Weight (kg)', (r) => r.weight_kg],
    ['BMI', (r) => r.bmi_value],
    ['Category', (r) => r.bmi_category]
  ],
  'Vital Signs': [
    ['Blood pressure', (r) => (r.bp_systolic != null ? `${r.bp_systolic}/${r.bp_diastolic}${r.bp_flag ? ` (${r.bp_flag})` : ''}` : '')],
    ['Pulse (bpm)', (r) => (r.pulse_rate != null ? `${r.pulse_rate}${r.pulse_flag ? ` (${r.pulse_flag})` : ''}` : '')],
    ['Temp (C)', (r) => (r.temperature_c != null ? `${r.temperature_c}${r.temperature_flag ? ` (${r.temperature_flag})` : ''}` : '')],
    ['Resp (/min)', (r) => (r.respiratory_rate != null ? `${r.respiratory_rate}${r.respiratory_flag ? ` (${r.respiratory_flag})` : ''}` : '')]
  ],
  'Hearing': [
    ['Left ear', (r) => r.left_ear_result],
    ['Right ear', (r) => r.right_ear_result]
  ]
};

const resultColumnsFor = (type) => RESULT_COLUMNS[type] || [['Result', (r) => r.result_summary]];

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
  if (q.view.kind === 'section') {
    p.set('program_id', q.view.program_id);
    p.set('year_level', q.view.year_level);
    p.set('section', q.view.section);
  } else if (q.view.kind === 'program') {
    p.set('program_id', q.view.program_id);
  }
  p.set('tab', q.activeTab);
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



// Helper to get today's local date in YYYY-MM-DD format
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modal States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStudentSelectModal, setShowStudentSelectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

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
    target_section: ''
  });

  const [filterStudents, setFilterStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Active Schedule & Selected Student for Documentation
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [scheduleStudents, setScheduleStudents] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // QR Scanner States & Refs
  const [qrInput, setQrInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState({ message: '', type: '' });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);

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
  const [openMenuKey, setOpenMenuKey] = useState(null);


  // Helper to parse Date and Time into a single JavaScript Date object
  const getScheduleDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const cleanDate = dateStr.split('T')[0];
    return new Date(`${cleanDate}T${timeStr}`);
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

  const handleResetFilters = () => {
    setFilterType('ALL');
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

    const endDt = getScheduleDateTime(activeSchedule.scheduled_date, activeSchedule.end_time);
    const isScheduleEnded = endDt ? new Date() > endDt : false;

    let presentCount = 0;
    const rows = scheduleStudents.map(st => {
      let attendance = st.attendance_status || 'PENDING';
      if (isScheduleEnded && attendance === 'PENDING') attendance = 'ABSENT';
      if (attendance === 'PRESENT') presentCount++;

      return [
        st.student_id || '',
        `${st.first_name || ''} ${st.last_name || ''}`.trim(),
        `${st.program_name || ''} (Yr ${st.year_level || ''} - ${st.section || ''})`,
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

  // Centralized scan handler for both JSQR and manual entry
  const processScannedStudentId = useCallback(async (studentId, force = false) => {
    if (!studentId || !activeSchedule) return;

    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId.trim(), force })
      });
      const data = await res.json();

      if (res.ok) {
        setScanFeedback({ message: data.message || `Scanned Student ID: ${studentId}`, type: 'success' });
        openViewModal(activeSchedule);
        fetchSchedules();
      } else if (res.status === 409 && data.outside_window) {
        // outside the scheduled time: the nurse decides
        showConfirm(
          `${data.error}\n\nMark present anyway?`,
          () => processScannedStudentId(studentId, true),
          'Outside Scheduled Time',
          'Yes, Mark Present',
          'No'
        );
      } else {
        setScanFeedback({ message: data.error || 'Scan failed.', type: 'error' });
      }
    } catch (err) {
      console.error('Error scanning QR:', err);
      setScanFeedback({ message: 'Network or server error during scan.', type: 'error' });
    }
  }, [activeSchedule]);

  // Camera initialization & continuous jsQR detection loop
  useEffect(() => {
    if (!showQrModal || !activeSchedule) return;

    let stream = null;
    let isScanning = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          animationFrameId.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setScanFeedback({ message: 'Unable to access camera device.', type: 'error' });
      }
    };

    const scanFrame = () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          isScanning = false;
          processScannedStudentId(code.data);
          
          setTimeout(() => {
            isScanning = true;
          }, 2500);
        }
      }

      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    startCamera();

    return () => {
      isScanning = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showQrModal, activeSchedule, processScannedStudentId]);

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
  const listMode = view.kind === 'section' || view.kind === 'all' || searching;

  const queryRef = useRef({});
  queryRef.current = { view, activeTab, search: debouncedSearch, filterType, filterStartDate, filterEndDate, page };

  const fetchFolders = useCallback(async () => {
    try {
      const q = queryRef.current;
      const qs = q.filterType && q.filterType !== 'ALL' ? `?type=${encodeURIComponent(q.filterType)}` : '';
      const res = await fetch(`${API_BASE}/screenings/folders${qs}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.programs)) setFolders(data);
    } catch (err) {
      console.error('Error fetching folders:', err);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  // Loads the current page (and refreshes the folder counts)
  const fetchSchedules = useCallback(async () => {
    fetchFolders();
    const q = queryRef.current;
    const inList = q.view.kind === 'section' || q.view.kind === 'all' || q.search !== '';
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
  }, [fetchFolders]);

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
  const queryKey = JSON.stringify([view, activeTab, debouncedSearch, filterType, filterStartDate, filterEndDate]);
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
  const openSection = (p, s) => { setView({ kind: 'section', program_id: p.program_id, program_name: p.program_name, year_level: s.year_level, section: s.section }); setSearchTerm(''); };

  const crumbTrail = (() => {
    const trail = [{ label: 'Health Screening', onClick: goRoot }];
    if (view.kind === 'program' || view.kind === 'section') {
      trail.push({
        label: view.program_id,
        onClick: view.kind === 'section' ? () => setView({ kind: 'program', program_id: view.program_id, program_name: view.program_name }) : undefined
      });
    }
    if (view.kind === 'section') trail.push({ label: sectionLabel(view) });
    if (view.kind === 'all') trail.push({ label: 'All screenings' });
    if (searching && view.kind !== 'section' && view.kind !== 'all') trail.push({ label: `Search: "${debouncedSearch}"` });
    return trail;
  })();

  const folderItems = (() => {
    if (view.kind === 'program') {
      const prog = folders.programs.find(p => p.program_id === view.program_id);
      return (prog ? prog.sections : []).map(s => ({
        key: `${s.year_level}-${s.section}`,
        title: sectionLabel(s),
        subtitle: view.program_name,
        counts: s,
        onClick: () => openSection(prog, s)
      }));
    }
    const items = folders.programs.map(p => ({
      key: p.program_id,
      title: p.program_id,
      subtitle: `${p.program_name} - ${p.sections.length} section${p.sections.length === 1 ? '' : 's'}`,
      counts: p,
      onClick: () => openProgram(p)
    }));
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
      !q || `${st.first_name || ''} ${st.last_name || ''} ${st.student_id || ''} ${st.program_name || ''} ${st.section || ''}`.toLowerCase().includes(q)
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

  const handleFilterStudents = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();

      if (scheduleForm.target_program_id) queryParams.append('program_id', scheduleForm.target_program_id);
      if (scheduleForm.target_year_level) queryParams.append('year_level', scheduleForm.target_year_level);
      if (scheduleForm.target_section) queryParams.append('section', scheduleForm.target_section);

      const res = await fetch(`${API_BASE}/filtered-students?${queryParams.toString()}`);
      const data = await res.json();

      const studentArray = Array.isArray(data) ? data : (data.students || data.data || []);
      setFilterStudents(studentArray);
    } catch (err) {
      console.error('Error filtering students:', err);
      setFilterStudents([]);
    }
  }, [scheduleForm.target_program_id, scheduleForm.target_year_level, scheduleForm.target_section]);

  useEffect(() => {
    if (showStudentSelectModal) {
      handleFilterStudents();
    }
  }, [showStudentSelectModal, handleFilterStudents]);

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

    setShowScheduleModal(false);
    setShowStudentSelectModal(true);
  };

  const handleBackToSchedule = () => {
    setShowStudentSelectModal(false);
    setShowScheduleModal(true);
  };

  const handleSelectAllFiltered = (e) => {
    if (e.target.checked) {
      const filteredIds = filterStudents.map(st => st.student_id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    } else {
      const filteredSet = new Set(filterStudents.map(st => st.student_id));
      setSelectedStudentIds(prev => prev.filter(id => !filteredSet.has(id)));
    }
  };

  const areAllFilteredSelected = filterStudents.length > 0 && 
    filterStudents.every(st => selectedStudentIds.includes(st.student_id));

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
        body: JSON.stringify({ ...scheduleForm, student_ids: selectedStudentIds, sender_id: userId })
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
    const cols = resultColumnsFor(schedule.screening_type);
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

    const cols = resultColumnsFor(schedule.screening_type);
    const s = data.summary;
    const dist = Object.entries(s.distribution).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('');
    const rowsHtml = data.rows.map(r => `
      <tr${r.is_abnormal ? ' class="abn"' : ''}>
        <td>${escapeHtml(r.student_id)}</td>
        <td>${escapeHtml(`${r.last_name}, ${r.first_name}`)}</td>
        <td>${escapeHtml(`${r.program_name || ''} ${r.year_level || ''}${r.section || ''}`)}</td>
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

  const handleManualScanSubmit = (e) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    processScannedStudentId(qrInput);
    setQrInput('');
  };

  const openDocumentModal = (student) => {
    if (student.attendance_status !== 'PRESENT') {
      showAlert('Student must be marked as PRESENT in order to document screening results.', 'Action Required', 'warning');
      return;
    }

    if (LEGACY_TYPES.includes(activeSchedule?.screening_type)) {
      showAlert(`${activeSchedule.screening_type} examinations are now Doctor Visits. This is a legacy schedule, so no new results can be recorded here.`, 'Moved to Doctor Visits', 'warning');
      return;
    }

    setSelectedStudent(student);
    setDocData({
      height_cm: student.height_cm || '',
      weight_kg: student.weight_kg || '',
      bmi_value: student.bmi_value || '',
      bmi_category: student.bmi_category || 'Normal',
      bp_systolic: student.bp_systolic ?? '',
      bp_diastolic: student.bp_diastolic ?? '',
      pulse_rate: student.pulse_rate ?? '',
      temperature_c: student.temperature_c ?? '',
      respiratory_rate: student.respiratory_rate ?? '',
      left_ear_result: student.left_ear_result || '',
      right_ear_result: student.right_ear_result || '',
      remarks: student.remarks || ''
    });
    setShowDocModal(true);
  };

  const calculateBMI = (height, weight) => {
    if (!height || !weight) return { bmi: '', category: '' };
    const hMeters = Number(height) / 100;
    const bmi = Math.round((Number(weight) / (hMeters * hMeters)) * 10) / 10;
    if (!Number.isFinite(bmi)) return { bmi: '', category: '' };
    let category = 'Normal';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi >= 30) category = 'Obese';
    else if (bmi >= 25) category = 'Overweight';
    return { bmi: bmi.toFixed(1), category };
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
          formData: docData
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowDocModal(false);
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
      title: '', screening_type: 'BMI', scheduled_date: '', start_time: '', end_time: '',
      announcement: '', target_program_id: '', target_year_level: '', target_section: ''
    });
    setSelectedStudentIds([]);
  };

  const now = new Date();

  // numbers on the status tabs (from the folder summary) and the cards of this page cut into days
  const tabCounts = scopeCounts(folders, view, searching);
  const screeningDays = groupByDay(schedules, (sch) => dayKey(sch.scheduled_date));

  return (
    <div className="container-hs">
      {/* Header */}
      <header className="header-hs">
        <div className="title-group-hs">
          <h1>Health Screening Management</h1>
          <p>Schedule, manage, and document student health assessments</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <MoreMenu
            buttonClassName="btn-hs btn-secondary-hs"
            items={[
              { icon: <Printer size={16} />, label: 'Print screening summary', onClick: handleExportAllReport },
              { icon: <Bell size={16} />, label: 'Send reminders', onClick: handleSendReminders }
            ]}
          />
          <button type="button" className="btn-hs btn-primary-hs" onClick={() => setShowScheduleModal(true)}>
            <Plus size={18} /> Schedule Screening
          </button>
        </div>
      </header>

      {/* Folders: Program > Year-Section */}
      <FolderCrumbs trail={crumbTrail} />

      {!listMode && (
        <>
          <div className="folder-toolbar-hs">
            <div className="folder-search-hs">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search all screenings by title, student name or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Screening type">
              <option value="ALL">All types</option>
              {SCREENING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {foldersLoading ? (
            <p className="hint-hs">Loading folders...</p>
          ) : (
            <FolderGrid items={folderItems} noun="screenings" emptyText="No screenings yet. Schedule one to create the first folder." />
          )}
        </>
      )}

      {listMode && (
      <>
      <div className="folder-toolbar-hs">
        <div className="folder-search-hs">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by title, student name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Screening type">
          <option value="ALL">All types</option>
          {SCREENING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs-hs">
        <button
          type="button"
          className={`tab-btn-hs ${activeTab === 'upcoming' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={16} /> Upcoming Screenings <TabCount value={tabCounts?.upcoming} />
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${activeTab === 'ongoing' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          <Clock size={16} /> Ongoing Screenings <TabCount value={tabCounts?.ongoing} />
        </button>
        <button
          type="button"
          className={`tab-btn-hs ${activeTab === 'past' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <CheckCircle size={16} /> Past Screenings <TabCount value={tabCounts?.past} />
        </button>
      </div>

      {/* Date range: only past screenings need one (the type filter lives in the toolbar above) */}
      {activeTab === 'past' && (
        <div className="filter-bar-hs">
          <span className="filter-title-hs"><Filter size={16} /> Date range</span>

          <label>
            From
            <input type="date" value={filterStartDate} max={filterEndDate || undefined} onChange={handleStartDateChange} />
          </label>

          <label>
            To
            <input type="date" value={filterEndDate} min={filterStartDate || undefined} onChange={handleEndDateChange} />
          </label>

          {(filterType !== 'ALL' || filterStartDate || filterEndDate) && (
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
                  {sch.screening_type === 'BMI' && <Activity size={14} />}
                  {sch.screening_type === 'Vital Signs' && <HeartPulse size={14} />}
                  {sch.screening_type === 'Hearing' && <Ear size={14} />}
                  {sch.screening_type === 'Dental' && <Smile size={14} />}
                  {sch.screening_type === 'Vision' && <Eye size={14} />}
                  {typeLabel(sch.screening_type)}
                </div>
                <h3 className="card-title-hs">{sch.title}</h3>
                <p className="card-info-hs"><Calendar size={14} /> {sch.scheduled_date ? formatDate(sch.scheduled_date.split('T')[0]) : ''}</p>
                <p className="card-info-hs"><Clock size={14} /> {formatTime(sch.start_time)} - {formatTime(sch.end_time)}</p>
                <p className="card-info-hs">
                  <Users size={14} /> <strong>{presentCount} / {totalCount}</strong> Present
                </p>
                {sch.announcement && (
                  <p className="card-info-hs announcement-preview-hs">
                    <Megaphone size={14} /> {sch.announcement}
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
                        onClick={() => { setEditingSchedule(sch); setShowEditModal(true); }}
                        title="Edit Schedule"
                        aria-label="Edit Schedule"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-hs btn-icon-hs btn-danger-hs"
                        onClick={() => handleCancelSchedule(sch)}
                        title="Cancel Schedule"
                        aria-label="Cancel Schedule"
                      >
                        <Trash2 size={16} />
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
                      <FileText size={16} />
                    </button>
                  )}

                  {activeTab === 'ongoing' && (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => handleStartBatch(sch)} title="Notify students that this screening is starting" aria-label="Start Screening">
                        <Play size={16} />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleCancelSchedule(sch)} title="Cancel Schedule" aria-label="Cancel Schedule">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}

                  {activeTab === 'past' && sch.status !== 'Cancelled' && (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => printResultsReport(sch)} title="Print results report" aria-label="Print results report">
                        <Printer size={16} />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => exportResultsCsv(sch)} title="Download results (CSV)" aria-label="Download results CSV">
                        <Download size={16} />
                      </button>
                      {(Number(sch.absent_count) + Number(sch.pending_count)) > 0 && SCREENING_TYPES.some(t => t.value === sch.screening_type) && (
                        <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => openMakeup(sch)} title="Schedule a make-up session for absent students" aria-label="Make-up session">
                          <UserRoundPlus size={16} />
                        </button>
                      )}
                    </>
                  )}

                  {activeTab === 'past' && Number(sch.result_count) === 0 && (
                    <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => handleDeleteSchedule(sch)} title="Delete (no results were recorded)" aria-label="Delete screening">
                      <X size={16} />
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
        <div className="modal-overlay-hs">
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Schedule Health Screening (Step 1 of 2)</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowScheduleModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleNextToStudents} className="modal-form-hs">
              <div className="modal-body-hs">
                <div className="form-group-hs">
                  <label>Title</label>
                  <input 
                    type="text" 
                    required 
                    value={scheduleForm.title} 
                    onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} 
                    placeholder="e.g. Annual Vital Signs Check" 
                  />
                </div>

                <div className="form-group-hs">
                  <label>Screening Type</label>
                  <select value={scheduleForm.screening_type} onChange={e => setScheduleForm({...scheduleForm, screening_type: e.target.value})}>
                    {SCREENING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                    Dental and Vision examinations are scheduled under Doctor Visits.
                  </small>
                </div>

                <div className="form-group-hs">
                  <label>Scheduled Date</label>
                  <input 
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
                    <label>Start Time</label>
                    <input 
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
                    <label>End Time</label>
                    <input 
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
                  <label>Announcement / Instructions (Optional)</label>
                  <textarea 
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
                  Next: Select Target Students <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Select Target Students */}
      {showStudentSelectModal && (
        <div className="modal-overlay-hs">
          <div className="modal-hs modal-lg-hs">
            <div className="modal-header-hs">
              <h2>Select Target Students (Step 2 of 2)</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowStudentSelectModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="modal-form-hs">
              <div className="modal-body-hs">
                <div className="form-grid-hs">
                  <div className="form-group-hs">
                    <label>Academic Program</label>
                    <select value={scheduleForm.target_program_id} onChange={e => setScheduleForm({...scheduleForm, target_program_id: e.target.value})}>
                      <option value="">All Programs</option>
                      {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label>Year Level</label>
                    <select value={scheduleForm.target_year_level} onChange={e => setScheduleForm({...scheduleForm, target_year_level: e.target.value})}>
                      <option value="">All Years</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label>Section</label>
                    <input type="text" placeholder="e.g. BSIT-101" value={scheduleForm.target_section} onChange={e => setScheduleForm({...scheduleForm, target_section: e.target.value})} />
                  </div>
                </div>

                <div className="student-select-list-hs">
                  <span className="list-title-hs">
                    Matching Students ({filterStudents.length}) — {selectedStudentIds.length} Total Selected
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
                              disabled={filterStudents.length === 0}
                              title="Select/Deselect all matching students"
                            />
                          </th>
                          <th>Student Name</th>
                          <th>Program</th>
                          <th>Year & Section</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterStudents.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="empty-table-msg-hs">
                              No students match the selected Program, Year Level, or Section filter.
                            </td>
                          </tr>
                        ) : (
                          filterStudents.map(st => (
                            <tr key={st.student_id}>
                              <td className="col-checkbox-hs">
                                <input 
                                  type="checkbox" 
                                  checked={selectedStudentIds.includes(st.student_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, st.student_id]);
                                    else setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.student_id));
                                  }}
                                />
                              </td>
                              <td>{st.first_name} {st.last_name}</td>
                              <td>{st.program_name || st.program_id}</td>
                              <td>Yr {st.year_level} - {st.section}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={handleBackToSchedule}>
                  <ArrowLeft size={16} /> Back
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
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Upcoming Schedule */}
      {showEditModal && editingSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Update Screening Schedule</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="modal-form-hs">
              <div className="modal-body-hs">
                <div className="form-group-hs">
                  <label>Title</label>
                  <input type="text" required maxLength={150} value={editingSchedule.title || ''} onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })} />
                </div>
                <div className="form-group-hs">
                  <label>Screening Type</label>
                  <select
                    value={editingSchedule.screening_type}
                    disabled={Number(editingSchedule.result_count) > 0 || LEGACY_TYPES.includes(editingSchedule.screening_type)}
                    onChange={e => setEditingSchedule({ ...editingSchedule, screening_type: e.target.value })}
                  >
                    {LEGACY_TYPES.includes(editingSchedule.screening_type) && <option value={editingSchedule.screening_type}>{typeLabel(editingSchedule.screening_type)}</option>}
                    {SCREENING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {Number(editingSchedule.result_count) > 0 && <small className="hint-hs">Results were already recorded, so the type is locked.</small>}
                </div>
                <div className="form-group-hs">
                  <label>Scheduled Date</label>
                  <input 
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
                    <label>Start Time</label>
                    <input 
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
                    <label>End Time</label>
                    <input 
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
                  <label>Announcement / Instructions</label>
                  <textarea rows={3} value={editingSchedule.announcement || ''} onChange={e => setEditingSchedule({...editingSchedule, announcement: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-hs btn-primary-hs">Update &amp; Notify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: View & Document Ongoing/Past Screening */}
      {showViewModal && activeSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs modal-lg-hs">
            <div className="modal-header-hs">
              <div>
                <h2>{activeSchedule.title} - Participant List ({activeSchedule.screening_type})</h2>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Attendance Rate: <strong>
                    {scheduleStudents.filter(st => st.attendance_status === 'PRESENT').length} / {scheduleStudents.length}
                  </strong> Present
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn-hs btn-secondary-hs" 
                  onClick={handleExportSingleReport}
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> export
                </button>
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => printResultsReport(activeSchedule)} style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }} title="Results report with summary">
                  <FileText size={16} /> Results
                </button>
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => exportResultsCsv(activeSchedule)} style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }} title="Download results as CSV">
                  <Download size={16} /> CSV
                </button>
                {activeSchedule.status !== 'Cancelled' && (Number(activeSchedule.absent_count) + Number(activeSchedule.pending_count)) > 0 && getScheduleDateTime(activeSchedule.scheduled_date, activeSchedule.end_time) < now && SCREENING_TYPES.some(t => t.value === activeSchedule.screening_type) && (
                  <button type="button" className="btn-hs btn-secondary-hs" onClick={() => openMakeup(activeSchedule)} style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <UserRoundPlus size={16} /> Make-up
                  </button>
                )}
                <button type="button" className="close-btn-hs" onClick={() => setShowViewModal(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="modal-body-hs">
              {activeSchedule.status === 'Cancelled' && (
                <div className="cancelled-banner-hs">This screening was cancelled{activeSchedule.cancelled_reason ? ': ' + activeSchedule.cancelled_reason : ''}. Its record is kept, but attendance and results can no longer be changed.</div>
              )}
              {activeTab === 'ongoing' && (
                <div className="qr-scanner-bar-hs">
                  <button type="button" className="btn-hs btn-primary-hs" onClick={() => { setShowQrModal(true); setScanFeedback({ message: '', type: '' }); }}>
                    <QrCode size={18} /> Scan Student QR Code
                  </button>
                  <p className="qr-hint-hs">Scan student QR code to mark attendance as PRESENT.</p>
                </div>
              )}

              {scheduleStudents.length > PARTICIPANTS_PER_PAGE && (
                <div className="folder-search-hs" style={{ marginBottom: '12px' }}>
                  <Search size={16} />
                  <input
                    type="text"
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
                      <th>Program</th>
                      <th>Year/Section</th>
                      <th>Attendance Status</th>
                      <th>Record Status</th>
                      <th className="col-action-hs">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantPageData.items.map(st => {
                      const isDocumented = hasResult(st);
                      const activeEndDt = getScheduleDateTime(activeSchedule.scheduled_date, activeSchedule.end_time);
                      const isScheduleEnded = activeEndDt ? now > activeEndDt : false;

                      let effectiveAttendanceStatus = st.attendance_status || 'PENDING';
                      if (isScheduleEnded && effectiveAttendanceStatus === 'PENDING') {
                        effectiveAttendanceStatus = 'ABSENT';
                      }

                      const isPresent = effectiveAttendanceStatus === 'PRESENT';

                      return (
                        <tr key={st.student_id}>
                          <td>{st.first_name} {st.last_name}</td>
                          <td>{st.program_name}</td>
                          <td>Yr {st.year_level} - {st.section}</td>
                          <td>
                            <span className={`badge-hs badge-status-${effectiveAttendanceStatus.toLowerCase()}-hs`}>
                              {effectiveAttendanceStatus}
                            </span>
                            {st.attendance_note && <div className="sub-note-hs">{st.attendance_note}</div>}
                          </td>
                          <td>
                            <span className={`badge-hs ${isDocumented ? 'badge-success-hs' : 'badge-warning-hs'}`}>
                              {isDocumented ? 'Documented' : 'Pending'}
                            </span>
                            {isDocumented && Number(st.is_abnormal) === 1 && <span className="badge-hs badge-status-absent-hs" style={{ marginLeft: '6px' }}>Abnormal</span>}
                            {st.referral_appointment_id && ['Scheduled', 'Pending Approval', 'Completed'].includes(st.referral_status) && (
                              <div className="sub-note-hs">Referred to doctor ({st.referral_status}{st.referral_start_time ? ', ' + formatDate(String(st.referral_start_time).slice(0, 10)) : ''})</div>
                            )}
                          </td>
                          <td className="col-action-hs">
                            {(() => {
                              const cancelled = activeSchedule.status === 'Cancelled';
                              const key = st.student_id;
                              const activeReferral = st.referral_appointment_id && ['Scheduled', 'Pending Approval'].includes(st.referral_status);
                              const items = [];
                              if (!cancelled) {
                                if (effectiveAttendanceStatus !== 'PRESENT') items.push({ label: 'Mark Present (override)', onClick: () => overrideAttendance(st, 'PRESENT') });
                                if (effectiveAttendanceStatus !== 'ABSENT' && !isDocumented) items.push({ label: 'Mark Absent', onClick: () => overrideAttendance(st, 'ABSENT') });
                                if (isDocumented && !activeReferral) items.push({ label: 'Refer to doctor', onClick: () => openRefer(st) });
                                if (isDocumented) items.push({ label: 'Delete result', danger: true, onClick: () => handleDeleteResult(st) });
                              }
                              items.push({ label: 'Screening history', onClick: () => openHistory(st) });
                              return (
                                <div className="row-actions-hs">
                                  <button
                                    type="button"
                                    className={`btn-hs btn-icon-hs ${isPresent && !cancelled ? 'btn-primary-hs' : 'btn-disabled-hs'}`}
                                    onClick={() => openDocumentModal({ ...st, attendance_status: effectiveAttendanceStatus })}
                                    disabled={!isPresent || cancelled}
                                    title={cancelled ? 'This screening was cancelled' : !isPresent ? 'Student must be marked PRESENT before documenting' : (isDocumented ? 'Edit result' : 'Document result')}
                                    aria-label="Document Result"
                                  >
                                    <FileText size={16} />
                                  </button>
                                  <div className="row-menu-wrap-hs">
                                    <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => setOpenMenuKey(openMenuKey === key ? null : key)} title="More actions" aria-label="More actions">
                                      <MoreVertical size={16} />
                                    </button>
                                    {openMenuKey === key && (
                                      <>
                                        <div className="row-menu-backdrop-hs" onClick={() => setOpenMenuKey(null)} />
                                        <div className="row-menu-hs">
                                          {items.map(item => (
                                            <button key={item.label} type="button" className={item.danger ? 'danger-hs' : ''} onClick={() => { setOpenMenuKey(null); item.onClick(); }}>
                                              {item.label}
                                            </button>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
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
          </div>
        </div>
      )}

      {/* MODAL 5: Live Camera QR Code Scanner via jsQR */}
      {showQrModal && activeSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs modal-sm-hs">
            <div className="modal-header-hs">
              <h2>Scan Student QR Code</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowQrModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-hs text-center-hs">
              <div className="qr-video-container-hs">
                <video ref={videoRef} className="qr-video-hs" />
                <canvas ref={canvasRef} className="qr-canvas-hs" />
              </div>

              {scanFeedback.message && (
                <div className={`scan-alert-hs alert-${scanFeedback.type}-hs`}>
                  {scanFeedback.type === 'error' && <AlertCircle size={16} />}
                  {scanFeedback.type === 'success' && <CheckCircle size={16} />}
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleManualScanSubmit} className="qr-input-form-hs">
                <input 
                  type="text" 
                  placeholder="Or enter Student ID manually..." 
                  value={qrInput} 
                  onChange={e => setQrInput(e.target.value)}
                  className="qr-text-input-hs"
                />
                <button type="submit" className="btn-hs btn-secondary-hs btn-full-hs">
                  Submit Manual Input
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Dynamic Screening Entry Form */}
      {showDocModal && selectedStudent && activeSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Document Screening: {selectedStudent.first_name} {selectedStudent.last_name}</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowDocModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDocSubmit} className="modal-form-hs">
              <div className="modal-body-hs">
                {/* BMI FORM */}
                {activeSchedule.screening_type === 'BMI' && (
                  <>
                    <div className="form-group-hs">
                      <label>Height (cm)</label>
                      <input 
                        type="number" step="0.1" required value={docData.height_cm} 
                        onChange={e => {
                          const h = e.target.value;
                          const { bmi, category } = calculateBMI(h, docData.weight_kg);
                          setDocData({...docData, height_cm: h, bmi_value: bmi, bmi_category: category});
                        }} 
                      />
                    </div>
                    <div className="form-group-hs">
                      <label>Weight (kg)</label>
                      <input 
                        type="number" step="0.1" required value={docData.weight_kg} 
                        onChange={e => {
                          const w = e.target.value;
                          const { bmi, category } = calculateBMI(docData.height_cm, w);
                          setDocData({...docData, weight_kg: w, bmi_value: bmi, bmi_category: category});
                        }} 
                      />
                    </div>
                    <div className="form-group-hs">
                      <label>Calculated BMI</label>
                      <input type="text" readOnly value={docData.bmi_value} placeholder="Auto-calculated" />
                    </div>
                    <div className="form-group-hs">
                      <label>BMI Category</label>
                      <input type="text" readOnly value={docData.bmi_category} placeholder="Auto-categorized" />
                    </div>
                  </>
                )}

                {/* VITAL SIGNS FORM */}
                {activeSchedule.screening_type === 'Vital Signs' && (
                  <>
                    <div className="form-group-hs">
                      <label>Blood Pressure (mmHg)</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="number" min="40" max="300" placeholder="Systolic" value={docData.bp_systolic} onChange={e => setDocData({...docData, bp_systolic: e.target.value})} />
                        <span>/</span>
                        <input type="number" min="20" max="200" placeholder="Diastolic" value={docData.bp_diastolic} onChange={e => setDocData({...docData, bp_diastolic: e.target.value})} />
                      </div>
                      {vitalFlag('bp', docData.bp_systolic, docData.bp_diastolic) && (
                        <small style={{ color: flagColor(vitalFlag('bp', docData.bp_systolic, docData.bp_diastolic)), fontWeight: 600 }}>
                          {vitalFlag('bp', docData.bp_systolic, docData.bp_diastolic)}
                        </small>
                      )}
                    </div>
                    <div className="form-group-hs">
                      <label>Pulse Rate (bpm)</label>
                      <input type="number" min="20" max="250" value={docData.pulse_rate} onChange={e => setDocData({...docData, pulse_rate: e.target.value})} />
                      {vitalFlag('pulse', docData.pulse_rate) && (
                        <small style={{ color: flagColor(vitalFlag('pulse', docData.pulse_rate)), fontWeight: 600 }}>{vitalFlag('pulse', docData.pulse_rate)}</small>
                      )}
                    </div>
                    <div className="form-group-hs">
                      <label>Temperature (&deg;C)</label>
                      <input type="number" step="0.1" min="30" max="45" value={docData.temperature_c} onChange={e => setDocData({...docData, temperature_c: e.target.value})} />
                      {vitalFlag('temp', docData.temperature_c) && (
                        <small style={{ color: flagColor(vitalFlag('temp', docData.temperature_c)), fontWeight: 600 }}>{vitalFlag('temp', docData.temperature_c)}</small>
                      )}
                    </div>
                    <div className="form-group-hs">
                      <label>Respiratory Rate (breaths/min)</label>
                      <input type="number" min="5" max="80" value={docData.respiratory_rate} onChange={e => setDocData({...docData, respiratory_rate: e.target.value})} />
                      {vitalFlag('resp', docData.respiratory_rate) && (
                        <small style={{ color: flagColor(vitalFlag('resp', docData.respiratory_rate)), fontWeight: 600 }}>{vitalFlag('resp', docData.respiratory_rate)}</small>
                      )}
                    </div>
                    <div className="form-group-hs">
                      <label>Remarks</label>
                      <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Observations / advice..." />
                    </div>
                  </>
                )}

                {/* HEARING FORM */}
                {activeSchedule.screening_type === 'Hearing' && (
                  <>
                    <div className="form-group-hs">
                      <label>Left Ear</label>
                      <select required value={docData.left_ear_result} onChange={e => setDocData({...docData, left_ear_result: e.target.value})}>
                        <option value="">-- Select result --</option>
                        <option value="Pass">Pass</option>
                        <option value="Refer">Refer</option>
                      </select>
                    </div>
                    <div className="form-group-hs">
                      <label>Right Ear</label>
                      <select required value={docData.right_ear_result} onChange={e => setDocData({...docData, right_ear_result: e.target.value})}>
                        <option value="">-- Select result --</option>
                        <option value="Pass">Pass</option>
                        <option value="Refer">Refer</option>
                      </select>
                    </div>
                    <div className="form-group-hs">
                      <label>Remarks</label>
                      <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Referral notes / follow-up advice..." />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn-hs btn-primary-hs">Save Document</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reason prompt (cancel screening / attendance override) */}
      {reasonModal && (
        <div className="modal-overlay-hs" style={{ zIndex: 1050 }}>
          <div className="modal-hs modal-sm-hs">
            <div className="modal-header-hs">
              <h2>{reasonModal.title}</h2>
              <button type="button" className="close-btn-hs" onClick={() => setReasonModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body-hs">
              {reasonModal.message && <p className="hint-hs">{reasonModal.message}</p>}
              <div className="form-group-hs">
                <label>{reasonModal.label}</label>
                <textarea rows={3} autoFocus value={reasonText} onChange={e => setReasonText(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setReasonModal(null)}>Back</button>
              <button type="button" className="btn-hs btn-primary-hs" onClick={submitReason}>{reasonModal.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Make-up session for absent students */}
      {makeupModal && (
        <div className="modal-overlay-hs" style={{ zIndex: 1050 }}>
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Schedule Make-up Session</h2>
              <button type="button" className="close-btn-hs" onClick={() => setMakeupModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={submitMakeup} className="modal-form-hs">
              <div className="modal-body-hs">
                <p className="hint-hs">
                  A new {makeupModal.schedule.screening_type} screening is created only for the students who were absent from
                  &quot;{makeupModal.schedule.title}&quot;. Students already booked into another make-up are skipped.
                </p>
                <div className="form-group-hs">
                  <label>Title</label>
                  <input type="text" required maxLength={150} value={makeupModal.title} onChange={e => setMakeupModal({ ...makeupModal, title: e.target.value })} />
                </div>
                <div className="form-group-hs">
                  <label>Date</label>
                  <input type="date" required min={getTodayString()} value={makeupModal.scheduled_date} onChange={e => setMakeupModal({ ...makeupModal, scheduled_date: e.target.value })} />
                </div>
                <div className="form-grid-hs">
                  <div className="form-group-hs">
                    <label>Start Time</label>
                    <input type="time" required value={makeupModal.start_time} onChange={e => setMakeupModal({ ...makeupModal, start_time: e.target.value })} />
                  </div>
                  <div className="form-group-hs">
                    <label>End Time</label>
                    <input type="time" required value={makeupModal.end_time} onChange={e => setMakeupModal({ ...makeupModal, end_time: e.target.value })} />
                  </div>
                </div>
                <div className="form-group-hs">
                  <label>Announcement / Instructions</label>
                  <textarea rows={2} value={makeupModal.announcement} onChange={e => setMakeupModal({ ...makeupModal, announcement: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setMakeupModal(null)}>Cancel</button>
                <button type="submit" className="btn-hs btn-primary-hs">Create &amp; Notify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Refer a student to a doctor */}
      {referModal && (
        <div className="modal-overlay-hs" style={{ zIndex: 1050 }}>
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Refer to Doctor: {referModal.student.first_name} {referModal.student.last_name}</h2>
              <button type="button" className="close-btn-hs" onClick={() => setReferModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={submitRefer} className="modal-form-hs">
              <div className="modal-body-hs">
                <p className="hint-hs">Creates a Referral visit in the doctor&apos;s open schedule. The result of this screening is attached to the visit.</p>
                <div className="form-group-hs">
                  <label>Doctor</label>
                  <select required value={referModal.doctor_id} onChange={e => setReferModal({ ...referModal, doctor_id: e.target.value, slot: null })}>
                    <option value="">-- Select Doctor --</option>
                    {referDoctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                  </select>
                </div>
                <div className="form-group-hs">
                  <label>Date</label>
                  <input type="date" required min={getTodayString()} value={referModal.date} onChange={e => setReferModal({ ...referModal, date: e.target.value, slot: null })} />
                </div>
                {referModal.doctor_id && referModal.date && (
                  <div className="form-group-hs">
                    <label>Available Slots</label>
                    {referSlotsLoading ? <p className="hint-hs">Loading slots...</p> : referSlots.length === 0 ? (
                      <p className="hint-hs warn-hs">This doctor has no open schedule on that date. Set one up under Doctor Schedule.</p>
                    ) : (
                      <div className="slot-list-hs">
                        {referSlots.map(s => (
                          <button
                            key={s.start_time}
                            type="button"
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
          </div>
        </div>
      )}

      {/* MODAL: Student screening history */}
      {historyModal && (
        <div className="modal-overlay-hs" style={{ zIndex: 1050 }}>
          <div className="modal-hs modal-lg-hs">
            <div className="modal-header-hs">
              <h2>Screening History: {historyModal.student.first_name} {historyModal.student.last_name} ({historyModal.student.student_id})</h2>
              <button type="button" className="close-btn-hs" onClick={() => setHistoryModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body-hs">
              {historyModal.loading ? <p className="hint-hs">Loading...</p> : historyModal.rows.length === 0 ? (
                <p className="hint-hs">No screening results on record.</p>
              ) : (
                <div className="table-wrapper-hs">
                  <table className="table-hs">
                    <thead><tr><th>Date</th><th>Screening</th><th>Type</th><th>Result</th><th>Flag</th></tr></thead>
                    <tbody>
                      {historyModal.rows.map((h, i) => (
                        <tr key={`${h.screening_schedule_id}-${h.screening_type}-${i}`}>
                          <td>{h.date ? formatDate(String(h.date).split('T')[0]) : ''}</td>
                          <td>{h.title}</td>
                          <td>{h.screening_type}</td>
                          <td>{h.summary || '-'}</td>
                          <td>{h.is_abnormal ? <span className="badge-hs badge-status-absent-hs">Abnormal</span> : <span className="badge-hs badge-success-hs">Normal</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setHistoryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Unified Alert & Confirmation Dialog */}
      {alertModal.show && (
        <div className="modal-overlay-hs" style={{ zIndex: 1100 }}>
          <div className="modal-hs modal-sm-hs" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="modal-header-hs" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: '0' }}>
              <h2 style={{ fontSize: '18px' }}>{alertModal.title}</h2>
            </div>
            <div className="modal-body-hs" style={{ paddingTop: '10px', paddingBottom: '20px' }}>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>
                {alertModal.type === 'success' && <CheckCircle size={48} color="#16a34a" />}
                {alertModal.type === 'warning' && <AlertCircle size={48} color="#ea580c" />}
                {alertModal.type === 'error' && <AlertCircle size={48} color="#dc2626" />}
                {alertModal.type === 'confirm' && <AlertCircle size={48} color="#2563eb" />}
                {alertModal.type === 'info' && <AlertCircle size={48} color="#0284c7" />}
              </div>
              <p style={{ fontSize: '14px', color: '#334155', margin: 0, lineHeight: '1.5' }}>
                {alertModal.message}
              </p>
            </div>
            <div className="modal-footer-hs" style={{ justifyContent: 'center', gap: '10px', paddingTop: '10px' }}>
              {alertModal.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    className="btn-hs btn-secondary-hs"
                    onClick={closeAlertModal}
                  >
                    {alertModal.cancelText || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className="btn-hs btn-primary-hs"
                    onClick={() => {
                      const action = alertModal.onConfirm;
                      closeAlertModal();
                      if (action) action();
                    }}
                  >
                    {alertModal.confirmText || 'Confirm'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-hs btn-primary-hs"
                  onClick={closeAlertModal}
                  style={{ minWidth: '100px' }}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}