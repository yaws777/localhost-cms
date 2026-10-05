// doctorVisits.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    Users,
    Trash2,
    Printer
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/DoctorVisits.css';

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
    const [showBatchRescheduleModal, setShowBatchRescheduleModal] = useState(false);
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeScanGroup, setActiveScanGroup] = useState(null);

    // Forms
    const [doctorForm, setDoctorForm] = useState({ doctor_id: '', first_name: '', last_name: '', specialization: '', contact_number: '' });
    const [isEditDoctor, setIsEditDoctor] = useState(false);

    const [scheduleForm, setScheduleForm] = useState({
        doctor_id: '',
        title: '',
        announcement: '',
        target_program: '',    
        target_year_level: '', 
        target_section: '',    
        scheduled_date: '',
        batch_start_time: '',
        batch_end_time: '',
        slot_duration: '15'
    });
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [timeSlotCollisions, setTimeSlotCollisions] = useState('');

    const [selectedAppt, setSelectedAppt] = useState(null);
    const [assessmentForm, setAssessmentForm] = useState({
        clinical_findings: '',
        diagnosis: '',
        treatment_recommendations: ''
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
    // Ref to prevent duplicate scan processing while a scan is in progress
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

    // EXPORT REPORT FOR ALL DOCTOR APPOINTMENTS
    const handleExportAllReport = () => {
        const rowsToExport = groupedVisits.length > 0 ? groupedVisits : [];

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            alert('Please allow popups to preview and print the report.');
            return;
        }

        const reportDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const tableRowsHtml = rowsToExport.map(group => {
            const dateFormatted = group.apptStart ? formatLocalDateOnly(group.apptStart) : 'N/A';
            const startTimeFormatted = group.apptStart ? group.apptStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
            const endTimeFormatted = group.apptEnd ? group.apptEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
            const timeStr = `${startTimeFormatted} - ${endTimeFormatted}`;
            const docStr = `${group.doctorName || 'N/A'} (${group.specialization || 'General'})`;

            return `
                <tr>
                    <td><strong>${group.title || 'N/A'}</strong></td>
                    <td>${docStr}</td>
                    <td>${dateFormatted}</td>
                    <td>${timeStr}</td>
                    <td>${group.appointments ? group.appointments.length : 0}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Doctor Visit Summary Report</title>
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        margin: 25px;
                        color: #0f172a;
                    }
                    .report-header {
                        display: flex;
                        align-items: center;
                        border-bottom: 2px solid #0056b3;
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    .report-header img {
                        height: 60px;
                        margin-right: 20px;
                    }
                    .report-title h2 {
                        margin: 0;
                        font-size: 20px;
                        color: #1e3a8a;
                    }
                    .report-title p {
                        margin: 4px 0 0;
                        font-size: 13px;
                        color: #475569;
                    }
                    .meta-info {
                        display: flex;
                        justify-content: space-between;
                        font-size: 13px;
                        color: #475569;
                        margin-bottom: 16px;
                        font-weight: 500;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                        margin-bottom: 35px;
                    }
                    th {
                        background-color: #f1f5f9;
                        color: #0f172a;
                        text-align: left;
                        padding: 9px 10px;
                        border: 1px solid #cbd5e1;
                        font-weight: bold;
                    }
                    td {
                        padding: 8px 10px;
                        border: 1px solid #e2e8f0;
                    }
                    tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    .signature-section {
                        margin-top: 40px;
                        font-size: 13px;
                    }
                    .signature-title {
                        color: #475569;
                        margin-bottom: 35px;
                    }
                    .signature-name {
                        font-weight: bold;
                        font-size: 14px;
                        color: #0f172a;
                    }
                    .signature-role {
                        font-style: italic;
                        color: #64748b;
                    }
                    @media print {
                        body { margin: 0; }
                    }
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
                    <span><strong>DOCTOR VISIT SUMMARY REPORT</strong></span>
                    <span>Date Generated: ${reportDate}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Visit Title</th>
                            <th>Doctor & Specialization</th>
                            <th>Date</th>
                            <th>Time Window</th>
                            <th>Participants</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="5">No doctor visit records found.</td></tr>'}
                    </tbody>
                </table>

                <div class="signature-section">
                    <div class="signature-title">Prepared by:</div>
                    <div class="signature-name">Marilou H. Balarao</div>
                    <div class="signature-role">School Nurse</div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // EXPORT REPORT FOR SINGLE DOCTOR APPOINTMENT BATCH
    const handleExportSingleReport = () => {
        if (!selectedGroup) return;

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            alert('Please allow popups to preview and print the report.');
            return;
        }

        const reportDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const dateFormatted = selectedGroup.apptStart ? formatLocalDateOnly(selectedGroup.apptStart) : 'N/A';
        const startTimeFormatted = selectedGroup.apptStart ? selectedGroup.apptStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
        const endTimeFormatted = selectedGroup.apptEnd ? selectedGroup.apptEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
        const timeStr = `${startTimeFormatted} - ${endTimeFormatted}`;

        const now = new Date();

        const tableRowsHtml = selectedGroup.appointments.map(appt => {
            const studentName = `${appt.student_first_name || ''} ${appt.student_last_name || ''}`.trim();
            const progSec = appt.program_id ? `${appt.program_id} - ${appt.year_level || ''}${appt.section || ''}` : 'N/A';

            const rawStart = appt.start_time || appt.scheduled_date;
            const rawEnd = appt.end_time;
            const studentStart = parseSQLDate(rawStart) || selectedGroup.apptStart;
            const studentEnd = parseSQLDate(rawEnd) || selectedGroup.apptEnd;

            const slotStr = `${studentStart ? studentStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''} - ${studentEnd ? studentEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}`;

            let currentAttendance = appt.attendance_status || 'Pending';
            if (studentEnd < now && currentAttendance.toLowerCase() === 'pending') {
                currentAttendance = 'Absent';
            }

            const assessmentStr = appt.assessment_id ? 'Documented' : 'Pending';

            return `
                <tr>
                    <td>${appt.student_id || ''}</td>
                    <td><strong>${studentName}</strong></td>
                    <td>${progSec}</td>
                    <td>${slotStr}</td>
                    <td>${currentAttendance}</td>
                    <td>${assessmentStr}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Individual Doctor Visit Participant Report</title>
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        margin: 25px;
                        color: #0f172a;
                    }
                    .report-header {
                        display: flex;
                        align-items: center;
                        border-bottom: 2px solid #0056b3;
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    .report-header img {
                        height: 60px;
                        margin-right: 20px;
                    }
                    .report-title h2 {
                        margin: 0;
                        font-size: 20px;
                        color: #1e3a8a;
                    }
                    .report-title p {
                        margin: 4px 0 0;
                        font-size: 13px;
                        color: #475569;
                    }
                    .meta-info {
                        display: flex;
                        justify-content: space-between;
                        font-size: 13px;
                        color: #475569;
                        margin-bottom: 16px;
                        font-weight: 500;
                    }
                    .details-card {
                        background-color: #f8fafc;
                        border: 1px solid #cbd5e1;
                        padding: 12px 16px;
                        border-radius: 6px;
                        margin-bottom: 20px;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                        font-size: 13px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                        margin-bottom: 35px;
                    }
                    th {
                        background-color: #f1f5f9;
                        color: #0f172a;
                        text-align: left;
                        padding: 9px 10px;
                        border: 1px solid #cbd5e1;
                        font-weight: bold;
                    }
                    td {
                        padding: 8px 10px;
                        border: 1px solid #e2e8f0;
                    }
                    tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    .signature-section {
                        margin-top: 40px;
                        font-size: 13px;
                    }
                    .signature-title {
                        color: #475569;
                        margin-bottom: 35px;
                    }
                    .signature-name {
                        font-weight: bold;
                        font-size: 14px;
                        color: #0f172a;
                    }
                    .signature-role {
                        font-style: italic;
                        color: #64748b;
                    }
                    @media print {
                        body { margin: 0; }
                    }
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
                    <span><strong>INDIVIDUAL DOCTOR VISIT PARTICIPANT REPORT</strong></span>
                    <span>Date Generated: ${reportDate}</span>
                </div>

                <div class="details-card">
                    <div><strong>Visit Title:</strong> ${selectedGroup.title || 'N/A'}</div>
                    <div><strong>Assigned Doctor:</strong> ${selectedGroup.doctorName || 'N/A'} (${selectedGroup.specialization || 'General'})</div>
                    <div><strong>Scheduled Date:</strong> ${dateFormatted}</div>
                    <div><strong>Time Window:</strong> ${timeStr}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Student Name</th>
                            <th>Program & Section</th>
                            <th>Time Slot</th>
                            <th>Attendance</th>
                            <th>Assessment Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="6">No participating students found.</td></tr>'}
                    </tbody>
                </table>

                <div class="signature-section">
                    <div class="signature-title">Prepared by:</div>
                    <div class="signature-name">Marilou H. Balarao</div>
                    <div class="signature-role">School Nurse</div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const updateAppointmentStatus = useCallback(async (appointmentId, studentId, newStatus) => {
        try {
            const res = await fetch(`http://localhost:3001/api/doctor-visits/status/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                await fetchAppointments(); // Await refresh to update UI state immediately
                return true;
            } else {
                alert(data.message || 'Failed to update status');
                return false;
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Server error updating status.');
            return false;
        }
    }, [fetchAppointments]);

    useEffect(() => {
        const checkAndSyncExpiredPending = async () => {
            const now = new Date();
            for (const appt of appointments) {
                const rawEnd = appt.batch_end_time || appt.end_time;
                const apptEnd = parseSQLDate(rawEnd);
                const attendanceStatus = (appt.attendance_status || 'pending').toLowerCase();
                const apptStatus = (appt.status || '').toLowerCase();

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
        if (isProcessingScanRef.current) return;
        isProcessingScanRef.current = true;

        let parsedId = String(scannedValue).trim();

        // Try parsing JSON if QR contains structured payload
        try {
            const parsedObj = JSON.parse(parsedId);
            parsedId = String(parsedObj.student_id || parsedObj.student_user_id || parsedObj.appointment_id || parsedId).trim();
        } catch (e) {
            // Keep string if plain text
        }

        const targetPool = activeScanGroup ? activeScanGroup.appointments : appointments;
        const cleanScanValue = parsedId.toLowerCase();

        // Flexible, case-insensitive comparison matching student_id, user_id, or appointment_id
        const appt = targetPool.find((a) => {
            const sId = String(a.student_id || '').trim().toLowerCase();
            const uId = String(a.student_user_id || '').trim().toLowerCase();
            const aId = String(a.appointment_id || '').trim().toLowerCase();

            return sId === cleanScanValue || uId === cleanScanValue || aId === cleanScanValue;
        });

        if (appt) {
            const success = await updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Present');
            if (success) {
                alert(`Student ${appt.student_first_name} ${appt.student_last_name} marked as PRESENT.`);
            }
        } else {
            alert(`No matching student found for QR code "${scannedValue}".`);
        }

        setShowScannerModal(false);
        setActiveScanGroup(null);
        isProcessingScanRef.current = false;
    }, [appointments, activeScanGroup, updateAppointmentStatus]);

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
                    return; // Stop animation loop once code is captured
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
                    alert('Camera access denied or unavailable: ' + err.message);
                    setShowScannerModal(false);
                    setActiveScanGroup(null);
                });
        } else {
            stopCamera();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
            stopCamera();
        };
    }, [showScannerModal, scanQRCode]);

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
                alert('Doctor visit mass schedule created successfully with instilled time blocks!');
                setShowScheduleModal(false);
                setSelectedStudentIds([]);
                setScheduleForm({
                    doctor_id: '',
                    title: '',
                    announcement: '',
                    target_program: '',
                    target_year_level: '',
                    target_section: '',
                    scheduled_date: '',
                    batch_start_time: '',
                    batch_end_time: '',
                    slot_duration: '15'
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
            alert('Invalid date or time selected.');
            return;
        }

        if (startDT >= endDT) {
            alert('Batch end time must be after batch start time.');
            return;
        }

        const slotMins = parseInt(batchRescheduleData.slot_duration, 10) || 15;
        const targetGroup = groupedVisits.find(g => g.groupKey === batchRescheduleData.groupKey);

        if (!targetGroup) {
            alert('Batch schedule not found.');
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
                alert('Batch appointment date and start/end time updated successfully!');
                setShowBatchRescheduleModal(false);
                fetchAppointments();
            } else {
                alert(data.message || 'Failed to update batch schedule date and times.');
            }
        } catch (err) {
            alert('Failed to update batch schedule date and times.');
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

    // Permanently delete batch schedule & all associated appointments
    const handleDeleteBatch = async (group) => {
        if (!group) return;
        if (!window.confirm(`Are you sure you want to permanently DELETE "${group.title}" and all ${group.appointments.length} associated appointment records? This action CANNOT be undone.`)) return;

        try {
            const appointmentIds = group.appointments.map(a => a.appointment_id);

            let res = await fetch(`http://localhost:3001/api/doctor-visits/batch/${group.batchId || 'delete'}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    batch_id: group.batchId,
                    appointment_ids: appointmentIds 
                })
            });

            let data = await res.json();
            if (data.success) {
                alert('Batch schedule permanently deleted.');
                if (selectedGroup?.groupKey === group.groupKey) setSelectedGroup(null);
                fetchAppointments();
            } else {
                // Fallback attempt to mass-schedules endpoint
                const res2 = await fetch(`http://localhost:3001/api/mass-schedules/${group.batchId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appointment_ids: appointmentIds })
                });
                const data2 = await res2.json();
                if (data2.success) {
                    alert('Batch schedule permanently deleted.');
                    if (selectedGroup?.groupKey === group.groupKey) setSelectedGroup(null);
                    fetchAppointments();
                } else {
                    alert(data.message || data2.message || 'Failed to delete batch schedule.');
                }
            }
        } catch (err) {
            alert('Server error deleting batch schedule.');
        }
    };

    const groupedVisits = useMemo(() => {
        const now = new Date();
        const map = new Map();

        appointments.forEach((appt) => {
            const rawStart = appt.batch_start_time || appt.start_time || appt.scheduled_date;
            const rawEnd = appt.batch_end_time || appt.end_time || rawStart;
            
            const apptStart = parseSQLDate(rawStart) || now;
            const apptEnd = parseSQLDate(rawEnd) || apptStart;

            const title = appt.title || 'Doctor Visit';
            const doctorName = `Dr. ${appt.doc_first_name || ''} ${appt.doc_last_name || ''}`.trim();
            const specialization = appt.specialization || 'General Physician';
            
            const batchId = appt.batch_schedule_id || appt.batch_id;
            const startDateStr = apptStart ? formatLocalDateOnly(apptStart) : '';
            const startTimeStr = apptStart ? apptStart.toTimeString().split(' ')[0] : '';
            const endTimeStr = apptEnd ? apptEnd.toTimeString().split(' ')[0] : '';

            const groupKey = batchId 
                ? `batch_${batchId}` 
                : `${title}_${appt.doctor_id || doctorName}_${startDateStr}_${startTimeStr}_${endTimeStr}`;

            if (!map.has(groupKey)) {
                map.set(groupKey, {
                    groupKey,
                    batchId: batchId || null,
                    title,
                    specialization,
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

        return groups.filter((group) => {
            const isFinished = group.appointments.length > 0 && group.appointments.every(a => {
                const status = (a.status || '').toLowerCase();
                const attendance = (a.attendance_status || '').toLowerCase();
                return status === 'completed' || status === 'cancelled' || attendance === 'absent';
            });

            const isExpired = group.apptEnd < now;

            const matchesSearch = 
                group.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                group.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                group.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
                group.appointments.some(a => 
                    `${a.student_first_name || ''} ${a.student_last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (a.student_id || '').toLowerCase().includes(searchTerm.toLowerCase())
                );

            if (!matchesSearch) return false;

            if (activeTab === 'past') {
                return isFinished || isExpired;
            }

            if (activeTab === 'ongoing') {
                if (isFinished || isExpired) return false;
                return group.apptStart <= now && group.apptEnd >= now;
            }

            if (activeTab === 'upcoming') {
                if (isFinished || isExpired) return false;
                return group.apptStart > now;
            }

            return true;
        });
    }, [appointments, activeTab, searchTerm]);

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
                    <p className="subtitle-dv">Schedule, track, and document student doctor visits.</p>
                </div>
                <div className="header-actions-dv">
                    <button 
                        type="button"
                        className="sti-btn-dv sti-btn-secondary-dv" 
                        onClick={handleExportAllReport}
                        style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Printer size={18} /> export
                    </button>
                    <button className="sti-btn-dv sti-btn-secondary-dv" onClick={() => { setIsEditDoctor(false); setShowDoctorModal(true); }}>
                        <UserPlus size={18} /> Manage Doctor Profile
                    </button>
                    <button className="sti-btn-dv sti-btn-primary-dv" onClick={() => setShowScheduleModal(true)}>
                        <Calendar size={18} /> Schedule Doctor Visit
                    </button>
                </div>
            </div>

            {/* Doctors Bar */}
            {doctors.length > 0 && (
                <div className="doctors-bar-dv">
                    <span className="doctors-bar-title-dv"><Stethoscope size={16} /> Available Doctors:</span>
                    <div className="doctors-chip-list-dv">
                        {doctors.map(doc => (
                            <div key={doc.doctor_id} className="doctor-chip-dv">
                                <span>Dr. {doc.first_name} {doc.last_name} ({doc.specialization})</span>
                                <button onClick={() => openEditDoctor(doc)} className="chip-edit-btn-dv" title="Edit Doctor Profile">
                                    <Edit size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Tabs & Search */}
            <div className="tabs-container-dv">
                <div className="tabs-dv">
                    <button className={`tab-btn-dv ${activeTab === 'upcoming' ? 'active-dv' : ''}`} onClick={() => setActiveTab('upcoming')}>
                        <Clock size={16} /> Upcoming Visits
                    </button>
                    <button className={`tab-btn-dv ${activeTab === 'ongoing' ? 'active-dv' : ''}`} onClick={() => setActiveTab('ongoing')}>
                        <UserCheck size={16} /> Ongoing Visits
                    </button>
                    <button className={`tab-btn-dv ${activeTab === 'past' ? 'active-dv' : ''}`} onClick={() => setActiveTab('past')}>
                        <CheckCircle size={16} /> Past Visits
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

            {/* Group Cards Grid Section */}
            {loading ? (
                <div className="loading-dv">Loading doctor visits...</div>
            ) : groupedVisits.length === 0 ? (
                <div className="empty-state-dv">
                    <AlertCircle size={36} />
                    <p>No {activeTab} doctor visit schedules found.</p>
                </div>
            ) : (
                <div className="cards-grid-dv" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginTop: '15px' }}>
                    {groupedVisits.map((group) => {
                        const dateFormatted = group.apptStart ? formatLocalDateOnly(group.apptStart) : 'N/A';
                        const startTimeFormatted = group.apptStart ? group.apptStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                        const endTimeFormatted = group.apptEnd ? group.apptEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                        return (
                            <div key={group.groupKey} className="card-dv" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                                            <Stethoscope size={14} /> {group.specialization}
                                        </span>
                                        {group.batchId && (
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                                                Batch #{group.batchId}
                                            </span>
                                        )}
                                    </div>

                                    <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                                        {group.title}
                                    </h3>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={16} />
                                            <span>{dateFormatted}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={16} />
                                            <span>{startTimeFormatted} - {endTimeFormatted}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={16} />
                                            <span><strong>{group.appointments.length}</strong> Participating Students</span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                                            Assigned Doctor: {group.doctorName}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button 
                                        className="sti-btn-dv sti-btn-primary-dv" 
                                        style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}
                                        onClick={() => setSelectedGroup(group)}
                                    >
                                        <Users size={16} /> Participants
                                    </button>
                                    {activeTab === 'ongoing' && (
                                        <button 
                                            className="sti-btn-dv sti-btn-secondary-dv" 
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px' }}
                                            onClick={() => openScannerForBatch(group)}
                                            title="Scan QR Attendance for this batch"
                                        >
                                            <QrCode size={16} /> Scan QR
                                        </button>
                                    )}
                                    {activeTab === 'upcoming' && (
                                        <>
                                            <button 
                                                className="sti-btn-dv sti-btn-secondary-dv" 
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px' }}
                                                onClick={() => openBatchRescheduleModal(group)}
                                                title="Edit Batch Date & Start/End Time"
                                            >
                                                <Edit size={16} /> Edit
                                            </button>
                                            <button 
                                                className="sti-btn-dv" 
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                onClick={() => handleDeleteBatch(group)}
                                                title="Delete Batch Schedule Permanently"
                                            >
                                                <Trash2 size={16} /> Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: BATCH PARTICIPANT SCHEDULE & DOCUMENTATION */}
            {selectedGroup && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv modal-large-dv">
                        <div className="modal-header-dv">
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedGroup.title}</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                                    {selectedGroup.doctorName} ({selectedGroup.specialization}) • {selectedGroup.appointments.length} Total Student Participants
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
                                    {selectedGroup.appointments.map((appt) => {
                                        const now = new Date();
                                        const rawStart = appt.start_time || appt.scheduled_date;
                                        const rawEnd = appt.end_time;
                                        const studentStart = parseSQLDate(rawStart) || selectedGroup.apptStart;
                                        const studentEnd = parseSQLDate(rawEnd) || selectedGroup.apptEnd;

                                        const studentTimeFormatted = `${studentStart ? studentStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''} - ${studentEnd ? studentEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}`;

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
                                                </td>
                                                <td>
                                                    {appt.assessment_id ? (
                                                        <span className="doc-done-badge-dv"><CheckCircle size={14} /> Documented</span>
                                                    ) : (
                                                        <span className="doc-pending-badge-dv">Pending</span>
                                                    )}
                                                </td>
                                                <td className="table-actions-dv">
                                                    {activeTab === 'upcoming' && (
                                                        <button className="action-btn-dv cancel-dv" onClick={() => handleCancelAppointment(appt)}>
                                                            <XCircle size={15} /> Cancel
                                                        </button>
                                                    )}
                                                    {activeTab === 'ongoing' && (
                                                        <>
                                                            <button 
                                                                className="action-btn-dv cancel-dv" 
                                                                onClick={() => updateAppointmentStatus(appt.appointment_id, appt.student_id, 'Absent')}
                                                            >
                                                                <XCircle size={15} /> Absent
                                                            </button>
                                                            <button 
                                                                className={`action-btn-dv document-dv ${!isPresent ? 'disabled-dv' : ''}`} 
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
                                                            className={`action-btn-dv document-dv ${!isPresent ? 'disabled-dv' : ''}`} 
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
                                {activeTab === 'upcoming' && (
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

            {/* MODAL: JSQR SCANNER */}
            {showScannerModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Scan Student QR Code {activeScanGroup ? `- ${activeScanGroup.title}` : ''}</h3>
                            <button className="close-btn-dv" onClick={() => { setShowScannerModal(false); setActiveScanGroup(null); }}><X size={20} /></button>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px' }}>
                            <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                                Align the student's QR code within the camera frame to update attendance to <strong>Present</strong> for this batch.
                            </p>
                            <video ref={videoRef} style={{ width: '100%', maxHeight: '300px', borderRadius: '8px', border: '2px solid #ccc' }} />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                        <div className="modal-footer-dv">
                            <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => { setShowScannerModal(false); setActiveScanGroup(null); }}>Close Scanner</button>
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
                                <label>Visit Title</label>
                                <input 
                                    type="text" 
                                    required 
                                    placeholder="e.g. Annual Physical Examination, Dental Checkup"
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
                                        {doctors.map(d => (
                                            <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group-dv">
                                    <label>Scheduled Date</label>
                                    <input type="date" required value={scheduleForm.scheduled_date} onChange={e => setScheduleForm({...scheduleForm, scheduled_date: e.target.value})} />
                                </div>
                            </div>

                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Batch Start Time</label>
                                    <input type="time" required value={scheduleForm.batch_start_time} onChange={e => setScheduleForm({...scheduleForm, batch_start_time: e.target.value})} />
                                </div>
                                <div className="form-group-dv">
                                    <label>Batch End Time</label>
                                    <input type="time" required value={scheduleForm.batch_end_time} onChange={e => setScheduleForm({...scheduleForm, batch_end_time: e.target.value})} />
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
                                <div>Visit: {selectedAppt.title || 'Doctor Visit'}</div>
                                <div>Doctor: Dr. {selectedAppt.doc_first_name} {selectedAppt.doc_last_name}</div>
                                <div>Attendance Status: <strong>{selectedAppt.attendance_status || 'Pending'}</strong></div>
                            </div>

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
                                    required 
                                    value={batchRescheduleData.scheduled_date} 
                                    onChange={e => setBatchRescheduleData({...batchRescheduleData, scheduled_date: e.target.value})} 
                                />
                            </div>

                            <div className="form-group-dv">
                                <label>Batch Start Time</label>
                                <input 
                                    type="time" 
                                    required 
                                    value={batchRescheduleData.batch_start_time} 
                                    onChange={e => setBatchRescheduleData({...batchRescheduleData, batch_start_time: e.target.value})} 
                                />
                            </div>

                            <div className="form-group-dv">
                                <label>Batch End Time</label>
                                <input 
                                    type="time" 
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
        </div>
    );
};

export default DoctorVisit;