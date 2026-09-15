import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Search, Calendar, Edit, Trash2, X, Plus, FileText, 
    CheckCircle, Clock, FileCheck, Filter 
} from 'lucide-react';
import '../../styles/nurse/RequirementManagement.css';

const RequirementManagement = () => {
    const { nurseId } = useOutletContext();
    const [activeTab, setActiveTab] = useState('student');
    const [students, setStudents] = useState([]);
    
    // Filter States - Default statusFilter set to 'default' (Waiting & Incomplete only)
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('default'); 
    const [courseFilter, setCourseFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');

    // Program Configuration States
    const [programs, setPrograms] = useState([]);
    const [programConfigs, setProgramConfigs] = useState([]);
    const [isNewMode, setIsNewMode] = useState({});

    // Inline inputs tracking per program configuration updates
    const [programInlineInputs, setProgramInlineInputs] = useState({});
    const [inlineEditingConfigId, setInlineEditingConfigId] = useState(null);
    const [inlineEditForm, setInlineEditForm] = useState({ requirement_name: '', year_level: '', submission_deadline: '', allow_late_submission: false });

    // Active Modals Data Anchors
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentReqs, setStudentReqs] = useState([]);
    
    // Add Special Requirement context hooks
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newReqInput, setNewReqInput] = useState({ name: '', deadline: '', allowLate: false });

    // Nested Requirement Editor Configuration State
    const [editingReq, setEditingReq] = useState(null);

    useEffect(() => {
        fetchStudents();
        fetchPrograms();
        fetchProgramConfigs();
    }, []);

    const fetchStudents = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/students');
            const data = await res.json();
            setStudents(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    };

    const fetchPrograms = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/programs');
            const data = await res.json();
            setPrograms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching programs:", error);
        }
    };

    const fetchProgramConfigs = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/program-requirements-config');
            const data = await res.json();
            setProgramConfigs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching program configs:", error);
        }
    };

    const fetchStudentFullRequirements = async (studentId) => {
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
            alert("Failed to connect to backend api service layer.");
        }
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
        fetchStudentFullRequirements(student.student_id);
    };

    const handleAddSpecialRequirement = async () => {
        if (!newReqInput.name || !newReqInput.deadline) {
            alert("Requirement Name and Deadline are required.");
            return;
        }

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
            
            alert("Special requirement successfully saved and tracker synchronized!");
            setNewReqInput({ name: '', deadline: '', allowLate: false });
            setIsAddModalOpen(false);
            
            fetchStudentFullRequirements(selectedStudent.student_id);
            fetchStudents();
        } catch (error) {
            console.error("Error adding special requirement:", error);
            alert("Network failure: Could not reach target API server gateway.");
        }
    };

    const handleUpdateRequirement = async (studentId, reqName, updatePayload) => {
        if (!studentId || studentId === 'undefined' || studentId === '') {
            console.error("Aborted Fetch: Missing valid student identifier string.", { studentId });
            alert("Error: Cannot update. The app lost track of this student's reference ID.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/students/${studentId}/requirements/${encodeURIComponent(reqName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                alert(`Failed to update: ${data.error || 'Server error encountered.'}`);
            } else {
                alert("Requirement successfully saved!");
                setEditingReq(null);
                fetchStudentFullRequirements(studentId);
                fetchStudents();
            }
        } catch (error) {
            console.error("Networking payload exception:", error);
            alert("Network error processing update request.");
        }
    };

    const handleDeleteSpecialRequirement = async (reqName) => {
        if (!window.confirm(`Delete special requirement: ${reqName}?`)) return;

        try {
            await fetch(`http://localhost:3001/api/students/${selectedStudent.student_id}/special-requirements/${encodeURIComponent(reqName)}`, {
                method: 'DELETE'
            });
            alert("Requirement record removed.");
            fetchStudentFullRequirements(selectedStudent.student_id);
            fetchStudents();
        } catch (error) {
            console.error("Error deleting special requirement:", error);
        }
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
            alert("Please provide a Requirement Name and Target Deadline.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/programs/${programId}/requirements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    requirement_name: reqName.trim(),
                    year_level: yearLevel,
                    submission_deadline: deadline,
                    allow_late_submission: allowLate
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                alert(errData.error || "An error occurred.");
                return;
            }

            setProgramInlineInputs(prev => ({
                ...prev,
                [programId]: { name: '', year_level: '', deadline: '', allowLate: false }
            }));
            
            alert("Program requirement added successfully.");
            await fetchProgramConfigs();
        } catch (error) {
            console.error("Error adding program requirement:", error);
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
            alert("Requirement name and target deadline cannot be blank.");
            return;
        }

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
                alert("Program configuration altered successfully.");
                setInlineEditingConfigId(null);
                await fetchProgramConfigs();
            } else {
                alert("Failed to save changes.");
            }
        } catch (err) {
            console.error("Failed saving adjustment changes:", err);
        }
    };

    const deleteProgramRequirement = async (programId, configId, reqName) => {
        if (!window.confirm(`Permanently delete "${reqName}" from this program track?`)) return;

        try {
            await fetch(`http://localhost:3001/api/programs/${programId}/requirements/${configId}`, {
                method: 'DELETE'
            });
            alert("Requirement deleted.");
            await fetchProgramConfigs();
        } catch (error) {
            console.error("Error deleting program requirement:", error);
        }
    };

    const calculateOverdueDays = (deadline, submittedAt, status) => {
        if (!deadline) return null;
        const normalizedStatus = status ? status.toLowerCase() : '';
        
        if (normalizedStatus === 'submitted' || normalizedStatus === 'waiting for approval' || normalizedStatus === 'completed' || normalizedStatus === 'submitted late' || normalizedStatus === 'late') return null;
        
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
            case 'missing':
            case 'not submitted':
                return { color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
            case 'pending':
            default:
                return { color: '#ca8a04', backgroundColor: '#fef9c3', border: '1px solid #fde047' };
        }
    };

    // Ensure 1st, 2nd, 3rd, and 4th year are ALWAYS included explicitly along with any dynamic year level values
    const standardYears = [1, 2, 3, 4];
    const fetchedYears = students.map(s => Number(s.year_level)).filter(y => !isNaN(y) && y > 0);
    const availableYearLevels = Array.from(new Set([...standardYears, ...fetchedYears])).sort((a, b) => a - b);

    // Dynamic Filtering & Sorting Logic
    const filteredStudents = students
        .filter(student => {
            const term = searchTerm.toLowerCase();
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
            const matchesSearch = 
                fullName.includes(term) || 
                student.student_id?.toLowerCase().includes(term) ||
                student.program_id?.toLowerCase().includes(term);

            if (!matchesSearch) return false;

            // Course / Program Filter
            if (courseFilter !== 'all' && student.program_id !== courseFilter) {
                return false;
            }

            // Year Level Filter
            if (yearFilter !== 'all' && String(student.year_level) !== String(yearFilter)) {
                return false;
            }

            // Status Filter Processing
            const stats = student.stats || {};
            const isComplete = stats.total > 0 && Number(stats.completed) === Number(stats.total);
            const hasWaiting = Number(stats.submitted || 0) > 0 || Number(stats.late || 0) > 0 || Number(stats.waiting || 0) > 0;
            const isIncomplete = !isComplete;

            // DEFAULT RULE: Show ONLY Waiting for Approval & Incomplete students by default
            if (statusFilter === 'default') {
                if (!hasWaiting && !isIncomplete) return false; // Hide 100% complete with no waiting items
            } else if (statusFilter === 'waiting') {
                if (!hasWaiting) return false;
            } else if (statusFilter === 'incomplete') {
                if (!isIncomplete) return false;
            } else if (statusFilter === 'complete') {
                if (!isComplete) return false;
            } else if (statusFilter === 'rejected') {
                if (!(Number(stats.rejected) > 0)) return false;
            } else if (statusFilter === 'missing') {
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

            const aComplete = (aStats.total > 0 && Number(aStats.completed) === Number(aStats.total)) ? 1 : 0;
            const bComplete = (bStats.total > 0 && Number(bStats.completed) === Number(bStats.total)) ? 1 : 0;

            return aComplete - bComplete;
        });

    // Metric Counts
    const submittedRequirementsCount = students.filter(s => 
        s.stats && (Number(s.stats.submitted || 0) > 0 || Number(s.stats.late || 0) > 0 || Number(s.stats.waiting || 0) > 0)
    ).length;

    const completeStudentsCount = students.filter(s => 
        s.stats && s.stats.total > 0 && Number(s.stats.completed) === Number(s.stats.total)
    ).length;

    const incompleteStudentsCount = students.length - completeStudentsCount;

    return (
        <div className="req-container">
            <h2>Requirement Management</h2>
            <p>Configure structural compliance pipelines and monitor student submissions</p>

            <div className="tabs">
                <button className={activeTab === 'student' ? 'active' : ''} onClick={() => setActiveTab('student')}>Student Requirements</button>
                <button className={activeTab === 'course' ? 'active' : ''} onClick={() => setActiveTab('course')}>Course / Strand Requirements</button>
            </div>

            {/* VIEW: MAIN STUDENT MATRIX */}
            {activeTab === 'student' && (
                <div className="tab-content">
                    
                    {/* DASHBOARD CARDS */}
                    <div className="dashboard-summary-cards">
                        <div 
                            className={`summary-card ${statusFilter === 'waiting' ? 'active-card-filter' : ''}`}
                            onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'default' : 'waiting')}
                            title="Click to filter students waiting for approval"
                        >
                            <div className="summary-card-number text-blue">{submittedRequirementsCount}</div>
                            <div className="summary-card-label">Waiting for Approval</div>
                        </div>
                        <div 
                            className={`summary-card ${statusFilter === 'incomplete' ? 'active-card-filter' : ''}`}
                            onClick={() => setStatusFilter(statusFilter === 'incomplete' ? 'default' : 'incomplete')}
                            title="Click to filter incomplete students"
                        >
                            <div className="summary-card-number text-orange">{incompleteStudentsCount}</div>
                            <div className="summary-card-label">Incomplete</div>
                        </div>
                        <div 
                            className={`summary-card ${statusFilter === 'complete' ? 'active-card-filter' : ''}`}
                            onClick={() => setStatusFilter(statusFilter === 'complete' ? 'default' : 'complete')}
                            title="Click to filter complete students"
                        >
                            <div className="summary-card-number text-green">{completeStudentsCount}</div>
                            <div className="summary-card-label">Complete</div>
                        </div>
                    </div>

                    {/* FILTER TOOLBAR */}
                    <div className="filter-toolbar">
                        <div className="search-wrapper">
                            <Search className="search-icon" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search by student name, ID..." 
                                className="search-bar" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <Filter size={16} style={{ color: '#6b7280' }} />
                            
                            {/* Course / Program Filter */}
                            <select 
                                value={courseFilter} 
                                onChange={(e) => setCourseFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Courses / Strands</option>
                                {programs.map(p => (
                                    <option key={p.program_id} value={p.program_id}>
                                        {p.program_name || p.program_id}
                                    </option>
                                ))}
                            </select>

                            {/* Year Level Filter (Includes 1st, 2nd, 3rd, 4th Year) */}
                            <select 
                                value={yearFilter} 
                                onChange={(e) => setYearFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Year Levels</option>
                                {availableYearLevels.map(y => (
                                    <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>
                                ))}
                            </select>

                            {/* Status Filter (Default set to Waiting & Incomplete) */}
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="default">Default (Waiting & Incomplete)</option>
                                <option value="all">All Statuses (Including Complete)</option>
                                <option value="waiting">Waiting for Approval Only</option>
                                <option value="incomplete">Incomplete Only</option>
                                <option value="complete">Complete Only</option>
                                <option value="missing">Missing</option>
                                <option value="rejected">Rejected</option>
                                <option value="resubmit">Resubmit</option>
                            </select>

                            {(courseFilter !== 'all' || yearFilter !== 'all' || statusFilter !== 'default' || searchTerm !== '') && (
                                <button 
                                    onClick={() => {
                                        setCourseFilter('all');
                                        setYearFilter('all');
                                        setStatusFilter('default');
                                        setSearchTerm('');
                                    }}
                                    className="btn-clear-filters"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Course/Year</th>
                                    <th>Requirements Overview</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map(student => (
                                        <tr key={student.student_id}>
                                            <td>
                                                <b>{student.first_name} {student.last_name}</b><br/>
                                                <small className="text-muted">{student.student_id}</small>
                                            </td>
                                            <td>
                                                {student.program_id} <br/> 
                                                <small className="text-muted">
                                                    {student.year_level}{Number(student.year_level) === 1 ? 'st' : Number(student.year_level) === 2 ? 'nd' : Number(student.year_level) === 3 ? 'rd' : 'th'} Year
                                                </small>
                                            </td>
                                            <td>
                                                {student.stats && (
                                                    <div className="stats-overview">
                                                        <div>
                                                            {Number(student.stats.completed) === Number(student.stats.total) && Number(student.stats.total) > 0 ? (
                                                                <span className="stat-complete">
                                                                    <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }}/> 
                                                                    {student.stats.completed}/{student.stats.total} Complete
                                                                </span>
                                                            ) : (
                                                                <span className="stat-incomplete">
                                                                    <Clock size={14} style={{ display: 'inline', marginRight: '4px' }}/> 
                                                                    {student.stats.completed}/{student.stats.total} Incomplete
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="status-tags-container">
                                                            {/* Explicitly show 'Waiting for Approval' count */}
                                                            {(Number(student.stats.waiting || 0) > 0 || (Number(student.stats.submitted || 0) + Number(student.stats.late || 0)) > 0) && (
                                                                <span className="status-tag-chip chip-waiting">
                                                                    <Clock size={12} style={{ display: 'inline', marginRight: '3px' }}/>
                                                                    {student.stats.waiting ?? (Number(student.stats.submitted || 0) + Number(student.stats.late || 0))} Waiting for Approval
                                                                </span>
                                                            )}
                                                            {student.stats.resubmit > 0 && (
                                                                <span className="status-tag-chip chip-resubmit">
                                                                    {student.stats.resubmit} Resubmit
                                                                </span>
                                                            )}
                                                            {student.stats.rejected > 0 && (
                                                                <span className="status-tag-chip chip-rejected">
                                                                    {student.stats.rejected} Rejected
                                                                </span>
                                                            )}
                                                            {(Number(student.stats.noSubmission) > 0 || Number(student.stats.notSubmitted) > 0) && (
                                                                <span className="status-tag-chip chip-missing">
                                                                    {student.stats.noSubmission || student.stats.notSubmitted} Missing
                                                                </span>
                                                            )}
                                                            {Number(student.stats.pending) > 0 && (
                                                                <span className="status-tag-chip chip-pending">
                                                                    {student.stats.pending} Pending
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <button onClick={() => handleManageStudent(student)} className="btn-manage">Manage</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="empty-table-cell">
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
                <div className="tab-content course-grid">
                    {programs.map(prog => {
                        const assignedConfigs = programConfigs.filter(config => config.program_id === prog.program_id);
                        const currentInline = programInlineInputs[prog.program_id] || { name: '', year_level: '', deadline: '', allowLate: false };

                        return (
                            <div className="program-card" key={prog.program_id}>
                                <div className="program-header">
                                    <h3>{prog.program_name}</h3>
                                    <button 
                                        className="btn-edit-toggle" 
                                        onClick={() => setIsNewMode({...isNewMode, [prog.program_id]: !isNewMode[prog.program_id]})}
                                    >
                                        {isNewMode[prog.program_id] ? <><X size={14} /> Close</> : <><Edit size={14} /> Edit</>}
                                    </button>
                                </div>
                                
                                <ul className="req-list">
                                    {assignedConfigs.map((req, index) => {
                                        const isThisRowBeingEdited = inlineEditingConfigId === req.config_id;
                                        const formattedDeadline = req.submission_deadline ? formatDeadlineDate(req.submission_deadline) : 'No Target Set';
                                        
                                        return (
                                            <li key={req.config_id || index} className="req-item">
                                                {!isThisRowBeingEdited ? (
                                                    <div className="req-item-content">
                                                        <div className="req-item-details">
                                                            <span className="req-text">
                                                                <FileCheck size={16} className="check-icon"/>  
                                                                <b>{req.requirement_name}</b>  
                                                                {req.year_level && <span className="year-badge">Year {req.year_level}</span>}
                                                            </span>
                                                            <div className="req-meta">
                                                                <span><Calendar size={12}/> Target: {formattedDeadline}</span>
                                                                <span className={`late-badge ${req.allow_late_submission ? 'allowed' : 'blocked'}`}>
                                                                    {req.allow_late_submission ? 'Late Allowed' : 'Late Blocked'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {isNewMode[prog.program_id] && (
                                                            <div className="req-actions">
                                                                <button onClick={() => startInlineEditingConfig(req)} className="btn-icon btn-edit"><Edit size={14}/></button>
                                                                <button onClick={() => deleteProgramRequirement(prog.program_id, req.config_id, req.requirement_name)} className="btn-icon btn-delete-x"><Trash2 size={14}/></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="inline-edit-box">
                                                        <div className="inline-edit-inputs">
                                                            <input 
                                                                type="text" 
                                                                value={inlineEditForm.requirement_name}
                                                                onChange={(e) => setInlineEditForm({...inlineEditForm, requirement_name: e.target.value})}
                                                                className="flex-2"
                                                                placeholder="Requirement Name"
                                                            />
                                                            <select 
                                                                value={inlineEditForm.year_level}
                                                                onChange={(e) => setInlineEditForm({...inlineEditForm, year_level: e.target.value})}
                                                                className="flex-1 filter-select"
                                                            >
                                                                <option value="">Year Level</option>
                                                                {availableYearLevels.map(y => (
                                                                    <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>
                                                                ))}
                                                            </select>
                                                            <input 
                                                                type="date" 
                                                                value={inlineEditForm.submission_deadline}
                                                                onChange={(e) => setInlineEditForm({...inlineEditForm, submission_deadline: e.target.value})}
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                        <div className="inline-edit-footer">
                                                            <label>
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={inlineEditForm.allow_late_submission}
                                                                    onChange={(e) => setInlineEditForm({...inlineEditForm, allow_late_submission: e.target.checked})}
                                                                /> Allow late submission
                                                            </label>
                                                            <div className="inline-edit-actions">
                                                                <button onClick={() => saveInlineRequirementUpdate(prog.program_id, req.config_id)} className="btn-save-sm">Save</button>
                                                                <button onClick={() => setInlineEditingConfigId(null)} className="btn-cancel-sm">Cancel</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>

                                {isNewMode[prog.program_id] && (
                                    <div className="add-req-inline">
                                        <h4><Plus size={14}/> Construct New Requirement</h4>
                                        <div className="inline-add-inputs">
                                            <input 
                                                type="text" 
                                                placeholder="Label Title..." 
                                                value={currentInline.name || ''}
                                                onChange={(e) => handleInitializeInlineState(prog.program_id, 'name', e.target.value)}
                                                className="flex-2"
                                            />
                                            <select 
                                                value={currentInline.year_level || ''}
                                                onChange={(e) => handleInitializeInlineState(prog.program_id, 'year_level', e.target.value)}
                                                className="flex-1 filter-select"
                                            >
                                                <option value="">Year Level</option>
                                                {availableYearLevels.map(y => (
                                                    <option key={y} value={y}>{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</option>
                                                ))}
                                            </select>
                                            <input 
                                                type="date"
                                                value={currentInline.deadline || ''}
                                                onChange={(e) => handleInitializeInlineState(prog.program_id, 'deadline', e.target.value)}
                                                className="flex-1"
                                            />
                                        </div>
                                        <div className="inline-add-footer">
                                            <label>
                                                <input 
                                                    type="checkbox"
                                                    checked={currentInline.allowLate || false}
                                                    onChange={(e) => handleInitializeInlineState(prog.program_id, 'allowLate', e.target.checked)}
                                                /> Allow post-deadline submissions
                                            </label>
                                            <button onClick={() => addProgramRequirement(prog.program_id)} className="btn-add">Add Config</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: SELECTED STUDENT CONTROL BOARD */}
            {selectedStudent && (
                <div className="modal-overlay">
                    <div className="modal-content large-modal">
                        <div className="modal-header">
                            <h3>Manage Submissions — {selectedStudent.first_name} {selectedStudent.last_name}</h3>
                            <button onClick={() => setSelectedStudent(null)} className="btn-close"><X size={20}/></button>
                        </div>
                        
                        {!isAddModalOpen ? (
                            <>
                                <button className="btn-add-primary" onClick={() => setIsAddModalOpen(true)}>
                                    <Plus size={16}/> Assign Special Requirement
                                </button>
                                
                                <div className="student-req-list">
                                    {studentReqs.map((req, i) => {
                                        const overdueDays = calculateOverdueDays(req.submission_deadline, req.submitted_at, req.status);
                                        const isSpecial = req.type === 'Special';
                                        const isLateAllowed = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';

                                        const normalizedStatus = req.status?.toLowerCase();
                                        const displayStatus = (normalizedStatus === 'submitted' || normalizedStatus === 'submitted late' || normalizedStatus === 'late')
                                            ? 'Waiting for approval' 
                                            : (normalizedStatus === 'not submitted' ? 'Missing' : (req.status || 'Pending'));

                                        const sanitizedStatusClass = req.status 
                                            ? String(req.status).toLowerCase().replace(/\s+/g, "-") 
                                            : "pending";

                                        return (
                                            <div className="req-card" key={req.requirement_name || i}>
                                                <div className="req-card-header">
                                                    <div>
                                                        <h4><FileText size={16} className="req-icon"/> {req.requirement_name || "Unnamed Requirement"} <span className="tag">{req.type || 'Standard'} Field</span></h4>
                                                        
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', marginBottom: '4px' }}>
                                                            <span 
                                                                className={`status-badge ${sanitizedStatusClass}`}
                                                                style={{
                                                                    padding: '2px 8px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.8rem',
                                                                    ...getStatusStyle(req.status)
                                                                }}
                                                            >
                                                                {displayStatus}
                                                            </span>
                                                            
                                                            <span className={`late-badge ${isLateAllowed ? 'allowed' : 'blocked'}`} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>
                                                                {isLateAllowed ? 'Late Allowed' : 'Late Blocked'}
                                                            </span>
                                                        </div>
                                                        
                                                        {req.submission_deadline && (
                                                            <div className="deadline-info">
                                                                <Calendar size={14}/> Deadline: {formatDeadlineDate(req.submission_deadline)} 
                                                                {overdueDays && <span className="overdue-text"> ({overdueDays}d overdue)</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="card-actions">
                                                        <button className="btn-edit" onClick={() => setEditingReq({
                                                            ...req,
                                                            status: req.status || 'Pending',
                                                            override_allow_late_submission: isLateAllowed
                                                        })}><Edit size={14}/></button>
                                                        {isSpecial && (
                                                            <button className="btn-delete" onClick={() => handleDeleteSpecialRequirement(req.requirement_name)}><Trash2 size={14}/></button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="req-card-body">
                                                    <div className="attachment-section">
                                                        <b>Attached Document:</b> {req.file_url ? (
                                                            <a href={req.file_url} target="_blank" rel="noreferrer">Open Asset Attachment</a>
                                                        ) : (
                                                            <span className="no-file-text">No document file delivered</span>
                                                        )}
                                                    </div>
                                                    {req.nurse_remarks && (
                                                        <div className="nurse-comment">
                                                            Nurse Remarks: {req.nurse_remarks}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="add-special-req-form">
                                <h4>Add Special Requirement to Student Profile</h4>
                                <input 
                                    type="text" 
                                    placeholder="Requirement Name"
                                    value={newReqInput.name}
                                    onChange={e => setNewReqInput({...newReqInput, name: e.target.value})}
                                />
                                <input 
                                    type="date" 
                                    value={newReqInput.deadline}
                                    onChange={e => setNewReqInput({...newReqInput, deadline: e.target.value})}
                                />
                                <label className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        checked={newReqInput.allowLate}
                                        onChange={e => setNewReqInput({...newReqInput, allowLate: e.target.checked})}
                                    /> Allow Late Submission
                                </label>
                                <div className="form-actions">
                                    <button onClick={handleAddSpecialRequirement} className="btn-save">Assign to Student</button>
                                    <button onClick={() => setIsAddModalOpen(false)} className="btn-cancel">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* NESTED MODAL: EDIT PARAMETERS */}
            {editingReq && (
                <div className="modal-overlay nested-overlay">
                    <div className="modal-content small-modal">
                        <div className="modal-header">
                            <h3>Modify Student Parameters</h3>
                            <button className="btn-close" onClick={() => setEditingReq(null)}><X size={20}/></button>
                        </div>
                        <p className="subtitle-text" style={{ fontWeight: '600', color: '#4b5563' }}>{editingReq.requirement_name}</p>
                        
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
                            className="edit-req-form"
                        >
                            <div className="form-group">
                                <label>Review Requirement Action Status</label>
                                <select 
                                    value={editingReq.status || 'Pending'} 
                                    onChange={(e) => setEditingReq({...editingReq, status: e.target.value})}
                                    className="form-control"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Not Submitted">Missing</option>
                                    <option value="Completed" disabled={!editingReq.file_url}>
                                        Completed {!editingReq.file_url ? '(File Upload Required)' : ''}
                                    </option>
                                    <option value="Rejected" disabled={!editingReq.file_url}>
                                        Rejected {!editingReq.file_url ? '(File Upload Required)' : ''}
                                    </option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Override Deadline:</label>
                                <input 
                                    type="date" 
                                    value={formatDeadlineDate(editingReq.submission_deadline)} 
                                    onChange={(e) => setEditingReq({...editingReq, submission_deadline: e.target.value})}
                                />
                            </div>

                            <div className="form-group" style={{ marginTop: '12px', marginBottom: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
                                    <input 
                                        type="checkbox" 
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        checked={!!editingReq.override_allow_late_submission} 
                                        onChange={(e) => setEditingReq({
                                            ...editingReq, 
                                            override_allow_late_submission: e.target.checked
                                        })} 
                                    />
                                    Allow Late Submission
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Nurse Remarks / Feedback:</label>
                                <textarea 
                                    value={editingReq.nurse_remarks || ''}  
                                    onChange={(e) => setEditingReq({...editingReq, nurse_remarks: e.target.value})}
                                    placeholder="Add formal remarks profile log text details here..."
                                    rows="3"
                                />
                            </div>

                            <div className="form-actions space-top">
                                <button type="submit" className="btn-save">Save Adjustments</button>
                                <button type="button" className="btn-cancel" onClick={() => setEditingReq(null)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequirementManagement;