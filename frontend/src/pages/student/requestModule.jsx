import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useLocation } from 'react-router-dom';
import {
  Eye, X, Plus, Search, Send, Clock, CircleCheck, CircleX, ClipboardList, Building2,
  Paperclip, FileText, Upload, Calendar, Download
} from 'lucide-react';
import { io } from 'socket.io-client';
import '../../styles/student/RequestModule.css';
import '../../styles/student/RequestModuleRedesign.css';
import { useAlert } from '../../context/AlertContext';
import { formatTime, formatDate, formatDateTime } from '../../utils/datetime';

const API_BASE = 'http://localhost:3001/api';
const BASE_URL = 'http://localhost:3001';

const statusLabel = (status) =>
  !status || status.toLowerCase() === 'pending' ? 'Waiting for Approval' : status;

// waiting | approved | declined (drives pill color + icon + filter tabs)
const statusKind = (status) => {
  const v = (status || 'pending').toLowerCase();
  if (/approv|issued|complete|fulfill|release/.test(v)) return 'approved';
  if (/reject|declin|denied|cancel/.test(v)) return 'declined';
  return 'waiting';
};
const STATUS_ICON = { waiting: Clock, approved: CircleCheck, declined: CircleX };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'declined', label: 'Declined' }
];

const fmtDay = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : formatDate(d);
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function StatusPill({ status }) {
  const kind = statusKind(status);
  const Icon = STATUS_ICON[kind];
  return (
    <span className={`rq-pill rq-st-${kind}`}>
      <Icon className="rq-ico" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

/**
 * Accessible modal: role=dialog, Esc closes, Tab is trapped, focus returns to the opener.
 * Pass onSubmit to render the sheet as a <form> (head, body and footer inside it).
 */
function Modal({ titleId, title, size, onClose, onSubmit, footer, children }) {
  const sheetRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const sheet = sheetRef.current;
    const first = sheet && (sheet.querySelector('[data-autofocus]') || sheet.querySelector(FOCUSABLE));
    if (first) first.focus();

    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !sheet) return;
      const items = Array.from(sheet.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  const Tag = onSubmit ? 'form' : 'div';
  const sheetProps = onSubmit ? { onSubmit, noValidate: true } : {};

  return createPortal(
    <div
      className="rq-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Tag
        ref={sheetRef}
        className={`rq-sheet ${size ? `rq-sheet-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...sheetProps}
      >
        <div className="rq-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="rq-btn rq-btn-icon" onClick={onClose} aria-label="Close" title="Close">
            <X className="rq-ico" aria-hidden="true" />
          </button>
        </div>
        {children}
        {footer}
      </Tag>
    </div>,
    document.body
  );
}

export default function RequestModule() {
  const location = useLocation();
  const { showAlert } = useAlert();
  const { studentId, firstName, lastName } = useOutletContext() || {};
  const student_id = studentId;

  // Helper to format file URLs using standard base URL
  const getFileUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // UI state
  const [activeModal, setActiveModal] = useState(location.state?.openModal || null);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // History toolbar state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Partner Facilities, Medical Requirements, & Services State
  const [partnerFacilities, setPartnerFacilities] = useState([]);
  const [medicalRequirements, setMedicalRequirements] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);

  // Form States
  const [excuseForm, setExcuseForm] = useState({
    reason_for_excuse: '',
    valid_absence_start: '',
    valid_absence_end: '',
    proof: null
  });

  // Proof Preview State
  const [proofPreview, setProofPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [referralForm, setReferralForm] = useState({
    reason_for_referral: '',
    facility_id: '',
    selected_services: []
  });

  const threadRef = useRef(null);

  // Handle proof object URL creation & automatic memory cleanup
  useEffect(() => {
    if (!excuseForm.proof) {
      setProofPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(excuseForm.proof);
    setProofPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [excuseForm.proof]);

  useEffect(() => {
    if (location.state?.openModal) {
      setActiveModal(location.state.openModal);
    }
  }, [location.state]);

  // Keep the newest message in view
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [notes, activeModal]);

  // Fetch Medical Requirements
  const fetchMedicalRequirements = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/medical-requirements`);
      const data = await res.json();
      if (data.success && Array.isArray(data.requirements)) {
        setMedicalRequirements(data.requirements);
      } else if (Array.isArray(data)) {
        setMedicalRequirements(data);
      } else if (data.data && Array.isArray(data.data)) {
        setMedicalRequirements(data.data);
      } else {
        setMedicalRequirements([]);
      }
    } catch (err) {
      console.error('Failed to fetch medical requirements:', err);
      setMedicalRequirements([]);
    }
  }, []);

  // Fetch Partner Facilities & Sort 'Others' to the end
  const fetchPartnerFacilities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/partner-facilities`);
      const data = await res.json();
      const rawFacilities = Array.isArray(data)
        ? data
        : (Array.isArray(data.facilities) ? data.facilities : []);

      // Sort so 'Others' facility is always the last option in dropdown
      const sortedFacilities = [...rawFacilities].sort((a, b) => {
        const nameA = (a.facility_name || '').trim().toLowerCase();
        const nameB = (b.facility_name || '').trim().toLowerCase();
        if (nameA === 'others') return 1;
        if (nameB === 'others') return -1;
        return 0;
      });

      setPartnerFacilities(sortedFacilities);

      // Default selected option is empty ("Select facility")
      setReferralForm((prev) => ({
        ...prev,
        facility_id: '',
        selected_services: []
      }));
      setAvailableServices([]);
    } catch (err) {
      console.error('Failed to fetch partner facilities:', err);
      setPartnerFacilities([]);
    }
  }, []);

  // Fetch Requests for logged-in student with array verification
  const fetchRequests = useCallback(async () => {
    if (!student_id) return;
    try {
      const res = await fetch(`${API_BASE}/requests/student/${student_id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        console.error('Expected array of requests, got:', data);
        setRequests([]);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setRequests([]);
    }
  }, [student_id]);

  // Initial Load & Real-Time Socket Connection for Requests & Facilities
  useEffect(() => {
    fetchRequests();
    fetchMedicalRequirements();
    fetchPartnerFacilities();

    // Establish WebSocket connection to backend
    const socket = io(BASE_URL);

    // Auto-reflect updates whenever any request status or detail changes
    socket.on('document_request_updated', () => {
      fetchRequests();
    });

    // Auto-reflect updates when partner facilities or services change
    socket.on('partner_facility_updated', () => {
      fetchPartnerFacilities();
      fetchMedicalRequirements();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchRequests, fetchMedicalRequirements, fetchPartnerFacilities]);

  // Real-time Chat / Note Listener for currently selected modal request
  useEffect(() => {
    if (!selectedRequest || activeModal !== 'view') return;

    const socket = io(BASE_URL);

    socket.on('note_added', (data) => {
      if (
        data &&
        data.request_id === selectedRequest.request_id &&
        data.request_type === selectedRequest.request_type
      ) {
        fetchNotes(selectedRequest);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedRequest, activeModal]);

  const handleFacilityChange = (e) => {
    const facilityId = e.target.value;
    const selectedFac = partnerFacilities.find((f) => String(f.facility_id) === String(facilityId));

    setReferralForm((prev) => ({
      ...prev,
      facility_id: facilityId,
      selected_services: []
    }));

    if (selectedFac) {
      const isOthers = (selectedFac.facility_name || '').trim().toLowerCase() === 'others';

      if (isOthers && (!selectedFac.services || selectedFac.services.length === 0)) {
        const reqServices = medicalRequirements.map((reqItem, index) => {
          const reqName = typeof reqItem === 'object' && reqItem !== null
            ? (reqItem.requirement_name || reqItem.name || `Requirement ${index + 1}`)
            : reqItem;
          const reqId = typeof reqItem === 'object' && reqItem !== null
            ? (reqItem.requirement_id || reqItem.id || reqName)
            : reqName;

          return {
            service_id: `REQ-${reqId}`,
            requirement_name: String(reqName)
          };
        });
        setAvailableServices(reqServices);
      } else {
        setAvailableServices(selectedFac.services || []);
      }
    } else {
      setAvailableServices([]);
    }
  };

  const handleServiceCheckbox = (serviceId) => {
    setReferralForm((prev) => {
      const isAlreadySelected = prev.selected_services.includes(serviceId);
      return {
        ...prev,
        selected_services: isAlreadySelected
          ? prev.selected_services.filter((id) => id !== serviceId)
          : [...prev.selected_services, serviceId]
      };
    });
  };

  // Fetch Notes for selected request
  const fetchNotes = async (reqItem) => {
    try {
      const res = await fetch(`${API_BASE}/requests/${encodeURIComponent(reqItem.request_type)}/${reqItem.request_id}/notes`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setNotes([]);
    }
  };

  // Submit Excuse Slip Request
  const handleExcuseSubmit = async (e) => {
    e.preventDefault();
    if (!student_id) { showAlert('Student ID not found. Please log in again.', 'error'); return; }
    if (!excuseForm.reason_for_excuse.trim()) {
      showAlert('Add a reason.', 'warning');
      return;
    }
    if (!excuseForm.valid_absence_start || !excuseForm.valid_absence_end) {
      showAlert('Pick the absence dates.', 'warning');
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append('student_id', student_id);
    formData.append('reason_for_excuse', excuseForm.reason_for_excuse);
    formData.append('valid_absence_start', excuseForm.valid_absence_start);
    formData.append('valid_absence_end', excuseForm.valid_absence_end);
    if (excuseForm.proof) {
      formData.append('proof', excuseForm.proof);
    }

    try {
      const res = await fetch(`${API_BASE}/requests/excuse-slip`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setExcuseForm({ reason_for_excuse: '', valid_absence_start: '', valid_absence_end: '', proof: null });
        setActiveModal(null);
        fetchRequests();
        showAlert('Request submitted.', 'success');
      } else {
        showAlert('Could not submit. Try again.', 'error');
      }
    } catch (err) {
      console.error('Error submitting excuse request:', err);
      showAlert('Could not submit. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Submit Referral Slip Request
  const handleReferralSubmit = async (e) => {
    e.preventDefault();
    if (!student_id) { showAlert('Student ID not found. Please log in again.', 'error'); return; }
    if (!referralForm.reason_for_referral.trim()) {
      showAlert('Add a reason.', 'warning');
      return;
    }
    if (!referralForm.facility_id) {
      showAlert('Please select a facility.', 'warning');
      return;
    }
    if (referralForm.selected_services.length === 0) {
      showAlert('Please select at least one service requested from the facility.', 'warning');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/requests/referral-slip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id,
          reason_for_referral: referralForm.reason_for_referral,
          facility_id: referralForm.facility_id,
          service_ids: referralForm.selected_services
        })
      });
      if (res.ok) {
        setReferralForm({
          reason_for_referral: '',
          facility_id: '',
          selected_services: []
        });
        setAvailableServices([]);
        setActiveModal(null);
        fetchRequests();
        showAlert('Request submitted.', 'success');
      } else {
        showAlert('Could not submit. Try again.', 'error');
      }
    } catch (err) {
      console.error('Error submitting referral request:', err);
      showAlert('Could not submit. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (reqItem) => {
    setSelectedRequest(reqItem);
    setNotes([]);
    setActiveModal('view');
    fetchNotes(reqItem);
  };

  const handleSendNote = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRequest) return;

    try {
      const res = await fetch(`${API_BASE}/requests/${encodeURIComponent(selectedRequest.request_type)}/${selectedRequest.request_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_type: 'Student',
          sender_id: student_id,
          message: newMessage
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchNotes(selectedRequest);
      } else {
        showAlert('Message not sent. Try again.', 'error');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      showAlert('Message not sent. Try again.', 'error');
    }
  };

  const closeModal = () => setActiveModal(null);

  const pickProof = (file) => {
    if (file) setExcuseForm((prev) => ({ ...prev, proof: file }));
  };

  // Derived: counts, filtered list
  const safeRequests = useMemo(() => (Array.isArray(requests) ? requests : []), [requests]);
  const counts = useMemo(() => {
    const c = { all: safeRequests.length, waiting: 0, approved: 0, declined: 0 };
    safeRequests.forEach((r) => { c[statusKind(r.status)] += 1; });
    return c;
  }, [safeRequests]);
  const issuedCount = useMemo(() => safeRequests.filter((r) => r.issued_slip_url).length, [safeRequests]);

  const visibleRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return safeRequests.filter((r) => {
      if (statusFilter !== 'all' && statusKind(r.status) !== statusFilter) return false;
      if (typeFilter !== 'all' && r.request_type !== typeFilter) return false;
      if (q) {
        const hay = [r.request_id, r.reason_for_excuse, r.reason_for_referral, r.partner_facility_name]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [safeRequests, search, typeFilter, statusFilter]);

  const absenceDays = (() => {
    const { valid_absence_start: s, valid_absence_end: en } = excuseForm;
    if (!s || !en) return '';
    const n = Math.round((new Date(en) - new Date(s)) / 86400000) + 1;
    return Number.isFinite(n) && n > 0 ? `${n} ${n === 1 ? 'day' : 'days'}` : '';
  })();

  const modalFooter = (
    <div className="rq-sheet-foot">
      <button type="button" className="rq-btn rq-btn-ghost" onClick={closeModal}>Cancel</button>
      <button type="submit" className="rq-btn rq-btn-primary" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  );

  return (
    <div className="rq-page">
      <div className="rq-shell">
        <header className="rq-band">
          <div>
            <h1>Document Requests</h1>
            {firstName && <p>Welcome, {firstName} {lastName} ({student_id})</p>}
          </div>
          <ul className="rq-stats" aria-label="Request summary">
            <li className="rq-stat">
              <Clock className="rq-ico" aria-hidden="true" />
              <div><b>{counts.waiting}</b><span>Waiting</span></div>
            </li>
            <li className="rq-stat">
              <CircleCheck className="rq-ico" aria-hidden="true" />
              <div><b>{counts.approved}</b><span>Approved</span></div>
            </li>
            <li className="rq-stat">
              <FileText className="rq-ico" aria-hidden="true" />
              <div><b>{issuedCount}</b><span>Slips issued</span></div>
            </li>
          </ul>
        </header>

        {/* New request tiles */}
        <section className="rq-tiles" aria-label="New request">
          <button type="button" className="rq-tile" onClick={() => setActiveModal('excuse')}>
            <span className="rq-tile-icon" aria-hidden="true"><ClipboardList className="rq-ico" /></span>
            <span className="rq-tile-text">
              <span className="rq-tile-title">Excuse Slip</span>
              <span className="rq-tile-sub">Missed classes or activities</span>
            </span>
            <span className="rq-tile-go" aria-hidden="true"><Plus className="rq-ico" /></span>
          </button>
          <button type="button" className="rq-tile" onClick={() => setActiveModal('referral')}>
            <span className="rq-tile-icon" aria-hidden="true"><Building2 className="rq-ico" /></span>
            <span className="rq-tile-text">
              <span className="rq-tile-title">Referral Slip</span>
              <span className="rq-tile-sub">Medical or lab partner facility</span>
            </span>
            <span className="rq-tile-go" aria-hidden="true"><Plus className="rq-ico" /></span>
          </button>
        </section>

        {/* Request History */}
        <section className="rq-card" aria-labelledby="rq-history-title">
          <div className="rq-toolbar">
            <h2 id="rq-history-title">Request History</h2>
            <div className="rq-search">
              <Search className="rq-ico" aria-hidden="true" />
              <label className="rq-sr" htmlFor="rq-search">Search requests</label>
              <input
                id="rq-search"
                type="search"
                placeholder="Search"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="rq-sr" htmlFor="rq-type">Request type</label>
            <select id="rq-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="Excuse Slip">Excuse Slip</option>
              <option value="Referral Slip">Referral Slip</option>
            </select>
            <div className="rq-seg" role="group" aria-label="Status filter">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={statusFilter === f.key}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}<span className="rq-n">{counts[f.key]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rq-table-wrap">
            <table className="rq-table">
              <thead>
                <tr>
                  <th scope="col">Request ID</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="rq-col-details">Details</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="rq-sr">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((req) => {
                  const isExcuse = req.request_type === 'Excuse Slip';
                  return (
                    <tr key={req.request_id}>
                      <td className="rq-td-id">{req.request_id}</td>
                      <td className="rq-td-type">
                        <span className={`rq-pill ${isExcuse ? 'rq-pill-excuse' : 'rq-pill-referral'}`}>
                          {req.request_type}
                        </span>
                      </td>
                      <td className="rq-td-details">
                        <div className="rq-main-line">{isExcuse ? req.reason_for_excuse : req.reason_for_referral}</div>
                        <div className="rq-meta-line">
                          {isExcuse ? (
                            <>
                              <Calendar className="rq-ico" aria-hidden="true" />
                              {fmtDay(req.valid_absence_start)} to {fmtDay(req.valid_absence_end)}
                            </>
                          ) : (
                            <>
                              <Building2 className="rq-ico" aria-hidden="true" />
                              {req.partner_facility_name || 'N/A'}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="rq-td-date">{formatDate(new Date(req.created_at))}</td>
                      <td className="rq-td-status"><StatusPill status={req.status} /></td>
                      <td className="rq-td-action">
                        <button
                          type="button"
                          className="rq-btn rq-btn-icon"
                          onClick={() => handleViewDetails(req)}
                          title="View Details"
                          aria-label={`View details of ${req.request_id}`}
                        >
                          <Eye className="rq-ico" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleRequests.length === 0 && (
              <div className="rq-empty" role="status">No requests found.</div>
            )}
          </div>
        </section>
      </div>

      {/* Modal: Excuse Slip */}
      {activeModal === 'excuse' && (
        <Modal
          titleId="rq-excuse-title"
          size="lg"
          onClose={closeModal}
          onSubmit={handleExcuseSubmit}
          footer={modalFooter}
          title={<><ClipboardList className="rq-ico" aria-hidden="true" />Excuse Slip</>}
        >
          <div className="rq-sheet-body rq-two">
            <div>
              <div className="rq-group">
                <label htmlFor="rq-ex-reason">Reason</label>
                <textarea
                  id="rq-ex-reason"
                  data-autofocus
                  rows="5"
                  value={excuseForm.reason_for_excuse}
                  onChange={(e) => setExcuseForm({ ...excuseForm, reason_for_excuse: e.target.value })}
                  placeholder="Reason for absence"
                />
              </div>
              <div className="rq-row2">
                <div className="rq-group">
                  <label htmlFor="rq-ex-start">Start date</label>
                  <input
                    id="rq-ex-start"
                    type="date"
                    value={excuseForm.valid_absence_start}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setExcuseForm((prev) => ({
                        ...prev,
                        valid_absence_start: newStart,
                        valid_absence_end: prev.valid_absence_end && prev.valid_absence_end < newStart ? newStart : prev.valid_absence_end
                      }));
                    }}
                  />
                </div>
                <div className="rq-group">
                  <label htmlFor="rq-ex-end">End date</label>
                  <input
                    id="rq-ex-end"
                    type="date"
                    min={excuseForm.valid_absence_start}
                    value={excuseForm.valid_absence_end}
                    onChange={(e) => setExcuseForm({ ...excuseForm, valid_absence_end: e.target.value })}
                  />
                </div>
              </div>
              <div className="rq-hint" role="status">{absenceDays}</div>
            </div>

            <div className="rq-group">
              <span className="rq-label" id="rq-proof-label">Proof (optional)</span>
              {excuseForm.proof ? (
                <div className="rq-proof">
                  <div className="rq-proof-head">
                    <span>
                      <Paperclip className="rq-ico" aria-hidden="true" />
                      {excuseForm.proof.name} ({Math.max(1, Math.round(excuseForm.proof.size / 1024))} KB)
                    </span>
                    <button
                      type="button"
                      className="rq-btn rq-btn-icon"
                      onClick={() => setExcuseForm({ ...excuseForm, proof: null })}
                      aria-label="Remove file"
                      title="Remove file"
                    >
                      <X className="rq-ico" aria-hidden="true" />
                    </button>
                  </div>
                  {proofPreview && excuseForm.proof.type.startsWith('image/') && (
                    <div className="rq-proof-body">
                      <img src={proofPreview} alt="Proof preview" />
                    </div>
                  )}
                  {proofPreview && excuseForm.proof.type === 'application/pdf' && (
                    <div className="rq-proof-body">
                      <iframe src={proofPreview} title="PDF preview" />
                    </div>
                  )}
                </div>
              ) : (
                <label
                  className={`rq-drop ${dragOver ? 'is-over' : ''}`}
                  onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickProof(e.dataTransfer.files && e.dataTransfer.files[0]);
                  }}
                >
                  <Upload className="rq-ico" aria-hidden="true" />
                  <strong>Upload file</strong>
                  <small>Image or PDF</small>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    aria-labelledby="rq-proof-label"
                    onChange={(e) => pickProof(e.target.files[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Referral Slip */}
      {activeModal === 'referral' && (
        <Modal
          titleId="rq-referral-title"
          size="lg"
          onClose={closeModal}
          onSubmit={handleReferralSubmit}
          footer={modalFooter}
          title={<><Building2 className="rq-ico" aria-hidden="true" />Referral Slip</>}
        >
          <div className="rq-sheet-body rq-two rq-two-lean">
            <div>
              <div className="rq-group">
                <label htmlFor="rq-rf-reason">Reason</label>
                <textarea
                  id="rq-rf-reason"
                  data-autofocus
                  rows="5"
                  value={referralForm.reason_for_referral}
                  onChange={(e) => setReferralForm({ ...referralForm, reason_for_referral: e.target.value })}
                  placeholder="Reason for referral"
                />
              </div>
              <div className="rq-group">
                <label htmlFor="rq-rf-fac">Partner facility</label>
                <select id="rq-rf-fac" value={referralForm.facility_id} onChange={handleFacilityChange}>
                  <option value="" disabled>Select facility</option>
                  {partnerFacilities.map((facility) => (
                    <option key={facility.facility_id} value={facility.facility_id}>
                      {facility.facility_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rq-group">
              <div className="rq-svc-head">
                <span className="rq-label">Services</span>
                <span className="rq-chip" role="status">{referralForm.selected_services.length} selected</span>
              </div>
              <div className="rq-svc-grid">
                {availableServices.length === 0 ? (
                  <div className="rq-svc-empty">Select a facility.</div>
                ) : (
                  availableServices.map((service) => (
                    <label key={service.service_id} className="rq-svc">
                      <input
                        type="checkbox"
                        value={service.service_id}
                        checked={referralForm.selected_services.includes(service.service_id)}
                        onChange={() => handleServiceCheckbox(service.service_id)}
                      />
                      <span>
                        {service.requirement_name || service.service_name || service.name || 'Unnamed Service'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: View Details & Notes */}
      {activeModal === 'view' && selectedRequest && (
        <Modal
          titleId="rq-view-title"
          size="xl"
          onClose={closeModal}
          title={<>{selectedRequest.request_id} <StatusPill status={selectedRequest.status} /></>}
        >
          <div className="rq-sheet-body rq-two rq-two-lean">
            <div>
              <dl className="rq-facts">
                <div><dt>Type</dt><dd>{selectedRequest.request_type}</dd></div>
                <div><dt>Requested</dt><dd>{formatDateTime(new Date(selectedRequest.created_at))}</dd></div>
                {selectedRequest.request_type === 'Excuse Slip' ? (
                  <div>
                    <dt>Absence</dt>
                    <dd>{fmtDay(selectedRequest.valid_absence_start)} to {fmtDay(selectedRequest.valid_absence_end)}</dd>
                  </div>
                ) : (
                  <>
                    <div><dt>Facility</dt><dd>{selectedRequest.partner_facility_name || 'N/A'}</dd></div>
                    <div><dt>Services</dt><dd>{selectedRequest.requested_services || 'None Specified'}</dd></div>
                  </>
                )}
                <div className="rq-wide">
                  <dt>Reason</dt>
                  <dd>
                    {selectedRequest.request_type === 'Excuse Slip'
                      ? selectedRequest.reason_for_excuse
                      : selectedRequest.reason_for_referral}
                  </dd>
                </div>
              </dl>

              <div className="rq-links">
                {selectedRequest.request_type === 'Excuse Slip' && selectedRequest.student_proof_url && (
                  <a className="rq-link" href={getFileUrl(selectedRequest.student_proof_url)} target="_blank" rel="noreferrer">
                    <Paperclip className="rq-ico" aria-hidden="true" />Proof
                  </a>
                )}
                {selectedRequest.issued_slip_url ? (
                  <a className="rq-link" href={getFileUrl(selectedRequest.issued_slip_url)} target="_blank" rel="noreferrer">
                    <Download className="rq-ico" aria-hidden="true" />Issued slip
                  </a>
                ) : (
                  <span className="rq-link rq-link-off">
                    <FileText className="rq-ico" aria-hidden="true" />Slip not issued
                  </span>
                )}
              </div>
            </div>

            <section className="rq-chat" aria-labelledby="rq-chat-title">
              <h3 id="rq-chat-title">Messages</h3>
              <div className="rq-thread" ref={threadRef} role="log" aria-live="polite">
                {!Array.isArray(notes) || notes.length === 0 ? (
                  <p className="rq-thread-empty">No messages.</p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.note_id}
                      className={`rq-bubble ${n.sender_type === 'Student' ? 'rq-bubble-me' : 'rq-bubble-other'}`}
                    >
                      <div className="rq-bubble-who">
                        <strong>{n.sender_type}</strong> · {formatTime(new Date(n.created_at))}
                      </div>
                      <p className="rq-bubble-msg">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
              <form className="rq-compose" onSubmit={handleSendNote}>
                <label className="rq-sr" htmlFor="rq-note">Message</label>
                <input
                  id="rq-note"
                  data-autofocus
                  type="text"
                  placeholder="Message"
                  autoComplete="off"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="rq-btn rq-btn-primary" aria-label="Send" title="Send">
                  <Send className="rq-ico" aria-hidden="true" />
                </button>
              </form>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
