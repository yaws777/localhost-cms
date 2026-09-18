import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Search, QrCode, User, Activity, ShieldAlert, Clock, 
    XCircle, CheckCircle, FileText, LogOut, RefreshCw, Camera, AlertTriangle 
} from 'lucide-react';
import jsQR from 'jsqr';
import '../../styles/nurse/VisitLogConsultation.css';

const MEASURED_UNITS = ['mg', 'g', 'mcg', 'mL', 'L'];
const VOLUME_UNITS = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];

const formatExpirationDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const VisitLogConsultation = () => {
    const { nurseId } = useOutletContext();

    const [searchMode, setSearchMode] = useState(null);
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

    const [complaints, setComplaints] = useState([]);
    const [batches, setBatches] = useState([]);
    const [todayVisits, setTodayVisits] = useState([]);

    const [documentingVisit, setDocumentingVisit] = useState(null);
    const [formData, setFormData] = useState({
        complaint_id: '',
        visit_date: new Date().toISOString().split('T')[0],
        time_in: '',
        time_out: '',
        temperature: '',
        respiratory_rate: '',
        pulse_rate: '',
        blood_pressure: '',
        nursing_intervention: '',
        health_advice: '',
        batch_id: '',
        dosage_consumption_unit_value: '',
        dosage_consumption_unit_of_measure: ''
    });

    const [inlineTimeouts, setInlineTimeouts] = useState({});
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

    useEffect(() => {
        fetchComplaints();
        fetchBatches();
        fetchTodayVisits();
    }, [fetchComplaints, fetchBatches, fetchTodayVisits]);

    const handleSelectStudent = useCallback((student) => {
        stopCameraScan();
        setSelectedStudent(student);
        const existingCount = todayVisits.filter(
            v => String(v.student_id).toLowerCase() === String(student.student_id).toLowerCase()
        ).length;
        setPreviousVisitsCount(existingCount);
        setShowConfirmModal(true);
    }, [todayVisits, stopCameraScan]);

    const searchStudentByQr = useCallback(async (studentId) => {
        if (!studentId || !studentId.trim()) return;
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
            alert('Please select or enter a time in the Time Out field before clicking Manual Time Out.');
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
                fetchTodayVisits();
            } else {
                alert(`Time out error: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to set time out.");
        }
    }, [inlineTimeouts, fetchTodayVisits]);

    useEffect(() => {
        let animationFrameId;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        const scanFrame = async () => {
            if (isCameraScanning && videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const video = videoRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

                if (code && code.data && code.data.trim() !== '') {
                    const scannedVal = code.data.trim();
                    stopCameraScan();

                    if (qrTimeoutVisitRef.current) {
                        if (scannedVal.toUpperCase() === qrTimeoutVisitRef.current.student_id.toUpperCase()) {
                            const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
                            const targetVisitId = qrTimeoutVisitRef.current.visit_id;
                            setQrTimeoutVisit(null);
                            setQrTimeoutInput('');
                            await handleManualTimeout(targetVisitId, currentTime);
                        } else {
                            alert(`QR Mismatch! Scanned ID "${scannedVal}" does not match active student ID "${qrTimeoutVisitRef.current.student_id}".`);
                        }
                        return;
                    }

                    if (searchModeRef.current === 'qr') {
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
                alert(`Check-in GRANTED at ${currentTime} for ${selectedStudent.first_name} ${selectedStudent.last_name}. Click "Document" to record details.`);
                setShowConfirmModal(false);
                setSelectedStudent(null);
                setSearchMode(null);
                setSearchQuery('');
                setStudents([]);
                fetchTodayVisits();
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
        setDocumentingVisit(visit);
        setFormData({
            complaint_id: visit.complaint_id || '',
            visit_date: todayStr,
            time_in: visit.time_in || currentTime,
            time_out: visit.time_out || '',
            temperature: visit.temperature || '',
            respiratory_rate: visit.respiratory_rate || '',
            pulse_rate: visit.pulse_rate || '',
            blood_pressure: visit.blood_pressure || '',
            nursing_intervention: visit.nursing_intervention || '',
            health_advice: visit.health_advice || '',
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

    // Calculation helper for total available pcs/volume
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

    const handleDocumentSubmit = async (e) => {
        e.preventDefault();
        if (!documentingVisit) return;

        if (
            !formData.complaint_id || 
            !formData.blood_pressure.trim() || 
            !formData.temperature || 
            !formData.pulse_rate || 
            !formData.respiratory_rate || 
            !formData.nursing_intervention.trim() || 
            !formData.health_advice.trim()
        ) {
            alert('All visit documentation fields are required.');
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
                
                // Treats 'pcs.' as volume unit so quantity deducts from remaining_volume / total available pcs
                if (isVolumeUnit && val > calculatedTotalAvailableVolume) {
                    alert(`Requested quantity (${val} ${formData.dosage_consumption_unit_of_measure}) exceeds total available units (${calculatedTotalAvailableVolume} ${formData.dosage_consumption_unit_of_measure}).`);
                    return;
                }
                if (!isVolumeUnit && val > parseInt(activeBatchInfo.current_stock, 10)) {
                    alert(`Requested quantity (${val}) exceeds available container stock (${activeBatchInfo.current_stock}).`);
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
                fetchBatches();
            } else {
                alert(`Error: ${data.error || 'Failed to save documentation'}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error saving documentation.");
        }
    };

    const handleOpenQrTimeoutModal = (visit) => {
        setQrTimeoutVisit(visit);
        setQrTimeoutInput('');
        requestCameraAndStartScan();
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

    const currentTimeString = new Date().toTimeString().split(' ')[0].substring(0, 5);

    return (
        <div className="consultation-wrapper">
            <div className="consultation-header-panel">
                <h2>Today's Clinic Visit Management</h2>
                <p>Register check-ins, record vital signs, dispense medicine, and handle time-outs for today's visits.</p>
            </div>

            {!searchMode ? (
                <div className="entry-option-card">
                    <h3>Register New Clinic Visit Entry</h3>
                    <p>Select how you would like to locate the student record:</p>
                    <div className="entry-buttons-group">
                        <button className="entry-btn mode-search-btn" onClick={() => setSearchMode('search')}>
                            <Search size={24} />
                            <span>Search Student by Search Bar</span>
                        </button>
                        <button className="entry-btn mode-qr-btn" onClick={() => setSearchMode('qr')}>
                            <QrCode size={24} />
                            <span>Search Student by QR Code</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="search-card-container">
                    <div className="search-card-header">
                        <button className="back-option-btn" onClick={() => { setSearchMode(null); setStudents([]); setSearchQuery(''); stopCameraScan(); }}>
                            ← Change Search Option
                        </button>
                        <span>Mode: <strong>{searchMode === 'search' ? 'Search Bar' : 'QR Scanner'}</strong></span>
                    </div>

                    {searchMode === 'search' ? (
                        <div className="search-input-inner">
                            <Search className="search-inside-icon" size={18} />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search by Student ID, First Name, or Last Name..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="qr-scanner-card-wrapper">
                            <form onSubmit={handleQrScanSubmit} className="qr-scanner-input-container">
                                <QrCode size={22} className="qr-icon-accent" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Scan Student QR Code or Enter Student ID..."
                                    value={qrCodeInput}
                                    onChange={(e) => setQrCodeInput(e.target.value)}
                                />
                                <button type="submit" className="qr-submit-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Camera size={16} />
                                    <span>Scan Student QR</span>
                                </button>
                            </form>

                            {cameraPermissionError && (
                                <div className="camera-denied-guide" style={{
                                    marginTop: '16px',
                                    padding: '16px',
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '8px',
                                    color: '#991b1b'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '8px', fontSize: '15px' }}>
                                        <AlertTriangle size={20} />
                                        <span>{cameraPermissionError}</span>
                                    </div>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                                        Browsers automatically block camera access once denied. To enable permissions manually:
                                    </p>
                                    <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                                        <li>Click the <strong>Lock icon</strong> (🔒) next to the URL bar.</li>
                                        <li>Locate <strong>Camera</strong> permissions and switch it to <strong>Allow</strong>.</li>
                                        <li>Click "Scan Student QR" or refresh the page.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    )}

                    {students.length > 0 && (
                        <div className="search-results-overlay-panel">
                            {students.map((st) => (
                                <div key={st.student_id} className="search-result-row" onClick={() => handleSelectStudent(st)}>
                                    <div className="result-avatar"><User size={16} /></div>
                                    <div className="result-info">
                                        <span className="result-name">{st.first_name} {st.last_name}</span>
                                        <span className="result-meta">ID: {st.student_id} | {st.program_id || 'No Program'} - Year {st.year_level}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isCameraScanning && searchMode === 'qr' && (
                <div className="modal-viewport-backdrop">
                    <div className="modal-body-container confirm-modal-small">
                        <div className="modal-header-accent">
                            <h3>Scan Student QR Code with Camera</h3>
                            <button className="modal-dismiss-btn" onClick={stopCameraScan}><XCircle size={22} /></button>
                        </div>
                        <div className="confirm-modal-body" style={{ textAlign: 'center' }}>
                            <video ref={videoRef} style={{ width: '100%', maxHeight: '280px', borderRadius: '8px', backgroundColor: '#000' }} muted playsInline />
                            <p className="confirm-notice" style={{ marginTop: '12px' }}>Point camera directly at student's QR code to scan Student ID automatically.</p>
                            <div className="modal-action-footer">
                                <button type="button" className="btn-cancel-action" onClick={stopCameraScan}>Cancel Scanner</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && selectedStudent && (
                <div className="modal-viewport-backdrop">
                    <div className="modal-body-container confirm-modal-small">
                        <div className="modal-header-accent" style={{ backgroundColor: previousVisitsCount > 0 ? '#b45309' : undefined }}>
                            <h3>{previousVisitsCount > 0 ? 'Multiple Visit Authorization Required' : 'Confirm Student Check-In'}</h3>
                            <button className="modal-dismiss-btn" onClick={handleDenyVisitEntry}><XCircle size={22} /></button>
                        </div>
                        <div className="confirm-modal-body">
                            <div className="student-profile-summary">
                                <User size={40} />
                                <h4>{selectedStudent.first_name} {selectedStudent.last_name}</h4>
                                <p><strong>Student ID:</strong> {selectedStudent.student_id}</p>
                                <p><strong>Program & Year:</strong> {selectedStudent.program_id || 'N/A'} - Year {selectedStudent.year_level}</p>
                                <p style={{ marginTop: '8px', color: '#059669', fontWeight: '600' }}>
                                    <Clock size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                    Time In: {currentTimeString}
                                </p>
                            </div>

                            {previousVisitsCount > 0 ? (
                                <div style={{
                                    marginTop: '14px',
                                    padding: '12px',
                                    backgroundColor: '#fffbeb',
                                    border: '1px solid #fcd34d',
                                    borderRadius: '8px',
                                    color: '#92400e'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '4px' }}>
                                        <AlertTriangle size={18} />
                                        <span>Repeat Visit Alert ({previousVisitsCount} prior visit/s today)</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.4' }}>
                                        This student has already logged into the clinic <strong>{previousVisitsCount} time(s)</strong> today. Do you wish to <strong>Grant</strong> or <strong>Deny</strong> this additional entry?
                                    </p>
                                </div>
                            ) : (
                                <p className="confirm-notice" style={{ marginTop: '16px' }}>
                                    Grant clinic visit check-in for <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong>?
                                </p>
                            )}

                            <div className="modal-action-footer" style={{ marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    className="btn-cancel-action" 
                                    onClick={handleDenyVisitEntry}
                                    style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                                >
                                    Deny Entry
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-confirm-action" 
                                    onClick={handleConfirmVisitEntry}
                                    style={{ backgroundColor: '#10b981' }}
                                >
                                    Grant Entry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {documentingVisit && (
                <div className="modal-viewport-backdrop">
                    <div className="modal-body-container">
                        <div className="modal-header-accent">
                            <h3>Document Visit - {documentingVisit.first_name} {documentingVisit.last_name}</h3>
                            <button className="modal-dismiss-btn" onClick={() => setDocumentingVisit(null)}><XCircle size={22} /></button>
                        </div>
                        <form onSubmit={handleDocumentSubmit} className="modal-form-scrollable">
                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><User size={16} /> Student & Time Info</h4>
                                <div className="form-fields-grid-layout">
                                    <div className="form-input-element">
                                        <label>Full Name</label>
                                        <input type="text" readOnly value={`${documentingVisit.first_name} ${documentingVisit.last_name}`} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Student ID</label>
                                        <input type="text" readOnly value={documentingVisit.student_id} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Time In <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="time" required value={formData.time_in} onChange={e => setFormData({...formData, time_in: e.target.value})} />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Time Out <span className="label-optional">(Optional)</span></label>
                                        <input type="time" value={formData.time_out} onChange={e => setFormData({...formData, time_out: e.target.value})} />
                                    </div>
                                    <div className="form-input-element full-width-field">
                                        <label>Reason of Visit / Chief Complaint <span style={{ color: '#ef4444' }}>*</span></label>
                                        <select required value={formData.complaint_id} onChange={e => setFormData({...formData, complaint_id: e.target.value})}>
                                            <option value="">-- Choose matching complaint --</option>
                                            {complaints.map(c => (
                                                <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><Activity size={16} /> Vital Signs <span style={{ color: '#ef4444' }}>*</span></h4>
                                <div className="form-fields-grid-layout four-col-layout">
                                    <div className="form-input-element">
                                        <label>BP (mmHg) <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input 
                                            type="text" 
                                            required 
                                            placeholder="120/80" 
                                            pattern="^\d{2,3}\/\d{2,3}$" 
                                            value={formData.blood_pressure} 
                                            onChange={e => setFormData({...formData, blood_pressure: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element">
                                        <label>Temp (°C) <span style={{ color: '#ef4444' }}>*</span></label>
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
                                    <div className="form-input-element">
                                        <label>Pulse (bpm) <span style={{ color: '#ef4444' }}>*</span></label>
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
                                    <div className="form-input-element">
                                        <label>Resp Rate (cpm) <span style={{ color: '#ef4444' }}>*</span></label>
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

                            <div className="form-content-section">
                                <h4 className="section-subtitle-indicator"><ShieldAlert size={16} /> Intervention & Dispensation</h4>
                                <div className="form-fields-grid-layout">
                                    <div className="form-input-element full-width-field">
                                        <label>Nursing Intervention <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea 
                                            required 
                                            rows={2} 
                                            placeholder="Interventions applied..." 
                                            value={formData.nursing_intervention} 
                                            onChange={e => setFormData({...formData, nursing_intervention: e.target.value})} 
                                        />
                                    </div>
                                    <div className="form-input-element full-width-field">
                                        <label>Health Advice <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea 
                                            required 
                                            rows={2} 
                                            placeholder="Counseling provided..." 
                                            value={formData.health_advice} 
                                            onChange={e => setFormData({...formData, health_advice: e.target.value})} 
                                        />
                                    </div>

                                    <div className="form-input-element full-width-field">
                                        <label>
                                            Dispense Medicine 
                                            {isAlreadyDispensed && <span style={{ color: '#059669', marginLeft: '8px', fontWeight: 'bold' }}>(Dispensed / Read-Only)</span>}
                                        </label>
                                        {isAlreadyDispensed ? (
                                            <input 
                                                type="text" 
                                                readOnly 
                                                disabled
                                                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
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
                                                    
                                                    const stockText = isVol 
                                                        ? `${totalAvailable} ${unit} available (${b.remaining_volume} ${unit} open container, ${b.current_stock} container/s)` 
                                                        : `${b.current_stock} container/s`;

                                                    return (
                                                        <option key={b.batch_id} value={b.batch_id} disabled={isExpired || totalAvailable <= 0}>
                                                            {b.medicine_name} — Exp: {formattedExp} {isExpired ? '(EXPIRED)' : `(${stockText})`}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        )}
                                    </div>

                                    {activeBatchInfo && !isAlreadyDispensed && (
                                        <div className="form-input-element full-width-field" style={{
                                            padding: '10px 14px',
                                            backgroundColor: '#f0fdf4',
                                            border: '1px solid #bbf7d0',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: '#166534'
                                        }}>
                                            <strong>Open Container Stock:</strong> {activeBatchInfo.remaining_volume} {activeBatchUnit} remaining in current open box/bottle (Total Available: {calculatedTotalAvailableVolume} {activeBatchUnit}).
                                        </div>
                                    )}

                                    {(formData.batch_id || isAlreadyDispensed) && (
                                        <>
                                            <div className="form-input-element">
                                                <label>Dosage / Quantity {!isAlreadyDispensed && <span style={{ color: '#ef4444' }}>*</span>}</label>
                                                <input 
                                                    type="number" 
                                                    step={isMeasuredUnit ? "any" : "1"} 
                                                    min={isMeasuredUnit ? "0.01" : "1"} 
                                                    required={!isAlreadyDispensed} 
                                                    readOnly={isAlreadyDispensed}
                                                    disabled={isAlreadyDispensed}
                                                    style={isAlreadyDispensed ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                                                    value={formData.dosage_consumption_unit_value} 
                                                    onChange={e => setFormData({...formData, dosage_consumption_unit_value: e.target.value})} 
                                                />
                                            </div>
                                            <div className="form-input-element">
                                                <label>Unit of Measure</label>
                                                <input 
                                                    type="text" 
                                                    readOnly 
                                                    disabled={isAlreadyDispensed}
                                                    style={isAlreadyDispensed ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                                                    value={formData.dosage_consumption_unit_of_measure} 
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="modal-action-footer">
                                <button type="button" className="btn-cancel-action" onClick={() => setDocumentingVisit(null)}>Cancel</button>
                                <button type="submit" className="btn-confirm-action">Save Documentation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {qrTimeoutVisit && (
                <div className="modal-viewport-backdrop">
                    <div className="modal-body-container confirm-modal-small">
                        <div className="modal-header-accent">
                            <h3><Camera size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Scan QR to Time Out</h3>
                            <button className="modal-dismiss-btn" onClick={handleCloseQrTimeoutModal}><XCircle size={22} /></button>
                        </div>
                        <form onSubmit={handleScanTimeoutSubmit} className="confirm-modal-body" style={{ textAlign: 'center' }}>
                            <p style={{ marginBottom: '12px' }}>
                                Scan QR code for <strong>{qrTimeoutVisit.first_name} {qrTimeoutVisit.last_name}</strong> (ID: <code>{qrTimeoutVisit.student_id}</code>)
                            </p>

                            {isCameraScanning ? (
                                <div style={{ marginBottom: '12px' }}>
                                    <video 
                                        ref={videoRef} 
                                        style={{ width: '100%', maxHeight: '240px', borderRadius: '8px', backgroundColor: '#000' }} 
                                        muted 
                                        playsInline 
                                    />
                                    <p className="confirm-notice" style={{ marginTop: '6px', fontSize: '12px' }}>Point camera at student QR code for instant auto time-out.</p>
                                </div>
                            ) : (
                                <button 
                                    type="button" 
                                    className="qr-submit-btn camera-trigger-btn" 
                                    onClick={requestCameraAndStartScan}
                                    style={{ margin: '0 auto 12px auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Camera size={16} />
                                    <span>Start Camera Scanner</span>
                                </button>
                            )}

                            <input
                                type="text"
                                autoFocus
                                className="qr-timeout-input-field"
                                placeholder="Or enter/scan barcode manually..."
                                value={qrTimeoutInput}
                                onChange={(e) => setQrTimeoutInput(e.target.value)}
                            />

                            <div className="modal-action-footer">
                                <button type="button" className="btn-cancel-action" onClick={handleCloseQrTimeoutModal}>Cancel</button>
                                <button type="submit" className="btn-confirm-action">Confirm Time Out</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="history-table-section-card">
                <div className="section-title-wrapper">
                    <Clock size={18} className="title-icon-accent" />
                    <h3>Today's Clinic Visits ({todayStr})</h3>
                    <button className="refresh-table-btn" onClick={fetchTodayVisits}><RefreshCw size={14} /> Refresh</button>
                </div>

                <div className="table-overflow-scroller">
                    <table className="styled-history-table">
                        <thead>
                            <tr>
                                <th>Student Identity</th>
                                <th>Complaint</th>
                                <th>Medicine Dispensed</th>
                                <th>Time In</th>
                                <th>Time Out</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayVisits.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-table-state">No clinic visits logged today.</td>
                                </tr>
                            ) : (
                                todayVisits.map((visit) => {
                                    const isTimedOut = Boolean(visit.time_out && visit.time_out !== '');
                                    const dispensedMed = visit.medicine_name || batches.find(b => b.batch_id === visit.batch_id)?.medicine_name;

                                    return (
                                        <tr key={visit.visit_id} className={isTimedOut ? "row-locked" : "row-active"}>
                                            <td>
                                                <div className="table-profile-cell">
                                                    <span>{visit.first_name} {visit.last_name}</span>
                                                    <small>{visit.student_id}</small>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="complaint-badge">{visit.complaint_name || 'Pending Details'}</span>
                                            </td>
                                            <td>
                                                {dispensedMed ? (
                                                    <span className="complaint-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                                        {dispensedMed}
                                                        {visit.dosage_consumption_unit_value ? ` (${visit.dosage_consumption_unit_value} ${visit.dosage_consumption_unit_of_measure || ''})` : ''}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#9ca3af', fontSize: '13px' }}>None</span>
                                                )}
                                            </td>
                                            <td>{visit.time_in || '--:--'}</td>
                                            <td>
                                                {isTimedOut ? (
                                                    <span className="timestamp-locked-badge">{visit.time_out}</span>
                                                ) : (
                                                    <div className="inline-timeout-group">
                                                        <input 
                                                            type="time"
                                                            className="table-inline-time-input"
                                                            value={inlineTimeouts[visit.visit_id] || ''}
                                                            onChange={(e) => setInlineTimeouts({ ...inlineTimeouts, [visit.visit_id]: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {isTimedOut ? (
                                                    <span className="status-pill status-completed"><CheckCircle size={12} /> Timed Out</span>
                                                ) : (
                                                    <span className="status-pill status-in-progress"><Clock size={12} /> In Clinic</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="action-button-group">
                                                    <button 
                                                        type="button" 
                                                        className="action-btn btn-document"
                                                        onClick={() => handleOpenDocumentModal(visit)}
                                                    >
                                                        <FileText size={14} /> Document
                                                    </button>

                                                    <button 
                                                        type="button" 
                                                        className="action-btn btn-manual-timeout"
                                                        disabled={isTimedOut}
                                                        onClick={() => handleManualTimeout(visit.visit_id)}
                                                    >
                                                        <LogOut size={14} /> Manual Time Out
                                                    </button>

                                                    <button 
                                                        type="button" 
                                                        className="action-btn btn-qr-timeout"
                                                        disabled={isTimedOut}
                                                        onClick={() => handleOpenQrTimeoutModal(visit)}
                                                    >
                                                        <QrCode size={14} /> Scan Time Out
                                                    </button>
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