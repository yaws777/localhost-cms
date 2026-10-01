import React, { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { 
  Eye, 
  ChevronRight, 
  Lightbulb, 
  Activity, 
  ClipboardList, 
  FileText, 
  Stethoscope, 
  AlertCircle,
  FileCheck,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import HealthTipsModal from '../../components/student/HealthTips';
import '../../styles/student/StudentDashboard.css';

const API_BASE = 'http://localhost:3001/api';
const BASE_URL = 'http://localhost:3001';

const StudentDashboard = () => {
  const navigate = useNavigate();

  // Extract context values from StudentLayout
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

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState('all');

  // Daily Health Tips (Mapped from Clinic Complaints)
  const dailyHealthTips = [
    { id: 1, category: 'Respiratory', title: 'Asthma Care', text: 'Always carry your prescribed quick-relief inhaler and stay clear of environmental triggers like dust and smoke.' },
    { id: 2, category: 'Physical Health', title: 'Relieve Body Pain', text: 'Maintain proper posture during long classes and take short stretching breaks to prevent muscle tension.' },
    { id: 3, category: 'Respiratory', title: 'Cough Relief', text: 'Sip warm fluids throughout the day and wear a mask in crowded spaces to prevent spreading germs.' },
    { id: 4, category: 'First Aid', title: 'Breathing Ease', text: 'If breathing feels tight, sit upright in a well-ventilated area, stay calm, and report to the clinic.' },
    { id: 5, category: 'Wellness', title: 'Prevent Dizziness', text: 'Avoid standing up too quickly and keep hydrated, especially during outdoor or afternoon activities.' },
    { id: 6, category: 'General Health', title: 'Fever Care', text: 'Rest well, sip water regularly, and visit the clinic if your body temperature rises or chills persist.' },
    { id: 7, category: 'Digestive', title: 'Gastrointestinal Care', text: 'Drink clean or bottled water, avoid unhygienic foods, and consider oral rehydration solutions if needed.' },
    { id: 8, category: 'Wellness', title: 'Headache Relief', text: 'Take screen breaks every 20 minutes, reduce eye strain, and drink plenty of water.' },
    { id: 9, category: 'Digestive', title: 'Heartburn Prevention', text: 'Avoid heavy, greasy, or spicy meals before long class sessions or going straight to bed.' },
    { id: 10, category: 'Cardiovascular', title: 'Blood Pressure Control', text: 'Limit salty campus snacks, practice deep breathing during stressful exams, and stay active.' },
    { id: 11, category: 'First Aid', title: 'Injury First Aid', text: 'Apply cold compresses to minor bumps or sprains immediately and visit the clinic for wound dressing.' },
    { id: 12, category: 'Emergency', title: 'Fainting Awareness', text: 'Ensure good airflow, loosen tight clothing around the neck, and seek immediate clinic assistance if someone faints.' },
    { id: 13, category: "Women's Health", title: 'Menstrual Cramp Relief', text: 'Use a warm compress on your lower abdomen, rest when needed, and drink warm water.' },
    { id: 14, category: 'Digestive', title: 'Nausea & Vomiting', text: 'Sip small amounts of water or ginger tea slowly and stay seated upright until your stomach settles.' },
    { id: 15, category: 'Prevention', title: 'Runny Nose Hygiene', text: 'Cover sneezes with tissues or your elbow and wash hands frequently to maintain campus hygiene.' },
    { id: 16, category: 'Respiratory', title: 'Sore Throat Relief', text: 'Gargle warm salt water and stay hydrated with warm beverages to soothe throat irritation.' },
    { id: 17, category: 'Oral Health', title: 'Toothache Prevention', text: 'Brush twice daily, floss regularly, and avoid extremely hot, cold, or sugary snacks.' }
  ];

  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Helper to format uploaded document URLs using standard base URL
  const getFileUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Fetch all dashboard endpoints
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
          fetch(`${API_BASE}/student/dashboard/visits-dispensation/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/requirements/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/document-requests/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/upcoming-health-screenings?${queryParams}`),
          fetch(`${API_BASE}/student/dashboard/doctor-appointments/${studentId}`)
        ]);

        const responses = [
          { name: 'Visits & Dispensation', res: visitsRes },
          { name: 'Requirements', res: reqsRes },
          { name: 'Document Requests', res: docsRes },
          { name: 'Health Screenings', res: screeningsRes },
          { name: 'Doctor Appointments', res: appointmentsRes }
        ];

        const failedEndpoints = responses.filter((r) => !r.res.ok);
        if (failedEndpoints.length > 0) {
          failedEndpoints.forEach((f) => console.error(`API Error on [${f.name}]: Status ${f.res.status}`));
          throw new Error('Failed to load parts of your health dashboard.');
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

  const handleQuickRequest = (modalType) => {
    navigate('/RequestModule', { state: { openModal: modalType } });
  };

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
      case 'incomplete':
      case 'rejected':
      case 'resubmit':
      case 'missed':
      case 'not submitted':
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

  const viewAllStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.875rem',
    color: '#0d6efd',
    textDecoration: 'none',
    fontWeight: '600',
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

      {/* QUICK ACTION BUTTONS */}
      <section className="quick-actions-bar" style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          className="quick-action-card"
          onClick={() => handleQuickRequest('excuse')}
          style={{
            flex: '1',
            minWidth: '220px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e6ed',
            borderRadius: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ backgroundColor: '#eef2ff', padding: '10px', borderRadius: '8px', color: '#4f46e5' }}>
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>Request Excuse Slip</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>Apply for class excuse slip</p>
          </div>
          <PlusCircle size={18} style={{ marginLeft: 'auto', color: '#4f46e5' }} />
        </button>

        <button 
          className="quick-action-card"
          onClick={() => handleQuickRequest('referral')}
          style={{
            flex: '1',
            minWidth: '220px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e6ed',
            borderRadius: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ backgroundColor: '#ecfdf5', padding: '10px', borderRadius: '8px', color: '#059669' }}>
            <Stethoscope size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>Request Referral Slip</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#059669' }}>Request lab / hospital referral</p>
          </div>
          <PlusCircle size={18} style={{ marginLeft: 'auto', color: '#059669' }} />
        </button>
      </section>

      {/* Main Grid Layout */}
      <main className="dashboard-grid">

        {/* 1. OVERVIEW: Clinic Visits & Medicine Dispensation */}
        <section className="card-section col-span-2">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><Activity size={20} /> Recent Clinic Visits & Dispensations</h2>
              <span className="meta-count">{visitsData.clinic_visits.length} Recent</span>
            </div>
            <Link to="/ClinicLogsAndRecords" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {visitsData.clinic_visits.length === 0 && visitsData.direct_dispensations.length === 0 ? (
            <p className="empty-state">No recent clinic visits or dispensations recorded.</p>
          ) : (
            <div className="card-content-stack">
              {visitsData.clinic_visits.slice(0, 2).map((visit) => (
                <div key={visit.visit_id} className="visit-item">
                  <div className="visit-item-header">
                    <span className="visit-date">
                      📅 Date: {formatDate(visit.visit_date)} ({visit.time_in || 'N/A'} - {visit.time_out || 'N/A'})
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

                  <div className="visit-details">
                    <p>
                      <strong>Complaint:</strong>{' '}
                      {visit.complaint_name
                        ? `${visit.complaint_name}${visit.specify_complaint_text ? ` - ${visit.specify_complaint_text}` : ''}`
                        : visit.specify_complaint_text || 'N/A'}
                    </p>
                    {visit.nursing_intervention && (
                      <p>
                        <strong>Intervention:</strong> {visit.nursing_intervention}
                      </p>
                    )}
                    {visit.assessment && (
                      <p>
                        <strong>Assessment:</strong> {visit.assessment}
                      </p>
                    )}
                  </div>

                  {/* Dispensed Medicines with Medicine Name */}
                  {visit.dispensed_medicines?.length > 0 && (
                    <div className="meds-list">
                      <span className="meds-title">Dispensed Medicine:</span>
                      <div className="meds-tags">
                        {visit.dispensed_medicines.map((med) => (
                          <span key={med.dispense_id} className="tag-pill">
                            💊 <strong>{med.medicine_name || med.generic_name || med.brand_name || 'Medicine'}</strong> — {med.dosage_value} {med.dosage_unit || 'pcs'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Direct Dispensations with Medicine Name */}
              {visitsData.direct_dispensations.length > 0 && (
                <div className="direct-dispense-section">
                  <h3 className="section-subtitle">Direct Medicine Dispensations</h3>
                  <div className="direct-grid">
                    {visitsData.direct_dispensations.slice(0, 2).map((direct) => (
                      <div key={direct.direct_dispense_id} className="direct-item">
                        <div className="direct-item-row">
                          <span>
                            💊 <strong>{direct.medicine_name || direct.generic_name || direct.brand_name || 'Medicine'}</strong>: {direct.dosage_consumption_unit_value} {direct.dosage_consumption_unit_of_measure || 'pcs'}
                          </span>
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

        {/* 2. OVERVIEW: Requirements & Status */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><ClipboardList size={20} /> Requirements Overview</h2>
              {requirementsData.total_incomplete > 0 && (
                <span className="badge badge-warning">{requirementsData.total_incomplete} Incomplete/Pending</span>
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
                      href={getFileUrl(req.file_url)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="row-action-btn"
                      title="View Submitted Document"
                      aria-label="View Submitted Document"
                    >
                      <Eye size={16} /> View Submitted File
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. OVERVIEW: Document Requests Updates */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><FileText size={20} /> Document Request Updates</h2>
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
            <p className="empty-state">No document request updates found.</p>
          ) : (
            <div className="card-content-scroll">
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
                      <span className={getStatusBadgeClass(doc.status)}>{doc.status || 'Pending'}</span>
                    </div>

                    <p className="item-subtext"><strong>Reason:</strong> {doc.reason_for_excuse || doc.reason_for_referral || 'N/A'}</p>

                    {doc.valid_absence_start && (
                      <p className="item-subtext">Absence: {formatDate(doc.valid_absence_start)} to {formatDate(doc.valid_absence_end)}</p>
                    )}

                    <div className="item-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span className="item-subtext">Requested: {formatDate(doc.created_at)}</span>

                      {/* View Issued Slip Button */}
                      {doc.issued_slip_url ? (
                        <a 
                          href={getFileUrl(doc.issued_slip_url)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="row-action-btn"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#eef2ff', color: '#4f46e5', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '500' }}
                          title={`View Issued ${doc.request_type}`}
                          aria-label={`View Issued ${doc.request_type}`}
                        >
                          <Eye size={14} /> View Issued Slip
                        </a>
                      ) : (
                        doc.student_proof_url && (
                          <a 
                            href={getFileUrl(doc.student_proof_url)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="row-action-btn"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#374151', textDecoration: 'none', fontSize: '0.8rem' }}
                            title="View Attached Proof"
                            aria-label="View Attached Proof"
                          >
                            <Eye size={14} /> View Proof
                          </a>
                        )
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* 4. OVERVIEW: Upcoming Health Screenings */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><FileCheck size={20} /> Upcoming Health Screenings</h2>
            </div>
            <Link to="/ClinicLogsAndRecords" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {healthScreenings.length === 0 ? (
            <p className="empty-state">No upcoming health screenings scheduled.</p>
          ) : (
            <div className="card-content-scroll">
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

        {/* 5. OVERVIEW: Doctor Visit Schedule */}
        <section className="card-section">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2><Stethoscope size={20} /> Doctor Visit Schedule</h2>
            </div>
            <Link to="/ClinicLogsAndRecords" style={viewAllStyle} className="view-all-link">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {doctorAppointments.length === 0 ? (
            <p className="empty-state">No upcoming doctor appointments scheduled.</p>
          ) : (
            <div className="card-content-scroll">
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

      {/* Health Tips Modal */}
      <HealthTipsModal 
        isOpen={isTipsOpen} 
        onClose={() => setIsTipsOpen(false)} 
      />
    </div>
  );
};

export default StudentDashboard;