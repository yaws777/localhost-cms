import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ExternalLink,
  User 
} from 'lucide-react';
import '../../styles/parent/ChildClinicRecords.css';

const API_BASE = 'http://localhost:3001';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';

  let dateObj;
  if (typeof dateStr === 'string') {
    const normalizedStr = dateStr.replace(' ', 'T');
    dateObj = new Date(normalizedStr);
  } else {
    dateObj = new Date(dateStr);
  }

  if (isNaN(dateObj.getTime())) return 'N/A';

  return dateObj.toLocaleDateString();
};

const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};

export default function ChildClinicRecords() {
  const context = useOutletContext();

  const linkedStudents = useMemo(() => {
    if (context?.linkedStudents && Array.isArray(context.linkedStudents) && context.linkedStudents.length > 0) {
      return context.linkedStudents;
    }
    try {
      const stored = localStorage.getItem('linkedStudents');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Error parsing linkedStudents from localStorage:", e);
      return [];
    }
  }, [context?.linkedStudents]);

  const [activeTab, setActiveTab] = useState('document-requests');
  const [selectedStudentId, setSelectedStudentId] = useState('ALL');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchLogs = useCallback(async (
    overrideStartDate = startDate, 
    overrideEndDate = endDate, 
    overrideStudentFilter = selectedStudentId
  ) => {
    let idsToFetch = [];
    if (overrideStudentFilter === 'ALL') {
      idsToFetch = linkedStudents.map(st => st.student_id);
    } else if (overrideStudentFilter) {
      idsToFetch = [overrideStudentFilter];
    }

    if (idsToFetch.length === 0) {
      setRecords([]);
      return;
    }

    setLoading(true);
    try {
      let endpoint = `${activeTab}/clinicLogs&Records`;
      if (activeTab === 'document-requests' || activeTab === 'student-requirements') {
        endpoint = `${activeTab}/childClinicRecords`;
      }

      const fetchPromises = idsToFetch.map(async (sId) => {
        let url = `${API_BASE}/${endpoint}?studentId=${encodeURIComponent(sId)}`;
        if (overrideStartDate && overrideEndDate) {
          url += `&startDate=${overrideStartDate}&endDate=${overrideEndDate}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      });

      const results = await Promise.all(fetchPromises);
      const combinedRecords = results.flat();

      setRecords(combinedRecords);
    } catch (error) {
      console.error('Error fetching records:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, linkedStudents, startDate, endDate, selectedStudentId]);

  useEffect(() => {
    if (linkedStudents.length > 0) {
      fetchLogs();
    }
  }, [activeTab, selectedStudentId, linkedStudents, fetchLogs]);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    setSelectedStudentId('ALL');
    fetchLogs('', '', 'ALL');
  };

  return (
    <div className="container-ccr">
      <header className="header-ccr">
        <div className="header-title-ccr">
          <h1>Child Clinic Records & Requests</h1>
          <p>STI Campus Health Services Student Portal</p>
        </div>
      </header>

      <div className="control-panel-ccr">
        <form className="filter-bar-ccr" onSubmit={handleFilter}>
          <div className="input-group-ccr">
            <label className="label-ccr"><User size={14} /> Student:</label>
            <select 
              value={selectedStudentId} 
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="select-ccr"
            >
              <option value="ALL">All Linked Students</option>
              {linkedStudents.map((st) => (
                <option key={st.student_id} value={st.student_id}>
                  {st.first_name ? `${st.first_name} ${st.last_name} (${st.student_id})` : st.student_id}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group-ccr">
            <label className="label-ccr"><Calendar size={14} /> From:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="input-date-ccr"
            />
          </div>
          <div className="input-group-ccr">
            <label className="label-ccr"><Calendar size={14} /> To:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="input-date-ccr"
            />
          </div>
          <button type="submit" className="btn-ccr btn-primary-ccr">
            <Filter size={16} /> Filter
          </button>
          <button type="button" onClick={clearFilter} className="btn-ccr btn-secondary-ccr">
            Clear
          </button>
        </form>

        <nav className="tabs-ccr">
          <button 
            className={`tab-ccr ${activeTab === 'document-requests' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('document-requests')}
          >
            <FileText size={16} /> Document Requests
          </button>
          <button 
            className={`tab-ccr ${activeTab === 'student-requirements' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('student-requirements')}
          >
            <CheckSquare size={16} /> Student Requirements
          </button>
          <button 
            className={`tab-ccr ${activeTab === 'clinic-visits' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('clinic-visits')}
          >
            <ClipboardList size={16} /> Clinic Visits
          </button>
          <button 
            className={`tab-ccr ${activeTab === 'medicine-dispensed' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('medicine-dispensed')}
          >
            <Pill size={16} /> Medicine Dispensed
          </button>
          <button 
            className={`tab-ccr ${activeTab === 'incident-reports' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('incident-reports')}
          >
            <AlertTriangle size={16} /> Incident Reports
          </button>
          <button 
            className={`tab-ccr ${activeTab === 'health-screenings' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('health-screenings')}
          >
            <Activity size={16} /> Health Screening
          </button>
          <button 
            className={`tab-ccr ${activeTab === 'doctor-visits' ? 'active-ccr' : ''}`}
            onClick={() => setActiveTab('doctor-visits')}
          >
            <Stethoscope size={16} /> Doctor Visits
          </button>
        </nav>
      </div>

      <main className="content-ccr">
        {loading ? (
          <div className="loading-ccr">Loading student records...</div>
        ) : (
          <div className="table-wrapper-ccr">
            <table className="table-ccr">
              <thead>
                {renderTableHeader(activeTab)}
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((item, index) => renderTableRow(activeTab, item, index, () => setSelectedRecord(item)))
                ) : (
                  <tr>
                    <td colSpan="10" className="no-data-ccr">
                      No records found for Student: {selectedStudentId === 'ALL' ? 'All Linked Students' : selectedStudentId}.
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
          <th>Nurse Name</th>
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
          <th>Brand Name</th>
          <th>Generic Name</th>
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
          <th>Nurse Name</th>
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
          <th>Doctor Name</th>
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
          <td><span className="badge-ccr tag-doc-ccr">{item.document_type}</span></td>
          <td>{item.student_id}</td>
          <td className="truncate-ccr">{item.reason || 'N/A'}</td>
          <td>{formatDate(createdDate)}</td>
          <td><span className={`badge-ccr status-${statusClass}-ccr`}>{item.status}</span></td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
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
          <td>{item.requirement_name || 'Health Requirement'}</td>
          <td>{item.student_id}</td>
          <td>{formatDate(submittedDate)}</td>
          <td>
            <span className={`badge-ccr status-${reqStatusClass}-ccr`}>
              {currentStatus}
            </span>
          </td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );
    }

    case 'clinic-visits': {
      const nurseName = item.nurse_first_name && item.nurse_last_name
        ? `${item.nurse_first_name} ${item.nurse_last_name}`
        : item.nurse_id || 'N/A';

      return (
        <tr key={item.visit_id || index}>
          <td><strong>{item.visit_id}</strong></td>
          <td>{item.student_id}</td>
          <td>{nurseName}</td>
          <td>{formatDate(item.visit_date)}</td>
          <td>{item.time_in} - {item.time_out || 'N/A'}</td>
          <td>BP: {item.blood_pressure || 'N/A'} | Temp: {item.temperature || 'N/A'}°C</td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );
    }

    case 'medicine-dispensed':
      return (
        <tr key={item.id || index}>
          <td><strong>{item.id}</strong></td>
          <td>
            <span className={`badge-ccr ${item.dispensation_type === 'Direct Dispensation' ? 'tag-direct-ccr' : 'tag-consult-ccr'}`}>
              {item.dispensation_type}
            </span>
          </td>
          <td>{item.student_id || 'N/A'}</td>
          <td>{item.brand_name || 'N/A'}</td>
          <td>{item.generic_name || 'N/A'}</td>
          <td>{item.quantity_dispensed}</td>
          <td>{item.dispensed_at ? new Date(item.dispensed_at).toLocaleString() : 'N/A'}</td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'incident-reports': {
      const nurseName = item.nurse_first_name && item.nurse_last_name
        ? `${item.nurse_first_name} ${item.nurse_last_name}`
        : item.nurse_id || 'N/A';

      return (
        <tr key={item.incident_id || index}>
          <td><strong>{item.incident_id}</strong></td>
          <td>{item.student_id}</td>
          <td>{nurseName}</td>
          <td>{item.incident_location}</td>
          <td>{item.incident_datetime ? new Date(item.incident_datetime).toLocaleString() : 'N/A'}</td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );
    }

    case 'health-screenings':
      return (
        <tr key={item.record_id || index}>
          <td><strong>{item.record_id}</strong></td>
          <td><span className="badge-ccr tag-screening-ccr">{item.screening_type}</span></td>
          <td>{item.student_id}</td>
          <td>{formatDate(item.record_date)}</td>
          <td><span className={`badge-ccr status-${statusClass}-ccr`}>{item.status}</span></td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'doctor-visits': {
      const doctorName = item.doctor_first_name && item.doctor_last_name
        ? `${item.doctor_first_name} ${item.doctor_last_name}`
        : item.doctor_id || 'N/A';

      return (
        <tr key={item.appointment_id || index}>
          <td><strong>{item.appointment_id}</strong></td>
          <td>{item.student_id}</td>
          <td>{doctorName}</td>
          <td>
            {item.start_time ? new Date(item.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''} - 
            {item.end_time ? new Date(item.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
          </td>
          <td><span className={`badge-ccr status-${statusClass}-ccr`}>{item.status}</span></td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );
    }

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
    <div className="modal-overlay-ccr">
      <div className="modal-content-ccr">
        <div className="modal-header-ccr">
          <h3>Record Details</h3>
          <button className="modal-close-ccr" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body-ccr">
          {Object.entries(record).map(([key, value]) => {
            if (value === null || value === undefined || value === '') {
              return (
                <div className="modal-field-ccr" key={key}>
                  <span className="field-key-ccr">{key.replace(/_/g, ' ')}:</span>
                  <span className="field-value-ccr">N/A</span>
                </div>
              );
            }

            if (isFileKey(key, value)) {
              const fullFileUrl = getFileUrl(value);
              const isImg = isImageFile(value);

              return (
                <div className="modal-field-ccr modal-field-file-ccr" key={key}>
                  <span className="field-key-ccr">{key.replace(/_/g, ' ')}:</span>
                  <div className="field-value-ccr file-container-ccr">
                    <a 
                      href={fullFileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn-ccr btn-primary-ccr file-link-ccr"
                    >
                      <ExternalLink size={16} /> View Document / Attachment
                    </a>

                    {isImg && (
                      <div className="image-preview-ccr">
                        <img 
                          src={fullFileUrl} 
                          alt="Attachment Preview" 
                          className="image-preview-img-ccr"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="modal-field-ccr" key={key}>
                <span className="field-key-ccr">{key.replace(/_/g, ' ')}:</span>
                <span className="field-value-ccr">
                  {typeof value === 'string' && (value.includes('T00:00') || /^\d{4}-\d{2}-\d{2}/.test(value)) 
                    ? formatDate(value) 
                    : String(value)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="modal-footer-ccr">
          <button className="btn-ccr btn-secondary-ccr" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}