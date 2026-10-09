// requirementManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { 
    Search, Calendar, Edit, Trash2, X, Plus, 
    FileText, CheckCircle, Clock, Eye, AlertCircle, FileCheck, Printer 
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
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
    const [medReqError, setMedReqError] = useState('');
    const [editingMedReq, setEditingMedReq] = useState(null);

    // Confirmation & Alert Modal State for CRUD
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        details: null,
        onConfirm: null,
        confirmText: 'Confirm',
        type: 'primary', // 'primary' | 'danger' | 'warning' | 'error'
        hideCancel: false
    });

    // Program Configuration States
    const [programs, setPrograms] = useState([]);
    const [programConfigs, setProgramConfigs] = useState([]);
    const [isNewMode, setIsNewMode] = useState({});

    // Modal State for Assigning Medical Requirement to a Course
    const [assignCourseModalProgram, setAssignCourseModalProgram] = useState(null);
    const [courseModalInput, setCourseModalInput] = useState({ name: '', year_level: '', deadline: '', allowLate: false });

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

    const openConfirmModal = (title, message, onConfirm, confirmText = 'Confirm', type = 'primary', details = null) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            details,
            onConfirm,
            confirmText,
            type,
            hideCancel: false
        });
    };

    const showAlertModal = (title, message, type = 'primary') => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            details: null,
            onConfirm: null,
            confirmText: 'OK',
            type,
            hideCancel: true
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null, details: null }));
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

        const reportDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

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
                    <span>Date Generated: ${reportDate}</span>
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

        const reportDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const studentName = `${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim();
        const yearLevelStr = selectedStudent.year_level ? `${selectedStudent.year_level}${Number(selectedStudent.year_level) === 1 ? 'st' : Number(selectedStudent.year_level) === 2 ? 'nd' : Number(selectedStudent.year_level) === 3 ? 'rd' : 'th'} Year` : 'N/A';

        const tableRowsHtml = studentReqs.map(req => {
            const normalizedStatus = req.status?.toLowerCase();
            const displayStatus = (normalizedStatus === 'submitted' || normalizedStatus === 'submitted late' || normalizedStatus === 'late')
                ? 'Waiting for approval' 
                : (normalizedStatus === 'not submitted' ? 'Missed' : (req.status || 'Pending'));
            const deadline = req.submission_deadline ? formatDeadlineDate(req.submission_deadline) : 'N/A';
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
        setMedReqError('');
        const trimmed = newMedReqName.trim();
        if (!trimmed) {
            setMedReqError("Requirement name cannot be empty.");
            return;
        }

        const exists = medicalRequirements.some(
            req => req.requirement_name.toLowerCase() === trimmed.toLowerCase()
        );

        if (exists) {
            setMedReqError(`Duplicate Error: Medical requirement "${trimmed}" already exists.`);
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
                        setMedReqError(data?.error || `Server Error (${response.status}): Failed to add medical requirement.`);
                        return;
                    }

                    setNewMedReqName('');
                    setMedReqError('');
                    fetchMedicalRequirements();
                    showAlertModal("Success", `Medical requirement "${trimmed}" added successfully.`, "primary");
                } catch (error) {
                    console.error("Error adding medical requirement:", error);
                    setMedReqError("Network error adding medical requirement.");
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

    const addProgramRequirement = async (programId, inputDataOverride = null) => {
        if (!programId || programId === 'undefined') {
            showAlertModal("Error", "Invalid or missing Program ID.", "error");
            return;
        }

        const targetInput = inputDataOverride || courseModalInput;
        const reqName = targetInput.name;
        const yearLevel = targetInput.year_level;
        const deadline = targetInput.deadline;
        const allowLate = targetInput.allowLate || false;

        if (!reqName || !reqName.trim() || !deadline) {
            showAlertModal("Validation Error", "Please select a Requirement Name and Target Deadline.", "warning");
            return;
        }

        const trimmedReqName = reqName.trim();

        const isDuplicateInProgram = programConfigs.some(c => {
            if (String(c.program_id) !== String(programId)) return false;
            if (c.requirement_name.toLowerCase() !== trimmedReqName.toLowerCase()) return false;

            const existingYear = c.year_level ? String(c.year_level) : null;
            const targetYear = yearLevel ? String(yearLevel) : null;

            return existingYear === null || targetYear === null || existingYear === targetYear;
        });

        if (isDuplicateInProgram) {
            showAlertModal("Duplicate Error", `Requirement "${trimmedReqName}" is already assigned to this program for ${yearLevel ? `Year Level ${yearLevel}` : 'all year levels'}.`, "error");
            return;
        }

        openConfirmModal(
            "Add Program Requirement",
            `Add requirement "${trimmedReqName}"${yearLevel ? ` (Year ${yearLevel})` : ''} to this program configuration?`,
            async () => {
                try {
                    const encodedProgramId = encodeURIComponent(programId);
                    const response = await fetch(`http://localhost:3001/api/programs/${encodedProgramId}/requirements`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            requirement_name: trimmedReqName,
                            year_level: yearLevel,
                            submission_deadline: deadline,
                            allow_late_submission: allowLate
                        })
                    });

                    const data = await parseJsonResponse(response);

                    if (!response.ok || !data) {
                        const errorMsg = data?.error || `Server error (${response.status}): ${response.statusText || 'Unable to process program requirement'}`;
                        showAlertModal("Configuration Error", errorMsg, "error");
                        return;
                    }

                    setCourseModalInput({ name: '', year_level: '', deadline: '', allowLate: false });
                    setAssignCourseModalProgram(null);
                    
                    await fetchProgramConfigs();
                    fetchMedicalRequirements();
                    showAlertModal("Success", "Program requirement configured successfully.", "primary");
                } catch (error) {
                    console.error("Error adding program requirement:", error);
                    showAlertModal("Network Error", `Network error processing request: ${error.message}`, "error");
                }
            },
            "Add Config",
            "primary"
        );
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
                return { color: '#15803d', backgroundColor: '#dcfce7', border: '1px solid #86efac' };
            case 'submitted':
            case 'waiting for approval':
            case 'late':
            case 'submitted late':
                return { color: '#1d4ed8', backgroundColor: '#dbeafe', border: '1px solid #93c5fd' };
            case 'rejected':
                return { color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
            case 'missed':
            case 'not submitted':
                return { color: '#374151', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' };
            case 'pending':
            default:
                return { color: '#ca8a04', backgroundColor: '#fef9c3', border: '1px solid #fde047' };
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

    return (
        <div className="req-container-rm">
            {/* HEADER SECTION */}
            <div className="req-header-section-rm">
                <div>
                    <h2>Requirement Management</h2>
                    <p>Manage and track student requirements</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                        type="button"
                        className="btn-manage-med-reqs-rm"
                        onClick={handleExportAllReport}
                        style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Printer size={16} /> export
                    </button>
                    <button 
                        className="btn-manage-med-reqs-rm"
                        onClick={() => {
                            setIsMedReqModalOpen(true);
                            setMedReqError('');
                        }}
                        style={{ width: 'auto' }}
                    >
                        <FileText size={16} /> Manage Medical Requirements
                    </button>
                </div>
            </div>

            <div className="tabs-rm">
                <button className={`tab-btn-rm ${activeTab === 'student' ? 'active' : ''}`} onClick={() => setActiveTab('student')}>
                    Student Requirements
                </button>
                <button className={`tab-btn-rm ${activeTab === 'course' ? 'active' : ''}`} onClick={() => setActiveTab('course')}>
                    Course / Strand Requirements
                </button>
            </div>

            {/* VIEW: MAIN STUDENT MATRIX */}
            {activeTab === 'student' && (
                <div className="tab-content-rm">
                    <div className="dashboard-summary-cards-rm">
                        <div 
                            className={`summary-card-rm card-blue-rm ${statusFilter === 'waiting' ? 'active-card-filter-rm' : ''}`}
                            onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'default' : 'waiting')}
                            title="Click to filter students waiting for approval"
                        >
                            <div className="summary-card-number-rm text-blue-rm">{submittedRequirementsCount}</div>
                            <div className="summary-card-label-rm">Waiting for Approval</div>
                        </div>
                        <div 
                            className={`summary-card-rm card-orange-rm ${statusFilter === 'incomplete' ? 'active-card-filter-rm' : ''}`}
                            onClick={() => setStatusFilter(statusFilter === 'incomplete' ? 'default' : 'incomplete')}
                            title="Click to filter incomplete students"
                        >
                            <div className="summary-card-number-rm text-orange-rm">{incompleteStudentsCount}</div>
                            <div className="summary-card-label-rm">Incomplete</div>
                        </div>
                        <div 
                            className={`summary-card-rm card-green-rm ${statusFilter === 'complete' ? 'active-card-filter-rm' : ''}`}
                            onClick={() => setStatusFilter(statusFilter === 'complete' ? 'default' : 'complete')}
                            title="Click to filter complete students"
                        >
                            <div className="summary-card-number-rm text-green-rm">{completeStudentsCount}</div>
                            <div className="summary-card-label-rm">Complete</div>
                        </div>
                    </div>

                    <div className="filter-toolbar-rm">
                        <div className="search-wrapper-rm">
                            <Search className="search-icon-rm" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search active students by name, ID, section..." 
                                className="search-bar-rm" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="filter-grid-rm">
                            <div className="filter-item-rm">
                                <label className="filter-label-rm">Course / Strand</label>
                                <select 
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
                                <label className="filter-label-rm">Year Level</label>
                                <select 
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
                                <label className="filter-label-rm">Section</label>
                                <select 
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
                                <label className="filter-label-rm">Requirement</label>
                                <select 
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
                                <label className="filter-label-rm">Compliance Status</label>
                                <select 
                                    value={statusFilter} 
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="filter-select-rm"
                                >
                                    <option value="default">Default (Waiting & Incomplete)</option>
                                    <option value="all">All Statuses (Including Complete)</option>
                                    <option value="waiting">Waiting for Approval Only</option>
                                    <option value="incomplete">Incomplete Only</option>
                                    <option value="complete">Complete Only</option>
                                    <option value="missed">Missed</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="resubmit">Resubmit</option>
                                </select>
                            </div>

                            {(courseFilter !== 'all' || sectionFilter !== 'all' || yearFilter !== 'all' || requirementFilter !== 'all' || statusFilter !== 'default' || searchTerm !== '') && (
                                <div className="filter-item-rm filter-reset-action-rm">
                                    <button 
                                        onClick={() => {
                                            setCourseFilter('all');
                                            setSectionFilter('all');
                                            setYearFilter('all');
                                            setRequirementFilter('all');
                                            setStatusFilter('default');
                                            setSearchTerm('');
                                        }}
                                        className="btn-clear-filters-rm"
                                    >
                                        Reset Filters
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
                                    <th className="text-center-rm">Action</th>
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
                                                        <div>
                                                            {Number(student.stats.total) === 0 ? (
                                                                <span className="text-muted-rm">No Requirements (0/0)</span>
                                                            ) : Number(student.stats.completed) === Number(student.stats.total) ? (
                                                                <span className="stat-complete-rm">
                                                                    <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }}/> 
                                                                    {student.stats.completed}/{student.stats.total} Complete
                                                                </span>
                                                            ) : (
                                                                <span className="stat-incomplete-rm">
                                                                    <Clock size={14} style={{ display: 'inline', marginRight: '4px' }}/> 
                                                                    {student.stats.completed}/{student.stats.total} Incomplete
                                                                </span>
                                                            )}
                                                        </div>
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
                                                    onClick={() => handleManageStudent(student)} 
                                                    className="btn-action-icon-rm" 
                                                    title="Manage Student Requirements"
                                                    aria-label="Manage Student Requirements"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="empty-table-cell-rm">
                                            No active student records matched the active search and filter criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW: COURSE CONFIGURATION PANEL */}
            {activeTab === 'course' && (
                <div className="tab-content-rm course-grid-rm">
                    {programs.map(prog => {
                        const assignedConfigs = programConfigs.filter(config => config.program_id === prog.program_id);
                        const progYearLevelOptions = getYearLevelOptions(prog);

                        return (
                            <div className="program-card-rm" key={prog.program_id}>
                                <div className="program-header-rm">
                                    <h3>{prog.program_name}</h3>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                            type="button"
                                            className="btn-add-primary-sm-rm"
                                            onClick={() => {
                                                setAssignCourseModalProgram(prog);
                                                setCourseModalInput({ name: '', year_level: '', deadline: '', allowLate: false });
                                            }}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Plus size={14} /> Assign Requirement
                                        </button>
                                        <button 
                                            className="btn-edit-toggle-rm" 
                                            onClick={() => setIsNewMode({...isNewMode, [prog.program_id]: !isNewMode[prog.program_id]})}
                                        >
                                            {isNewMode[prog.program_id] ? <><X size={14} /> Close Edit</> : <><Edit size={14} /> Edit</>}
                                        </button>
                                    </div>
                                </div>
                                
                                <ul className="req-list-rm">
                                    {assignedConfigs.map((req, index) => {
                                        const isThisRowBeingEdited = inlineEditingConfigId === req.config_id;
                                        const formattedDeadline = req.submission_deadline ? formatDeadlineDate(req.submission_deadline) : 'No Target Set';
                                        
                                        return (
                                            <li key={req.config_id || index} className="req-item-rm">
                                                {!isThisRowBeingEdited ? (
                                                    <div className="req-item-content-rm">
                                                        <div className="req-item-details-rm">
                                                            <span className="req-text-rm">
                                                                <FileCheck size={16} className="check-icon-rm"/>  
                                                                <b>{req.requirement_name}</b>  
                                                                {req.year_level && <span className="year-badge-rm">Year {req.year_level}</span>}
                                                            </span>
                                                            <div className="req-meta-rm">
                                                                <span><Calendar size={12}/> Deadline: {formattedDeadline}</span>
                                                                <span className={`late-badge-rm ${req.allow_late_submission ? 'allowed' : 'blocked'}`}>
                                                                    {req.allow_late_submission ? 'Late Allowed' : 'Late Blocked'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {isNewMode[prog.program_id] && (
                                                            <div className="req-actions-rm">
                                                                <button onClick={() => startInlineEditingConfig(req)} className="btn-icon-rm btn-edit-rm" title="Edit Requirement"><Edit size={14}/></button>
                                                                <button onClick={() => deleteProgramRequirement(prog.program_id, req.config_id, req.requirement_name)} className="btn-icon-rm btn-delete-x-rm" title="Delete Requirement"><Trash2 size={14}/></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="inline-edit-box-rm">
                                                        <div className="inline-edit-inputs-rm">
                                                            <select 
                                                                value={inlineEditForm.requirement_name}
                                                                onChange={(e) => setInlineEditForm({...inlineEditForm, requirement_name: e.target.value})}
                                                                className="flex-2-rm filter-select-rm"
                                                            >
                                                                <option value="">Select Requirement</option>
                                                                {medicalRequirements.map((medReq, idx) => (
                                                                    <option key={medReq.requirement_name || idx} value={medReq.requirement_name}>
                                                                        {medReq.requirement_name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <select 
                                                                value={inlineEditForm.year_level}
                                                                onChange={(e) => setInlineEditForm({...inlineEditForm, year_level: e.target.value})}
                                                                className="flex-1-rm filter-select-rm"
                                                            >
                                                                <option value="">Year Level</option>
                                                                {progYearLevelOptions.map(y => (
                                                                    <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>
                                                                ))}
                                                            </select>
                                                            <input 
                                                                type="date" 
                                                                value={inlineEditForm.submission_deadline}
                                                                onChange={(e) => setInlineEditForm({...inlineEditForm, submission_deadline: e.target.value})}
                                                                className="flex-1-rm"
                                                            />
                                                        </div>
                                                        <div className="inline-edit-footer-rm">
                                                            <label className="checkbox-label-rm">
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={inlineEditForm.allow_late_submission}
                                                                    onChange={(e) => setInlineEditForm({...inlineEditForm, allow_late_submission: e.target.checked})}
                                                                /> Allow late submission
                                                            </label>
                                                            <div className="inline-edit-actions-rm">
                                                                <button onClick={() => saveInlineRequirementUpdate(prog.program_id, req.config_id)} className="btn-save-sm-rm">Save</button>
                                                                <button onClick={() => setInlineEditingConfigId(null)} className="btn-cancel-sm-rm">Cancel</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: ASSIGN / ADD MEDICAL REQUIREMENT TO SPECIFIC COURSE */}
            {assignCourseModalProgram && (
                <div className="modal-overlay-rm">
                    <div className="modal-content-rm medium-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>Assign Requirement to Course</h3>
                                <p className="modal-subtitle-rm">{assignCourseModalProgram.program_name} ({assignCourseModalProgram.program_id})</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setAssignCourseModalProgram(null);
                                    setCourseModalInput({ name: '', year_level: '', deadline: '', allowLate: false });
                                }} 
                                className="btn-close-rm" 
                                title="Close Modal"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="modal-body-rm">
                            <div className="add-special-req-form-rm">
                                <h4>Add Medical Requirement</h4>
                                <div className="form-grid-2-rm">
                                    <div className="form-group-rm">
                                        <label>Select Medical Requirement</label>
                                        <select 
                                            value={courseModalInput.name}
                                            onChange={(e) => setCourseModalInput({ ...courseModalInput, name: e.target.value })}
                                            className="form-control-rm"
                                        >
                                            <option value="">-- Select Requirement --</option>
                                            {medicalRequirements.map((medReq, idx) => (
                                                <option key={medReq.requirement_name || idx} value={medReq.requirement_name}>
                                                    {medReq.requirement_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group-rm">
                                        <label>Target Year Level</label>
                                        <select 
                                            value={courseModalInput.year_level}
                                            onChange={(e) => setCourseModalInput({ ...courseModalInput, year_level: e.target.value })}
                                            className="form-control-rm"
                                        >
                                            <option value="">All Year Levels</option>
                                            {getYearLevelOptions(assignCourseModalProgram).map(y => (
                                                <option key={y} value={y}>
                                                    {y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-grid-2-rm mt-2-rm">
                                    <div className="form-group-rm">
                                        <label>Submission Deadline</label>
                                        <input 
                                            type="date"
                                            value={courseModalInput.deadline}
                                            onChange={(e) => setCourseModalInput({ ...courseModalInput, deadline: e.target.value })}
                                            className="form-control-rm"
                                        />
                                    </div>
                                    <div className="form-group-rm" style={{ display: 'flex', alignItems: 'center', paddingTop: '22px' }}>
                                        <label className="checkbox-label-rm">
                                            <input 
                                                type="checkbox"
                                                checked={courseModalInput.allowLate}
                                                onChange={(e) => setCourseModalInput({ ...courseModalInput, allowLate: e.target.checked })}
                                            /> Allow late submission?
                                        </label>
                                    </div>
                                </div>

                                <div className="form-actions-rm space-top-rm">
                                    <button 
                                        type="button"
                                        onClick={() => addProgramRequirement(assignCourseModalProgram.program_id, courseModalInput)} 
                                        className="btn-save-rm"
                                    >
                                        <Plus size={16}/> Assign to Course
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setAssignCourseModalProgram(null);
                                            setCourseModalInput({ name: '', year_level: '', deadline: '', allowLate: false });
                                        }} 
                                        className="btn-cancel-rm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: MEDICAL REQUIREMENTS MASTERLIST (CRUD) */}
            {isMedReqModalOpen && (
                <div className="modal-overlay-rm">
                    <div className="modal-content-rm medium-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>Manage Medical Requirements</h3>
                                <p className="modal-subtitle-rm">Manage medical requirements in the system</p>
                            </div>
                            <button 
                                onClick={() => { setIsMedReqModalOpen(false); setMedReqError(''); setEditingMedReq(null); }} 
                                className="btn-close-rm" 
                                title="Close Modal"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="modal-body-rm">
                            <div className="add-med-req-form-rm">
                                <h4>Add New Medical Requirement</h4>
                                <div className="inline-add-group-rm">
                                    <input 
                                        type="text" 
                                        placeholder="Requirement Name (e.g. CBC, Chest X-Ray)"
                                        value={newMedReqName}
                                        onChange={(e) => {
                                            setNewMedReqName(e.target.value);
                                            setMedReqError('');
                                        }}
                                        className="form-control-rm"
                                    />
                                    <button onClick={handleAddMedicalRequirement} className="btn-add-primary-sm-rm">
                                        <Plus size={16}/> Add
                                    </button>
                                </div>
                                {medReqError && (
                                    <div className="error-banner-rm">
                                        <AlertCircle size={16} />
                                        <span>{medReqError}</span>
                                    </div>
                                )}
                            </div>

                            <div className="med-req-list-section-rm">
                                <h4>Existing Medical Requirements ({medicalRequirements.length})</h4>
                                {medicalRequirements.length === 0 ? (
                                    <p className="empty-text-rm">No medical requirements found in database.</p>
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
                                                                    onClick={() => setEditingMedReq({ original_name: item.requirement_name, new_name: item.requirement_name })}
                                                                    className="btn-icon-rm btn-edit-rm"
                                                                    title="Edit Requirement Name"
                                                                >
                                                                    <Edit size={14}/>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteMedicalRequirement(item.requirement_name)}
                                                                    className="btn-icon-rm btn-delete-x-rm"
                                                                    title="Delete Requirement"
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="inline-edit-med-req-rm">
                                                            <input 
                                                                type="text" 
                                                                value={editingMedReq.new_name}
                                                                onChange={(e) => setEditingMedReq({ ...editingMedReq, new_name: e.target.value })}
                                                                className="form-control-rm"
                                                            />
                                                            <button 
                                                                onClick={() => handleUpdateMedicalRequirement(editingMedReq.original_name, editingMedReq.new_name)}
                                                                className="btn-save-sm-rm"
                                                            >
                                                                Save
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingMedReq(null)}
                                                                className="btn-cancel-sm-rm"
                                                            >
                                                                Cancel
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
                <div className="modal-overlay-rm">
                    <div className="modal-content-rm large-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>Manage Submissions</h3>
                                <p className="modal-subtitle-rm">{selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.student_id})</p>
                            </div>
                            <button onClick={() => { setSelectedStudent(null); setHighlightedReqName(null); }} className="btn-close-rm" title="Close Modal"><X size={20}/></button>
                        </div>
                        
                        <div className="modal-body-rm">
                            {!isAddModalOpen ? (
                                <>
                                    <div className="modal-toolbar-rm" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <button className="btn-add-primary-rm" onClick={() => setIsAddModalOpen(true)}>
                                            <Plus size={16}/> Assign Special Requirement
                                        </button>
                                        <button 
                                            type="button"
                                            className="btn-add-primary-rm" 
                                            onClick={handleExportStudentReport}
                                            style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Printer size={16} /> export
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
                                                    style={isHighlighted ? { border: '2px solid #2563eb', boxShadow: '0 0 10px rgba(37,99,235,0.3)' } : {}}
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
                                                                    <Calendar size={13}/> Deadline: {formatDeadlineDate(req.submission_deadline)} 
                                                                    {overdueDays && <span className="overdue-text-rm"> ({overdueDays}d overdue)</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="card-actions-rm">
                                                            <button className="btn-icon-rm btn-edit-rm" title="Edit Parameters" onClick={() => setEditingReq({
                                                                ...req,
                                                                status: req.status || 'Pending',
                                                                override_allow_late_submission: isLateAllowed
                                                            })}><Edit size={14}/></button>
                                                            {isSpecial && (
                                                                <button className="btn-icon-rm btn-delete-x-rm" title="Delete Special Requirement" onClick={() => handleDeleteSpecialRequirement(req.requirement_name)}><Trash2 size={14}/></button>
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
                                    <h4>Add Special Requirement to Student Profile</h4>
                                    <div className="form-grid-2-rm">
                                        <div className="form-group-rm">
                                            <label>Requirement Name</label>
                                            <select 
                                                value={newReqInput.name}
                                                onChange={e => setNewReqInput({...newReqInput, name: e.target.value})}
                                                className="form-control-rm"
                                            >
                                                <option value="">-- Select Medical Requirement --</option>
                                                {medicalRequirements.map((medReq, idx) => (
                                                    <option key={medReq.requirement_name || idx} value={medReq.requirement_name}>
                                                        {medReq.requirement_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group-rm">
                                            <label>Submission Deadline</label>
                                            <input 
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
                                        /> Allow Late Submission
                                    </label>
                                    <div className="form-actions-rm space-top-rm">
                                        <button onClick={handleAddSpecialRequirement} className="btn-save-rm">Assign to Student</button>
                                        <button onClick={() => setIsAddModalOpen(false)} className="btn-cancel-rm">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NESTED MODAL: EDIT PARAMETERS */}
            {editingReq && (
                <div className="modal-overlay-rm nested-overlay-rm">
                    <div className="modal-content-rm small-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>Modify Student Parameters</h3>
                                <p className="modal-subtitle-rm">{editingReq.requirement_name}</p>
                            </div>
                            <button className="btn-close-rm" onClick={() => setEditingReq(null)} title="Close Modal"><X size={20}/></button>
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
                                        <label>Requirement Action Status</label>
                                        <select 
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
                                        <label>Override Deadline:</label>
                                        <input 
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
                                        Allow Late Submission
                                    </label>
                                </div>

                                <div className="form-group-rm mt-2-rm">
                                    <label>Nurse Remarks / Feedback:</label>
                                    <textarea 
                                        value={editingReq.nurse_remarks || ''}  
                                        onChange={(e) => setEditingReq({...editingReq, nurse_remarks: e.target.value})}
                                        placeholder="Add formal remarks profile log text details here..."
                                        rows="3"
                                    />
                                </div>

                                <div className="form-actions-rm space-top-rm">
                                    <button type="submit" className="btn-save-rm">Save Adjustments</button>
                                    <button type="button" className="btn-cancel-rm" onClick={() => setEditingReq(null)}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION / ALERT MODAL FOR ALL OPERATIONS & CASCADE WARNINGS */}
            {confirmModal.isOpen && (
                <div className="modal-overlay-rm confirm-overlay-rm">
                    <div className="modal-content-rm confirm-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>{confirmModal.title || "Message"}</h3>
                            </div>
                            <button onClick={closeConfirmModal} className="btn-close-rm" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body-rm">
                            <p className="confirm-message-rm">{confirmModal.message}</p>

                            {confirmModal.details && (
                                <div className="connection-details-box-rm" style={{ margin: '12px 0', padding: '10px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px' }}>
                                    <h5 style={{ margin: '0 0 6px 0', color: '#991b1b' }}>Connected Dependencies Found:</h5>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#7f1d1d' }}>
                                        {confirmModal.details.program_ids.length > 0 && (
                                            <li><b>Program IDs ({confirmModal.details.program_ids.length}):</b> {confirmModal.details.program_ids.join(', ')}</li>
                                        )}
                                        {confirmModal.details.submission_ids.length > 0 && (
                                            <li><b>Submission IDs ({confirmModal.details.submission_ids.length}):</b> {confirmModal.details.submission_ids.slice(0, 5).join(', ')}{confirmModal.details.submission_ids.length > 5 ? '...' : ''}</li>
                                        )}
                                        {confirmModal.details.service_ids.length > 0 && (
                                            <li><b>Facility Service IDs ({confirmModal.details.service_ids.length}):</b> {confirmModal.details.service_ids.join(', ')}</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            <div className="confirm-actions-rm">
                                <button 
                                    onClick={async () => {
                                        if (confirmModal.onConfirm) {
                                            await confirmModal.onConfirm();
                                        }
                                        closeConfirmModal();
                                    }} 
                                    className={confirmModal.type === 'danger' ? "btn-confirm-danger-rm" : "btn-confirm-rm"}
                                >
                                    {confirmModal.confirmText || "OK"}
                                </button>
                                {!confirmModal.hideCancel && (
                                    <button onClick={closeConfirmModal} className="btn-cancel-rm">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequirementManagement;