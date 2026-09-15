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

const API_BASE = 'http://localhost:3001';

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
    <div className="sti-clinic-container">
      {/* STI Header Banner */}
      <header className="sti-header">
        <div className="sti-header-title">
          <h1>Clinic Logs & Health Records</h1>
          <p>STI Campus Health Services Management System</p>
        </div>
      </header>

      {/* Control Panel: Filters & Navigation */}
      <div className="sti-control-panel">
        <form className="sti-filter-bar" onSubmit={handleFilter}>
          <div className="sti-input-group">
            <label><Calendar size={14} /> From:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div className="sti-input-group">
            <label><Calendar size={14} /> To:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          <button type="submit" className="sti-btn sti-btn-primary">
            <Filter size={16} /> Filter
          </button>
          <button type="button" onClick={clearFilter} className="sti-btn sti-btn-secondary">
            Clear
          </button>
        </form>

        {/* Navigation Tabs */}
        <nav className="sti-tabs">
          <button 
            className={`sti-tab ${activeTab === 'clinic-visits' ? 'active' : ''}`}
            onClick={() => setActiveTab('clinic-visits')}
          >
            <ClipboardList size={18} /> Clinic Visit Log
          </button>
          <button 
            className={`sti-tab ${activeTab === 'medicine-dispensed' ? 'active' : ''}`}
            onClick={() => setActiveTab('medicine-dispensed')}
          >
            <Pill size={18} /> Medicine Dispensed
          </button>
          <button 
            className={`sti-tab ${activeTab === 'incident-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('incident-reports')}
          >
            <AlertTriangle size={18} /> Incident Reports
          </button>
          <button 
            className={`sti-tab ${activeTab === 'health-screenings' ? 'active' : ''}`}
            onClick={() => setActiveTab('health-screenings')}
          >
            <Activity size={18} /> Health Screening
          </button>
          <button 
            className={`sti-tab ${activeTab === 'doctor-visits' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctor-visits')}
          >
            <Stethoscope size={18} /> Doctor Visits
          </button>
        </nav>
      </div>

      {/* Main Content Table Area */}
      <main className="sti-content">
        {loading ? (
          <div className="sti-loading">Loading clinic records...</div>
        ) : (
          <div className="sti-table-wrapper">
            <table className="sti-table">
              <thead>
                {renderTableHeader(activeTab)}
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((item, index) => renderTableRow(activeTab, item, index, () => setSelectedRecord(item)))
                ) : (
                  <tr>
                    <td colSpan="10" className="sti-no-data">
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

// Dynamic Table Row
function renderTableRow(tab, item, index, onViewDetails) {
  switch (tab) {
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
            <button className="sti-btn-icon" onClick={onViewDetails}>
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
            <span className={`sti-badge ${item.dispensation_type === 'Direct Dispensation' ? 'tag-direct' : 'tag-consult'}`}>
              {item.dispensation_type}
            </span>
          </td>
          <td>{item.student_id || 'N/A'}</td>
          <td>{item.batch_id}</td>
          <td>{item.quantity_dispensed}</td>
          <td>{item.dispensed_at ? new Date(item.dispensed_at).toLocaleString() : 'N/A'}</td>
          <td>
            <button className="sti-btn-icon" onClick={onViewDetails}>
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
            <button className="sti-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
            </button>
          </td>
        </tr>
      );

    case 'health-screenings':
      return (
        <tr key={item.record_id || index}>
          <td><strong>{item.record_id}</strong></td>
          <td>
            <span className="sti-badge tag-screening">{item.screening_type}</span>
          </td>
          <td>{item.student_id}</td>
          <td>{item.screening_schedule_id || 'N/A'}</td>
          <td>{formatDate(item.record_date)}</td>
          <td>
            <span className={`sti-badge status-${(item.status || 'pending').toLowerCase()}`}>
              {item.status}
            </span>
          </td>
          <td>
            <button className="sti-btn-icon" onClick={onViewDetails}>
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
          <td>
            <span className={`sti-badge status-${(item.status || 'pending').toLowerCase()}`}>
              {item.status}
            </span>
          </td>
          <td>
            <button className="sti-btn-icon" onClick={onViewDetails}>
              <Eye size={16} /> View
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
    <div className="sti-modal-overlay">
      <div className="sti-modal-content">
        <div className="sti-modal-header">
          <h3>Record Details</h3>
          <button className="sti-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sti-modal-body">
          {Object.entries(record).map(([key, value]) => (
            <div className="sti-modal-field" key={key}>
              <span className="field-key">{key.replace(/_/g, ' ')}:</span>
              <span className="field-value">
                {value !== null && value !== undefined
                  ? (typeof value === 'string' && value.includes('T00:00') ? formatDate(value) : String(value)) 
                  : 'N/A'}
              </span>
            </div>
          ))}
        </div>
        <div className="sti-modal-footer">
          <button className="sti-btn sti-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}