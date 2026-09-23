import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { 
  Eye, 
  Download, 
  ChevronRight, 
  Lightbulb, 
  Activity, 
  ClipboardList, 
  FileText, 
  Stethoscope, 
  AlertCircle,
  FileCheck,
  ArrowRight
} from 'lucide-react';
import HealthTipsModal from '../../components/student/HealthTips';
import '../../styles/student/StudentDashboard.css';

// Base URL for API requests (defaults to http://localhost:3001 or Vite env variable)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const StudentDashboard = () => {
  // Extract context values directly from StudentLayout
  const context = useOutletContext() || {};
  const { 
    studentId = '', 
    programId = '', 
    yearLevel = '', 
    section = '' 
  } = context;

  // API Data States
  const [visitsData, setVisitsData] = useState({ clinic_visits: [], direct_dispensations: [] });
  const [requirementsData, setRequirementsData] = useState({ all_requirements: [], incomplete_requirements: [], total_assigned: 0, total_incomplete: 0 });
  const [documentRequestsData, setDocumentRequestsData] = useState({ excuse_slip_requests: [], referral_slip_requests: [], recent_updates: [] });
  const [healthScreenings, setHealthScreenings] = useState([]);
  const [doctorAppointments, setDoctorAppointments] = useState([]);

  // Component UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState('all');

  // Daily/Weekly Health Tips list
  const dailyHealthTips = [
    { id: 1, category: 'Hydration', title: 'Stay Hydrated', text: 'Drink at least 8 glasses of water today, especially during hot afternoon classes.' },
    { id: 2, category: 'Wellness', title: 'Eye Rest Rule', text: 'Follow the 20-20-20 rule during study sessions: look 20 feet away for 20 seconds every 20 minutes.' },
    { id: 3, category: 'Prevention', title: 'Hand Hygiene', text: 'Wash your hands regularly with soap for 20 seconds to prevent seasonal illness spread on campus.' }
  ];
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Fetch all dashboard data concurrently once studentId is available from context
  useEffect(() => {
    if (!studentId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          programId: programId || '',
          yearLevel: yearLevel || '',
          section: section || ''
        }).toString();

        const [visitsRes, reqsRes, docsRes, screeningsRes, appointmentsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/student/dashboard/visits-dispensation/${studentId}`),
          fetch(`${API_BASE_URL}/api/student/dashboard/requirements/${studentId}`),
          fetch(`${API_BASE_URL}/api/student/dashboard/document-requests/${studentId}`),
          fetch(`${API_BASE_URL}/api/student/dashboard/upcoming-health-screenings?${queryParams}`),
          fetch(`${API_BASE_URL}/api/student/dashboard/doctor-appointments/${studentId}`)
        ]);

        // Check if any endpoint returned an HTTP error status (404, 500, etc.)
        const responses = [
          { name: 'Visits & Dispensation', res: visitsRes },
          { name: 'Requirements', res: reqsRes },
          { name: 'Document Requests', res: docsRes },
          { name: 'Health Screenings', res: screeningsRes },
          { name: 'Doctor Appointments', res: appointmentsRes }
        ];

        const failedEndpoints = responses.filter((r) => !r.res.ok);
        if (failedEndpoints.length > 0) {
          failedEndpoints.forEach((f) => {
            console.error(`API Error on endpoint [${f.name}]: Status ${f.res.status}`);
          });
          throw new Error('One or more dashboard API endpoints failed.');
        }

        const [visits, reqs, docs, screenings, appointments] = await Promise.all([
          visitsRes.json(),
          reqsRes.json(),
          docsRes.json(),
          screeningsRes.json(),
          appointmentsRes.json()
        ]);

        if (visits.success) setVisitsData(visits.data);
        if (reqs.success) setRequirementsData(reqs.data);
        if (docs.success) setDocumentRequestsData(docs.data);
        if (screenings.success) setHealthScreenings(screenings.data);
        if (appointments.success) setDoctorAppointments(appointments.data);

      } catch (err) {
        console.error('Error fetching student dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [studentId, programId, yearLevel, section]);

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'approved':
      case 'issued':
      case 'attended':
        return 'badge badge-success';
      case 'pending':
      case 'submitted':
        return 'badge badge-warning';
      case 'rejected':
      case 'resubmit':
      case 'missed':
        return 'badge badge-danger';
      default:
        return 'badge badge-default';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || !studentId) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">Loading your student health dashboard...</div>
      </div>
    );
  }

  // Shared inline styles for the "View All" link
  const viewAllStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.875rem',
    color: '#0d6efd',
    textDecoration: 'none',
    fontWeight: '500',
    marginLeft: 'auto'
  };

  return (
    <div className="dashboard-wrapper">
      
      {/* Header & Health Tips Banner */}
      <header className="dashboard-header">
        <div className="header-info">
          <h1>Student Health Dashboard</h1>
          <p>Student ID: <span>{studentId}</span></p>
        </div>

        <div className="health-tips-card">
          <div className="tip-content">
            <div className="tip-header">
              <span className="tip-category">{dailyHealthTips[currentTipIndex].category}</span>
              <span className="tip-title">{dailyHealthTips[currentTipIndex].title}</span>
            </div>
            <p className="tip-text">{dailyHealthTips[currentTipIndex].text}</p>
          </div>
          <div className="tip-actions">
            <button 
              onClick={() => setCurrentTipIndex((prev) => (prev + 1) % dailyHealthTips.length)}
              className="btn-icon-secondary"
              title="Next Tip"
              aria-label="Next Tip"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => setIsTipsOpen(true)}
              className="btn-icon-primary"
              title="All Tips"
              aria-label="All Health Tips"
            >
              <Lightbulb size={18} />
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert-error"><AlertCircle size={18} /> {error}</div>}

      {/* Main Grid Layout */}
      <main className="dashboard-grid">

        {/* SECTION 1: Recent Clinic Visits & Medicine Dispensation */}
        <section className="card-section col-span-2">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><Activity size={20} /> Clinic Visits & Dispensations</h2>
              <span className="meta-count">{visitsData.clinic_visits.length} Visit(s)</span>
            </div>
            <Link to="/ClinicLogsAndRecords" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {visitsData.clinic_visits.length === 0 && visitsData.direct_dispensations.length === 0 ? (
            <p className="empty-state">No recent clinic visits or dispensations recorded.</p>
          ) : (
            <div className="card-content-stack">
              {/* Limited to top 3 clinic visits */}
              {visitsData.clinic_visits.slice(0, 3).map((visit) => (
                <div key={visit.visit_id} className="visit-item">
                  <div className="visit-item-header">
                    <span className="visit-date">
                      Visit Date: {formatDate(visit.visit_date)} ({visit.time_in || 'N/A'} - {visit.time_out || 'N/A'})
                    </span>
                  </div>

                  <div className="vitals-grid">
                    <div className="vital-box">
                      <span className="vital-label">Temp</span>
                      <span className="vital-value">{visit.vitals?.temperature || 'N/A'} °C</span>
                    </div>
                    <div className="vital-box">
                      <span className="vital-label">Blood Pressure</span>
                      <span className="vital-value">{visit.vitals?.blood_pressure || 'N/A'}</span>
                    </div>
                    <div className="vital-box">
                      <span className="vital-label">Pulse Rate</span>
                      <span className="vital-value">{visit.vitals?.pulse_rate || 'N/A'} bpm</span>
                    </div>
                    <div className="vital-box">
                      <span className="vital-label">Resp. Rate</span>
                      <span className="vital-value">{visit.vitals?.respiratory_rate || 'N/A'} bpm</span>
                    </div>
                  </div>

                  {(visit.nursing_intervention || visit.health_advice) && (
                    <div className="visit-details">
                      {visit.nursing_intervention && (
                        <p><strong>Intervention:</strong> {visit.nursing_intervention}</p>
                      )}
                      {visit.health_advice && (
                        <p><strong>Health Advice:</strong> {visit.health_advice}</p>
                      )}
                    </div>
                  )}

                  {visit.dispensed_medicines?.length > 0 && (
                    <div className="meds-list">
                      <span className="meds-title">Prescribed / Dispensed Medicine:</span>
                      <div className="meds-tags">
                        {visit.dispensed_medicines.map((med) => (
                          <span key={med.dispense_id} className="tag-pill">
                            {med.dosage_value} {med.dosage_unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Limited to top 3 direct dispensations */}
              {visitsData.direct_dispensations.length > 0 && (
                <div className="direct-dispense-section">
                  <h3 className="section-subtitle">Direct Medicine Dispensations</h3>
                  <div className="direct-grid">
                    {visitsData.direct_dispensations.slice(0, 3).map((direct) => (
                      <div key={direct.direct_dispense_id} className="direct-item">
                        <div className="direct-item-row">
                          <span>{direct.dosage_consumption_unit_value} {direct.dosage_consumption_unit_of_measure}</span>
                        </div>
                        <p className="direct-timestamp">Dispensed: {formatDateTime(direct.dispensed_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION 2: Requirements */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><ClipboardList size={20} /> Requirements</h2>
              {requirementsData.total_incomplete > 0 && (
                <span className="badge badge-warning">{requirementsData.total_incomplete} Action Needed</span>
              )}
            </div>
            <Link to="/MyRequirements" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {requirementsData.all_requirements.length === 0 ? (
            <p className="empty-state">No requirements assigned.</p>
          ) : (
            <div className="card-content-scroll">
              {/* Limited to top 3 requirements */}
              {requirementsData.all_requirements.slice(0, 3).map((req, idx) => (
                <div key={idx} className="item-card">
                  <div className="item-card-row">
                    <span className="item-title">{req.requirement_name}</span>
                    <span className={getStatusBadgeClass(req.status)}>{req.status}</span>
                  </div>

                  <p className="item-subtext">Deadline: <span>{formatDate(req.submission_deadline)}</span></p>

                  {req.nurse_remarks && (
                    <div className="item-remarks">
                      <strong>Nurse Remarks:</strong> {req.nurse_remarks}
                    </div>
                  )}

                  {req.file_url && (
                    <a 
                      href={req.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="row-action-btn"
                      title="View Submitted Document"
                      aria-label="View Submitted Document"
                    >
                      <Eye size={16} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: Document Requests */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><FileText size={20} /> Document Requests</h2>
            </div>
            <div className="tab-group" style={{ margin: 0 }}>
              {['all', 'excuse', 'referral'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDocTab(tab)}
                  className={`tab-btn ${activeDocTab === tab ? 'active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Link to="/RequestModule" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {documentRequestsData.recent_updates.length === 0 ? (
            <p className="empty-state">No document request updates.</p>
          ) : (
            <div className="card-content-scroll">
              {/* Filtered & Limited to top 3 document requests */}
              {documentRequestsData.recent_updates
                .filter((doc) => {
                  if (activeDocTab === 'excuse') return doc.request_type === 'Excuse Slip';
                  if (activeDocTab === 'referral') return doc.request_type === 'Referral Slip';
                  return true;
                })
                .slice(0, 3)
                .map((doc) => (
                  <div key={doc.request_id} className="item-card">
                    <div className="item-card-row">
                      <span className="item-title">{doc.request_type}</span>
                      <span className={getStatusBadgeClass(doc.status)}>{doc.status}</span>
                    </div>

                    <p className="item-subtext"><strong>Reason:</strong> {doc.reason_for_excuse || doc.reason_for_referral || 'N/A'}</p>

                    {doc.valid_absence_start && (
                      <p className="item-subtext">Absence: {formatDate(doc.valid_absence_start)} - {formatDate(doc.valid_absence_end)}</p>
                    )}

                    <div className="item-card-footer">
                      <span>Requested: {formatDate(doc.created_at)}</span>
                      {doc.issued_slip_url && (
                        <a 
                          href={doc.issued_slip_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="row-action-btn success"
                          title="Download Issued Slip"
                          aria-label="Download Issued Slip"
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* SECTION 4: Health Screenings */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><FileCheck size={20} /> Health Screenings</h2>
            </div>
            <Link to="/ClinicLogsAndRecords" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {healthScreenings.length === 0 ? (
            <p className="empty-state">No upcoming health screenings scheduled.</p>
          ) : (
            <div className="card-content-scroll">
              {/* Limited to top 3 health screenings */}
              {healthScreenings.slice(0, 3).map((screening) => (
                <div key={screening.screening_schedule_id} className="item-card info-card">
                  <div className="item-card-row">
                    <span className="item-title">{screening.title}</span>
                    <span className="badge badge-info">{screening.screening_type || 'General'}</span>
                  </div>

                  <div className="item-subtext">
                    <p>📅 Date: {formatDate(screening.scheduled_date)}</p>
                    <p>⏰ Time: {screening.start_time} - {screening.end_time}</p>
                  </div>

                  {screening.announcement && (
                    <p className="item-announcement">"{screening.announcement}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 5: Doctor Appointments */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><Stethoscope size={20} /> Doctor Appointments</h2>
            </div>
            <Link to="/ClinicLogsAndRecords" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {doctorAppointments.length === 0 ? (
            <p className="empty-state">No upcoming doctor appointments scheduled.</p>
          ) : (
            <div className="card-content-scroll">
              {/* Limited to top 3 doctor appointments */}
              {doctorAppointments.slice(0, 3).map((appt) => (
                <div key={appt.appointment_id} className="item-card accent-card">
                  <div className="item-card-row">
                    <span className="item-title">{appt.title || 'Doctor Consultation'}</span>
                    <span className={getStatusBadgeClass(appt.attendance_status || appt.appointment_status)}>
                      {appt.attendance_status || appt.appointment_status || 'Scheduled'}
                    </span>
                  </div>

                  <div className="item-subtext">
                    <p>🕒 Start: {formatDateTime(appt.start_time)}</p>
                    <p>🕒 End: {formatDateTime(appt.end_time)}</p>
                  </div>

                  {appt.announcement && (
                    <div className="item-announcement">
                      <strong>Announcement:</strong> {appt.announcement}
                    </div>
                  )}

                  {appt.notes && <p className="item-notes">Notes: {appt.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* SECTION 6: Health Tips Modal */}
      <HealthTipsModal 
        isOpen={isTipsOpen} 
        onClose={() => setIsTipsOpen(false)} 
      />
    </div>
  );
};

export default StudentDashboard;