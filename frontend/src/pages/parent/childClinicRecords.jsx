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
  User,
  FileDown,
  RotateCcw
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { exportClinicRecords, exportClinicRecord } from '../../utils/clinicRecordExport';
import { formatTime, formatDate as formatDateBase, formatDateTime } from '../../utils/datetime';
import { ClinicVisitForm, DispensedForm, IncidentForm, DoctorVisitDetail, ScreeningDetail, VisitStatus, ScreeningStatus, visitDoctor, visitTitle } from '../../components/common/ClinicRecordViews';
import '../../styles/parent/ChildClinicRecords.css';

const API_BASE = 'https://localhost-cms.onrender.com';

// divider: the first two tabs are requests, the rest are clinic records
const TABS = [
  { key: 'document-requests', label: 'Documents', Icon: FileText },
  { key: 'student-requirements', label: 'Requirements', Icon: CheckSquare, divider: true },
  { key: 'clinic-visits', label: 'Visits', Icon: ClipboardList },
  { key: 'medicine-dispensed', label: 'Medicine', Icon: Pill },
  { key: 'incident-reports', label: 'Incidents', Icon: AlertTriangle },
  { key: 'health-screenings', label: 'Screening', Icon: Activity },
  { key: 'doctor-visits', label: 'Doctor', Icon: Stethoscope }
];

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

  return formatDateBase(dateObj);
};

const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};

const formatKeyLabel = (key) => {
  if (!key) return '';
  // Convert camelCase to spaced words (e.g. specifyComplaintText -> specify Complaint Text)
  const decameled = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  const normalized = decameled.toLowerCase().replace(/_/g, ' ').trim();

  // Match all variations of medical condition/complaint field keys
  if (
    normalized === 'complaint' || 
    normalized === 'chief complaint' || 
    normalized === 'complaint id' ||
    normalized === 'complaint name' ||
    normalized === 'complaint text' ||
    normalized === 'complaint type'
  ) {
    return 'Medical Condition';
  }

  if (
    normalized === 'specify complaint' || 
    normalized === 'specified complaint' || 
    normalized === 'specify complaint text' ||
    normalized === 'specify complaint other' ||
    normalized === 'specified complaint text'
  ) {
    return 'Specify Medical Condition';
  }

  // Capitalize each word properly for fallbacks
  return decameled
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ChildClinicRecords() {
  const context = useOutletContext();
  const { showAlert } = useAlert();

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

  const onBlocked = () => showAlert('Allow popups to preview the PDF.', 'warning');

  const studentName = (st) => (st.first_name ? `${st.first_name} ${st.last_name} (${st.student_id})` : st.student_id);
  const studentLabelOf = (id) => {
    const st = linkedStudents.find((s) => s.student_id === id);
    return st ? studentName(st) : id;
  };
  const exportLabel = selectedStudentId === 'ALL'
    ? `All Linked Students (${linkedStudents.map((s) => s.student_id).join(', ')})`
    : studentLabelOf(selectedStudentId);

  const studentCell = (id) => {
    const index = linkedStudents.findIndex((s) => s.student_id === id);
    const st = index >= 0 ? linkedStudents[index] : null;
    const name = st && st.first_name ? `${st.first_name} ${st.last_name}` : id;
    return (
      <span className="who-ccr">
        <span className={`av-ccr ${index % 2 === 1 ? 'av-b-ccr' : 'av-a-ccr'}`} aria-hidden="true">{(name || '?').charAt(0)}</span>
        <span><b>{name}</b><span className="sub-ccr">{id}</span></span>
      </span>
    );
  };

  const handleExport = () => {
    if (records.length === 0) {
      showAlert('No records to export.', 'warning');
      return;
    }
    exportClinicRecords({ tab: activeTab, records, studentLabel: exportLabel, range: { startDate, endDate }, onBlocked });
  };

  return (
    <div className="container-ccr">
      <header className="header-ccr">
        <div className="header-title-ccr">
          <h1>Child Clinic Records & Requests</h1>
          <p>STI Campus Health Services</p>
        </div>
        <span className="chip-ccr"><User size={18} aria-hidden="true" />{linkedStudents.length} linked</span>
      </header>

      <div className="control-panel-ccr">
        <div className="kids-ccr" role="group" aria-label="Student">
          <button
            type="button"
            className={`kid-ccr ${selectedStudentId === 'ALL' ? 'on-ccr' : ''}`}
            aria-pressed={selectedStudentId === 'ALL'}
            onClick={() => setSelectedStudentId('ALL')}
          >
            <span className="av-ccr av-all-ccr" aria-hidden="true">All</span>All students
          </button>
          {linkedStudents.map((st, i) => (
            <button
              key={st.student_id}
              type="button"
              className={`kid-ccr ${selectedStudentId === st.student_id ? 'on-ccr' : ''}`}
              aria-pressed={selectedStudentId === st.student_id}
              onClick={() => setSelectedStudentId(st.student_id)}
            >
              <span className={`av-ccr ${i % 2 === 1 ? 'av-b-ccr' : 'av-a-ccr'}`} aria-hidden="true">
                {(st.first_name || st.student_id).charAt(0)}
              </span>
              <span>
                {st.first_name ? `${st.first_name} ${st.last_name}` : st.student_id}
                {st.first_name && <span className="sub-ccr">{st.student_id}</span>}
              </span>
            </button>
          ))}
        </div>

        <form className="filter-bar-ccr" onSubmit={handleFilter}>
          <div className="input-group-ccr">
            <label className="label-ccr" htmlFor="ccr-from"><Calendar size={14} aria-hidden="true" /> From</label>
            <input
              id="ccr-from"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-date-ccr"
            />
          </div>
          <div className="input-group-ccr">
            <label className="label-ccr" htmlFor="ccr-to"><Calendar size={14} aria-hidden="true" /> To</label>
            <input
              id="ccr-to"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-date-ccr"
            />
          </div>
          <button type="submit" className="btn-ccr btn-primary-ccr" aria-label="Filter" title="Filter">
            <Filter size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={clearFilter} className="btn-ccr btn-secondary-ccr" aria-label="Clear filter" title="Clear filter">
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <span className="found-ccr" role="status">{loading ? '' : `${records.length} records`}</span>
          <button
            type="button"
            onClick={handleExport}
            className="btn-ccr btn-secondary-ccr btn-export-ccr"
            aria-label="Export PDF"
            title="Export PDF"
          >
            <FileDown size={18} aria-hidden="true" />
          </button>
        </form>

        <nav className="tabs-ccr" aria-label="Record type">
          {TABS.map(({ key, label, Icon, divider }) => (
            <React.Fragment key={key}>
              {divider && <span className="tab-div-ccr" aria-hidden="true" />}
              <button
                type="button"
                className={`tab-ccr ${activeTab === key ? 'active-ccr' : ''}`}
                aria-pressed={activeTab === key}
                onClick={() => setActiveTab(key)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="tab-label-ccr">{label}</span>
                {activeTab === key && !loading && <span className="tab-count-ccr">{records.length}</span>}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="content-ccr">
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
                  records.map((item, index) => renderTableRow(activeTab, item, index, () => setSelectedRecord(item), studentCell))
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
      </div>

      {selectedRecord && (
        <Modal
          tab={activeTab}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onExport={() => exportClinicRecord({ tab: activeTab, record: selectedRecord, studentLabel: studentLabelOf(selectedRecord.student_id), onBlocked })}
        />
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
          <th>Student</th>
          <th>Reason</th>
          <th>Date Created</th>
          <th>Status</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    case 'student-requirements':
      return (
        <tr>
          <th>Requirement Title</th>
          <th>Student</th>
          <th>Submitted Date</th>
          <th>Status</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    case 'clinic-visits':
      return (
        <tr>
          <th>Visit ID</th>
          <th>Student</th>
          <th>Nurse Name</th>
          <th>Date</th>
          <th>Time In / Out</th>
          <th>Vital Signs</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    case 'medicine-dispensed':
      return (
        <tr>
          <th>Dispense ID</th>
          <th>Type</th>
          <th>Student</th>
          <th>Brand Name</th>
          <th>Generic Name</th>
          <th>Qty</th>
          <th>Date & Time</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    case 'incident-reports':
      return (
        <tr>
          <th>Incident ID</th>
          <th>Student</th>
          <th>Nurse Name</th>
          <th>Location</th>
          <th>Date & Time</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    case 'health-screenings':
      return (
        <tr>
          <th>Record ID</th>
          <th>Type</th>
          <th>Student</th>
          <th>Date</th>
          <th>Status</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    case 'doctor-visits':
      return (
        <tr>
          <th>Date</th>
          <th>Student</th>
          <th>Check-up</th>
          <th>Doctor Name</th>
          <th>Number</th>
          <th>Status</th>
          <th>Assessment</th>
          <th><span className="sr-only-ccr">Action</span></th>
        </tr>
      );
    default:
      return null;
  }
}

function renderTableRow(tab, item, index, onViewDetails, studentCell) {
  const statusClass = (item.status || 'pending').toLowerCase().replace(/\s+/g, '-');

  switch (tab) {
    case 'document-requests': {
      const createdDate = item.created_at || item.date_created || item.createdAt || item.request_date;
      return (
        <tr key={item.request_id || index}>
          <td><strong>{item.request_id}</strong></td>
          <td><span className="badge-ccr tag-doc-ccr">{item.document_type}</span></td>
          <td>{studentCell(item.student_id)}</td>
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
          <td>{studentCell(item.student_id)}</td>
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
          <td>{studentCell(item.student_id)}</td>
          <td>{nurseName}</td>
          <td>{formatDate(item.visit_date)}</td>
          <td>{formatTime(item.time_in)} - {item.time_out ? formatTime(item.time_out) : 'N/A'}</td>
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
          <td>{studentCell(item.student_id)}</td>
          <td>{item.brand_name || 'N/A'}</td>
          <td>{item.generic_name || 'N/A'}</td>
          <td>{item.quantity_dispensed}</td>
          <td>{item.dispensed_at ? formatDateTime(new Date(item.dispensed_at)) : 'N/A'}</td>
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
          <td>{studentCell(item.student_id)}</td>
          <td>{nurseName}</td>
          <td>{item.incident_location}</td>
          <td>{item.incident_datetime ? formatDateTime(new Date(item.incident_datetime)) : 'N/A'}</td>
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
          <td>{studentCell(item.student_id)}</td>
          <td>{formatDate(item.record_date)}</td>
          <td><ScreeningStatus item={item} /></td>
          <td>
            <button className="btn-icon-ccr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'doctor-visits': {
      return (
        <tr key={item.appointment_id || index}>
          <td>{formatDate(item.start_time)}</td>
          <td>{studentCell(item.student_id)}</td>
          <td><strong>{visitTitle(item)}</strong></td>
          <td>{visitDoctor(item)}</td>
          <td>{item.queue_label || '-'}</td>
          <td><VisitStatus item={item} /></td>
          <td>{item.documented ? (item.diagnosis || 'Documented') : '-'}</td>
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

function Modal({ tab, record, onClose, onExport }) {
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
      <div className="modal-content-ccr" role="dialog" aria-modal="true" aria-labelledby="record-title-ccr">
        <div className="modal-header-ccr">
          <h3 id="record-title-ccr">Record Details</h3>
          <button type="button" className="modal-close-ccr" onClick={onClose} aria-label="Close" title="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body-ccr">
          {tab === 'clinic-visits' ? <ClinicVisitForm record={record} /> : tab === 'medicine-dispensed' ? <DispensedForm record={record} /> : tab === 'incident-reports' ? <IncidentForm record={record} /> : tab === 'doctor-visits' ? <DoctorVisitDetail record={record} /> : tab === 'health-screenings' ? <ScreeningDetail record={record} /> : Object.entries(record).map(([key, value]) => {
            if (value === null || value === undefined || value === '') {
              return (
                <div className="modal-field-ccr" key={key}>
                  <span className="field-key-ccr">{formatKeyLabel(key)}:</span>
                  <span className="field-value-ccr">N/A</span>
                </div>
              );
            }

            if (isFileKey(key, value)) {
              const fullFileUrl = getFileUrl(value);
              const isImg = isImageFile(value);

              return (
                <div className="modal-field-ccr modal-field-file-ccr" key={key}>
                  <span className="field-key-ccr">{formatKeyLabel(key)}:</span>
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
                <span className="field-key-ccr">{formatKeyLabel(key)}:</span>
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
          <button type="button" className="btn-ccr btn-primary-ccr btn-export-ccr" onClick={onExport} aria-label="Export PDF" title="Export PDF">
            <FileDown size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn-ccr btn-secondary-ccr" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}