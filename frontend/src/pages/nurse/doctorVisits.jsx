// doctorVisits.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { 
    Calendar,
    Clock, 
    FileText, 
    Edit, 
    XCircle, 
    CheckCircle, 
    UserCheck,
    Search,
    X,
    AlertCircle,
    QrCode,
    Trash2,
    Printer,
    Filter,
    CalendarClock,
    Bell,
    History,
    MoreVertical,
    Send,
    Footprints,
    CalendarPlus,
    RotateCcw,
    FileCheck,
    ClipboardList,
    Inbox
} from 'lucide-react';

import { formatTime, formatDate } from '../../utils/datetime';
import { openReportWindow, writeReport } from '../../utils/printReport';
import { printDocument, visitDocumentHtml } from '../../utils/doctorVisitDocuments';
import '../../styles/nurse/DoctorVisits.css';
import { FolderCrumbs, FolderGrid, Pager, MoreMenu, sectionLabel, paginate, scopeCounts, TabCount, groupByDay, dayKey, dayHeading, DaySection } from '../../components/common/RecordFolders';
import { DoctorAvailability, BookingRequests } from '../../components/nurse/DoctorAvailability';
import VisitCard from '../../components/nurse/VisitCard';
import PastVisitsTable from '../../components/nurse/PastVisitsTable';
import { DirectAppointmentModal } from '../../components/doctor/AppointmentModals';
import UnavailableDates from '../../components/doctor/UnavailableDates';
import { PURPOSES, visitLabel } from '../../utils/visitPurpose';
import { useDpAutoLabels } from '../../utils/autoLabels';

// The page has three sections; the open one is kept in the URL (?section=) so a link or a notification can land on it
const SECTIONS = ['visits', 'availability', 'requests'];

// the purpose of a visit: General Check Up, Dental, Vision or Other (and the purpose is specified)
const VISIT_TYPES = PURPOSES;

// Dental / Vision visits are done by a matching specialist; other visit types accept any doctor.
const SPECIALIZATION_MATCH = {
    'Dental': /dent/i,
    'Vision': /optom|ophthal|eye|vision/i
};

const VISIT_TYPE_HINTS = {
    'General Check Up': 'e.g. Annual Physical Examination',
    'Dental': 'e.g. Annual Dental Examination',
    'Vision': 'e.g. Annual Vision & Eye Examination',
    'Other': 'e.g. Counselling Referral Consultation',
    'Follow-up': 'e.g. Follow-up Consultation',
    'Referral': 'e.g. Specialist Referral Consultation'
};

const EMPTY_DENTAL = {
    oral_hygiene: '', caries_count: 0, missing_count: 0, filled_count: 0, gum_condition: '',
    malocclusion: false, tooth_notes: '', treatment_done: '', treatment_needed: '',
    referral_needed: false, referral_to: '', next_visit_recommendation: '', remarks: ''
};

const EMPTY_VISION = {
    visual_acuity_left: '', visual_acuity_right: '', va_left_corrected: '', va_right_corrected: '',
    wears_eyeglasses: false, wears_contacts: false, color_vision: '', eye_findings: '',
    recommended_action: 'No action', remarks: ''
};

// Pending requests and declined bookings are handled in the Booking Requests section, not in this list
const HIDDEN_APPT_STATUSES = ['Pending Approval', 'Declined'];

const time12 = (t) => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const formatLocalToSQL = (date) => {
    if (!date || isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatLocalDateOnly = (date) => {
    if (!date || isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parseSQLDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    const str = String(dateStr).trim();
    let parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    parsed = new Date(str.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) return parsed;

    const parts = str.split(/[- :T.]/);
    if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const hour = parts[3] ? parseInt(parts[3], 10) : 0;
        const minute = parts[4] ? parseInt(parts[4], 10) : 0;
        const second = parts[5] ? parseInt(parts[5], 10) : 0;
        return new Date(year, month, day, hour, minute, second);
    }
    
    return null;
};

// Query string for GET /api/doctor-visits/groups from the current folder / tab / search / filters
const buildGroupsParams = (q) => {
    const p = new URLSearchParams();
    if (q.view.kind === 'section') {
        p.set('program_id', q.view.program_id);
        p.set('year_level', q.view.year_level);
        p.set('section', q.view.section);
    } else if (q.view.kind === 'individual') {
        p.set('folder', 'individual');
    } else if (q.view.kind === 'program') {
        p.set('program_id', q.view.program_id);
    }
    p.set('tab', q.activeTab);
    if (q.search) p.set('q', q.search);
    if (q.activeTab === 'past') {
        if (q.pastDoctorFilter) p.set('doctor_id', q.pastDoctorFilter);
        if (q.pastStartDate) p.set('from', q.pastStartDate);
        if (q.pastEndDate) p.set('to', q.pastEndDate);
    }
    return p;
};

// Turns appointment rows (already filtered and paged by the server) into visit groups for the cards
const buildVisitGroups = (rows, tab) => {
    const now = new Date();
    const map = new Map();

    rows.filter(a => !HIDDEN_APPT_STATUSES.includes(a.status)).forEach((appt) => {
        const rawStart = appt.batch_start_time || appt.start_time || appt.scheduled_date;
        const rawEnd = appt.batch_end_time || appt.end_time || rawStart;

        const apptStart = parseSQLDate(rawStart) || now;
        const apptEnd = parseSQLDate(rawEnd) || apptStart;

        const title = appt.title || 'Doctor Visit';
        const doctorName = `Dr. ${appt.doc_first_name || ''} ${appt.doc_last_name || ''}`.trim();
        const specialization = appt.specialization || 'General Physician';

        const batchId = appt.batch_schedule_id || appt.batch_id;
        // same grouping as the server: one group per batch, or one per individual appointment
        const groupKey = batchId ? `batch_${batchId}` : `appt_${appt.appointment_id}`;

        if (!map.has(groupKey)) {
            map.set(groupKey, {
                groupKey,
                batchId: batchId || null,
                title,
                specialization,
                visitType: appt.visit_type || 'General Check Up',
                purposeOther: appt.purpose_other || '',
                doctorId: appt.doctor_id,
                doctorName,
                apptStart,
                apptEnd,
                announcement: appt.announcement || '',
                targetProgram: appt.target_program || appt.program_id || 'All Programs',
                targetYear: appt.target_year_level || appt.year_level || 'All Years',
                targetSection: appt.target_section || appt.section || 'All Sections',
                appointments: []
            });
        } else {
            const existingGroup = map.get(groupKey);
            if (apptStart < existingGroup.apptStart) existingGroup.apptStart = apptStart;
            if (apptEnd > existingGroup.apptEnd) existingGroup.apptEnd = apptEnd;
        }

        map.get(groupKey).appointments.push(appt);
    });

    const groups = Array.from(map.values());
    // past visits: latest first, otherwise soonest first
    return tab === 'past' ? groups.sort((a, b) => b.apptStart - a.apptStart) : groups.sort((a, b) => a.apptStart - b.apptStart);
};

const PARTICIPANTS_PER_PAGE = 15;
const VISITS_PER_PAGE = 20;

const DoctorVisit = () => {
    const { nurseId, userId, firstName, lastName } = useOutletContext() || {};
    useDpAutoLabels();

    const todayStr = formatLocalDateOnly(new Date());

    const [activeTab, setActiveTab] = useState('upcoming');
    const [doctors, setDoctors] = useState([]);
    const [students, setStudents] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter Controls for Past Visits
    const [pastStartDate, setPastStartDate] = useState('');
    const [pastEndDate, setPastEndDate] = useState('');
    const [pastDoctorFilter, setPastDoctorFilter] = useState('');
    const [qrInput, setQrInput] = useState('');

    // Custom Modal Alert & Confirmation State
    const [feedbackModal, setFeedbackModal] = useState({
        show: false,
        type: 'info', // 'success', 'danger', 'warning', 'info', 'confirm'
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Confirm',
        cancelText: 'Cancel'
    });

    const showAlert = useCallback((message, title = 'Notice', type = 'info') => {
        setFeedbackModal({
            show: true,
            type,
            title,
            message,
            onConfirm: null,
            confirmText: 'OK',
            cancelText: ''
        });
    }, []);

    const showSuccess = useCallback((message, title = 'Success') => {
        showAlert(message, title, 'success');
    }, [showAlert]);

    const showError = useCallback((message, title = 'Error') => {
        showAlert(message, title, 'danger');
    }, [showAlert]);

    const showConfirm = useCallback((message, title, onConfirm, confirmText = 'Confirm', type = 'warning') => {
        setFeedbackModal({
            show: true,
            type,
            title,
            message,
            onConfirm: () => {
                setFeedbackModal(prev => ({ ...prev, show: false }));
                if (onConfirm) onConfirm();
            },
            confirmText,
            cancelText: 'Cancel'
        });
    }, []);

    const closeFeedbackModal = () => {
        setFeedbackModal(prev => ({ ...prev, show: false }));
    };

    // Helper for disabling past times when schedule is today
    const getMinStartTime = (scheduledDate) => {
        if (scheduledDate === todayStr) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return undefined;
    };

    // Modals
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showAssessmentModal, setShowAssessmentModal] = useState(false);
    const [showBatchRescheduleModal, setShowBatchRescheduleModal] = useState(false);
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeScanGroup, setActiveScanGroup] = useState(null);

    // Forms
    const [doctorForm, setDoctorForm] = useState({ doctor_id: '', first_name: '', last_name: '', specialization: '', contact_number: '' });
    const [isEditDoctor, setIsEditDoctor] = useState(false);

    const [scheduleForm, setScheduleForm] = useState({
        visit_type: 'General Check Up',
        doctor_id: '',
        title: '',
        announcement: '',
        target_program: '',    
        target_year_level: '', 
        target_section: '',    
        scheduled_date: '',
        batch_start_time: '',
        batch_end_time: '',
        slot_duration: '15',
        purpose_other: ''
    });
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [timeSlotCollisions, setTimeSlotCollisions] = useState('');

    const [selectedAppt, setSelectedAppt] = useState(null);
    const [assessmentForm, setAssessmentForm] = useState({
        clinical_findings: '',
        diagnosis: '',
        treatment_recommendations: '',
        is_abnormal: false,
        follow_up_needed: false,
        dental: { ...EMPTY_DENTAL },
        vision: { ...EMPTY_VISION }
    });

    // Batch Reschedule Form Data
    const [batchRescheduleData, setBatchRescheduleData] = useState({
        batch_id: '',
        groupKey: '',
        scheduled_date: '',
        batch_start_time: '',
        batch_end_time: '',
        slot_duration: '15'
    });

    const [searchTerm, setSearchTerm] = useState('');

    // QR Scanner Refs
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const isProcessingScanRef = useRef(false);

    const fetchDoctors = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/doctors');
            const data = await res.json();
            if (data.success) setDoctors(data.doctors);
        } catch (err) {
            console.error('Error fetching doctors:', err);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/students-list');
            const data = await res.json();
            if (data.success) setStudents(data.students);
        } catch (err) {
            console.error('Error fetching students:', err);
        }
    };

    const handleManualScanSubmit = (e) => {
        e.preventDefault();
        if (!qrInput.trim()) return;
        handleScannedCode(qrInput.trim());
        setQrInput('');
    };

    const fetchPrograms = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/academic-programs');
            const data = await res.json();
            if (data.success) setPrograms(data.programs);
        } catch (err) {
            console.error('Error fetching academic programs:', err);
        }
    };

    // ---- folders (Program > Year-Section), search and paging ----
    // The server filters and pages the visits, so the browser only holds one page at a time.
    const [view, setView] = useState({ kind: 'root' });
    const [folders, setFolders] = useState({ programs: [], individual: null, pending_requests: 0 });
    const [foldersLoading, setFoldersLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageInfo, setPageInfo] = useState({ total: 0, pageCount: 1, pageSize: VISITS_PER_PAGE });
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const searching = debouncedSearch !== '';
    const listMode = view.kind === 'section' || view.kind === 'individual' || view.kind === 'all' || searching;

    const queryRef = useRef({});
    queryRef.current = { view, activeTab, search: debouncedSearch, pastDoctorFilter, pastStartDate, pastEndDate, page };

    const fetchFolders = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/doctor-visits/folders');
            const data = await res.json();
            if (data.success) setFolders(data);
        } catch (err) {
            console.error('Error fetching folders:', err);
        } finally {
            setFoldersLoading(false);
        }
    }, []);

    // Loads the current page (and refreshes the folder counts). Returns the rows of the page.
    const fetchAppointments = useCallback(async () => {
        fetchFolders();
        const q = queryRef.current;
        const inList = q.view.kind === 'section' || q.view.kind === 'individual' || q.view.kind === 'all' || q.search !== '';
        if (!inList) {
            setAppointments([]);
            setLoading(false);
            return [];
        }
        setLoading(true);
        try {
            const p = buildGroupsParams(q);
            p.set('page', String(q.page));
            p.set('pageSize', String(VISITS_PER_PAGE));
            const res = await fetch(`http://localhost:3001/api/doctor-visits/groups?${p.toString()}`);
            const data = await res.json();
            if (data.success) {
                // an action emptied the last page: go back one
                if (data.appointments.length === 0 && data.total > 0 && q.page > 1) {
                    setPage(data.pageCount);
                    return [];
                }
                setAppointments(data.appointments);
                setPageInfo({ total: data.total, pageCount: data.pageCount, pageSize: data.pageSize });
                return data.appointments;
            }
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
        return [];
    }, [fetchFolders]);

    // every visit of the current folder / tab / filters (for the export)
    const fetchAllGroupRows = async () => {
        try {
            const p = buildGroupsParams(queryRef.current);
            p.set('pageSize', 'all');
            const res = await fetch(`http://localhost:3001/api/doctor-visits/groups?${p.toString()}`);
            const data = await res.json();
            return data.success ? data.appointments : null;
        } catch (err) {
            return null;
        }
    };

    // the rows of one appointment's group, wherever it is (used right after a walk-in)
    const fetchRowsOfAppointment = async (appointmentId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/doctor-visits/groups?appointment_id=${encodeURIComponent(appointmentId)}&pageSize=all`);
            const data = await res.json();
            return data.success ? data.appointments : [];
        } catch (err) {
            return [];
        }
    };

    useEffect(() => {
        fetchDoctors();
        fetchStudents();
        fetchPrograms();
    }, []);

    // A new folder / tab / search / filter starts at page 1; a page change just reloads.
    const queryKey = JSON.stringify([view, activeTab, debouncedSearch, pastDoctorFilter, pastStartDate, pastEndDate]);
    const lastQueryKeyRef = useRef(queryKey);
    useEffect(() => {
        if (lastQueryKeyRef.current !== queryKey) {
            lastQueryKeyRef.current = queryKey;
            if (page !== 1) {
                setPage(1);
                return;
            }
        }
        fetchAppointments();
    }, [queryKey, page, fetchAppointments]);

    const goRoot = () => { setView({ kind: 'root' }); setSearchTerm(''); };
    const openProgram = (p) => { setView({ kind: 'program', program_id: p.program_id, program_name: p.program_name }); setSearchTerm(''); };
    const openSection = (p, s) => { setView({ kind: 'section', program_id: p.program_id, program_name: p.program_name, year_level: s.year_level, section: s.section }); setSearchTerm(''); };
    const openIndividualFolder = () => { setView({ kind: 'individual' }); setSearchTerm(''); };

    const crumbTrail = (() => {
        const trail = [{ label: 'Doctor Visits', onClick: goRoot }];
        if (view.kind === 'program' || view.kind === 'section') {
            trail.push({
                label: view.program_id,
                onClick: view.kind === 'section' ? () => setView({ kind: 'program', program_id: view.program_id, program_name: view.program_name }) : undefined
            });
        }
        if (view.kind === 'section') trail.push({ label: sectionLabel(view) });
        if (view.kind === 'individual') trail.push({ label: 'Walk-ins & Individual Bookings' });
        if (view.kind === 'all') trail.push({ label: 'All visits' });
        if (searching && view.kind !== 'section' && view.kind !== 'individual' && view.kind !== 'all') trail.push({ label: `Search: "${debouncedSearch}"` });
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
            title: 'All visits',
            subtitle: 'Every doctor visit, newest first',
            counts: null,
            onClick: () => { setView({ kind: 'all' }); setSearchTerm(''); }
        });
        items.push({
            key: 'individual',
            variant: 'individual',
            title: 'Walk-ins & Individual Bookings',
            subtitle: 'Student bookings, walk-ins and follow-up visits',
            counts: folders.individual || { total: 0, upcoming: 0, ongoing: 0, past: 0, abnormal: 0 },
            onClick: openIndividualFolder
        });
        return items;
    })();

    // ---- participants of the open batch: search + paging ----
    const [participantSearch, setParticipantSearch] = useState('');
    const [participantPage, setParticipantPage] = useState(1);
    const selectedGroupKey = selectedGroup?.groupKey;
    useEffect(() => {
        setParticipantSearch('');
        setParticipantPage(1);
    }, [selectedGroupKey]);

    const participantPageData = useMemo(() => {
        if (!selectedGroup) return { items: [], page: 1, pageCount: 1, total: 0 };
        const q = participantSearch.trim().toLowerCase();
        const list = selectedGroup.appointments.filter(a =>
            !q || `${a.student_first_name || ''} ${a.student_last_name || ''} ${a.student_id || ''} ${a.program_id || ''} ${a.section || ''}`.toLowerCase().includes(q)
        );
        return paginate(list, participantPage, PARTICIPANTS_PER_PAGE);
    }, [selectedGroup, participantSearch, participantPage]);

    // Print the visits of the open folder / tab as a summary report
    const handleExportAllReport = async () => {
        const win = openReportWindow(() => showError('Please allow popups to preview and print the report.', 'Popup Blocked'));
        if (!win) return;

        const allRows = await fetchAllGroupRows();
        if (!allRows) {
            win.close();
            showError('Could not load the visits for the report.', 'Server Error');
            return;
        }

        writeReport(win, {
            title: 'Doctor Visit Summary Report',
            columns: ['Visit Title', 'Doctor & Specialization', 'Date', 'Time Window', 'Attendance (Present / Total)'],
            rows: buildVisitGroups(allRows, activeTab).map(group => [
                group.title || 'N/A',
                `${group.doctorName || 'N/A'} (${group.specialization || 'General'})`,
                group.apptStart ? formatLocalDateOnly(group.apptStart) : 'N/A',
                `${group.apptStart ? formatTime(group.apptStart) : ''} - ${group.apptEnd ? formatTime(group.apptEnd) : ''}`,
                `${group.appointments.filter(a => (a.attendance_status || '').toLowerCase() === 'present').length} / ${group.appointments.length} Present`
            ]),
            emptyText: 'No doctor visit records found.'
        });
    };

    // Print the participants of the open batch
    const handleExportSingleReport = () => {
        if (!selectedGroup) return;
        const win = openReportWindow(() => showError('Please allow popups to preview and print the report.', 'Popup Blocked'));
        if (!win) return;

        const now = new Date();
        let presentCount = 0;
        const rows = selectedGroup.appointments.map(appt => {
            const start = parseSQLDate(appt.start_time || appt.scheduled_date) || selectedGroup.apptStart;
            const end = parseSQLDate(appt.end_time) || selectedGroup.apptEnd;

            let attendance = appt.attendance_status || 'Pending';
            if (end < now && attendance.toLowerCase() === 'pending') attendance = 'Absent';
            if (attendance.toLowerCase() === 'present') presentCount++;

            return [
                appt.student_id || '',
                `${appt.student_first_name || ''} ${appt.student_last_name || ''}`.trim(),
                appt.program_id ? `${appt.program_id} - ${appt.year_level || ''}${appt.section || ''}` : 'N/A',
                `${start ? formatTime(start) : ''} - ${end ? formatTime(end) : ''}`,
                attendance,
                appt.assessment_id ? 'Documented' : 'Pending'
            ];
        });

        writeReport(win, {
            title: 'Individual Doctor Visit Participant Report',
            details: [
                ['Visit Title', selectedGroup.title || 'N/A'],
                ['Assigned Doctor', `${selectedGroup.doctorName || 'N/A'} (${selectedGroup.specialization || 'General'})`],
                ['Scheduled Date', selectedGroup.apptStart ? formatLocalDateOnly(selectedGroup.apptStart) : 'N/A'],
                ['Time Window', `${selectedGroup.apptStart ? formatTime(selectedGroup.apptStart) : ''} - ${selectedGroup.apptEnd ? formatTime(selectedGroup.apptEnd) : ''}`],
                ['Attendance Rate', `${presentCount} / ${rows.length} Present`]
            ],
            columns: ['Student ID', 'Student Name', 'Program & Section', 'Time Slot', 'Attendance', 'Assessment Status'],
            rows,
            emptyText: 'No participating students found.'
        });
    };

    const updateAppointmentStatus = useCallback(async (appointmentId, studentId, newStatus, reason) => {
        try {
            const res = await fetch(`http://localhost:3001/api/doctor-visits/status/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, status: newStatus, reason })
            });
            const data = await res.json();
            if (data.success) {
                await fetchAppointments();
                return true;
            } else {
                showError(data.message || 'Failed to update status', 'Update Failed');
                return false;
            }
        } catch (err) {
            console.error('Error updating status:', err);
            showError('Server error updating status.', 'Server Error');
            return false;
        }
    }, [fetchAppointments, showError]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    const handleScannedCode = useCallback(async (scannedValue) => {
        if (isProcessingScanRef.current) return;
        isProcessingScanRef.current = true;

        let parsedId = String(scannedValue).trim();

        try {
            const parsedObj = JSON.parse(parsedId);
            parsedId = String(parsedObj.student_id || parsedObj.student_user_id || parsedObj.appointment_id || parsedId).trim();
        } catch (e) {
            // Keep string if plain text
        }

        const targetPool = activeScanGroup ? activeScanGroup.appointments : appointments;
        const cleanScanValue = parsedId.toLowerCase();

        const appt = targetPool.find((a) => {
            const sId = String(a.student_id || '').trim().toLowerCase();
            const uId = String(a.student_user_id || '').trim().toLowerCase();
            const aId = String(a.appointment_id || '').trim().toLowerCase();

            return sId === cleanScanValue || uId === cleanScanValue || aId === cleanScanValue;
        });

        if (appt) {
            const success = await updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Present');
            if (success) {
                showSuccess(`Student ${appt.student_first_name} ${appt.student_last_name} marked as PRESENT.`, 'Attendance Updated');
            }
        } else {
            showError(`No matching student found for QR code "${scannedValue}".`, 'QR Scan Failed');
        }

        setShowScannerModal(false);
        setActiveScanGroup(null);
        isProcessingScanRef.current = false;
    }, [appointments, activeScanGroup, updateAppointmentStatus, showError, showSuccess]);

    const scanQRCode = useCallback(() => {
        if (!showScannerModal || isProcessingScanRef.current) return;

        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (canvas && video) {
                canvas.height = video.videoHeight;
                canvas.width = video.videoWidth;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });

                if (code && code.data && code.data.trim() !== '') {
                    handleScannedCode(code.data.trim());
                    return;
                }
            }
        }
        requestAnimationFrame(scanQRCode);
    }, [showScannerModal, handleScannedCode]);

    useEffect(() => {
        let animationFrameId;

        if (showScannerModal) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then((stream) => {
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.setAttribute('playsinline', 'true');
                        videoRef.current.play();
                        animationFrameId = requestAnimationFrame(scanQRCode);
                    }
                })
                .catch((err) => {
                    // keep the scanner open: the Student ID can still be typed in manually
                    showError('Camera access denied or unavailable: ' + err.message + ' You can still enter the Student ID manually.', 'Camera Error');
                });
        } else {
            stopCamera();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
            stopCamera();
        };
    }, [showScannerModal, scanQRCode, showError]);

    const openScannerForBatch = (group) => {
        setActiveScanGroup(group);
        setShowScannerModal(true);
    };

    const availableSections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();

    const filteredStudents = students.filter(s => {
        const matchProgram = !scheduleForm.target_program || scheduleForm.target_program === 'ALL' || s.program_id === scheduleForm.target_program;
        const matchYear = !scheduleForm.target_year_level || scheduleForm.target_year_level === 'ALL' || String(s.year_level) === String(scheduleForm.target_year_level);
        const matchSection = !scheduleForm.target_section || scheduleForm.target_section === 'ALL' || s.section?.toLowerCase() === scheduleForm.target_section.toLowerCase();

        return matchProgram && matchYear && matchSection;
    });

    const handleSaveDoctor = async (e) => {
        e.preventDefault();
        const url = isEditDoctor 
            ? `http://localhost:3001/api/doctors/${doctorForm.doctor_id}`
            : 'http://localhost:3001/api/doctors';
        const method = isEditDoctor ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(doctorForm)
            });
            const data = await res.json();
            if (data.success) {
                showSuccess(data.message || 'Doctor profile saved successfully!', isEditDoctor ? 'Doctor Updated' : 'Doctor Added');
                setShowDoctorModal(false);
                fetchDoctors();
                setDoctorForm({ doctor_id: '', first_name: '', last_name: '', specialization: '', contact_number: '' });
            } else {
                showError(data.message || 'Failed to save doctor details.', 'Save Failed');
            }
        } catch (err) {
            showError('Error saving doctor details.', 'Save Error');
        }
    };

    const openEditDoctor = (doc) => {
        setDoctorForm(doc);
        setIsEditDoctor(true);
        setShowDoctorModal(true);
    };

    const handleStudentToggle = (studentId) => {
        if (selectedStudentIds.includes(studentId)) {
            setSelectedStudentIds(selectedStudentIds.filter(id => id !== studentId));
        } else {
            setSelectedStudentIds([...selectedStudentIds, studentId]);
        }
    };

    const handleSelectAllFiltered = () => {
        const filteredIds = filteredStudents.map(s => s.student_id);
        const combined = [...new Set([...selectedStudentIds, ...filteredIds])];
        setSelectedStudentIds(combined);
    };

    const handleDeselectAllFiltered = () => {
        const filteredIds = filteredStudents.map(s => s.student_id);
        setSelectedStudentIds(selectedStudentIds.filter(id => !filteredIds.includes(id)));
    };

    const handleCreateMassSchedule = async (e) => {
        e.preventDefault();
        setTimeSlotCollisions('');

        if (selectedStudentIds.length === 0) {
            showError('Please select at least one student for scheduling.', 'Selection Required');
            return;
        }

        const startDT = new Date(`${scheduleForm.scheduled_date}T${scheduleForm.batch_start_time}:00`);
        const endDT = new Date(`${scheduleForm.scheduled_date}T${scheduleForm.batch_end_time}:00`);
        const slotMins = parseInt(scheduleForm.slot_duration, 10) || 15;

        if (startDT >= endDT) {
            setTimeSlotCollisions('Batch end time must be strictly after batch start time.');
            return;
        }

        const totalBatchMinutes = Math.round((endDT - startDT) / (1000 * 60));
        const totalRequiredMinutes = selectedStudentIds.length * slotMins;

        if (totalRequiredMinutes > totalBatchMinutes) {
            setTimeSlotCollisions(
                `The required duration for ${selectedStudentIds.length} student(s) at ${slotMins} mins/slot (${totalRequiredMinutes} mins) exceeds total batch time window (${totalBatchMinutes} mins). Please increase the batch time or reduce the duration per slot.`
            );
            return;
        }

        const studentAppointments = selectedStudentIds.map((studentId, idx) => {
            const studentObj = students.find(s => s.student_id === studentId);
            const slotStart = new Date(startDT.getTime() + idx * slotMins * 60000);
            const slotEnd = new Date(slotStart.getTime() + slotMins * 60000);

            return {
                student_id: studentId,
                user_id: studentObj?.user_id || null,
                start_time: formatLocalToSQL(slotStart),
                end_time: formatLocalToSQL(slotEnd)
            };
        });

        const cleanTargetValue = (val) => (!val || val === 'ALL' ? null : val);

        const payload = {
            assigned_by_nurse_id: nurseId,
            visit_type: scheduleForm.visit_type,
            purpose_other: scheduleForm.visit_type === 'Other' ? scheduleForm.purpose_other : undefined,
            doctor_id: scheduleForm.doctor_id,
            title: scheduleForm.title,
            announcement: scheduleForm.announcement,
            target_program: cleanTargetValue(scheduleForm.target_program),
            target_year_level: cleanTargetValue(scheduleForm.target_year_level),
            target_section: cleanTargetValue(scheduleForm.target_section),
            batch_start_time: formatLocalToSQL(startDT),
            batch_end_time: formatLocalToSQL(endDT),
            student_appointments: studentAppointments
        };

        try {
            const res = await fetch('http://localhost:3001/api/mass-schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showSuccess('Doctor visit mass schedule created successfully with instilled time blocks!', 'Schedule Created');
                setShowScheduleModal(false);
                setSelectedStudentIds([]);
                setScheduleForm({
                    visit_type: 'General Check Up',
                    doctor_id: '',
                    title: '',
                    announcement: '',
                    target_program: '',
                    target_year_level: '',
                    target_section: '',
                    scheduled_date: '',
                    batch_start_time: '',
                    batch_end_time: '',
                    slot_duration: '15',
                    purpose_other: ''
                });
                fetchAppointments();
            } else {
                showError(data.message || 'Failed to create schedule', 'Schedule Creation Failed');
            }
        } catch (err) {
            showError('Server error creating schedule.', 'Server Error');
        }
    };

    const setDental = (key, value) =>
        setAssessmentForm(prev => ({ ...prev, dental: { ...prev.dental, [key]: value } }));
    const setVision = (key, value) =>
        setAssessmentForm(prev => ({ ...prev, vision: { ...prev.vision, [key]: value } }));

    const openAssessmentModal = (appt) => {
        setSelectedAppt(appt);
        const val = (v, fallback = '') => (v === null || v === undefined ? fallback : v);
        setAssessmentForm({
            clinical_findings: appt.clinical_findings || '',
            diagnosis: appt.diagnosis || '',
            treatment_recommendations: appt.treatment_recommendations || '',
            is_abnormal: !!appt.is_abnormal,
            follow_up_needed: !!appt.follow_up_needed,
            dental: {
                ...EMPTY_DENTAL,
                oral_hygiene: val(appt.oral_hygiene),
                caries_count: val(appt.caries_count, 0),
                missing_count: val(appt.missing_count, 0),
                filled_count: val(appt.filled_count, 0),
                gum_condition: val(appt.gum_condition),
                malocclusion: !!appt.malocclusion,
                tooth_notes: val(appt.tooth_notes),
                treatment_done: val(appt.treatment_done),
                treatment_needed: val(appt.treatment_needed),
                referral_needed: !!appt.referral_needed,
                referral_to: val(appt.referral_to),
                next_visit_recommendation: val(appt.next_visit_recommendation),
                remarks: val(appt.dental_remarks)
            },
            vision: {
                ...EMPTY_VISION,
                visual_acuity_left: val(appt.visual_acuity_left),
                visual_acuity_right: val(appt.visual_acuity_right),
                va_left_corrected: val(appt.va_left_corrected),
                va_right_corrected: val(appt.va_right_corrected),
                wears_eyeglasses: !!appt.wears_eyeglasses,
                wears_contacts: !!appt.wears_contacts,
                color_vision: val(appt.color_vision),
                eye_findings: val(appt.eye_findings),
                recommended_action: val(appt.recommended_action, 'No action'),
                remarks: val(appt.vision_remarks)
            }
        });
        setShowAssessmentModal(true);
    };

    const handleSaveAssessment = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3001/api/doctor-assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appointment_id: selectedAppt.appointment_id,
                    student_id: selectedAppt.student_id,
                    student_user_id: selectedAppt.student_user_id,
                    sender_id: userId,
                    ...assessmentForm,
                    // Only the form that matches the visit type is sent
                    dental: selectedAppt.visit_type === 'Dental' ? assessmentForm.dental : undefined,
                    vision: selectedAppt.visit_type === 'Vision' ? assessmentForm.vision : undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                showSuccess('Assessment recorded successfully!', 'Assessment Saved');
                setShowAssessmentModal(false);
                fetchAppointments();
            } else {
                showError(data.message || 'Failed to save assessment.', 'Save Failed');
            }
        } catch (err) {
            showError('Failed to save assessment.', 'Server Error');
        }
    };

    const openBatchRescheduleModal = (group) => {
        const dateStr = group.apptStart ? formatLocalDateOnly(group.apptStart) : '';
        const pad = (n) => String(n).padStart(2, '0');
        const startTimeStr = group.apptStart ? `${pad(group.apptStart.getHours())}:${pad(group.apptStart.getMinutes())}` : '';
        const endTimeStr = group.apptEnd ? `${pad(group.apptEnd.getHours())}:${pad(group.apptEnd.getMinutes())}` : '';

        let estimatedSlotDuration = 15;
        if (group.appointments.length > 1) {
            const firstStart = parseSQLDate(group.appointments[0].start_time || group.appointments[0].scheduled_date);
            const firstEnd = parseSQLDate(group.appointments[0].end_time);
            if (firstStart && firstEnd) {
                const diff = Math.round((firstEnd - firstStart) / (1000 * 60));
                if (diff > 0) estimatedSlotDuration = diff;
            }
        }

        setBatchRescheduleData({
            batch_id: group.batchId,
            groupKey: group.groupKey,
            scheduled_date: dateStr,
            batch_start_time: startTimeStr,
            batch_end_time: endTimeStr,
            slot_duration: String(estimatedSlotDuration)
        });
        setShowBatchRescheduleModal(true);
    };

    const handleSaveBatchReschedule = async (e) => {
        e.preventDefault();

        const [year, month, day] = batchRescheduleData.scheduled_date.split('-').map(Number);
        const [startHour, startMin] = batchRescheduleData.batch_start_time.split(':').map(Number);
        const [endHour, endMin] = batchRescheduleData.batch_end_time.split(':').map(Number);

        const startDT = new Date(year, month - 1, day, startHour, startMin, 0);
        const endDT = new Date(year, month - 1, day, endHour, endMin, 0);

        if (isNaN(startDT.getTime()) || isNaN(endDT.getTime())) {
            showError('Invalid date or time selected.', 'Invalid Input');
            return;
        }

        if (startDT >= endDT) {
            showError('Batch end time must be strictly after batch start time.', 'Invalid Time Window');
            return;
        }

        const slotMins = parseInt(batchRescheduleData.slot_duration, 10) || 15;
        const targetGroup = groupedVisits.find(g => g.groupKey === batchRescheduleData.groupKey);

        if (!targetGroup) {
            showError('Batch schedule not found.', 'Error');
            return;
        }

        const updatedAppointments = targetGroup.appointments.map((appt, idx) => {
            const slotStart = new Date(startDT.getTime() + idx * slotMins * 60000);
            const slotEnd = new Date(slotStart.getTime() + slotMins * 60000);

            return {
                appointment_id: appt.appointment_id,
                student_user_id: appt.student_user_id,
                start_time: formatLocalToSQL(slotStart),
                end_time: formatLocalToSQL(slotEnd)
            };
        });

        try {
            const res = await fetch('http://localhost:3001/api/doctor-visits/batch-reschedule', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch_id: batchRescheduleData.batch_id,
                    batch_start_time: formatLocalToSQL(startDT),
                    batch_end_time: formatLocalToSQL(endDT),
                    appointments: updatedAppointments
                })
            });
            const data = await res.json();
            if (data.success) {
                showSuccess('Batch appointment date and start/end time updated successfully!', 'Batch Rescheduled');
                setShowBatchRescheduleModal(false);
                fetchAppointments();
            } else {
                showError(data.message || 'Failed to update batch schedule date and times.', 'Update Failed');
            }
        } catch (err) {
            showError('Failed to update batch schedule date and times.', 'Update Failed');
        }
    };

    // ======================================================================
    // Extra doctor-visit transactions: reasons, reschedule, follow-up, referral,
    // walk-in, history, reminders and printable documents
    // ======================================================================
    const API = 'http://localhost:3001';

    const [searchParams, setSearchParams] = useSearchParams();
    const section = SECTIONS.includes(searchParams.get('section')) ? searchParams.get('section') : 'visits';
    const goSection = (name) => setSearchParams(name === 'visits' ? {} : { section: name });    // "Set up schedule" links inside the visit forms: close the form, then open the schedule form for that doctor
    const goSetupSchedule = (doctorId) => {
        setShowScheduleModal(false);
        setFollowUpModal(null);
        setSearchParams({ section: 'availability', doctor: doctorId, new: '1' });
    };

    const [reasonModal, setReasonModal] = useState(null);
    const [reasonText, setReasonText] = useState('');
    const [rescheduleModal, setRescheduleModal] = useState(null);
    const [rescheduleWindows, setRescheduleWindows] = useState([]);
    const [followUpModal, setFollowUpModal] = useState(null);
    const [followUpSlots, setFollowUpSlots] = useState([]);
    const [followUpSlotsLoading, setFollowUpSlotsLoading] = useState(false);
    const [followUpSlot, setFollowUpSlot] = useState(null);
    const [referralModal, setReferralModal] = useState(null);
    const [historyModal, setHistoryModal] = useState(null);
    const [walkInModal, setWalkInModal] = useState(null);
    const [showDirect, setShowDirect] = useState(false);
    const [openMenuKey, setOpenMenuKey] = useState(null);
    const [doctorsWithSchedule, setDoctorsWithSchedule] = useState(null);
    const [availability, setAvailability] = useState({ loading: false, windows: [] });

    const studentFullName = (appt) => `${appt.student_first_name || ''} ${appt.student_last_name || ''}`.trim();

    const fetchDoctorsWithSchedule = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules?status=Open`);
            const data = await res.json();
            if (data.success) {
                setDoctorsWithSchedule(new Set(data.schedules.filter(s => !s.is_expired).map(s => s.doctor_id)));
            }
        } catch (err) {
            console.error('Error fetching doctor schedules:', err);
        }
    }, []);

    useEffect(() => { fetchDoctorsWithSchedule(); }, [fetchDoctorsWithSchedule]);

    // A schedule or booking changed in the Availability / Booking Requests sections: the visit lists,
    // the folder counts and the numbers on the section tabs follow.
    const refreshAfterScheduleChange = useCallback(() => {
        fetchDoctorsWithSchedule();
        fetchAppointments();
    }, [fetchDoctorsWithSchedule, fetchAppointments]);

    const doctorsWithoutSchedule = doctorsWithSchedule ? doctors.filter(d => !doctorsWithSchedule.has(d.doctor_id)).length : 0;

    const openAddDoctor = () => {
        setDoctorForm({ doctor_id: '', first_name: '', last_name: '', specialization: '', contact_number: '' });
        setIsEditDoctor(false);
        setShowDoctorModal(true);
    };

    // Open schedule windows of the chosen doctor/date, shown in the mass-schedule form
    useEffect(() => {
        if (!showScheduleModal || !scheduleForm.doctor_id || !scheduleForm.scheduled_date) {
            setAvailability({ loading: false, windows: [] });
            return undefined;
        }
        let cancelled = false;
        setAvailability(prev => ({ ...prev, loading: true }));
        fetch(`${API}/api/doctor-schedules/availability?doctor_id=${scheduleForm.doctor_id}&date=${scheduleForm.scheduled_date}&visit_type=${encodeURIComponent(scheduleForm.visit_type)}`)
            .then(r => r.json())
            .then(d => { if (!cancelled) setAvailability({ loading: false, windows: d.success ? d.windows : [] }); })
            .catch(() => { if (!cancelled) setAvailability({ loading: false, windows: [] }); });
        return () => { cancelled = true; };
    }, [showScheduleModal, scheduleForm.doctor_id, scheduleForm.scheduled_date, scheduleForm.visit_type]);

    // Reschedule modal: windows on the picked date
    const rescheduleDate = rescheduleModal?.date;
    const rescheduleDoctorId = rescheduleModal?.appt?.doctor_id;
    const rescheduleVisitType = rescheduleModal?.appt?.visit_type;
    useEffect(() => {
        if (!rescheduleDate || !rescheduleDoctorId) { setRescheduleWindows([]); return undefined; }
        let cancelled = false;
        fetch(`${API}/api/doctor-schedules/availability?doctor_id=${rescheduleDoctorId}&date=${rescheduleDate}&visit_type=${encodeURIComponent(rescheduleVisitType || '')}`)
            .then(r => r.json())
            .then(d => { if (!cancelled) setRescheduleWindows(d.success ? d.windows : []); })
            .catch(() => { if (!cancelled) setRescheduleWindows([]); });
        return () => { cancelled = true; };
    }, [rescheduleDate, rescheduleDoctorId, rescheduleVisitType]);

    // Follow-up modal: slots of the doctor on the picked date
    const followUpDate = followUpModal?.date;
    const followUpDoctorId = followUpModal?.appt?.doctor_id;
    const followUpStudentId = followUpModal?.appt?.student_id;
    useEffect(() => {
        setFollowUpSlot(null);
        if (!followUpDate || !followUpDoctorId) { setFollowUpSlots([]); return undefined; }
        let cancelled = false;
        setFollowUpSlotsLoading(true);
        (async () => {
            try {
                const wres = await fetch(`${API}/api/doctor-schedules/availability?doctor_id=${followUpDoctorId}&date=${followUpDate}&visit_type=Follow-up`);
                const w = await wres.json();
                const all = [];
                for (const win of (w.windows || [])) {
                    const sres = await fetch(`${API}/api/doctor-schedules/${win.schedule_id}/slots?date=${followUpDate}&student_id=${followUpStudentId}`);
                    const s = await sres.json();
                    if (s.success) all.push(...s.slots.map(x => ({ ...x, slot_minutes: win.slot_duration_min })));
                }
                if (!cancelled) setFollowUpSlots(all);
            } catch (err) {
                if (!cancelled) setFollowUpSlots([]);
            } finally {
                if (!cancelled) setFollowUpSlotsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [followUpDate, followUpDoctorId, followUpStudentId]);

    // ---------- reason prompt (used by absent / excused / cancel) ----------
    const askReason = (opts) => {
        setReasonText('');
        setReasonModal(opts);
    };

    const submitReason = async () => {
        if (reasonModal.required && !reasonText.trim()) {
            showError('A reason is required.', 'Reason Required');
            return;
        }
        const callback = reasonModal.onSubmit;
        const text = reasonText.trim();
        setReasonModal(null);
        setReasonText('');
        await callback(text);
    };

    // ---------- attendance ----------
    const markPresent = (appt) => updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Present');

    const markAbsent = (appt) => askReason({
        title: 'Mark as No-show',
        message: `${studentFullName(appt)} did not come to the visit.`,
        label: 'Reason (optional)',
        required: false,
        confirmText: 'Mark Absent',
        onSubmit: (reason) => updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Absent', reason)
    });

    const markExcused = (appt) => askReason({
        title: 'Excuse student',
        message: `${studentFullName(appt)} will be marked Excused (for example a valid reason or a medical certificate).`,
        label: 'Reason (required)',
        required: true,
        confirmText: 'Excuse Student',
        onSubmit: (reason) => updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Excused', reason)
    });

    // ---------- cancel / delete batch ----------
    const handleCancelAppointment = (appt) => askReason({
        title: 'Cancel Appointment',
        message: `Cancel the doctor visit of ${studentFullName(appt)}? The student and parents will be notified.`,
        label: 'Reason (required)',
        required: true,
        confirmText: 'Cancel Appointment',
        onSubmit: async (reason) => {
            try {
                const res = await fetch(`${API}/api/doctor-visits/cancel/${appt.appointment_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason, sender_id: userId })
                });
                const data = await res.json();
                if (data.success) {
                    showSuccess('Appointment cancelled and the student and parents were notified.', 'Appointment Cancelled');
                    fetchAppointments();
                } else {
                    showError(data.message || 'Failed to cancel appointment.', 'Cancellation Failed');
                }
            } catch (err) {
                showError('Failed to cancel appointment.', 'Server Error');
            }
        }
    });

    const handleDeleteBatch = (group) => {
        if (!group) return;
        // individual bookings, walk-ins and follow-ups can only be deleted from the Past Visits table
        if (!group.batchId && activeTab !== 'past') {
            showError('Individual bookings, walk-ins and follow-ups are not batches. Cancel them per student instead.', 'Not a Batch');
            return;
        }
        showConfirm(
            `Are you sure you want to permanently DELETE "${group.title}" and all ${group.appointments.length} associated appointment records? This action CANNOT be undone.`,
            group.batchId ? 'Delete Batch Schedule' : 'Delete Visit',
            async () => {
                try {
                    const res = group.batchId
                        ? await fetch(`${API}/api/doctor-visits/batch/${group.batchId}`, { method: 'DELETE' })
                        : await fetch(`${API}/api/doctor-visits/appointments`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ appointment_ids: group.appointments.map(a => a.appointment_id) })
                        });
                    const data = await res.json();
                    if (data.success) {
                        showSuccess(group.batchId ? 'Batch schedule permanently deleted.' : 'Doctor visit permanently deleted.', group.batchId ? 'Batch Deleted' : 'Visit Deleted');
                        if (selectedGroup?.groupKey === group.groupKey) setSelectedGroup(null);
                        fetchAppointments();
                    } else {
                        showError(data.message || 'Failed to delete batch schedule.', 'Delete Failed');
                    }
                } catch (err) {
                    showError('Server error deleting batch schedule.', 'Server Error');
                }
            },
            'Yes, Delete',
            'danger'
        );
    };

    const handleStartBatch = (group) => {
        if (!group.batchId) return;
        showConfirm(
            `Notify the students of "${group.title}" that their visit is starting now?`,
            'Start Batch',
            async () => {
                try {
                    const res = await fetch(`${API}/api/doctor-visits/batch-start/${group.batchId}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId })
                    });
                    const data = await res.json();
                    if (data.success) showSuccess(data.message, 'Students Notified');
                    else showError(data.message || 'Failed to notify students.', 'Notification Failed');
                } catch (err) {
                    showError('Server error sending notifications.', 'Server Error');
                }
            },
            'Send Notification',
            'info'
        );
    };

    const handleSendReminders = () => showConfirm(
        'Send reminders now to students and parents with visits today or tomorrow? Reminders already sent today are skipped. They also go out automatically every morning at 7:00 AM.',
        'Send Reminders',
        async () => {
            try {
                const res = await fetch(`${API}/api/doctor-visits/send-reminders`, { method: 'POST' });
                const data = await res.json();
                if (data.success) showSuccess(data.message, 'Reminders');
                else showError(data.message || 'Failed to send reminders.', 'Reminders Failed');
            } catch (err) {
                showError('Server error sending reminders.', 'Server Error');
            }
        },
        'Send Reminders',
        'info'
    );

    // ---------- per-student reschedule ----------
    const openReschedule = (appt) => {
        const start = parseSQLDate(appt.start_time);
        const pad = (n) => String(n).padStart(2, '0');
        setRescheduleModal({
            appt,
            date: start ? formatLocalDateOnly(start) : '',
            time: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '',
            reason: ''
        });
    };

    const submitReschedule = async (e) => {
        e.preventDefault();
        const { appt, date, time, reason } = rescheduleModal;
        if (!date || !time) { showError('Pick the new date and time.', 'Missing Details'); return; }
        if (!reason || !reason.trim()) { showError('Please give a reason for rescheduling.', 'Missing Reason'); return; }
        try {
            const res = await fetch(`${API}/api/doctor-visits/reschedule/${appt.appointment_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_time: `${date} ${time.slice(0, 5)}:00`, sender_id: userId, reason: reason.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setRescheduleModal(null);
                showSuccess('Appointment rescheduled. The student and parents were notified.', 'Rescheduled');
                fetchAppointments();
            } else {
                showError(data.message || 'Failed to reschedule.', 'Reschedule Failed');
            }
        } catch (err) {
            showError('Server error rescheduling the appointment.', 'Server Error');
        }
    };

    // ---------- follow-up ----------
    const openFollowUp = (appt) => {
        setFollowUpModal({ appt, date: '', notes: '' });
        setFollowUpSlots([]);
        setFollowUpSlot(null);
    };

    const submitFollowUp = async (e) => {
        e.preventDefault();
        if (!followUpSlot) { showError('Pick a time slot for the follow-up.', 'Missing Details'); return; }
        try {
            const res = await fetch(`${API}/api/doctor-visits/${followUpModal.appt.appointment_id}/follow-up`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: followUpModal.appt.student_id,
                    nurse_id: nurseId,
                    sender_id: userId,
                    start_time: followUpSlot.start_time,
                    duration_min: followUpSlot.slot_minutes,
                    notes: followUpModal.notes
                })
            });
            const data = await res.json();
            if (data.success) {
                setFollowUpModal(null);
                showSuccess('Follow-up visit scheduled. The student and parents were notified.', 'Follow-up Scheduled');
                fetchAppointments();
            } else {
                showError(data.message || 'Failed to schedule follow-up.', 'Follow-up Failed');
            }
        } catch (err) {
            showError('Server error scheduling the follow-up.', 'Server Error');
        }
    };

    // ---------- assessment: delete + referral ----------
    const handleDeleteAssessment = (appt) => showConfirm(
        `Delete the assessment of ${studentFullName(appt)}? The visit goes back to "not documented" so it can be redone.`,
        'Delete Assessment',
        async () => {
            try {
                const res = await fetch(`${API}/api/doctor-assessments/${appt.appointment_id}/${appt.student_id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) { showSuccess('Assessment deleted.', 'Deleted'); fetchAppointments(); }
                else showError(data.message || 'Failed to delete assessment.', 'Delete Failed');
            } catch (err) {
                showError('Server error deleting the assessment.', 'Server Error');
            }
        },
        'Yes, Delete',
        'danger'
    );

    const openReferral = (appt) => setReferralModal({
        appt,
        facility: appt.referral_facility || '',
        reason: appt.referral_reason || appt.diagnosis || ''
    });

    const submitReferral = async (printAfter) => {
        const { appt, facility, reason } = referralModal;
        if (!facility.trim() || !reason.trim()) { showError('Facility / specialist and reason are required.', 'Missing Details'); return; }
        try {
            const res = await fetch(`${API}/api/doctor-assessments/${appt.appointment_id}/${appt.student_id}/referral`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facility, reason, sender_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                setReferralModal(null);
                fetchAppointments();
                if (printAfter) printVisit({ ...appt, referral_facility: facility, referral_reason: reason, follow_up_needed: 1 }, 'referral');
                else showSuccess('Referral saved and the student and parents were notified.', 'Referral Saved');
            } else {
                showError(data.message || 'Failed to save referral.', 'Referral Failed');
            }
        } catch (err) {
            showError('Server error saving the referral.', 'Server Error');
        }
    };

    // ---------- history ----------
    const openHistory = async (appt) => {
        setHistoryModal({ appt, rows: [], loading: true });
        try {
            const res = await fetch(`${API}/doctor-visits/clinicLogs&Records?studentId=${encodeURIComponent(appt.student_id)}`);
            const rows = await res.json();
            setHistoryModal({ appt, rows: Array.isArray(rows) ? rows : [], loading: false });
        } catch (err) {
            setHistoryModal({ appt, rows: [], loading: false });
            showError('Could not load the visit history.', 'Server Error');
        }
    };

    // ---------- walk-in ----------
    const openWalkIn = () => setWalkInModal({ student_id: '', studentFilter: '', doctor_id: '', visit_type: 'General Check Up', purpose_other: '', reason: '', duration_min: 15 });

    const walkInDoctors = useMemo(() => {
        const matcher = SPECIALIZATION_MATCH[walkInModal?.visit_type];
        return matcher ? doctors.filter(d => matcher.test(d.specialization || '')) : doctors;
    }, [doctors, walkInModal?.visit_type]);

    const walkInStudents = useMemo(() => {
        const q = (walkInModal?.studentFilter || '').trim().toLowerCase();
        const list = q
            ? students.filter(s => `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase().includes(q))
            : students;
        return list.slice(0, 60);
    }, [students, walkInModal?.studentFilter]);

    const submitWalkIn = async (e) => {
        e.preventDefault();
        const f = walkInModal;
        if (!f.student_id || !f.doctor_id || !f.reason.trim()) { showError('Student, doctor and reason are required.', 'Missing Details'); return; }
        try {
            const res = await fetch(`${API}/api/doctor-visits/walk-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nurse_id: nurseId, student_id: f.student_id, doctor_id: f.doctor_id, visit_type: f.visit_type, purpose_other: f.visit_type === 'Other' ? f.purpose_other : undefined, reason: f.reason, duration_min: f.duration_min, sender_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                setWalkInModal(null);
                setActiveTab('ongoing');
                setView({ kind: 'individual' });
                setSearchTerm('');
                const rows = await fetchRowsOfAppointment(data.appointment_id);
                const row = rows.find(a => a.appointment_id === data.appointment_id);
                if (row) openAssessmentModal(row);
                else showSuccess(data.message, 'Walk-in Registered');
            } else {
                showError(data.message || 'Failed to register walk-in.', 'Walk-in Failed');
            }
        } catch (err) {
            showError('Server error registering the walk-in.', 'Server Error');
        }
    };

    // ---------- printable documents ----------
    const printVisit = (appt, kind) => {
        const issuedBy = `${firstName || ''} ${lastName || ''}`.trim();
        printDocument(
            kind === 'certificate' ? 'Medical Certificate' : kind === 'referral' ? 'Referral Slip' : 'Doctor Visit Summary',
            visitDocumentHtml(kind, appt, issuedBy),
            () => showError('Please allow popups to preview and print the document.', 'Popup Blocked')
        );
    };

    // ---------- row actions in the participants table ----------
    const renderRowActions = (appt, currentAttendance, isPresent) => {
        const attendance = currentAttendance.toLowerCase();
        const scheduled = appt.status === 'Scheduled' || appt.status === 'Completed';
        const key = appt.appointment_id;

        const documentBtn = (label) => (
            <button
                className="action-btn-dv document-dv"
                onClick={() => openAssessmentModal(appt)}
            >
                <FileText size={15} /> {appt.assessment_id ? 'Edit Assessment' : label}
            </button>
        );

        const items = [{ label: 'Visit history', icon: <History size={14} />, onClick: () => openHistory(appt) }];
        if (appt.assessment_id) {
            items.push({ label: 'Visit summary (print)', icon: <ClipboardList size={14} />, onClick: () => printVisit(appt, 'summary') });
            items.push({ label: 'Medical certificate (print)', icon: <FileCheck size={14} />, onClick: () => printVisit(appt, 'certificate') });
            items.push({ label: appt.referral_facility ? 'Referral slip' : 'Issue referral slip', icon: <Send size={14} />, onClick: () => openReferral(appt) });
            if (appt.follow_up_needed) items.push({ label: 'Schedule follow-up', icon: <CalendarClock size={14} />, onClick: () => openFollowUp(appt) });
            items.push({ label: 'Delete assessment', icon: <Trash2 size={14} />, danger: true, onClick: () => handleDeleteAssessment(appt) });
        }

        return (
            <>
                {activeTab === 'upcoming' && appt.status === 'Scheduled' && (
                    <>
                        <button className="action-btn-dv" onClick={() => openReschedule(appt)}>
                            <RotateCcw size={15} /> Reschedule
                        </button>
                        <button className="action-btn-dv cancel-dv" onClick={() => handleCancelAppointment(appt)}>
                            <XCircle size={15} /> Cancel
                        </button>
                    </>
                )}
                {activeTab === 'ongoing' && scheduled && (
                    <>
                        {!isPresent && attendance !== 'excused' && (
                            <button className="action-btn-dv" onClick={() => markPresent(appt)}>
                                <UserCheck size={15} /> Present
                            </button>
                        )}
                        {!isPresent && attendance !== 'absent' && attendance !== 'excused' && (
                            <button className="action-btn-dv cancel-dv" onClick={() => markAbsent(appt)}>
                                <XCircle size={15} /> Absent
                            </button>
                        )}
                        {!isPresent && attendance !== 'excused' && (
                            <button className="action-btn-dv" onClick={() => markExcused(appt)}>Excused</button>
                        )}
                        {isPresent && documentBtn('Document')}
                    </>
                )}
                {activeTab === 'past' && scheduled && (
                    <>
                        {!isPresent && attendance !== 'excused' && (
                            <button className="action-btn-dv" onClick={() => markExcused(appt)}>Excused</button>
                        )}
                        {isPresent && documentBtn('Document Assessment')}
                    </>
                )}
                <div className="row-menu-wrap-dv">
                    <button className="action-btn-dv" onClick={() => setOpenMenuKey(openMenuKey === key ? null : key)} title="More actions">
                        <MoreVertical size={15} /> More
                    </button>
                    {openMenuKey === key && (
                        <>
                            <div className="row-menu-backdrop-dv" onClick={() => setOpenMenuKey(null)} />
                            <div className="row-menu-dv">
                                {items.map(item => (
                                    <button
                                        key={item.label}
                                        className={item.danger ? 'danger-dv' : ''}
                                        onClick={() => { setOpenMenuKey(null); item.onClick(); }}
                                    >
                                        {item.icon} {item.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </>
        );
    };

    const pendingBookingCount = folders.pending_requests || 0;

    const eligibleDoctors = useMemo(() => {
        const matcher = SPECIALIZATION_MATCH[scheduleForm.visit_type];
        return matcher ? doctors.filter(d => matcher.test(d.specialization || '')) : doctors;
    }, [doctors, scheduleForm.visit_type]);

    const groupedVisits = useMemo(() => buildVisitGroups(appointments, activeTab), [appointments, activeTab]);

    // numbers on the status tabs (from the folder summary) and the visit cards cut into days
    const tabCounts = scopeCounts(folders, view, searching);
    const visitDays = useMemo(() => groupByDay(groupedVisits, (g) => dayKey(g.apptStart)), [groupedVisits]);

    useEffect(() => {
        if (selectedGroup) {
            const updated = groupedVisits.find(g => g.groupKey === selectedGroup.groupKey);
            if (updated) setSelectedGroup(updated);
        }
    }, [appointments, groupedVisits, selectedGroup]);

    return (
        <div className="container-dv">
            {/* Header Section */}
            <div className="header-dv">
                <div>
                    <h2>Doctor Visit Management</h2>
                    <p className="subtitle-dv">Schedule, track, and document student doctor visits, and set when each doctor is available.</p>
                </div>
                {section === 'visits' && (
                <div className="header-actions-dv">
                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => setShowDirect(true)}>
                        <CalendarPlus size={18} /> Direct Appointment
                    </button>
                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={openWalkIn}>
                        <Footprints size={18} /> Walk-in
                    </button>
                    <MoreMenu
                        buttonClassName="sti-btn-dv sti-btn-secondary-dv"
                        items={[
                            { icon: <Printer size={16} />, label: 'Print visit summary', onClick: handleExportAllReport },
                            { icon: <Bell size={16} />, label: 'Send reminders', onClick: handleSendReminders }
                        ]}
                    />
                    <button type="button" className="sti-btn-dv sti-btn-primary-dv" onClick={() => setShowScheduleModal(true)}>
                        <Calendar size={18} /> Schedule Doctor Visit
                    </button>
                </div>
                )}
            </div>

            {/* Sections: the visits themselves, when each doctor is available, and the students' booking requests */}
            <nav className="section-nav-dv" aria-label="Doctor visit sections">
                <button type="button" className={`section-tab-dv ${section === 'visits' ? 'active-dv' : ''}`} onClick={() => goSection('visits')}>
                    <ClipboardList size={16} /> Visits
                </button>
                <button type="button" className={`section-tab-dv ${section === 'availability' ? 'active-dv' : ''}`} onClick={() => goSection('availability')}>
                    <CalendarClock size={16} /> Availability
                    {doctorsWithoutSchedule > 0 && (
                        <span className="section-badge-dv warn-dv" title={`${doctorsWithoutSchedule} doctor(s) have no open schedule, so nothing can be booked with them`}>{doctorsWithoutSchedule}</span>
                    )}
                </button>
                <button type="button" className={`section-tab-dv ${section === 'requests' ? 'active-dv' : ''}`} onClick={() => goSection('requests')}>
                    <Inbox size={16} /> Booking Requests
                    {pendingBookingCount > 0 && <span className="section-badge-dv">{pendingBookingCount}</span>}
                </button>
            </nav>

            {section === 'availability' && (
                <>
                    <DoctorAvailability
                        doctors={doctors}
                        nurseId={nurseId}
                        userId={userId}
                        onChanged={refreshAfterScheduleChange}
                        onAddDoctor={openAddDoctor}
                        onEditDoctor={openEditDoctor}
                    />
                    <div style={{ marginTop: 18 }}>
                        <UnavailableDates doctors={doctors} userId={userId} onChanged={refreshAfterScheduleChange} />
                    </div>
                </>
            )}

            {section === 'requests' && (
                <BookingRequests doctors={doctors} userId={userId} onChanged={refreshAfterScheduleChange} />
            )}

            {section === 'visits' && (
            <>
            {pendingBookingCount > 0 && (
                <div className="pending-banner-dv">
                    <Bell size={16} />
                    <span><strong>{pendingBookingCount}</strong> student booking request{pendingBookingCount > 1 ? 's are' : ' is'} waiting for approval.</span>
                    <button type="button" className="sti-btn-dv sti-btn-primary-dv" onClick={() => goSection('requests')}>Review requests</button>
                </div>
            )}

            {/* Folders: Program > Year-Section */}
            <FolderCrumbs trail={crumbTrail} />

            {!listMode && (
                <>
                    <div className="search-box-dv folder-search-dv">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search all visits by student, title or doctor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {foldersLoading ? (
                        <div className="loading-dv">Loading folders...</div>
                    ) : (
                        <FolderGrid items={folderItems} noun="visits" emptyText="No doctor visits yet. Schedule a visit to create the first folder." />
                    )}
                </>
            )}

            {listMode && (
            <>
            {/* Navigation Tabs & Search */}
            <div className="tabs-container-dv">
                <div className="tabs-dv">
                    <button className={`tab-btn-dv ${activeTab === 'upcoming' ? 'active-dv' : ''}`} onClick={() => setActiveTab('upcoming')}>
                        <Clock size={16} /> Upcoming Visits <TabCount value={tabCounts?.upcoming} />
                    </button>
                    <button className={`tab-btn-dv ${activeTab === 'ongoing' ? 'active-dv' : ''}`} onClick={() => setActiveTab('ongoing')}>
                        <UserCheck size={16} /> Ongoing Visits <TabCount value={tabCounts?.ongoing} />
                    </button>
                    <button className={`tab-btn-dv ${activeTab === 'past' ? 'active-dv' : ''}`} onClick={() => setActiveTab('past')}>
                        <CheckCircle size={16} /> Past Visits <TabCount value={tabCounts?.past} />
                    </button>
                </div>

                <div className="search-box-dv">
                    <Search size={16} />
                    <input 
                        type="text" 
                        placeholder="Search student, title, or doctor name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Past visits: filter by doctor and date range */}
            {activeTab === 'past' && (
                <div className="past-filters-dv">
                    <span className="filter-title-dv"><Filter size={16} /> Filter past visits</span>

                    <label>
                        Doctor
                        <select value={pastDoctorFilter} onChange={(e) => setPastDoctorFilter(e.target.value)}>
                            <option value="">All doctors</option>
                            {doctors.map(doc => (
                                <option key={doc.doctor_id} value={doc.doctor_id}>
                                    Dr. {doc.first_name} {doc.last_name} ({doc.specialization})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        From
                        <input
                            type="date"
                            max={pastEndDate || undefined}
                            value={pastStartDate}
                            onChange={(e) => {
                                const newStart = e.target.value;
                                setPastStartDate(newStart);
                                if (pastEndDate && newStart > pastEndDate) setPastEndDate('');
                            }}
                        />
                    </label>

                    <label>
                        To
                        <input type="date" min={pastStartDate || undefined} value={pastEndDate} onChange={(e) => setPastEndDate(e.target.value)} />
                    </label>

                    {(pastStartDate || pastEndDate || pastDoctorFilter) && (
                        <button
                            type="button"
                            className="sti-btn-dv sti-btn-light-dv reset-dv"
                            onClick={() => { setPastStartDate(''); setPastEndDate(''); setPastDoctorFilter(''); }}
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            )}

            {/* Group Cards Grid Section */}
            {loading ? (
                <div className="loading-dv">Loading doctor visits...</div>
            ) : groupedVisits.length === 0 ? (
                <div className="empty-state-dv">
                    <AlertCircle size={36} />
                    <p>No {activeTab} doctor visit schedules found.</p>
                </div>
            ) : activeTab === 'past' ? (
                <PastVisitsTable
                    groups={groupedVisits}
                    onView={setSelectedGroup}
                    onUpdate={openBatchRescheduleModal}
                    onDelete={handleDeleteBatch}
                />
            ) : (
                <div className="day-list-dv">
                {visitDays.map((day) => (
                    <DaySection key={day.key || 'no-date'} heading={dayHeading(day.key, formatDate)} count={day.items.length} noun="visits">
                        <div className="cards-grid-dv">
                            {day.items.map((group) => (
                                <VisitCard
                                    key={group.groupKey}
                                    group={group}
                                    tab={activeTab}
                                    onParticipants={setSelectedGroup}
                                    onScan={openScannerForBatch}
                                    onStart={handleStartBatch}
                                    onEdit={openBatchRescheduleModal}
                                    onDelete={handleDeleteBatch}
                                />
                            ))}
                        </div>
                    </DaySection>
                ))}
                </div>
            )}

            <Pager page={page} pageCount={pageInfo.pageCount} total={pageInfo.total} pageSize={pageInfo.pageSize} onPage={setPage} noun="visits" />
            </>
            )}
            </>
            )}

            {/* MODAL: BATCH PARTICIPANT SCHEDULE & DOCUMENTATION */}
            {selectedGroup && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv modal-large-dv">
                        <div className="modal-header-dv">
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedGroup.title}</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                                    {selectedGroup.doctorName} ({selectedGroup.specialization}) • <strong>
                                        {selectedGroup.appointments.filter(a => (a.attendance_status || '').toLowerCase() === 'present').length} / {selectedGroup.appointments.length}
                                    </strong> Present
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button 
                                    type="button" 
                                    className="sti-btn-dv sti-btn-secondary-dv" 
                                    onClick={handleExportSingleReport}
                                    style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Printer size={16} /> export
                                </button>
                                <button className="close-btn-dv" onClick={() => setSelectedGroup(null)}><X size={20} /></button>
                            </div>
                        </div>

                        {selectedGroup.announcement && (
                            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', margin: '15px 0 5px 0', borderLeft: '4px solid #0284c7', fontSize: '13px', color: '#334155' }}>
                                <strong>Batch Instructions / Announcement:</strong> {selectedGroup.announcement}
                            </div>
                        )}

                        <div style={{ padding: '15px 0' }}>
                            {selectedGroup.appointments.length > PARTICIPANTS_PER_PAGE && (
                                <div className="search-box-dv" style={{ marginBottom: '12px' }}>
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search participants by name, ID or section..."
                                        value={participantSearch}
                                        onChange={(e) => { setParticipantSearch(e.target.value); setParticipantPage(1); }}
                                    />
                                </div>
                            )}
                            <table className="sti-table-dv">
                                <thead>
                                    <tr>
                                        <th>Student ID & Name</th>
                                        <th>Program & Section</th>
                                        <th>Instilled Time Block Slot</th>
                                        <th>Attendance</th>
                                        <th>Assessment</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantPageData.items.map((appt) => {
                                        const now = new Date();
                                        const rawStart = appt.start_time || appt.scheduled_date;
                                        const rawEnd = appt.end_time;
                                        const studentStart = parseSQLDate(rawStart) || selectedGroup.apptStart;
                                        const studentEnd = parseSQLDate(rawEnd) || selectedGroup.apptEnd;

                                        const studentTimeFormatted = `${studentStart ? formatTime(studentStart) : ''} - ${studentEnd ? formatTime(studentEnd) : ''}`;

                                        let currentAttendance = appt.attendance_status || 'Pending';
                                        
                                        if (studentEnd < now && currentAttendance.toLowerCase() === 'pending') {
                                            currentAttendance = 'Absent';
                                        }

                                        const isPresent = currentAttendance.toLowerCase() === 'present';

                                        return (
                                            <tr key={appt.appointment_id}>
                                                <td>
                                                    <strong>{appt.student_first_name} {appt.student_last_name}</strong>
                                                    <div className="sub-text-dv">ID: {appt.student_id}</div>
                                                    {appt.booking_source && appt.booking_source !== 'Nurse' && (
                                                        <div className="sub-text-dv">{appt.booking_source === 'Student' ? 'Booked by student' : 'Walk-in'}{appt.booking_reason ? ` - ${appt.booking_reason}` : ''}</div>
                                                    )}
                                                    {appt.parent_appointment_id && <div className="sub-text-dv">Follow-up visit</div>}
                                                </td>
                                                <td>
                                                    {appt.program_id ? `${appt.program_id} - ${appt.year_level || ''}${appt.section || ''}` : 'N/A'}
                                                </td>
                                                <td style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                                                    {studentTimeFormatted}
                                                </td>
                                                <td>
                                                    <span className={`status-badge-dv badge-${currentAttendance.toLowerCase()}-dv`}>
                                                        {currentAttendance}
                                                    </span>
                                                    {appt.notes && ['absent', 'excused'].includes(currentAttendance.toLowerCase()) && (
                                                        <div className="sub-text-dv">{appt.notes}</div>
                                                    )}
                                                    {appt.status === 'Cancelled' && <div className="sub-text-dv">Appointment cancelled{appt.decline_reason ? `: ${appt.decline_reason}` : ''}</div>}
                                                </td>
                                                <td>
                                                    {appt.assessment_id ? (
                                                        <span className="doc-done-badge-dv"><CheckCircle size={14} /> Documented</span>
                                                    ) : (
                                                        <span className="doc-pending-badge-dv">Pending</span>
                                                    )}
                                                </td>
                                                <td className="table-actions-dv">
                                                    {renderRowActions(appt, currentAttendance, isPresent)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {participantPageData.total === 0 && <div className="hint-dv" style={{ textAlign: 'center' }}>No participants match your search.</div>}
                            <Pager page={participantPageData.page} pageCount={participantPageData.pageCount} total={participantPageData.total} pageSize={PARTICIPANTS_PER_PAGE} onPage={setParticipantPage} noun="students" />
                        </div>

                        <div className="modal-footer-dv" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {activeTab === 'ongoing' && (
                                    <button 
                                        type="button" 
                                        className="sti-btn-dv sti-btn-secondary-dv" 
                                        onClick={() => openScannerForBatch(selectedGroup)}
                                    >
                                        <QrCode size={16} /> Scan QR Attendance
                                    </button>
                                )}
                                {activeTab === 'upcoming' && selectedGroup.batchId && (
                                    <>
                                        <button
                                            type="button"
                                            className="sti-btn-dv sti-btn-secondary-dv"
                                            onClick={() => { setSelectedGroup(null); openBatchRescheduleModal(selectedGroup); }}
                                        >
                                            <Edit size={16} /> Edit Schedule
                                        </button>
                                        <button 
                                            type="button" 
                                            className="sti-btn-dv" 
                                            style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}
                                            onClick={() => handleDeleteBatch(selectedGroup)}
                                        >
                                            <Trash2 size={16} /> Delete Batch
                                        </button>
                                    </>
                                )}
                            </div>
                            <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setSelectedGroup(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: REASON PROMPT (absent / excused / cancel) */}
            {reasonModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>{reasonModal.title}</h3>
                            <button className="close-btn-dv" onClick={() => setReasonModal(null)}><X size={20} /></button>
                        </div>
                        {reasonModal.message && <p className="hint-dv">{reasonModal.message}</p>}
                        <div className="form-group-dv">
                            <label>{reasonModal.label}</label>
                            <textarea rows="3" autoFocus value={reasonText} onChange={e => setReasonText(e.target.value)} />
                        </div>
                        <div className="modal-footer-dv">
                            <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setReasonModal(null)}>Back</button>
                            <button type="button" className="sti-btn-dv sti-btn-primary-dv" onClick={submitReason}>{reasonModal.confirmText}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: RESCHEDULE ONE STUDENT */}
            {rescheduleModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Reschedule Appointment</h3>
                            <button className="close-btn-dv" onClick={() => setRescheduleModal(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={submitReschedule}>
                            <div className="appt-info-card-dv">
                                <strong>{studentFullName(rescheduleModal.appt)}</strong>
                                <div>{visitLabel(rescheduleModal.appt.visit_type, rescheduleModal.appt.purpose_other)} with Dr. {rescheduleModal.appt.doc_first_name} {rescheduleModal.appt.doc_last_name}</div>
                                <div>Now: {formatDate(rescheduleModal.appt.start_time)}, {formatTime(rescheduleModal.appt.start_time)} - {formatTime(rescheduleModal.appt.end_time)}</div>
                            </div>
                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>New Date</label>
                                    <input type="date" min={todayStr} required value={rescheduleModal.date} onChange={e => setRescheduleModal({ ...rescheduleModal, date: e.target.value })} />
                                </div>
                                <div className="form-group-dv">
                                    <label>New Start Time</label>
                                    <input type="time" required value={rescheduleModal.time} onChange={e => setRescheduleModal({ ...rescheduleModal, time: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group-dv">
                                <label>Reason (the student and parents are told)</label>
                                <textarea rows="2" required maxLength={255} value={rescheduleModal.reason} onChange={e => setRescheduleModal({ ...rescheduleModal, reason: e.target.value })} placeholder="e.g. The doctor has an emergency consultation at that time" />
                            </div>
                            {rescheduleModal.date && (
                                rescheduleWindows.length > 0
                                    ? <div className="avail-ok-dv">Doctor is open: {rescheduleWindows.map(w => `${time12(w.start_time)} - ${time12(w.end_time)}`).join(', ')}. The visit keeps its length.</div>
                                    : <div className="avail-warn-dv">This doctor has no open schedule on that date.</div>
                            )}
                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setRescheduleModal(null)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv">Reschedule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: FOLLOW-UP VISIT */}
            {followUpModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Schedule Follow-up</h3>
                            <button className="close-btn-dv" onClick={() => setFollowUpModal(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={submitFollowUp}>
                            <div className="appt-info-card-dv">
                                <strong>{studentFullName(followUpModal.appt)}</strong>
                                <div>Follow-up of: {visitLabel(followUpModal.appt.visit_type, followUpModal.appt.purpose_other)} on {formatDate(followUpModal.appt.start_time)}</div>
                                <div>Doctor: Dr. {followUpModal.appt.doc_first_name} {followUpModal.appt.doc_last_name}</div>
                            </div>
                            <div className="form-group-dv">
                                <label>Follow-up Date</label>
                                <input type="date" min={todayStr} required value={followUpModal.date} onChange={e => setFollowUpModal({ ...followUpModal, date: e.target.value })} />
                            </div>
                            {followUpModal.date && (
                                <div className="form-group-dv">
                                    <label>Available Slots</label>
                                    {followUpSlotsLoading ? <div className="hint-dv">Loading slots...</div> : followUpSlots.length === 0 ? (
                                        <div className="avail-warn-dv">
                                            No open schedule for this doctor on that date.{' '}
                                            <button type="button" className="link-btn-dv" onClick={() => goSetupSchedule(followUpModal.appt.doctor_id)}>Set up schedule</button>
                                        </div>
                                    ) : (
                                        <div className="slot-list-dv">
                                            {followUpSlots.map(s => (
                                                <button
                                                    key={s.start_time}
                                                    type="button"
                                                    disabled={!s.available}
                                                    className={`slot-btn-dv ${followUpSlot?.start_time === s.start_time ? 'slot-selected-dv' : ''}`}
                                                    onClick={() => setFollowUpSlot(s)}
                                                >
                                                    {time12(s.start_time.slice(11))}
                                                    <small>{s.available ? 'Open' : s.mine ? 'Student busy' : s.past ? 'Passed' : 'Full'}</small>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="form-group-dv">
                                <label>Notes (optional)</label>
                                <input type="text" maxLength={200} placeholder="e.g. Bring the lab results" value={followUpModal.notes} onChange={e => setFollowUpModal({ ...followUpModal, notes: e.target.value })} />
                            </div>
                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setFollowUpModal(null)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv" disabled={!followUpSlot}>Schedule Follow-up</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REFERRAL SLIP */}
            {referralModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Referral Slip</h3>
                            <button className="close-btn-dv" onClick={() => setReferralModal(null)}><X size={20} /></button>
                        </div>
                        <div className="appt-info-card-dv">
                            <strong>{studentFullName(referralModal.appt)}</strong>
                            <div>Diagnosis: {referralModal.appt.diagnosis || '-'}</div>
                        </div>
                        <div className="form-group-dv">
                            <label>Refer to (facility / specialist)</label>
                            <input type="text" maxLength={150} value={referralModal.facility} onChange={e => setReferralModal({ ...referralModal, facility: e.target.value })} placeholder="e.g. Baliuag District Hospital - ENT" />
                        </div>
                        <div className="form-group-dv">
                            <label>Reason for referral</label>
                            <textarea rows="3" value={referralModal.reason} onChange={e => setReferralModal({ ...referralModal, reason: e.target.value })} />
                        </div>
                        <div className="modal-footer-dv">
                            <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setReferralModal(null)}>Cancel</button>
                            <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => submitReferral(false)}>Save</button>
                            <button type="button" className="sti-btn-dv sti-btn-primary-dv" onClick={() => submitReferral(true)}><Printer size={15} /> Save &amp; Print</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: STUDENT VISIT HISTORY */}
            {historyModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv modal-large-dv">
                        <div className="modal-header-dv">
                            <h3>Doctor Visit History - {studentFullName(historyModal.appt)} ({historyModal.appt.student_id})</h3>
                            <button className="close-btn-dv" onClick={() => setHistoryModal(null)}><X size={20} /></button>
                        </div>
                        {historyModal.loading ? <div className="hint-dv">Loading...</div> : historyModal.rows.length === 0 ? (
                            <div className="hint-dv">No doctor visits on record.</div>
                        ) : (
                            <table className="sti-table-dv">
                                <thead>
                                    <tr><th>Date</th><th>Visit Type</th><th>Doctor</th><th>Status</th><th>Diagnosis</th><th>Flags</th></tr>
                                </thead>
                                <tbody>
                                    {historyModal.rows.map(r => (
                                        <tr key={r.appointment_id}>
                                            <td>{formatDate(r.start_time)}<div className="sub-text-dv">{formatTime(r.start_time)}</div></td>
                                            <td>{visitLabel(r.visit_type, r.purpose_other)}</td>
                                            <td>Dr. {r.doctor_first_name} {r.doctor_last_name}</td>
                                            <td>{r.status}{r.attendance_status && r.attendance_status !== 'Pending' ? <div className="sub-text-dv">{r.attendance_status}</div> : null}</td>
                                            <td>{r.diagnosis || '-'}</td>
                                            <td>{r.is_abnormal ? <span className="flag-dv">Abnormal</span> : null} {r.follow_up_needed ? <span className="flag-dv">Follow-up</span> : null}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div className="modal-footer-dv">
                            <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setHistoryModal(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: DIRECT APPOINTMENT (pick a student, set a custom time block) */}
            <DirectAppointmentModal
                isOpen={showDirect}
                doctors={doctors}
                creator={{ nurseId }}
                userId={userId}
                onClose={() => setShowDirect(false)}
                onCreated={() => { fetchAppointments(); }}
            />

            {/* MODAL: WALK-IN VISIT */}
            {walkInModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Register Walk-in Visit</h3>
                            <button className="close-btn-dv" onClick={() => setWalkInModal(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={submitWalkIn}>
                            <p className="hint-dv">For a student who comes to the clinic without an appointment. The visit starts now and the student is checked in right away.</p>
                            <div className="form-group-dv">
                                <label>Student</label>
                                <input type="text" placeholder="Search by name or student ID..." value={walkInModal.studentFilter} onChange={e => setWalkInModal({ ...walkInModal, studentFilter: e.target.value })} />
                                <select required size={5} value={walkInModal.student_id} onChange={e => setWalkInModal({ ...walkInModal, student_id: e.target.value })} style={{ marginTop: '6px' }}>
                                    {walkInStudents.map(s => (
                                        <option key={s.student_id} value={s.student_id}>{s.last_name}, {s.first_name} ({s.student_id}) - {s.program_id || ''} {s.year_level || ''}{s.section || ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Visit Type</label>
                                    <select value={walkInModal.visit_type} onChange={e => setWalkInModal({ ...walkInModal, visit_type: e.target.value, doctor_id: '' })}>
                                        {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="form-group-dv">
                                    <label>Doctor</label>
                                    <select required value={walkInModal.doctor_id} onChange={e => setWalkInModal({ ...walkInModal, doctor_id: e.target.value })}>
                                        <option value="">-- Select Doctor --</option>
                                        {walkInDoctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                                    </select>
                                </div>
                            </div>
                            {walkInModal.visit_type === 'Other' && (
                                <div className="form-group-dv">
                                    <label>Please specify the purpose</label>
                                    <input type="text" required maxLength={150} placeholder="e.g. Counselling referral" value={walkInModal.purpose_other} onChange={e => setWalkInModal({ ...walkInModal, purpose_other: e.target.value })} />
                                </div>
                            )}
                            <div className="form-group-dv">
                                <label>Reason for the visit</label>
                                <textarea rows="2" required maxLength={255} value={walkInModal.reason} onChange={e => setWalkInModal({ ...walkInModal, reason: e.target.value })} />
                            </div>
                            <div className="form-group-dv">
                                <label>Expected length (minutes)</label>
                                <input type="number" min="5" max="240" step="5" value={walkInModal.duration_min} onChange={e => setWalkInModal({ ...walkInModal, duration_min: e.target.value })} />
                            </div>
                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setWalkInModal(null)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv">Register &amp; Document</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: JSQR SCANNER WITH MANUAL ENTRY */}
{showScannerModal && (
    <div className="modal-overlay-dv">
        <div className="modal-content-dv">
            <div className="modal-header-dv">
                <h3>Scan Student QR Code {activeScanGroup ? `- ${activeScanGroup.title}` : ''}</h3>
                <button className="close-btn-dv" onClick={() => { setShowScannerModal(false); setActiveScanGroup(null); setQrInput(''); }}>
                    <X size={20} />
                </button>
            </div>
            <div style={{ textAlign: 'center', padding: '10px' }}>
                <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                    Align the student's QR code within the camera frame or enter their Student ID manually to update attendance to <strong>Present</strong>.
                </p>
                <video ref={videoRef} style={{ width: '100%', maxHeight: '260px', borderRadius: '8px', border: '2px solid #ccc' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Manual Input Form */}
                <form onSubmit={handleManualScanSubmit} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                        type="text" 
                        placeholder="Or enter Student ID manually..." 
                        value={qrInput} 
                        onChange={(e) => setQrInput(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    />
                    <button type="submit" className="sti-btn-dv sti-btn-secondary-dv" style={{ justifyContent: 'center' }}>
                        Submit Manual Input
                    </button>
                </form>
            </div>
            <div className="modal-footer-dv">
                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => { setShowScannerModal(false); setActiveScanGroup(null); setQrInput(''); }}>
                    Close Scanner
                </button>
            </div>
        </div>
    </div>
)}

            {/* MODAL 1: ADD / EDIT DOCTOR */}
            {showDoctorModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>{isEditDoctor ? 'Edit Doctor Profile' : 'Add New Doctor Profile'}</h3>
                            <button className="close-btn-dv" onClick={() => setShowDoctorModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveDoctor}>
                            <div className="form-group-dv">
                                <label>First Name</label>
                                <input type="text" required value={doctorForm.first_name} onChange={e => setDoctorForm({...doctorForm, first_name: e.target.value})} />
                            </div>
                            <div className="form-group-dv">
                                <label>Last Name</label>
                                <input type="text" required value={doctorForm.last_name} onChange={e => setDoctorForm({...doctorForm, last_name: e.target.value})} />
                            </div>
                            <div className="form-group-dv">
                                <label>Specialization</label>
                                <input type="text" placeholder="e.g. General Physician, Dentist" required value={doctorForm.specialization} onChange={e => setDoctorForm({...doctorForm, specialization: e.target.value})} />
                            </div>
                            <div className="form-group-dv">
                                <label>Contact Number</label>
                                <input type="text" required value={doctorForm.contact_number} onChange={e => setDoctorForm({...doctorForm, contact_number: e.target.value})} />
                            </div>
                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setShowDoctorModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv">Save Doctor Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: BATCH SCHEDULE & APPOINTMENTS WITH TIME BLOCK ESTIMATIONS */}
            {showScheduleModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv modal-large-dv">
                        <div className="modal-header-dv">
                            <h3>Mass Batch Schedule Doctor Visit</h3>
                            <button className="close-btn-dv" onClick={() => setShowScheduleModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateMassSchedule}>
                            {timeSlotCollisions && (
                                <div className="error-banner-dv"><AlertCircle size={16} /> {timeSlotCollisions}</div>
                            )}

                            <div className="form-group-dv">
                                <label>Visit Type</label>
                                <select
                                    required
                                    value={scheduleForm.visit_type}
                                    onChange={e => {
                                        const nextType = e.target.value;
                                        const matcher = SPECIALIZATION_MATCH[nextType];
                                        setScheduleForm(prev => {
                                            const currentDoctor = doctors.find(d => d.doctor_id === prev.doctor_id);
                                            const keepDoctor = !matcher || (currentDoctor && matcher.test(currentDoctor.specialization || ''));
                                            return { ...prev, visit_type: nextType, doctor_id: keepDoctor ? prev.doctor_id : '' };
                                        });
                                    }}
                                >
                                    {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {scheduleForm.visit_type === 'Other' && (
                                <div className="form-group-dv">
                                    <label>Please specify the purpose</label>
                                    <input type="text" required maxLength={150} placeholder="e.g. Counselling referral" value={scheduleForm.purpose_other} onChange={e => setScheduleForm({ ...scheduleForm, purpose_other: e.target.value })} />
                                </div>
                            )}

                            <div className="form-group-dv">
                                <label>Visit Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder={VISIT_TYPE_HINTS[scheduleForm.visit_type]}
                                    value={scheduleForm.title} 
                                    onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} 
                                />
                            </div>

                            <div className="form-group-dv">
                                <label>Announcement / Instructions (Optional)</label>
                                <textarea 
                                    rows="2"
                                    placeholder="e.g. Fasting required 8 hours prior, bring valid ID."
                                    value={scheduleForm.announcement} 
                                    onChange={e => setScheduleForm({...scheduleForm, announcement: e.target.value})} 
                                />
                            </div>

                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Assign Doctor</label>
                                    <select required value={scheduleForm.doctor_id} onChange={e => setScheduleForm({...scheduleForm, doctor_id: e.target.value})}>
                                        <option value="">-- Select Doctor --</option>
                                        {eligibleDoctors.map(d => (
                                            <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>
                                        ))}
                                    </select>
                                    {SPECIALIZATION_MATCH[scheduleForm.visit_type] && eligibleDoctors.length === 0 && (
                                        <small style={{ color: '#b45309', display: 'block', marginTop: '4px' }}>
                                            No {scheduleForm.visit_type === 'Dental' ? 'dentist' : 'optometrist / ophthalmologist'} on file. Add one under Manage Doctor Profile first (set the specialization to {scheduleForm.visit_type === 'Dental' ? 'Dentist' : 'Optometrist'}).
                                        </small>
                                    )}
                                </div>
                                <div className="form-group-dv">
                                    <label>Scheduled Date</label>
                                    <input 
                                        type="date" 
                                        min={todayStr} 
                                        required 
                                        value={scheduleForm.scheduled_date} 
                                        onChange={e => {
                                            const newDate = e.target.value;
                                            setScheduleForm(prev => {
                                                const minStart = getMinStartTime(newDate);
                                                let updatedStart = prev.batch_start_time;
                                                if (minStart && updatedStart && updatedStart < minStart) {
                                                    updatedStart = '';
                                                }
                                                return { ...prev, scheduled_date: newDate, batch_start_time: updatedStart };
                                            });
                                        }} 
                                    />
                                </div>
                            </div>

                            {scheduleForm.doctor_id && scheduleForm.scheduled_date && !availability.loading && (
                                availability.windows.length > 0 ? (
                                    <div className="avail-ok-dv">
                                        Open schedule that day: {availability.windows.map(w => `${time12(w.start_time)} - ${time12(w.end_time)}`).join(', ')}. The whole batch must fit inside it.
                                    </div>
                                ) : (
                                    <div className="avail-warn-dv">
                                        This doctor has no open {scheduleForm.visit_type} schedule on that date, so the batch cannot be saved.{' '}
                                        <button type="button" className="link-btn-dv" onClick={() => goSetupSchedule(scheduleForm.doctor_id)}>Set up schedule</button>
                                    </div>
                                )
                            )}

                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Batch Start Time</label>
                                    <input 
                                        type="time" 
                                        required 
                                        min={getMinStartTime(scheduleForm.scheduled_date)}
                                        value={scheduleForm.batch_start_time} 
                                        onChange={e => {
                                            const newStart = e.target.value;
                                            setScheduleForm(prev => {
                                                let updatedEnd = prev.batch_end_time;
                                                if (updatedEnd && updatedEnd <= newStart) {
                                                    updatedEnd = '';
                                                }
                                                return { ...prev, batch_start_time: newStart, batch_end_time: updatedEnd };
                                            });
                                        }} 
                                    />
                                </div>
                                <div className="form-group-dv">
                                    <label>Batch End Time</label>
                                    <input 
                                        type="time" 
                                        min={scheduleForm.batch_start_time || getMinStartTime(scheduleForm.scheduled_date)} 
                                        required 
                                        value={scheduleForm.batch_end_time} 
                                        onChange={e => {
                                            const newEnd = e.target.value;
                                            if (scheduleForm.batch_start_time && newEnd <= scheduleForm.batch_start_time) {
                                                setTimeSlotCollisions('Batch end time must be strictly after batch start time.');
                                                return;
                                            } else {
                                                setTimeSlotCollisions('');
                                            }
                                            setScheduleForm({...scheduleForm, batch_end_time: newEnd});
                                        }} 
                                    />
                                </div>
                                <div className="form-group-dv">
                                    <label>Duration Slot (Mins / Student)</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="120" 
                                        required 
                                        value={scheduleForm.slot_duration} 
                                        onChange={e => setScheduleForm({...scheduleForm, slot_duration: e.target.value})} 
                                    />
                                </div>
                            </div>

                            {/* Instilled Time Block & Estimation Banner */}
                            {scheduleForm.batch_start_time && scheduleForm.batch_end_time && selectedStudentIds.length > 0 && (
                                <div style={{ background: '#e0f2fe', padding: '12px 16px', borderRadius: '8px', marginBottom: '15px', borderLeft: '4px solid #0284c7', fontSize: '13px', color: '#0369a1' }}>
                                    <strong>Time Block Estimation Summary:</strong>
                                    <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                                        <li>Per-Student Duration Slot: <strong>{scheduleForm.slot_duration || 15} minutes</strong></li>
                                        <li>Selected Students Count: <strong>{selectedStudentIds.length} student(s)</strong></li>
                                        <li>Total Estimated Batch Duration Required: <strong>{selectedStudentIds.length * (parseInt(scheduleForm.slot_duration, 10) || 15)} minutes</strong></li>
                                    </ul>
                                </div>
                            )}

                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Target Academic Program</label>
                                    <select 
                                        value={scheduleForm.target_program} 
                                        onChange={e => setScheduleForm({...scheduleForm, target_program: e.target.value})}
                                    >
                                        <option value="">All Programs</option>
                                        {programs.map(prog => (
                                            <option key={prog.program_id} value={prog.program_id}>
                                                {prog.program_id} - {prog.program_name} {prog.type ? `(${prog.type})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group-dv">
                                    <label>Year Level</label>
                                    <select 
                                        value={scheduleForm.target_year_level} 
                                        onChange={e => setScheduleForm({...scheduleForm, target_year_level: e.target.value})}
                                    >
                                        <option value="">All Year Levels</option>
                                        <option value="1">1st Year</option>
                                        <option value="2">2nd Year</option>
                                        <option value="3">3rd Year</option>
                                        <option value="4">4th Year</option>
                                    </select>
                                </div>

                                <div className="form-group-dv">
                                    <label>Section</label>
                                    <select 
                                        value={scheduleForm.target_section} 
                                        onChange={e => setScheduleForm({...scheduleForm, target_section: e.target.value})}
                                    >
                                        <option value="">All Sections</option>
                                        {availableSections.map(sec => (
                                            <option key={sec} value={sec}>Section {sec}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group-dv">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ margin: 0 }}>
                                        Select Group Participants ({selectedStudentIds.length} selected / {filteredStudents.length} available):
                                    </label>
                                    <div>
                                        <button 
                                            type="button" 
                                            className="sti-btn-link-dv"
                                            onClick={handleSelectAllFiltered}
                                            style={{ background: 'none', border: 'none', color: '#0056b3', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
                                        >
                                            Select All Filtered
                                        </button>
                                        <button 
                                            type="button" 
                                            className="sti-btn-link-dv"
                                            onClick={handleDeselectAllFiltered}
                                            style={{ background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', marginLeft: '12px' }}
                                        >
                                            Deselect Filtered
                                        </button>
                                    </div>
                                </div>

                                <div className="student-select-list-dv">
                                    {filteredStudents.length === 0 ? (
                                        <div style={{ padding: '15px', color: '#666', gridColumn: '1 / -1', textAlign: 'center' }}>
                                            No students found matching the selected filters.
                                        </div>
                                    ) : (
                                        filteredStudents.map(s => (
                                            <label key={s.student_id} className={`student-checkbox-item-dv ${selectedStudentIds.includes(s.student_id) ? 'selected-dv' : ''}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedStudentIds.includes(s.student_id)} 
                                                    onChange={() => handleStudentToggle(s.student_id)} 
                                                />
                                                <span>{s.first_name} {s.last_name} ({s.program_id || 'N/A'} {s.year_level}{s.section})</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv">Confirm & Batch Schedule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: DOCUMENT DOCTOR ASSESSMENT */}
            {showAssessmentModal && selectedAppt && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Document Doctor Assessment</h3>
                            <button className="close-btn-dv" onClick={() => setShowAssessmentModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveAssessment}>
                            <div className="appt-info-card-dv">
                                <strong>Student: {selectedAppt.student_first_name} {selectedAppt.student_last_name}</strong>
                                <div>Visit: {selectedAppt.title || 'Doctor Visit'} <em>({visitLabel(selectedAppt.visit_type, selectedAppt.purpose_other)})</em></div>
                                <div>Doctor: Dr. {selectedAppt.doc_first_name} {selectedAppt.doc_last_name}</div>
                                <div>Attendance Status: <strong>{selectedAppt.attendance_status || 'Pending'}</strong></div>
                            </div>

                            <div className="form-group-dv" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                    <input type="checkbox" style={{ width: 'auto' }} checked={assessmentForm.is_abnormal} onChange={e => setAssessmentForm({...assessmentForm, is_abnormal: e.target.checked})} />
                                    Abnormal finding
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                    <input type="checkbox" style={{ width: 'auto' }} checked={assessmentForm.follow_up_needed} onChange={e => setAssessmentForm({...assessmentForm, follow_up_needed: e.target.checked})} />
                                    Follow-up needed
                                </label>
                            </div>

                            {selectedAppt.visit_type === 'Dental' && (
                                <>
                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>Oral Hygiene</label>
                                            <select required value={assessmentForm.dental.oral_hygiene} onChange={e => setDental('oral_hygiene', e.target.value)}>
                                                <option value="">-- Select --</option>
                                                <option value="Good">Good</option>
                                                <option value="Fair">Fair</option>
                                                <option value="Poor">Poor</option>
                                            </select>
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Gum Condition</label>
                                            <select value={assessmentForm.dental.gum_condition} onChange={e => setDental('gum_condition', e.target.value)}>
                                                <option value="">-- Select --</option>
                                                <option value="Healthy">Healthy</option>
                                                <option value="Gingivitis">Gingivitis</option>
                                                <option value="Bleeding gums">Bleeding gums</option>
                                                <option value="Swollen gums">Swollen gums</option>
                                                <option value="Periodontal concern">Periodontal concern</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>Decayed (caries)</label>
                                            <input type="number" min="0" max="32" value={assessmentForm.dental.caries_count} onChange={e => setDental('caries_count', e.target.value)} />
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Missing</label>
                                            <input type="number" min="0" max="32" value={assessmentForm.dental.missing_count} onChange={e => setDental('missing_count', e.target.value)} />
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Filled</label>
                                            <input type="number" min="0" max="32" value={assessmentForm.dental.filled_count} onChange={e => setDental('filled_count', e.target.value)} />
                                        </div>
                                        <div className="form-group-dv">
                                            <label>DMFT Index</label>
                                            <input type="text" readOnly value={(parseInt(assessmentForm.dental.caries_count, 10) || 0) + (parseInt(assessmentForm.dental.missing_count, 10) || 0) + (parseInt(assessmentForm.dental.filled_count, 10) || 0)} />
                                        </div>
                                    </div>

                                    <div className="form-group-dv">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                            <input type="checkbox" style={{ width: 'auto' }} checked={assessmentForm.dental.malocclusion} onChange={e => setDental('malocclusion', e.target.checked)} />
                                            Malocclusion observed
                                        </label>
                                    </div>

                                    <div className="form-group-dv">
                                        <label>Tooth / Area Notes</label>
                                        <textarea rows="2" placeholder="e.g. Caries on #16 and #26, plaque build-up on lower incisors" value={assessmentForm.dental.tooth_notes} onChange={e => setDental('tooth_notes', e.target.value)}></textarea>
                                    </div>

                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>Treatment Done</label>
                                            <textarea rows="2" placeholder="e.g. Oral prophylaxis" value={assessmentForm.dental.treatment_done} onChange={e => setDental('treatment_done', e.target.value)}></textarea>
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Treatment Needed</label>
                                            <textarea rows="2" placeholder="e.g. Filling for #16" value={assessmentForm.dental.treatment_needed} onChange={e => setDental('treatment_needed', e.target.value)}></textarea>
                                        </div>
                                    </div>

                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                                <input type="checkbox" style={{ width: 'auto' }} checked={assessmentForm.dental.referral_needed} onChange={e => setDental('referral_needed', e.target.checked)} />
                                                Referral needed
                                            </label>
                                            {assessmentForm.dental.referral_needed && (
                                                <input type="text" placeholder="Refer to (clinic / specialist)" value={assessmentForm.dental.referral_to} onChange={e => setDental('referral_to', e.target.value)} />
                                            )}
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Next Visit Recommendation</label>
                                            <input type="text" placeholder="e.g. Return in 6 months" value={assessmentForm.dental.next_visit_recommendation} onChange={e => setDental('next_visit_recommendation', e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="form-group-dv">
                                        <label>Remarks</label>
                                        <textarea rows="2" value={assessmentForm.dental.remarks} onChange={e => setDental('remarks', e.target.value)}></textarea>
                                    </div>
                                </>
                            )}

                            {selectedAppt.visit_type === 'Vision' && (
                                <>
                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>Visual Acuity - Left (uncorrected)</label>
                                            <input type="text" required placeholder="e.g. 20/20" maxLength={10} value={assessmentForm.vision.visual_acuity_left} onChange={e => setVision('visual_acuity_left', e.target.value)} />
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Visual Acuity - Right (uncorrected)</label>
                                            <input type="text" required placeholder="e.g. 20/20" maxLength={10} value={assessmentForm.vision.visual_acuity_right} onChange={e => setVision('visual_acuity_right', e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>Visual Acuity - Left (corrected)</label>
                                            <input type="text" placeholder="With eyeglasses/contacts" maxLength={10} value={assessmentForm.vision.va_left_corrected} onChange={e => setVision('va_left_corrected', e.target.value)} />
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Visual Acuity - Right (corrected)</label>
                                            <input type="text" placeholder="With eyeglasses/contacts" maxLength={10} value={assessmentForm.vision.va_right_corrected} onChange={e => setVision('va_right_corrected', e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="form-group-dv" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                            <input type="checkbox" style={{ width: 'auto' }} checked={assessmentForm.vision.wears_eyeglasses} onChange={e => setVision('wears_eyeglasses', e.target.checked)} />
                                            Wears eyeglasses
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                            <input type="checkbox" style={{ width: 'auto' }} checked={assessmentForm.vision.wears_contacts} onChange={e => setVision('wears_contacts', e.target.checked)} />
                                            Wears contact lenses
                                        </label>
                                    </div>

                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>Color Vision</label>
                                            <select value={assessmentForm.vision.color_vision} onChange={e => setVision('color_vision', e.target.value)}>
                                                <option value="">Not tested</option>
                                                <option value="Normal">Normal</option>
                                                <option value="Deficient">Deficient</option>
                                            </select>
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Recommended Action</label>
                                            <select value={assessmentForm.vision.recommended_action} onChange={e => setVision('recommended_action', e.target.value)}>
                                                <option value="No action">No action</option>
                                                <option value="Eyeglasses">Eyeglasses</option>
                                                <option value="Refer to ophthalmologist">Refer to ophthalmologist</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group-dv">
                                        <label>Eye Condition Findings</label>
                                        <textarea rows="2" placeholder="e.g. Mild myopia, no redness or discharge" value={assessmentForm.vision.eye_findings} onChange={e => setVision('eye_findings', e.target.value)}></textarea>
                                    </div>

                                    <div className="form-group-dv">
                                        <label>Remarks</label>
                                        <textarea rows="2" value={assessmentForm.vision.remarks} onChange={e => setVision('remarks', e.target.value)}></textarea>
                                    </div>
                                </>
                            )}

                            {selectedAppt.visit_type !== 'Dental' && selectedAppt.visit_type !== 'Vision' && (
                                <>
                                    <div className="form-group-dv">
                                        <label>Clinical Findings</label>
                                        <textarea
                                            rows="3"
                                            required
                                            value={assessmentForm.clinical_findings}
                                            onChange={e => setAssessmentForm({...assessmentForm, clinical_findings: e.target.value})}
                                        ></textarea>
                                    </div>

                                    <div className="form-group-dv">
                                        <label>Diagnosis</label>
                                        <textarea
                                            rows="2"
                                            required
                                            value={assessmentForm.diagnosis}
                                            onChange={e => setAssessmentForm({...assessmentForm, diagnosis: e.target.value})}
                                        ></textarea>
                                    </div>

                                    <div className="form-group-dv">
                                        <label>Treatment & Recommendations</label>
                                        <textarea
                                            rows="3"
                                            required
                                            value={assessmentForm.treatment_recommendations}
                                            onChange={e => setAssessmentForm({...assessmentForm, treatment_recommendations: e.target.value})}
                                        ></textarea>
                                    </div>
                                </>
                            )}

                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setShowAssessmentModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv">Save Assessment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: EDIT BATCH APPOINTMENT DATE & START/END TIME */}
            {showBatchRescheduleModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Edit Batch Appointment Schedule</h3>
                            <button className="close-btn-dv" onClick={() => setShowBatchRescheduleModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveBatchReschedule}>
                            <div className="form-group-dv">
                                <label>Batch Appointment Scheduled Date</label>
                                <input 
                                    type="date" 
                                    min={activeTab === 'past' ? undefined : todayStr}
                                    required
                                    value={batchRescheduleData.scheduled_date}
                                    onChange={e => {
                                        const newDate = e.target.value;
                                        setBatchRescheduleData(prev => {
                                            const minStart = getMinStartTime(newDate);
                                            let updatedStart = prev.batch_start_time;
                                            if (activeTab !== 'past' && minStart && updatedStart && updatedStart < minStart) {
                                                updatedStart = '';
                                            }
                                            return { ...prev, scheduled_date: newDate, batch_start_time: updatedStart };
                                        });
                                    }}
                                />
                            </div>

                            <div className="form-group-dv">
                                <label>Batch Start Time</label>
                                <input
                                    type="time"
                                    required
                                    min={activeTab === 'past' ? undefined : getMinStartTime(batchRescheduleData.scheduled_date)}
                                    value={batchRescheduleData.batch_start_time}
                                    onChange={e => {
                                        const newStart = e.target.value;
                                        setBatchRescheduleData(prev => {
                                            let updatedEnd = prev.batch_end_time;
                                            if (updatedEnd && updatedEnd <= newStart) {
                                                updatedEnd = '';
                                            }
                                            return { ...prev, batch_start_time: newStart, batch_end_time: updatedEnd };
                                        });
                                    }} 
                                />
                            </div>

                            <div className="form-group-dv">
                                <label>Batch End Time</label>
                                <input 
                                    type="time" 
                                    min={batchRescheduleData.batch_start_time || (activeTab === 'past' ? undefined : getMinStartTime(batchRescheduleData.scheduled_date))}
                                    required 
                                    value={batchRescheduleData.batch_end_time} 
                                    onChange={e => setBatchRescheduleData({...batchRescheduleData, batch_end_time: e.target.value})} 
                                />
                            </div>

                            <div className="form-group-dv">
                                <label>Per-Slot Duration (Minutes)</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="120"
                                    required 
                                    value={batchRescheduleData.slot_duration} 
                                    onChange={e => setBatchRescheduleData({...batchRescheduleData, slot_duration: e.target.value})} 
                                />
                            </div>

                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setShowBatchRescheduleModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv">Save Batch Date & Times</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* GENERIC FEEDBACK / ALERT / CONFIRMATION MODAL */}
            {feedbackModal.show && (
                <div className="modal-overlay-dv" style={{ zIndex: 1100 }}>
                    <div className="modal-content-dv" style={{ maxWidth: '440px', textAlign: 'center', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            {feedbackModal.type === 'success' && (
                                <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: '50%', padding: '12px', display: 'flex' }}>
                                    <CheckCircle size={36} />
                                </div>
                            )}
                            {feedbackModal.type === 'danger' && (
                                <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '50%', padding: '12px', display: 'flex' }}>
                                    <AlertCircle size={36} />
                                </div>
                            )}
                            {(feedbackModal.type === 'info' || feedbackModal.type === 'warning') && (
                                <div style={{ background: '#fef3c7', color: '#d97706', borderRadius: '50%', padding: '12px', display: 'flex' }}>
                                    <AlertCircle size={36} />
                                </div>
                            )}
                        </div>

                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>{feedbackModal.title}</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>{feedbackModal.message}</p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                            {feedbackModal.cancelText && (
                                <button 
                                    type="button" 
                                    className="sti-btn-dv sti-btn-light-dv"
                                    onClick={closeFeedbackModal}
                                    style={{ minWidth: '90px' }}
                                >
                                    {feedbackModal.cancelText}
                                </button>
                            )}
                            <button 
                                type="button" 
                                className={`sti-btn-dv ${feedbackModal.type === 'danger' ? '' : 'sti-btn-primary-dv'}`}
                                style={feedbackModal.type === 'danger' ? { background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', minWidth: '90px' } : { minWidth: '90px' }}
                                onClick={() => {
                                    if (feedbackModal.onConfirm) {
                                        feedbackModal.onConfirm();
                                    } else {
                                        closeFeedbackModal();
                                    }
                                }}
                            >
                                {feedbackModal.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorVisit;