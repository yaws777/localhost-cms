import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  FileText, 
  CheckSquare, 
  ClipboardList, 
  Pill, 
  AlertTriangle, 
  Activity, 
  Stethoscope, 
  Calendar, 
  Eye, 
  X, 
  Filter,
  ExternalLink 
} from 'lucide-react';
import '../../styles/parent/ChildClinicRecords.css';

const API_BASE = 'http://localhost:3001';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';

  // Normalize string formats (e.g. convert MySQL "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:MM:SS")
  let dateObj;
  if (typeof dateStr === 'string') {
    const normalizedStr = dateStr.replace(' ', 'T');
    dateObj = new Date(normalizedStr);
  } else {
    dateObj = new Date(dateStr);
  }

  // Fallback if Date conversion yields NaN
  if (isNaN(dateObj.getTime())) return 'N/A';

  return dateObj.toLocaleDateString();
};

// Helper to resolve full URL for local or external file paths
const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};


export default function ChildClinicRecords() {
  const context = useOutletContext();
  const studentId = context?.selectedChildId || context?.studentId;

  const [activeTab, setActiveTab] = useState('document-requests');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchLogs = useCallback(async (overrideStartDate = startDate, overrideEndDate = endDate) => {
    if (!studentId) return;

    setLoading(true);
    try {
      let endpoint = `${activeTab}/clinicLogs&Records`;
      if (activeTab === 'document-requests' || activeTab === 'student-requirements') {
        endpoint = `${activeTab}/childClinicRecords`;
      }

      let url = `${API_BASE}/${endpoint}?studentId=${encodeURIComponent(studentId)}`;
      
      if (overrideStartDate && overrideEndDate) {
        url += `&startDate=${overrideStartDate}&endDate=${overrideEndDate}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching records:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, activeTab, startDate, endDate]);

  useEffect(() => {
    if (studentId) {
      fetchLogs();
    }
  }, [studentId, activeTab, fetchLogs]);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    fetchLogs('', '');
  };

  return (
    <div className="ccr-container">
      <header className="ccr-header">
        <div className="ccr-header-title">
          <h1>Child Clinic Records & Requests</h1>
          <p>STI Campus Health Services Student Portal</p>
        </div>
      </header>

      <div className="ccr-control-panel">
        <form className="ccr-filter-bar" onSubmit={handleFilter}>
          <div className="ccr-input-group">
            <label><Calendar size={14} /> From:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div className="ccr-input-group">
            <label><Calendar size={14} /> To:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          <button type="submit" className="ccr-btn ccr-btn-primary">
            <Filter size={16} /> Filter
          </button>
          <button type="button" onClick={clearFilter} className="ccr-btn ccr-btn-secondary">
            Clear
          </button>
        </form>

        <nav className="ccr-tabs">
          <button 
            className={`ccr-tab ${activeTab === 'document-requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('document-requests')}
          >
            <FileText size={18} /> Document Requests
          </button>
          <button 
            className={`ccr-tab ${activeTab === 'student-requirements' ? 'active' : ''}`}
            onClick={() => setActiveTab('student-requirements')}
          >
            <CheckSquare size={18} /> Student Requirements
          </button>
          <button 
            className={`ccr-tab ${activeTab === 'clinic-visits' ? 'active' : ''}`}
            onClick={() => setActiveTab('clinic-visits')}
          >
            <ClipboardList size={18} /> Clinic Visits
          </button>
          <button 
            className={`ccr-tab ${activeTab === 'medicine-dispensed' ? 'active' : ''}`}
            onClick={() => setActiveTab('medicine-dispensed')}
          >
            <Pill size={18} /> Medicine Dispensed
          </button>
          <button 
            className={`ccr-tab ${activeTab === 'incident-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('incident-reports')}
          >
            <AlertTriangle size={18} /> Incident Reports
          </button>
          <button 
            className={`ccr-tab ${activeTab === 'health-screenings' ? 'active' : ''}`}
            onClick={() => setActiveTab('health-screenings')}
          >
            <Activity size={18} /> Health Screening
          </button>
          <button 
            className={`ccr-tab ${activeTab === 'doctor-visits' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctor-visits')}
          >
            <Stethoscope size={18} /> Doctor Visits
          </button>
        </nav>
      </div>

      <main className="ccr-content">
        {loading ? (
          <div className="ccr-loading">Loading student records...</div>
        ) : (
          <div className="ccr-table-wrapper">
            <table className="ccr-table">
              <thead>
                {renderTableHeader(activeTab)}
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((item, index) => renderTableRow(activeTab, item, index, () => setSelectedRecord(item)))
                ) : (
                  <tr>
                    <td colSpan="10" className="ccr-no-data">
                      No records found for Student ID: {studentId || 'N/A'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedRecord && (
        <Modal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}

function renderTableHeader(tab) {
  switch (tab) {
    case 'document-requests':
      return (
        <tr>
          <th>Request ID</th>
          <th>Type</th>
          <th>Student ID</th>
          <th>Reason</th>
          <th>Date Created</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      );
    case 'student-requirements':
      return (
        <tr>
          <th>Req ID</th>
          <th>Requirement Title</th>
          <th>Student ID</th>
          <th>Submitted Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      );
    case 'clinic-visits':
      return (
        <tr>
          <th>Visit ID</th>
          <th>Student ID</th>
          <th>Nurse ID</th>
          <th>Date</th>
          <th>Time In / Out</th>
          <th>Vital Signs</th>
          <th>Action</th>
        </tr>
      );
    case 'medicine-dispensed':
      return (
        <tr>
          <th>Dispense ID</th>
          <th>Type</th>
          <th>Student ID</th>
          <th>Batch ID</th>
          <th>Qty</th>
          <th>Date & Time</th>
          <th>Action</th>
        </tr>
      );
    case 'incident-reports':
      return (
        <tr>
          <th>Incident ID</th>
          <th>Student ID</th>
          <th>Nurse ID</th>
          <th>Location</th>
          <th>Date & Time</th>
          <th>Action</th>
        </tr>
      );
    case 'health-screenings':
      return (
        <tr>
          <th>Record ID</th>
          <th>Type</th>
          <th>Student ID</th>
          <th>Schedule ID</th>
          <th>Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      );
    case 'doctor-visits':
      return (
        <tr>
          <th>Appointment ID</th>
          <th>Student ID</th>
          <th>Doctor ID</th>
          <th>Schedule Window</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      );
    default:
      return null;
  }
}

function renderTableRow(tab, item, index, onViewDetails) {
  const statusClass = (item.status || 'pending').toLowerCase().replace(/\s+/g, '-');

  switch (tab) {
    case 'document-requests': {
      const createdDate = item.created_at || item.date_created || item.createdAt || item.request_date;
      return (
        <tr key={item.request_id || index}>
          <td><strong>{item.request_id}</strong></td>
          <td><span className="ccr-badge tag-doc">{item.document_type}</span></td>
          <td>{item.student_id}</td>
          <td className="ccr-truncate">{item.reason || 'N/A'}</td>
          <td>{formatDate(createdDate)}</td>
          <td><span className={`ccr-badge status-${statusClass}`}>{item.status}</span></td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );
    }

    case 'student-requirements': {
      const currentStatus = item.status || 'Not Submitted';
      const reqStatusClass = currentStatus.toLowerCase().trim().replace(/\s+/g, '-');
      const submittedDate = item.submitted_at || item.date_submitted || item.submitted_date || item.submittedAt;

      return (
        <tr key={item.submission_id || index}>
          <td><strong>{item.submission_id || `SUB-${index + 1}`}</strong></td>
          <td>{item.requirement_name || 'Health Requirement'}</td>
          <td>{item.student_id}</td>
          <td>{formatDate(submittedDate)}</td>
          <td>
            <span className={`ccr-badge status-${reqStatusClass}`}>
              {currentStatus}
            </span>
          </td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );
    }

    case 'clinic-visits':
      return (
        <tr key={item.visit_id || index}>
          <td><strong>{item.visit_id}</strong></td>
          <td>{item.student_id}</td>
          <td>{item.nurse_id}</td>
          <td>{formatDate(item.visit_date)}</td>
          <td>{item.time_in} - {item.time_out || 'N/A'}</td>
          <td>BP: {item.blood_pressure || 'N/A'} | Temp: {item.temperature || 'N/A'}°C</td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );

    case 'medicine-dispensed':
      return (
        <tr key={item.id || index}>
          <td><strong>{item.id}</strong></td>
          <td>
            <span className={`ccr-badge ${item.dispensation_type === 'Direct Dispensation' ? 'tag-direct' : 'tag-consult'}`}>
              {item.dispensation_type}
            </span>
          </td>
          <td>{item.student_id || 'N/A'}</td>
          <td>{item.batch_id}</td>
          <td>{item.quantity_dispensed}</td>
          <td>{item.dispensed_at ? new Date(item.dispensed_at).toLocaleString() : 'N/A'}</td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );

    case 'incident-reports':
      return (
        <tr key={item.incident_id || index}>
          <td><strong>{item.incident_id}</strong></td>
          <td>{item.student_id}</td>
          <td>{item.nurse_id}</td>
          <td>{item.incident_location}</td>
          <td>{item.incident_datetime ? new Date(item.incident_datetime).toLocaleString() : 'N/A'}</td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );

    case 'health-screenings':
      return (
        <tr key={item.record_id || index}>
          <td><strong>{item.record_id}</strong></td>
          <td><span className="ccr-badge tag-screening">{item.screening_type}</span></td>
          <td>{item.student_id}</td>
          <td>{item.screening_schedule_id || 'N/A'}</td>
          <td>{formatDate(item.record_date)}</td>
          <td><span className={`ccr-badge status-${statusClass}`}>{item.status}</span></td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );

    case 'doctor-visits':
      return (
        <tr key={item.appointment_id || index}>
          <td><strong>{item.appointment_id}</strong></td>
          <td>{item.student_id}</td>
          <td>{item.doctor_id}</td>
          <td>
            {item.start_time ? new Date(item.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''} - 
            {item.end_time ? new Date(item.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
          </td>
          <td><span className={`ccr-badge status-${statusClass}`}>{item.status}</span></td>
          <td>
            <button className="ccr-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );

    default:
      return null;
  }
}

function Modal({ record, onClose }) {
  const isFileKey = (key, value) => {
    if (typeof value !== 'string') return false;
    const k = key.toLowerCase();
    const v = value.toLowerCase();

    if (k.includes('type') || k.includes('name') || k.includes('status') || k.includes('title') || k.includes('reason')) {
      return false;
    }

    const fileKeywords = ['file', 'attachment', 'doc_path', 'document_path', 'path', 'upload', 'proof', 'url', 'link', 'cert'];
    const matchesKeyword = fileKeywords.some(keyword => k.includes(keyword));
    const hasFileExtension = /\.(pdf|png|jpg|jpeg|gif|webp|doc|docx)$/i.test(v);
    const isPathOrUrl = v.startsWith('http://') || v.startsWith('https://') || v.includes('/uploads/') || v.includes('uploads\\');

    return matchesKeyword || hasFileExtension || isPathOrUrl;
  };

  const isImageFile = (path) => /\.(jpeg|jpg|png|gif|webp)$/i.test(path);

  return (
    <div className="ccr-modal-overlay">
      <div className="ccr-modal-content">
        <div className="ccr-modal-header">
          <h3>Record Details</h3>
          <button className="ccr-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="ccr-modal-body">
          {Object.entries(record).map(([key, value]) => {
            if (value === null || value === undefined || value === '') {
              return (
                <div className="ccr-modal-field" key={key}>
                  <span className="field-key">{key.replace(/_/g, ' ')}:</span>
                  <span className="field-value">N/A</span>
                </div>
              );
            }

            if (isFileKey(key, value)) {
              const fullFileUrl = getFileUrl(value);
              const isImg = isImageFile(value);

              return (
                <div className="ccr-modal-field ccr-modal-field-file" key={key}>
                  <span className="field-key">{key.replace(/_/g, ' ')}:</span>
                  <div className="field-value ccr-file-container" style={{ marginTop: '4px' }}>
                    <a 
                      href={fullFileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="ccr-btn ccr-btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <ExternalLink size={16} /> View Document / Attachment
                    </a>

                    {isImg && (
                      <div className="ccr-image-preview" style={{ marginTop: '10px' }}>
                        <img 
                          src={fullFileUrl} 
                          alt="Attachment Preview" 
                          style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="ccr-modal-field" key={key}>
                <span className="field-key">{key.replace(/_/g, ' ')}:</span>
                <span className="field-value">
                  {typeof value === 'string' && (value.includes('T00:00') || /^\d{4}-\d{2}-\d{2}/.test(value)) 
                    ? formatDate(value) 
                    : String(value)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="ccr-modal-footer">
          <button className="ccr-btn ccr-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}