import React, { useState, useEffect, useCallback } from 'react';
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
    RefreshCw,
    FileCode,
    Trash2,
    Printer
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/DocumentIssuance.css';

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

const DocumentIssuance = () => {
    const outletContext = useOutletContext() || {};
    const nurseId = outletContext.nurseId;

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

    // Confirmation Popup State
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        type: 'warning',
        onConfirm: null
    });

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
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        studentName: '',
        courseYearSection: '',
        reason: '',
        partnerFacility: '',
        requestedServices: '',
        nurseName: 'MARILOU H. BALARAO, RN, LPT',
        validityStart: '',
        validityEnd: ''
    });

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/document-requests`);
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
    }, []);

    const fetchFacilities = useCallback(async () => {
        setConfigLoading(true);
        setConfigError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/partner-facilities`);
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
    }, []);

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

    // Initial Load
    useEffect(() => {
        fetchRequests();
        fetchFacilities();
        fetchMedicalRequirements();
    }, []);

    // Re-fetch when opening config modal
    useEffect(() => {
        if (showConfigModal) {
            fetchFacilities();
            fetchMedicalRequirements();
        }
    }, [showConfigModal, fetchFacilities]);

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

    const fetchNotes = useCallback(async (requestType, requestId) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/document-requests/notes/${requestType}/${requestId}`);
            const data = await res.json();
            if (data.success) {
                setNotes(data.notes || []);
            }
        } catch (err) {
            console.error("Error fetching notes:", err);
        }
    }, []);

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

        const todayFormatted = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

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
    const handleExportReport = () => {
        const rowsToExport = filteredRequests.length > 0 ? filteredRequests : requests;

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

        const tableRowsHtml = rowsToExport.map(req => {
            const studentName = `${req.first_name || ''} ${req.last_name || ''}`.trim();
            const reasonFacility = req.request_type === 'Excuse Slip' 
                ? (req.reason || req.reason_for_excuse || 'N/A') 
                : (req.partner_facility_name || req.reason || 'N/A');
            const reqDate = req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A';
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
                    <span>Date Generated: ${reportDate}</span>
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
                        ${tableRowsHtml}
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
            ? `${API_BASE_URL}/api/partner-facilities/${targetId}`
            : `${API_BASE_URL}/api/partner-facilities`;
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
                alert(data.message || 'Failed to delete facility.');
            }
        } catch (err) {
            console.error('Error deleting facility:', err);
            alert('Error connecting to server.');
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
            ? `${API_BASE_URL}/api/facility-services/${targetServiceId}`
            : `${API_BASE_URL}/api/partner-facilities/${serviceForm.facility_id}/services`;
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
                alert(data.message || 'Failed to save service');
            }
        } catch (err) {
            console.error('Error saving service:', err);
            alert('Error connecting to server.');
        }
    };

    const handleSaveService = (e) => {
        e.preventDefault();
        if (!serviceForm.facility_id || !serviceForm.requirement_name.trim()) {
            alert('Please select a valid medical requirement.');
            return;
        }

        const targetFacility = facilities.find(f => (f.facility_id || f.id) === serviceForm.facility_id);
        const existingServices = targetFacility?.services || [];
        const isDuplicate = existingServices.some(s => 
            ((s.requirement_name || s.service_name) || '').toLowerCase() === serviceForm.requirement_name.trim().toLowerCase() && 
            (s.service_id || s.id) !== serviceForm.service_id
        );

        if (isDuplicate) {
            alert(`The requirement/service "${serviceForm.requirement_name}" is already connected to ${activeFacilityName}. Please select a different medical requirement.`);
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
                alert(data.message || 'Failed to delete service.');
            }
        } catch (err) {
            console.error('Error deleting service:', err);
            alert('Error connecting to server.');
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
            const response = await fetch(`${API_BASE_URL}/api/document-requests/notes`, {
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
                        const startFmt = slipDetails.validityStart ? new Date(slipDetails.validityStart).toLocaleDateString() : '';
                        const endFmt = slipDetails.validityEnd ? new Date(slipDetails.validityEnd).toLocaleDateString() : '';
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
            const response = await fetch(`${API_BASE_URL}/api/document-requests/action`, {
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

    return (
        <div className="container-di">
            {/* Header Section */}
            <header className="header-di">
                <div className="header-text-di">
                    <h2>Document Issuance</h2>
                    <p>Review, approve, and issue Excuse Slips and Referral Slips for students.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                        type="button"
                        className="btn-secondary-di" 
                        onClick={handleExportReport}
                        style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Printer size={18} /> Export
                    </button>
                    <button 
                        type="button"
                        className="btn-secondary-di btn-config-di" 
                        onClick={() => { 
                            setShowConfigModal(true); 
                            setShowFacilityForm(false);
                            setShowServiceForm(false);
                            setActiveServiceFacilityId(null);
                        }}
                        style={{ width: 'auto' }}
                    >
                        <Settings size={18} /> Configure Referral Services
                    </button>
                </div>
            </header>

            {/* Summary Grid Cards */}
            <section className="summary-cards-di">
                <div className="summary-card-di pending-card-di">
                    <div className="card-icon-di"><Clock size={26} /></div>
                    <div className="card-info-di">
                        <span>Waiting for Approval</span>
                        <h3>{summary.pending}</h3>
                    </div>
                </div>

                <div className="summary-card-di approved-card-di">
                    <div className="card-icon-di"><CheckCircle2 size={26} /></div>
                    <div className="card-info-di">
                        <span>Completed / Approved</span>
                        <h3>{summary.completed}</h3>
                    </div>
                </div>

                <div className="summary-card-di denied-card-di">
                    <div className="card-icon-di"><XCircle size={26} /></div>
                    <div className="card-info-di">
                        <span>Denied Requests</span>
                        <h3>{summary.denied}</h3>
                    </div>
                </div>
            </section>

            {/* Controls Bar */}
            <section className="controls-di">
                <div className="search-box-di">
                    <Search size={18} className="search-icon-di" />
                    <input 
                        type="text" 
                        placeholder="Search by student name, Student ID, or Request ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-group-di">
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
            </section>

            {/* Table Area */}
            <main className="table-responsive-di">
                {loading ? (
                    <div className="loading-di">Loading requests...</div>
                ) : error ? (
                    <div className="error-di">{error}</div>
                ) : filteredRequests.length === 0 ? (
                    <div className="empty-di">No document requests found.</div>
                ) : (
                    <table className="table-di">
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Student Name</th>
                                <th>Request Type</th>
                                <th>Reason / Facility</th>
                                <th>Date Requested</th>
                                <th>Status</th>
                                <th className="text-center-di">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map((req) => (
                                <tr key={`${req.request_type}-${req.request_id}`}>
                                    <td className="font-bold-di">{req.request_id}</td>
                                    <td>
                                        <div className="student-info-cell-di">
                                            <span className="student-name-di">{req.first_name} {req.last_name}</span>
                                            <span className="student-id-di">{req.student_id}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge-type-di ${req.request_type === 'Excuse Slip' ? 'badge-excuse-di' : 'badge-referral-di'}`}>
                                            {req.request_type}
                                        </span>
                                    </td>
                                    <td className="truncate-cell-di">
                                        {req.request_type === 'Excuse Slip' ? (req.reason || req.reason_for_excuse) : req.partner_facility_name || req.reason}
                                    </td>
                                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`badge-status-di status-${(req.status || '').toLowerCase() === 'pending' ? 'pending-di' : (req.status || '').toLowerCase() + '-di'}`}>
                                            {(req.status || '').toLowerCase() === 'pending' ? 'Waiting for Approval' : req.status}
                                        </span>
                                    </td>
                                    <td className="text-center-di">
                                        <button 
                                            type="button"
                                            className="btn-action-icon-di btn-view-di" 
                                            onClick={() => handleViewDetails(req)}
                                            title="View Details"
                                            aria-label="View Details"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </main>

            {/* Detail Modal */}
            {selectedRequest && !isApproving && (
                <div className="modal-overlay-di">
                    <div className="modal-di">
                        <div className="modal-header-di">
                            <div>
                                <h3>Document Request Details</h3>
                                <span className="modal-subtitle-di">Request ID: {selectedRequest.request_id}</span>
                            </div>
                            <button className="btn-close-di" onClick={closeModal} aria-label="Close modal"><X size={20} /></button>
                        </div>

                        <div className="modal-body-di">
                            <div className="details-grid-di">
                                <div className="detail-item-di">
                                    <label>Student Name</label>
                                    <p>{selectedRequest.first_name} {selectedRequest.last_name}</p>
                                </div>
                                <div className="detail-item-di">
                                    <label>Student ID</label>
                                    <p>{selectedRequest.student_id}</p>
                                </div>
                                <div className="detail-item-di">
                                    <label>Program & Year</label>
                                    <p>{selectedRequest.program_id} - Year {selectedRequest.year_level}</p>
                                </div>
                                <div className="detail-item-di">
                                    <label>Request Type</label>
                                    <p className="font-bold-di text-sti-blue-di">{selectedRequest.request_type}</p>
                                </div>
                            </div>

                            <hr className="modal-divider-di" />

                            <div className="request-specific-details-di">
                                <h4>Request Details</h4>
                                {selectedRequest.request_type === 'Excuse Slip' ? (
                                    <>
                                        <p><strong>Reason for Excuse:</strong> {selectedRequest.reason || selectedRequest.reason_for_excuse}</p>
                                        <p>
                                            <strong>Validity Period:</strong> {' '}
                                            {selectedRequest.valid_absence_start || slipDetails.validityStart ? 
                                                new Date(slipDetails.validityStart || selectedRequest.valid_absence_start).toLocaleDateString() : 'N/A'} 
                                            {' to '} 
                                            {selectedRequest.valid_absence_end || slipDetails.validityEnd ? 
                                                new Date(slipDetails.validityEnd || selectedRequest.valid_absence_end).toLocaleDateString() : 'N/A'}
                                        </p>
                                        {selectedRequest.student_proof_url && (
                                            <div className="file-attachment-di">
                                                <Paperclip size={16} />
                                                <a href={getMediaUrl(selectedRequest.student_proof_url)} target="_blank" rel="noreferrer">
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

                            <div className="modal-notes-section-di">
                                <h4>Message & Notes History</h4>
                                <div className="notes-list-di">
                                    {notes.length === 0 ? (
                                        <p className="no-notes-di">No previous messages or notes attached.</p>
                                    ) : (
                                        notes.map((note) => (
                                            <div key={note.note_id} className={`note-bubble-di ${note.sender_type === 'Nurse' ? 'note-nurse-di' : 'note-student-di'}`}>
                                                <div className="note-header-di">
                                                    <strong>{note.sender_type} ({note.sender_id})</strong>
                                                    <span>{new Date(note.created_at).toLocaleString()}</span>
                                                </div>
                                                <p>{note.message}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="message-input-container-di">
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
                                        className="btn-send-message-di" 
                                        onClick={handleSendMessage}
                                        disabled={submitting || !newNote.trim()}
                                        aria-label="Send Message"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>

                            {!['pending', 'waiting for approval'].includes((selectedRequest.status || '').toLowerCase()) && (
                                <div className="issued-info-box-di">
                                    <p><strong>Processed By Nurse ID:</strong> {selectedRequest.issued_by || 'N/A'}</p>
                                    <p><strong>Processed At:</strong> {selectedRequest.issued_at ? new Date(selectedRequest.issued_at).toLocaleString() : 'N/A'}</p>
                                    {selectedRequest.issued_slip_url && (
                                        <div className="file-attachment-di mt-2-di">
                                            <FileText size={16} />
                                            <a href={getMediaUrl(selectedRequest.issued_slip_url)} target="_blank" rel="noreferrer">
                                                View Official Issued PDF Slip
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {modalError && (
                                <div className="modal-error-di">
                                    <AlertCircle size={16} /> {modalError}
                                </div>
                            )}
                        </div>

                        {['pending', 'waiting for approval'].includes((selectedRequest.status || '').toLowerCase()) && (
                            <div className="modal-footer-di">
                                <button className="btn-approve-di" onClick={() => setIsApproving(true)}>
                                    <CheckCircle2 size={16} /> Approve & Issue Slip
                                </button>
                                <button className="btn-deny-di" onClick={triggerDeny} disabled={submitting}>
                                    <XCircle size={16} /> {submitting ? 'Processing...' : 'Deny Request'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Approval Modal */}
            {selectedRequest && isApproving && (
                <div className="modal-overlay-di">
                    <div className="modal-di modal-wide-di">
                        <div className="modal-header-di">
                            <div>
                                <h3>Approve & Issue {selectedRequest.request_type}</h3>
                                <span className="modal-subtitle-di">Request ID: {selectedRequest.request_id}</span>
                            </div>
                            <button className="btn-close-di" onClick={() => setIsApproving(false)} aria-label="Close modal"><X size={20} /></button>
                        </div>

                        <div className="modal-body-di">
                            {selectedRequest.request_type === 'Referral Slip' && (
                                <div className="referral-mode-selector-di">
                                    <button 
                                        type="button" 
                                        className={`mode-tab-btn-di ${referralMode === 'autogen' ? 'active-di' : ''}`}
                                        onClick={() => setReferralMode('autogen')}
                                    >
                                        <FileCode size={16} /> Auto-Generate Referral Slip
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`mode-tab-btn-di ${referralMode === 'upload' ? 'active-di' : ''}`}
                                        onClick={() => setReferralMode('upload')}
                                    >
                                        <Upload size={16} /> Upload Custom File
                                    </button>
                                </div>
                            )}

                            {(selectedRequest.request_type === 'Excuse Slip' || (selectedRequest.request_type === 'Referral Slip' && referralMode === 'autogen')) && (
                                <div className="slip-auto-container-di">
                                    <div className="slip-controls-card-di">
                                        <h5><Edit3 size={16} /> Edit Slip Details</h5>
                                        <div className="form-group-di">
                                            <label>Date:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.date} 
                                                onChange={(e) => setSlipDetails({...slipDetails, date: e.target.value})} 
                                            />
                                        </div>
                                        <div className="form-group-di">
                                            <label>Student Name:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.studentName} 
                                                onChange={(e) => setSlipDetails({...slipDetails, studentName: e.target.value})} 
                                            />
                                        </div>
                                        <div className="form-group-di">
                                            <label>Course / Year & Section:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.courseYearSection} 
                                                onChange={(e) => setSlipDetails({...slipDetails, courseYearSection: e.target.value})} 
                                            />
                                        </div>

                                        {selectedRequest.request_type === 'Excuse Slip' && (
                                            <div className="form-group-di">
                                                <label>Validity Period:</label>
                                                <div className="validity-date-inputs-di">
                                                    <div className="validity-input-subgroup-di">
                                                        <span className="validity-sublabel-di">Start Date</span>
                                                        <input 
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
                                                    <span className="validity-separator-di">to</span>
                                                    <div className="validity-input-subgroup-di">
                                                        <span className="validity-sublabel-di">End Date</span>
                                                        <input 
                                                            type="date" 
                                                            value={slipDetails.validityEnd} 
                                                            min={slipDetails.validityStart}
                                                            disabled={!slipDetails.validityStart}
                                                            onChange={(e) => {
                                                                const newEnd = e.target.value;
                                                                if (slipDetails.validityStart && newEnd < slipDetails.validityStart) return;
                                                                setSlipDetails(prev => ({
                                                                    ...prev,
                                                                    validityEnd: newEnd
                                                                }));
                                                            }} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedRequest.request_type === 'Referral Slip' && (
                                            <>
                                                <div className="form-group-di">
                                                    <label>Referred To (Partner Facility):</label>
                                                    <input 
                                                        type="text" 
                                                        value={slipDetails.partnerFacility} 
                                                        onChange={(e) => setSlipDetails({...slipDetails, partnerFacility: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="form-group-di">
                                                    <label>Requested Services:</label>
                                                    <input 
                                                        type="text" 
                                                        value={slipDetails.requestedServices} 
                                                        onChange={(e) => setSlipDetails({...slipDetails, requestedServices: e.target.value})} 
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="form-group-di">
                                            <label>Reason:</label>
                                            <textarea 
                                                rows={3}
                                                value={slipDetails.reason} 
                                                onChange={(e) => setSlipDetails({...slipDetails, reason: e.target.value})} 
                                            />
                                        </div>
                                        <div className="form-group-di">
                                            <label>School Nurse Name:</label>
                                            <input 
                                                type="text" 
                                                value={slipDetails.nurseName} 
                                                onChange={(e) => setSlipDetails({...slipDetails, nurseName: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="slip-preview-card-di">
                                        <div className="clinic-slip-paper-di">
                                            <img src={stiLogo} alt="STI Logo" className="slip-logo-di" />
                                            <div className="slip-header-center-di">
                                                <h3>STI COLLEGE BALIUAG</h3>
                                                <p>A&C Bldg. Gil Carlos Poblacion Baliuag, Bulacan</p>
                                            </div>

                                            <div className="slip-title-di">
                                                {selectedRequest.request_type === 'Excuse Slip' ? 'CLINIC EXCUSE SLIP' : 'CLINIC REFERRAL SLIP'}
                                            </div>

                                            <div className="slip-date-row-di"><span>DATE:</span><span className="slip-underlined-di">{slipDetails.date}</span></div>
                                            <div className="slip-row-di"><span>NAME:</span><span className="slip-underlined-di full-di">{slipDetails.studentName}</span></div>
                                            <div className="slip-row-di"><span>COURSE/YEAR&SECTION:</span><span className="slip-underlined-di full-di">{slipDetails.courseYearSection}</span></div>

                                            {selectedRequest.request_type === 'Excuse Slip' ? (
                                                <>
                                                    {(slipDetails.validityStart || slipDetails.validityEnd) && (
                                                        <div className="slip-row-di">
                                                            <span>VALIDITY PERIOD:</span>
                                                            <span className="slip-underlined-di full-di">
                                                                {slipDetails.validityStart ? new Date(slipDetails.validityStart).toLocaleDateString() : ''} to {slipDetails.validityEnd ? new Date(slipDetails.validityEnd).toLocaleDateString() : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className="slip-statement-di">Please excuse the said student in your class.</p>
                                                    <div className="slip-reason-section-di">
                                                        <span className="reason-label-di">Reason:</span>
                                                        <div className="reason-line-wrap-di">
                                                            <span className="slip-underlined-di full-di">{slipDetails.reason}</span>
                                                            <div className="empty-underline-di"></div>
                                                            <div className="empty-underline-di"></div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {(slipDetails.partnerFacility || '').trim().toLowerCase() !== 'others' && (
                                                        <div className="slip-row-di"><span>REFERRED TO:</span><span className="slip-underlined-di full-di">{slipDetails.partnerFacility}</span></div>
                                                    )}
                                                    <div className="slip-row-di"><span>REQUESTED SERVICES:</span><span className="slip-underlined-di full-di">{slipDetails.requestedServices}</span></div>
                                                    <p className="slip-statement-di">Please provide medical evaluation / services for the above student.</p>
                                                    <div className="slip-reason-section-di">
                                                        <span className="reason-label-di">Reason:</span>
                                                        <div className="reason-line-wrap-di">
                                                            <span className="slip-underlined-di full-di">{slipDetails.reason}</span>
                                                            <div className="empty-underline-di"></div>
                                                            {(slipDetails.partnerFacility || '').trim().toLowerCase() === 'others' && (
                                                                <div className="empty-underline-di"></div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <p className="slip-thanks-di">Thank you.</p>
                                            <div className="slip-signature-block-di">
                                                <img src={NURSE_SIGNATURE_SVG} alt="Nurse Signature" className="slip-signature-img-di" />
                                                <div className="signature-line-text-di">{slipDetails.nurseName}</div>
                                                <div className="nurse-title-di">SCHOOL NURSE</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedRequest.request_type === 'Referral Slip' && referralMode === 'upload' && (
                                <div className="upload-step-box-di">
                                    <div className="upload-step-header-di">
                                        <Upload size={20} className="upload-icon-heading-di" />
                                        <div>
                                            <h4>Upload Issued Referral Document</h4>
                                            <p>Attach the signed referral document to complete the request.</p>
                                        </div>
                                    </div>
                                    <div className="form-group-di mt-3-di">
                                        <label>Upload Document Slip File (PDF, PNG, JPG): <span className="text-danger-di">*</span></label>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                        />
                                    </div>
                                </div>
                            )}

                            {modalError && (
                                <div className="modal-error-di mt-2-di">
                                    <AlertCircle size={16} /> {modalError}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer-di">
                            <button className="btn-approve-di" onClick={triggerApprove} disabled={submitting}>
                                <Send size={16} /> {submitting ? 'Processing...' : 'Send File to Student'}
                            </button>
                            <button className="btn-secondary-di" onClick={() => setIsApproving(false)} disabled={submitting}>
                                <ArrowLeft size={16} /> Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {showConfigModal && (
                <div className="modal-overlay-di">
                    <div className="modal-di modal-wide-di config-modal-di">
                        <div className="modal-header-di">
                            <div>
                                <h3>Configure Referral Services & Partner Facilities</h3>
                                <span className="modal-subtitle-di">Manage healthcare facilities and available services</span>
                            </div>
                            <div className="modal-header-actions-di">
                                <button 
                                    type="button" 
                                    className="btn-secondary-di btn-sm-di"
                                    onClick={() => {
                                        fetchFacilities();
                                        fetchMedicalRequirements();
                                    }}
                                    title="Reload Facilities & Medical Requirements"
                                >
                                    <RefreshCw size={14} /> Refresh
                                </button>
                                {!showFacilityForm && !showServiceForm && (
                                    <button 
                                        type="button" 
                                        className="btn-save-sm-di"
                                        onClick={() => {
                                            setIsEditingFacility(false);
                                            setFacilityForm({ facility_id: '', facility_name: '', address: '', contact_number: '' });
                                            setShowFacilityForm(true);
                                            setShowServiceForm(false);
                                            setActiveServiceFacilityId(null);
                                        }}
                                    >
                                        <Plus size={14} /> Add Facility
                                    </button>
                                )}
                                <button className="btn-close-di" onClick={() => setShowConfigModal(false)} aria-label="Close modal"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="modal-body-di config-modal-body-di">
                            {configLoading ? (
                                <div className="loading-di">Loading configuration from server...</div>
                            ) : configError ? (
                                <div className="error-di my-3-di">
                                    <AlertCircle size={18} /> {configError}
                                    <button className="btn-secondary-di mt-2-di" onClick={fetchFacilities}>Try Again</button>
                                </div>
                            ) : (
                                <div className="config-container-di">
                                    {/* Partner Facility Add/Edit Form */}
                                    {showFacilityForm && (
                                        <form onSubmit={handleSaveFacility} className="config-form-di mb-3-di">
                                            <h5>{isEditingFacility ? 'Edit Partner Facility' : 'Add New Partner Facility'}</h5>
                                            <div className="form-grid-3-di">
                                                <input 
                                                    type="text" 
                                                    placeholder="Facility Name" 
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
                                            <div className="form-button-row-di">
                                                <button type="submit" className="btn-save-sm-di">
                                                    <Plus size={14} /> {isEditingFacility ? 'Update Facility' : 'Save Facility'}
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn-cancel-sm-di"
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

                                    {/* Facility List View */}
                                    <div className="facility-full-list-di">
                                        {displayedFacilities.length === 0 ? (
                                            <p className="no-notes-di">No partner facilities found.</p>
                                        ) : (
                                            displayedFacilities.map((fac) => {
                                                const facId = fac.facility_id || fac.id;
                                                const isServiceFormOpenHere = showServiceForm && activeServiceFacilityId === facId;

                                                return (
                                                    <div key={facId} className="facility-block-di">
                                                        <div className="facility-block-header-di">
                                                            <div className="facility-info-di">
                                                                <div className="facility-title-row-di">
                                                                    <h4>{fac.facility_name}</h4>
                                                                </div>
                                                                <div className="facility-meta-di">
                                                                    <span><strong>Address:</strong> {fac.address || 'N/A'}</span>
                                                                    <span><strong>Contact:</strong> {fac.contact_number || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="facility-card-actions-di">
                                                                <button 
                                                                    type="button"
                                                                    className="btn-save-sm-di"
                                                                    onClick={() => handleOpenAddService(fac)}
                                                                >
                                                                    <Plus size={14} /> Add Service
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    className="btn-action-icon-di btn-view-di"
                                                                    onClick={() => handleOpenEditFacility(fac)}
                                                                    title="Edit Facility"
                                                                >
                                                                    <Edit3 size={15} />
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    className="btn-action-icon-di btn-deny-di"
                                                                    onClick={() => handleDeleteFacility(fac)}
                                                                    title="Delete Facility"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Inline Add/Edit Service Form with Medical Requirements Dropdown */}
                                                        {isServiceFormOpenHere && (
                                                            <form onSubmit={handleSaveService} className="config-form-di inline-service-form-di my-3-di">
                                                                <h5>{isEditingService ? `Edit Service for ${activeFacilityName}` : `Add Service to ${activeFacilityName}`}</h5>
                                                                <div className="form-grid-2-di">
                                                                    <div className="form-group-di">
                                                                        <label>Requirement Name (from Medical Requirements):</label>
                                                                        <select
                                                                            value={serviceForm.requirement_name}
                                                                            onChange={(e) => setServiceForm({ ...serviceForm, requirement_name: e.target.value })}
                                                                            required
                                                                        >
                                                                            <option value="">-- Select Requirement Name --</option>
                                                                            {medicalRequirements.length === 0 ? (
                                                                                <option value="" disabled>No medical requirements found in database</option>
                                                                            ) : (
                                                                                medicalRequirements.map((reqName, idx) => (
                                                                                    <option key={idx} value={reqName}>
                                                                                        {reqName}
                                                                                    </option>
                                                                                ))
                                                                            )}
                                                                        </select>
                                                                    </div>

                                                                    <div className="form-group-di">
                                                                        <label>Description / Instructions:</label>
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder="Description / Instructions" 
                                                                            value={serviceForm.description}
                                                                            onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="form-button-row-di">
                                                                    <button type="submit" className="btn-save-sm-di">
                                                                        <Plus size={14} /> {isEditingService ? 'Update Service' : 'Connect Service'}
                                                                    </button>
                                                                    <button 
                                                                        type="button" 
                                                                        className="btn-cancel-sm-di"
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
                                                                </div>
                                                            </form>
                                                        )}

                                                        {/* Nested Existing Services List View for target Facility */}
                                                        <div className="facility-services-container-di">
                                                            <h5 className="services-section-title-di">Connected Facility Services</h5>
                                                            {fac.services && fac.services.length > 0 ? (
                                                                <ul className="services-list-di">
                                                                    {fac.services.map((srv) => {
                                                                        const srvId = srv.service_id || srv.id;
                                                                        const displayReqName = srv.requirement_name || srv.service_name;
                                                                        return (
                                                                            <li key={srvId} className="service-item-di">
                                                                                <div className="service-item-details-di">
                                                                                    <span className="service-name-text-di">{displayReqName}</span>
                                                                                    {srv.description && (
                                                                                        <span className="service-desc-text-di"> — {srv.description}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="service-item-actions-di">
                                                                                    <button 
                                                                                        type="button"
                                                                                        className="btn-icon-sm-di btn-edit-sm-di"
                                                                                        onClick={() => handleOpenEditService(fac, srv)}
                                                                                        title="Edit Service Connection"
                                                                                    >
                                                                                        <Edit3 size={13} />
                                                                                    </button>
                                                                                    <button 
                                                                                        type="button"
                                                                                        className="btn-icon-sm-di btn-delete-sm-di"
                                                                                        onClick={() => handleDeleteService(srv)}
                                                                                        title="Delete Service Connection"
                                                                                    >
                                                                                        <Trash2 size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            ) : (
                                                                <p className="no-services-text-di">No services connected to this facility yet.</p>
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

            {/* Confirmation Popup Modal */}
            {confirmState.isOpen && (
                <div className="modal-overlay-di confirm-overlay-di">
                    <div className="modal-di confirm-modal-di">
                        <div className="modal-header-di">
                            <div>
                                <h3>{confirmState.title || 'Confirmation'}</h3>
                            </div>
                            <button 
                                className="btn-close-di" 
                                onClick={() => setConfirmState({ ...confirmState, isOpen: false })} 
                                aria-label="Close confirmation"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body-di confirm-body-di">
                            <div className={`confirm-icon-wrapper-di confirm-icon-${confirmState.type || 'warning'}-di`}>
                                {confirmState.type === 'deny' ? (
                                    <XCircle size={36} />
                                ) : confirmState.type === 'approve' ? (
                                    <CheckCircle2 size={36} />
                                ) : (
                                    <AlertCircle size={36} />
                                )}
                            </div>
                            <p className="confirm-message-di">{confirmState.message}</p>
                        </div>

                        <div className="modal-footer-di confirm-footer-di">
                            <button 
                                type="button" 
                                className="btn-secondary-di" 
                                onClick={() => setConfirmState({ ...confirmState, isOpen: false })}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className={confirmState.type === 'deny' ? 'btn-deny-di' : 'btn-approve-di'} 
                                onClick={() => {
                                    const action = confirmState.onConfirm;
                                    setConfirmState({ ...confirmState, isOpen: false });
                                    if (action) action();
                                }}
                            >
                                {confirmState.confirmText || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentIssuance;