import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import jsQR from 'jsqr';
import { 
    UserPlus, 
    Calendar, 
    Clock, 
    FileText, 
    Edit, 
    XCircle, 
    CheckCircle, 
    Stethoscope, 
    UserCheck, 
    Search,
    X,
    AlertCircle,
    QrCode,
    SkipForward
} from 'lucide-react';
import '../../styles/nurse/DoctorVisits.css';

const formatLocalToSQL = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

const DoctorVisit = () => {
    const { nurseId } = useOutletContext() || {};

    const [activeTab, setActiveTab] = useState('upcoming');
    const [doctors, setDoctors] = useState([]);
    const [students, setStudents] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showAssessmentModal, setShowAssessmentModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showScannerModal, setShowScannerModal] = useState(false);

    // Forms
    const [doctorForm, setDoctorForm] = useState({ doctor_id: '', first_name: '', last_name: '', specialization: '', contact_number: '' });
    const [isEditDoctor, setIsEditDoctor] = useState(false);

    const [scheduleForm, setScheduleForm] = useState({
        doctor_id: '',
        target_program: '',    
        target_year_level: '', 
        target_section: '',    
        scheduled_date: '',
        batch_start_time: '',
        batch_end_time: '',
        slot_duration: 15
    });
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [timeSlotCollisions, setTimeSlotCollisions] = useState('');

    const [selectedAppt, setSelectedAppt] = useState(null);
    const [assessmentForm, setAssessmentForm] = useState({
        clinical_findings: '',
        diagnosis: '',
        treatment_recommendations: ''
    });

    const [rescheduleData, setRescheduleData] = useState({
        appointment_id: '',
        student_user_id: '',
        start_time: '',
        end_time: ''
    });

    const [searchTerm, setSearchTerm] = useState('');

    // QR Scanner Refs
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

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

    const fetchPrograms = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/academic-programs');
            const data = await res.json();
            if (data.success) setPrograms(data.programs);
        } catch (err) {
            console.error('Error fetching academic programs:', err);
        }
    };

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/doctor-visits');
            const data = await res.json();
            if (data.success) setAppointments(data.appointments);
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDoctors();
        fetchStudents();
        fetchPrograms();
        fetchAppointments();
    }, [fetchAppointments]);

    const updateAppointmentStatus = useCallback(async (appointmentId, studentId, newStatus) => {
        try {
            const res = await fetch(`http://localhost:3001/api/doctor-visits/status/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                fetchAppointments();
            } else {
                alert(data.message || 'Failed to update status');
            }
        } catch (err) {
            alert('Server error updating status.');
        }
    }, [fetchAppointments]);

    // Automatically evaluate expired Pending appointments as 'Absent' in backend
    useEffect(() => {
        const checkAndSyncExpiredPending = async () => {
            const now = new Date();
            for (const appt of appointments) {
                const rawEnd = appt.end_time;
                const apptEnd = parseSQLDate(rawEnd);
                const attendanceStatus = (appt.attendance_status || 'pending').toLowerCase();
                const apptStatus = (appt.status || 'scheduled').toLowerCase();

                if (
                    apptEnd && 
                    apptEnd < now && 
                    attendanceStatus === 'pending' && 
                    apptStatus !== 'cancelled' && 
                    apptStatus !== 'completed'
                ) {
                    await updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Absent');
                }
            }
        };

        if (appointments.length > 0) {
            checkAndSyncExpiredPending();
        }
    }, [appointments, updateAppointmentStatus]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    const handleScannedCode = useCallback(async (scannedValue) => {
        const appt = appointments.find(
            (a) => a.student_id === scannedValue || a.appointment_id === scannedValue
        );

        if (appt) {
            await updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Present');
            alert(`Student ${appt.student_first_name} ${appt.student_last_name} marked as PRESENT.`);
            setShowScannerModal(false);
        } else {
            alert(`No appointment found matching QR code: "${scannedValue}"`);
            setShowScannerModal(false);
        }
    }, [appointments, updateAppointmentStatus]);

    const scanQRCode = useCallback(() => {
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

                if (code && code.data) {
                    handleScannedCode(code.data.trim());
                    return;
                }
            }
        }
        requestAnimationFrame(scanQRCode);
    }, [handleScannedCode]);

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
                    alert('Camera access denied or unavailable: ' + err.message);
                    setShowScannerModal(false);
                });
        } else {
            stopCamera();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
            stopCamera();
        };
    }, [showScannerModal, scanQRCode]);

    const handleSkipStudent = async (appt) => {
        await updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Pending');
        alert(`Skipped visit for ${appt.student_first_name} ${appt.student_last_name}. Kept on hold as Pending until schedule end time.`);
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
                alert(data.message);
                setShowDoctorModal(false);
                fetchDoctors();
                setDoctorForm({ doctor_id: '', first_name: '', last_name: '', specialization: '', contact_number: '' });
            }
        } catch (err) {
            alert('Error saving doctor details.');
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
            alert('Please select at least one student for scheduling.');
            return;
        }

        const startDT = new Date(`${scheduleForm.scheduled_date}T${scheduleForm.batch_start_time}:00`);
        const endDT = new Date(`${scheduleForm.scheduled_date}T${scheduleForm.batch_end_time}:00`);

        if (startDT >= endDT) {
            setTimeSlotCollisions('End time must be after start time.');
            return;
        }

        const totalDurationMins = (endDT - startDT) / (1000 * 60);
        const requiredMins = selectedStudentIds.length * parseInt(scheduleForm.slot_duration);

        if (requiredMins > totalDurationMins) {
            setTimeSlotCollisions(`Time window insufficient! Selected students require at least ${requiredMins} mins.`);
            return;
        }

        const studentAppointments = [];
        let currentStart = new Date(startDT.getTime());

        for (let i = 0; i < selectedStudentIds.length; i++) {
            const studentId = selectedStudentIds[i];
            const studentObj = students.find(s => s.student_id === studentId);
            const slotEnd = new Date(currentStart.getTime() + parseInt(scheduleForm.slot_duration) * 60000);

            studentAppointments.push({
                student_id: studentId,
                user_id: studentObj?.user_id || null,
                start_time: formatLocalToSQL(currentStart),
                end_time: formatLocalToSQL(slotEnd)
            });

            currentStart = slotEnd;
        }

        const cleanTargetValue = (val) => (!val || val === 'ALL' ? null : val);

        const payload = {
            assigned_by_nurse_id: nurseId,
            doctor_id: scheduleForm.doctor_id,
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
                alert('Doctor visit mass schedule created successfully!');
                setShowScheduleModal(false);
                setSelectedStudentIds([]);
                setScheduleForm({
                    doctor_id: '',
                    target_program: '',
                    target_year_level: '',
                    target_section: '',
                    scheduled_date: '',
                    batch_start_time: '',
                    batch_end_time: '',
                    slot_duration: 15
                });
                fetchAppointments();
            } else {
                alert(data.message || 'Failed to create schedule');
            }
        } catch (err) {
            alert('Server error creating schedule.');
        }
    };

    const openAssessmentModal = (appt) => {
        setSelectedAppt(appt);
        setAssessmentForm({
            clinical_findings: appt.clinical_findings || '',
            diagnosis: appt.diagnosis || '',
            treatment_recommendations: appt.treatment_recommendations || ''
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
                    ...assessmentForm
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Assessment recorded successfully!');
                setShowAssessmentModal(false);
                fetchAppointments();
            }
        } catch (err) {
            alert('Failed to save assessment.');
        }
    };

    const openRescheduleModal = (appt) => {
        const rawStart = appt.start_time || appt.scheduled_date;
        const rawEnd = appt.end_time;
        const parsedStart = parseSQLDate(rawStart) || new Date();
        const parsedEnd = parseSQLDate(rawEnd) || new Date();

        const formattedStart = parsedStart.toISOString().slice(0, 16);
        const formattedEnd = parsedEnd.toISOString().slice(0, 16);

        setRescheduleData({
            appointment_id: appt.appointment_id,
            student_user_id: appt.student_user_id,
            start_time: formattedStart,
            end_time: formattedEnd
        });
        setShowRescheduleModal(true);
    };

    const handleSaveReschedule = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`http://localhost:3001/api/doctor-visits/reschedule/${rescheduleData.appointment_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_time: rescheduleData.start_time,
                    end_time: rescheduleData.end_time,
                    student_user_id: rescheduleData.student_user_id
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Appointment rescheduled and student notified!');
                setShowRescheduleModal(false);
                fetchAppointments();
            }
        } catch (err) {
            alert('Failed to reschedule.');
        }
    };

    const handleCancelAppointment = async (appt) => {
        if (!window.confirm('Are you sure you want to cancel this doctor visit appointment?')) return;

        try {
            const res = await fetch(`http://localhost:3001/api/doctor-visits/cancel/${appt.appointment_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_user_id: appt.student_user_id })
            });
            const data = await res.json();
            if (data.success) {
                alert('Appointment cancelled and student notified.');
                fetchAppointments();
            }
        } catch (err) {
            alert('Failed to cancel appointment.');
        }
    };

    // TAB FILTERING LOGIC
    const filterAppointmentsByTab = () => {
        const now = new Date();

        return appointments.filter(appt => {
            const rawStart = appt.start_time || appt.scheduled_date;
            const rawEnd = appt.end_time;

            const apptStart = parseSQLDate(rawStart) || now;
            const apptEnd = parseSQLDate(rawEnd) || apptStart;

            const studentName = `${appt.student_first_name || ''} ${appt.student_last_name || ''}`.toLowerCase();
            const docName = `${appt.doc_first_name || ''} ${appt.doc_last_name || ''}`.toLowerCase();
            const studentId = (appt.student_id || '').toLowerCase();

            const matchesSearch = 
                studentName.includes(searchTerm.toLowerCase()) ||
                docName.includes(searchTerm.toLowerCase()) ||
                studentId.includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            const apptStatus = (appt.status || 'scheduled').toLowerCase();
            const attendanceStatus = (appt.attendance_status || 'pending').toLowerCase();
            
            const isFinished = apptStatus === 'completed' || apptStatus === 'cancelled' || attendanceStatus === 'absent';
            const isExpired = apptEnd < now;

            // Past Tab: Completed/cancelled visits, explicitly marked absent, or visits whose end time has passed
            if (activeTab === 'past') {
                return isFinished || isExpired;
            }

            // Ongoing Tab: All active pending/present appointments scheduled for today
            if (activeTab === 'ongoing') {
                if (isFinished || isExpired) return false;
                const isToday = apptStart.toDateString() === now.toDateString();
                return isToday;
            }

            // Upcoming Tab: Active visits scheduled for future dates strictly beyond today
            if (activeTab === 'upcoming') {
                if (isFinished || isExpired || attendanceStatus === 'present') return false;
                const isFutureDate = apptStart.toDateString() > now.toDateString();
                return isFutureDate;
            }

            return true;
        });
    };

    const filteredVisits = filterAppointmentsByTab();

    return (
        <div className="doctor-visit-container">
            {/* Header Section */}
            <div className="dv-header">
                <div>
                    <h2>Doctor Visit Management</h2>
                    <p className="dv-subtitle">Schedule, track, and document student doctor visits.</p>
                </div>
                <div className="dv-header-actions">
                    {activeTab === 'ongoing' && (
                        <button className="sti-btn sti-btn-secondary" onClick={() => setShowScannerModal(true)}>
                            <QrCode size={18} /> Scan QR Attendance
                        </button>
                    )}
                    <button className="sti-btn sti-btn-secondary" onClick={() => { setIsEditDoctor(false); setShowDoctorModal(true); }}>
                        <UserPlus size={18} /> Manage Doctor Profile
                    </button>
                    <button className="sti-btn sti-btn-primary" onClick={() => setShowScheduleModal(true)}>
                        <Calendar size={18} /> Schedule Doctor Visit
                    </button>
                </div>
            </div>

            {/* Doctors Bar */}
            {doctors.length > 0 && (
                <div className="doctors-bar">
                    <span className="doctors-bar-title"><Stethoscope size={16} /> Available Doctors:</span>
                    <div className="doctors-chip-list">
                        {doctors.map(doc => (
                            <div key={doc.doctor_id} className="doctor-chip">
                                <span>Dr. {doc.first_name} {doc.last_name} ({doc.specialization})</span>
                                <button onClick={() => openEditDoctor(doc)} className="chip-edit-btn" title="Edit Doctor Profile">
                                    <Edit size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="dv-tabs-container">
                <div className="dv-tabs">
                    <button className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
                        <Clock size={16} /> Upcoming Visits
                    </button>
                    <button className={`tab-btn ${activeTab === 'ongoing' ? 'active' : ''}`} onClick={() => setActiveTab('ongoing')}>
                        <UserCheck size={16} /> Ongoing Visits
                    </button>
                    <button className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`} onClick={() => setActiveTab('past')}>
                        <CheckCircle size={16} /> Past Visits
                    </button>
                </div>

                <div className="dv-search-box">
                    <Search size={16} />
                    <input 
                        type="text" 
                        placeholder="Search student or doctor name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table Section */}
            <div className="dv-table-card">
                {loading ? (
                    <div className="dv-loading">Loading doctor visits...</div>
                ) : filteredVisits.length === 0 ? (
                    <div className="dv-empty-state">
                        <AlertCircle size={36} />
                        <p>No {activeTab} doctor visits found.</p>
                    </div>
                ) : (
                    <table className="sti-table">
                        <thead>
                            <tr>
                                <th>Student ID & Name</th>
                                <th>Program / Sec</th>
                                <th>Assigned Doctor</th>
                                <th>Schedule Window</th>
                                <th>Attendance Status</th>
                                <th>Assessment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVisits.map((appt) => {
                                const rawStart = appt.start_time || appt.scheduled_date;
                                const rawEnd = appt.end_time;
                                const apptStart = parseSQLDate(rawStart) || new Date();
                                const apptEnd = parseSQLDate(rawEnd) || apptStart;
                                const now = new Date();

                                let currentAttendance = appt.attendance_status || 'Pending';
                                
                                // Automatically evaluate unhandled pending visits as Absent if end time passed
                                if (apptEnd < now && currentAttendance.toLowerCase() === 'pending') {
                                    currentAttendance = 'Absent';
                                }

                                const isPresent = currentAttendance.toLowerCase() === 'present';

                                return (
                                    <tr key={`${appt.appointment_id}-${appt.student_id}`}>
                                        <td>
                                            <strong>{appt.student_first_name} {appt.student_last_name}</strong>
                                            <div className="sub-text">ID: {appt.student_id}</div>
                                        </td>
                                        <td>
                                            {appt.program_id ? `${appt.program_id} - ${appt.year_level || ''}${appt.section || ''}` : 'All Programs'}
                                        </td>
                                        <td>
                                            Dr. {appt.doc_first_name} {appt.doc_last_name}
                                            <div className="sub-text">{appt.specialization}</div>
                                        </td>
                                        <td>
                                            <div>{apptStart.toLocaleDateString()}</div>
                                            <div className="sub-text">
                                                {apptStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                                                {apptEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge badge-${currentAttendance.toLowerCase()}`}>
                                                {currentAttendance}
                                            </span>
                                        </td>
                                        <td>
                                            {appt.assessment_id ? (
                                                <span className="doc-done-badge"><CheckCircle size={14} /> Documented</span>
                                            ) : (
                                                <span className="doc-pending-badge">Pending</span>
                                            )}
                                        </td>
                                        <td className="table-actions">
                                            {activeTab === 'upcoming' && (
                                                <>
                                                    <button className="action-btn edit" onClick={() => openRescheduleModal(appt)}>
                                                        <Edit size={15} /> Edit
                                                    </button>
                                                    <button className="action-btn cancel" onClick={() => handleCancelAppointment(appt)}>
                                                        <XCircle size={15} /> Cancel
                                                    </button>
                                                </>
                                            )}
                                            {activeTab === 'ongoing' && (
                                                <>
                                                    <button className="action-btn skip" onClick={() => handleSkipStudent(appt)}>
                                                        <SkipForward size={15} /> Skip
                                                    </button>
                                                    <button 
                                                        className="action-btn cancel" 
                                                        onClick={() => updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Absent')}
                                                    >
                                                        <XCircle size={15} /> Absent
                                                    </button>
                                                    <button 
                                                        className={`action-btn document ${!isPresent ? 'disabled' : ''}`} 
                                                        onClick={() => isPresent && openAssessmentModal(appt)}
                                                        disabled={!isPresent}
                                                        title={!isPresent ? "Documentation is only available when participant is marked Present." : ""}
                                                        style={!isPresent ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                                                    >
                                                        <FileText size={15} /> {appt.assessment_id ? 'Edit Assessment' : 'Document'}
                                                    </button>
                                                </>
                                            )}
                                            {activeTab === 'past' && (
                                                <button 
                                                    className={`action-btn document ${!isPresent ? 'disabled' : ''}`} 
                                                    onClick={() => isPresent && openAssessmentModal(appt)}
                                                    disabled={!isPresent}
                                                    title={!isPresent ? "Documentation is only available when participant is marked Present." : ""}
                                                    style={!isPresent ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                                                >
                                                    <FileText size={15} /> {appt.assessment_id ? 'Edit Assessment' : 'Document Assessment'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL: JSQR SCANNER */}
            {showScannerModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Scan Student QR Code</h3>
                            <button className="close-btn" onClick={() => setShowScannerModal(false)}><X size={20} /></button>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px' }}>
                            <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                                Align the student's QR code within the camera frame to update attendance to <strong>Present</strong>.
                            </p>
                            <video ref={videoRef} style={{ width: '100%', maxHeight: '300px', borderRadius: '8px', border: '2px solid #ccc' }} />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="sti-btn sti-btn-light" onClick={() => setShowScannerModal(false)}>Close Scanner</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: ADD / EDIT DOCTOR */}
            {showDoctorModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{isEditDoctor ? 'Edit Doctor Profile' : 'Add New Doctor Profile'}</h3>
                            <button className="close-btn" onClick={() => setShowDoctorModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveDoctor}>
                            <div className="form-group">
                                <label>First Name</label>
                                <input type="text" required value={doctorForm.first_name} onChange={e => setDoctorForm({...doctorForm, first_name: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input type="text" required value={doctorForm.last_name} onChange={e => setDoctorForm({...doctorForm, last_name: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Specialization</label>
                                <input type="text" placeholder="e.g. General Physician, Dentist" required value={doctorForm.specialization} onChange={e => setDoctorForm({...doctorForm, specialization: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Contact Number</label>
                                <input type="text" required value={doctorForm.contact_number} onChange={e => setDoctorForm({...doctorForm, contact_number: e.target.value})} />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="sti-btn sti-btn-light" onClick={() => setShowDoctorModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn sti-btn-primary">Save Doctor Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: MASS SCHEDULE & APPOINTMENTS */}
            {showScheduleModal && (
                <div className="modal-overlay">
                    <div className="modal-content modal-large">
                        <div className="modal-header">
                            <h3>Mass Schedule Doctor Visit</h3>
                            <button className="close-btn" onClick={() => setShowScheduleModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateMassSchedule}>
                            {timeSlotCollisions && (
                                <div className="error-banner"><AlertCircle size={16} /> {timeSlotCollisions}</div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Assign Doctor</label>
                                    <select required value={scheduleForm.doctor_id} onChange={e => setScheduleForm({...scheduleForm, doctor_id: e.target.value})}>
                                        <option value="">-- Select Doctor --</option>
                                        {doctors.map(d => (
                                            <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Scheduled Date</label>
                                    <input type="date" required value={scheduleForm.scheduled_date} onChange={e => setScheduleForm({...scheduleForm, scheduled_date: e.target.value})} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Batch Start Time</label>
                                    <input type="time" required value={scheduleForm.batch_start_time} onChange={e => setScheduleForm({...scheduleForm, batch_start_time: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>Batch End Time</label>
                                    <input type="time" required value={scheduleForm.batch_end_time} onChange={e => setScheduleForm({...scheduleForm, batch_end_time: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label>Slot Duration (Mins/Student)</label>
                                    <input type="number" min="5" max="60" value={scheduleForm.slot_duration} onChange={e => setScheduleForm({...scheduleForm, slot_duration: e.target.value})} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
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

                                <div className="form-group">
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

                                <div className="form-group">
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

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ margin: 0 }}>
                                        Select Students ({selectedStudentIds.length} selected / {filteredStudents.length} available):
                                    </label>
                                    <div>
                                        <button 
                                            type="button" 
                                            className="sti-btn-link"
                                            onClick={handleSelectAllFiltered}
                                            style={{ background: 'none', border: 'none', color: '#0056b3', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
                                        >
                                            Select All Filtered
                                        </button>
                                        <button 
                                            type="button" 
                                            className="sti-btn-link"
                                            onClick={handleDeselectAllFiltered}
                                            style={{ background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', marginLeft: '12px' }}
                                        >
                                            Deselect Filtered
                                        </button>
                                    </div>
                                </div>

                                <div className="student-select-list">
                                    {filteredStudents.length === 0 ? (
                                        <div style={{ padding: '15px', color: '#666', gridColumn: '1 / -1', textAlign: 'center' }}>
                                            No students found matching the selected filters.
                                        </div>
                                    ) : (
                                        filteredStudents.map(s => (
                                            <label key={s.student_id} className={`student-checkbox-item ${selectedStudentIds.includes(s.student_id) ? 'selected' : ''}`}>
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

                            <div className="modal-footer">
                                <button type="button" className="sti-btn sti-btn-light" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn sti-btn-primary">Confirm & Create Mass Schedule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: DOCUMENT DOCTOR ASSESSMENT */}
            {showAssessmentModal && selectedAppt && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Document Doctor Assessment</h3>
                            <button className="close-btn" onClick={() => setShowAssessmentModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveAssessment}>
                            <div className="appt-info-card">
                                <strong>Student: {selectedAppt.student_first_name} {selectedAppt.student_last_name}</strong>
                                <div>Doctor: Dr. {selectedAppt.doc_first_name} {selectedAppt.doc_last_name}</div>
                                <div>Attendance Status: <strong>{selectedAppt.attendance_status || 'Pending'}</strong></div>
                            </div>

                            <div className="form-group">
                                <label>Clinical Findings</label>
                                <textarea 
                                    rows="3" 
                                    required
                                    value={assessmentForm.clinical_findings} 
                                    onChange={e => setAssessmentForm({...assessmentForm, clinical_findings: e.target.value})}
                                ></textarea>
                            </div>

                            <div className="form-group">
                                <label>Diagnosis</label>
                                <textarea 
                                    rows="2" 
                                    required
                                    value={assessmentForm.diagnosis} 
                                    onChange={e => setAssessmentForm({...assessmentForm, diagnosis: e.target.value})}
                                ></textarea>
                            </div>

                            <div className="form-group">
                                <label>Treatment & Recommendations</label>
                                <textarea 
                                    rows="3" 
                                    required
                                    value={assessmentForm.treatment_recommendations} 
                                    onChange={e => setAssessmentForm({...assessmentForm, treatment_recommendations: e.target.value})}
                                ></textarea>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="sti-btn sti-btn-light" onClick={() => setShowAssessmentModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn sti-btn-primary">Save Assessment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: RESCHEDULE APPOINTMENT */}
            {showRescheduleModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Reschedule Student Appointment</h3>
                            <button className="close-btn" onClick={() => setShowRescheduleModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveReschedule}>
                            <div className="form-group">
                                <label>Start Time</label>
                                <input 
                                    type="datetime-local" 
                                    required 
                                    value={rescheduleData.start_time} 
                                    onChange={e => setRescheduleData({...rescheduleData, start_time: e.target.value})} 
                                />
                            </div>

                            <div className="form-group">
                                <label>End Time</label>
                                <input 
                                    type="datetime-local" 
                                    required 
                                    value={rescheduleData.end_time} 
                                    onChange={e => setRescheduleData({...rescheduleData, end_time: e.target.value})} 
                                />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="sti-btn sti-btn-light" onClick={() => setShowRescheduleModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn sti-btn-primary">Update Schedule & Notify Student</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorVisit;