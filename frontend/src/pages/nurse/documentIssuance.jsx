import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import jsPDF from 'jspdf';
import { io } from 'socket.io-client';
import {
    Clock,
    CheckCircle2,
    XCircle,
    Eye,
    Upload,
    X,
    Search,
    Paperclip,
    ArrowLeft,
    Send,
    Edit3,
    FileText,
    Settings,
    Plus,
    RefreshCw,
    FileCode,
    Trash2,
    Printer,
    Inbox,
    List,
    Building2
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/DocumentIssuance.css';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';

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

const WAITING_STATUSES = ['pending', 'waiting for approval'];
const isWaitingStatus = (status) => WAITING_STATUSES.includes((status || '').toLowerCase());

const StatusBadge = ({ status }) => {
    const key = (status || '').toLowerCase();
    if (WAITING_STATUSES.includes(key)) {
        return <span className="badge-di status-pending-di"><Clock className="ic-di" aria-hidden="true" />Waiting for Approval</span>;
    }
    if (key === 'denied') {
        return <span className="badge-di status-denied-di"><XCircle className="ic-di" aria-hidden="true" />Denied</span>;
    }
    return <span className="badge-di status-completed-di"><CheckCircle2 className="ic-di" aria-hidden="true" />{status || 'Completed'}</span>;
};

const TypeBadge = ({ type }) => (
    type === 'Excuse Slip'
        ? <span className="badge-di badge-excuse-di"><FileText className="ic-di" aria-hidden="true" />Excuse Slip</span>
        : <span className="badge-di badge-referral-di"><Building2 className="ic-di" aria-hidden="true" />{type || 'Referral Slip'}</span>
);

const IconButton = ({ icon: Icon, label, className = 'ghost-di', ...rest }) => (
    <button type="button" className={`btn-di icon-di ${className}`} aria-label={label} title={label} {...rest}>
        <Icon className="ic-di" aria-hidden="true" />
    </button>
);

const DocumentIssuance = () => {
    const { nurseId } = useOutletContext();
    const { showAlert, showConfirm } = useAlert();

    const [requests, setRequests] = useState([]);
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filter & Search states
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

    // Every confirmation goes through the shared confirm modal
    const setConfirmState = (cfg) => {
        if (!cfg || !cfg.isOpen) return;
        showConfirm(cfg.message, {
            title: cfg.title,
            danger: cfg.type === 'deny',
            confirmLabel: cfg.confirmText
        }).then((ok) => {
            if (ok && cfg.onConfirm) cfg.onConfirm();
        });
    };

    const detailTitleRef = useRef(null);

    // Referral Mode Toggle ('autogen' | 'upload')
    const [referralMode, setReferralMode] = useState('autogen');

    // Referral Services Configuration Modal States
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [facilities, setFacilities] = useState([]);
    const [medicalRequirements, setMedicalRequirements] = useState([]);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState('');

    // Form states and toggles for Facility CRUD
    const [facilityForm, setFacilityForm] = useState({ facility_id: '', facility_name: '', address: '', contact_number: '' });
    const [isEditingFacility, setIsEditingFacility] = useState(false);
    const [showFacilityForm, setShowFacilityForm] = useState(false);

    // Form states and toggles for Service CRUD (Mapped with requirement_name)
    const [serviceForm, setServiceForm] = useState({ service_id: '', facility_id: '', requirement_name: '', description: '' });
    const [isEditingService, setIsEditingService] = useState(false);
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [activeServiceFacilityId, setActiveServiceFacilityId] = useState(null);
    const [activeFacilityName, setActiveFacilityName] = useState('');

    // Auto-Generated Slip Editable State
    const [slipDetails, setSlipDetails] = useState({
        date: formatDate(new Date()),
        studentName: '',
        courseYearSection: '',
        reason: '',
        partnerFacility: '',
        requestedServices: '',
        nurseName: 'MARILOU H. BALARAO, RN, LPT',
        validityStart: '',
        validityEnd: ''
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
            if (data.success && Array.isArray(data.facilities)) {
                loadedFacilities = data.facilities;
            } else if (Array.isArray(data)) {
                loadedFacilities = data;
            } else if (Array.isArray(data.facilities)) {
                loadedFacilities = data.facilities;
            }

            setFacilities(loadedFacilities);
        } catch (err) {
            console.error('Error fetching facilities:', err);
            setConfigError('Failed to load partner facilities. Please ensure your backend is running.');
        } finally {
            setConfigLoading(false);
        }
    };

    const fetchMedicalRequirements = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/medical-requirements');
            const data = await res.json();
            
            let list = [];
            if (Array.isArray(data)) {
                list = data;
            } else if (Array.isArray(data.requirements)) {
                list = data.requirements;
            } else if (Array.isArray(data.data)) {
                list = data.data;
            }

            const parsedList = list.map(item => {
                if (typeof item === 'string') return item.trim();
                if (item && typeof item === 'object') return (item.requirement_name || item.name || '').trim();
                return '';
            }).filter(Boolean);

            setMedicalRequirements(Array.from(new Set(parsedList)));
        } catch (err) {
            console.error('Error fetching medical requirements:', err);
        }
    };

    // Initial Load & Real-Time WebSocket Connection
    useEffect(() => {
        fetchRequests();
        fetchFacilities();
        fetchMedicalRequirements();

        // Establish WebSockets connection to backend
        const socket = io('http://localhost:3001');

        // Listen for real-time document request events
        socket.on('document_request_updated', () => {
            fetchRequests();
        });

        // Listen for real-time partner facility / service events
        socket.on('partner_facility_updated', () => {
            fetchFacilities();
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Real-Time Note / Message Sync for Currently Opened Modal Request
    useEffect(() => {
        if (!selectedRequest) return;

        const socket = io('http://localhost:3001');

        socket.on('note_added', (data) => {
            if (
                data && 
                data.request_id === selectedRequest.request_id && 
                data.request_type === selectedRequest.request_type
            ) {
                fetchNotes(selectedRequest.request_type, selectedRequest.request_id);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [selectedRequest]);

    // Errors raised in the detail / issue views are shown in the shared alert modal
    useEffect(() => {
        if (modalError) {
            showAlert(modalError, 'error');
            setModalError('');
        }
    }, [modalError]); // eslint-disable-line react-hooks/exhaustive-deps

    // Esc closes the detail drawer; focus moves to its heading when it opens
    useEffect(() => {
        if (!selectedRequest || isApproving) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedRequest, isApproving]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (selectedRequest && !isApproving && detailTitleRef.current) {
            detailTitleRef.current.focus();
        }
    }, [selectedRequest?.request_id, isApproving]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-fetch when opening config modal
    useEffect(() => {
        if (showConfigModal) {
            fetchFacilities();
            fetchMedicalRequirements();
        }
    }, [showConfigModal]);

    // Filter Requests Logic
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

    const formatDateForInput = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    const handleViewDetails = async (reqItem) => {
        setSelectedRequest(reqItem);
        setIsApproving(false);
        setNewNote('');
        setSelectedFile(null);
        setModalError('');
        setReferralMode('autogen');

        const todayFormatted = formatDate(new Date());

        const initialStart = formatDateForInput(reqItem.valid_absence_start || reqItem.validity_start);
        const initialEnd = formatDateForInput(reqItem.valid_absence_end || reqItem.validity_end);

        setSlipDetails({
            date: todayFormatted,
            studentName: `${reqItem.first_name || ''} ${reqItem.last_name || ''}`.trim(),
            courseYearSection: `${reqItem.program_id || ''} - Year ${reqItem.year_level || ''}`,
            reason: reqItem.reason || reqItem.reason_for_excuse || '',
            partnerFacility: reqItem.partner_facility_name || 'N/A',
            requestedServices: reqItem.requested_services || 'N/A',
            nurseName: 'MARILOU H. BALARAO, RN, LPT',
            validityStart: initialStart,
            validityEnd: initialEnd
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

    // --- PRINT PREVIEW REPORT GENERATOR ---
    // --- PRINT PREVIEW REPORT GENERATOR WITH STATUS SUMMARY ---
    const handleExportReport = () => {
        const rowsToExport = filteredRequests.length > 0 ? filteredRequests : requests;

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            showAlert('Please allow popups to preview and print the report.', 'warning');
            return;
        }

        const reportDate = formatDate(new Date());

        // 1. Calculate status totals from the exported dataset
        const reportSummary = {
            pending: rowsToExport.filter(r => ['pending', 'waiting for approval'].includes((r.status || '').toLowerCase())).length,
            completed: rowsToExport.filter(r => ['completed', 'approved'].includes((r.status || '').toLowerCase())).length,
            denied: rowsToExport.filter(r => (r.status || '').toLowerCase() === 'denied').length
        };

        const tableRowsHtml = rowsToExport.map(req => {
            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim();
            const reasonFacility = req.request_type === 'Excuse Slip' 
                ? (req.reason || req.reason_for_excuse || 'N/A') 
                : (req.partner_facility_name || req.reason || 'N/A');
            const reqDate = req.created_at ? formatDate(new Date(req.created_at)) : 'N/A';
            const statusStr = (req.status || '').toLowerCase() === 'pending' ? 'Waiting for Approval' : req.status;

            return `
                <tr>
                    <td>${req.request_id || ''}</td>
                    <td><strong>${studentName}</strong></td>
                    <td>${req.student_id || ''}</td>
                    <td>${req.request_type || ''}</td>
                    <td>${reasonFacility}</td>
                    <td>${reqDate}</td>
                    <td>${statusStr}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Document Issuance Report</title>
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

                    /* Summary Section Styling */
                    .summary-section {
                        background-color: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 10px 14px;
                        margin-bottom: 20px;
                    }
                    .summary-title {
                        font-size: 11px;
                        font-weight: bold;
                        color: #1e3a8a;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 8px;
                    }
                    .summary-grid {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .summary-card {
                        background-color: #ffffff;
                        border: 1px solid #cbd5e1;
                        border-radius: 4px;
                        padding: 6px 12px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 12px;
                    }
                    .summary-label {
                        color: #334155;
                        font-weight: 600;
                    }
                    .summary-badge {
                        color: #ffffff;
                        font-size: 11px;
                        font-weight: bold;
                        padding: 2px 8px;
                        border-radius: 10px;
                    }
                    .pending-badge { background-color: #d97706; }
                    .completed-badge { background-color: #16a34a; }
                    .denied-badge { background-color: #dc2626; }

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
                    <span><strong>DOCUMENT ISSUANCE REPORT</strong></span>
                    <span>Date Generated: ${reportDate} | Total Records: ${rowsToExport.length}</span>
                </div>

                <div class="summary-section">
                    <div class="summary-title">Document Request Status Summary</div>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <span class="summary-label">Waiting for Approval</span>
                            <span class="summary-badge pending-badge">${reportSummary.pending}</span>
                        </div>
                        <div class="summary-card">
                            <span class="summary-label">Completed / Approved</span>
                            <span class="summary-badge completed-badge">${reportSummary.completed}</span>
                        </div>
                        <div class="summary-card">
                            <span class="summary-label">Denied</span>
                            <span class="summary-badge denied-badge">${reportSummary.denied}</span>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Request ID</th>
                            <th>Student Name</th>
                            <th>Student ID</th>
                            <th>Type</th>
                            <th>Reason / Facility</th>
                            <th>Date Requested</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="7">No document requests found.</td></tr>'}
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

    // --- PARTNER FACILITY CRUD ---
    const handleOpenEditFacility = (facility) => {
        const facId = facility.facility_id || facility.id;
        setFacilityForm({
            facility_id: facId,
            facility_name: facility.facility_name || '',
            address: facility.address || '',
            contact_number: facility.contact_number || ''
        });
        setIsEditingFacility(true);
        setShowFacilityForm(true);
        setShowServiceForm(false);
        setActiveServiceFacilityId(null);
    };

    const executeSaveFacility = async () => {
        const targetId = facilityForm.facility_id;
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
                showAlert(data.message || 'Failed to save facility.', 'error');
            }
        } catch (err) {
            console.error('Error saving facility:', err);
            showAlert("We couldn't reach the server. Please try again.", 'error');
        }
    };

    const handleSaveFacility = (e) => {
        e.preventDefault();
        if (!facilityForm.facility_name.trim()) return;

        setConfirmState({
            isOpen: true,
            title: isEditingFacility ? 'Confirm Facility Update' : 'Confirm Save Facility',
            message: `Are you sure you want to ${isEditingFacility ? 'update' : 'add'} "${facilityForm.facility_name}" as a partner facility?`,
            confirmText: isEditingFacility ? 'Update Facility' : 'Save Facility',
            type: 'approve',
            onConfirm: executeSaveFacility
        });
    };

    const executeDeleteFacility = async (facId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/partner-facilities/${facId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success || res.ok) {
                fetchFacilities();
            } else {
                showAlert(data.message || 'Failed to delete facility.', 'error');
            }
        } catch (err) {
            console.error('Error deleting facility:', err);
            showAlert("We couldn't reach the server. Please try again.", 'error');
        }
    };

    const handleDeleteFacility = (facility) => {
        const facId = facility.facility_id || facility.id;
        setConfirmState({
            isOpen: true,
            title: 'Delete Partner Facility',
            message: `Are you sure you want to delete "${facility.facility_name}"? All associated services will also be removed.`,
            confirmText: 'Yes, Delete Facility',
            type: 'deny',
            onConfirm: () => executeDeleteFacility(facId)
        });
    };

    // --- FACILITY SERVICES CRUD ---
    const handleOpenAddService = (facility) => {
        fetchMedicalRequirements();
        const facId = facility.facility_id || facility.id;
        setServiceForm({ service_id: '', facility_id: facId, requirement_name: '', description: '' });
        setActiveFacilityName(facility.facility_name || '');
        setActiveServiceFacilityId(facId);
        setIsEditingService(false);
        setShowServiceForm(true);
        setShowFacilityForm(false);
    };

    const handleOpenEditService = (facility, service) => {
        fetchMedicalRequirements();
        const facId = facility.facility_id || facility.id;
        const srvId = service.service_id || service.id;
        setServiceForm({
            service_id: srvId,
            facility_id: facId,
            requirement_name: service.requirement_name || service.service_name || '',
            description: service.description || ''
        });
        setActiveFacilityName(facility.facility_name || '');
        setActiveServiceFacilityId(facId);
        setIsEditingService(true);
        setShowServiceForm(true);
        setShowFacilityForm(false);
    };

    const executeSaveService = async () => {
        const targetServiceId = serviceForm.service_id;
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
                setServiceForm({ service_id: '', facility_id: '', requirement_name: '', description: '' });
                setIsEditingService(false);
                setShowServiceForm(false);
                setActiveServiceFacilityId(null);
                setActiveFacilityName('');
                fetchFacilities();
            } else {
                showAlert(data.message || 'Failed to save service.', 'error');
            }
        } catch (err) {
            console.error('Error saving service:', err);
            showAlert("We couldn't reach the server. Please try again.", 'error');
        }
    };

    const handleSaveService = (e) => {
        e.preventDefault();
        if (!serviceForm.facility_id || !serviceForm.requirement_name.trim()) {
            showAlert('Please select a valid medical requirement.', 'warning');
            return;
        }

        const targetFacility = facilities.find(f => (f.facility_id || f.id) === serviceForm.facility_id);
        const existingServices = targetFacility?.services || [];
        const isDuplicate = existingServices.some(s => 
            ((s.requirement_name || s.service_name) || '').toLowerCase() === serviceForm.requirement_name.trim().toLowerCase() && 
            (s.service_id || s.id) !== serviceForm.service_id
        );

        if (isDuplicate) {
            showAlert(`The requirement/service "${serviceForm.requirement_name}" is already connected to ${activeFacilityName}. Please select a different medical requirement.`, 'warning');
            return;
        }

        setConfirmState({
            isOpen: true,
            title: isEditingService ? 'Confirm Service Update' : 'Confirm Service Addition',
            message: `Are you sure you want to ${isEditingService ? 'update' : 'connect'} "${serviceForm.requirement_name}" service for ${activeFacilityName}?`,
            confirmText: isEditingService ? 'Update Service' : 'Connect Service',
            type: 'approve',
            onConfirm: executeSaveService
        });
    };

    const executeDeleteService = async (serviceId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/facility-services/${serviceId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success || res.ok) {
                fetchFacilities();
            } else {
                showAlert(data.message || 'Failed to delete service.', 'error');
            }
        } catch (err) {
            console.error('Error deleting service:', err);
            showAlert("We couldn't reach the server. Please try again.", 'error');
        }
    };

    const handleDeleteService = (service) => {
        const srvId = service.service_id || service.id;
        const reqName = service.requirement_name || service.service_name || 'Service';
        setConfirmState({
            isOpen: true,
            title: 'Delete Service Connection',
            message: `Are you sure you want to remove the "${reqName}" service connection?`,
            confirmText: 'Yes, Delete Service',
            type: 'deny',
            onConfirm: () => executeDeleteService(srvId)
        });
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

            const sig = new Image();
            sig.src = NURSE_SIGNATURE_SVG;

            let loadedCount = 0;
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

                ctx.fillStyle = '#1e293b';
                ctx.textAlign = 'center';
                ctx.font = 'bold 26px "Times New Roman", Serif';
                ctx.fillText('STI COLLEGE BALIUAG', 450, 65);
                ctx.font = '16px "Times New Roman", Serif';
                ctx.fillText('A&C Bldg. Gil Carlos Poblacion Baliuag, Bulacan', 450, 90);

                ctx.font = 'bold italic 28px "Times New Roman", Serif';
                ctx.fillText(isExcuse ? 'CLINIC EXCUSE SLIP' : 'CLINIC REFERRAL SLIP', 430, 155);

                ctx.textAlign = 'left';
                ctx.font = '18px "Times New Roman", Serif';
                ctx.fillText('DATE:', 500, 215);
                ctx.beginPath();
                ctx.moveTo(560, 218);
                ctx.lineTo(740, 218);
                ctx.stroke();
                ctx.font = 'bold 18px "Times New Roman", Serif';
                ctx.fillText(slipDetails.date, 565, 214);

                ctx.font = '18px "Times New Roman", Serif';
                ctx.fillText('NAME:', 60, 270);
                ctx.beginPath();
                ctx.moveTo(130, 273);
                ctx.lineTo(740, 273);
                ctx.stroke();
                ctx.font = 'bold 18px "Times New Roman", Serif';
                ctx.fillText(slipDetails.studentName, 140, 268);

                ctx.font = '18px "Times New Roman", Serif';
                ctx.fillText('COURSE/YEAR&SECTION:', 60, 320);
                ctx.beginPath();
                ctx.moveTo(310, 323);
                ctx.lineTo(740, 323);
                ctx.stroke();
                ctx.font = 'bold 18px "Times New Roman", Serif';
                ctx.fillText(slipDetails.courseYearSection, 320, 318);

                if (isExcuse) {
                    let currentY = 370;

                    if (slipDetails.validityStart || slipDetails.validityEnd) {
                        const startFmt = slipDetails.validityStart ? formatDate(new Date(slipDetails.validityStart)) : '';
                        const endFmt = slipDetails.validityEnd ? formatDate(new Date(slipDetails.validityEnd)) : '';
                        const validityStr = `${startFmt} to ${endFmt}`.trim();

                        ctx.font = '18px "Times New Roman", Serif';
                        ctx.fillText('VALIDITY PERIOD:', 60, currentY);
                        ctx.beginPath();
                        ctx.moveTo(250, currentY + 3);
                        ctx.lineTo(740, currentY + 3);
                        ctx.stroke();
                        ctx.font = 'bold 18px "Times New Roman", Serif';
                        ctx.fillText(validityStr, 260, currentY - 2);
                        currentY += 45;
                    }

                    ctx.font = '20px "Times New Roman", Serif';
                    ctx.fillText('Please excuse the said student in your class.', 120, currentY);
                    currentY += 45;

                    ctx.font = 'italic 20px "Times New Roman", Serif';
                    ctx.fillText('Reason:', 60, currentY);

                    let lineY = currentY + 3;
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
                    const isOthers = (slipDetails.partnerFacility || '').trim().toLowerCase() === 'others';
                    let currentY = 370;

                    if (!isOthers) {
                        ctx.font = '18px "Times New Roman", Serif';
                        ctx.fillText('REFERRED TO:', 60, currentY);
                        ctx.beginPath();
                        ctx.moveTo(210, currentY + 3);
                        ctx.lineTo(740, currentY + 3);
                        ctx.stroke();
                        ctx.font = 'bold 18px "Times New Roman", Serif';
                        ctx.fillText(slipDetails.partnerFacility || '', 220, currentY - 2);
                        currentY += 50;
                    }

                    ctx.font = '18px "Times New Roman", Serif';
                    ctx.fillText('REQUESTED SERVICES:', 60, currentY);
                    ctx.beginPath();
                    ctx.moveTo(290, currentY + 3);
                    ctx.lineTo(740, currentY + 3);
                    ctx.stroke();
                    ctx.font = 'bold 18px "Times New Roman", Serif';
                    ctx.fillText(slipDetails.requestedServices || '', 300, currentY - 2);
                    currentY += 60;

                    ctx.font = '20px "Times New Roman", Serif';
                    ctx.fillText('Please provide medical evaluation / services for the above student.', 120, currentY);
                    currentY += 60;

                    ctx.font = 'italic 20px "Times New Roman", Serif';
                    ctx.fillText('Reason:', 60, currentY);

                    let lineY = currentY + 3;
                    ctx.beginPath();
                    ctx.moveTo(140, lineY);
                    ctx.lineTo(740, lineY);
                    ctx.stroke();
                    ctx.font = '18px "Times New Roman", Serif';
                    ctx.fillText(slipDetails.reason || '', 150, lineY - 5);

                    const extraLines = isOthers ? 3 : 2;
                    for (let i = 1; i <= extraLines; i++) {
                        lineY += 45;
                        ctx.beginPath();
                        ctx.moveTo(140, lineY);
                        ctx.lineTo(740, lineY);
                        ctx.stroke();
                    }
                }

                ctx.font = '20px "Times New Roman", Serif';
                ctx.fillText('Thank you.', 120, 670);

                if (sig.complete && sig.naturalWidth !== 0) {
                    ctx.drawImage(sig, 470, 720, 160, 75);
                }

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

            const onImgLoad = () => {
                loadedCount++;
                if (loadedCount >= 2) renderCanvasAndPDF();
            };

            logo.onload = onImgLoad;
            logo.onerror = onImgLoad;
            sig.onload = onImgLoad;
            sig.onerror = onImgLoad;
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
        if (slipDetails.validityStart) formData.append('validity_start', slipDetails.validityStart);
        if (slipDetails.validityEnd) formData.append('validity_end', slipDetails.validityEnd);
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
                const studentName = `${selectedRequest.first_name || ''} ${selectedRequest.last_name || ''}`.trim();
                closeModal();
                fetchRequests();
                if (actionType === 'Approve') setStatusFilter('Completed');
                showAlert(actionType === 'Approve' ? `Slip sent to ${studentName}.` : 'Request denied.', 'success');
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

    const triggerApprove = () => {
        if (selectedRequest.request_type === 'Referral Slip' && referralMode === 'upload' && !selectedFile) {
            setModalError('Please upload the issued referral document.');
            return;
        }
        setModalError('');
        setConfirmState({
            isOpen: true,
            title: 'Confirm File Issuance',
            message: `Are you sure you want to approve and send the ${selectedRequest.request_type} document to ${selectedRequest.first_name} ${selectedRequest.last_name}?`,
            confirmText: 'Yes, Send File',
            type: 'approve',
            onConfirm: () => handleAction('Approve')
        });
    };

    const triggerDeny = () => {
        setModalError('');
        setConfirmState({
            isOpen: true,
            title: 'Confirm Request Denial',
            message: `Are you sure you want to deny this request for ${selectedRequest.first_name} ${selectedRequest.last_name}? The student will be notified.`,
            confirmText: 'Yes, Deny Request',
            type: 'deny',
            onConfirm: () => handleAction('Deny')
        });
    };

    const displayedFacilities = facilities.filter(fac => 
        (fac.facility_name || '').trim().toLowerCase() !== 'others'
    );

    const closeConfig = () => {
        setShowConfigModal(false);
        setShowFacilityForm(false);
        setShowServiceForm(false);
        setActiveServiceFacilityId(null);
    };

    const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim();
    const isExcuseRequest = selectedRequest?.request_type === 'Excuse Slip';
    const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;

    // ---------- QUEUE VIEW ----------
    const renderQueue = () => (
        <>
            <header className="bar-di">
                <div className="bar-title-di">
                    <h1>Document Issuance</h1>
                    <p className="sub-di">Excuse and referral slips</p>
                </div>
                <div className="bar-actions-di">
                    <IconButton icon={Printer} label="Export report" onClick={handleExportReport} />
                    <IconButton
                        icon={Settings}
                        label="Configure referral services"
                        onClick={() => {
                            setShowConfigModal(true);
                            setShowFacilityForm(false);
                            setShowServiceForm(false);
                            setActiveServiceFacilityId(null);
                        }}
                    />
                </div>
            </header>

            <section className="kpis-di" aria-label="Filter by status">
                <button type="button" className="kpi-di kpi-wait-di" aria-pressed={statusFilter === 'Waiting for Approval'} onClick={() => setStatusFilter('Waiting for Approval')}>
                    <span className="kpi-icon-di"><Clock className="ic-di" aria-hidden="true" /></span>
                    <span><span className="kpi-num-di">{summary.pending}</span><span className="kpi-label-di">Waiting for approval</span></span>
                </button>
                <button type="button" className="kpi-di kpi-done-di" aria-pressed={statusFilter === 'Completed'} onClick={() => setStatusFilter('Completed')}>
                    <span className="kpi-icon-di"><CheckCircle2 className="ic-di" aria-hidden="true" /></span>
                    <span><span className="kpi-num-di">{summary.completed}</span><span className="kpi-label-di">Completed</span></span>
                </button>
                <button type="button" className="kpi-di kpi-deny-di" aria-pressed={statusFilter === 'Denied'} onClick={() => setStatusFilter('Denied')}>
                    <span className="kpi-icon-di"><XCircle className="ic-di" aria-hidden="true" /></span>
                    <span><span className="kpi-num-di">{summary.denied}</span><span className="kpi-label-di">Denied</span></span>
                </button>
                <button type="button" className="kpi-di kpi-all-di" aria-pressed={statusFilter === 'All'} onClick={() => setStatusFilter('All')}>
                    <span className="kpi-icon-di"><List className="ic-di" aria-hidden="true" /></span>
                    <span><span className="kpi-num-di">{requests.length}</span><span className="kpi-label-di">All requests</span></span>
                </button>
            </section>

            <section className="controls-di">
                <div className="search-box-di">
                    <label className="sr-di" htmlFor="di-search">Search requests</label>
                    <Search className="ic-di" aria-hidden="true" />
                    <input
                        id="di-search"
                        type="search"
                        placeholder="Student, ID or request"
                        autoComplete="off"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="seg-di" role="group" aria-label="Request type">
                    {[['All', 'All types'], ['Excuse Slip', 'Excuse Slip'], ['Referral Slip', 'Referral Slip']].map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={typeFilter === value} onClick={() => setTypeFilter(value)}>
                            {label}
                        </button>
                    ))}
                </div>
                <p className="count-di" role="status" aria-live="polite">Showing {filteredRequests.length} of {requests.length}</p>
            </section>

            <div className="workspace-di">
                <section className="card-di" aria-label="Requests">
                    <div className="table-wrap-di">
                        {loading ? (
                            <div className="state-di" role="status">Loading requests...</div>
                        ) : error ? (
                            <div className="state-di error-di" role="alert">{error}</div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="state-di"><Inbox aria-hidden="true" className="ic-di" /><p>No requests</p></div>
                        ) : (
                            <table className="table-di">
                                <thead>
                                    <tr>
                                        <th className="col-id-di">Request</th>
                                        <th>Student</th>
                                        <th>Type</th>
                                        <th className="col-reason-di">Reason / facility</th>
                                        <th className="col-date-di">Requested</th>
                                        <th>Status</th>
                                        <th className="col-act-di"><span className="sr-di">Action</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map((req) => {
                                        const isSelected = selectedRequest
                                            && selectedRequest.request_id === req.request_id
                                            && selectedRequest.request_type === req.request_type;
                                        return (
                                            <tr
                                                key={`${req.request_type}-${req.request_id}`}
                                                className={isSelected ? 'selected-di' : ''}
                                                onClick={() => handleViewDetails(req)}
                                            >
                                                <td className="col-id-di mono-di">{req.request_id}</td>
                                                <td>
                                                    <div className="student-info-cell-di">
                                                        <span className="student-name-di">{fullName(req)}</span>
                                                        <span className="student-id-di mono-di">{req.student_id}</span>
                                                    </div>
                                                </td>
                                                <td><TypeBadge type={req.request_type} /></td>
                                                <td className="col-reason-di">
                                                    <span className="clamp-di">
                                                        {req.request_type === 'Excuse Slip' ? (req.reason || req.reason_for_excuse) : (req.partner_facility_name || req.reason)}
                                                    </span>
                                                </td>
                                                <td className="col-date-di">{req.created_at ? formatDate(new Date(req.created_at)) : 'N/A'}</td>
                                                <td><StatusBadge status={req.status} /></td>
                                                <td className="col-act-di">
                                                    <IconButton
                                                        icon={Eye}
                                                        label={`View details for ${fullName(req)}`}
                                                        aria-current={isSelected ? 'true' : undefined}
                                                        onClick={(e) => { e.stopPropagation(); handleViewDetails(req); }}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {selectedRequest && <div className="scrim-di" onClick={closeModal} aria-hidden="true" />}

                <aside className={`card-di detail-di ${selectedRequest ? 'open-di' : ''}`} aria-label="Request details">
                    {!selectedRequest ? (
                        <div className="state-di"><Inbox aria-hidden="true" className="ic-di" /><p>Select a request</p></div>
                    ) : (
                        <>
                            <header className="detail-head-di">
                                <div>
                                    <span className="mono-di muted-di">{selectedRequest.request_id}</span>
                                    <h2 tabIndex={-1} ref={detailTitleRef}>{fullName(selectedRequest)}</h2>
                                    <div className="badges-di">
                                        <TypeBadge type={selectedRequest.request_type} />
                                        <StatusBadge status={selectedRequest.status} />
                                    </div>
                                </div>
                                <IconButton icon={X} label="Close details" onClick={closeModal} />
                            </header>

                            <div className="detail-body-di">
                                <dl className="meta-di">
                                    <div><dt>Student ID</dt><dd className="mono-di">{selectedRequest.student_id}</dd></div>
                                    <div><dt>Program</dt><dd>{selectedRequest.program_id} - Year {selectedRequest.year_level}</dd></div>
                                    <div><dt>Requested</dt><dd>{selectedRequest.created_at ? formatDate(new Date(selectedRequest.created_at)) : 'N/A'}</dd></div>
                                    <div><dt>Type</dt><dd>{selectedRequest.request_type}</dd></div>
                                </dl>

                                <section className="request-text-di">
                                    <h3>Request</h3>
                                    {isExcuseRequest ? (
                                        <>
                                            <p><strong>Reason:</strong> {selectedRequest.reason || selectedRequest.reason_for_excuse}</p>
                                            <p>
                                                <strong>Absent:</strong>{' '}
                                                {selectedRequest.valid_absence_start || slipDetails.validityStart
                                                    ? formatDate(new Date(slipDetails.validityStart || selectedRequest.valid_absence_start)) : 'N/A'}
                                                {' to '}
                                                {selectedRequest.valid_absence_end || slipDetails.validityEnd
                                                    ? formatDate(new Date(slipDetails.validityEnd || selectedRequest.valid_absence_end)) : 'N/A'}
                                            </p>
                                            {selectedRequest.student_proof_url && (
                                                <a className="file-attachment-di" href={`http://localhost:3001${selectedRequest.student_proof_url}`} target="_blank" rel="noreferrer">
                                                    <Paperclip className="ic-di" aria-hidden="true" />Student proof
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <p><strong>Reason:</strong> {selectedRequest.reason}</p>
                                            <p><strong>Facility:</strong> {selectedRequest.partner_facility_name || 'N/A'}</p>
                                            <p><strong>Services:</strong> {selectedRequest.requested_services || 'None specified'}</p>
                                        </>
                                    )}
                                </section>

                                <section>
                                    <h3>Messages</h3>
                                    <div className="notes-list-di" role="log" tabIndex={0} aria-label="Message history">
                                        {notes.length === 0 ? (
                                            <p className="muted-di">No messages</p>
                                        ) : (
                                            notes.map((note) => (
                                                <div key={note.note_id} className={`note-bubble-di ${note.sender_type === 'Nurse' ? 'note-nurse-di' : ''}`}>
                                                    <small>{note.sender_type} - {formatDateTime(new Date(note.created_at))}</small>
                                                    {note.message}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="message-input-container-di">
                                        <label className="sr-di" htmlFor="di-note">Message to student</label>
                                        <input
                                            id="di-note"
                                            type="text"
                                            placeholder="Message"
                                            autoComplete="off"
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
                                        <IconButton
                                            icon={Send}
                                            label="Send message"
                                            className=""
                                            onClick={handleSendMessage}
                                            disabled={submitting || !newNote.trim()}
                                        />
                                    </div>
                                </section>

                                {!isWaitingStatus(selectedRequest.status) && (
                                    <div className="issued-info-box-di">
                                        <p><strong>Processed by:</strong> {selectedRequest.issued_by || 'N/A'}</p>
                                        <p><strong>Processed:</strong> {selectedRequest.issued_at ? formatDateTime(new Date(selectedRequest.issued_at)) : 'N/A'}</p>
                                        {selectedRequest.issued_slip_url && (
                                            <>
                                                {/\.(png|jpe?g)$/i.test(selectedRequest.issued_slip_url) ? (
                                                    <img
                                                        className="issued-preview-di"
                                                        src={`http://localhost:3001${selectedRequest.issued_slip_url}`}
                                                        alt="Issued slip"
                                                    />
                                                ) : (
                                                    <iframe
                                                        className="issued-preview-di"
                                                        src={`http://localhost:3001${selectedRequest.issued_slip_url}`}
                                                        title="Issued slip"
                                                    />
                                                )}
                                                <a className="file-attachment-di" href={`http://localhost:3001${selectedRequest.issued_slip_url}`} target="_blank" rel="noreferrer">
                                                    <FileText className="ic-di" aria-hidden="true" />Open issued slip
                                                </a>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {isWaitingStatus(selectedRequest.status) && (
                                <footer className="detail-foot-di">
                                    <IconButton icon={XCircle} label="Deny request" className="danger-di" onClick={triggerDeny} disabled={submitting} />
                                    <IconButton icon={CheckCircle2} label="Approve and issue slip" className="" onClick={() => setIsApproving(true)} />
                                </footer>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </>
    );

    // ---------- ISSUE VIEW ----------
    const renderIssue = () => {
        const isReferral = selectedRequest.request_type === 'Referral Slip';
        const showAuto = !isReferral || referralMode === 'autogen';
        const isOthers = (slipDetails.partnerFacility || '').trim().toLowerCase() === 'others';

        return (
            <>
                <header className="bar-di">
                    <IconButton icon={ArrowLeft} label="Back to request" onClick={() => setIsApproving(false)} />
                    <div className="bar-title-di">
                        <h1>Issue {selectedRequest.request_type}</h1>
                        <p className="sub-di"><span className="mono-di">{selectedRequest.request_id}</span> - {fullName(selectedRequest)}</p>
                    </div>
                    {isReferral && (
                        <div className="seg-di" role="group" aria-label="Slip source">
                            <button type="button" aria-pressed={referralMode === 'autogen'} onClick={() => setReferralMode('autogen')}>
                                <FileCode className="ic-di" aria-hidden="true" />Auto-generate
                            </button>
                            <button type="button" aria-pressed={referralMode === 'upload'} onClick={() => setReferralMode('upload')}>
                                <Upload className="ic-di" aria-hidden="true" />Upload
                            </button>
                        </div>
                    )}
                </header>

                <div className="issue-di">
                    {showAuto ? (
                        <>
                            <section className="card-di panel-di" aria-labelledby="di-form-h">
                                <h2 id="di-form-h"><Edit3 className="ic-di" aria-hidden="true" />Slip details</h2>
                                <div className="form-group-di">
                                    <label htmlFor="di-f-date">Date</label>
                                    <input id="di-f-date" type="text" value={slipDetails.date} onChange={(e) => setSlipDetails({ ...slipDetails, date: e.target.value })} />
                                </div>
                                <div className="form-group-di">
                                    <label htmlFor="di-f-name">Student name</label>
                                    <input id="di-f-name" type="text" value={slipDetails.studentName} onChange={(e) => setSlipDetails({ ...slipDetails, studentName: e.target.value })} />
                                </div>
                                <div className="form-group-di">
                                    <label htmlFor="di-f-course">Course / year &amp; section</label>
                                    <input id="di-f-course" type="text" value={slipDetails.courseYearSection} onChange={(e) => setSlipDetails({ ...slipDetails, courseYearSection: e.target.value })} />
                                </div>

                                {!isReferral && (
                                    <div className="grid-2-di">
                                        <div className="form-group-di">
                                            <label htmlFor="di-f-start">Start date</label>
                                            <input
                                                id="di-f-start"
                                                type="date"
                                                value={slipDetails.validityStart}
                                                onChange={(e) => {
                                                    const newStart = e.target.value;
                                                    setSlipDetails(prev => ({
                                                        ...prev,
                                                        validityStart: newStart,
                                                        validityEnd: prev.validityEnd && prev.validityEnd < newStart ? newStart : prev.validityEnd
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="form-group-di">
                                            <label htmlFor="di-f-end">End date</label>
                                            <input
                                                id="di-f-end"
                                                type="date"
                                                value={slipDetails.validityEnd}
                                                min={slipDetails.validityStart}
                                                disabled={!slipDetails.validityStart}
                                                onChange={(e) => {
                                                    const newEnd = e.target.value;
                                                    if (slipDetails.validityStart && newEnd < slipDetails.validityStart) return;
                                                    setSlipDetails(prev => ({ ...prev, validityEnd: newEnd }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {isReferral && (
                                    <div className="grid-2-di">
                                        <div className="form-group-di">
                                            <label htmlFor="di-f-fac">Referred to</label>
                                            <input id="di-f-fac" type="text" value={slipDetails.partnerFacility} onChange={(e) => setSlipDetails({ ...slipDetails, partnerFacility: e.target.value })} />
                                        </div>
                                        <div className="form-group-di">
                                            <label htmlFor="di-f-svc">Requested services</label>
                                            <input id="di-f-svc" type="text" value={slipDetails.requestedServices} onChange={(e) => setSlipDetails({ ...slipDetails, requestedServices: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group-di">
                                    <label htmlFor="di-f-reason">Reason</label>
                                    <textarea id="di-f-reason" rows={3} value={slipDetails.reason} onChange={(e) => setSlipDetails({ ...slipDetails, reason: e.target.value })} />
                                </div>
                                <div className="form-group-di">
                                    <label htmlFor="di-f-nurse">School nurse</label>
                                    <input id="di-f-nurse" type="text" value={slipDetails.nurseName} onChange={(e) => setSlipDetails({ ...slipDetails, nurseName: e.target.value })} />
                                </div>
                            </section>

                            <section className="card-di panel-di preview-di" aria-labelledby="di-preview-h">
                                <h2 id="di-preview-h"><Eye className="ic-di" aria-hidden="true" />Live preview</h2>
                                <div className="paper-wrap-di">
                                    <div className="clinic-slip-paper-di">
                                        <div className="slip-header-di">
                                            <img src={stiLogo} alt="STI logo" className="slip-logo-di" />
                                            <div className="slip-header-center-di">
                                                <h3>STI COLLEGE BALIUAG</h3>
                                                <p>A&amp;C Bldg. Gil Carlos Poblacion Baliuag, Bulacan</p>
                                            </div>
                                            <div />
                                        </div>

                                        <div className="slip-title-di">
                                            {isReferral ? 'CLINIC REFERRAL SLIP' : 'CLINIC EXCUSE SLIP'}
                                        </div>

                                        <div className="slip-date-row-di"><span>DATE:</span><span className="slip-underlined-di">{slipDetails.date}</span></div>
                                        <div className="slip-row-di"><span>NAME:</span><span className="slip-underlined-di">{slipDetails.studentName}</span></div>
                                        <div className="slip-row-di"><span>COURSE/YEAR&amp;SECTION:</span><span className="slip-underlined-di">{slipDetails.courseYearSection}</span></div>

                                        {!isReferral ? (
                                            <>
                                                {(slipDetails.validityStart || slipDetails.validityEnd) && (
                                                    <div className="slip-row-di">
                                                        <span>VALIDITY PERIOD:</span>
                                                        <span className="slip-underlined-di">
                                                            {slipDetails.validityStart ? formatDate(new Date(slipDetails.validityStart)) : ''} to {slipDetails.validityEnd ? formatDate(new Date(slipDetails.validityEnd)) : ''}
                                                        </span>
                                                    </div>
                                                )}
                                                <p className="slip-statement-di">Please excuse the said student in your class.</p>
                                                <div className="slip-reason-section-di">
                                                    <span className="reason-label-di">Reason:</span>
                                                    <div className="reason-line-wrap-di">
                                                        <span className="slip-underlined-di">{slipDetails.reason}</span>
                                                        <div className="empty-underline-di"></div>
                                                        <div className="empty-underline-di"></div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {!isOthers && (
                                                    <div className="slip-row-di"><span>REFERRED TO:</span><span className="slip-underlined-di">{slipDetails.partnerFacility}</span></div>
                                                )}
                                                <div className="slip-row-di"><span>REQUESTED SERVICES:</span><span className="slip-underlined-di">{slipDetails.requestedServices}</span></div>
                                                <p className="slip-statement-di">Please provide medical evaluation / services for the above student.</p>
                                                <div className="slip-reason-section-di">
                                                    <span className="reason-label-di">Reason:</span>
                                                    <div className="reason-line-wrap-di">
                                                        <span className="slip-underlined-di">{slipDetails.reason}</span>
                                                        <div className="empty-underline-di"></div>
                                                        {isOthers && <div className="empty-underline-di"></div>}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <p className="slip-thanks-di">Thank you.</p>
                                        <div className="slip-signature-block-di">
                                            <img src={NURSE_SIGNATURE_SVG} alt="Nurse signature" className="slip-signature-img-di" />
                                            <div className="signature-line-text-di">{slipDetails.nurseName}</div>
                                            <div className="nurse-title-di">SCHOOL NURSE</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </>
                    ) : (
                        <section className="card-di panel-di" style={{ gridColumn: '1 / -1' }} aria-labelledby="di-upload-h">
                            <h2 id="di-upload-h"><Upload className="ic-di" aria-hidden="true" />Issued referral document</h2>
                            <div className="dropzone-di">
                                <Upload aria-hidden="true" className="ic-di" />
                                <label htmlFor="di-file">PDF, PNG or JPG <span className="required-di" aria-hidden="true">*</span></label>
                                <input
                                    id="di-file"
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                                />
                                {selectedFile && <p className="muted-di" role="status">{selectedFile.name}</p>}
                            </div>
                        </section>
                    )}

                    <aside className="card-di panel-di ctx-di" aria-label="Request context">
                        <h2><FileText className="ic-di" aria-hidden="true" />Request</h2>
                        <div className="badges-di">
                            <TypeBadge type={selectedRequest.request_type} />
                            <StatusBadge status={selectedRequest.status} />
                        </div>
                        <dl className="meta-di">
                            <div><dt>Student</dt><dd>{fullName(selectedRequest)}</dd></div>
                            <div><dt>Student ID</dt><dd className="mono-di">{selectedRequest.student_id}</dd></div>
                        </dl>
                        <div>
                            <h3>Reason</h3>
                            <p className="quote-di">{selectedRequest.reason || selectedRequest.reason_for_excuse || 'N/A'}</p>
                        </div>
                        {isExcuseRequest && selectedRequest.student_proof_url && (
                            <a className="file-attachment-di" href={`http://localhost:3001${selectedRequest.student_proof_url}`} target="_blank" rel="noreferrer">
                                <Paperclip className="ic-di" aria-hidden="true" />Student proof
                            </a>
                        )}
                        <div>
                            <h3>Latest message</h3>
                            {latestNote ? <p className="quote-di">{latestNote.message}</p> : <p className="muted-di">No messages</p>}
                        </div>
                    </aside>
                </div>

                <div className="actionbar-di">
                    <IconButton icon={ArrowLeft} label="Back to request" onClick={() => setIsApproving(false)} disabled={submitting} />
                    <IconButton icon={Send} label="Send file to student" className="" onClick={triggerApprove} disabled={submitting} />
                </div>
            </>
        );
    };

    // ---------- CONFIG VIEW ----------
    const renderConfig = () => (
        <>
            <header className="bar-di">
                <IconButton icon={ArrowLeft} label="Back to requests" onClick={closeConfig} />
                <div className="bar-title-di">
                    <h1>Referral Services</h1>
                    <p className="sub-di">{displayedFacilities.length} partner facilities</p>
                </div>
                <div className="bar-actions-di">
                    <IconButton
                        icon={RefreshCw}
                        label="Refresh"
                        onClick={() => { fetchFacilities(); fetchMedicalRequirements(); }}
                    />
                    {!showFacilityForm && (
                        <IconButton
                            icon={Plus}
                            label="Add facility"
                            className=""
                            onClick={() => {
                                setIsEditingFacility(false);
                                setFacilityForm({ facility_id: '', facility_name: '', address: '', contact_number: '' });
                                setShowFacilityForm(true);
                                setShowServiceForm(false);
                                setActiveServiceFacilityId(null);
                            }}
                        />
                    )}
                </div>
            </header>

            {configLoading ? (
                <div className="state-di" role="status">Loading...</div>
            ) : configError ? (
                <div className="state-di error-di" role="alert">
                    <p>{configError}</p>
                    <IconButton icon={RefreshCw} label="Try again" onClick={fetchFacilities} />
                </div>
            ) : (
                <>
                    {showFacilityForm && (
                        <form onSubmit={handleSaveFacility} className="card-di panel-di" aria-label={isEditingFacility ? 'Edit facility' : 'New facility'}>
                            <h2><Building2 className="ic-di" aria-hidden="true" />{isEditingFacility ? 'Edit facility' : 'New facility'}</h2>
                            <div className="grid-2-di" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
                                <div className="form-group-di">
                                    <label htmlFor="di-fac-name">Facility name <span className="required-di" aria-hidden="true">*</span></label>
                                    <input id="di-fac-name" type="text" required value={facilityForm.facility_name} onChange={(e) => setFacilityForm({ ...facilityForm, facility_name: e.target.value })} />
                                </div>
                                <div className="form-group-di">
                                    <label htmlFor="di-fac-addr">Address</label>
                                    <input id="di-fac-addr" type="text" value={facilityForm.address} onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })} />
                                </div>
                                <div className="form-group-di">
                                    <label htmlFor="di-fac-contact">Contact number</label>
                                    <input id="di-fac-contact" type="text" value={facilityForm.contact_number} onChange={(e) => setFacilityForm({ ...facilityForm, contact_number: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-button-row-di">
                                <button
                                    type="button"
                                    className="btn-di ghost-di"
                                    onClick={() => {
                                        setShowFacilityForm(false);
                                        setIsEditingFacility(false);
                                        setFacilityForm({ facility_id: '', facility_name: '', address: '', contact_number: '' });
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-di">Save</button>
                            </div>
                        </form>
                    )}

                    {displayedFacilities.length === 0 ? (
                        <div className="state-di"><Inbox aria-hidden="true" className="ic-di" /><p>No partner facilities</p></div>
                    ) : (
                        <div className="fac-grid-di">
                            {displayedFacilities.map((fac) => {
                                const facId = fac.facility_id || fac.id;
                                const isServiceFormOpenHere = showServiceForm && activeServiceFacilityId === facId;

                                return (
                                    <article key={facId} className="card-di fac-di">
                                        <div className="fac-head-di">
                                            <div>
                                                <h2>{fac.facility_name}</h2>
                                                <dl>
                                                    <div>{fac.address || 'N/A'}</div>
                                                    <div className="mono-di">{fac.contact_number || 'N/A'}</div>
                                                </dl>
                                            </div>
                                            <div className="fac-actions-di">
                                                <IconButton icon={Plus} label={`Add service to ${fac.facility_name}`} className="" onClick={() => handleOpenAddService(fac)} />
                                                <IconButton icon={Edit3} label={`Edit ${fac.facility_name}`} onClick={() => handleOpenEditFacility(fac)} />
                                                <IconButton icon={Trash2} label={`Delete ${fac.facility_name}`} className="danger-di" onClick={() => handleDeleteFacility(fac)} />
                                            </div>
                                        </div>

                                        {isServiceFormOpenHere && (
                                            <form onSubmit={handleSaveService} className="inline-form-di" aria-label={isEditingService ? 'Edit service' : 'Add service'}>
                                                <div className="grid-2-di">
                                                    <div className="form-group-di">
                                                        <label htmlFor="di-svc-req">Requirement</label>
                                                        <select
                                                            id="di-svc-req"
                                                            value={serviceForm.requirement_name}
                                                            onChange={(e) => setServiceForm({ ...serviceForm, requirement_name: e.target.value })}
                                                            required
                                                        >
                                                            <option value="">Select</option>
                                                            {medicalRequirements.length === 0 ? (
                                                                <option value="" disabled>No medical requirements found</option>
                                                            ) : (
                                                                medicalRequirements.map((reqName) => (
                                                                    <option key={reqName} value={reqName}>{reqName}</option>
                                                                ))
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="form-group-di">
                                                        <label htmlFor="di-svc-desc">Instructions</label>
                                                        <input id="di-svc-desc" type="text" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="form-button-row-di">
                                                    <button
                                                        type="button"
                                                        className="btn-di ghost-di"
                                                        onClick={() => {
                                                            setShowServiceForm(false);
                                                            setIsEditingService(false);
                                                            setActiveServiceFacilityId(null);
                                                            setActiveFacilityName('');
                                                            setServiceForm({ service_id: '', facility_id: '', requirement_name: '', description: '' });
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button type="submit" className="btn-di">Save</button>
                                                </div>
                                            </form>
                                        )}

                                        <div className="svc-list-di">
                                            {fac.services && fac.services.length > 0 ? (
                                                fac.services.map((srv) => {
                                                    const srvId = srv.service_id || srv.id;
                                                    const displayReqName = srv.requirement_name || srv.service_name;
                                                    return (
                                                        <div key={srvId} className="service-item-di">
                                                            <span>
                                                                <span className="service-name-text-di">{displayReqName}</span>
                                                                {srv.description && <span className="muted-di"> - {srv.description}</span>}
                                                            </span>
                                                            <span className="service-item-actions-di">
                                                                <IconButton icon={Edit3} label={`Edit ${displayReqName}`} onClick={() => handleOpenEditService(fac, srv)} />
                                                                <IconButton icon={Trash2} label={`Remove ${displayReqName}`} onClick={() => handleDeleteService(srv)} />
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="muted-di">No services</p>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </>
    );

    return (
        <div className="container-di">
            {showConfigModal
                ? renderConfig()
                : selectedRequest && isApproving
                    ? renderIssue()
                    : renderQueue()}
        </div>
    );
};

export default DocumentIssuance;
