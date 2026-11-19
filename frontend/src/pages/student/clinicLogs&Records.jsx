import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  ClipboardList, 
  Pill, 
  AlertTriangle, 
  Activity, 
  Stethoscope, 
  Calendar, 
  Eye,
  X,
  Filter,
  FileDown,
  RotateCcw,
  User
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { exportClinicRecords, exportClinicRecord } from '../../utils/clinicRecordExport';
import { Pager, paginate } from '../../components/common/RecordFolders';
import { ClinicVisitForm, DispensedForm, IncidentForm, DoctorVisitDetail, ScreeningDetail, VisitStatus, ScreeningStatus, visitDoctor, visitTitle } from '../../components/common/ClinicRecordViews';
import { formatTime, formatDate as formatDateBase, formatDateTime } from '../../utils/datetime';
import '../../styles/student/ClinicLogs&Records.css';

const API_BASE = 'http://localhost:3001';
// small pages keep the list on one screen
const PER_PAGE = 6;

const TABS = [
  { key: 'clinic-visits', label: 'Clinic Visits', Icon: ClipboardList },
  { key: 'medicine-dispensed', label: 'Medicine', Icon: Pill },
  { key: 'incident-reports', label: 'Incidents', Icon: AlertTriangle },
  { key: 'health-screenings', label: 'Screening', Icon: Activity },
  { key: 'doctor-visits', label: 'Doctor Visits', Icon: Stethoscope }
];

// Safe date formatter to avoid UTC offset shifts
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return formatDateBase(dateStr.split('T')[0]);
  }
  return formatDateBase(dateStr);
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

// studentId prop: the nurse opens this same screen for any student (outside the student layout)
// afterHeader: optional node shown right under the header banner (nurse view: student profile card)
export default function ClinicLogsAndRecords({ studentId: studentIdProp, afterHeader = null }) {
  const outlet = useOutletContext();
  const { showAlert } = useAlert();
  const studentId = studentIdProp || outlet?.studentId;

  const [activeTab, setActiveTab] = useState('clinic-visits');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async (overrideStartDate = startDate, overrideEndDate = endDate) => {
    if (!studentId) return;

    setLoading(true);
    try {
      let url = `${API_BASE}/${activeTab}/clinicLogs&Records?studentId=${encodeURIComponent(studentId)}`;
      
      if (overrideStartDate && overrideEndDate) {
        url += `&startDate=${overrideStartDate}&endDate=${overrideEndDate}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setRecords(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (error) {
      console.error('Error fetching data:', error);
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

  const paged = paginate(records, page, PER_PAGE);

  const handleFilter = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    fetchLogs('', '');
  };

  const onBlocked = () => showAlert('Allow popups to preview the PDF.', 'warning');
  const studentLabel = `Student ID: ${studentId || 'N/A'}`;

  const handleExport = () => {
    if (records.length === 0) {
      showAlert('No records to export.', 'warning');
      return;
    }
    exportClinicRecords({ tab: activeTab, records, studentLabel, range: { startDate, endDate }, onBlocked });
  };

  return (
    <div className="container-clr">
      {/* STI Header Banner */}
      <header className="header-clr">
        <div className="header-title-clr">
          <h1>Clinic Logs & Health Records</h1>
          <p>STI Campus Health Services</p>
        </div>
        <span className="chip-clr"><User size={18} aria-hidden="true" />{studentId || 'N/A'}</span>
      </header>

      {afterHeader}

      {/* Control Panel: Filters & Navigation */}
      <div className="control-panel-clr">
        <form className="filter-bar-clr" onSubmit={handleFilter}>
          <div className="input-group-clr">
            <label><Calendar size={14} /> From:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div className="input-group-clr">
            <label><Calendar size={14} /> To:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          <div className="filter-actions-clr">
            <button type="submit" className="btn-clr btn-primary-clr" aria-label="Filter" title="Filter">
              <Filter size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={clearFilter} className="btn-clr btn-secondary-clr" aria-label="Clear filter" title="Clear filter">
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <span className="found-clr" role="status">{loading ? '' : `${records.length} records`}</span>
            <button
              type="button"
              onClick={handleExport}
              className="btn-clr btn-secondary-clr btn-export-clr"
              aria-label="Export PDF"
              title="Export PDF"
            >
              <FileDown size={18} aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* Navigation Tabs */}
        <nav className="tabs-clr" aria-label="Record type">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`tab-clr ${activeTab === key ? 'active-clr' : ''}`}
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
            >
              <span className="tab-ic-clr"><Icon size={20} aria-hidden="true" /></span>
              <span className="tab-tx-clr">
                {activeTab === key && !loading && <span className="tab-count-clr">{records.length}</span>}
                <span>{label}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Table Area */}
      <div className="content-clr">
        {loading ? (
          <div className="loading-clr">Loading clinic records...</div>
        ) : (
          <div className="table-wrapper-clr">
            <table className="table-clr">
              <thead>
                {renderTableHeader(activeTab)}
              </thead>
              <tbody>
                {records.length > 0 ? (
                  paged.items.map((item, index) => renderTableRow(activeTab, item, index, () => setSelectedRecord(item)))
                ) : (
                  <tr>
                    <td colSpan="10" className="no-data-clr">
                      No logs or records found for Student ID: {studentId || 'N/A'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={PER_PAGE} onPage={setPage} noun="records" />}
      </div>

      {/* Record Details Modal */}
      {selectedRecord && (
        <Modal
          tab={activeTab}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onExport={() => exportClinicRecord({ tab: activeTab, record: selectedRecord, studentLabel, onBlocked })}
        />
      )}
    </div>
  );
}

// Dynamic Table Header
function renderTableHeader(tab) {
  switch (tab) {
    case 'clinic-visits':
      return (
        <tr>
          <th>Visit ID</th>
          <th>Nurse</th>
          <th>Date</th>
          <th>Time In / Out</th>
          <th>Vitals</th>
          <th><span className="sr-only-clr">Action</span></th>
        </tr>
      );
    case 'medicine-dispensed':
      return (
        <tr>
          <th>Dispense ID</th>
          <th>Type</th>
          <th>Medicine</th>
          <th>Qty</th>
          <th>Date & Time</th>
          <th><span className="sr-only-clr">Action</span></th>
        </tr>
      );
    case 'incident-reports':
      return (
        <tr>
          <th>Incident ID</th>
          <th>Nurse</th>
          <th>Location</th>
          <th>Date & Time</th>
          <th><span className="sr-only-clr">Action</span></th>
        </tr>
      );
    case 'health-screenings':
    case 'student-requirements':
      return (
        <tr>
          <th>Type</th>
          <th>Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      );
    case 'doctor-visits':
      return (
        <tr>
          <th>Date</th>
          <th>Check-up</th>
          <th>Doctor Name</th>
          <th>Number</th>
          <th>Status</th>
          <th>Assessment</th>
          <th><span className="sr-only-clr">Action</span></th>
        </tr>
      );
    default:
      return null;
  }
}

// Dynamic Table Row
function renderTableRow(tab, item, index, onViewDetails) {
  switch (tab) {
    case 'clinic-visits':
      return (
        <tr key={item.visit_id || index}>
          <td><span className="cell-id-clr">{item.visit_id}</span></td>
          <td>
            {item.nurse_first_name && item.nurse_last_name
              ? `${item.nurse_first_name} ${item.nurse_last_name}`
              : item.nurse_id || 'N/A'}
          </td>
          <td>{formatDate(item.visit_date)}</td>
          <td>{formatTime(item.time_in)} - {item.time_out ? formatTime(item.time_out) : 'N/A'}</td>
          <td>
            BP {item.blood_pressure || 'N/A'}
            <span className="cell-sub-clr">Temp {item.temperature || 'N/A'}°C</span>
          </td>
          <td>
            <button className="btn-icon-clr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'medicine-dispensed':
      return (
        <tr key={item.id || index}>
          <td><span className="cell-id-clr">{item.id}</span></td>
          <td>
            <span className={`badge-clr ${item.dispensation_type === 'Direct Dispensation' ? 'tag-direct-clr' : 'tag-consult-clr'}`}>
              {item.dispensation_type}
            </span>
          </td>
          <td>
            {item.brand_name || 'N/A'}
            <span className="cell-sub-clr">{item.generic_name || 'N/A'}</span>
          </td>
          <td>{item.quantity_dispensed}</td>
          <td>{item.dispensed_at ? formatDateTime(new Date(item.dispensed_at)) : 'N/A'}</td>
          <td>
            <button className="btn-icon-clr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'incident-reports':
      return (
        <tr key={item.incident_id || index}>
          <td><span className="cell-id-clr">{item.incident_id}</span></td>
          <td>
            {item.nurse_first_name && item.nurse_last_name
              ? `${item.nurse_first_name} ${item.nurse_last_name}`
              : item.nurse_id || 'N/A'}
          </td>
          <td>{item.incident_location}</td>
          <td>{item.incident_datetime ? formatDateTime(new Date(item.incident_datetime)) : 'N/A'}</td>
          <td>
            <button className="btn-icon-clr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'health-screenings':
    case 'student-requirements':
      return (
        <tr key={item.record_id || item.req_id || index}>
          <td>
            <span className="badge-clr tag-screening-clr">{item.screening_type || item.requirement_type}</span>
          </td>
          <td>{formatDate(item.record_date || item.date)}</td>
          <td>{tab === 'health-screenings' ? <ScreeningStatus item={item} /> : (
            <span className={`badge-clr status-${(item.status || 'pending').toLowerCase().replace(/\s+/g, '-')}-clr`}>
              {item.status}
            </span>
          )}</td>
          <td>
            <button className="btn-icon-clr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    case 'doctor-visits':
      return (
        <tr key={item.appointment_id || index}>
          <td>{item.start_time ? formatDate(item.start_time) : 'N/A'}</td>
          <td><strong>{visitTitle(item)}</strong></td>
          <td>{visitDoctor(item)}</td>
          <td>{item.queue_label || '-'}</td>
          <td><VisitStatus item={item} /></td>
          <td>{item.documented ? (item.diagnosis || 'Documented') : '-'}</td>
          <td>
            <button className="btn-icon-clr" onClick={onViewDetails} title="View Details" aria-label="View Details">
              <Eye size={18} />
            </button>
          </td>
        </tr>
      );

    default:
      return null;
  }
}

// Modal Component
function Modal({ tab, record, onClose, onExport }) {
  return (
    <div className="modal-overlay-clr">
      <div className="modal-content-clr" role="dialog" aria-modal="true" aria-labelledby="record-title-clr">
        <div className="modal-header-clr">
          <h3 id="record-title-clr">Record Details</h3>
          <button type="button" className="modal-close-clr" onClick={onClose} aria-label="Close" title="Close"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="modal-body-clr">
          {tab === 'clinic-visits' ? <ClinicVisitForm record={record} /> : tab === 'medicine-dispensed' ? <DispensedForm record={record} /> : tab === 'incident-reports' ? <IncidentForm record={record} /> : tab === 'doctor-visits' ? <DoctorVisitDetail record={record} /> : tab === 'health-screenings' ? <ScreeningDetail record={record} /> : Object.entries(record).map(([key, value]) => (
            <div className="modal-field-clr" key={key}>
              <span className="field-key-clr">{formatKeyLabel(key)}:</span>
              <span className="field-value-clr">
                {value !== null && value !== undefined
                  ? (typeof value === 'string' && value.includes('T00:00') ? formatDate(value) : String(value)) 
                  : 'N/A'}
              </span>
            </div>
          ))}
        </div>
        <div className="modal-footer-clr">
          <button type="button" className="btn-clr btn-primary-clr btn-export-clr" onClick={onExport} aria-label="Export PDF" title="Export PDF">
            <FileDown size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn-clr btn-secondary-clr" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}