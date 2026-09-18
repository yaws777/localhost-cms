import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import jsPDF from 'jspdf';
import { 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Eye, 
    Upload, 
    X, 
    Search,
    Paperclip,
    AlertCircle,
    ArrowLeft,
    Send,
    Edit3,
    FileText,
    Settings,
    Plus,
    Trash2,
    Building,
    Stethoscope,
    RefreshCw,
    FileCode
} from 'lucide-react';

import stiLogo from '../../assets/sti-logo.jpg';
import '../../styles/nurse/DocumentIssuance.css';


const DocumentIssuance = () => {
    const { nurseId } = useOutletContext();

    const [requests, setRequests] = useState([]);
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filter & Search states - Default filter set to 'Waiting for Approval'
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Waiting for Approval');
    const [typeFilter, setTypeFilter] = useState('All');

    // Modal & Approval Flow states
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isApproving, setIsApproving] = useState(false);
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    // Referral Mode Toggle ('autogen' | 'upload')
    const [referralMode, setReferralMode] = useState('autogen');

    // Referral Services Configuration Modal States
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [facilities, setFacilities] = useState([]);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState('');

    // Form states and toggles for Facility CRUD
    const [facilityForm, setFacilityForm] = useState({ facility_id: '', facility_name: '', address: '', contact_number: '' });
    const [isEditingFacility, setIsEditingFacility] = useState(false);
    const [showFacilityForm, setShowFacilityForm] = useState(false);

    // Form states and toggles for Service CRUD
    const [serviceForm, setServiceForm] = useState({ service_id: '', facility_id: '', service_name: '', description: '' });
    const [isEditingService, setIsEditingService] = useState(false);
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [activeFacilityName, setActiveFacilityName] = useState('');

    // Auto-Generated Slip Editable State (Supports both Excuse and Referral)
    const [slipDetails, setSlipDetails] = useState({
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        studentName: '',
        courseYearSection: '',
        reason: '',
        partnerFacility: '',
        requestedServices: '',
        nurseName: 'MARILOU H. BALARAO'
    });

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/document-requests');
            const data = await response.json();
            if (data.success) {
                setRequests(data.requests || []);
                setFilteredRequests(data.requests || []);
            } else {
                setError(data.message || 'Failed to load document requests');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Could not connect to backend server.');
        } finally {
            setLoading(false);
        }
    };

    const fetchFacilities = async () => {
        setConfigLoading(true);
        setConfigError('');
        try {
            const res = await fetch('http://localhost:3001/api/partner-facilities');
            if (!res.ok) throw new Error(`Server returned status ${res.status}`);
            const data = await res.json();
            
            let loadedFacilities = [];
            if (Array.isArray(data)) {
                loadedFacilities = data;
            } else if (Array.isArray(data.facilities)) {
                loadedFacilities = data.facilities;
            } else if (Array.isArray(data.data)) {
                loadedFacilities = data.data;
            }

            setFacilities(loadedFacilities);
        } catch (err) {
            console.error('Error fetching facilities:', err);
            setConfigError('Failed to load partner facilities. Please ensure your backend is running at http://localhost:3001.');
        } finally {
            setConfigLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        if (showConfigModal) {
            fetchFacilities();
        }
    }, [showConfigModal]);

    // Filter Logic
    useEffect(() => {
        let result = requests;

        if (statusFilter !== 'All') {
            result = result.filter(r => {
                const statusStr = (r.status || '').toLowerCase();
                const filterStr = statusFilter.toLowerCase();
                
                if (filterStr === 'waiting for approval') {
                    return statusStr === 'pending' || statusStr === 'waiting for approval';
                }
                return statusStr === filterStr;
            });
        }

        if (typeFilter !== 'All') {
            result = result.filter(r => r.request_type === typeFilter);
        }

        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            result = result.filter(r => 
                `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(term) ||
                (r.student_id && r.student_id.toLowerCase().includes(term)) ||
                (r.request_id && r.request_id.toString().toLowerCase().includes(term))
            );
        }

        setFilteredRequests(result);
    }, [searchTerm, statusFilter, typeFilter, requests]);

    const summary = {
        pending: requests.filter(r => ['pending', 'waiting for approval'].includes((r.status || '').toLowerCase())).length,
        completed: requests.filter(r => ['completed', 'approved'].includes((r.status || '').toLowerCase())).length,
        denied: requests.filter(r => (r.status || '').toLowerCase() === 'denied').length
    };

    const fetchNotes = async (requestType, requestId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/document-requests/notes/${requestType}/${requestId}`);
            const data = await res.json();
            if (data.success) {
                setNotes(data.notes || []);
            }
        } catch (err) {
            console.error("Error fetching notes:", err);
        }
    };

    const handleViewDetails = async (reqItem) => {
        setSelectedRequest(reqItem);
        setIsApproving(false);
        setNewNote('');
        setSelectedFile(null);
        setModalError('');
        setReferralMode('autogen');

        const todayFormatted = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        setSlipDetails({
            date: todayFormatted,
            studentName: `${reqItem.first_name || ''} ${reqItem.last_name || ''}`.trim(),
            courseYearSection: `${reqItem.program_id || ''} - Year ${reqItem.year_level || ''}`,
            reason: reqItem.reason || reqItem.reason_for_excuse || '',
            partnerFacility: reqItem.partner_facility_name || 'N/A',
            requestedServices: reqItem.requested_services || 'N/A',
            nurseName: 'MARILOU H. BALARAO'
        });

        await fetchNotes(reqItem.request_type, reqItem.request_id);
    };

    const closeModal = () => {
        setSelectedRequest(null);
        setIsApproving(false);
        setNotes([]);
        setNewNote('');
        setSelectedFile(null);
        setModalError('');
    };

    // CRUD Handlers for Partner Facilities
    const handleSaveFacility = async (e) => {
        e.preventDefault();
        if (!facilityForm.facility_name.trim()) return;

        const targetId = facilityForm.facility_id || facilityForm.id;
        const url = isEditingFacility 
            ? `http://localhost:3001/api/partner-facilities/${targetId}`
            : 'http://localhost:3001/api/partner-facilities';
        const method = isEditingFacility ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(facilityForm)
            });
            const data = await res.json();
            if (data.success || res.ok) {
                setFacilityForm({ facility_id: '', facility_name: '', address: '', contact_number: '' });
                setIsEditingFacility(false);
                setShowFacilityForm(false);
                fetchFacilities();
            } else {
                alert(data.message || 'Failed to save facility');
            }
        } catch (err) {
            console.error('Error saving facility:', err);
            alert('Error connecting to server.');
        }
    };

    const handleDeleteFacility = async (facilityId) => {
        if (!window.confirm('Are you sure you want to delete this facility and all its services?')) return;
        try {
            const res = await fetch(`http://localhost:3001/api/partner-facilities/${facilityId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success || res.ok) {
                fetchFacilities();
            } else {
                alert(data.message || 'Failed to delete facility');
            }
        } catch (err) {
            console.error('Error deleting facility:', err);
        }
    };

    // CRUD Handlers for Facility Services
    const handleSaveService = async (e) => {
        e.preventDefault();
        if (!serviceForm.facility_id || !serviceForm.service_name.trim()) return;

        const targetServiceId = serviceForm.service_id || serviceForm.id;
        const url = isEditingService 
            ? `http://localhost:3001/api/facility-services/${targetServiceId}`
            : `http://localhost:3001/api/partner-facilities/${serviceForm.facility_id}/services`;
        const method = isEditingService ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serviceForm)
            });
            const data = await res.json();
            if (data.success || res.ok) {
                setServiceForm({ service_id: '', facility_id: '', service_name: '', description: '' });
                setIsEditingService(false);
                setShowServiceForm(false);
                fetchFacilities();
            } else {
                alert(data.message || 'Failed to save service');
            }
        } catch (err) {
            console.error('Error saving service:', err);
        }
    };

    const handleDeleteService = async (serviceId) => {
        if (!window.confirm('Are you sure you want to delete this service?')) return;
        try {
            const res = await fetch(`http://localhost:3001/api/facility-services/${serviceId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success || res.ok) {
                fetchFacilities();
            } else {
                alert(data.message || 'Failed to delete service');
            }
        } catch (err) {
            console.error('Error deleting service:', err);
        }
    };

    const handleSendMessage = async () => {
        if (!newNote.trim()) return;
        if (!nurseId) {
            setModalError('Nurse ID missing from layout context.');
            return;
        }

        setSubmitting(true);
        setModalError('');

        try {
            const response = await fetch('http://localhost:3001/api/document-requests/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_id: selectedRequest.request_id,
                    request_type: selectedRequest.request_type,
                    sender_id: nurseId,
                    sender_type: 'Nurse',
                    message: newNote,
                }),
            });

            const result = await response.json();
            if (result.success) {
                setNewNote('');
                await fetchNotes(selectedRequest.request_type, selectedRequest.request_id);
            } else {
                setModalError(result.message || 'Failed to send message.');
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setModalError('Network error occurred while sending message.');
        } finally {
            setSubmitting(false);
        }
    };

    const generateSlipPdfBlob = () => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 1000;
            const ctx = canvas.getContext('2d');

            const logo = new Image();
            logo.src = stiLogo;

            const isExcuse = selectedRequest.request_type === 'Excuse Slip';

            const renderCanvasAndPDF = () => {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

                if (logo.complete && logo.naturalWidth !== 0) {
                    ctx.drawImage(logo, 45, 38, 115, 60);
                }

                // STI Header
                ctx.fillStyle = '#1e293b';
                ctx.textAlign = 'center';
                ctx.font = 'bold 26px "Times New Roman", Serif';
                ctx.fillText('STI COLLEGE BALIUAG', 450, 65);
                ctx.font = '16px "Times New Roman", Serif';
                ctx.fillText('A&C Bldg. Gil Carlos Poblacion Baliuag, Bulacan', 450, 90);

                // Title
                ctx.font = 'bold italic 28px "Times New Roman", Serif';
                ctx.fillText(isExcuse ? 'CLINIC EXCUSE SLIP' : 'CLINIC REFERRAL SLIP', 430, 155);

                // Date
                ctx.textAlign = 'left';
                ctx.font = '18px "Times New Roman", Serif';
                ctx.fillText('DATE:', 500, 215);
                ctx.beginPath();
                ctx.moveTo(560, 218);
                ctx.lineTo(740, 218);
                ctx.stroke();
                ctx.font = 'bold 18px "Times New Roman", Serif';
                ctx.fillText(slipDetails.date, 565, 214);

                // Student Name
                ctx.font = '18px "Times New Roman", Serif';
                ctx.fillText('NAME:', 60, 270);
                ctx.beginPath();
                ctx.moveTo(130, 273);
                ctx.lineTo(740, 273);
                ctx.stroke();
                ctx.font = 'bold 18px "Times New Roman", Serif';
                ctx.fillText(slipDetails.studentName, 140, 268);

                // Course / Year & Section
                ctx.font = '18px "Times New Roman", Serif';
                ctx.fillText('COURSE/YEAR&SECTION:', 60, 320);
                ctx.beginPath();
                ctx.moveTo(310, 323);
                ctx.lineTo(740, 323);
                ctx.stroke();
                ctx.font = 'bold 18px "Times New Roman", Serif';
                ctx.fillText(slipDetails.courseYearSection, 320, 318);

                if (isExcuse) {
                    // Excuse Slip Specific Layout
                    ctx.font = '20px "Times New Roman", Serif';
                    ctx.fillText('Please excuse the said student in your class.', 120, 395);

                    ctx.font = 'italic 20px "Times New Roman", Serif';
                    ctx.fillText('Reason:', 60, 460);

                    let lineY = 463;
                    ctx.beginPath();
                    ctx.moveTo(140, lineY);
                    ctx.lineTo(740, lineY);
                    ctx.stroke();
                    ctx.font = '18px "Times New Roman", Serif';
                    ctx.fillText(slipDetails.reason || '', 150, lineY - 5);

                    for (let i = 1; i <= 3; i++) {
                        lineY += 45;
                        ctx.beginPath();
                        ctx.moveTo(140, lineY);
                        ctx.lineTo(740, lineY);
                        ctx.stroke();
                    }
                } else {
                    // Referral Slip Specific Layout
                    ctx.font = '18px "Times New Roman", Serif';
                    ctx.fillText('REFERRED TO:', 60, 370);
                    ctx.beginPath();
                    ctx.moveTo(210, 373);
                    ctx.lineTo(740, 373);
                    ctx.stroke();
                    ctx.font = 'bold 18px "Times New Roman", Serif';
                    ctx.fillText(slipDetails.partnerFacility || '', 220, 368);

                    ctx.font = '18px "Times New Roman", Serif';
                    ctx.fillText('REQUESTED SERVICES:', 60, 420);
                    ctx.beginPath();
                    ctx.moveTo(290, 423);
                    ctx.lineTo(740, 423);
                    ctx.stroke();
                    ctx.font = 'bold 18px "Times New Roman", Serif';
                    ctx.fillText(slipDetails.requestedServices || '', 300, 418);

                    ctx.font = '20px "Times New Roman", Serif';
                    ctx.fillText('Please provide medical evaluation / services for the above student.', 120, 480);

                    ctx.font = 'italic 20px "Times New Roman", Serif';
                    ctx.fillText('Reason:', 60, 540);

                    let lineY = 543;
                    ctx.beginPath();
                    ctx.moveTo(140, lineY);
                    ctx.lineTo(740, lineY);
                    ctx.stroke();
                    ctx.font = '18px "Times New Roman", Serif';
                    ctx.fillText(slipDetails.reason || '', 150, lineY - 5);

                    for (let i = 1; i <= 2; i++) {
                        lineY += 45;
                        ctx.beginPath();
                        ctx.moveTo(140, lineY);
                        ctx.lineTo(740, lineY);
                        ctx.stroke();
                    }
                }

                ctx.font = '20px "Times New Roman", Serif';
                ctx.fillText('Thank you.', 120, 670);

                ctx.textAlign = 'center';
                ctx.beginPath();
                ctx.moveTo(420, 810);
                ctx.lineTo(680, 810);
                ctx.stroke();

                ctx.font = 'bold 20px "Times New Roman", Serif';
                ctx.fillText(slipDetails.nurseName, 550, 803);
                ctx.font = 'italic 18px "Times New Roman", Serif';
                ctx.fillText('SCHOOL NURSE', 550, 835);

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                const pdfBlob = pdf.output('blob');

                const fileName = isExcuse 
                    ? `Excuse_Slip_${selectedRequest.request_id}.pdf` 
                    : `Referral_Slip_${selectedRequest.request_id}.pdf`;

                const pdfFile = new File([pdfBlob], fileName, { 
                    type: 'application/pdf' 
                });

                resolve(pdfFile);
            };

            logo.onload = renderCanvasAndPDF;
            logo.onerror = renderCanvasAndPDF;
        });
    };

    const handleAction = async (actionType) => {
        if (!nurseId) {
            setModalError('Nurse ID missing from layout context.');
            return;
        }

        setSubmitting(true);
        setModalError('');
        let fileToUpload = null;

        if (actionType === 'Approve') {
            if (selectedRequest.request_type === 'Excuse Slip') {
                fileToUpload = await generateSlipPdfBlob();
            } else if (selectedRequest.request_type === 'Referral Slip') {
                if (referralMode === 'autogen') {
                    fileToUpload = await generateSlipPdfBlob();
                } else {
                    fileToUpload = selectedFile;
                    if (!fileToUpload) {
                        setModalError('Please upload the issued referral document.');
                        setSubmitting(false);
                        return;
                    }
                }
            }
        }

        const formData = new FormData();
        formData.append('request_id', selectedRequest.request_id);
        formData.append('request_type', selectedRequest.request_type);
        formData.append('action', actionType);
        formData.append('nurse_id', nurseId);
        formData.append('message', newNote);
        if (fileToUpload) {
            formData.append('issued_slip', fileToUpload);
        }

        try {
            const response = await fetch('http://localhost:3001/api/document-requests/action', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            if (result.success) {
                closeModal();
                fetchRequests();
            } else {
                setModalError(result.message || 'Failed to submit action.');
            }
        } catch (err) {
            console.error('Error submitting action:', err);
            setModalError('Network error occurred while submitting.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="doc-issuance-container">
            {/* Page Header */}
            <div className="doc-header">
                <div>
                    <h2>Document Issuance</h2>
                    <p>Review, approve, and issue Excuse Slips and Referral Slips for students.</p>
                </div>
                <button 
                    className="btn-secondary btn-config" 
                    onClick={() => { 
                        setShowConfigModal(true); 
                        setShowFacilityForm(false);
                        setShowServiceForm(false);
                    }}
                >
                    <Settings size={18} /> Configure Referral Services
                </button>
            </div>

            {/* Summary Cards */}
            <div className="doc-summary-cards">
                <div className="summary-card pending-card">
                    <div className="card-icon"><Clock size={28} /></div>
                    <div className="card-info">
                        <span>Waiting for Approval</span>
                        <h3>{summary.pending}</h3>
                    </div>
                </div>

                <div className="summary-card approved-card">
                    <div className="card-icon"><CheckCircle2 size={28} /></div>
                    <div className="card-info">
                        <span>Completed / Approved</span>
                        <h3>{summary.completed}</h3>
                    </div>
                </div>

                <div className="summary-card denied-card">
                    <div className="card-icon"><XCircle size={28} /></div>
                    <div className="card-info">
                        <span>Denied Requests</span>
                        <h3>{summary.denied}</h3>
                    </div>
                </div>
            </div>

            {/* Controls & Search */}
            <div className="doc-controls">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search by student name, Student ID, or Request ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="All">All Request Types</option>
                        <option value="Excuse Slip">Excuse Slip</option>
                        <option value="Referral Slip">Referral Slip</option>
                    </select>

                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="All">All Statuses</option>
                        <option value="Waiting for Approval">Waiting for Approval</option>
                        <option value="Completed">Completed</option>
                        <option value="Denied">Denied</option>
                    </select>
                </div>
            </div>

            {/* Requests Table */}
            <div className="table-responsive">
                {loading ? (
                    <div className="doc-loading">Loading requests...</div>
                ) : error ? (
                    <div className="doc-error">{error}</div>
                ) : filteredRequests.length === 0 ? (
                    <div className="doc-empty">No document requests found.</div>
                ) : (
                    <table className="doc-table">
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Student Name</th>
                                <th>Request Type</th>
                                <th>Reason / Facility</th>
                                <th>Date Requested</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map((req) => (
                                <tr key={`${req.request_type}-${req.request_id}`}>
                                    <td className="font-bold">{req.request_id}</td>
                                    <td>
                                        <div className="student-info-cell">
                                            <span className="student-name">{req.first_name} {req.last_name}</span>
                                            <span className="student-id">{req.student_id}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge-type ${req.request_type === 'Excuse Slip' ? 'badge-excuse' : 'badge-referral'}`}>
                                            {req.request_type}
                                        </span>
                                    </td>
                                    <td className="truncate-cell">
                                        {req.request_type === 'Excuse Slip' ? (req.reason || req.reason_for_excuse) : req.partner_facility_name || req.reason}
                                    </td>
                                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`badge-status status-${(req.status || '').toLowerCase() === 'pending' ? 'pending' : (req.status || '').toLowerCase()}`}>
                                            {(req.status || '').toLowerCase() === 'pending' ? 'Waiting for Approval' : req.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-view" onClick={() => handleViewDetails(req)}>
                                            <Eye size={15} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Request Detail Modal */}
            {selectedRequest && !isApproving && (
                <div className="doc-modal-overlay">
                    <div className="doc-modal">
                        <div className="modal-header">
                            <div>
                                <h3>Document Request Details</h3>
                                <span className="modal-subtitle">Request ID: {selectedRequest.request_id}</span>
                            </div>
                            <button className="btn-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body">
                            <div className="details-grid">
                                <div className="detail-item">
                                    <label>Student Name</label>
                                    <p>{selectedRequest.first_name} {selectedRequest.last_name}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Student ID</label>
                                    <p>{selectedRequest.student_id}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Program & Year</label>
                                    <p>{selectedRequest.program_id} - Year {selectedRequest.year_level}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Request Type</label>
                                    <p className="font-bold text-sti-blue">{selectedRequest.request_type}</p>
                                </div>
                            </div>

                            <hr className="modal-divider" />

                            <div className="request-specific-details">
                                <h4>Request Details</h4>
                                {selectedRequest.request_type === 'Excuse Slip' ? (
                                    <>
                                        <p><strong>Reason for Excuse:</strong> {selectedRequest.reason || selectedRequest.reason_for_excuse}</p>
                                        <p>
                                            <strong>Valid Absence Period:</strong> {' '}
                                            {selectedRequest.valid_absence_start ? new Date(selectedRequest.valid_absence_start).toLocaleDateString() : 'N/A'} 
                                            {' to '} 
                                            {selectedRequest.valid_absence_end ? new Date(selectedRequest.valid_absence_end).toLocaleDateString() : 'N/A'}
                                        </p>
                                        {selectedRequest.student_proof_url && (
                                            <div className="file-attachment">
                                                <Paperclip size={16} />
                                                <a href={`http://localhost:3001${selectedRequest.student_proof_url}`} target="_blank" rel="noreferrer">
                                                    View Student Attachment Proof
                                                </a>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <p><strong>Reason for Referral:</strong> {selectedRequest.reason}</p>
                                        <p><strong>Partner Facility:</strong> {selectedRequest.partner_facility_name || 'N/A'}</p>
                                        <p><strong>Requested Services:</strong> {selectedRequest.requested_services || 'None Specified'}</p>
                                    </>
                                )}
                            </div>

                            <div className="modal-notes-section">
                                <h4>Message & Notes History</h4>
                                <div className="notes-list">
                                    {notes.length === 0 ? (
                                        <p className="no-notes">No previous messages or notes attached.</p>
                                    ) : (
                                        notes.map((note) => (
                                            <div key={note.note_id} className={`note-bubble ${note.sender_type === 'Nurse' ? 'note-nurse' : 'note-student'}`}>
                                                <div className="note-header">
                                                    <strong>{note.sender_type} ({note.sender_id})</strong>
                                                    <span>{new Date(note.created_at).toLocaleString()}</span>
                                                </div>
                                                <p>{note.message}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="message-input-container">
                                    <input 
                                        type="text" 
                                        placeholder="Type a message or instruction..." 
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        disabled={submitting}
                                    />
                                    <button 
                                        type="button" 
                                        className="btn-send-message" 
                                        onClick={handleSendMessage}
                                        disabled={submitting || !newNote.trim()}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>

                            {['pending', 'waiting for approval'].includes((selectedRequest.status || '').toLowerCase()) ? (
                                <div className="action-form">
                                    <h4>Process Request (Waiting for Approval)</h4>
                                    {modalError && (
                                        <div className="modal-error">
                                            <AlertCircle size={16} /> {modalError}
                                        </div>
                                    )}
                                    <div className="modal-actions">
                                        <button className="btn-approve" onClick={() => setIsApproving(true)}>
                                            <CheckCircle2 size={16} /> Approve & Issue Slip
                                        </button>
                                        <button className="btn-deny" onClick={() => handleAction('Deny')} disabled={submitting}>
                                            <XCircle size={16} /> {submitting ? 'Processing...' : 'Deny Request'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="issued-info-box">
                                    <p><strong>Processed By Nurse ID:</strong> {selectedRequest.issued_by || 'N/A'}</p>
                                    <p><strong>Processed At:</strong> {selectedRequest.issued_at ? new Date(selectedRequest.issued_at).toLocaleString() : 'N/A'}</p>
                                    {selectedRequest.issued_slip_url && (
                                        <div className="file-attachment mt-2">
                                            <FileText size={16} />
                                            <a href={`http://localhost:3001${selectedRequest.issued_slip_url}`} target="_blank" rel="noreferrer">
                                                View Official Issued PDF Slip
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Approval / Upload / Auto-Generation Modal */}
            {selectedRequest && isApproving && (
                <div className="doc-modal-overlay">
                    <div className="doc-modal modal-wide">
                        <div className="modal-header">
                            <div>
                                <h3>Approve & Issue {selectedRequest.request_type}</h3>
                                <span className="modal-subtitle">Request ID: {selectedRequest.request_id}</span>
                            </div>
                            <button className="btn-close" onClick={() => setIsApproving(false)}><X size={20} /></button>
                        </div>

                        <div className="modal-body">
                            {/* Option Selector for Referral Slip */}
                            {selectedRequest.request_type === 'Referral Slip' && (
                                <div className="referral-mode-selector">
                                    <button 
                                        type="button" 
                                        className={`mode-tab-btn ${referralMode === 'autogen' ? 'active' : ''}`}
                                        onClick={() => setReferralMode('autogen')}
                                    >
                                        <FileCode size={16} /> Auto-Generate Referral Slip
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`mode-tab-btn ${referralMode === 'upload' ? 'active' : ''}`}
                                        onClick={() => setReferralMode('upload')}
                                    >
                                        <Upload size={16} /> Upload Custom File
                                    </button>
                                </div>
                            )}

                            {/* Render Auto-Generated Slip UI (For Excuse Slip OR Referral Slip with autogen mode) */}
                            {(selectedRequest.request_type === 'Excuse Slip' || (selectedRequest.request_type === 'Referral Slip' && referralMode === 'autogen')) && (
                                <div className="slip-auto-container">
                                    <div className="slip-controls-card">
                                        <h5><Edit3 size={16} /> Edit Slip Details</h5>
                                        <div className="form-group">
                                            <label>Date:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.date} 
                                                onChange={(e) => setSlipDetails({...slipDetails, date: e.target.value})} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Student Name:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.studentName} 
                                                onChange={(e) => setSlipDetails({...slipDetails, studentName: e.target.value})} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Course / Year & Section:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.courseYearSection} 
                                                onChange={(e) => setSlipDetails({...slipDetails, courseYearSection: e.target.value})} 
                                            />
                                        </div>

                                        {selectedRequest.request_type === 'Referral Slip' && (
                                            <>
                                                <div className="form-group">
                                                    <label>Referred To (Partner Facility):</label>
                                                    <input 
                                                        type="text" 
                                                        value={slipDetails.partnerFacility} 
                                                        onChange={(e) => setSlipDetails({...slipDetails, partnerFacility: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Requested Services:</label>
                                                    <input 
                                                        type="text" 
                                                        value={slipDetails.requestedServices} 
                                                        onChange={(e) => setSlipDetails({...slipDetails, requestedServices: e.target.value})} 
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="form-group">
                                            <label>Reason:</label>
                                            <textarea 
                                                rows={3}
                                                value={slipDetails.reason} 
                                                onChange={(e) => setSlipDetails({...slipDetails, reason: e.target.value})} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>School Nurse Name:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.nurseName} 
                                                onChange={(e) => setSlipDetails({...slipDetails, nurseName: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="slip-preview-card">
                                        <div className="clinic-slip-paper" style={{ position: 'relative' }}>
                                            <img src={stiLogo} alt="STI Logo" style={{ position: 'absolute', top: '15px', left: '20px', width: '90px' }} />
                                            <div className="slip-header-center">
                                                <h3>STI COLLEGE BALIUAG</h3>
                                                <p>A&C Bldg. Gil Carlos Poblacion Baliuag, Bulacan</p>
                                            </div>

                                            <div className="slip-title">
                                                {selectedRequest.request_type === 'Excuse Slip' ? 'CLINIC EXCUSE SLIP' : 'CLINIC REFERRAL SLIP'}
                                            </div>

                                            <div className="slip-date-row"><span>DATE:</span><span className="slip-underlined">{slipDetails.date}</span></div>
                                            <div className="slip-row"><span>NAME:</span><span className="slip-underlined full">{slipDetails.studentName}</span></div>
                                            <div className="slip-row"><span>COURSE/YEAR&SECTION:</span><span className="slip-underlined full">{slipDetails.courseYearSection}</span></div>

                                            {selectedRequest.request_type === 'Excuse Slip' ? (
                                                <>
                                                    <p className="slip-statement">Please excuse the said student in your class.</p>
                                                    <div className="slip-reason-section">
                                                        <span className="reason-label">Reason:</span>
                                                        <div className="reason-line-wrap">
                                                            <span className="slip-underlined full">{slipDetails.reason}</span>
                                                            <div className="empty-underline"></div>
                                                            <div className="empty-underline"></div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="slip-row"><span>REFERRED TO:</span><span className="slip-underlined full">{slipDetails.partnerFacility}</span></div>
                                                    <div className="slip-row"><span>REQUESTED SERVICES:</span><span className="slip-underlined full">{slipDetails.requestedServices}</span></div>
                                                    <p className="slip-statement">Please provide medical evaluation / services for the above student.</p>
                                                    <div className="slip-reason-section">
                                                        <span className="reason-label">Reason:</span>
                                                        <div className="reason-line-wrap">
                                                            <span className="slip-underlined full">{slipDetails.reason}</span>
                                                            <div className="empty-underline"></div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <p className="slip-thanks">Thank you.</p>
                                            <div className="slip-signature-block">
                                                <div className="signature-line-text">{slipDetails.nurseName}</div>
                                                <div className="nurse-title">SCHOOL NURSE</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Render Upload Box UI (When Referral Slip & mode is 'upload') */}
                            {selectedRequest.request_type === 'Referral Slip' && referralMode === 'upload' && (
                                <div className="upload-step-box">
                                    <div className="upload-step-header">
                                        <Upload size={20} className="upload-icon-heading" />
                                        <div>
                                            <h4>Upload Issued Referral Document</h4>
                                            <p>Attach the signed referral document to complete the request.</p>
                                        </div>
                                    </div>
                                    <div className="form-group mt-3">
                                        <label>Upload Document Slip File (PDF, PNG, JPG): <span className="text-danger">*</span></label>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                        />
                                    </div>
                                </div>
                            )}

                            {modalError && (
                                <div className="modal-error mt-2">
                                    <AlertCircle size={16} /> {modalError}
                                </div>
                            )}

                            <div className="modal-actions mt-3">
                                <button className="btn-approve" onClick={() => handleAction('Approve')} disabled={submitting}>
                                    <Send size={16} /> {submitting ? 'Processing...' : 'Send File to Student'}
                                </button>
                                <button className="btn-secondary" onClick={() => setIsApproving(false)} disabled={submitting}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REFERRAL SERVICES CONFIGURATION MODAL */}
            {showConfigModal && (
                <div className="doc-modal-overlay">
                    <div className="doc-modal modal-wide config-modal">
                        <div className="modal-header">
                            <div>
                                <h3>Configure Referral Services & Partner Facilities</h3>
                                <span className="modal-subtitle">Manage healthcare facilities and available services</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    style={{ padding: '6px 10px' }}
                                    onClick={fetchFacilities}
                                    title="Reload Facilities"
                                >
                                    <RefreshCw size={14} /> Refresh
                                </button>
                                {!showFacilityForm && !showServiceForm && (
                                    <button 
                                        type="button" 
                                        className="btn-save-sm"
                                        onClick={() => {
                                            setIsEditingFacility(false);
                                            setFacilityForm({ facility_id: '', facility_name: '', address: '', contact_number: '' });
                                            setShowFacilityForm(true);
                                        }}
                                    >
                                        <Plus size={14} /> Add Partner Facility
                                    </button>
                                )}
                                <button className="btn-close" onClick={() => setShowConfigModal(false)}><X size={20} /></button>
                            </div>
                        </div>

                        <div className="modal-body config-modal-body">
                            {configLoading ? (
                                <div className="doc-loading">Loading configuration from server...</div>
                            ) : configError ? (
                                <div className="doc-error" style={{ margin: '15px 0' }}>
                                    <AlertCircle size={18} /> {configError}
                                    <button className="btn-secondary mt-2" onClick={fetchFacilities}>Try Again</button>
                                </div>
                            ) : (
                                <div className="config-container">

                                    {/* Facility Add/Edit Form */}
                                    {showFacilityForm && (
                                        <form onSubmit={handleSaveFacility} className="config-form mb-3">
                                            <h5>{isEditingFacility ? 'Edit Partner Facility' : 'Add New Partner Facility'}</h5>
                                            <div className="form-grid-3">
                                                <input 
                                                    type="text" 
                                                    placeholder="Facility Name (e.g. Allied Care Clinic)" 
                                                    value={facilityForm.facility_name}
                                                    onChange={(e) => setFacilityForm({ ...facilityForm, facility_name: e.target.value })}
                                                    required
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Address" 
                                                    value={facilityForm.address}
                                                    onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Contact Number" 
                                                    value={facilityForm.contact_number}
                                                    onChange={(e) => setFacilityForm({ ...facilityForm, contact_number: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-button-row">
                                                <button type="submit" className="btn-save-sm">
                                                    <Plus size={14} /> {isEditingFacility ? 'Update Facility' : 'Save Facility'}
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn-cancel-sm"
                                                    onClick={() => {
                                                        setShowFacilityForm(false);
                                                        setIsEditingFacility(false);
                                                        setFacilityForm({ facility_id: '', facility_name: '', address: '', contact_number: '' });
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Service Add/Edit Form */}
                                    {showServiceForm && (
                                        <form onSubmit={handleSaveService} className="config-form mb-3">
                                            <h5>{isEditingService ? `Edit Service for ${activeFacilityName}` : `Add Service to ${activeFacilityName}`}</h5>
                                            <div className="form-grid-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Service Name (e.g. Chest X-Ray, CBC)" 
                                                    value={serviceForm.service_name}
                                                    onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                                                    required
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Description / Instructions" 
                                                    value={serviceForm.description}
                                                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="form-button-row">
                                                <button type="submit" className="btn-save-sm">
                                                    <Plus size={14} /> {isEditingService ? 'Update Service' : 'Save Service'}
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn-cancel-sm"
                                                    onClick={() => {
                                                        setShowServiceForm(false);
                                                        setIsEditingService(false);
                                                        setServiceForm({ service_id: '', facility_id: '', service_name: '', description: '' });
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* ALWAYS VISIBLE LIST OF PARTNER FACILITIES AND THEIR SERVICES */}
                                    <div className="facility-full-list">
                                        {facilities.length === 0 ? (
                                            <div className="doc-empty">
                                                No partner facilities found. Click <strong>"+ Add Partner Facility"</strong> above to add one.
                                            </div>
                                        ) : (
                                            facilities.map((fac) => {
                                                const facilityId = fac.facility_id || fac.id;
                                                const facilityName = fac.facility_name || fac.name || 'Unnamed Facility';
                                                const servicesList = fac.services || fac.facility_services || [];

                                                return (
                                                    <div key={facilityId || Math.random()} className="facility-block">
                                                        {/* Facility Card Header */}
                                                        <div className="facility-block-header">
                                                            <div className="facility-info">
                                                                <div className="facility-title-row">
                                                                    <Building size={18} className="text-sti-blue" />
                                                                    <h4>{facilityName}</h4>
                                                                </div>
                                                                <div className="facility-meta">
                                                                    <span><strong>Address:</strong> {fac.address || 'N/A'}</span>
                                                                    <span><strong>Contact:</strong> {fac.contact_number || fac.contact || 'N/A'}</span>
                                                                </div>
                                                            </div>

                                                            {/* View / Edit / Delete Actions */}
                                                            <div className="facility-actions">
                                                                <button 
                                                                    className="btn-save-sm"
                                                                    onClick={() => {
                                                                        setActiveFacilityName(facilityName);
                                                                        setServiceForm({ service_id: '', facility_id: facilityId, service_name: '', description: '' });
                                                                        setIsEditingService(false);
                                                                        setShowServiceForm(true);
                                                                        setShowFacilityForm(false);
                                                                    }}
                                                                >
                                                                    <Plus size={14} /> Add Service
                                                                </button>
                                                                <button 
                                                                    className="btn-icon-action"
                                                                    title="Edit Facility"
                                                                    onClick={() => {
                                                                        setFacilityForm({
                                                                            facility_id: facilityId,
                                                                            facility_name: facilityName,
                                                                            address: fac.address || '',
                                                                            contact_number: fac.contact_number || fac.contact || ''
                                                                        });
                                                                        setIsEditingFacility(true);
                                                                        setShowFacilityForm(true);
                                                                        setShowServiceForm(false);
                                                                    }}
                                                                >
                                                                    <Edit3 size={15} /> Edit
                                                                </button>
                                                                <button 
                                                                    className="btn-icon-action delete"
                                                                    title="Delete Facility"
                                                                    onClick={() => handleDeleteFacility(facilityId)}
                                                                >
                                                                    <Trash2 size={15} /> Delete
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Facility Services List */}
                                                        <div className="facility-services-container">
                                                            <div className="services-label">
                                                                <Stethoscope size={14} /> Offered Services ({servicesList.length}):
                                                            </div>
                                                            {servicesList.length > 0 ? (
                                                                <div className="services-grid">
                                                                    {servicesList.map((srv) => {
                                                                        const serviceId = srv.service_id || srv.id;
                                                                        const serviceName = srv.service_name || srv.name || 'Unnamed Service';
                                                                        const description = srv.description || '';

                                                                        return (
                                                                            <div key={serviceId || Math.random()} className="service-item-chip">
                                                                                <div className="service-chip-details">
                                                                                    <span className="service-name">{serviceName}</span>
                                                                                    {description && <span className="service-desc">{description}</span>}
                                                                                </div>
                                                                                <div className="service-chip-actions">
                                                                                    <button 
                                                                                        className="btn-icon-action" 
                                                                                        title="Edit Service"
                                                                                        onClick={() => {
                                                                                            setActiveFacilityName(facilityName);
                                                                                            setServiceForm({
                                                                                                service_id: serviceId,
                                                                                                facility_id: facilityId,
                                                                                                service_name: serviceName,
                                                                                                description: description
                                                                                            });
                                                                                            setIsEditingService(true);
                                                                                            setShowServiceForm(true);
                                                                                            setShowFacilityForm(false);
                                                                                        }}
                                                                                    >
                                                                                        <Edit3 size={13} />
                                                                                    </button>
                                                                                    <button 
                                                                                        className="btn-icon-action delete" 
                                                                                        title="Delete Service"
                                                                                        onClick={() => handleDeleteService(serviceId)}
                                                                                    >
                                                                                        <Trash2 size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <p className="no-services-text">No services added for this facility yet.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentIssuance;