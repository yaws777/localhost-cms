import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Pill, 
  FileText, 
  FileCheck, 
  Calendar, 
  Stethoscope, 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  UserCheck,
  User,
  Megaphone
} from 'lucide-react';
import '../../styles/parent/ParentDashboard.css';

const ParentDashboard = () => {
  const navigate = useNavigate();
  // Retrieve linked students passed down from ParentLayout outlet context
  const { linkedStudents = [], parentId = '' } = useOutletContext() || {};

  // Combined Dashboard state hooks
  const [visitsData, setVisitsData] = useState({ clinic_visits: [], direct_dispensations: [] });
  const [requirementsData, setRequirementsData] = useState({ all_requirements: [], total_assigned: 0, total_incomplete: 0 });
  const [documentRequestsData, setDocumentRequestsData] = useState({ recent_updates: [] });
  const [screeningsData, setScreeningsData] = useState([]);
  const [appointmentsData, setAppointmentsData] = useState([]);
  const [announcementsData, setAnnouncementsData] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch and aggregate dashboard metrics for ALL linked students
  useEffect(() => {
    if (!linkedStudents || linkedStudents.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchAllStudentsData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const studentPromises = linkedStudents.map(async (student) => {
          const queryParams = new URLSearchParams({
            programId: student?.program_id || student?.target_program_id || '',
            yearLevel: student?.year_level || student?.target_year_level || '',
            section: student?.section || student?.target_section || ''
          }).toString();

          const [visitsRes, reqsRes, docsRes, screeningsRes, apptsRes, annRes] = await Promise.all([
            fetch(`http://localhost:3001/api/student/dashboard/visits-dispensation/${student.student_id}`),
            fetch(`http://localhost:3001/api/student/dashboard/requirements/${student.student_id}`),
            fetch(`http://localhost:3001/api/student/dashboard/document-requests/${student.student_id}`),
            fetch(`http://localhost:3001/api/student/dashboard/upcoming-health-screenings?${queryParams}`),
            fetch(`http://localhost:3001/api/student/dashboard/doctor-appointments/${student.student_id}`),
            parentId
              ? fetch(`http://localhost:3001/api/parent/dashboard/announcements/${parentId}`)
              : fetch(`http://localhost:3001/api/student/dashboard/announcements/${student.student_id}`)
          ]);

          const [visitsJson, reqsJson, docsJson, screeningsJson, apptsJson, annJson] = await Promise.all([
            visitsRes.json(),
            reqsRes.json(),
            docsRes.json(),
            screeningsRes.json(),
            apptsRes.json(),
            annRes.json()
          ]);

          const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${student.student_id}`;

          return {
            studentName,
            visits: visitsJson.success ? visitsJson.data : { clinic_visits: [], direct_dispensations: [] },
            reqs: reqsJson.success ? reqsJson.data : { all_requirements: [], total_assigned: 0, total_incomplete: 0 },
            docs: docsJson.success ? docsJson.data : { recent_updates: [] },
            screenings: screeningsJson.success ? screeningsJson.data : [],
            appts: apptsJson.success ? apptsJson.data : [],
            announcements: annJson.success ? annJson.data : []
          };
        });

        const results = await Promise.all(studentPromises);

        let combinedVisits = [];
        let combinedDirectDispenses = [];
        let combinedReqs = [];
        let totalAssigned = 0;
        let combinedDocs = [];
        let combinedScreenings = [];
        let combinedAppts = [];
        let combinedAnnouncementsMap = new Map();

        results.forEach((res) => {
          const name = res.studentName;

          if (res.visits?.clinic_visits) {
            combinedVisits.push(...res.visits.clinic_visits.map(v => ({ ...v, studentName: name })));
          }
          if (res.visits?.direct_dispensations) {
            combinedDirectDispenses.push(...res.visits.direct_dispensations.map(dd => ({ ...dd, studentName: name })));
          }

          if (res.reqs?.all_requirements) {
            combinedReqs.push(...res.reqs.all_requirements.map(r => ({ ...r, studentName: name })));
          }
          totalAssigned += (res.reqs?.total_assigned || 0);

          if (res.docs?.recent_updates) {
            combinedDocs.push(...res.docs.recent_updates.map(d => ({ ...d, studentName: name })));
          }

          if (res.screenings) {
            combinedScreenings.push(...res.screenings.map(s => ({ ...s, studentName: name })));
          }

          if (res.appts) {
            combinedAppts.push(...res.appts.map(a => ({ ...a, studentName: name })));
          }

          if (res.announcements) {
            res.announcements.forEach((ann) => {
              if (!combinedAnnouncementsMap.has(ann.announcement_id)) {
                combinedAnnouncementsMap.set(ann.announcement_id, { ...ann, studentName: name });
              }
            });
          }
        });

        const combinedAnnouncements = Array.from(combinedAnnouncementsMap.values());

        // Calculate strictly 'Pending' status count (excludes 'Not Submitted', 'Incomplete', etc.)
        const totalPending = combinedReqs.filter(
          (req) => req.status && req.status.trim().toLowerCase() === 'pending'
        ).length;

        // Sort combined datasets by date descending/ascending where applicable
        combinedVisits.sort((a, b) => new Date(b.visit_date || 0) - new Date(a.visit_date || 0));
        combinedDirectDispenses.sort((a, b) => new Date(b.dispensed_at || 0) - new Date(a.dispensed_at || 0));
        combinedDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        combinedAppts.sort((a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));
        combinedScreenings.sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));
        combinedAnnouncements.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        setVisitsData({ clinic_visits: combinedVisits, direct_dispensations: combinedDirectDispenses });
        setRequirementsData({ all_requirements: combinedReqs, total_assigned: totalAssigned, total_incomplete: totalPending });
        setDocumentRequestsData({ recent_updates: combinedDocs });
        setScreeningsData(combinedScreenings);
        setAppointmentsData(combinedAppts);
        setAnnouncementsData(combinedAnnouncements);

      } catch (err) {
        console.error("Error fetching combined dashboard data:", err);
        setError("Unable to load student metrics. Please check connection.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllStudentsData();
  }, [linkedStudents, parentId]);

  // Navigation handlers
  const handleNavigateToClinic = () => navigate('/ChildClinicRecords');
  const handleNavigateToProfile = () => navigate('/ChildProfile');

  // Helper date formatters
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper status pill renderer
  const renderStatusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase();
    let badgeClass = 'pd-badge-pending';
    let icon = <Clock size={11} />;

    if (['approved', 'completed', 'submitted', 'verified'].includes(s)) {
      badgeClass = 'pd-badge-success';
      icon = <CheckCircle2 size={11} />;
    } else if (['rejected', 'incomplete', 'overdue'].includes(s)) {
      badgeClass = 'pd-badge-danger';
      icon = <XCircle size={11} />;
    } else if (['resubmit', 'action required'].includes(s)) {
      badgeClass = 'pd-badge-warning';
      icon = <AlertCircle size={11} />;
    }

    return (
      <span className={`pd-status-badge ${badgeClass}`}>
        {icon}
        <span>{status}</span>
      </span>
    );
  };

  // Helper badge to explicitly identify student ownership
  const renderStudentBadge = (studentName) => (
    <span className="pd-student-badge">
      <User size={10} /> {studentName}
    </span>
  );

  if (isLoading) {
    return (
      <div className="pd-loading-container">
        <div className="pd-spinner"></div>
        <p>Loading combined student overview...</p>
      </div>
    );
  }

  // Limited slice amounts to optimize viewport fit
  const recentVisits = visitsData.clinic_visits ? visitsData.clinic_visits.slice(0, 2) : [];
  const recentDirectDispenses = visitsData.direct_dispensations ? visitsData.direct_dispensations.slice(0, 2) : [];

  return (
    <div className="pd-wrapper">

      {error && <div className="pd-error-banner">{error}</div>}

      <div className="pd-grid">

        {/* 1. NURSE ANNOUNCEMENTS CARD */}
        <section className="pd-card pd-card-large">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <Megaphone className="pd-header-icon pd-text-blue" size={18} />
              <h2>Nurse Announcements</h2>
            </div>
          </div>

          <div className="pd-card-body">
            {announcementsData.length === 0 ? (
              <p className="pd-empty-state">No active nurse announcements.</p>
            ) : (
              <ul className="pd-overview-list">
                {announcementsData.slice(0, 3).map((ann, idx) => (
                  <li key={ann.announcement_id || idx} className="pd-overview-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <div className="pd-flex-gap" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{ann.title}</strong>
                      <span className="pd-visit-date">Nurse: {ann.nurse_name || 'Clinic Staff'}</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#475569' }}>{ann.content}</p>
                    <span className="pd-dispense-time">Posted: {formatDateTime(ann.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 2. RECENT CLINIC VISITS & MEDICINE DISPENSATION */}
        <section className="pd-card pd-card-large">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <Activity className="pd-header-icon pd-text-blue" size={18} />
              <h2>Recent Clinic Visits & Medicine Dispensation</h2>
            </div>
            <button className="pd-view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="pd-card-body">
            <h3 className="pd-section-subtitle">
              <UserCheck size={14} /> Latest Clinic Visits
            </h3>
            {recentVisits.length === 0 ? (
              <p className="pd-empty-state">No recent clinic visits logged.</p>
            ) : (
              <div className="pd-visits-list">
                {recentVisits.map((visit, idx) => (
                  <div key={visit.visit_id || idx} className="pd-visit-item">
                    <div className="pd-visit-top-row">
                      <div className="pd-flex-gap">
                        <span className="pd-visit-complaint">
                          {visit.complaint_name || visit.specify_complaint_text || 'General Consultation'}
                        </span>
                        {renderStudentBadge(visit.studentName)}
                      </div>
                      <span className="pd-visit-date">{formatDate(visit.visit_date)} ({visit.time_in || '--'})</span>
                    </div>

                    <div className="pd-vitals-row">
                      {visit.vitals?.temperature && <span>Temp: <strong>{visit.vitals.temperature}°C</strong></span>}
                      {visit.vitals?.blood_pressure && <span>BP: <strong>{visit.vitals.blood_pressure}</strong></span>}
                      {visit.vitals?.pulse_rate && <span>Pulse: <strong>{visit.vitals.pulse_rate} bpm</strong></span>}
                    </div>

                    {visit.assessment && (
                      <p className="pd-visit-detail"><strong>Assessment:</strong> {visit.assessment}</p>
                    )}

                    {visit.dispensed_medicines && visit.dispensed_medicines.length > 0 && (
                      <div className="pd-med-tags">
                        <span className="pd-tag-label"><Pill size={11} /> Dispensed:</span>
                        {visit.dispensed_medicines.map((med) => (
                          <span key={med.dispense_id} className="pd-med-tag">
                            {med.medicine_name} - {med.dosage_value} {med.dosage_unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h3 className="pd-section-subtitle pd-mt-8">
              <Pill size={14} /> Direct Medicine Dispensations
            </h3>
            {recentDirectDispenses.length === 0 ? (
              <p className="pd-empty-state">No recent direct medicine dispensations.</p>
            ) : (
              <ul className="pd-direct-dispense-list">
                {recentDirectDispenses.map((dd, idx) => (
                  <li key={dd.direct_dispense_id || idx} className="pd-direct-dispense-item">
                    <div className="pd-flex-gap">
                      <strong>{dd.medicine_name}</strong>
                      <span className="pd-sub-detail">({dd.dosage_consumption_unit_value} {dd.dosage_consumption_unit_of_measure})</span>
                      {renderStudentBadge(dd.studentName)}
                    </div>
                    <span className="pd-dispense-time">{formatDateTime(dd.dispensed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 3. OVERVIEW OF REQUIREMENTS STATUS */}
        <section className="pd-card">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <FileCheck className="pd-header-icon pd-text-green" size={18} />
              <h2>Medical Requirements</h2>
            </div>
            <button className="pd-view-all-btn" onClick={handleNavigateToProfile}>
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="pd-card-body">
            <div className="pd-summary-container">
              <div className="pd-metric-box">
                <span className="pd-metric-val">{requirementsData.total_assigned || 0}</span>
                <span className="pd-metric-lbl">Assigned</span>
              </div>
              <div className="pd-metric-box pd-warning">
                <span className="pd-metric-val">{requirementsData.total_incomplete || 0}</span>
                <span className="pd-metric-lbl">Pending</span>
              </div>
            </div>

            {(!requirementsData.all_requirements || requirementsData.all_requirements.length === 0) ? (
              <p className="pd-empty-state">No requirements currently requested.</p>
            ) : (
              <ul className="pd-overview-list">
                {requirementsData.all_requirements.slice(0, 3).map((req, idx) => (
                  <li key={idx} className="pd-overview-item">
                    <div className="pd-item-info">
                      <div className="pd-flex-gap">
                        <span className="pd-item-title">{req.requirement_name}</span>
                        {renderStudentBadge(req.studentName)}
                      </div>
                      <span className="pd-item-sub">
                        Deadline: {req.submission_deadline ? formatDate(req.submission_deadline) : 'No Deadline'}
                      </span>
                    </div>
                    <div>{renderStatusBadge(req.status)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 4. DOCUMENT REQUEST UPDATES */}
        <section className="pd-card">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <FileText className="pd-header-icon pd-text-amber" size={18} />
              <h2>Document Requests</h2>
            </div>
            <button className="pd-view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="pd-card-body">
            {(!documentRequestsData.recent_updates || documentRequestsData.recent_updates.length === 0) ? (
              <p className="pd-empty-state">No recent document request updates.</p>
            ) : (
              <ul className="pd-overview-list">
                {documentRequestsData.recent_updates.slice(0, 3).map((doc, idx) => (
                  <li key={`${doc.request_type}-${doc.request_id || idx}`} className="pd-overview-item">
                    <div className="pd-item-info">
                      <div className="pd-flex-gap">
                        <span className="pd-type-badge">{doc.request_type}</span>
                        <span className="pd-item-title-sm">
                          {doc.reason_for_excuse || doc.reason_for_referral || 'Request Record'}
                        </span>
                        {renderStudentBadge(doc.studentName)}
                      </div>
                      <span className="pd-item-sub">Requested: {formatDate(doc.created_at)}</span>
                    </div>
                    <div>{renderStatusBadge(doc.status)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 5. UPCOMING HEALTH SCREENING */}
        <section className="pd-card">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <Calendar className="pd-header-icon pd-text-purple" size={18} />
              <h2>Health Screenings</h2>
            </div>
            <button className="pd-view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="pd-card-body">
            {screeningsData.length === 0 ? (
              <p className="pd-empty-state">No upcoming health screenings scheduled.</p>
            ) : (
              <div className="pd-schedule-list">
                {screeningsData.slice(0, 2).map((screening, idx) => (
                  <div key={screening.screening_schedule_id || idx} className="pd-schedule-item">
                    <div className="pd-schedule-date-box">
                      <span className="pd-date-num">
                        {new Date(screening.scheduled_date).getDate()}
                      </span>
                      <span className="pd-date-month">
                        {new Date(screening.scheduled_date).toLocaleString('en-US', { month: 'short' })}
                      </span>
                    </div>

                    <div className="pd-schedule-details">
                      <div className="pd-flex-gap">
                        <h4 className="pd-schedule-title">{screening.title}</h4>
                        {renderStudentBadge(screening.studentName)}
                      </div>
                      <p className="pd-schedule-time">
                        <Clock size={11} /> {screening.start_time} - {screening.end_time}
                      </p>
                      {screening.announcement && (
                        <p className="pd-schedule-announcement">{screening.announcement}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 6. UPCOMING DOCTOR VISIT SCHEDULE */}
        <section className="pd-card">
          <div className="pd-card-header">
            <div className="pd-card-title">
              <Stethoscope className="pd-header-icon pd-text-teal" size={18} />
              <h2>Doctor Visits</h2>
            </div>
            <button className="pd-view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="pd-card-body">
            {appointmentsData.length === 0 ? (
              <p className="pd-empty-state">No upcoming doctor appointments scheduled.</p>
            ) : (
              <div className="pd-schedule-list">
                {appointmentsData.slice(0, 2).map((appt, idx) => (
                  <div key={appt.appointment_id || idx} className="pd-schedule-item pd-border-teal">
                    <div className="pd-schedule-date-box pd-bg-teal">
                      <span className="pd-date-num">
                        {new Date(appt.start_time).getDate()}
                      </span>
                      <span className="pd-date-month">
                        {new Date(appt.start_time).toLocaleString('en-US', { month: 'short' })}
                      </span>
                    </div>

                    <div className="pd-schedule-details">
                      <div className="pd-flex-gap">
                        <h4 className="pd-schedule-title">{appt.title || 'Doctor Consultation'}</h4>
                        {renderStudentBadge(appt.studentName)}
                      </div>
                      <p className="pd-schedule-time">
                        <Clock size={11} /> {formatDateTime(appt.start_time)}
                      </p>
                      <div className="pd-status-meta">
                        {renderStatusBadge(appt.appointment_status)}
                        {appt.attendance_status && (
                          <span className="pd-attendance-pill">{appt.attendance_status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default ParentDashboard;