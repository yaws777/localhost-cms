// requirementManagement.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import {
    Search, Calendar, Pencil, Trash2, X, Plus, Check, Ban, RotateCcw,
    FileText, CheckCircle, Clock, Eye, AlertCircle, FileCheck, Printer, ClipboardList,
    ArrowLeft, ChevronRight, Info, Users
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import { formatDate } from '../../utils/datetime';
import { useAlert } from '../../context/AlertContext';
import '../../styles/nurse/RequirementManagement.css';

export const RequirementManagement = () => {
    const { nurseId } = useOutletContext() || {};
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('student');
    const [students, setStudents] = useState([]);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('default'); 
    const [courseFilter, setCourseFilter] = useState('all');
    const [sectionFilter, setSectionFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [requirementFilter, setRequirementFilter] = useState('all');

    // Masterlist Medical Requirements (medical_requirements Table)
    const [medicalRequirements, setMedicalRequirements] = useState([]);
    const [isMedReqModalOpen, setIsMedReqModalOpen] = useState(false);
    const [newMedReqName, setNewMedReqName] = useState('');
    const [editingMedReq, setEditingMedReq] = useState(null);

    const { showAlert, showConfirm } = useAlert();

    // Program Configuration States
    const [programs, setPrograms] = useState([]);
    const [programConfigs, setProgramConfigs] = useState([]);
    const [isNewMode, setIsNewMode] = useState({});
    const [openProgramId, setOpenProgramId] = useState(null); // null = overview of all programs
    const lastProgramRef = useRef(null);
    const backBtnRef = useRef(null);

    // Create requirement: one requirement, many programs, every year level and section
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', deadline: '', allowLate: false });
    const [createPrograms, setCreatePrograms] = useState([]);
    const [coverage, setCoverage] = useState({}); // program_id -> { students, already_have }

    // Inline inputs tracking per program configuration updates
    const [inlineEditingConfigId, setInlineEditingConfigId] = useState(null);
    const [inlineEditForm, setInlineEditForm] = useState({ 
        requirement_name: '', 
        year_level: '', 
        submission_deadline: '', 
        allow_late_submission: false 
    });

    // Active Modals Data Anchors
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentReqs, setStudentReqs] = useState([]);
    const [highlightedReqName, setHighlightedReqName] = useState(null);
    
    // Add Special Requirement context hooks
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newReqInput, setNewReqInput] = useState({ name: '', deadline: '', allowLate: false });

    // Nested Requirement Editor Configuration State
    const [editingReq, setEditingReq] = useState(null);

    // Every message is a modal (useAlert). `details` (cascade warning) is folded into the text.
    const openConfirmModal = async (title, message, onConfirm, confirmText = 'Confirm', type = 'primary', details = null) => {
        let text = message;
        if (details) {
            const parts = [];
            if (details.program_ids?.length) parts.push(`Programs: ${details.program_ids.join(', ')}`);
            if (details.submission_ids?.length) parts.push(`Submissions: ${details.submission_ids.length}`);
            if (details.service_ids?.length) parts.push(`Facility services: ${details.service_ids.length}`);
            if (parts.length) text = `${message} (${parts.join(' | ')})`;
        }
        const ok = await showConfirm(text, { danger: type === 'danger', confirmLabel: confirmText, title });
        if (ok && onConfirm) await onConfirm();
    };

    const showAlertModal = (title, message, type = 'primary') => {
        const variant = type === 'primary' ? 'success' : type;
        showAlert(message, variant, { title });
    };

    const parseJsonResponse = async (res) => {
        try {
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await res.json();
            }
        } catch (e) {
            console.error("JSON Parsing Error:", e);
        }
        return null;
    };

    const fetchStudents = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/students');
            if (res.ok) {
                const data = await parseJsonResponse(res);
                setStudents(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    }, []);

    const fetchPrograms = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/programs');
            if (res.ok) {
                const data = await parseJsonResponse(res);
                setPrograms(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error fetching programs:", error);
        }
    }, []);

    const fetchProgramConfigs = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/program-requirements-config');
            if (res.ok) {
                const data = await parseJsonResponse(res);
                setProgramConfigs(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error fetching program configs:", error);
        }
    }, []);

    const fetchMedicalRequirements = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/medical-requirements');
            if (res.ok) {
                const data = await parseJsonResponse(res);
                setMedicalRequirements(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error fetching medical requirements:", error);
        }
    }, []);

    const fetchStudentFullRequirements = useCallback(async (studentId) => {
        try {
            const encodedStudentId = encodeURIComponent(studentId);
            const res = await fetch(`http://localhost:3001/api/students/${encodedStudentId}/full-requirements`);
            const data = await parseJsonResponse(res);
            
            if (!res.ok || !data) {
                showAlertModal("Retrieve Error", data?.error || `Server error (${res.status}): Failed to retrieve student requirements. Account may be inactive.`, "error");
                setStudentReqs([]);
                return;
            }

            if (data.error) {
                showAlertModal("Backend Database Error", data.error, "error");
                setStudentReqs([]);
                return;
            }

            setStudentReqs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Network connectivity issue:", error);
            showAlertModal("Network Error", "Failed to connect to backend API service layer.", "error");
        }
    }, []);

    const handleDeepLink = useCallback(async (targetId, fallbackStudentId, fallbackReqName) => {
        const primaryId = targetId || fallbackStudentId;
        if (!primaryId) return;

        setActiveTab('student');

        let foundStudentId = null;
        let reqNameToHighlight = fallbackReqName || null;

        try {
            const encodedPrimaryId = encodeURIComponent(primaryId);
            const res = await fetch(`http://localhost:3001/api/submissions/${encodedPrimaryId}`);
            if (res.ok) {
                const data = await parseJsonResponse(res);
                if (data) {
                    const sub = data.submission || data.data || (data.student_id ? data : null);
                    
                    if (sub && sub.student_id) {
                        foundStudentId = sub.student_id;
                        if (sub.requirement_name) {
                            reqNameToHighlight = sub.requirement_name;
                        }
                        
                        const studentObj = {
                            student_id: sub.student_id,
                            first_name: sub.first_name || '',
                            last_name: sub.last_name || '',
                            program_id: sub.program_id || '',
                            year_level: sub.year_level || '',
                            section: sub.section || ''
                        };
                        setSelectedStudent(studentObj);
                        setHighlightedReqName(reqNameToHighlight);
                        fetchStudentFullRequirements(sub.student_id);
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn("Identifier resolution as submission_id failed:", err);
        }

        const targetStudentId = fallbackStudentId || foundStudentId || primaryId;
        if (targetStudentId) {
            try {
                const encodedTargetStudentId = encodeURIComponent(targetStudentId);
                const studentRes = await fetch(`http://localhost:3001/api/students/${encodedTargetStudentId}`);
                if (studentRes.ok) {
                    const studentData = await parseJsonResponse(studentRes);
                    if (studentData) {
                        const studentObj = studentData.student || studentData.data || (studentData.student_id ? studentData : null);
                        if (studentObj && studentObj.student_id) {
                            setSelectedStudent(studentObj);
                            setHighlightedReqName(reqNameToHighlight);
                            fetchStudentFullRequirements(studentObj.student_id);
                            return;
                        }
                    }
                }
            } catch (err) {
                console.warn("Direct student fetch failed, searching full student list...", err);
            }

            try {
                const res = await fetch('http://localhost:3001/api/students');
                if (res.ok) {
                    const studentList = await parseJsonResponse(res);
                    if (Array.isArray(studentList)) {
                        setStudents(studentList);
                        const matchedStudent = studentList.find(s => String(s.student_id) === String(targetStudentId));
                        
                        if (matchedStudent) {
                            setSelectedStudent(matchedStudent);
                            setHighlightedReqName(reqNameToHighlight);
                            fetchStudentFullRequirements(matchedStudent.student_id);
                        }
                    }
                }
            } catch (err) {
                console.error("Error processing student_id lookup during deep link:", err);
            }
        }
    }, [fetchStudentFullRequirements]);

    useEffect(() => {
        fetchStudents();
        fetchPrograms();
        fetchProgramConfigs();
        fetchMedicalRequirements();
    }, [fetchStudents, fetchPrograms, fetchProgramConfigs, fetchMedicalRequirements]);

    // Students per program + how many already hold the typed requirement (create modal)
    useEffect(() => {
        if (!createOpen) return undefined;
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`http://localhost:3001/api/program-requirements-coverage?requirement_name=${encodeURIComponent(createForm.name.trim())}`);
                const data = await parseJsonResponse(res);
                if (res.ok && Array.isArray(data)) {
                    setCoverage(Object.fromEntries(data.map(r => [String(r.program_id), r])));
                }
            } catch (error) {
                console.error("Error fetching coverage:", error);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [createOpen, createForm.name]);

    useEffect(() => {
        const state = location.state || {};
        const targetId = state.submissionId || state.submission_id || state.navigateId || state.navigate_id;
        const studentId = state.studentId || state.student_id;
        const reqName = state.reqName || state.requirement_name;

        if (targetId || studentId) {
            handleDeepLink(targetId, studentId, reqName);
        }
    }, [location.state, handleDeepLink]);

    const getYearLevelOptions = (program) => {
        const type = (program?.academic_program || program?.type || program?.program_type || '').toLowerCase();
        return type === 'strand' ? [1, 2] : [1, 2, 3, 4];
    };

    const selectedProgram = programs.find(p => String(p.program_id) === String(courseFilter));
    const isStrand = (selectedProgram?.academic_program || selectedProgram?.type || selectedProgram?.program_type || '').toLowerCase() === 'strand';
    const yearLevelOptions = getYearLevelOptions(selectedProgram);

    useEffect(() => {
        if (isStrand && Number(yearFilter) > 2) {
            setYearFilter('all');
        }
    }, [courseFilter, isStrand, yearFilter]);

    const availableSections = ['A', 'B', 'C'];

    const availableRequirements = useMemo(() => {
        return Array.from(
            new Set([
                ...medicalRequirements.map(m => m.requirement_name),
                ...programConfigs.map(c => c.requirement_name),
                ...students.flatMap(s => (s.requirements || s.requirements_list || []).map(r => r.requirement_name || r.name))
            ].filter(Boolean))
        ).sort();
    }, [medicalRequirements, programConfigs, students]);

    const handleExportAllReport = () => {
        const rowsToExport = filteredStudents.length > 0 ? filteredStudents : students;

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            showAlertModal("Print Error", "Please allow popups to preview and print the report.", "warning");
            return;
        }

        const reportDate = formatDate(new Date());

        // 1. Calculate Complete vs Incomplete student and requirement counts per Course/Strand
        const programCounts = rowsToExport.reduce((acc, student) => {
            const prog = student.program_id ? student.program_id.trim() : 'Unspecified';
            const stats = student.stats || {};
            const totalReqs = Number(stats.total || 0);
            const completedReqs = Number(stats.completed || 0);
            const incompleteReqs = totalReqs > completedReqs ? totalReqs - completedReqs : 0;

            const isStudentComplete = totalReqs > 0 && completedReqs === totalReqs;

            if (!acc[prog]) {
                acc[prog] = {
                    totalStudents: 0,
                    completeStudents: 0,
                    incompleteStudents: 0,
                    completedReqs: 0,
                    incompleteReqs: 0,
                    totalReqs: 0
                };
            }

            acc[prog].totalStudents += 1;
            if (isStudentComplete) {
                acc[prog].completeStudents += 1;
            } else {
                acc[prog].incompleteStudents += 1;
            }

            acc[prog].completedReqs += completedReqs;
            acc[prog].incompleteReqs += incompleteReqs;
            acc[prog].totalReqs += totalReqs;

            return acc;
        }, {});

        // 2. Generate HTML summary cards with complete & incomplete breakdowns
        const summaryItemsHtml = Object.keys(programCounts).length > 0
            ? Object.entries(programCounts).map(([prog, data]) => `
                <div class="summary-card">
                    <div class="summary-card-header">
                        <span class="summary-label">${prog}</span>
                        <span class="summary-total-badge">${data.totalStudents} Student${data.totalStudents > 1 ? 's' : ''}</span>
                    </div>
                    <div class="summary-breakdown">
                        <span class="status-pill complete-pill">✓ ${data.completeStudents} Complete</span>
                        <span class="status-pill incomplete-pill">⚠ ${data.incompleteStudents} Incomplete</span>
                    </div>
                    <div class="summary-req-meta">
                        <strong>Requirements:</strong> ${data.completedReqs} Complete / ${data.incompleteReqs} Incomplete (${data.totalReqs} Total)
                    </div>
                </div>
            `).join('')
            : '<span style="font-size: 12px; color: #64748b;">No course/strand records found in current selection.</span>';

        const tableRowsHtml = rowsToExport.map(s => {
            const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim();
            const programSec = `${s.program_id || ''} ${s.section ? `- ${s.section}` : ''}`.trim();
            const yearStr = s.year_level ? `${s.year_level}${Number(s.year_level) === 1 ? 'st' : Number(s.year_level) === 2 ? 'nd' : Number(s.year_level) === 3 ? 'rd' : 'th'} Year` : 'N/A';
            const stats = s.stats || {};
            const summaryStr = `${stats.completed || 0}/${stats.total || 0} Complete`;
            const statusDetail = Number(stats.total) > 0 && Number(stats.completed) === Number(stats.total) ? 'Complete' : 'Incomplete';

            return `
                <tr>
                    <td>${s.student_id || ''}</td>
                    <td><strong>${fullName}</strong></td>
                    <td>${programSec}</td>
                    <td>${yearStr}</td>
                    <td>${summaryStr}</td>
                    <td>${statusDetail}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>All Students Requirement Summary Report</title>
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
                    .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
                    .report-header img { height: 60px; margin-right: 20px; }
                    .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
                    .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 16px; font-weight: 500; }
                    
                    /* Course / Strand Summary Box Styling */
                    .summary-section {
                        background-color: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 12px 16px;
                        margin-bottom: 20px;
                    }
                    .summary-title {
                        font-size: 11px;
                        font-weight: bold;
                        color: #1e3a8a;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 10px;
                    }
                    .summary-grid {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .summary-card {
                        background-color: #ffffff;
                        border: 1px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 8px 12px;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        font-size: 12px;
                        min-width: 220px;
                    }
                    .summary-card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .summary-label {
                        color: #0f172a;
                        font-weight: 700;
                        font-size: 13px;
                    }
                    .summary-total-badge {
                        background-color: #e2e8f0;
                        color: #334155;
                        font-size: 11px;
                        font-weight: 600;
                        padding: 2px 8px;
                        border-radius: 10px;
                    }
                    .summary-breakdown {
                        display: flex;
                        gap: 6px;
                    }
                    .status-pill {
                        font-size: 11px;
                        font-weight: 600;
                        padding: 3px 8px;
                        border-radius: 4px;
                    }
                    .complete-pill {
                        background-color: #dcfce7;
                        color: #15803d;
                        border: 1px solid #86efac;
                    }
                    .incomplete-pill {
                        background-color: #fef3c7;
                        color: #b45309;
                        border: 1px solid #fde047;
                    }
                    .summary-req-meta {
                        font-size: 11px;
                        color: #64748b;
                        border-top: 1px dashed #e2e8f0;
                        padding-top: 4px;
                        margin-top: 2px;
                    }

                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 35px; }
                    th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
                    td { padding: 8px 10px; border: 1px solid #e2e8f0; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .signature-section { margin-top: 40px; font-size: 13px; }
                    .signature-title { color: #475569; margin-bottom: 35px; }
                    .signature-name { font-weight: bold; font-size: 14px; color: #0f172a; }
                    .signature-role { font-style: italic; color: #64748b; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <img src="${stiLogo}" alt="STI Logo" />
                    <div class="report-title">
                        <h2>STI COLLEGE BALIUAG</h2>
                        <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan</p>
                    </div>
                </div>
                <div class="meta-info">
                    <span><strong>STUDENT REQUIREMENTS SUMMARY REPORT</strong></span>
                    <span>Date Generated: ${reportDate} | Total Records: ${rowsToExport.length}</span>
                </div>
                <div class="summary-section">
                    <div class="summary-title">Course / Strand Requirement Compliance Summary</div>
                    <div class="summary-grid">
                        ${summaryItemsHtml}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Student Name</th>
                            <th>Course / Section</th>
                            <th>Year Level</th>
                            <th>Progress</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${tableRowsHtml || '<tr><td colspan="6">No student records found.</td></tr>'}</tbody>
                </table>
                <div class="signature-section">
                    <div class="signature-title">Prepared by:</div>
                    <div class="signature-name">Marilou H. Balarao</div>
                    <div class="signature-role">School Nurse</div>
                </div>
                <script>window.onload = function() { window.print(); };</script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleExportStudentReport = () => {
        if (!selectedStudent) return;

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            showAlertModal("Print Error", "Please allow popups to preview and print the report.", "warning");
            return;
        }

        const reportDate = formatDate(new Date());

        const studentName = `${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim();
        const yearLevelStr = selectedStudent.year_level ? `${selectedStudent.year_level}${Number(selectedStudent.year_level) === 1 ? 'st' : Number(selectedStudent.year_level) === 2 ? 'nd' : Number(selectedStudent.year_level) === 3 ? 'rd' : 'th'} Year` : 'N/A';

        const tableRowsHtml = studentReqs.map(req => {
            const normalizedStatus = req.status?.toLowerCase();
            const displayStatus = (normalizedStatus === 'submitted' || normalizedStatus === 'submitted late' || normalizedStatus === 'late')
                ? 'Waiting for approval' 
                : (normalizedStatus === 'not submitted' ? 'Missed' : (req.status || 'Pending'));
            const deadline = req.submission_deadline ? formatDate(req.submission_deadline) : 'N/A';
            const remarks = req.nurse_remarks || 'None';

            return `
                <tr>
                    <td><strong>${req.requirement_name || 'Unnamed Requirement'}</strong></td>
                    <td>${req.type || 'Standard'}</td>
                    <td>${deadline}</td>
                    <td>${displayStatus}</td>
                    <td>${remarks}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Individual Student Requirement Report - ${selectedStudent.student_id}</title>
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
                    .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
                    .report-header img { height: 60px; margin-right: 20px; }
                    .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
                    .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 16px; font-weight: 500; }
                    .student-card { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 35px; }
                    th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
                    td { padding: 8px 10px; border: 1px solid #e2e8f0; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .signature-section { margin-top: 40px; font-size: 13px; }
                    .signature-title { color: #475569; margin-bottom: 35px; }
                    .signature-name { font-weight: bold; font-size: 14px; color: #0f172a; }
                    .signature-role { font-style: italic; color: #64748b; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <img src="${stiLogo}" alt="STI Logo" />
                    <div class="report-title">
                        <h2>STI COLLEGE BALIUAG</h2>
                        <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan</p>
                    </div>
                </div>
                <div class="meta-info">
                    <span><strong>INDIVIDUAL STUDENT REQUIREMENT REPORT</strong></span>
                    <span>Date Generated: ${reportDate}</span>
                </div>
                <div class="student-card">
                    <div><strong>Student Name:</strong> ${studentName}</div>
                    <div><strong>Student ID:</strong> ${selectedStudent.student_id || 'N/A'}</div>
                    <div><strong>Course / Section:</strong> ${selectedStudent.program_id || 'N/A'} ${selectedStudent.section ? `- ${selectedStudent.section}` : ''}</div>
                    <div><strong>Year Level:</strong> ${yearLevelStr}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Requirement Name</th>
                            <th>Type</th>
                            <th>Deadline</th>
                            <th>Status</th>
                            <th>Nurse Remarks</th>
                        </tr>
                    </thead>
                    <tbody>${tableRowsHtml || '<tr><td colspan="5">No requirements assigned to this student.</td></tr>'}</tbody>
                </table>
                <div class="signature-section">
                    <div class="signature-title">Prepared by:</div>
                    <div class="signature-name">Marilou H. Balarao</div>
                    <div class="signature-role">School Nurse</div>
                </div>
                <script>window.onload = function() { window.print(); };</script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleAddMedicalRequirement = async () => {
        const trimmed = newMedReqName.trim();
        if (!trimmed) {
            showAlertModal("Validation Error", "Name is required.", "warning");
            return;
        }

        const exists = medicalRequirements.some(
            req => req.requirement_name.toLowerCase() === trimmed.toLowerCase()
        );

        if (exists) {
            showAlertModal("Duplicate Error", `"${trimmed}" already exists.`, "error");
            return;
        }

        openConfirmModal(
            "Add Medical Requirement",
            `Add "${trimmed}" to the medical requirements masterlist? This will automatically add it as a service under "Others" in partner facility services.`,
            async () => {
                try {
                    const response = await fetch('http://localhost:3001/api/medical-requirements', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requirement_name: trimmed })
                    });

                    const data = await parseJsonResponse(response);

                    if (!response.ok || !data || !data.success) {
                        showAlertModal("Add Error", data?.error || `Server Error (${response.status}): Failed to add medical requirement.`, "error");
                        return;
                    }

                    setNewMedReqName('');
                    fetchMedicalRequirements();
                    showAlertModal("Success", `"${trimmed}" added.`, "primary");
                } catch (error) {
                    console.error("Error adding medical requirement:", error);
                    showAlertModal("Network Error", "Could not add the requirement.", "error");
                }
            },
            "Add Requirement",
            "primary"
        );
    };

    const handleUpdateMedicalRequirement = async (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) {
            showAlertModal("Validation Error", "Requirement name cannot be empty.", "warning");
            return;
        }

        if (trimmed.toLowerCase() !== oldName.toLowerCase()) {
            const exists = medicalRequirements.some(
                req => req.requirement_name.toLowerCase() === trimmed.toLowerCase()
            );
            if (exists) {
                showAlertModal("Duplicate Error", `Requirement "${trimmed}" already exists.`, "error");
                return;
            }
        }

        openConfirmModal(
            "Update Medical Requirement",
            `Rename medical requirement "${oldName}" to "${trimmed}" across all system configurations (including Program Requirements Config, Student Submissions, and Partner Facility Services)?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/medical-requirements/${encodeURIComponent(oldName)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requirement_name: trimmed })
                    });

                    const data = await parseJsonResponse(response);
                    if (!response.ok || !data || !data.success) {
                        showAlertModal("Update Error", data?.error || `Server Error (${response.status}): Failed to update requirement.`, "error");
                        return;
                    }

                    setEditingMedReq(null);
                    fetchMedicalRequirements();
                    fetchProgramConfigs();
                    fetchStudents();
                    showAlertModal("Success", `Requirement renamed to "${trimmed}" successfully.`, "primary");
                } catch (error) {
                    console.error("Error updating medical requirement:", error);
                    showAlertModal("Network Error", "Network error updating requirement.", "error");
                }
            },
            "Save Changes",
            "primary"
        );
    };

    const executeDeleteMedicalRequirement = async (reqName, confirmCascade = false) => {
        try {
            const url = `http://localhost:3001/api/medical-requirements/${encodeURIComponent(reqName)}${confirmCascade ? '?confirmCascade=true' : ''}`;
            const response = await fetch(url, { method: 'DELETE' });
            const data = await parseJsonResponse(response);

            if (!response.ok) {
                showAlertModal("Delete Error", data?.error || `Server Error (${response.status}): Failed to delete requirement.`, "error");
                return;
            }

            if (data.requiresConfirmation) {
                const { connections } = data;
                const details = {
                    program_ids: connections.program_ids || [],
                    submission_ids: connections.submission_ids || [],
                    service_ids: connections.service_ids || []
                };

                openConfirmModal(
                    "Warning: Connected Records Found",
                    `Requirement "${reqName}" is currently connected to existing records in other tables. Deleting it will permanently remove all connected entries from program configurations, student submissions, and facility services. Do you wish to confirm deleting all connected records?`,
                    () => executeDeleteMedicalRequirement(reqName, true),
                    "Confirm Delete All Connected",
                    "danger",
                    details
                );
                return;
            }

            fetchMedicalRequirements();
            fetchProgramConfigs();
            fetchStudents();
            showAlertModal("Success", `Medical requirement "${reqName}" deleted successfully.`, "primary");
        } catch (error) {
            console.error("Error deleting medical requirement:", error);
            showAlertModal("Network Error", "Network error deleting requirement.", "error");
        }
    };

    const handleDeleteMedicalRequirement = (reqName) => {
        executeDeleteMedicalRequirement(reqName, false);
    };

    const formatDeadlineDate = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    const handleManageStudent = async (student) => {
        setSelectedStudent(student);
        setHighlightedReqName(null);
        fetchStudentFullRequirements(student.student_id);
    };

    const handleAddSpecialRequirement = async () => {
        if (!newReqInput.name || !newReqInput.deadline) {
            showAlertModal("Validation Error", "Requirement Name and Deadline are required.", "warning");
            return;
        }

        openConfirmModal(
            "Assign Special Requirement",
            `Assign special requirement "${newReqInput.name.trim()}" to ${selectedStudent.first_name} ${selectedStudent.last_name}?`,
            async () => {
                try {
                    const encodedStudentId = encodeURIComponent(selectedStudent.student_id);
                    const response = await fetch(`http://localhost:3001/api/students/${encodedStudentId}/special-requirements`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            requirement_name: newReqInput.name.trim(),
                            submission_deadline: newReqInput.deadline,
                            allow_late_submission: newReqInput.allowLate,
                            nurse_id: nurseId || 'UNKNOWN_NURSE'
                        })
                    });
                    
                    const data = await parseJsonResponse(response);
                    
                    if (!response.ok || !data || !data.success) {
                        showAlertModal("Assignment Error", data?.error || `Server error (${response.status}): Failed to assign requirement. Student account may be inactive.`, "error");
                        return;
                    }
                    
                    setNewReqInput({ name: '', deadline: '', allowLate: false });
                    setIsAddModalOpen(false);
                    
                    fetchStudentFullRequirements(selectedStudent.student_id);
                    fetchStudents();
                    fetchMedicalRequirements();
                    showAlertModal("Success", "Special requirement assigned and push notification delivered.", "primary");
                } catch (error) {
                    console.error("Error adding special requirement:", error);
                    showAlertModal("Network Failure", "Could not reach target API server gateway.", "error");
                }
            },
            "Assign Requirement",
            "primary"
        );
    };

    const handleUpdateRequirement = async (studentId, reqName, updatePayload) => {
        if (!studentId || studentId === 'undefined' || studentId === '') {
            showAlertModal("Error", "Cannot update. The app lost track of this student's reference ID.", "error");
            return;
        }

        openConfirmModal(
            "Save Requirement Parameter Updates",
            `Apply changes to requirement "${reqName}" for this student profile?`,
            async () => {
                try {
                    const encodedStudentId = encodeURIComponent(studentId);
                    const encodedReqName = encodeURIComponent(reqName);
                    const response = await fetch(`http://localhost:3001/api/students/${encodedStudentId}/requirements/${encodedReqName}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...updatePayload,
                            nurse_id: nurseId || 'UNKNOWN_NURSE'
                        }),
                    });

                    const data = await parseJsonResponse(response);
                    if (!response.ok || !data || !data.success) {
                        showAlertModal("Update Failed", `Failed to update: ${data?.error || `Server error ${response.status}`}`, "error");
                    } else {
                        setEditingReq(null);
                        fetchStudentFullRequirements(studentId);
                        fetchStudents();
                        showAlertModal("Success", "Requirement parameters updated successfully.", "primary");
                    }
                } catch (error) {
                    console.error("Networking payload exception:", error);
                    showAlertModal("Network Error", "Network error processing update request.", "error");
                }
            },
            "Save",
            "primary"
        );
    };

    const handleDeleteSpecialRequirement = (reqName) => {
        openConfirmModal(
            "Delete Special Requirement",
            `Remove special requirement "${reqName}" for ${selectedStudent.first_name} ${selectedStudent.last_name}?`,
            async () => {
                try {
                    const encodedStudentId = encodeURIComponent(selectedStudent.student_id);
                    const encodedReqName = encodeURIComponent(reqName);
                    await fetch(`http://localhost:3001/api/students/${encodedStudentId}/special-requirements/${encodedReqName}`, {
                        method: 'DELETE'
                    });
                    fetchStudentFullRequirements(selectedStudent.student_id);
                    fetchStudents();
                    showAlertModal("Success", "Special requirement removed successfully.", "primary");
                } catch (error) {
                    console.error("Error deleting special requirement:", error);
                    showAlertModal("Delete Error", "Failed to delete special requirement.", "error");
                }
            },
            "Delete",
            "danger"
        );
    };

    const isProgramSet = (programId, name) => !!name && programConfigs.some(
        c => String(c.program_id) === String(programId) && c.requirement_name.toLowerCase() === name.toLowerCase()
    );

    const openCreateModal = (programId = null) => {
        setCreateForm({ name: '', deadline: '', allowLate: false });
        setCreatePrograms(programId ? [String(programId)] : []);
        setCreateOpen(true);
    };

    // One requirement, many programs. No year level, no section: every active student of
    // the program gets it, except the ones who already hold it (the server skips them).
    const createRequirements = async () => {
        const name = createForm.name.trim();
        if (!name || !createForm.deadline) {
            showAlertModal("Validation Error", "Add a requirement name and deadline.", "warning");
            return;
        }

        const targets = createPrograms.filter(id => !isProgramSet(id, name));
        if (targets.length === 0) {
            showAlertModal("Validation Error", "Pick at least one program.", "warning");
            return;
        }

        const known = medicalRequirements.find(m => m.requirement_name.toLowerCase() === name.toLowerCase());
        const finalName = known ? known.requirement_name : name;

        setCreating(true);
        let assigned = 0;
        let alreadyHad = 0;
        const failed = [];

        for (const programId of targets) {
            try {
                const response = await fetch(`http://localhost:3001/api/programs/${encodeURIComponent(programId)}/requirements`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirement_name: finalName,
                        submission_deadline: createForm.deadline,
                        allow_late_submission: createForm.allowLate,
                        nurse_id: nurseId
                    })
                });
                const data = await parseJsonResponse(response);
                if (!response.ok || !data) {
                    failed.push(programId);
                } else {
                    assigned += Number(data.assigned || 0);
                    alreadyHad += Number(data.already_had || 0);
                }
            } catch (error) {
                console.error("Error adding program requirement:", error);
                failed.push(programId);
            }
        }

        setCreating(false);
        setCreateOpen(false);
        await fetchProgramConfigs();
        fetchMedicalRequirements();
        fetchStudents();

        const summary = `${assigned} students assigned.${alreadyHad ? ` ${alreadyHad} already had it.` : ''}`;
        if (failed.length > 0) {
            showAlertModal("Partly done", `${summary} Failed: ${failed.join(', ')}.`, "warning");
        } else {
            showAlertModal("Success", summary, "primary");
        }
    };

    const startInlineEditingConfig = (configRow) => {
        setInlineEditingConfigId(configRow.config_id);
        setInlineEditForm({
            requirement_name: configRow.requirement_name,
            year_level: configRow.year_level || '',
            submission_deadline: formatDeadlineDate(configRow.submission_deadline),
            allow_late_submission: configRow.allow_late_submission === 1 || configRow.allow_late_submission === true
        });
    };

    const saveInlineRequirementUpdate = async (programId, configId) => {
        if (!inlineEditForm.requirement_name.trim() || !inlineEditForm.submission_deadline) {
            showAlertModal("Validation Error", "Requirement name and target deadline cannot be blank.", "warning");
            return;
        }

        const clash = programConfigs.some(c =>
            String(c.program_id) === String(programId) &&
            String(c.config_id) !== String(configId) &&
            c.requirement_name.toLowerCase() === inlineEditForm.requirement_name.trim().toLowerCase()
        );
        if (clash) {
            showAlertModal("Duplicate Error", `"${inlineEditForm.requirement_name.trim()}" is already set for this program.`, "error");
            return;
        }

        openConfirmModal(
            "Save Configuration Changes",
            `Update settings for "${inlineEditForm.requirement_name.trim()}" in this program track?`,
            async () => {
                try {
                    const encodedProgramId = encodeURIComponent(programId);
                    const encodedConfigId = encodeURIComponent(configId);
                    const response = await fetch(`http://localhost:3001/api/programs/${encodedProgramId}/requirements/${encodedConfigId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            requirement_name: inlineEditForm.requirement_name,
                            year_level: inlineEditForm.year_level,
                            submission_deadline: inlineEditForm.submission_deadline,
                            allow_late_submission: inlineEditForm.allow_late_submission
                        })
                    });

                    const data = await parseJsonResponse(response);

                    if (response.ok) {
                        setInlineEditingConfigId(null);
                        await fetchProgramConfigs();
                        showAlertModal("Success", "Program configuration updated.", "primary");
                    } else {
                        showAlertModal("Save Error", data?.error || `Failed to save changes (Server Status: ${response.status}).`, "error");
                    }
                } catch (err) {
                    console.error("Failed saving adjustment changes:", err);
                    showAlertModal("Network Error", "Network error processing request.", "error");
                }
            },
            "Save",
            "primary"
        );
    };

    const deleteProgramRequirement = (programId, configId, reqName) => {
        openConfirmModal(
            "Delete Program Requirement",
            `Permanently delete "${reqName}" from this program track?`,
            async () => {
                try {
                    const encodedProgramId = encodeURIComponent(programId);
                    const encodedConfigId = encodeURIComponent(configId);
                    const response = await fetch(`http://localhost:3001/api/programs/${encodedProgramId}/requirements/${encodedConfigId}`, {
                        method: 'DELETE'
                    });
                    const data = await parseJsonResponse(response);
                    if (!response.ok) {
                        showAlertModal("Delete Error", data?.error || `Failed to delete requirement (Server Status: ${response.status}).`, "error");
                        return;
                    }
                    await fetchProgramConfigs();
                    showAlertModal("Success", "Program requirement rule removed.", "primary");
                } catch (error) {
                    console.error("Error deleting program requirement:", error);
                    showAlertModal("Network Error", "Network error deleting requirement.", "error");
                }
            },
            "Delete",
            "danger"
        );
    };

    const calculateOverdueDays = (deadline, submittedAt, status) => {
        if (!deadline) return null;
        const normalizedStatus = status ? status.toLowerCase() : '';
        
        if (['submitted', 'waiting for approval', 'completed', 'submitted late', 'late'].includes(normalizedStatus)) return null;
        
        const deadlineDate = new Date(deadline);
        const today = new Date();
        deadlineDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);

        const diffTime = today - deadlineDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : null;
    };

    const getStatusStyle = (status) => {
        const s = status?.toLowerCase();
        switch (s) {
            case 'completed':
                return { color: 'var(--status-adequate-text)', backgroundColor: 'var(--status-adequate-bg)' };
            case 'submitted':
            case 'waiting for approval':
            case 'late':
            case 'submitted late':
                return { color: 'var(--text-brand)', backgroundColor: 'var(--sti-blue-light)' };
            case 'rejected':
                return { color: 'var(--status-critical-text)', backgroundColor: 'var(--status-critical-bg)' };
            case 'missed':
            case 'not submitted':
                return { color: 'var(--text-primary)', backgroundColor: 'var(--bg-muted)' };
            case 'pending':
            default:
                return { color: 'var(--status-low-text)', backgroundColor: 'var(--status-low-bg)' };
        }
    };

    const filteredStudents = useMemo(() => {
        return students
            .filter(student => {
                const term = searchTerm.toLowerCase();
                const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
                const matchesSearch = 
                    fullName.includes(term) || 
                    student.student_id?.toLowerCase().includes(term) ||
                    student.program_id?.toLowerCase().includes(term) ||
                    (student.section && student.section.toLowerCase().includes(term));

                if (!matchesSearch) return false;

                if (courseFilter !== 'all' && String(student.program_id) !== String(courseFilter)) return false;
                if (sectionFilter !== 'all' && String(student.section) !== String(sectionFilter)) return false;
                if (yearFilter !== 'all' && String(student.year_level) !== String(yearFilter)) return false;

                if (requirementFilter !== 'all') {
                    const hasInStudentReqs = Array.isArray(student.requirements) && 
                        student.requirements.some(r => (r.requirement_name || r.name) === requirementFilter);
                    
                    const hasInProgramConfigs = programConfigs.some(
                        c => String(c.program_id) === String(student.program_id) && 
                             c.requirement_name === requirementFilter &&
                             (!c.year_level || String(c.year_level) === String(student.year_level))
                    );

                    if (!hasInStudentReqs && !hasInProgramConfigs) return false;
                }

                const stats = student.stats || {};
                const total = Number(stats.total || 0);
                const completed = Number(stats.completed || 0);

                const isComplete = total > 0 && completed === total;
                const isIncomplete = total > 0 && completed < total;
                const hasWaiting = Number(stats.submitted || 0) > 0 || Number(stats.late || 0) > 0 || Number(stats.waiting || 0) > 0;

                if (statusFilter === 'default') {
                    if (!hasWaiting && !isIncomplete) return false;
                } else if (statusFilter === 'waiting') {
                    if (!hasWaiting) return false;
                } else if (statusFilter === 'incomplete') {
                    if (!isIncomplete) return false;
                } else if (statusFilter === 'complete') {
                    if (!isComplete) return false;
                } else if (statusFilter === 'rejected') {
                    if (!(Number(stats.rejected) > 0)) return false;
                } else if (statusFilter === 'missed') {
                    if (!(Number(stats.noSubmission) > 0 || Number(stats.notSubmitted) > 0)) return false;
                } else if (statusFilter === 'resubmit') {
                    if (!(Number(stats.resubmit) > 0)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const aStats = a.stats || {};
                const bStats = b.stats || {};

                const aWaiting = (Number(aStats.submitted || 0) > 0 || Number(aStats.late || 0) > 0 || Number(aStats.waiting || 0) > 0) ? 1 : 0;
                const bWaiting = (Number(bStats.submitted || 0) > 0 || Number(bStats.late || 0) > 0 || Number(bStats.waiting || 0) > 0) ? 1 : 0;

                if (aWaiting !== bWaiting) return bWaiting - aWaiting;

                const aComplete = (Number(aStats.total || 0) > 0 && Number(aStats.completed) === Number(aStats.total)) ? 1 : 0;
                const bComplete = (Number(bStats.total || 0) > 0 && Number(bStats.completed) === Number(bStats.total)) ? 1 : 0;

                return aComplete - bComplete;
            });
    }, [students, searchTerm, courseFilter, sectionFilter, yearFilter, requirementFilter, statusFilter, programConfigs]);

    const { submittedRequirementsCount, completeStudentsCount, incompleteStudentsCount } = useMemo(() => {
        let submitted = 0;
        let complete = 0;
        let incomplete = 0;

        students.forEach(s => {
            const stats = s.stats || {};
            const total = Number(stats.total || 0);
            const completed = Number(stats.completed || 0);

            if (Number(stats.submitted || 0) > 0 || Number(stats.late || 0) > 0 || Number(stats.waiting || 0) > 0) {
                submitted++;
            }
            if (total > 0 && completed === total) {
                complete++;
            }
            if (total > 0 && completed < total) {
                incomplete++;
            }
        });

        return {
            submittedRequirementsCount: submitted,
            completeStudentsCount: complete,
            incompleteStudentsCount: incomplete
        };
    }, [students]);

    // ---- Course / Strand tab helpers ----
    const programTypeLabel = (p) => (getYearLevelOptions(p).length === 2 ? 'Strand' : 'Course');
    const programStudentCount = (id) => students.filter(s => String(s.program_id) === String(id)).length;
    const nextDueOf = (list) => {
        const today = new Date().toISOString().split('T')[0];
        const upcoming = list.map(c => formatDeadlineDate(c.submission_deadline)).filter(d => d && d >= today).sort();
        return upcoming[0] || null;
    };

    const openProgram = programs.find(p => String(p.program_id) === String(openProgramId)) || null;
    const openList = openProgram ? programConfigs.filter(c => String(c.program_id) === String(openProgram.program_id)) : [];
    const openEditing = !!isNewMode[openProgramId];

    // Create modal: one row per program with the students it would reach
    const createName = createForm.name.trim();
    const programRows = programs.map(p => {
        const id = String(p.program_id);
        const total = coverage[id]?.students ?? programStudentCount(id);
        const have = createName ? Number(coverage[id]?.already_have || 0) : 0;
        return { p, id, set: isProgramSet(id, createName), have, eligible: Math.max(total - have, 0) };
    });
    const selectableRows = programRows.filter(r => !r.set);
    const pickedRows = selectableRows.filter(r => createPrograms.includes(r.id));
    const previewTotal = pickedRows.reduce((sum, r) => sum + r.eligible, 0);
    const previewSkipped = pickedRows.reduce((sum, r) => sum + r.have, 0);
    const allCreateSelected = selectableRows.length > 0 && selectableRows.every(r => createPrograms.includes(r.id));

    useEffect(() => {
        if (openProgramId) {
            if (backBtnRef.current) backBtnRef.current.focus();
        } else if (lastProgramRef.current) {
            const opener = document.querySelector(`[data-open-program="${lastProgramRef.current}"]`);
            if (opener) opener.focus();
            lastProgramRef.current = null;
        }
    }, [openProgramId]);

    return (
        <div className="req-container-rm">
            <div className="req-header-section-rm">
                <h2>Requirement Management</h2>
                <div className="req-header-actions-rm">
                    <button
                        type="button"
                        className="btn-rm btn-icon-rm"
                        onClick={handleExportAllReport}
                        aria-label="Export report"
                        title="Export report"
                    >
                        <Printer size={20} />
                    </button>
                    <button
                        type="button"
                        className="btn-rm btn-icon-rm"
                        onClick={() => setIsMedReqModalOpen(true)}
                        aria-label="Manage medical requirements"
                        title="Manage medical requirements"
                    >
                        <ClipboardList size={20} />
                    </button>
                </div>
            </div>

            <div className="tabs-rm" role="tablist" aria-label="Requirement views">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'student'}
                    className={`tab-btn-rm ${activeTab === 'student' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('student'); setOpenProgramId(null); }}
                >
                    Student Requirements
                    <span className="tab-count-rm">{students.length}</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'course'}
                    className={`tab-btn-rm ${activeTab === 'course' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('course'); }}
                >
                    Course / Strand Requirements
                    <span className="tab-count-rm">{programs.length}</span>
                </button>
            </div>

            {/* VIEW: MAIN STUDENT MATRIX */}
            {activeTab === 'student' && (
                <div className="tab-content-rm">
                    <div className="dashboard-summary-cards-rm">
                        <button
                            type="button"
                            className={`summary-card-rm ${statusFilter === 'waiting' ? 'active-card-filter-rm' : ''}`}
                            aria-pressed={statusFilter === 'waiting'}
                            onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'default' : 'waiting')}
                            title="Filter: waiting"
                        >
                            <span className="summary-badge-rm tone-blue-rm"><Clock size={20} /></span>
                            <span>
                                <span className="summary-card-number-rm">{submittedRequirementsCount}</span>
                                <span className="summary-card-label-rm">Waiting</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`summary-card-rm ${statusFilter === 'incomplete' ? 'active-card-filter-rm' : ''}`}
                            aria-pressed={statusFilter === 'incomplete'}
                            onClick={() => setStatusFilter(statusFilter === 'incomplete' ? 'default' : 'incomplete')}
                            title="Filter: incomplete"
                        >
                            <span className="summary-badge-rm tone-amber-rm"><AlertCircle size={20} /></span>
                            <span>
                                <span className="summary-card-number-rm">{incompleteStudentsCount}</span>
                                <span className="summary-card-label-rm">Incomplete</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`summary-card-rm ${statusFilter === 'complete' ? 'active-card-filter-rm' : ''}`}
                            aria-pressed={statusFilter === 'complete'}
                            onClick={() => setStatusFilter(statusFilter === 'complete' ? 'default' : 'complete')}
                            title="Filter: complete"
                        >
                            <span className="summary-badge-rm tone-green-rm"><CheckCircle size={20} /></span>
                            <span>
                                <span className="summary-card-number-rm">{completeStudentsCount}</span>
                                <span className="summary-card-label-rm">Complete</span>
                            </span>
                        </button>
                    </div>

                    <div className="filter-toolbar-rm">
                        <div className="filter-item-rm filter-item-search-rm">
                            <label className="filter-label-rm" htmlFor="rm-search">Search</label>
                            <div className="search-wrapper-rm">
                                <Search className="search-icon-rm" size={18} />
                                <input
                                    id="rm-search"
                                    type="search"
                                    placeholder="Name, ID, section"
                                    className="search-bar-rm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="filter-grid-rm">
                            <div className="filter-item-rm">
                                <label className="filter-label-rm" htmlFor="rm-course">Course / Strand</label>
                                <select
                                    id="rm-course"
                                    value={courseFilter}
                                    onChange={(e) => setCourseFilter(e.target.value)}
                                    className="filter-select-rm"
                                >
                                    <option value="all">All Courses / Strands</option>
                                    {programs.map(p => (
                                        <option key={p.program_id} value={p.program_id}>
                                            {p.program_name || p.program_id}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-item-rm">
                                <label className="filter-label-rm" htmlFor="rm-year">Year Level</label>
                                <select
                                    id="rm-year"
                                    value={yearFilter}
                                    onChange={(e) => setYearFilter(e.target.value)}
                                    className="filter-select-rm"
                                >
                                    <option value="all">All Year Levels</option>
                                    {yearLevelOptions.map(y => (
                                        <option key={y} value={y}>
                                            {y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-item-rm">
                                <label className="filter-label-rm" htmlFor="rm-section">Section</label>
                                <select
                                    id="rm-section"
                                    value={sectionFilter}
                                    onChange={(e) => setSectionFilter(e.target.value)}
                                    className="filter-select-rm"
                                >
                                    <option value="all">All Sections</option>
                                    {availableSections.map(sec => (
                                        <option key={sec} value={sec}>
                                            {sec}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-item-rm">
                                <label className="filter-label-rm" htmlFor="rm-requirement">Requirement</label>
                                <select
                                    id="rm-requirement"
                                    value={requirementFilter}
                                    onChange={(e) => setRequirementFilter(e.target.value)}
                                    className="filter-select-rm"
                                >
                                    <option value="all">All Requirements</option>
                                    {availableRequirements.map(req => (
                                        <option key={req} value={req}>
                                            {req}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-item-rm">
                                <label className="filter-label-rm" htmlFor="rm-status">Status</label>
                                <select
                                    id="rm-status"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="filter-select-rm"
                                >
                                    <option value="default">Needs attention</option>
                                    <option value="all">All</option>
                                    <option value="waiting">Waiting</option>
                                    <option value="incomplete">Incomplete</option>
                                    <option value="complete">Complete</option>
                                    <option value="missed">Missed</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="resubmit">Resubmit</option>
                                </select>
                            </div>

                            {(courseFilter !== 'all' || sectionFilter !== 'all' || yearFilter !== 'all' || requirementFilter !== 'all' || statusFilter !== 'default' || searchTerm !== '') && (
                                <div className="filter-item-rm filter-reset-action-rm">
                                    <button
                                        type="button"
                                        aria-label="Reset filters"
                                        title="Reset filters"
                                        onClick={() => {
                                            setCourseFilter('all');
                                            setSectionFilter('all');
                                            setYearFilter('all');
                                            setRequirementFilter('all');
                                            setStatusFilter('default');
                                            setSearchTerm('');
                                        }}
                                        className="btn-rm btn-icon-rm"
                                    >
                                        <RotateCcw size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="table-responsive-rm">
                        <table className="data-table-rm">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Course/Section/Year</th>
                                    <th>Requirements Overview</th>
                                    <th className="text-center-rm">View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map(student => (
                                        <tr key={student.student_id}>
                                            <td>
                                                <div className="student-info-cell-rm">
                                                    <span className="student-name-rm">{student.first_name} {student.last_name}</span>
                                                    <span className="student-id-rm">{student.student_id}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <b>{student.program_id}</b>
                                                {student.section && <span className="text-muted-rm"> - {student.section}</span>}<br/> 
                                                <small className="text-muted-rm">
                                                    {student.year_level}{Number(student.year_level) === 1 ? 'st' : Number(student.year_level) === 2 ? 'nd' : Number(student.year_level) === 3 ? 'rd' : 'th'} Year
                                                </small>
                                            </td>
                                            <td>
                                                {student.stats && (
                                                    <div className="stats-overview-rm">
                                                        {Number(student.stats.total) === 0 ? (
                                                            <span className="text-muted-rm">No requirements (0/0)</span>
                                                        ) : (
                                                            <div className="progress-row-rm">
                                                                <div
                                                                    className={`progress-bar-rm ${Number(student.stats.completed) === Number(student.stats.total) ? 'is-complete-rm' : ''}`}
                                                                    role="img"
                                                                    aria-label={`${Math.round((Number(student.stats.completed) / Number(student.stats.total)) * 100)}% complete`}
                                                                >
                                                                    <i style={{ width: `${Math.round((Number(student.stats.completed) / Number(student.stats.total)) * 100)}%` }} />
                                                                </div>
                                                                <span className="progress-label-rm">
                                                                    {student.stats.completed}/{student.stats.total}{' '}
                                                                    {Number(student.stats.completed) === Number(student.stats.total) ? 'Complete' : 'Incomplete'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="status-tags-container-rm">
                                                            {(Number(student.stats.waiting || 0) > 0 || (Number(student.stats.submitted || 0) + Number(student.stats.late || 0)) > 0) && (
                                                                <span className="status-tag-chip-rm chip-waiting-rm">
                                                                    <Clock size={12}/>
                                                                    {student.stats.waiting ?? (Number(student.stats.submitted || 0) + Number(student.stats.late || 0))} Waiting
                                                                </span>
                                                            )}
                                                            {student.stats.resubmit > 0 && (
                                                                <span className="status-tag-chip-rm chip-resubmit-rm">{student.stats.resubmit} Resubmit</span>
                                                            )}
                                                            {student.stats.rejected > 0 && (
                                                                <span className="status-tag-chip-rm chip-rejected-rm">{student.stats.rejected} Rejected</span>
                                                            )}
                                                            {(Number(student.stats.noSubmission) > 0 || Number(student.stats.notSubmitted) > 0) && (
                                                                <span className="status-tag-chip-rm chip-missing-rm">
                                                                    <AlertCircle size={12}/>
                                                                    {student.stats.noSubmission || student.stats.notSubmitted} Missed
                                                                </span>
                                                            )}
                                                            {Number(student.stats.pending) > 0 && (
                                                                <span className="status-tag-chip-rm chip-pending-rm">{student.stats.pending} Pending</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-center-rm">
                                                <button
                                                    type="button"
                                                    onClick={() => handleManageStudent(student)}
                                                    className="btn-rm btn-icon-rm"
                                                    title={`Manage ${student.first_name} ${student.last_name}`}
                                                    aria-label={`Manage ${student.first_name} ${student.last_name}`}
                                                >
                                                    <Eye size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="empty-table-cell-rm">
                                            No match
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW: COURSE / STRAND - overview first, requirements open per program */}
            {activeTab === 'course' && !openProgram && (
                <div className="tab-content-rm">
                    <div className="bar-row-rm">
                        <p className="text-muted-rm"><b>{programConfigs.length}</b> requirements · <b>{programs.length}</b> programs</p>
                        <button
                            type="button"
                            className="btn-rm btn-icon-rm btn-primary-rm"
                            onClick={() => openCreateModal()}
                            aria-label="Create requirement"
                            title="Create requirement"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="course-grid-rm">
                        {programs.map(prog => {
                            const progId = String(prog.program_id);
                            const list = programConfigs.filter(c => String(c.program_id) === progId);
                            const due = nextDueOf(list);

                            return (
                                <article className="program-card-rm" key={progId} aria-label={prog.program_name}>
                                    <div className="program-header-rm">
                                        <span className="program-id-rm">{progId}</span>
                                        <div className="program-title-rm">
                                            <h3>{prog.program_name}</h3>
                                            <p>{programTypeLabel(prog)} · {getYearLevelOptions(prog).length} yrs</p>
                                        </div>
                                        <div className="program-actions-rm">
                                            <button
                                                type="button"
                                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                                onClick={() => openCreateModal(progId)}
                                                aria-label={`Create requirement for ${progId}`}
                                                title={`Create requirement for ${progId}`}
                                            >
                                                <Plus size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                                data-open-program={progId}
                                                onClick={() => setOpenProgramId(progId)}
                                                aria-label={`View ${progId} requirements`}
                                                title={`View ${progId} requirements`}
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <dl className="overview-rm">
                                        <div><dt><FileCheck size={16} />Requirements</dt><dd>{list.length}</dd></div>
                                        <div><dt><Users size={16} />Students</dt><dd>{programStudentCount(progId)}</dd></div>
                                        <div><dt><Calendar size={16} />Next due</dt><dd>{due ? formatDate(due) : '-'}</dd></div>
                                    </dl>
                                </article>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'course' && openProgram && (
                <div className="tab-content-rm">
                    <div className="detail-head-rm">
                        <button
                            ref={backBtnRef}
                            type="button"
                            className="btn-rm btn-icon-rm"
                            onClick={() => {
                                lastProgramRef.current = openProgramId;
                                setInlineEditingConfigId(null);
                                setOpenProgramId(null);
                            }}
                            aria-label="Back to programs"
                            title="Back to programs"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <span className="program-id-rm">{String(openProgram.program_id)}</span>
                        <div className="program-title-rm">
                            <h3>{openProgram.program_name}</h3>
                            <p>{programTypeLabel(openProgram)} · {programStudentCount(openProgram.program_id)} students · {openList.length} req.</p>
                        </div>
                        <div className="program-actions-rm">
                            <button
                                type="button"
                                className="btn-rm btn-icon-rm btn-primary-rm"
                                onClick={() => openCreateModal(openProgram.program_id)}
                                aria-label={`Create requirement for ${openProgram.program_id}`}
                                title={`Create requirement for ${openProgram.program_id}`}
                            >
                                <Plus size={20} />
                            </button>
                            <button
                                type="button"
                                className="btn-rm btn-icon-rm"
                                aria-pressed={openEditing}
                                onClick={() => {
                                    setIsNewMode({ ...isNewMode, [openProgramId]: !openEditing });
                                    setInlineEditingConfigId(null);
                                }}
                                aria-label={openEditing ? 'Done editing' : 'Edit requirements'}
                                title={openEditing ? 'Done editing' : 'Edit requirements'}
                            >
                                {openEditing ? <X size={20} /> : <Pencil size={20} />}
                            </button>
                        </div>
                    </div>

                    <p className="note-rm"><Info size={16} />All year levels and sections</p>

                    <div className={`program-card-rm ${openEditing ? 'is-editing-rm' : ''}`}>
                        {openList.length === 0 && <div className="program-empty-rm">None yet</div>}
                        <ul className="req-list-rm">
                            {openList.map((req, index) => {
                                const isThisRowBeingEdited = inlineEditingConfigId === req.config_id;
                                const formattedDeadline = req.submission_deadline ? formatDate(req.submission_deadline) : 'No Target Set';

                                return (
                                    <li key={req.config_id || index} className={`req-item-rm ${isThisRowBeingEdited ? 'req-item-edit-rm' : ''}`}>
                                        {!isThisRowBeingEdited ? (
                                            <div className="req-item-content-rm">
                                                <FileCheck size={20} className="check-icon-rm" aria-hidden="true" />
                                                <div className="req-item-details-rm">
                                                    <span className="req-text-rm">
                                                        {req.requirement_name}
                                                        {req.year_level && <span className="year-badge-rm">Year {req.year_level}</span>}
                                                    </span>
                                                    <div className="req-meta-rm">
                                                        <span><Calendar size={14} /> {formattedDeadline}</span>
                                                        <span><Users size={14} /> {programStudentCount(openProgram.program_id)} students</span>
                                                        <span className={`late-badge-rm ${req.allow_late_submission ? 'allowed' : 'blocked'}`}>
                                                            {req.allow_late_submission ? <Check size={14} /> : <Ban size={14} />}
                                                            {req.allow_late_submission ? 'Late Allowed' : 'Late Blocked'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {openEditing && (
                                                    <div className="req-actions-rm">
                                                        <button
                                                            type="button"
                                                            onClick={() => startInlineEditingConfig(req)}
                                                            className="btn-rm btn-icon-rm btn-ghost-rm"
                                                            aria-label={`Edit ${req.requirement_name}`}
                                                            title={`Edit ${req.requirement_name}`}
                                                        ><Pencil size={20} /></button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteProgramRequirement(openProgram.program_id, req.config_id, req.requirement_name)}
                                                            className="btn-rm btn-icon-rm btn-ghost-rm btn-danger-rm"
                                                            aria-label={`Delete ${req.requirement_name}`}
                                                            title={`Delete ${req.requirement_name}`}
                                                        ><Trash2 size={20} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="inline-edit-box-rm">
                                                <div className="inline-edit-inputs-rm">
                                                    <select
                                                        aria-label="Requirement"
                                                        value={inlineEditForm.requirement_name}
                                                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, requirement_name: e.target.value })}
                                                        className="filter-select-rm"
                                                    >
                                                        <option value="">Select</option>
                                                        {medicalRequirements.map((medReq, idx) => (
                                                            <option key={medReq.requirement_name || idx} value={medReq.requirement_name}>
                                                                {medReq.requirement_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="date"
                                                        aria-label="Deadline"
                                                        value={inlineEditForm.submission_deadline}
                                                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, submission_deadline: e.target.value })}
                                                    />
                                                </div>
                                                <div className="inline-edit-footer-rm">
                                                    <label className="checkbox-label-rm">
                                                        <input
                                                            type="checkbox"
                                                            checked={inlineEditForm.allow_late_submission}
                                                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, allow_late_submission: e.target.checked })}
                                                        /> Late Allowed
                                                    </label>
                                                    <div className="inline-edit-actions-rm">
                                                        <button
                                                            type="button"
                                                            onClick={() => setInlineEditingConfigId(null)}
                                                            className="btn-rm btn-icon-rm"
                                                            aria-label="Cancel"
                                                            title="Cancel"
                                                        ><X size={20} /></button>
                                                        <button
                                                            type="button"
                                                            onClick={() => saveInlineRequirementUpdate(openProgram.program_id, req.config_id)}
                                                            className="btn-rm btn-icon-rm btn-primary-rm"
                                                            aria-label="Save"
                                                            title="Save"
                                                        ><Check size={20} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE REQUIREMENT - pick the programs; all year levels and sections */}
            {createOpen && (
                <div className="modal-overlay-rm" onKeyDown={(e) => { if (e.key === 'Escape') setCreateOpen(false); }}>
                    <div className="modal-content-rm medium-modal-rm" role="dialog" aria-modal="true" aria-labelledby="rm-create-title">
                        <div className="modal-header-rm">
                            <h3 id="rm-create-title">Create requirement</h3>
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                aria-label="Close"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            className="add-special-req-form-rm"
                            noValidate
                            onSubmit={(e) => { e.preventDefault(); createRequirements(); }}
                        >
                            <div className="form-group-rm">
                                <label htmlFor="rm-create-name">Requirement</label>
                                <input
                                    id="rm-create-name"
                                    type="text"
                                    list="rm-create-med-list"
                                    autoComplete="off"
                                    placeholder="Pick or type a name"
                                    className="form-control-rm"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    autoFocus
                                />
                                <datalist id="rm-create-med-list">
                                    {medicalRequirements.map((m, idx) => (
                                        <option key={m.requirement_name || idx} value={m.requirement_name} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="form-grid-2-rm">
                                <div className="form-group-rm">
                                    <label htmlFor="rm-create-deadline">Deadline</label>
                                    <input
                                        id="rm-create-deadline"
                                        type="date"
                                        className="form-control-rm"
                                        value={createForm.deadline}
                                        onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                                    />
                                </div>
                                <div className="form-group-rm">
                                    <label className="checkbox-label-rm">
                                        <input
                                            type="checkbox"
                                            checked={createForm.allowLate}
                                            onChange={(e) => setCreateForm({ ...createForm, allowLate: e.target.checked })}
                                        /> Late Allowed
                                    </label>
                                </div>
                            </div>

                            <fieldset className="programs-fieldset-rm">
                                <legend>Programs</legend>
                                <label className="checkbox-label-rm">
                                    <input
                                        type="checkbox"
                                        checked={allCreateSelected}
                                        disabled={selectableRows.length === 0}
                                        onChange={(e) => setCreatePrograms(e.target.checked ? selectableRows.map(r => r.id) : [])}
                                    /> All programs
                                </label>
                                <ul className="program-pick-list-rm">
                                    {programRows.map(row => (
                                        <li key={row.id}>
                                            <label className={`program-pick-rm ${row.set ? 'is-off-rm' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    disabled={row.set}
                                                    checked={!row.set && createPrograms.includes(row.id)}
                                                    onChange={(e) => setCreatePrograms(prev => e.target.checked
                                                        ? [...new Set([...prev, row.id])]
                                                        : prev.filter(x => x !== row.id))}
                                                />
                                                <span className="program-pick-id-rm">{row.id}</span>
                                                <span className="program-pick-name-rm">{row.p.program_name}</span>
                                                <span className="program-pick-count-rm">
                                                    {row.set
                                                        ? 'Already set'
                                                        : `${row.eligible} students${row.have ? ` · ${row.have} have it` : ''}`}
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </fieldset>

                            <p className="create-preview-rm" role="status" aria-live="polite">
                                {pickedRows.length
                                    ? `${previewTotal} students get it${previewSkipped ? ` · ${previewSkipped} already have it` : ''}`
                                    : 'Pick a program'}
                            </p>

                            <div className="form-actions-rm">
                                <button type="button" className="btn-cancel-rm" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-save-rm" disabled={creating}>Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: MEDICAL REQUIREMENTS MASTERLIST (CRUD) */}
            {isMedReqModalOpen && (
                <div className="modal-overlay-rm" onKeyDown={(e) => { if (e.key === 'Escape') { setIsMedReqModalOpen(false); setEditingMedReq(null); } }}>
                    <div className="modal-content-rm medium-modal-rm" role="dialog" aria-modal="true" aria-labelledby="rm-med-title">
                        <div className="modal-header-rm">
                            <h3 id="rm-med-title">Medical Requirements</h3>
                            <button
                                type="button"
                                onClick={() => { setIsMedReqModalOpen(false); setEditingMedReq(null); }}
                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                aria-label="Close"
                                title="Close"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="modal-body-rm">
                            <div className="add-med-req-form-rm">
                                <label className="filter-label-rm" htmlFor="rm-med-new">New requirement</label>
                                <div className="inline-add-group-rm">
                                    <input
                                        id="rm-med-new"
                                        type="text"
                                        placeholder="e.g. CBC, Chest X-Ray"
                                        value={newMedReqName}
                                        onChange={(e) => setNewMedReqName(e.target.value)}
                                        className="form-control-rm"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddMedicalRequirement}
                                        className="btn-rm btn-icon-rm btn-primary-rm"
                                        aria-label="Add requirement"
                                        title="Add requirement"
                                    >
                                        <Plus size={20}/>
                                    </button>
                                </div>
                            </div>

                            <div className="med-req-list-section-rm">
                                <h4>Existing ({medicalRequirements.length})</h4>
                                {medicalRequirements.length === 0 ? (
                                    <p className="empty-text-rm">None yet</p>
                                ) : (
                                    <ul className="med-req-list-rm">
                                        {medicalRequirements.map((item, idx) => {
                                            const isEditing = editingMedReq && editingMedReq.original_name === item.requirement_name;
                                            return (
                                                <li key={item.requirement_name || idx} className="med-req-item-rm">
                                                    {!isEditing ? (
                                                        <>
                                                            <span className="med-req-name-rm">
                                                                <FileText size={16} className="text-muted-rm" />
                                                                <b>{item.requirement_name}</b>
                                                            </span>
                                                            <div className="med-req-actions-rm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingMedReq({ original_name: item.requirement_name, new_name: item.requirement_name })}
                                                                    className="btn-rm btn-icon-rm btn-ghost-rm"
                                                                    aria-label={`Rename ${item.requirement_name}`}
                                                                    title={`Rename ${item.requirement_name}`}
                                                                >
                                                                    <Pencil size={20}/>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteMedicalRequirement(item.requirement_name)}
                                                                    className="btn-rm btn-icon-rm btn-ghost-rm btn-danger-rm"
                                                                    aria-label={`Delete ${item.requirement_name}`}
                                                                    title={`Delete ${item.requirement_name}`}
                                                                >
                                                                    <Trash2 size={20}/>
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="inline-edit-med-req-rm">
                                                            <input
                                                                type="text"
                                                                aria-label="Requirement name"
                                                                value={editingMedReq.new_name}
                                                                onChange={(e) => setEditingMedReq({ ...editingMedReq, new_name: e.target.value })}
                                                                className="form-control-rm"
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingMedReq(null)}
                                                                className="btn-rm btn-icon-rm"
                                                                aria-label="Cancel"
                                                                title="Cancel"
                                                            >
                                                                <X size={20}/>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateMedicalRequirement(editingMedReq.original_name, editingMedReq.new_name)}
                                                                className="btn-rm btn-icon-rm btn-primary-rm"
                                                                aria-label="Save"
                                                                title="Save"
                                                            >
                                                                <Check size={20}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: SELECTED STUDENT CONTROL BOARD */}
            {selectedStudent && (
                <div className="modal-overlay-rm" onKeyDown={(e) => { if (e.key === 'Escape' && !editingReq) { setSelectedStudent(null); setHighlightedReqName(null); setIsAddModalOpen(false); } }}>
                    <div className="modal-content-rm large-modal-rm" role="dialog" aria-modal="true" aria-labelledby="rm-student-title">
                        <div className="modal-header-rm">
                            <div>
                                <h3 id="rm-student-title">Manage Submissions</h3>
                                <p className="modal-subtitle-rm">{selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.student_id})</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSelectedStudent(null); setHighlightedReqName(null); setIsAddModalOpen(false); }}
                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                aria-label="Close"
                                title="Close"
                                autoFocus
                            ><X size={20}/></button>
                        </div>

                        <div className="modal-body-rm">
                            {!isAddModalOpen ? (
                                <>
                                    <div className="modal-toolbar-rm">
                                        <button
                                            type="button"
                                            className="btn-rm btn-icon-rm btn-primary-rm"
                                            onClick={() => setIsAddModalOpen(true)}
                                            aria-label="Assign special requirement"
                                            title="Assign special requirement"
                                        >
                                            <Plus size={20}/>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-rm btn-icon-rm"
                                            onClick={handleExportStudentReport}
                                            aria-label="Export student report"
                                            title="Export student report"
                                        >
                                            <Printer size={20} />
                                        </button>
                                    </div>
                                    
                                    <div className="student-req-grid-rm">
                                        {studentReqs.map((req, i) => {
                                            const overdueDays = calculateOverdueDays(req.submission_deadline, req.submitted_at, req.status);
                                            const isSpecial = req.type === 'Special';
                                            const isLateAllowed = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';

                                            const normalizedStatus = req.status?.toLowerCase();
                                            const displayStatus = (normalizedStatus === 'submitted' || normalizedStatus === 'submitted late' || normalizedStatus === 'late')
                                                ? 'Waiting for approval' 
                                                : (normalizedStatus === 'not submitted' ? 'Missed' : (req.status || 'Pending'));

                                            const sanitizedStatusClass = req.status 
                                                ? String(req.status).toLowerCase().replace(/\s+/g, "-") 
                                                : "pending";

                                            const isHighlighted = highlightedReqName && req.requirement_name === highlightedReqName;

                                            return (
                                                <div
                                                    className={`req-card-rm ${isHighlighted ? 'highlighted-req-card-rm' : ''}`}
                                                    key={req.requirement_name || i}
                                                >
                                                    <div className="req-card-header-rm">
                                                        <div className="req-card-title-group-rm">
                                                            <h4>
                                                                <FileText size={16} className="req-icon-rm"/> 
                                                                {req.requirement_name || "Unnamed Requirement"} 
                                                                <span className="tag-rm">{req.type || 'Standard'} Field</span>
                                                            </h4>
                                                            
                                                            <div className="badge-row-rm">
                                                                <span 
                                                                    className={`status-badge-rm ${sanitizedStatusClass}`}
                                                                    style={getStatusStyle(req.status)}
                                                                >
                                                                    {(displayStatus === 'Missed' || normalizedStatus === 'not submitted') && <AlertCircle size={12}/>}
                                                                    {displayStatus}
                                                                </span>
                                                                
                                                                <span className={`late-badge-rm ${isLateAllowed ? 'allowed' : 'blocked'}`}>
                                                                    {isLateAllowed ? 'Late Allowed' : 'Late Blocked'}
                                                                </span>
                                                            </div>
                                                            
                                                            {req.submission_deadline && (
                                                                <div className="deadline-info-rm">
                                                                    <Calendar size={13}/> Deadline: {formatDate(req.submission_deadline)} 
                                                                    {overdueDays && <span className="overdue-text-rm"> ({overdueDays}d overdue)</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="card-actions-rm">
                                                            <button
                                                                type="button"
                                                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                                                aria-label={`Edit ${req.requirement_name}`}
                                                                title={`Edit ${req.requirement_name}`}
                                                                onClick={() => setEditingReq({
                                                                    ...req,
                                                                    status: req.status || 'Pending',
                                                                    override_allow_late_submission: isLateAllowed
                                                                })}
                                                            ><Pencil size={20}/></button>
                                                            {isSpecial && (
                                                                <button
                                                                    type="button"
                                                                    className="btn-rm btn-icon-rm btn-ghost-rm btn-danger-rm"
                                                                    aria-label={`Delete ${req.requirement_name}`}
                                                                    title={`Delete ${req.requirement_name}`}
                                                                    onClick={() => handleDeleteSpecialRequirement(req.requirement_name)}
                                                                ><Trash2 size={20}/></button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="req-card-body-rm">
                                                        <div className="attachment-section-rm">
                                                            <b>Attachment:</b> {req.file_url ? (
                                                                <a href={req.file_url} target="_blank" rel="noreferrer">Open Document</a>
                                                            ) : (
                                                                <span className="no-file-text-rm">No document attached</span>
                                                            )}
                                                        </div>
                                                        {req.nurse_remarks && (
                                                            <div className="nurse-comment-rm">
                                                                Remarks: {req.nurse_remarks}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="add-special-req-form-rm">
                                    <h4>Special requirement</h4>
                                    <div className="form-grid-2-rm">
                                        <div className="form-group-rm">
                                            <label htmlFor="rm-special-name">Requirement</label>
                                            <select
                                                id="rm-special-name"
                                                value={newReqInput.name}
                                                onChange={e => setNewReqInput({...newReqInput, name: e.target.value})}
                                                className="form-control-rm"
                                            >
                                                <option value="">Select</option>
                                                {medicalRequirements.map((medReq, idx) => (
                                                    <option key={medReq.requirement_name || idx} value={medReq.requirement_name}>
                                                        {medReq.requirement_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group-rm">
                                            <label htmlFor="rm-special-deadline">Deadline</label>
                                            <input
                                                id="rm-special-deadline"
                                                type="date"
                                                value={newReqInput.deadline}
                                                onChange={e => setNewReqInput({...newReqInput, deadline: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <label className="checkbox-label-rm mt-2-rm">
                                        <input 
                                            type="checkbox" 
                                            checked={newReqInput.allowLate}
                                            onChange={e => setNewReqInput({...newReqInput, allowLate: e.target.checked})}
                                        /> Late Allowed
                                    </label>
                                    <div className="form-actions-rm space-top-rm">
                                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-cancel-rm">Cancel</button>
                                        <button type="button" onClick={handleAddSpecialRequirement} className="btn-save-rm">Assign</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NESTED MODAL: EDIT PARAMETERS */}
            {editingReq && (
                <div className="modal-overlay-rm nested-overlay-rm" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditingReq(null); } }}>
                    <div className="modal-content-rm small-modal-rm" role="dialog" aria-modal="true" aria-labelledby="rm-edit-title">
                        <div className="modal-header-rm">
                            <div>
                                <h3 id="rm-edit-title">Edit requirement</h3>
                                <p className="modal-subtitle-rm">{editingReq.requirement_name}</p>
                            </div>
                            <button
                                type="button"
                                className="btn-rm btn-icon-rm btn-ghost-rm"
                                onClick={() => setEditingReq(null)}
                                aria-label="Close"
                                title="Close"
                                autoFocus
                            ><X size={20}/></button>
                        </div>
                        
                        <div className="modal-body-rm">
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    
                                    if (['Completed', 'Rejected'].includes(editingReq.status) && !editingReq.file_url) {
                                        showAlertModal("Validation Error", "Cannot mark requirement as Completed or Rejected without an uploaded document file.", "warning");
                                        return;
                                    }

                                    handleUpdateRequirement(selectedStudent.student_id, editingReq.requirement_name, {
                                        status: editingReq.status || 'Pending',
                                        nurse_remarks: editingReq.nurse_remarks || '',
                                        submission_deadline: editingReq.submission_deadline || null,
                                        type: editingReq.type || 'Program',
                                        config_id: editingReq.config_id || null,
                                        override_allow_late_submission: editingReq.override_allow_late_submission || false
                                    });
                                }} 
                                className="edit-req-form-rm"
                            >
                                <div className="form-grid-2-rm">
                                    <div className="form-group-rm">
                                        <label htmlFor="rm-edit-status">Status</label>
                                        <select
                                            id="rm-edit-status"
                                            value={editingReq.status || 'Pending'}
                                            onChange={(e) => setEditingReq({...editingReq, status: e.target.value})}
                                            className="form-control-rm"
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Not Submitted">Missed</option>
                                            <option value="Completed" disabled={!editingReq.file_url}>
                                                Completed {!editingReq.file_url ? '(File Upload Required)' : ''}
                                            </option>
                                            <option value="Rejected" disabled={!editingReq.file_url}>
                                                Rejected {!editingReq.file_url ? '(File Upload Required)' : ''}
                                            </option>
                                        </select>
                                    </div>

                                    <div className="form-group-rm">
                                        <label htmlFor="rm-edit-deadline">Deadline</label>
                                        <input
                                            id="rm-edit-deadline"
                                            type="date"
                                            value={formatDeadlineDate(editingReq.submission_deadline)} 
                                            onChange={(e) => setEditingReq({...editingReq, submission_deadline: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="form-group-rm mt-2-rm">
                                    <label className="checkbox-label-rm">
                                        <input 
                                            type="checkbox" 
                                            checked={!!editingReq.override_allow_late_submission} 
                                            onChange={(e) => setEditingReq({
                                                ...editingReq, 
                                                override_allow_late_submission: e.target.checked
                                            })} 
                                        />
                                        Late Allowed
                                    </label>
                                </div>

                                <div className="form-group-rm mt-2-rm">
                                    <label htmlFor="rm-edit-remarks">Remarks</label>
                                    <textarea
                                        id="rm-edit-remarks"
                                        value={editingReq.nurse_remarks || ''}
                                        onChange={(e) => setEditingReq({...editingReq, nurse_remarks: e.target.value})}
                                        rows="3"
                                    />
                                </div>

                                <div className="form-actions-rm space-top-rm">
                                    <button type="button" className="btn-cancel-rm" onClick={() => setEditingReq(null)}>Cancel</button>
                                    <button type="submit" className="btn-save-rm">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default RequirementManagement;