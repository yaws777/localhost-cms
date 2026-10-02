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
  Filter
} from 'lucide-react';
import '../../styles/student/ClinicLogs&Records.css';

const API_BASE = 'https://localhost-cms.onrender.com';

// Safe date formatter to avoid UTC offset shifts
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return new Date(year, month - 1, day).toLocaleDateString();
  }
  return new Date(dateStr).toLocaleDateString();
};

export default function ClinicLogsAndRecords() {
  const { studentId } = useOutletContext();

  const [activeTab, setActiveTab] = useState('clinic-visits');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

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
    <div className="container-clr">
      {/* STI Header Banner */}
      <header className="header-clr">
        <div className="header-title-clr">
          <h1>Clinic Logs & Health Records</h1>
          <p>STI Campus Health Services Management System</p>
        </div>
      </header>

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
            <button type="submit" className="btn-clr btn-primary-clr">
              <Filter size={16} /> Filter
            </button>
            <button type="button" onClick={clearFilter} className="btn-clr btn-secondary-clr">
              Clear
            </button>
          </div>
        </form>

        {/* Navigation Tabs */}
        <nav className="tabs-clr">
          <button 
            className={`tab-clr ${activeTab === 'clinic-visits' ? 'active-clr' : ''}`}
            onClick={() => setActiveTab('clinic-visits')}
          >
            <ClipboardList size={18} /> Clinic Visit Log
          </button>
          <button 
            className={`tab-clr ${activeTab === 'medicine-dispensed' ? 'active-clr' : ''}`}
            onClick={() => setActiveTab('medicine-dispensed')}
          >
            <Pill size={18} /> Medicine Dispensed
          </button>
          <button 
            className={`tab-clr ${activeTab === 'incident-reports' ? 'active-clr' : ''}`}
            onClick={() => setActiveTab('incident-reports')}
          >
            <AlertTriangle size={18} /> Incident Reports
          </button>
          <button 
            className={`tab-clr ${activeTab === 'health-screenings' ? 'active-clr' : ''}`}
            onClick={() => setActiveTab('health-screenings')}
          >
            <Activity size={18} /> Health Screening
          </button>
          <button 
            className={`tab-clr ${activeTab === 'doctor-visits' ? 'active-clr' : ''}`}
            onClick={() => setActiveTab('doctor-visits')}
          >
            <Stethoscope size={18} /> Doctor Visits
          </button>
        </nav>
      </div>

      {/* Main Content Table Area */}
      <main className="content-clr">
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
                  records.map((item, index) => renderTableRow(activeTab, item, index, () => setSelectedRecord(item)))
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
      </main>

      {/* Record Details Modal */}
      {selectedRecord && (
        <Modal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
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
    case 'student-requirements':
      return (
        <tr>
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

// Dynamic Table Row
function renderTableRow(tab, item, index, onViewDetails) {
  switch (tab) {
    case 'clinic-visits':
      return (
        <tr key={item.visit_id || index}>
          <td><strong>{item.visit_id}</strong></td>
          <td>{item.student_id}</td>
          <td>
            {item.nurse_first_name && item.nurse_last_name 
              ? `${item.nurse_first_name} ${item.nurse_last_name}` 
              : item.nurse_id || 'N/A'}
          </td>
          <td>{formatDate(item.visit_date)}</td>
          <td>{item.time_in} - {item.time_out || 'N/A'}</td>
          <td>BP: {item.blood_pressure || 'N/A'} | Temp: {item.temperature || 'N/A'}°C</td>
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
          <td><strong>{item.id}</strong></td>
          <td>
            <span className={`badge-clr ${item.dispensation_type === 'Direct Dispensation' ? 'tag-direct-clr' : 'tag-consult-clr'}`}>
              {item.dispensation_type}
            </span>
          </td>
          <td>{item.student_id || 'N/A'}</td>
          <td>{item.brand_name || 'N/A'}</td>
          <td>{item.generic_name || 'N/A'}</td>
          <td>{item.quantity_dispensed}</td>
          <td>{item.dispensed_at ? new Date(item.dispensed_at).toLocaleString() : 'N/A'}</td>
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
          <td><strong>{item.incident_id}</strong></td>
          <td>{item.student_id}</td>
          <td>
            {item.nurse_first_name && item.nurse_last_name 
              ? `${item.nurse_first_name} ${item.nurse_last_name}` 
              : item.nurse_id || 'N/A'}
          </td>
          <td>{item.incident_location}</td>
          <td>{item.incident_datetime ? new Date(item.incident_datetime).toLocaleString() : 'N/A'}</td>
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
          <td>{item.student_id}</td>
          <td>{formatDate(item.record_date || item.date)}</td>
          <td>
            <span className={`badge-clr status-${(item.status || 'pending').toLowerCase()}-clr`}>
              {item.status}
            </span>
          </td>
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
          <td><strong>{item.appointment_id}</strong></td>
          <td>{item.student_id}</td>
          <td>
            {item.doctor_first_name && item.doctor_last_name 
              ? `${item.doctor_first_name} ${item.doctor_last_name}` 
              : item.doctor_id || 'N/A'}
          </td>
          <td>
            {item.start_time ? new Date(item.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''} - 
            {item.end_time ? new Date(item.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
          </td>
          <td>
            <span className={`badge-clr status-${(item.status || 'pending').toLowerCase()}-clr`}>
              {item.status}
            </span>
          </td>
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
function Modal({ record, onClose }) {
  return (
    <div className="modal-overlay-clr">
      <div className="modal-content-clr">
        <div className="modal-header-clr">
          <h3>Record Details</h3>
          <button className="modal-close-clr" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body-clr">
          {Object.entries(record).map(([key, value]) => (
            <div className="modal-field-clr" key={key}>
              <span className="field-key-clr">{key.replace(/_/g, ' ')}:</span>
              <span className="field-value-clr">
                {value !== null && value !== undefined
                  ? (typeof value === 'string' && value.includes('T00:00') ? formatDate(value) : String(value)) 
                  : 'N/A'}
              </span>
            </div>
          ))}
        </div>
        <div className="modal-footer-clr">
          <button className="btn-clr btn-secondary-clr" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}