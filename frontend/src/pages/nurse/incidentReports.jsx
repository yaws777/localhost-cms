// incidentReports.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    AlertTriangle, 
    Plus, 
    PhoneCall, 
    Search, 
    Eye, 
    Edit, 
    Trash2, 
    X, 
    Calendar, 
    User, 
    MapPin, 
    FileText, 
    Activity, 
    Check, 
    RefreshCw,
    Camera,
    Printer,
    Pill,
    HeartPulse
} from 'lucide-react';
import jsQR from 'jsqr';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/IncidentReports.css';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime, formatTime } from '../../utils/datetime';
import FormDocument from '../../components/common/FormDocument';
import { buildIncidentModel } from '../../utils/formModels';
import { printFormDocument } from '../../utils/formDocument';
import { useRecordSync, notifyRecordChanged } from '../../hooks/useRecordSync';
import { VITAL_FIELDS, EMPTY_VITALS, vitalState, vitalsLine, vitalStatusLabel } from '../../utils/vitals';

// Conditions that need a short description
const CONDITIONAL_COMPLAINT_NAMES = ['injury', 'others', 'gastrointestinal issues', 'body pain'];

// "BSIT - 4B"
const classLabel = (r) => `${r.program_id || r.program_name || 'N/A'} - ${r.year_level || ''}${r.section || ''}`.trim();

const IncidentReport = () => {
    // 1. Get nurseId from NurseLayout Outlet context
    const { nurseId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();

    // Data States
    const [reports, setReports] = useState([]);
    const [hotlines, setHotlines] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Modals
    const [showAddIncidentModal, setShowAddIncidentModal] = useState(false);
    const [showHotlineDirectoryModal, setShowHotlineDirectoryModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    // Camera QR Scanning States & Refs
    const [isCameraScanning, setIsCameraScanning] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const isProcessingScan = useRef(false);

    // Add Incident Form State
    const [studentSearch, setStudentSearch] = useState('');
    const [studentResults, setStudentResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [incidentData, setIncidentData] = useState({
        incident_datetime: '',
        incident_location: '',
        incident_description: '',
        first_aid_administered: '',
        current_physical_situation: ''
    });

    // Medicine dispensed for the incident (optional, logged in consultation_dispensation)
    const [batches, setBatches] = useState([]);
    const [complaints, setComplaints] = useState([]);
    // Medical condition of the incident (counted in health trends) + time-in vital signs
    const [dispenseComplaintId, setDispenseComplaintId] = useState('');
    const [specifyComplaint, setSpecifyComplaint] = useState('');
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const [dispenseMedicineId, setDispenseMedicineId] = useState('');
    const [dispenseData, setDispenseData] = useState({ batch_id: '', quantity: '', unit: '' });

    // Hotline Form State (For adding/editing)
    const [editingHotlineId, setEditingHotlineId] = useState(null);
    const [hotlineFormData, setHotlineFormData] = useState({
        facility_name: '',
        contact_number: '',
        description_notes: ''
    });

    // Stop Camera Stream
    const stopCameraScan = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraScanning(false);
    }, []);

    // Request Camera Access & Start Stream
    const requestCameraAndStartScan = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showAlert('Camera is not supported here.', 'error');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            streamRef.current = stream;
            setIsCameraScanning(true);
        } catch (err) {
            console.error("Camera permission error:", err);
            setIsCameraScanning(false);
            showAlert('Unable to access the camera.', 'error');
        }
    }, [showAlert]);

    // Clean up camera stream on unmount
    useEffect(() => {
        return () => {
            stopCameraScan();
        };
    }, [stopCameraScan]);

    // Attach stream to video ref when scanning begins
    useEffect(() => {
        if (isCameraScanning && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(err => console.error("Error playing video stream:", err));
        }
    }, [isCameraScanning]);

    // Fetch Incident Reports
    const fetchIncidentReports = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (dateFilter) params.append('date', dateFilter);

            const res = await fetch(`http://localhost:3001/api/incident-reports?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setReports(data.reports);
            }
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, dateFilter]);

    // Fetch Emergency Hotlines
    const fetchHotlines = useCallback(async () => {
        try {
            const res = await fetch(`http://localhost:3001/api/emergency-hotlines`);
            const data = await res.json();
            if (data.success) {
                setHotlines(data.hotlines);
            }
        } catch (error) {
            console.error('Error fetching hotlines:', error);
        }
    }, []);

    const fetchBatches = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/medicines/batches');
            const data = await res.json();
            setBatches(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching medicine batches:', error);
        }
    }, []);

    useEffect(() => {
        fetchIncidentReports();
        fetchHotlines();
    }, [fetchIncidentReports, fetchHotlines]);

    // a report or the medicine given with it changed (here, another tab or another device): the list, the open report and its print follow
    useRecordSync(['incident'], useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (dateFilter) params.append('date', dateFilter);
            const data = await (await fetch(`http://localhost:3001/api/incident-reports?${params.toString()}`)).json();
            if (!data.success) return;
            setReports(data.reports);
            setSelectedReport((current) => (current ? (data.reports.find((r) => r.incident_id === current.incident_id) || null) : current));
        } catch (error) {
            console.error('Error refreshing reports:', error);
        }
    }, [searchQuery, dateFilter]));

    const fetchComplaints = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/chief-complaints');
            const data = await res.json();
            setComplaints(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching medical conditions:', error);
        }
    }, []);

    useEffect(() => {
        if (showAddIncidentModal) { fetchBatches(); fetchComplaints(); }
    }, [showAddIncidentModal, fetchBatches, fetchComplaints]);

    // A medicine is offered only for a medical condition it is indicated for.
    const linkedBatches = batches.filter(b =>
        dispenseComplaintId && String(b.complaint_ids || '').split(',').includes(String(dispenseComplaintId))
    );
    const medicineOptions = Array.from(
        new Map(linkedBatches.map(b => [b.medicine_id, { id: b.medicine_id, name: b.medicine_name }])).values()
    ).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const medicineBatches = linkedBatches
        .filter(b => b.medicine_id === dispenseMedicineId)
        .sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));
    const activeBatch = batches.find(b => b.batch_id === dispenseData.batch_id);
    const dispenseLimit = parseFloat(activeBatch?.dispense_limit) || 0;

    const selectedComplaint = complaints.find(c => String(c.complaint_id) === String(dispenseComplaintId));
    const specifyRequired = Boolean(selectedComplaint) && CONDITIONAL_COMPLAINT_NAMES.includes(String(selectedComplaint.complaint_name).trim().toLowerCase());

    const handleComplaintChange = (complaintId) => {
        setDispenseComplaintId(complaintId);
        setSpecifyComplaint('');
        setDispenseMedicineId('');
        setDispenseData({ batch_id: '', quantity: '', unit: '' });
    };

    const handleMedicineChange = (medicineId) => {
        setDispenseMedicineId(medicineId);
        setDispenseData({ batch_id: '', quantity: '', unit: '' });
    };

    const handleBatchChange = (batchId) => {
        const batch = batches.find(b => b.batch_id === batchId);
        if (!batch) {
            setDispenseData({ batch_id: '', quantity: '', unit: '' });
            return;
        }
        const limit = parseFloat(batch.dispense_limit);
        setDispenseData({
            batch_id: batchId,
            quantity: limit > 0 ? String(Math.max(1, Math.round(limit))) : '1',
            unit: batch.dispense_unit_of_measure || batch.strength_unit_of_measure || 'pcs.'
        });
    };

    // EXPORT REPORT FOR ALL INCIDENT REPORTS
    const handleExportAllReport = () => {
        const rowsToExport = reports.length > 0 ? reports : [];

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            showAlert('Please allow popups to preview and print the report.', 'warning');
            return;
        }

        const reportDate = formatDate(new Date());

        const tableRowsHtml = rowsToExport.map(r => {
            const studentName = `${r.student_first_name || ''} ${r.student_last_name || ''}`.trim();
            const progYrSec = classLabel(r);
            const incidentDate = r.incident_datetime ? formatDateTime(new Date(r.incident_datetime)) : 'N/A';

            return `
                <tr>
                    <td>${r.student_id || ''}</td>
                    <td><strong>${studentName}</strong></td>
                    <td>${progYrSec}</td>
                    <td>${incidentDate}</td>
                    <td>${r.incident_location || 'N/A'}</td>
                    <td>${r.complaint_name ? (r.specify_complaint_text ? `${r.complaint_name} (${r.specify_complaint_text})` : r.complaint_name) : 'N/A'}</td>
                    <td>${vitalsLine({ blood_pressure: r.blood_pressure, temperature: r.temperature, pulse_rate: r.pulse_rate, respiratory_rate: r.respiratory_rate }) || 'N/A'}</td>
                    <td>${r.incident_description || 'N/A'}</td>
                    <td>${r.first_aid_administered || 'N/A'}</td>
                    <td>${r.medicine_name ? `${r.medicine_name} - ${Math.round(r.dosage_consumption_unit_value)} ${r.dosage_consumption_unit_of_measure}` : 'None'}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Incident Summary Report</title>
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
                    <span><strong>CAMPUS INCIDENT REPORTS SUMMARY</strong></span>
                    <span>Date Generated: ${reportDate}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Student Name</th>
                            <th>Program/Yr/Sec</th>
                            <th>Date & Time</th>
                            <th>Location</th>
                            <th>Medical Condition</th>
                            <th>Vital Signs (Time In)</th>
                            <th>Description</th>
                            <th>First Aid Administered</th>
                            <th>Medicine Dispensed</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="10">No incident reports found.</td></tr>'}
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

    // EXPORT THE FILLED-IN INCIDENT REPORT FORM AS PDF (same layout as the form shown in the details panel)
    const handleExportSingleReport = () => {
        if (!selectedReport) return;
        printFormDocument(buildIncidentModel(selectedReport), () => showAlert('Please allow popups to preview and print the report.', 'warning'));
    };

    const handleSelectStudent = useCallback((student) => {
        const sId = student.student_id || student.id || '';
        const fName = student.first_name || student.firstname || student.name || 'Student';
        const lName = student.last_name || student.lastname || '';

        setSelectedStudent(student);
        setStudentSearch(`${fName} ${lName} (${sId})`.trim());
        setStudentResults([]);
    }, []);

    // Search Student by Scanned QR Value
    const searchStudentByQr = useCallback(async (studentId) => {
        if (!studentId || !studentId.trim() || isProcessingScan.current) return;
        isProcessingScan.current = true;

        try {
            const url = `http://localhost:3001/api/incident-reports/students?q=${encodeURIComponent(studentId.trim())}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            let studentList = [];
            if (data.success && Array.isArray(data.students)) {
                studentList = data.students;
            } else if (Array.isArray(data)) {
                studentList = data;
            }

            if (studentList.length > 0) {
                stopCameraScan();
                handleSelectStudent(studentList[0]);
            } else {
                showAlert(`No student found with QR / Student ID: ${studentId}`, 'error');
            }
        } catch (err) {
            console.error("Error reading QR code:", err);
            showAlert('Failed to read QR code data.', 'error');
        } finally {
            isProcessingScan.current = false;
        }
    }, [stopCameraScan, handleSelectStudent, showAlert]);

    // Continuously scan video frames with jsQR
    useEffect(() => {
        let animationFrameId;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        const scanFrame = async () => {
            if (
                isCameraScanning && 
                !isProcessingScan.current && 
                videoRef.current && 
                videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
            ) {
                const video = videoRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

                if (code && code.data && code.data.trim() !== '') {
                    const scannedVal = code.data.trim();
                    stopCameraScan();
                    await searchStudentByQr(scannedVal);
                    return;
                }
            }

            if (isCameraScanning) {
                animationFrameId = requestAnimationFrame(scanFrame);
            }
        };

        if (isCameraScanning) {
            animationFrameId = requestAnimationFrame(scanFrame);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isCameraScanning, stopCameraScan, searchStudentByQr]);

    // Search Students for Add Modal
    const handleStudentSearchChange = async (e) => {
        const query = e.target.value;
        setStudentSearch(query);

        if (selectedStudent) {
            setSelectedStudent(null);
        }

        if (query.trim().length > 0) {
            try {
                const url = `http://localhost:3001/api/incident-reports/students?q=${encodeURIComponent(query.trim())}`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const data = await res.json();
                if (data.success && Array.isArray(data.students)) {
                    setStudentResults(data.students);
                } else if (Array.isArray(data)) {
                    setStudentResults(data);
                } else {
                    setStudentResults([]);
                }
            } catch (err) {
                console.error('[Frontend] Student search error:', err.message);
                setStudentResults([]);
            }
        } else {
            setStudentResults([]);
        }
    };

    // Submit Incident Report Form
    const handleSaveIncident = async (e) => {
        e.preventDefault();
        
        const sId = selectedStudent?.student_id || selectedStudent?.id;
        if (!selectedStudent || !sId) {
            showAlert('Please search and select a valid student or scan a student QR code.', 'warning');
            return;
        }
        if (!nurseId) {
            showAlert('Nurse identity missing. Please re-login.', 'error');
            return;
        }

        if (!dispenseComplaintId) {
            showAlert('Select the medical condition.', 'warning');
            return;
        }
        if (specifyRequired && !specifyComplaint.trim()) {
            showAlert('Please specify the medical condition.', 'warning');
            return;
        }
        if (VITAL_FIELDS.some(f => ['empty', 'invalid'].includes(vitalState(f.key, vitals[f.key])))) {
            showAlert('Record all four vital signs with valid values.', 'warning');
            return;
        }

        if (dispenseData.batch_id) {
            const qty = Number(dispenseData.quantity);
            if (!Number.isInteger(qty) || qty <= 0) {
                showAlert('Quantity must be a whole number above 0.', 'warning');
                return;
            }
            if (dispenseLimit > 0 && qty > dispenseLimit) {
                showAlert(`Limit is ${dispenseLimit} ${dispenseData.unit} per dispense.`, 'warning');
                return;
            }
        }

        try {
            const payload = {
                student_id: sId,
                nurse_id: nurseId,
                ...incidentData,
                complaint_id: dispenseComplaintId,
                specify_complaint_text: specifyRequired ? specifyComplaint.trim() : null,
                ...vitals,
                ...(dispenseData.batch_id && {
                    batch_id: dispenseData.batch_id,
                    dosage_consumption_unit_value: dispenseData.quantity
                })
            };

            const res = await fetch(`http://localhost:3001/api/incident-reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                const flagged = Array.isArray(data.abnormal) ? data.abnormal : [];
                showAlert(flagged.length ? `Saved. ${flagged.join('; ')}` : 'Incident report documented successfully!', flagged.length ? 'warning' : 'success');
                setShowAddIncidentModal(false);
                resetIncidentForm();
                fetchIncidentReports();
                notifyRecordChanged(['incident', 'visit']);
            } else {
                showAlert(data.message || 'Error saving report.', res.status === 409 ? 'warning' : 'error');
            }
        } catch (error) {
            console.error('Save incident error:', error);
            showAlert("We couldn't reach the server. Please try again.", 'error');
        }
    };

    const resetIncidentForm = () => {
        stopCameraScan();
        setSelectedStudent(null);
        setStudentSearch('');
        setStudentResults([]);
        setDispenseComplaintId('');
        setSpecifyComplaint('');
        setVitals(EMPTY_VITALS);
        setDispenseMedicineId('');
        setDispenseData({ batch_id: '', quantity: '', unit: '' });
        setIncidentData({
            incident_datetime: '',
            incident_location: '',
            incident_description: '',
            first_aid_administered: '',
            current_physical_situation: ''
        });
    };

    // Hotline Form Operations (Create/Update/Delete)
    const handleSaveHotline = async (e) => {
        e.preventDefault();
        const method = editingHotlineId ? 'PUT' : 'POST';
        const endpoint = editingHotlineId 
            ? `http://localhost:3001/api/emergency-hotlines/${editingHotlineId}`
            : `http://localhost:3001/api/emergency-hotlines`;

        try {
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hotlineFormData)
            });
            const data = await res.json();
            if (data.success) {
                fetchHotlines();
                resetHotlineForm();
                showAlert('Hotline saved.', 'success');
            } else {
                showAlert(data.message || 'Failed to save emergency contact.', 'error');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleEditHotline = (hotline) => {
        setEditingHotlineId(hotline.hotline_id);
        setHotlineFormData({
            facility_name: hotline.facility_name,
            contact_number: hotline.contact_number,
            description_notes: hotline.description_notes || ''
        });
    };

    const handleDeleteHotline = async (hotline_id) => {
        const confirmed = await showConfirm('Are you sure you want to delete this emergency contact?', { danger: true, confirmLabel: 'Delete' });
        if (!confirmed) return;
        try {
            const res = await fetch(`http://localhost:3001/api/emergency-hotlines/${hotline_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchHotlines();
                showAlert('Hotline deleted.', 'success');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const resetHotlineForm = () => {
        setEditingHotlineId(null);
        setHotlineFormData({ facility_name: '', contact_number: '', description_notes: '' });
    };

    const medicineText = (r) => (r.medicine_name
        ? `${r.medicine_name} - ${Math.round(r.dosage_consumption_unit_value)} ${r.dosage_consumption_unit_of_measure}`
        : '');
    const todayText = formatDate(new Date());
    const statToday = reports.filter(r => r.incident_datetime && formatDate(new Date(r.incident_datetime)) === todayText).length;
    const statMedicine = reports.filter(r => r.medicine_name).length;
    const initialsOf = (r) => `${(r.student_first_name || 'U')[0]}${(r.student_last_name || 'S')[0]}`.toUpperCase();
    const closeAddModal = () => { stopCameraScan(); setShowAddIncidentModal(false); };

    // Esc closes the top-most dialog
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (isCameraScanning) stopCameraScan();
            else if (showAddIncidentModal) closeAddModal();
            else if (showHotlineDirectoryModal) setShowHotlineDirectoryModal(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCameraScanning, showAddIncidentModal, showHotlineDirectoryModal, stopCameraScan]);

    return (
        <div className="incident-page-container">
            {/* Header */}
            <header className="inc-header">
                <div className="inc-title">
                    <div className="inc-title-icon"><AlertTriangle size={26} aria-hidden="true" /></div>
                    <div>
                        <h2>Incident Reports</h2>
                        <p>Campus health and safety incidents</p>
                    </div>
                </div>
                <div className="inc-actions">
                    <button type="button" className="inc-ib" aria-label="Export" title="Export" onClick={handleExportAllReport}>
                        <Printer size={20} aria-hidden="true" />
                    </button>
                    <button type="button" className="inc-ib" aria-label="Emergency hotlines" title="Emergency hotlines" onClick={() => setShowHotlineDirectoryModal(true)}>
                        <PhoneCall size={20} aria-hidden="true" />
                    </button>
                    <button type="button" className="inc-ib inc-ib-primary" aria-label="Document incident" title="Document incident" onClick={() => { resetIncidentForm(); setShowAddIncidentModal(true); }}>
                        <Plus size={22} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {/* Summary */}
            <section className="inc-stats" aria-label="Summary">
                <div className="inc-stat">
                    <div className="inc-stat-icon"><FileText size={22} aria-hidden="true" /></div>
                    <div><div className="inc-stat-value">{reports.length}</div><div className="inc-stat-label">Reports</div></div>
                </div>
                <div className="inc-stat">
                    <div className="inc-stat-icon"><Calendar size={22} aria-hidden="true" /></div>
                    <div><div className="inc-stat-value">{statToday}</div><div className="inc-stat-label">Today</div></div>
                </div>
                <div className="inc-stat">
                    <div className="inc-stat-icon ok"><Pill size={22} aria-hidden="true" /></div>
                    <div><div className="inc-stat-value">{statMedicine}</div><div className="inc-stat-label">Medicine given</div></div>
                </div>
            </section>

            {/* Filters */}
            <section className="filter-card" aria-label="Filters">
                <div className="search-group">
                    <label htmlFor="inc-search" className="visually-hidden">Search reports</label>
                    <Search className="search-icon" size={18} aria-hidden="true" />
                    <input
                        id="inc-search"
                        type="text"
                        placeholder="Student, program, section"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control"
                    />
                </div>
                <div className="date-group">
                    <label htmlFor="inc-date" className="visually-hidden">Date</label>
                    <Calendar className="date-icon" size={18} aria-hidden="true" />
                    <input
                        id="inc-date"
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="form-control"
                    />
                </div>
                <button
                    type="button"
                    className="inc-ib"
                    aria-label="Reset filters"
                    title="Reset filters"
                    disabled={!searchQuery && !dateFilter}
                    onClick={() => { setSearchQuery(''); setDateFilter(''); }}
                >
                    <RefreshCw size={18} aria-hidden="true" />
                </button>
                <div className="inc-count" role="status" aria-live="polite">
                    {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                </div>
            </section>

            {/* Table + details */}
            <div className="inc-workspace">
                <section className="table-card" aria-label="Reports">
                    {loading ? (
                        <div className="empty-state">
                            <RefreshCw className="spin-icon" size={30} aria-hidden="true" />
                            <p>Loading reports...</p>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="empty-state">
                            <AlertTriangle size={40} aria-hidden="true" />
                            <p>No incident reports found.</p>
                        </div>
                    ) : (
                        <div role="table" aria-label="Incident reports">
                            <div role="row" className="inc-grid inc-head">
                                <div role="columnheader">Date &amp; time</div>
                                <div role="columnheader">Student</div>
                                <div role="columnheader">Prog / Yr / Sec</div>
                                <div role="columnheader">Location</div>
                                <div role="columnheader">Medicine</div>
                                <div role="columnheader">Documented by</div>
                                <div role="columnheader"><span className="visually-hidden">Action</span></div>
                            </div>
                            {reports.map((report) => {
                                const isSelected = selectedReport?.incident_id === report.incident_id;
                                const med = medicineText(report);
                                const studentName = `${report.student_first_name || 'Unknown'} ${report.student_last_name || 'Student'}`;
                                return (
                                    <div role="row" key={report.incident_id} className={`inc-grid inc-row${isSelected ? ' selected' : ''}`}>
                                        <div role="cell">
                                            <div className="inc-cell-strong">{formatDate(new Date(report.incident_datetime))}</div>
                                            <div className="inc-cell-sub">{formatTime(new Date(report.incident_datetime))}</div>
                                        </div>
                                        <div role="cell">
                                            <button type="button" className="inc-student" onClick={() => setSelectedReport(report)}>
                                                <span className="inc-avatar" aria-hidden="true">{initialsOf(report)}</span>
                                                <span>
                                                    <span className="inc-name">{studentName}</span>
                                                    <span className="inc-cell-sub">{report.student_id}</span>
                                                </span>
                                            </button>
                                        </div>
                                        <div role="cell">{classLabel(report)}</div>
                                        <div role="cell">{report.incident_location}</div>
                                        <div role="cell"><span className={`inc-chip${med ? ' ok' : ''}`}>{med || 'None'}</span></div>
                                        <div role="cell">{report.nurse_first_name ? `${report.nurse_first_name} ${report.nurse_last_name}` : 'N/A'}</div>
                                        <div role="cell">
                                            <button
                                                type="button"
                                                className="inc-ib"
                                                title="View details"
                                                aria-label="View details"
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedReport(report)}
                                            >
                                                <Eye size={18} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <aside className="inc-panel" aria-label="Incident details">
                    {!selectedReport ? (
                        <div className="inc-panel-empty">
                            <Eye size={36} aria-hidden="true" />
                            <span>Select a report</span>
                        </div>
                    ) : (
                        <div>
                            <div className="inc-panel-head">
                                <h3><FileText size={20} aria-hidden="true" /> Details</h3>
                                <div className="actions-inline" style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button type="button" className="inc-ib inc-ib-ghost" aria-label="Export report" title="Export report" onClick={handleExportSingleReport}>
                                        <Printer size={18} aria-hidden="true" />
                                    </button>
                                    <button type="button" className="inc-ib inc-ib-ghost" aria-label="Close details" title="Close details" onClick={() => setSelectedReport(null)}>
                                        <X size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                            <div className="inc-panel-body">
                                <FormDocument model={buildIncidentModel(selectedReport)} showPdf={false} compact />
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* =========================================
               MODAL 1: ADD INCIDENT REPORT
            ========================================= */}
            {showAddIncidentModal && (
                <div className="modal-overlay">
                    <div className="modal-container xl-modal" role="dialog" aria-modal="true" aria-labelledby="inc-add-title">
                        <div className="modal-header">
                            <h3 id="inc-add-title"><AlertTriangle size={22} aria-hidden="true" /> Document Incident</h3>
                            <button type="button" className="inc-ib inc-ib-ghost" aria-label="Close" title="Close" onClick={closeAddModal}><X size={20} aria-hidden="true" /></button>
                        </div>
                        <form onSubmit={handleSaveIncident} className="modal-body">
                            <div className="inc-form-cols">
                                {/* Left: who, when, where, medicine */}
                                <div className="inc-form-col">
                                    <div className="form-group relative-container">
                                        <div className="inc-label-row">
                                            <label htmlFor="inc-student"><User size={16} aria-hidden="true" /> Student *</label>
                                            <button
                                                type="button"
                                                className="inc-ib"
                                                aria-label="Scan student QR"
                                                title="Scan student QR"
                                                onClick={requestCameraAndStartScan}
                                            >
                                                <Camera size={20} aria-hidden="true" />
                                            </button>
                                        </div>
                                        <input
                                            id="inc-student"
                                            type="text"
                                            placeholder="Name or ID"
                                            value={studentSearch}
                                            onChange={handleStudentSearchChange}
                                            className="form-control"
                                            autoComplete="off"
                                            required
                                        />

                                        {studentResults.length > 0 && (
                                            <ul className="autocomplete-dropdown">
                                                {studentResults.map((s, index) => {
                                                    const sId = s.student_id || s.id || index;
                                                    const fName = s.first_name || s.firstname || s.name || 'Student';
                                                    const lName = s.last_name || s.lastname || '';
                                                    const prog = s.program_id || s.program_name || s.program || '';
                                                    const yr = s.year_level || s.year || '';
                                                    const sec = s.section || '';

                                                    return (
                                                        <li key={sId} onMouseDown={() => handleSelectStudent(s)}>
                                                            <strong>{fName} {lName}</strong> ({sId})
                                                            {prog && <span> - {prog} {yr}{sec}</span>}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}

                                        {selectedStudent && (
                                            <div className="selected-student-badge">
                                                <Check size={18} aria-hidden="true" />
                                                <span>Selected: {selectedStudent.first_name || selectedStudent.firstname} {selectedStudent.last_name || selectedStudent.lastname} ({selectedStudent.student_id || selectedStudent.id})</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label htmlFor="inc-when"><Calendar size={16} aria-hidden="true" /> Date &amp; time *</label>
                                            <input
                                                id="inc-when"
                                                type="datetime-local"
                                                value={incidentData.incident_datetime}
                                                onChange={(e) => setIncidentData({ ...incidentData, incident_datetime: e.target.value })}
                                                className="form-control"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="inc-loc"><MapPin size={16} aria-hidden="true" /> Location *</label>
                                            <input
                                                id="inc-loc"
                                                type="text"
                                                placeholder="e.g. Gymnasium"
                                                value={incidentData.incident_location}
                                                onChange={(e) => setIncidentData({ ...incidentData, incident_location: e.target.value })}
                                                className="form-control"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <fieldset className="inc-medicine">
                                        <legend className="inc-legend"><HeartPulse size={16} aria-hidden="true" /> Vital signs (time in) *</legend>
                                        <div className="form-grid-2">
                                            {VITAL_FIELDS.map(f => {
                                                const state = vitalState(f.key, vitals[f.key]);
                                                return (
                                                    <div className="form-group" key={f.key}>
                                                        <label htmlFor={`inc-vital-${f.key}`}>{f.label} ({f.unit}) *</label>
                                                        <input
                                                            id={`inc-vital-${f.key}`}
                                                            type="text"
                                                            inputMode={f.key === 'blood_pressure' ? 'text' : 'decimal'}
                                                            placeholder={f.placeholder}
                                                            value={vitals[f.key]}
                                                            onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })}
                                                            className="form-control"
                                                            aria-describedby={`inc-vital-${f.key}-note`}
                                                            aria-invalid={state === 'invalid'}
                                                            required
                                                        />
                                                        <div id={`inc-vital-${f.key}-note`} className={state === 'abnormal' || state === 'invalid' ? 'inc-hint inc-vital-flag' : 'inc-hint'} role="status">
                                                            {state === 'abnormal' && <><AlertTriangle size={14} aria-hidden="true" /> {vitalStatusLabel(f.key, vitals[f.key])} ({f.normal})</>}
                                                            {state === 'invalid' && <><AlertTriangle size={14} aria-hidden="true" /> Invalid value</>}
                                                            {state === 'normal' && <><Check size={14} aria-hidden="true" /> Normal</>}
                                                            {state === 'empty' && <>Normal {f.normal}</>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </fieldset>

                                    <div className="form-group">
                                        <label htmlFor="incident-complaint"><Activity size={16} aria-hidden="true" /> Medical condition *</label>
                                        <select
                                            id="incident-complaint"
                                            className="form-control"
                                            required
                                            value={dispenseComplaintId}
                                            onChange={(e) => handleComplaintChange(e.target.value)}
                                        >
                                            <option value="">Select</option>
                                            {complaints.map(c => (
                                                <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>
                                            ))}
                                        </select>
                                        {specifyRequired && (
                                            <input
                                                type="text"
                                                aria-label="Specify medical condition"
                                                placeholder="Specify *"
                                                maxLength={255}
                                                value={specifyComplaint}
                                                onChange={(e) => setSpecifyComplaint(e.target.value)}
                                                className="form-control"
                                                style={{ marginTop: '0.5rem' }}
                                                required
                                            />
                                        )}
                                    </div>

                                    {dispenseComplaintId && (
                                    <fieldset className="inc-medicine">
                                        <legend className="inc-legend"><Pill size={16} aria-hidden="true" /> Medicine</legend>
                                        <div className="inc-medicine-grid">
                                            {dispenseComplaintId && (
                                                <div className="form-group span-3">
                                                    <label htmlFor="incident-medicine">Medicine</label>
                                                    <select
                                                        id="incident-medicine"
                                                        className="form-control"
                                                        value={dispenseMedicineId}
                                                        onChange={(e) => handleMedicineChange(e.target.value)}
                                                    >
                                                        <option value="">{medicineOptions.length ? 'No medicine' : 'None in stock'}</option>
                                                        {medicineOptions.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {dispenseMedicineId && (
                                                <>
                                                    <div className="form-group span-2">
                                                        <label htmlFor="incident-batch">Batch expiry *</label>
                                                        <select
                                                            id="incident-batch"
                                                            className="form-control"
                                                            required
                                                            value={dispenseData.batch_id}
                                                            onChange={(e) => handleBatchChange(e.target.value)}
                                                        >
                                                            <option value="">Select</option>
                                                            {medicineBatches.map(b => (
                                                                <option key={b.batch_id} value={b.batch_id}>
                                                                    {formatDate(new Date(b.expiration_date))} (Stock: {b.current_stock})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {dispenseData.batch_id && (
                                                        <div className="form-group">
                                                            <label htmlFor="incident-qty">Qty ({dispenseData.unit}) *</label>
                                                            <input
                                                                id="incident-qty"
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                max={dispenseLimit > 0 ? dispenseLimit : undefined}
                                                                className="form-control"
                                                                required
                                                                value={dispenseData.quantity}
                                                                onChange={(e) => setDispenseData({ ...dispenseData, quantity: e.target.value ? String(Math.max(1, Math.floor(Number(e.target.value)))) : '' })}
                                                            />
                                                            {dispenseLimit > 0 && <div className="inc-hint">Max {dispenseLimit}</div>}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </fieldset>
                                    )}
                                </div>

                                {/* Right: narrative */}
                                <div className="inc-form-col">
                                    <div className="form-group">
                                        <label htmlFor="inc-desc"><FileText size={16} aria-hidden="true" /> Description *</label>
                                        <textarea
                                            id="inc-desc"
                                            rows="5"
                                            placeholder="What happened"
                                            value={incidentData.incident_description}
                                            onChange={(e) => setIncidentData({ ...incidentData, incident_description: e.target.value })}
                                            className="form-control"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="inc-aid"><Activity size={16} aria-hidden="true" /> First aid *</label>
                                        <textarea
                                            id="inc-aid"
                                            rows="4"
                                            placeholder="Care given"
                                            value={incidentData.first_aid_administered}
                                            onChange={(e) => setIncidentData({ ...incidentData, first_aid_administered: e.target.value })}
                                            className="form-control"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="inc-dispo">Disposition *</label>
                                        <textarea
                                            id="inc-dispo"
                                            rows="3"
                                            placeholder="Sent home, referred, back to class"
                                            value={incidentData.current_physical_situation}
                                            onChange={(e) => setIncidentData({ ...incidentData, current_physical_situation: e.target.value })}
                                            className="form-control"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="inc-ib inc-ib-text" onClick={closeAddModal}>Cancel</button>
                                <button type="submit" className="inc-ib inc-ib-primary inc-ib-text">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================
               CAMERA SCANNER MODAL OVERLAY
            ========================================= */}
            {isCameraScanning && (
                <div className="modal-overlay" style={{ zIndex: 1200 }}>
                    <div className="modal-container medium-modal" role="dialog" aria-modal="true" aria-labelledby="inc-scan-title">
                        <div className="modal-header">
                            <h3 id="inc-scan-title"><Camera size={20} aria-hidden="true" /> Scan QR</h3>
                            <button type="button" className="inc-ib inc-ib-ghost" aria-label="Close scanner" title="Close scanner" onClick={stopCameraScan}><X size={20} aria-hidden="true" /></button>
                        </div>
                        <div className="modal-body">
                            <video ref={videoRef} className="inc-camera-video" muted playsInline />
                            <div className="modal-footer">
                                <button type="button" className="inc-ib inc-ib-text" onClick={stopCameraScan}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
               MODAL 3: EMERGENCY HOTLINE DIRECTORY
            ========================================= */}
            {showHotlineDirectoryModal && (
                <div className="modal-overlay">
                    <div className="modal-container large-modal" role="dialog" aria-modal="true" aria-labelledby="inc-hot-title">
                        <div className="modal-header">
                            <h3 id="inc-hot-title"><PhoneCall size={20} aria-hidden="true" /> Emergency Hotlines</h3>
                            <button type="button" className="inc-ib inc-ib-ghost" aria-label="Close" title="Close" onClick={() => setShowHotlineDirectoryModal(false)}><X size={20} aria-hidden="true" /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSaveHotline} className="hotline-form-box">
                                <h4>{editingHotlineId ? 'Edit contact' : 'New contact'}</h4>
                                <div className="form-grid-3">
                                    <input
                                        type="text"
                                        aria-label="Facility or agency name"
                                        placeholder="Facility / agency *"
                                        value={hotlineFormData.facility_name}
                                        onChange={(e) => setHotlineFormData({ ...hotlineFormData, facility_name: e.target.value })}
                                        className="form-control"
                                        required
                                    />
                                    <input
                                        type="text"
                                        aria-label="Contact number"
                                        placeholder="Contact number *"
                                        value={hotlineFormData.contact_number}
                                        onChange={(e) => setHotlineFormData({ ...hotlineFormData, contact_number: e.target.value })}
                                        className="form-control"
                                        required
                                    />
                                    <input
                                        type="text"
                                        aria-label="Notes"
                                        placeholder="Notes"
                                        value={hotlineFormData.description_notes}
                                        onChange={(e) => setHotlineFormData({ ...hotlineFormData, description_notes: e.target.value })}
                                        className="form-control"
                                    />
                                </div>
                                <div className="hotline-form-actions">
                                    {editingHotlineId && (
                                        <button type="button" className="inc-ib" aria-label="Cancel edit" title="Cancel edit" onClick={resetHotlineForm}>
                                            <X size={18} aria-hidden="true" />
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="inc-ib inc-ib-primary"
                                        aria-label={editingHotlineId ? 'Update hotline' : 'Add hotline'}
                                        title={editingHotlineId ? 'Update hotline' : 'Add hotline'}
                                    >
                                        {editingHotlineId ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
                                    </button>
                                </div>
                            </form>

                            <div className="hotline-list">
                                {hotlines.length === 0 ? (
                                    <div className="empty-state">No hotlines.</div>
                                ) : (
                                    <div role="table" aria-label="Emergency hotlines">
                                        <div role="row" className="inc-hotline-row inc-head">
                                            <div role="columnheader">Facility / agency</div>
                                            <div role="columnheader">Contact</div>
                                            <div role="columnheader">Notes</div>
                                            <div role="columnheader"><span className="visually-hidden">Actions</span></div>
                                        </div>
                                        {hotlines.map((h) => (
                                            <div role="row" className="inc-hotline-row" key={h.hotline_id}>
                                                <div role="cell"><strong>{h.facility_name}</strong></div>
                                                <div role="cell"><span className="contact-chip">{h.contact_number}</span></div>
                                                <div role="cell">{h.description_notes || '—'}</div>
                                                <div role="cell" className="action-cell">
                                                    <button type="button" className="inc-ib" aria-label={`Edit ${h.facility_name}`} title="Edit" onClick={() => handleEditHotline(h)}>
                                                        <Edit size={16} aria-hidden="true" />
                                                    </button>
                                                    <button type="button" className="inc-ib inc-ib-danger" aria-label={`Delete ${h.facility_name}`} title="Delete" onClick={() => handleDeleteHotline(h.hotline_id)}>
                                                        <Trash2 size={16} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentReport;
