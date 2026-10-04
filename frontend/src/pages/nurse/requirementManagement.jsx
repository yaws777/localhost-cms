// requirementManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { 
    Search, Calendar, Edit, Trash2, X, Plus, 
    FileText, CheckCircle, Clock, Eye, AlertCircle, FileCheck 
} from 'lucide-react';
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

    // Confirmation Modal State for CRUD
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Confirm',
        type: 'primary' // 'primary' | 'danger'
    });

    // Program Configuration States
    const [programs, setPrograms] = useState([]);
    const [programConfigs, setProgramConfigs] = useState([]);
    const [isNewMode, setIsNewMode] = useState({});

    // Inline inputs tracking per program configuration updates
    const [programInlineInputs, setProgramInlineInputs] = useState({});
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

    const openConfirmModal = (title, message, onConfirm, confirmText = 'Confirm', type = 'primary') => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm,
            confirmText,
            type
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null }));
    };

    const fetchStudents = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/students');
            const data = await res.json();
            setStudents(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    }, []);

    const fetchPrograms = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/programs');
            const data = await res.json();
            setPrograms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching programs:", error);
        }
    }, []);

    const fetchProgramConfigs = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/program-requirements-config');
            const data = await res.json();
            setProgramConfigs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching program configs:", error);
        }
    }, []);

    const fetchMedicalRequirements = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/medical-requirements');
            if (res.ok) {
                const data = await res.json();
                setMedicalRequirements(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Error fetching medical requirements:", error);
        }
    }, []);

    const fetchStudentFullRequirements = useCallback(async (studentId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/students/${studentId}/full-requirements`);
            const data = await res.json();
            
            if (data && data.error) {
                alert("Backend Database Error: " + data.error);
                setStudentReqs([]);
                return;
            }

            setStudentReqs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Network connectivity issue:", error);
            alert("Failed to connect to backend API service layer.");
        }
    }, []);

    const handleDeepLink = useCallback(async (targetId, fallbackStudentId, fallbackReqName) => {
        const primaryId = targetId || fallbackStudentId;
        if (!primaryId) return;

        setActiveTab('student');

        let foundStudentId = null;
        let reqNameToHighlight = fallbackReqName || null;

        try {
            const res = await fetch(`http://localhost:3001/api/submissions/${primaryId}`);
            if (res.ok) {
                const data = await res.json();
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
        } catch (err) {
            console.warn("Identifier resolution as submission_id failed:", err);
        }

        const targetStudentId = fallbackStudentId || foundStudentId || primaryId;
        if (targetStudentId) {
            try {
                const studentRes = await fetch(`http://localhost:3001/api/students/${targetStudentId}`);
                if (studentRes.ok) {
                    const studentData = await studentRes.json();
                    const studentObj = studentData.student || studentData.data || (studentData.student_id ? studentData : null);
                    if (studentObj && studentObj.student_id) {
                        setSelectedStudent(studentObj);
                        setHighlightedReqName(reqNameToHighlight);
                        fetchStudentFullRequirements(studentObj.student_id);
                        return;
                    }
                }
            } catch (err) {
                console.warn("Direct student fetch failed, searching full student list...", err);
            }

            try {
                const res = await fetch('http://localhost:3001/api/students');
                if (res.ok) {
                    const studentList = await res.json();
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

    // --- CRUD Handlers for Medical Requirements Masterlist ---
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
            `Add "${trimmed}" to the medical requirements masterlist?`,
            async () => {
                try {
                    const response = await fetch('http://localhost:3001/api/medical-requirements', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requirement_name: trimmed })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        setMedReqError(data.error || "Failed to add medical requirement.");
                        return;
                    }

                    setNewMedReqName('');
                    setMedReqError('');
                    fetchMedicalRequirements();
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
            alert("Requirement name cannot be empty.");
            return;
        }

        if (trimmed.toLowerCase() !== oldName.toLowerCase()) {
            const exists = medicalRequirements.some(
                req => req.requirement_name.toLowerCase() === trimmed.toLowerCase()
            );
            if (exists) {
                alert(`Duplicate Error: Requirement "${trimmed}" already exists.`);
                return;
            }
        }

        openConfirmModal(
            "Update Medical Requirement",
            `Rename medical requirement "${oldName}" to "${trimmed}" across all system configurations?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/medical-requirements/${encodeURIComponent(oldName)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requirement_name: trimmed })
                    });

                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        alert(data.error || "Failed to update requirement.");
                        return;
                    }

                    setEditingMedReq(null);
                    fetchMedicalRequirements();
                    fetchProgramConfigs();
                } catch (error) {
                    console.error("Error updating medical requirement:", error);
                    alert("Network error updating requirement.");
                }
            },
            "Save Changes",
            "primary"
        );
    };

    const handleDeleteMedicalRequirement = (reqName) => {
        openConfirmModal(
            "Delete Medical Requirement",
            `Are you sure you want to delete "${reqName}" from the medical requirements masterlist?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/medical-requirements/${encodeURIComponent(reqName)}`, {
                        method: 'DELETE'
                    });

                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        alert(data.error || "Failed to delete requirement.");
                        return;
                    }

                    fetchMedicalRequirements();
                } catch (error) {
                    console.error("Error deleting medical requirement:", error);
                    alert("Network error deleting requirement.");
                }
            },
            "Delete",
            "danger"
        );
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
            alert("Requirement Name and Deadline are required.");
            return;
        }

        openConfirmModal(
            "Assign Special Requirement",
            `Assign special requirement "${newReqInput.name.trim()}" to ${selectedStudent.first_name} ${selectedStudent.last_name}?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/students/${selectedStudent.student_id}/special-requirements`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            requirement_name: newReqInput.name.trim(),
                            submission_deadline: newReqInput.deadline,
                            allow_late_submission: newReqInput.allowLate,
                            nurse_id: nurseId || 'UNKNOWN_NURSE'
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok || !data.success) {
                        alert(`Database Failure: ${data.error || 'The server rejected this special context entry payload.'}`);
                        return;
                    }
                    
                    setNewReqInput({ name: '', deadline: '', allowLate: false });
                    setIsAddModalOpen(false);
                    
                    fetchStudentFullRequirements(selectedStudent.student_id);
                    fetchStudents();
                    fetchMedicalRequirements();
                } catch (error) {
                    console.error("Error adding special requirement:", error);
                    alert("Network failure: Could not reach target API server gateway.");
                }
            },
            "Assign Requirement",
            "primary"
        );
    };

    const handleUpdateRequirement = async (studentId, reqName, updatePayload) => {
        if (!studentId || studentId === 'undefined' || studentId === '') {
            alert("Error: Cannot update. The app lost track of this student's reference ID.");
            return;
        }

        openConfirmModal(
            "Save Requirement Parameter Updates",
            `Apply changes to requirement "${reqName}" for this student profile?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/students/${studentId}/requirements/${encodeURIComponent(reqName)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...updatePayload,
                            nurse_id: nurseId || 'UNKNOWN_NURSE'
                        }),
                    });

                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        alert(`Failed to update: ${data.error || 'Server error encountered.'}`);
                    } else {
                        setEditingReq(null);
                        fetchStudentFullRequirements(studentId);
                        fetchStudents();
                    }
                } catch (error) {
                    console.error("Networking payload exception:", error);
                    alert("Network error processing update request.");
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
                    await fetch(`http://localhost:3001/api/students/${selectedStudent.student_id}/special-requirements/${encodeURIComponent(reqName)}`, {
                        method: 'DELETE'
                    });
                    fetchStudentFullRequirements(selectedStudent.student_id);
                    fetchStudents();
                } catch (error) {
                    console.error("Error deleting special requirement:", error);
                }
            },
            "Delete",
            "danger"
        );
    };

    const handleInitializeInlineState = (programId, field, value) => {
        setProgramInlineInputs(prev => ({
            ...prev,
            [programId]: {
                ...(prev[programId] || { name: '', year_level: '', deadline: '', allowLate: false }),
                [field]: value
            }
        }));
    };

    const addProgramRequirement = async (programId) => {
        const targetInput = programInlineInputs[programId] || {};
        const reqName = targetInput.name;
        const yearLevel = targetInput.year_level;
        const deadline = targetInput.deadline;
        const allowLate = targetInput.allowLate || false;

        if (!reqName || !reqName.trim() || !deadline) {
            alert("Please select a Requirement Name and Target Deadline.");
            return;
        }

        const trimmedReqName = reqName.trim();

        const isDuplicateInProgram = programConfigs.some(
            c => String(c.program_id) === String(programId) && 
                 c.requirement_name.toLowerCase() === trimmedReqName.toLowerCase() &&
                 (
                     !c.year_level || 
                     !yearLevel || 
                     String(c.year_level) === String(yearLevel)
                 )
        );

        if (isDuplicateInProgram) {
            alert(`Duplicate Error: Requirement "${trimmedReqName}" is already assigned to this program.`);
            return;
        }

        openConfirmModal(
            "Add Program Requirement",
            `Add requirement "${trimmedReqName}" to this program configuration?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/programs/${programId}/requirements`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            requirement_name: trimmedReqName,
                            year_level: yearLevel,
                            submission_deadline: deadline,
                            allow_late_submission: allowLate
                        })
                    });

                    if (!response.ok) {
                        const errData = await response.json();
                        alert(errData.error || "An error occurred adding the program requirement.");
                        return;
                    }

                    setProgramInlineInputs(prev => ({
                        ...prev,
                        [programId]: { name: '', year_level: '', deadline: '', allowLate: false }
                    }));
                    
                    await fetchProgramConfigs();
                    fetchMedicalRequirements();
                } catch (error) {
                    console.error("Error adding program requirement:", error);
                    alert("Network error processing request.");
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
            alert("Requirement name and target deadline cannot be blank.");
            return;
        }

        openConfirmModal(
            "Save Configuration Changes",
            `Update settings for "${inlineEditForm.requirement_name.trim()}" in this program track?`,
            async () => {
                try {
                    const response = await fetch(`http://localhost:3001/api/programs/${programId}/requirements/${configId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            requirement_name: inlineEditForm.requirement_name,
                            year_level: inlineEditForm.year_level,
                            submission_deadline: inlineEditForm.submission_deadline,
                            allow_late_submission: inlineEditForm.allow_late_submission
                        })
                    });

                    if (response.ok) {
                        setInlineEditingConfigId(null);
                        await fetchProgramConfigs();
                    } else {
                        alert("Failed to save changes.");
                    }
                } catch (err) {
                    console.error("Failed saving adjustment changes:", err);
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
                    await fetch(`http://localhost:3001/api/programs/${programId}/requirements/${configId}`, {
                        method: 'DELETE'
                    });
                    await fetchProgramConfigs();
                } catch (error) {
                    console.error("Error deleting program requirement:", error);
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
            {/* HEADER SECTION WITH TOP RIGHT BUTTON FOR MEDICAL REQUIREMENTS CRUD */}
            <div className="req-header-section-rm">
                <div>
                    <h2>Requirement Management</h2>
                    <p>Configure structural compliance pipelines and monitor student submissions</p>
                </div>
                <button 
                    className="btn-manage-med-reqs-rm"
                    onClick={() => {
                        setIsMedReqModalOpen(true);
                        setMedReqError('');
                    }}
                >
                    <FileText size={16} /> Manage Medical Requirements
                </button>
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
                                placeholder="Search by student name, ID, section..." 
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
                                            No student records matched the active search and filter criteria.
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
                        const currentInline = programInlineInputs[prog.program_id] || { name: '', year_level: '', deadline: '', allowLate: false };
                        const progYearLevelOptions = getYearLevelOptions(prog);

                        return (
                            <div className="program-card-rm" key={prog.program_id}>
                                <div className="program-header-rm">
                                    <h3>{prog.program_name}</h3>
                                    <button 
                                        className="btn-edit-toggle-rm" 
                                        onClick={() => setIsNewMode({...isNewMode, [prog.program_id]: !isNewMode[prog.program_id]})}
                                    >
                                        {isNewMode[prog.program_id] ? <><X size={14} /> Close</> : <><Edit size={14} /> Edit</>}
                                    </button>
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
                                                                <span><Calendar size={12}/> Target: {formattedDeadline}</span>
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

                                {isNewMode[prog.program_id] && (
                                    <div className="add-req-inline-rm">
                                        <h4><Plus size={14}/> Construct New Requirement</h4>
                                        <div className="inline-add-inputs-rm">
                                            <select 
                                                value={currentInline.name || ''}
                                                onChange={(e) => handleInitializeInlineState(prog.program_id, 'name', e.target.value)}
                                                className="flex-2-rm filter-select-rm"
                                            >
                                                <option value="">-- Select Medical Requirement --</option>
                                                {medicalRequirements.map((medReq, idx) => (
                                                    <option key={medReq.requirement_name || idx} value={medReq.requirement_name}>
                                                        {medReq.requirement_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <select 
                                                value={currentInline.year_level || ''}
                                                onChange={(e) => handleInitializeInlineState(prog.program_id, 'year_level', e.target.value)}
                                                className="flex-1-rm filter-select-rm"
                                            >
                                                <option value="">Year Level</option>
                                                {progYearLevelOptions.map(y => (
                                                    <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>
                                                ))}
                                            </select>
                                            <input 
                                                type="date"
                                                value={currentInline.deadline || ''}
                                                onChange={(e) => handleInitializeInlineState(prog.program_id, 'deadline', e.target.value)}
                                                className="flex-1-rm"
                                            />
                                        </div>
                                        <div className="inline-add-footer-rm">
                                            <label className="checkbox-label-rm">
                                                <input 
                                                    type="checkbox"
                                                    checked={currentInline.allowLate || false}
                                                    onChange={(e) => handleInitializeInlineState(prog.program_id, 'allowLate', e.target.checked)}
                                                /> Allow post-deadline submissions
                                            </label>
                                            <button onClick={() => addProgramRequirement(prog.program_id)} className="btn-add-rm">Add Config</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: MEDICAL REQUIREMENTS MASTERLIST (CRUD) */}
            {isMedReqModalOpen && (
                <div className="modal-overlay-rm">
                    <div className="modal-content-rm medium-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>Manage Medical Requirements</h3>
                                <p className="modal-subtitle-rm">Masterlist defined in `medical_requirements` table</p>
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
                                    <div className="modal-toolbar-rm">
                                        <button className="btn-add-primary-rm" onClick={() => setIsAddModalOpen(true)}>
                                            <Plus size={16}/> Assign Special Requirement
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
                                                                    <Calendar size={13}/> Target: {formatDeadlineDate(req.submission_deadline)} 
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
                                        alert("Cannot mark requirement as Completed or Rejected without an uploaded document file.");
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

            {/* CONFIRMATION MODAL FOR ALL CRUD OPERATIONS */}
            {confirmModal.isOpen && (
                <div className="modal-overlay-rm confirm-overlay-rm">
                    <div className="modal-content-rm confirm-modal-rm">
                        <div className="modal-header-rm">
                            <div>
                                <h3>{confirmModal.title || "Confirm Action"}</h3>
                            </div>
                            <button onClick={closeConfirmModal} className="btn-close-rm" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body-rm">
                            <p className="confirm-message-rm">{confirmModal.message}</p>
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
                                    {confirmModal.confirmText || "Confirm"}
                                </button>
                                <button onClick={closeConfirmModal} className="btn-cancel-rm">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequirementManagement;