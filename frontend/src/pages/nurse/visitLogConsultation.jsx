import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { 
    Search, QrCode, User, Activity, ShieldAlert, Clock, 
    XCircle, CheckCircle, FileText, LogOut, RefreshCw, Camera, 
    AlertTriangle, History, Filter, RotateCcw, Download
} from 'lucide-react';
import jsQR from 'jsqr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/VisitLogConsultation.css';

const NURSE_SIGNATURE_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 100" width="260" height="100">
  <path d="
    M 22 72 
    C 18 45, 25 18, 38 24 
    C 48 29, 44 58, 48 74 
    C 53 48, 64 22, 75 26 
    C 84 30, 80 58, 83 72 
    C 87 45, 98 28, 114 31 
    C 126 33, 122 50, 112 53 
    C 128 55, 126 74, 108 74 
    C 96 74, 92 70, 90 66 
    C 95 62, 105 60, 115 60 
    C 122 53, 130 52, 134 56 
    C 138 60, 134 71, 128 71 
    C 123 71, 125 61, 136 61 
    C 141 44, 147 28, 149 32 
    C 151 36, 144 70, 151 70 
    C 155 61, 161 57, 165 60 
    C 169 63, 165 71, 160 71 
    C 156 71, 158 61, 168 61 
    C 173 57, 178 55, 180 58 
    C 180 62, 176 68, 184 68 
    C 188 59, 194 56, 198 59 
    C 202 62, 198 71, 193 71 
    C 189 71, 191 61, 201 61 
    C 206 57, 213 57, 213 63 
    C 213 70, 204 71, 202 63 
    C 202 58, 211 56, 225 56
  " fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`)}`;

const MEASURED_UNITS = ['mg', 'g', 'mcg', 'mL', 'L'];
const VOLUME_UNITS = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];

const CONDITIONAL_COMPLAINT_NAMES = [
    'injury', 
    'others', 
    'gastrointestinal issues', 
    'body pain'
];

const formatDosageForm = (dosageForm, count = 1) => {
    if (!dosageForm) return count === 1 ? 'unit' : 'units';
    if (count === 1) return dosageForm;
    const lower = dosageForm.toLowerCase();
    if (lower.endsWith('s')) return dosageForm;
    if (lower.endsWith('x') || lower.endsWith('ch')) return `${dosageForm}es`;
    return `${dosageForm}s`;
};

const formatDosageFormWithStrength = (batch) => {
    if (!batch) return '';
    const dosageForm = batch.dosage_form || 'Unit';
    const strengthVal = batch.strength_unit_value;
    const strengthUnit = batch.strength_unit_of_measure || batch.avg_dosage_consumption_unit_of_measure || '';
    
    if (strengthVal && strengthUnit) {
        return `${dosageForm}(${strengthVal} ${strengthUnit} per ${dosageForm.toLowerCase()})`;
    }
    return dosageForm;
};

const formatExpirationDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    
    const formattedMonth = month.endsWith('.') ? month : `${month}.`;
    return `${formattedMonth} ${day}, ${year}`;
};

const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '--:--';
    if (timeStr.includes('T')) {
        const dateObj = new Date(timeStr);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
    }
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
};

const VisitLogConsultation = () => {
    const location = useLocation();
    const { nurseId } = useOutletContext();

    const [searchMode, setSearchMode] = useState(() => (
        location.state?.openQrScanner ? 'qr' : null
    ));
    const [searchQuery, setSearchQuery] = useState('');
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [previousVisitsCount, setPreviousVisitsCount] = useState(0);

    const [isCameraScanning, setIsCameraScanning] = useState(false);
    const [cameraPermissionError, setCameraPermissionError] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const isProcessingScan = useRef(false);

    const [complaints, setComplaints] = useState([]);
    const [batches, setBatches] = useState([]);
    const [todayVisits, setTodayVisits] = useState([]);

    const [inlineTimeouts, setInlineTimeouts] = useState({});

    const [showAllLogsModal, setShowAllLogsModal] = useState(false);
    const [allVisits, setAllVisits] = useState([]);
    const [logsSearch, setLogsSearch] = useState('');
    const [fromDateFilter, setFromDateFilter] = useState('');
    const [toDateFilter, setToDateFilter] = useState('');
    const [complaintFilter, setComplaintFilter] = useState('');

    const [documentingVisit, setDocumentingVisit] = useState(null);
    const [formData, setFormData] = useState({
        complaint_id: '',
        specify_complaint_text: '',
        visit_date: new Date().toISOString().split('T')[0],
        time_in: '',
        time_out: '',
        temperature: '',
        respiratory_rate: '',
        pulse_rate: '',
        blood_pressure: '',
        nursing_intervention: '',
        assessment: '',
        batch_id: '',
        dosage_consumption_unit_value: '',
        dosage_consumption_unit_of_measure: ''
    });

    const [qrTimeoutVisit, setQrTimeoutVisit] = useState(null);
    const [qrTimeoutInput, setQrTimeoutInput] = useState('');

    const qrTimeoutVisitRef = useRef(qrTimeoutVisit);
    const searchModeRef = useRef(searchMode);

    useEffect(() => {
        qrTimeoutVisitRef.current = qrTimeoutVisit;
    }, [qrTimeoutVisit]);

    useEffect(() => {
        searchModeRef.current = searchMode;
    }, [searchMode]);

    const todayStr = new Date().toISOString().split('T')[0];

    const handleInlineTimeoutChange = (visitId, value) => {
        setInlineTimeouts(prev => ({
            ...prev,
            [visitId]: value
        }));
    };

    const stopCameraScan = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraScanning(false);
    }, []);

    const requestCameraAndStartScan = useCallback(async () => {
        setCameraPermissionError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraPermissionError("Camera access is not supported by your browser or environment.");
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
            setCameraPermissionError("Unable to access camera: " + (err.message || ''));
        }
    }, []);

    useEffect(() => {
        if (location.state?.openQrScanner) {
            requestCameraAndStartScan();
        }
    }, [location.state, requestCameraAndStartScan]);

    const fetchComplaints = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/chief-complaints');
            const data = await res.json();
            setComplaints(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching complaints:", err);
            setComplaints([]);
        }
    }, []);

    const fetchBatches = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/medicines/batches');
            const data = await res.json();
            setBatches(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching inventory:", err);
            setBatches([]);
        }
    }, []);

    const fetchTodayVisits = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/clinic-visits');
            const data = await res.json();
            if (Array.isArray(data)) {
                const todayOnly = data.filter(v => {
                    if (!v.visit_date) return false;
                    const vDate = new Date(v.visit_date).toISOString().split('T')[0];
                    return vDate === todayStr;
                });
                setTodayVisits(todayOnly);
            }
        } catch (err) {
            console.error("Error fetching today visits:", err);
            setTodayVisits([]);
        }
    }, [todayStr]);

    const fetchAllVisits = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/clinic-visits');
            const data = await res.json();
            setAllVisits(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching all visits:", err);
            setAllVisits([]);
        }
    }, []);

    useEffect(() => {
        fetchComplaints();
        fetchBatches();
        fetchTodayVisits();
    }, [fetchComplaints, fetchBatches, fetchTodayVisits]);

    const handleOpenAllLogs = () => {
        fetchAllVisits();
        setShowAllLogsModal(true);
    };

    const handleClearFilters = () => {
        setLogsSearch('');
        setFromDateFilter('');
        setToDateFilter('');
        setComplaintFilter('');
    };

    const handleOpenQrTimeoutModal = useCallback((visit) => {
        setQrTimeoutVisit(visit);
        setQrTimeoutInput('');
        requestCameraAndStartScan();
    }, [requestCameraAndStartScan]);

    const handleSelectStudent = useCallback((student) => {
        stopCameraScan();

        const activeVisit = todayVisits.find(
            v => String(v.student_id).toLowerCase() === String(student.student_id).toLowerCase() && (!v.time_out || v.time_out === '')
        );

        if (activeVisit) {
            const shouldTimeout = window.confirm(
                `${student.first_name} ${student.last_name} (ID: ${student.student_id}) is ALREADY checked into the clinic!\n\nWould you like to scan or process Time-Out for this student instead?`
            );
            if (shouldTimeout) {
                handleOpenQrTimeoutModal(activeVisit);
            }
            return;
        }

        setSelectedStudent(student);
        const existingCount = todayVisits.filter(
            v => String(v.student_id).toLowerCase() === String(student.student_id).toLowerCase()
        ).length;
        setPreviousVisitsCount(existingCount);
        setShowConfirmModal(true);
    }, [todayVisits, stopCameraScan, handleOpenQrTimeoutModal]);

    const searchStudentByQr = useCallback(async (studentId) => {
        if (!studentId || !studentId.trim() || isProcessingScan.current) return;
        isProcessingScan.current = true;

        try {
            const res = await fetch(`http://localhost:3001/api/students/search?query=${encodeURIComponent(studentId.trim())}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                stopCameraScan();
                handleSelectStudent(data[0]);
            } else {
                alert(`No student found with QR/Student ID: ${studentId}`);
            }
        } catch (err) {
            console.error("Error reading QR code:", err);
            alert("Failed to read QR code data.");
        } finally {
            isProcessingScan.current = false;
        }
    }, [handleSelectStudent, stopCameraScan]);

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.trim().length === 0) {
            setStudents([]);
            return;
        }
        try {
            const res = await fetch(`http://localhost:3001/api/students/search?query=${val}`);
            const data = await res.json();
            setStudents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error searching students:", err);
            setStudents([]);
        }
    };

    useEffect(() => {
        return () => {
            stopCameraScan();
        };
    }, [stopCameraScan]);

    useEffect(() => {
        if (isCameraScanning && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(err => console.error("Error playing video stream:", err));
        }
    }, [isCameraScanning]);

    const handleQrScanSubmit = async (e) => {
        if (e) e.preventDefault();
        if (qrCodeInput.trim()) {
            stopCameraScan();
            await searchStudentByQr(qrCodeInput);
            setQrCodeInput('');
        } else {
            requestCameraAndStartScan();
        }
    };

    const handleManualTimeout = useCallback(async (visitId, timeOutVal = null) => {
        const selectedTime = timeOutVal || inlineTimeouts[visitId];
        
        if (!selectedTime || !selectedTime.trim()) {
            alert('Please select or enter a Time Out time first before clicking Manual Time Out.');
            return;
        }

        try {
            const res = await fetch(`http://localhost:3001/api/clinic-visits/${visitId}/timeout`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time_out: selectedTime })
            });
            const data = await res.json();
            if (data.success) {
                alert('Student successfully timed out.');
                setInlineTimeouts(prev => {
                    const copy = { ...prev };
                    delete copy[visitId];
                    return copy;
                });
                fetchTodayVisits();
                if (showAllLogsModal) fetchAllVisits();
            } else {
                alert(`Time out error: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to set time out.");
        }
    }, [inlineTimeouts, fetchTodayVisits, fetchAllVisits, showAllLogsModal]);

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

                    if (qrTimeoutVisitRef.current) {
                        if (scannedVal.toUpperCase() === qrTimeoutVisitRef.current.student_id.toUpperCase()) {
                            isProcessingScan.current = true;
                            stopCameraScan();
                            const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
                            const targetVisitId = qrTimeoutVisitRef.current.visit_id;
                            setQrTimeoutVisit(null);
                            setQrTimeoutInput('');
                            await handleManualTimeout(targetVisitId, currentTime);
                            isProcessingScan.current = false;
                        } else {
                            alert(`QR Mismatch! Scanned ID "${scannedVal}" does not match active student ID "${qrTimeoutVisitRef.current.student_id}".`);
                        }
                        return;
                    }

                    if (searchModeRef.current === 'qr') {
                        stopCameraScan();
                        await searchStudentByQr(scannedVal);
                        return;
                    }
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
    }, [isCameraScanning, stopCameraScan, searchStudentByQr, handleManualTimeout]);

    const handleConfirmVisitEntry = async () => {
        if (!selectedStudent) return;
        const activeVisit = todayVisits.find(
            v => String(v.student_id).toLowerCase() === String(selectedStudent.student_id).toLowerCase() && !v.time_out
        );

        if (activeVisit) {
            alert(`${selectedStudent.first_name} ${selectedStudent.last_name} (ID: ${selectedStudent.student_id}) is ALREADY currently checked in without timing out!`);
            setShowConfirmModal(false);
            return;
        }

        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
        const checkInPayload = {
            student_id: selectedStudent.student_id,
            nurse_id: nurseId || 'NURSE-DEFAULT',
            visit_date: todayStr,
            time_in: currentTime
        };

        try {
            const res = await fetch('http://localhost:3001/api/clinic-visits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(checkInPayload)
            });
            const data = await res.json();
            if (data.success) {
                alert(`Check-in GRANTED at ${formatTimeDisplay(currentTime)} for ${selectedStudent.first_name} ${selectedStudent.last_name}. Click "Document" to record details.`);
                setShowConfirmModal(false);
                setSelectedStudent(null);
                setSearchMode(null);
                setSearchQuery('');
                setStudents([]);
                fetchTodayVisits();
                if (showAllLogsModal) fetchAllVisits();
            } else {
                alert(`Failed to log check-in: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to backend application.");
        }
    };

    const handleDenyVisitEntry = () => {
        alert(`Check-in entry for ${selectedStudent?.first_name} ${selectedStudent?.last_name} was DENIED.`);
        setShowConfirmModal(false);
        setSelectedStudent(null);
        setPreviousVisitsCount(0);
    };

    const handleOpenDocumentModal = (visit) => {
        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
        const visitDateVal = visit.visit_date ? new Date(visit.visit_date).toISOString().split('T')[0] : todayStr;
        setDocumentingVisit(visit);
        setFormData({
            complaint_id: visit.complaint_id || '',
            specify_complaint_text: visit.specify_complaint_text || visit.specify_complaints_text || '',
            visit_date: visitDateVal,
            time_in: visit.time_in || currentTime,
            time_out: visit.time_out || '',
            temperature: visit.temperature || '',
            respiratory_rate: visit.respiratory_rate || '',
            pulse_rate: visit.pulse_rate || '',
            blood_pressure: visit.blood_pressure || '',
            nursing_intervention: visit.nursing_intervention || '',
            assessment: visit.assessment || visit.health_advice || '',
            batch_id: visit.batch_id || '',
            dosage_consumption_unit_value: visit.dosage_consumption_unit_value || '',
            dosage_consumption_unit_of_measure: visit.dosage_consumption_unit_of_measure || ''
        });
    };

    const handleBatchChange = (batchId) => {
        const selected = batches.find(b => b.batch_id === batchId);
        if (selected) {
            const medicineUnit = selected.avg_dosage_consumption_unit_of_measure 
                || selected.strength_unit_of_measure 
                || 'pcs.';

            let rawValue = selected.avg_dosage_consumption_value;
            let initialValue = (rawValue && parseFloat(rawValue) > 0) ? String(rawValue) : '1';
            
            if (!MEASURED_UNITS.includes(medicineUnit) && initialValue) {
                initialValue = String(Math.max(1, Math.floor(Number(initialValue))));
            }

            setFormData({
                ...formData,
                batch_id: batchId,
                dosage_consumption_unit_of_measure: medicineUnit,
                dosage_consumption_unit_value: initialValue
            });
        } else {
            setFormData({
                ...formData,
                batch_id: '',
                dosage_consumption_unit_value: '',
                dosage_consumption_unit_of_measure: ''
            });
        }
    };

    const getTotalAvailableStock = (batch) => {
        if (!batch) return 0;
        const unit = batch.avg_dosage_consumption_unit_of_measure || batch.strength_unit_of_measure;
        const isVol = VOLUME_UNITS.includes(unit);
        
        if (isVol) {
            const currentStock = parseInt(batch.current_stock, 10) || 0;
            if (currentStock <= 0) return 0;
            const remainingVol = parseFloat(batch.remaining_volume || 0);
            const unitVal = parseFloat(batch.strength_unit_value || 0);
            return remainingVol + (currentStock - 1) * unitVal;
        }
        return parseInt(batch.current_stock, 10) || 0;
    };

    const activeBatchInfo = batches.find(b => b.batch_id === formData.batch_id);
    const activeBatchUnit = activeBatchInfo 
        ? (activeBatchInfo.avg_dosage_consumption_unit_of_measure || activeBatchInfo.strength_unit_of_measure)
        : formData.dosage_consumption_unit_of_measure;

    const isMeasuredUnit = MEASURED_UNITS.includes(formData.dosage_consumption_unit_of_measure);
    const isVolumeUnit = VOLUME_UNITS.includes(activeBatchUnit) || VOLUME_UNITS.includes(formData.dosage_consumption_unit_of_measure);

    const calculatedTotalAvailableVolume = activeBatchInfo && isVolumeUnit ? getTotalAvailableStock(activeBatchInfo) : 0;
    const isAlreadyDispensed = Boolean(documentingVisit?.batch_id || documentingVisit?.medicine_name);

    const selectedComplaintObj = complaints.find(c => String(c.complaint_id) === String(formData.complaint_id));
    const isSpecifyComplaintRequired = selectedComplaintObj && CONDITIONAL_COMPLAINT_NAMES.includes(
        selectedComplaintObj.complaint_name.trim().toLowerCase()
    );

    const handleDocumentSubmit = async (e) => {
        e.preventDefault();
        if (!documentingVisit) return;

        if (
            !formData.complaint_id || 
            (isSpecifyComplaintRequired && !formData.specify_complaint_text.trim()) ||
            !formData.blood_pressure.trim() || 
            !formData.temperature || 
            !formData.pulse_rate || 
            !formData.respiratory_rate || 
            !formData.nursing_intervention.trim() || 
            !formData.assessment.trim()
        ) {
            alert('All required visit documentation fields must be filled out.');
            return;
        }

        if (!isAlreadyDispensed && formData.batch_id && formData.dosage_consumption_unit_value) {
            const val = Number(formData.dosage_consumption_unit_value);
            if (isNaN(val) || val <= 0) {
                alert('Dosage quantity must be greater than 0.');
                return;
            }
            if (!isMeasuredUnit && !Number.isInteger(val)) {
                alert(`Quantity for discrete units (${formData.dosage_consumption_unit_of_measure}) must be a whole integer.`);
                return;
            }
            if (activeBatchInfo) {
                if (new Date(activeBatchInfo.expiration_date) < new Date()) {
                    alert('Cannot dispense from an expired batch.');
                    return;
                }
                
                if (isVolumeUnit && val > calculatedTotalAvailableVolume) {
                    alert(`Requested quantity (${val} ${formData.dosage_consumption_unit_of_measure}) exceeds available stock.`);
                    return;
                }
                if (!isVolumeUnit && val > parseInt(activeBatchInfo.current_stock, 10)) {
                    const formLabel = formatDosageForm(activeBatchInfo.dosage_form, activeBatchInfo.current_stock).toLowerCase();
                    alert(`Requested quantity (${val}) exceeds available ${formLabel} stock (${activeBatchInfo.current_stock}).`);
                    return;
                }
            }
        }

        const submissionPayload = {
            ...formData,
            student_id: documentingVisit.student_id,
            nurse_id: nurseId || 'NURSE-DEFAULT'
        };

        try {
            const res = await fetch(`http://localhost:3001/api/clinic-visits/${documentingVisit.visit_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionPayload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Visit documentation saved successfully!');
                setDocumentingVisit(null);
                fetchTodayVisits();
                if (showAllLogsModal) fetchAllVisits();
                fetchBatches();
            } else {
                alert(`Error: ${data.error || 'Failed to save documentation'}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error saving documentation.");
        }
    };

    const handleCloseQrTimeoutModal = () => {
        setQrTimeoutVisit(null);
        setQrTimeoutInput('');
        stopCameraScan();
    };

    const handleScanTimeoutSubmit = async (e) => {
        e.preventDefault();
        if (!qrTimeoutVisit || !qrTimeoutInput.trim()) return;

        if (qrTimeoutInput.trim().toUpperCase() !== qrTimeoutVisit.student_id.toUpperCase()) {
            alert(`QR Code mismatch! Scanned: "${qrTimeoutInput.trim()}" but expected Student ID: "${qrTimeoutVisit.student_id}"`);
            setQrTimeoutInput('');
            return;
        }

        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
        const visitId = qrTimeoutVisit.visit_id;
        handleCloseQrTimeoutModal();
        await handleManualTimeout(visitId, currentTime);
    };

    const filteredAllVisits = allVisits.filter(visit => {
        const query = logsSearch.toLowerCase().trim();
        const studentFullName = `${visit.first_name || ''} ${visit.last_name || ''}`.toLowerCase();
        const studentId = String(visit.student_id || '').toLowerCase();

        const matchesSearch = !query || studentFullName.includes(query) || studentId.includes(query);

        let matchesFromDate = true;
        let matchesToDate = true;

        if (visit.visit_date) {
            const vDate = new Date(visit.visit_date).toISOString().split('T')[0];
            if (fromDateFilter) matchesFromDate = vDate >= fromDateFilter;
            if (toDateFilter) matchesToDate = vDate <= toDateFilter;
        }

        const matchesComplaint = !complaintFilter || String(visit.complaint_id) === String(complaintFilter);

        return matchesSearch && matchesFromDate && matchesToDate && matchesComplaint;
    });

    const currentTimeRaw = new Date().toTimeString().split(' ')[0].substring(0, 5);
    const currentTimeFormatted = formatTimeDisplay(currentTimeRaw);

    const isVisitDocumented = (visit) => Boolean(visit?.complaint_id || visit?.complaint_name || visit?.nursing_intervention);

    const renderComplaintBadgeText = (visit) => {
        if (!visit.complaint_name) return 'General Checkup';
        const specifyText = visit.specify_complaint_text || visit.specify_complaints_text;
        return specifyText 
            ? `${visit.complaint_name} (${specifyText})` 
            : visit.complaint_name;
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Add STI Logo image
        try {
            if (stiLogo) {
                doc.addImage(stiLogo, 'PNG', 14, 10, 20, 20);
            }
        } catch (err) {
            console.warn("STI Logo render notice:", err);
        }

        // STI Header Details
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("STI COLLEGE BALIUAG", 38, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan.", 38, 20);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text("CLINIC VISIT LOGS REPORT", 38, 26);

        const currentDateStr = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Date Generated: ${currentDateStr} | Total Records: ${filteredAllVisits.length}`, 14, 35);

        doc.setLineWidth(0.4);
        doc.setDrawColor(203, 213, 225);
        doc.line(14, 38, pageWidth - 14, 38);

        // Tabular Columns
        const tableHeaders = [
            ["Date", "Student ID", "Student Name", "Chief Complaint", "Time In", "Time Out", "Medicine Dispensed"]
        ];

        const tableData = filteredAllVisits.map(visit => {
            const vDate = formatDateDisplay(visit.visit_date);
            const stId = visit.student_id || 'N/A';
            const stName = `${visit.first_name || ''} ${visit.last_name || ''}`.trim() || 'N/A';
            const complaint = renderComplaintBadgeText(visit);
            const timeIn = formatTimeDisplay(visit.time_in);
            const timeOut = formatTimeDisplay(visit.time_out);
            
            const dispensedMed = visit.medicine_name || batches.find(b => b.batch_id === visit.batch_id)?.medicine_name;
            const medText = dispensedMed 
                ? `${dispensedMed}${visit.dosage_consumption_unit_value ? ` (${visit.dosage_consumption_unit_value}${visit.dosage_consumption_unit_of_measure || ''})` : ''}`
                : 'None';

            return [vDate, stId, stName, complaint, timeIn, timeOut, medText];
        });

        autoTable(doc, {
            startY: 42,
            head: tableHeaders,
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [30, 58, 138],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5,
                halign: 'left'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [51, 65, 85],
                cellPadding: 2.5
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 24 },
                2: { cellWidth: 32 },
                3: { cellWidth: 38 },
                4: { cellWidth: 18 },
                5: { cellWidth: 18 },
                6: { cellWidth: 'auto' }
            },
            margin: { left: 14, right: 14 }
        });

        const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 50) + 15;
        const pageHeight = doc.internal.pageSize.getHeight();
        
        let signatureY = finalY;
        if (signatureY + 35 > pageHeight) {
            doc.addPage();
            signatureY = 25;
        }

        // SVG Nurse Signature Data URL
        try {
            doc.addImage(NURSE_SIGNATURE_SVG, 'SVG', 14, signatureY, 45, 15);
        } catch (e) {
            console.warn("Signature rendering notice:", e);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Prepared by:", 14, signatureY - 2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text("Marilou H. Balarao", 14, signatureY + 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("School Nurse", 14, signatureY + 23);

        // Preview in a new browser tab instead of direct download
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
    };

    return (
        <div className="consultation-wrapper-vlc">
            <div className="consultation-header-panel-vlc">
                <div className="header-title-container-vlc">
                    <div className="header-text-block-vlc">
                        <h2>Today's Clinic Visit Management</h2>
                        <p>Register check-ins, record vital signs, dispense medicine, and handle time-outs for today's visits.</p>
                    </div>
                    <button 
                        type="button" 
                        className="view-logs-header-btn-vlc" 
                        onClick={handleOpenAllLogs}
                        title="View All Clinic Visit Logs"
                    >
                        <History size={18} />
                        <span>View Logs</span>
                    </button>
                </div>
            </div>

            {!searchMode ? (
                <div className="entry-option-card-vlc">
                    <h3>Register New Clinic Visit Entry</h3>
                    <p>Select how you would like to locate the student record:</p>
                    <div className="entry-buttons-group-vlc">
                        <button className="entry-btn-vlc mode-search-btn-vlc" onClick={() => setSearchMode('search')}>
                            <Search size={20} />
                            <span>Search Student</span>
                        </button>
                        <button className="entry-btn-vlc mode-qr-btn-vlc" onClick={() => setSearchMode('qr')}>
                            <QrCode size={20} />
                            <span>Scan QR Code</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="search-card-container-vlc">
                    <div className="search-card-header-vlc">
                        <button className="back-option-btn-vlc" onClick={() => { setSearchMode(null); setStudents([]); setSearchQuery(''); stopCameraScan(); }}>
                            ← Change Option
                        </button>
                        <span>Mode: <strong>{searchMode === 'search' ? 'Search Bar' : 'QR Scanner'}</strong></span>
                    </div>

                    {searchMode === 'search' ? (
                        <div className="search-input-inner-vlc">
                            <Search className="search-inside-icon-vlc" size={18} />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search by Student ID, First Name, or Last Name..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="qr-scanner-card-wrapper-vlc">
                            <form onSubmit={handleQrScanSubmit} className="qr-scanner-input-container-vlc">
                                <QrCode size={22} className="qr-icon-accent-vlc" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Scan Student QR Code or Enter Student ID..."
                                    value={qrCodeInput}
                                    onChange={(e) => setQrCodeInput(e.target.value)}
                                />
                                <button type="submit" className="qr-submit-btn-vlc">
                                    <Camera size={16} />
                                    <span>Scan QR</span>
                                </button>
                            </form>

                            {cameraPermissionError && (
                                <div className="camera-denied-guide-vlc">
                                    <div className="guide-title-vlc">
                                        <AlertTriangle size={20} />
                                        <span>{cameraPermissionError}</span>
                                    </div>
                                    <p>Browsers automatically block camera access once denied. To enable permissions manually:</p>
                                    <ol>
                                        <li>Click the <strong>Lock icon</strong> (🔒) next to the URL bar.</li>
                                        <li>Locate <strong>Camera</strong> permissions and switch it to <strong>Allow</strong>.</li>
                                        <li>Click "Scan QR" or refresh the page.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    )}

                    {students.length > 0 && (
                        <div className="search-results-overlay-panel-vlc">
                            {students.map((st) => (
                                <div key={st.student_id} className="search-result-row-vlc" onClick={() => handleSelectStudent(st)}>
                                    <div className="result-avatar-vlc"><User size={16} /></div>
                                    <div className="result-info-vlc">
                                        <span className="result-name-vlc">{st.first_name} {st.last_name}</span>
                                        <span className="result-meta-vlc">ID: {st.student_id} | {st.program_id || 'No Program'} - Year {st.year_level}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isCameraScanning && searchMode === 'qr' && (
                <div className="modal-viewport-backdrop-vlc">
                    <div className="modal-body-container-vlc confirm-modal-small-vlc">
                        <div className="modal-header-accent-vlc">
                            <h3>Scan Student QR Code</h3>
                            <button className="modal-dismiss-btn-vlc" onClick={stopCameraScan}><XCircle size={22} /></button>
                        </div>
                        <div className="confirm-modal-body-vlc">
                            <video ref={videoRef} className="camera-preview-video-vlc" muted playsInline />
                            <p className="confirm-notice-vlc">Point camera directly at student's QR code to scan automatically.</p>
                            <div className="modal-action-footer-vlc">
                                <button type="button" className="btn-cancel-action-vlc" onClick={stopCameraScan}>Cancel Scanner</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && selectedStudent && (
                <div className="modal-viewport-backdrop-vlc">
                    <div className="modal-body-container-vlc confirm-modal-small-vlc">
                        <div className="modal-header-accent-vlc" style={{ backgroundColor: previousVisitsCount > 0 ? '#b45309' : undefined }}>
                            <h3>{previousVisitsCount > 0 ? 'Multiple Visit Authorization' : 'Confirm Student Check-In'}</h3>
                            <button className="modal-dismiss-btn-vlc" onClick={handleDenyVisitEntry}><XCircle size={22} /></button>
                        </div>
                        <div className="confirm-modal-body-vlc">
                            <div className="student-profile-summary-vlc">
                                <User size={40} />
                                <h4>{selectedStudent.first_name} {selectedStudent.last_name}</h4>
                                <p><strong>Student ID:</strong> {selectedStudent.student_id}</p>
                                <p><strong>Program & Year:</strong> {selectedStudent.program_id || 'N/A'} - Year {selectedStudent.year_level}</p>
                                <p className="time-in-indicator-vlc">
                                    <Clock size={15} />
                                    Time In: {currentTimeFormatted}
                                </p>
                            </div>

                            {previousVisitsCount > 0 ? (
                                <div className="repeat-alert-box-vlc">
                                    <div className="alert-header-vlc">
                                        <AlertTriangle size={18} />
                                        <span>Repeat Visit Alert ({previousVisitsCount} prior visit/s today)</span>
                                    </div>
                                    <p>
                                        This student has already logged into the clinic <strong>{previousVisitsCount} time(s)</strong> today. Grant or Deny entry?
                                    </p>
                                </div>
                            ) : (
                                <p className="confirm-notice-vlc">
                                    Grant clinic visit check-in for <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong>?
                                </p>
                            )}

                            <div className="modal-action-footer-vlc">
                                <button type="button" className="btn-deny-action-vlc" onClick={handleDenyVisitEntry}>
                                    Deny
                                </button>
                                <button type="button" className="btn-confirm-action-vlc" onClick={handleConfirmVisitEntry}>
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {qrTimeoutVisit && (
                <div className="modal-viewport-backdrop-vlc">
                    <div className="modal-body-container-vlc confirm-modal-small-vlc">
                        <div className="modal-header-accent-vlc">
                            <h3><Camera size={18} /> Scan QR to Time Out</h3>
                            <button className="modal-dismiss-btn-vlc" onClick={handleCloseQrTimeoutModal}><XCircle size={22} /></button>
                        </div>
                        <form onSubmit={handleScanTimeoutSubmit} className="confirm-modal-body-vlc">
                            <p className="qr-timeout-notice-vlc">
                                Scan QR code for <strong>{qrTimeoutVisit.first_name} {qrTimeoutVisit.last_name}</strong> (ID: <code>{qrTimeoutVisit.student_id}</code>)
                            </p>

                            {isCameraScanning ? (
                                <div className="camera-scan-box-vlc">
                                    <video ref={videoRef} className="camera-preview-video-vlc" muted playsInline />
                                    <p className="confirm-notice-vlc">Point camera at student QR code for instant auto time-out.</p>
                                </div>
                            ) : (
                                <button 
                                    type="button" 
                                    className="qr-submit-btn-vlc camera-trigger-btn-vlc" 
                                    onClick={requestCameraAndStartScan}
                                >
                                    <Camera size={16} />
                                    <span>Start Camera Scanner</span>
                                </button>
                            )}

                            <input
                                type="text"
                                autoFocus
                                className="qr-timeout-input-field-vlc"
                                placeholder="Or enter/scan barcode manually..."
                                value={qrTimeoutInput}
                                onChange={(e) => setQrTimeoutInput(e.target.value)}
                            />

                            <div className="modal-action-footer-vlc">
                                <button type="button" className="btn-cancel-action-vlc" onClick={handleCloseQrTimeoutModal}>Cancel</button>
                                <button type="submit" className="btn-confirm-action-vlc">Confirm Time Out</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAllLogsModal && (
                <div className="modal-viewport-backdrop-vlc logs-fullscreen-backdrop-vlc">
                    <div className="modal-body-container-vlc logs-modal-responsive-vlc">
                        <div className="modal-header-accent-vlc">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img src={stiLogo} alt="STI Logo" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
                                <h3>
                                    <History size={20} /> All Clinic Visit Logs History
                                </h3>
                            </div>
                            <button className="modal-dismiss-btn-vlc" onClick={() => setShowAllLogsModal(false)}>
                                <XCircle size={22} />
                            </button>
                        </div>

                        <div className="logs-modal-scroll-area-vlc">
                            <div className="logs-filter-toolbar-vlc">
                                <div className="filter-input-group-vlc search-flex-grow-vlc">
                                    <label><Search size={14} /> Search Student</label>
                                    <div className="filter-search-box-vlc">
                                        <Search size={16} className="search-box-icon-vlc" />
                                        <input 
                                            type="text" 
                                            placeholder="Search name, student ID..." 
                                            value={logsSearch}
                                            onChange={(e) => setLogsSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="filter-input-group-vlc">
                                    <label>From Date</label>
                                    <input 
                                        type="date" 
                                        value={fromDateFilter} 
                                        onChange={(e) => setFromDateFilter(e.target.value)} 
                                    />
                                </div>

                                <div className="filter-input-group-vlc">
                                    <label>To Date</label>
                                    <input 
                                        type="date" 
                                        value={toDateFilter} 
                                        onChange={(e) => setToDateFilter(e.target.value)} 
                                    />
                                </div>

                                <div className="filter-input-group-vlc">
                                    <label><Filter size={14} /> Chief Complaint</label>
                                    <select 
                                        value={complaintFilter} 
                                        onChange={(e) => setComplaintFilter(e.target.value)}
                                    >
                                        <option value="">All Complaints</option>
                                        {complaints.map(c => (
                                            <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="filter-input-group-vlc reset-btn-group-vlc" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                    {(logsSearch || fromDateFilter || toDateFilter || complaintFilter) && (
                                        <button 
                                            type="button" 
                                            className="btn-clear-filters-vlc"
                                            onClick={handleClearFilters}
                                            title="Clear All Filters"
                                        >
                                            <RotateCcw size={14} />
                                            <span>Reset</span>
                                        </button>
                                    )}
                                    <button 
                                        type="button" 
                                        className="btn-export-pdf-vlc"
                                        onClick={handleExportPDF}
                                        title="Export Visit Logs to PDF"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 14px',
                                            backgroundColor: '#1e3a8a',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            width: 'auto',
                                            flexShrink: 0
                                        }}
                                    >
                                        <Download size={14} />
                                        <span>Export</span>
                                    </button>
                                </div>
                            </div>

                            <div className="logs-summary-indicator-vlc">
                                Showing <strong>{filteredAllVisits.length}</strong> of <strong>{allVisits.length}</strong> total clinic visit records
                            </div>

                            <div className="table-overflow-scroller-vlc">
                                <table className="styled-history-table-vlc">
                                    <thead>
                                        <tr>
                                            <th>Visit Date</th>
                                            <th>Student Identity</th>
                                            <th>Complaint</th>
                                            <th>Medicine Dispensed</th>
                                            <th>Time In / Out</th>
                                            <th>Status</th>
                                            <th className="text-center-vlc">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAllVisits.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="empty-table-state-vlc">
                                                    No visit logs match the selected search or filter criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAllVisits.map((visit) => {
                                                const isTimedOut = Boolean(visit.time_out && visit.time_out !== '');
                                                const documented = isVisitDocumented(visit);
                                                const dispensedMed = visit.medicine_name || batches.find(b => b.batch_id === visit.batch_id)?.medicine_name;

                                                return (
                                                    <tr key={visit.visit_id} className={isTimedOut ? "row-locked-vlc" : "row-active-vlc"}>
                                                        <td>
                                                            <div className="table-date-cell-vlc">
                                                                <span>{formatDateDisplay(visit.visit_date)}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="table-profile-cell-vlc">
                                                                <span>{visit.first_name} {visit.last_name}</span>
                                                                <small>ID: {visit.student_id} | {visit.program_id || 'N/A'}</small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {documented ? (
                                                                <span className="complaint-badge-vlc">{renderComplaintBadgeText(visit)}</span>
                                                            ) : (
                                                                <span className="status-pill-vlc status-undocumented-vlc" title="Visit needs documentation">
                                                                    <AlertTriangle size={12} /> Not Documented
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {dispensedMed ? (
                                                                <span className="medicine-badge-vlc">
                                                                    {dispensedMed}
                                                                    {visit.dosage_consumption_unit_value ? ` (${visit.dosage_consumption_unit_value} ${visit.dosage_consumption_unit_of_measure || ''})` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="no-med-text-vlc">None</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="table-time-range-vlc">
                                                                <span>In: {formatTimeDisplay(visit.time_in)}</span>
                                                                <small>Out: {formatTimeDisplay(visit.time_out)}</small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {isTimedOut ? (
                                                                <span className="status-pill-vlc status-completed-vlc"><CheckCircle size={12} /> Timed Out</span>
                                                            ) : (
                                                                <span className="status-pill-vlc status-in-progress-vlc"><Clock size={12} /> In Clinic</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="action-button-group-vlc">
                                                                <button 
                                                                    type="button" 
                                                                    className={`icon-action-btn-vlc btn-document-vlc ${!documented ? 'needs-doc-vlc' : ''}`}
                                                                    title={documented ? "View or Edit Documentation" : "Needs Documentation"}
                                                                    aria-label="Document Visit"
                                                                    onClick={() => handleOpenDocumentModal(visit)}
                                                                >
                                                                    <FileText size={16} />
                                                                    {!documented && <span className="doc-warning-dot-vlc" title="Not documented yet" />}
                                                                </button>

                                                                {!isTimedOut && (
                                                                    <>
                                                                        <button 
                                                                            type="button" 
                                                                            className="icon-action-btn-vlc btn-qr-timeout-vlc"
                                                                            title="Scan QR to Time Out"
                                                                            aria-label="Scan QR to Time Out"
                                                                            onClick={() => handleOpenQrTimeoutModal(visit)}
                                                                        >
                                                                            <QrCode size={16} />
                                                                        </button>
                                                                        <input 
                                                                            type="time" 
                                                                            className="inline-time-input-vlc" 
                                                                            title="Select custom time-out before manual time out"
                                                                            value={inlineTimeouts[visit.visit_id] || ''} 
                                                                            onChange={(e) => handleInlineTimeoutChange(visit.visit_id, e.target.value)} 
                                                                        />
                                                                        <button 
                                                                            type="button" 
                                                                            className="icon-action-btn-vlc btn-manual-timeout-vlc"
                                                                            title="Manual Time Out"
                                                                            aria-label="Manual Time Out"
                                                                            onClick={() => handleManualTimeout(visit.visit_id)}
                                                                        >
                                                                            <LogOut size={16} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="logs-modal-footer-vlc">
                            <button type="button" className="btn-cancel-action-vlc" onClick={() => setShowAllLogsModal(false)}>
                                Close Logs
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {documentingVisit && (
                <div className="modal-viewport-backdrop-vlc" style={{ zIndex: 1100 }}>
                    <div className="modal-body-container-vlc">
                        <div className="modal-header-accent-vlc">
                            <h3>Document Visit - {documentingVisit.first_name} {documentingVisit.last_name}</h3>
                            <button className="modal-dismiss-btn-vlc" onClick={() => setDocumentingVisit(null)}><XCircle size={22} /></button>
                        </div>
                        <form onSubmit={handleDocumentSubmit} className="modal-form-scrollable-vlc">
                            {!isVisitDocumented(documentingVisit) && (
                                <div className="undocumented-banner-vlc">
                                    <AlertTriangle size={18} />
                                    <span>This visit is <strong>not yet documented</strong>. Please complete the vital signs and intervention fields below.</span>
                                </div>
                            )}

                            <div className="form-content-section-vlc">
                                <h4 className="section-subtitle-indicator-vlc"><User size={16} /> Student & Time Info</h4>
                                <div className="form-fields-grid-layout-vlc">
                                    <div className="form-input-element-vlc">
                                        <label>Full Name</label>
                                        <input type="text" readOnly value={`${documentingVisit.first_name} ${documentingVisit.last_name}`} />
                                    </div>
                                    <div className="form-input-element-vlc">
                                        <label>Student ID</label>
                                        <input type="text" readOnly value={documentingVisit.student_id} />
                                    </div>
                                    <div className="form-input-element-vlc">
                                        <label>Time In <span className="required-star-vlc">*</span></label>
                                        <input type="time" required value={formData.time_in} onChange={e => setFormData({...formData, time_in: e.target.value})} />
                                    </div>
                                    <div className="form-input-element-vlc">
                                        <label>Time Out <span className="label-optional-vlc">(Optional)</span></label>
                                        <input type="time" value={formData.time_out} onChange={e => setFormData({...formData, time_out: e.target.value})} />
                                    </div>
                                    <div className="form-input-element-vlc full-width-field-vlc">
                                        <label>Chief Complaint <span className="required-star-vlc">*</span></label>
                                        <select 
                                            required 
                                            value={formData.complaint_id} 
                                            onChange={e => setFormData({
                                                ...formData, 
                                                complaint_id: e.target.value,
                                                specify_complaint_text: ''
                                            })}
                                        >
                                            <option value="">-- Choose matching complaint --</option>
                                            {complaints.map(c => (
                                                <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {isSpecifyComplaintRequired && (
                                        <div className="form-input-element-vlc full-width-field-vlc">
                                            <label>
                                                Specify Complaint Details <span className="required-star-vlc">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                required 
                                                placeholder="Provide specific details regarding the selected complaint..." 
                                                value={formData.specify_complaint_text} 
                                                onChange={e => setFormData({...formData, specify_complaint_text: e.target.value})} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-content-section-vlc">
                                <h4 className="section-subtitle-indicator-vlc"><Activity size={16} /> Vital Signs <span className="required-star-vlc">*</span></h4>
                                <div className="form-fields-grid-layout-vlc four-col-layout-vlc">
                                    <div className="form-input-element-vlc">
                                        <label>BP (mmHg) <span className="required-star-vlc">*</span></label>
                                        <input 
                                            type="text" 
                                            required 
                                            placeholder="120/80" 
                                            pattern="^\d{2,3}\/\d{2,3}$" 
                                            value={formData.blood_pressure} 
                                            onChange={e => setFormData({...formData, blood_pressure: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element-vlc">
                                        <label>Temp (°C) <span className="required-star-vlc">*</span></label>
                                        <input 
                                            type="number" 
                                            required 
                                            step="0.1" 
                                            min="30" 
                                            max="45" 
                                            placeholder="36.5" 
                                            value={formData.temperature} 
                                            onChange={e => setFormData({...formData, temperature: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element-vlc">
                                        <label>Pulse (bpm) <span className="required-star-vlc">*</span></label>
                                        <input 
                                            type="number" 
                                            required 
                                            min="30" 
                                            max="250" 
                                            placeholder="72" 
                                            value={formData.pulse_rate} 
                                            onChange={e => setFormData({...formData, pulse_rate: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element-vlc">
                                        <label>Resp Rate <span className="required-star-vlc">*</span></label>
                                        <input 
                                            type="number" 
                                            required 
                                            min="8" 
                                            max="60" 
                                            placeholder="18" 
                                            value={formData.respiratory_rate} 
                                            onChange={e => setFormData({...formData, respiratory_rate: e.target.value})} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-content-section-vlc">
                                <h4 className="section-subtitle-indicator-vlc"><ShieldAlert size={16} /> Intervention & Dispensation</h4>
                                <div className="form-fields-grid-layout-vlc">
                                    <div className="form-input-element-vlc full-width-field-vlc">
                                        <label>Nursing Intervention <span className="required-star-vlc">*</span></label>
                                        <textarea 
                                            required 
                                            rows={2} 
                                            placeholder="Interventions applied..." 
                                            value={formData.nursing_intervention} 
                                            onChange={e => setFormData({...formData, nursing_intervention: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element-vlc full-width-field-vlc">
                                        <label>Assessment <span className="required-star-vlc">*</span></label>
                                        <textarea 
                                            required 
                                            rows={2} 
                                            placeholder="assessment provided..." 
                                            value={formData.assessment} 
                                            onChange={e => setFormData({...formData, assessment: e.target.value})} 
                                        />
                                    </div>

                                    <div className="form-input-element-vlc full-width-field-vlc">
                                        <label>
                                            Dispense Medicine 
                                            {isAlreadyDispensed && <span className="dispensed-flag-vlc">(Dispensed / Read-Only)</span>}
                                        </label>
                                        {isAlreadyDispensed ? (
                                            <input 
                                                type="text" 
                                                readOnly 
                                                disabled
                                                className="read-only-input-vlc"
                                                value={
                                                    documentingVisit.medicine_name || 
                                                    batches.find(b => b.batch_id === formData.batch_id)?.medicine_name || 
                                                    formData.batch_id || 
                                                    'No medication dispensed'
                                                } 
                                            />
                                        ) : (
                                            <select value={formData.batch_id} onChange={e => handleBatchChange(e.target.value)}>
                                                <option value="">-- No medication needed --</option>
                                                {batches.map(b => {
                                                    const isExpired = new Date(b.expiration_date) < new Date();
                                                    const formattedExp = formatExpirationDate(b.expiration_date);
                                                    const unit = b.avg_dosage_consumption_unit_of_measure || b.strength_unit_of_measure || 'pcs.';
                                                    const totalAvailable = getTotalAvailableStock(b);
                                                    const isVol = VOLUME_UNITS.includes(unit);
                                                    
                                                    const dosageFormPlural = formatDosageForm(b.dosage_form, b.current_stock);
                                                    const dosageWithStrength = formatDosageFormWithStrength(b);

                                                    const stockText = isVol 
                                                        ? `Stock: ${b.current_stock} ${dosageFormPlural.toLowerCase()} (${b.remaining_volume} ${unit} open)` 
                                                        : `Stock: ${b.current_stock} ${dosageFormPlural.toLowerCase()}`;

                                                    return (
                                                        <option key={b.batch_id} value={b.batch_id} disabled={isExpired || totalAvailable <= 0}>
                                                            {b.medicine_name} ({dosageWithStrength}) — Exp: {formattedExp} {isExpired ? '(EXPIRED)' : `(${stockText})`}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        )}
                                    </div>

                                    {activeBatchInfo && !isAlreadyDispensed && (
                                        <div className="stock-info-banner-vlc">
                                            <strong>Current Stock:</strong> {activeBatchInfo.current_stock} {formatDosageForm(activeBatchInfo.dosage_form, activeBatchInfo.current_stock).toLowerCase()}
                                            {isVolumeUnit ? ` (${activeBatchInfo.remaining_volume} ${activeBatchUnit} remaining in open ${formatDosageFormWithStrength(activeBatchInfo)})` : ''}.
                                        </div>
                                    )}

                                    {(formData.batch_id || isAlreadyDispensed) && (
                                        <>
                                            <div className="form-input-element-vlc">
                                                <label>Dosage / Quantity {!isAlreadyDispensed && <span className="required-star-vlc">*</span>}</label>
                                                <input 
                                                    type="number" 
                                                    step={isMeasuredUnit ? "any" : "1"} 
                                                    min={isMeasuredUnit ? "0.01" : "1"} 
                                                    required={!isAlreadyDispensed} 
                                                    readOnly={isAlreadyDispensed}
                                                    disabled={isAlreadyDispensed}
                                                    className={isAlreadyDispensed ? "read-only-input-vlc" : ""}
                                                    value={formData.dosage_consumption_unit_value} 
                                                    onChange={e => setFormData({...formData, dosage_consumption_unit_value: e.target.value})} 
                                                />
                                            </div>
                                            <div className="form-input-element-vlc">
                                                <label>Unit of Measure</label>
                                                <input 
                                                    type="text" 
                                                    readOnly 
                                                    disabled={isAlreadyDispensed}
                                                    className={isAlreadyDispensed ? "read-only-input-vlc" : ""}
                                                    value={formData.dosage_consumption_unit_of_measure} 
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="modal-action-footer-vlc">
                                <button type="button" className="btn-cancel-action-vlc" onClick={() => setDocumentingVisit(null)}>Cancel</button>
                                <button type="submit" className="btn-confirm-action-vlc">Save Documentation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="history-table-section-card-vlc">
                <div className="section-title-wrapper-vlc">
                    <div className="title-left-vlc">
                        <Clock size={18} className="title-icon-accent-vlc" />
                        <h3>Today's Clinic Visits ({todayStr})</h3>
                    </div>
                    <button className="refresh-table-btn-vlc" onClick={fetchTodayVisits}>
                        <RefreshCw size={14} /> 
                        <span>Refresh</span>
                    </button>
                </div>

                <div className="table-overflow-scroller-vlc">
                    <table className="styled-history-table-vlc">
                        <thead>
                            <tr>
                                <th>Student Identity</th>
                                <th>Complaint</th>
                                <th>Medicine Dispensed</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Status</th>
                                <th className="text-center-vlc">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayVisits.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-table-state-vlc">No clinic visits logged today.</td>
                                </tr>
                            ) : (
                                todayVisits.map((visit) => {
                                    const isTimedOut = Boolean(visit.time_out && visit.time_out !== '');
                                    const documented = isVisitDocumented(visit);
                                    const dispensedMed = visit.medicine_name || batches.find(b => b.batch_id === visit.batch_id)?.medicine_name;

                                    return (
                                        <tr key={visit.visit_id} className={isTimedOut ? "row-locked-vlc" : "row-active-vlc"}>
                                            <td>
                                                <div className="table-profile-cell-vlc">
                                                    <span>{visit.first_name} {visit.last_name}</span>
                                                    <small>{visit.student_id}</small>
                                                </div>
                                            </td>
                                            <td>
                                                {documented ? (
                                                    <span className="complaint-badge-vlc">{renderComplaintBadgeText(visit)}</span>
                                                ) : (
                                                    <span className="status-pill-vlc status-undocumented-vlc" title="Visit needs documentation">
                                                        <AlertTriangle size={12} /> Not Documented
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {dispensedMed ? (
                                                    <span className="medicine-badge-vlc">
                                                        {dispensedMed}
                                                        {visit.dosage_consumption_unit_value ? ` (${visit.dosage_consumption_unit_value} ${visit.dosage_consumption_unit_of_measure || ''})` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="no-med-text-vlc">None</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="table-time-range-vlc">
                                                    <span>{formatTimeDisplay(visit.time_in)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="table-time-range-vlc">
                                                    <span>{formatTimeDisplay(visit.time_out)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {isTimedOut ? (
                                                    <span className="status-pill-vlc status-completed-vlc"><CheckCircle size={12} /> Timed Out</span>
                                                ) : (
                                                    <span className="status-pill-vlc status-in-progress-vlc"><Clock size={12} /> In Clinic</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="action-button-group-vlc">
                                                    <button 
                                                        type="button" 
                                                        className={`icon-action-btn-vlc btn-document-vlc ${!documented ? 'needs-doc-vlc' : ''}`}
                                                        title={documented ? "View or Edit Documentation" : "Needs Documentation"}
                                                        aria-label="Document Visit"
                                                        onClick={() => handleOpenDocumentModal(visit)}
                                                    >
                                                        <FileText size={16} />
                                                        {!documented && <span className="doc-warning-dot-vlc" title="Not documented yet" />}
                                                    </button>

                                                    {!isTimedOut && (
                                                        <>
                                                            <button 
                                                                type="button" 
                                                                className="icon-action-btn-vlc btn-qr-timeout-vlc"
                                                                title="Scan QR to Time Out"
                                                                aria-label="Scan QR to Time Out"
                                                                onClick={() => handleOpenQrTimeoutModal(visit)}
                                                            >
                                                                <QrCode size={16} />
                                                            </button>
                                                            <input 
                                                                type="time" 
                                                                className="inline-time-input-vlc" 
                                                                title="Select custom time-out before manual time out"
                                                                value={inlineTimeouts[visit.visit_id] || ''} 
                                                                onChange={(e) => handleInlineTimeoutChange(visit.visit_id, e.target.value)} 
                                                            />
                                                            <button 
                                                                type="button" 
                                                                className="icon-action-btn-vlc btn-manual-timeout-vlc"
                                                                title="Manual Time Out"
                                                                aria-label="Manual Time Out"
                                                                onClick={() => handleManualTimeout(visit.visit_id)}
                                                            >
                                                                <LogOut size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VisitLogConsultation;