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
  FileSpreadsheet,
  Megaphone
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
  const [announcements, setAnnouncements] = useState([]);

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

        const [visitsRes, reqsRes, docsRes, screeningsRes, appointmentsRes, announcementsRes] = await Promise.all([
          fetch(`${API_BASE}/student/dashboard/visits-dispensation/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/requirements/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/document-requests/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/upcoming-health-screenings?${queryParams}`),
          fetch(`${API_BASE}/student/dashboard/doctor-appointments/${studentId}`),
          fetch(`${API_BASE}/student/dashboard/announcements/${studentId}`)
        ]);

        const responses = [
          { name: 'Visits & Dispensation', res: visitsRes },
          { name: 'Requirements', res: reqsRes },
          { name: 'Document Requests', res: docsRes },
          { name: 'Health Screenings', res: screeningsRes },
          { name: 'Doctor Appointments', res: appointmentsRes },
          { name: 'Announcements', res: announcementsRes }
        ];

        const failedEndpoints = responses.filter((r) => !r.res.ok);
        if (failedEndpoints.length > 0) {
          failedEndpoints.forEach((f) => console.error(`API Error on [${f.name}]: Status ${f.res.status}`));
          throw new Error('Failed to load parts of your health dashboard.');
        }

        const [visits, reqs, docs, screenings, appointments, announcementsData] = await Promise.all([
          visitsRes.json(),
          reqsRes.json(),
          docsRes.json(),
          screeningsRes.json(),
          appointmentsRes.json(),
          announcementsRes.json()
        ]);

        if (visits.success) setVisitsData(visits.data);
        if (reqs.success) setRequirementsData(reqs.data);
        if (docs.success) setDocumentRequestsData(docs.data);
        if (screenings.success) setHealthScreenings(screenings.data);
        if (appointments.success) setDoctorAppointments(appointments.data);
        if (announcementsData.success) setAnnouncements(announcementsData.data);

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
        return 'badge-sd badge-success-sd';
      case 'pending':
      case 'submitted':
        return 'badge-sd badge-warning-sd';
      case 'incomplete':
      case 'rejected':
      case 'resubmit':
      case 'missed':
      case 'not submitted':
        return 'badge-sd badge-danger-sd';
      default:
        return 'badge-sd badge-default-sd';
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
      <div className="loading-wrapper-sd">
        <div className="loading-spinner-sd">Loading your student health dashboard...</div>
      </div>
    );
  }

  return (
    <div className="wrapper-sd">
      
      {/* Header & Health Tips Banner */}
      <header className="header-sd">
        <div className="header-info-sd">
          <h1>Student Dashboard</h1>
          <p>Student ID: <span>{studentId}</span></p>
        </div>

        <div className="tips-card-sd">
          <div className="tip-content-sd">
            <div className="tip-header-sd">
              <span className="tip-category-sd">{dailyHealthTips[currentTipIndex].category}</span>
              <span className="tip-title-sd">{dailyHealthTips[currentTipIndex].title}</span>
            </div>
            <p className="tip-text-sd">{dailyHealthTips[currentTipIndex].text}</p>
          </div>
          <div className="tip-actions-sd">
            <button 
              onClick={() => setCurrentTipIndex((prev) => (prev + 1) % dailyHealthTips.length)}
              className="btn-icon-sec-sd"
              title="Next Tip"
              aria-label="Next Tip"
            >
              <ChevronRight size={16} />
            </button>
            <button 
              onClick={() => setIsTipsOpen(true)}
              className="btn-icon-pri-sd"
              title="All Tips"
              aria-label="All Health Tips"
            >
              <Lightbulb size={16} />
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert-error-sd"><AlertCircle size={16} /> {error}</div>}

      {/* QUICK ACTION BUTTONS */}
      <section className="quick-actions-bar-sd">
        <button 
          className="quick-action-card-sd"
          onClick={() => handleQuickRequest('excuse')}
        >
          <div className="quick-action-icon-sd excuse-icon-sd">
            <FileSpreadsheet size={18} />
          </div>
          <div className="quick-action-text-sd">
            <h4 className="quick-action-title-sd">Request Excuse Slip</h4>
            <p className="quick-action-sub-sd">Apply for class excuse slip</p>
          </div>
          <PlusCircle size={16} className="quick-action-add-sd excuse-add-sd" />
        </button>

        <button 
          className="quick-action-card-sd"
          onClick={() => handleQuickRequest('referral')}
        >
          <div className="quick-action-icon-sd referral-icon-sd">
            <Stethoscope size={18} />
          </div>
          <div className="quick-action-text-sd">
            <h4 className="quick-action-title-sd">Request Referral Slip</h4>
            <p className="quick-action-sub-sd">Request lab / hospital referral</p>
          </div>
          <PlusCircle size={16} className="quick-action-add-sd referral-add-sd" />
        </button>
      </section>

      {/* Main Grid Layout */}
      <main className="grid-sd">

        {/* 1. NURSE ANNOUNCEMENTS SECTION */}
        <section className="card-section-sd col-span-2-sd">
          <div className="card-header-sd">
            <div className="card-title-group-sd">
              <h2><Megaphone size={18} /> Nurse Announcements</h2>
              <span className="meta-count-sd">{announcements.length} New</span>
            </div>
          </div>

          {announcements.length === 0 ? (
            <p className="empty-state-sd">No active nurse announcements.</p>
          ) : (
            <div className="card-content-stack-sd">
              {announcements.slice(0, 3).map((ann) => (
                <div key={ann.announcement_id} className="item-card-sd info-card-sd">
                  <div className="item-card-row-sd">
                    <span className="item-title-sd">{ann.title}</span>
                    <span className="badge-sd badge-info-sd">
                      Nurse: {ann.nurse_name || 'Clinic Staff'}
                    </span>
                  </div>
                  <p className="item-subtext-sd" style={{ marginTop: '6px', fontSize: '0.9rem', color: '#334155' }}>
                    {ann.content}
                  </p>
                  <p className="item-subtext-sd" style={{ marginTop: '8px', fontSize: '0.78rem' }}>
                    Posted: <span>{formatDateTime(ann.created_at)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. OVERVIEW: Clinic Visits & Medicine Dispensation */}
        <section className="card-section-sd col-span-2-sd">
          <div className="card-header-sd">
            <div className="card-title-group-sd">
              <h2><Activity size={18} /> Recent Clinic Visits & Dispensations</h2>
              <span className="meta-count-sd">{visitsData.clinic_visits.length} Recent</span>
            </div>
            <Link to="/ClinicLogsAndRecords" className="view-all-link-sd">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {visitsData.clinic_visits.length === 0 && visitsData.direct_dispensations.length === 0 ? (
            <p className="empty-state-sd">No recent clinic visits or dispensations recorded.</p>
          ) : (
            <div className="card-content-stack-sd">
              {visitsData.clinic_visits.slice(0, 2).map((visit) => (
                <div key={visit.visit_id} className="visit-item-sd">
                  <div className="visit-item-header-sd">
                    <span className="visit-date-sd">
                      📅 Date: {formatDate(visit.visit_date)} ({visit.time_in || 'N/A'} - {visit.time_out || 'N/A'})
                    </span>
                  </div>

                  <div className="vitals-grid-sd">
                    <div className="vital-box-sd">
                      <span className="vital-label-sd">Temp</span>
                      <span className="vital-value-sd">{visit.vitals?.temperature || 'N/A'} °C</span>
                    </div>
                    <div className="vital-box-sd">
                      <span className="vital-label-sd">BP</span>
                      <span className="vital-value-sd">{visit.vitals?.blood_pressure || 'N/A'}</span>
                    </div>
                    <div className="vital-box-sd">
                      <span className="vital-label-sd">Pulse</span>
                      <span className="vital-value-sd">{visit.vitals?.pulse_rate || 'N/A'} bpm</span>
                    </div>
                    <div className="vital-box-sd">
                      <span className="vital-label-sd">Resp</span>
                      <span className="vital-value-sd">{visit.vitals?.respiratory_rate || 'N/A'} bpm</span>
                    </div>
                  </div>

                  <div className="visit-details-sd">
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

                  {/* Dispensed Medicines */}
                  {visit.dispensed_medicines?.length > 0 && (
                    <div className="meds-list-sd">
                      <span className="meds-title-sd">Dispensed Medicine:</span>
                      <div className="meds-tags-sd">
                        {visit.dispensed_medicines.map((med) => (
                          <span key={med.dispense_id} className="tag-pill-sd">
                            💊 <strong>{med.medicine_name || med.generic_name || med.brand_name || 'Medicine'}</strong> — {med.dosage_value} {med.dosage_unit || 'pcs'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Direct Dispensations */}
              {visitsData.direct_dispensations.length > 0 && (
                <div className="direct-dispense-sec-sd">
                  <h3 className="section-subtitle-sd">Direct Medicine Dispensations</h3>
                  <div className="direct-grid-sd">
                    {visitsData.direct_dispensations.slice(0, 2).map((direct) => (
                      <div key={direct.direct_dispense_id} className="direct-item-sd">
                        <div className="direct-item-row-sd">
                          <span>
                            💊 <strong>{direct.medicine_name || direct.generic_name || direct.brand_name || 'Medicine'}</strong>: {direct.dosage_consumption_unit_value} {direct.dosage_consumption_unit_of_measure || 'pcs'}
                          </span>
                        </div>
                        <p className="direct-timestamp-sd">Dispensed: {formatDateTime(direct.dispensed_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. OVERVIEW: Requirements & Status */}
        <section className="card-section-sd">
          <div className="card-header-sd">
            <div className="card-title-group-sd">
              <h2><ClipboardList size={18} /> Requirements</h2>
              {requirementsData.total_incomplete > 0 && (
                <span className="badge-sd badge-warning-sd">{requirementsData.total_incomplete} Incomplete</span>
              )}
            </div>
            <Link to="/MyRequirements" className="view-all-link-sd">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {requirementsData.all_requirements.length === 0 ? (
            <p className="empty-state-sd">No requirements assigned.</p>
          ) : (
            <div className="card-content-scroll-sd">
              {requirementsData.all_requirements.slice(0, 3).map((req, idx) => (
                <div key={idx} className="item-card-sd">
                  <div className="item-card-row-sd">
                    <span className="item-title-sd">{req.requirement_name}</span>
                    <span className={getStatusBadgeClass(req.status)}>{req.status}</span>
                  </div>

                  <p className="item-subtext-sd">Deadline: <span>{formatDate(req.submission_deadline)}</span></p>

                  {req.nurse_remarks && (
                    <div className="item-remarks-sd">
                      <strong>Remarks:</strong> {req.nurse_remarks}
                    </div>
                  )}

                  {req.file_url && (
                    <a 
                      href={getFileUrl(req.file_url)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="row-action-btn-sd"
                      title="View Submitted Document"
                      aria-label="View Submitted Document"
                    >
                      <Eye size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. OVERVIEW: Document Requests Updates */}
        <section className="card-section-sd">
          <div className="card-header-sd">
            <div className="card-title-group-sd">
              <h2><FileText size={18} /> Request Updates</h2>
            </div>
            <div className="tab-group-sd">
              {['all', 'excuse', 'referral'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDocTab(tab)}
                  className={`tab-btn-sd ${activeDocTab === tab ? 'active-sd' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Link to="/RequestModule" className="view-all-link-sd">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {documentRequestsData.recent_updates.length === 0 ? (
            <p className="empty-state-sd">No document request updates found.</p>
          ) : (
            <div className="card-content-scroll-sd">
              {documentRequestsData.recent_updates
                .filter((doc) => {
                  if (activeDocTab === 'excuse') return doc.request_type === 'Excuse Slip';
                  if (activeDocTab === 'referral') return doc.request_type === 'Referral Slip';
                  return true;
                })
                .slice(0, 3)
                .map((doc) => (
                  <div key={doc.request_id} className="item-card-sd">
                    <div className="item-card-row-sd">
                      <span className="item-title-sd">{doc.request_type}</span>
                      <span className={getStatusBadgeClass(doc.status)}>{doc.status || 'Pending'}</span>
                    </div>

                    <p className="item-subtext-sd"><strong>Reason:</strong> {doc.reason_for_excuse || doc.reason_for_referral || 'N/A'}</p>

                    {doc.valid_absence_start && (
                      <p className="item-subtext-sd">Absence: {formatDate(doc.valid_absence_start)} to {formatDate(doc.valid_absence_end)}</p>
                    )}

                    <div className="item-card-footer-sd">
                      <span className="item-subtext-sd">Req: {formatDate(doc.created_at)}</span>

                      {doc.issued_slip_url ? (
                        <a 
                          href={getFileUrl(doc.issued_slip_url)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="doc-action-btn-sd primary-doc-btn-sd"
                          title={`View Issued ${doc.request_type}`}
                          aria-label={`View Issued ${doc.request_type}`}
                        >
                          <Eye size={12} /> View Issued
                        </a>
                      ) : (
                        doc.student_proof_url && (
                          <a 
                            href={getFileUrl(doc.student_proof_url)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="doc-action-btn-sd secondary-doc-btn-sd"
                            title="View Attached Proof"
                            aria-label="View Attached Proof"
                          >
                            <Eye size={12} /> View Proof
                          </a>
                        )
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* 5. OVERVIEW: Upcoming Health Screenings */}
        <section className="card-section-sd">
          <div className="card-header-sd">
            <div className="card-title-group-sd">
              <h2><FileCheck size={18} /> Health Screenings</h2>
            </div>
            <Link to="/ClinicLogsAndRecords" className="view-all-link-sd">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {healthScreenings.length === 0 ? (
            <p className="empty-state-sd">No upcoming health screenings scheduled.</p>
          ) : (
            <div className="card-content-scroll-sd">
              {healthScreenings.slice(0, 3).map((screening) => (
                <div key={screening.screening_schedule_id} className="item-card-sd info-card-sd">
                  <div className="item-card-row-sd">
                    <span className="item-title-sd">{screening.title}</span>
                    <span className="badge-sd badge-info-sd">{screening.screening_type || 'General'}</span>
                  </div>

                  <div className="item-subtext-sd">
                    <p>📅 {formatDate(screening.scheduled_date)}</p>
                    <p>⏰ {screening.start_time} - {screening.end_time}</p>
                  </div>

                  {screening.announcement && (
                    <p className="item-announcement-sd">"{screening.announcement}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. OVERVIEW: Doctor Visit Schedule */}
        <section className="card-section-sd">
          <div className="card-header-sd">
            <div className="card-title-group-sd">
              <h2><Stethoscope size={18} /> Doctor Schedule</h2>
            </div>
            <Link to="/ClinicLogsAndRecords" className="view-all-link-sd">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {doctorAppointments.length === 0 ? (
            <p className="empty-state-sd">No upcoming doctor appointments scheduled.</p>
          ) : (
            <div className="card-content-scroll-sd">
              {doctorAppointments.slice(0, 3).map((appt) => (
                <div key={appt.appointment_id} className="item-card-sd accent-card-sd">
                  <div className="item-card-row-sd">
                    <span className="item-title-sd">{appt.title || 'Doctor Consultation'}</span>
                    <span className={getStatusBadgeClass(appt.attendance_status || appt.appointment_status)}>
                      {appt.attendance_status || appt.appointment_status || 'Scheduled'}
                    </span>
                  </div>

                  <div className="item-subtext-sd">
                    <p>🕒 Start: {formatDateTime(appt.start_time)}</p>
                    <p>🕒 End: {formatDateTime(appt.end_time)}</p>
                  </div>

                  {appt.announcement && (
                    <div className="item-announcement-sd">
                      <strong>Note:</strong> {appt.announcement}
                    </div>
                  )}

                  {appt.notes && <p className="item-notes-sd">Notes: {appt.notes}</p>}
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