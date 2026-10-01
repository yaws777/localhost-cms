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
  User
} from 'lucide-react';
import '../../styles/parent/ParentDashboard.css';

const ParentDashboard = () => {
  const navigate = useNavigate();
  // Retrieve linked students passed down from ParentLayout outlet context
  const { linkedStudents = [] } = useOutletContext() || {};

  // Combined Dashboard state hooks
  const [visitsData, setVisitsData] = useState({ clinic_visits: [], direct_dispensations: [] });
  const [requirementsData, setRequirementsData] = useState({ all_requirements: [], total_assigned: 0, total_incomplete: 0 });
  const [documentRequestsData, setDocumentRequestsData] = useState({ recent_updates: [] });
  const [screeningsData, setScreeningsData] = useState([]);
  const [appointmentsData, setAppointmentsData] = useState([]);

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

          const [visitsRes, reqsRes, docsRes, screeningsRes, apptsRes] = await Promise.all([
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/visits-dispensation/${student.student_id}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/requirements/${student.student_id}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/document-requests/${student.student_id}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/upcoming-health-screenings?${queryParams}`),
            fetch(`https://localhost-cms.onrender.com/api/student/dashboard/doctor-appointments/${student.student_id}`)
          ]);

          const [visitsJson, reqsJson, docsJson, screeningsJson, apptsJson] = await Promise.all([
            visitsRes.json(),
            reqsRes.json(),
            docsRes.json(),
            screeningsRes.json(),
            apptsRes.json()
          ]);

          const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${student.student_id}`;

          return {
            studentName,
            visits: visitsJson.success ? visitsJson.data : { clinic_visits: [], direct_dispensations: [] },
            reqs: reqsJson.success ? reqsJson.data : { all_requirements: [], total_assigned: 0, total_incomplete: 0 },
            docs: docsJson.success ? docsJson.data : { recent_updates: [] },
            screenings: screeningsJson.success ? screeningsJson.data : [],
            appts: apptsJson.success ? apptsJson.data : []
          };
        });

        const results = await Promise.all(studentPromises);

        let combinedVisits = [];
        let combinedDirectDispenses = [];
        let combinedReqs = [];
        let totalAssigned = 0;
        let totalIncomplete = 0;
        let combinedDocs = [];
        let combinedScreenings = [];
        let combinedAppts = [];

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
          totalIncomplete += (res.reqs?.total_incomplete || 0);

          if (res.docs?.recent_updates) {
            combinedDocs.push(...res.docs.recent_updates.map(d => ({ ...d, studentName: name })));
          }

          if (res.screenings) {
            combinedScreenings.push(...res.screenings.map(s => ({ ...s, studentName: name })));
          }

          if (res.appts) {
            combinedAppts.push(...res.appts.map(a => ({ ...a, studentName: name })));
          }
        });

        // Sort combined datasets by date descending/ascending where applicable
        combinedVisits.sort((a, b) => new Date(b.visit_date || 0) - new Date(a.visit_date || 0));
        combinedDirectDispenses.sort((a, b) => new Date(b.dispensed_at || 0) - new Date(a.dispensed_at || 0));
        combinedDocs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        combinedAppts.sort((a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));
        combinedScreenings.sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));

        setVisitsData({ clinic_visits: combinedVisits, direct_dispensations: combinedDirectDispenses });
        setRequirementsData({ all_requirements: combinedReqs, total_assigned: totalAssigned, total_incomplete: totalIncomplete });
        setDocumentRequestsData({ recent_updates: combinedDocs });
        setScreeningsData(combinedScreenings);
        setAppointmentsData(combinedAppts);

      } catch (err) {
        console.error("Error fetching combined dashboard data:", err);
        setError("Unable to load student metrics. Please check connection.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllStudentsData();
  }, [linkedStudents]);

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
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper status pill renderer
  const renderStatusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase();
    let badgeClass = 'badge-pending';
    let icon = <Clock size={12} />;

    if (['approved', 'completed', 'submitted', 'verified'].includes(s)) {
      badgeClass = 'badge-success';
      icon = <CheckCircle2 size={12} />;
    } else if (['rejected', 'incomplete', 'overdue'].includes(s)) {
      badgeClass = 'badge-danger';
      icon = <XCircle size={12} />;
    } else if (['resubmit', 'action required'].includes(s)) {
      badgeClass = 'badge-warning';
      icon = <AlertCircle size={12} />;
    }

    return (
      <span className={`status-badge ${badgeClass}`}>
        {icon}
        <span>{status}</span>
      </span>
    );
  };

  // Helper badge to explicitly identify student ownership
  const renderStudentBadge = (studentName) => (
    <span className="student-name-badge">
      <User size={11} /> {studentName}
    </span>
  );

  if (isLoading) {
    return (
      <div className="dashboard-loading-container">
        <div className="spinner"></div>
        <p>Loading combined student overview...</p>
      </div>
    );
  }

  const recentVisits = visitsData.clinic_visits ? visitsData.clinic_visits.slice(0, 4) : [];
  const recentDirectDispenses = visitsData.direct_dispensations ? visitsData.direct_dispensations.slice(0, 4) : [];

  return (
    <div className="parent-dashboard-wrapper">

      {error && <div className="dashboard-error-banner">{error}</div>}

      <div className="dashboard-grid">

        {/* 1. RECENT CLINIC VISITS & MEDICINE DISPENSATION */}
        <section className="dashboard-card card-large">
          <div className="card-header">
            <div className="card-title">
              <Activity className="header-icon text-blue" size={20} />
              <h2>Recent Clinic Visits & Medicine Dispensation</h2>
            </div>
            <button className="view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div className="card-body">
            <h3 className="section-subtitle">
              <UserCheck size={16} /> Latest Clinic Visits
            </h3>
            {recentVisits.length === 0 ? (
              <p className="empty-state-text">No recent clinic visits logged.</p>
            ) : (
              <div className="visits-list">
                {recentVisits.map((visit, idx) => (
                  <div key={visit.visit_id || idx} className="visit-item-card">
                    <div className="visit-top-row">
                      <div className="flex-align-gap">
                        <span className="visit-complaint">
                          {visit.complaint_name || visit.specify_complaint_text || 'General Consultation'}
                        </span>
                        {renderStudentBadge(visit.studentName)}
                      </div>
                      <span className="visit-date">{formatDate(visit.visit_date)} ({visit.time_in || '--'})</span>
                    </div>

                    <div className="vitals-row">
                      {visit.vitals?.temperature && <span>Temp: <strong>{visit.vitals.temperature}°C</strong></span>}
                      {visit.vitals?.blood_pressure && <span>BP: <strong>{visit.vitals.blood_pressure}</strong></span>}
                      {visit.vitals?.pulse_rate && <span>Pulse: <strong>{visit.vitals.pulse_rate} bpm</strong></span>}
                    </div>

                    {visit.assessment && (
                      <p className="visit-detail"><strong>Assessment:</strong> {visit.assessment}</p>
                    )}

                    {visit.dispensed_medicines && visit.dispensed_medicines.length > 0 && (
                      <div className="dispensed-medicines-tag-list">
                        <span className="tag-label"><Pill size={12} /> Prescribed/Dispensed:</span>
                        {visit.dispensed_medicines.map((med) => (
                          <span key={med.dispense_id} className="medicine-tag">
                            {med.medicine_name} - {med.dosage_value} {med.dosage_unit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h3 className="section-subtitle mt-16">
              <Pill size={16} /> Standalone Medicine Dispensations
            </h3>
            {recentDirectDispenses.length === 0 ? (
              <p className="empty-state-text">No recent standalone medicine dispensations.</p>
            ) : (
              <ul className="direct-dispense-list">
                {recentDirectDispenses.map((dd, idx) => (
                  <li key={dd.direct_dispense_id || idx} className="direct-dispense-item">
                    <div className="flex-align-gap">
                      <strong>{dd.medicine_name}</strong>
                      <span className="sub-detail">({dd.dosage_consumption_unit_value} {dd.dosage_consumption_unit_of_measure})</span>
                      {renderStudentBadge(dd.studentName)}
                    </div>
                    <span className="dispense-time">{formatDateTime(dd.dispensed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 2. OVERVIEW OF REQUIREMENTS STATUS */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <FileCheck className="header-icon text-green" size={20} />
              <h2>Medical Requirements Status</h2>
            </div>
            <button className="view-all-btn" onClick={handleNavigateToProfile}>
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div className="card-body">
            <div className="summary-pill-container">
              <div className="metric-box">
                <span className="metric-val">{requirementsData.total_assigned || 0}</span>
                <span className="metric-lbl">Total Assigned</span>
              </div>
              <div className="metric-box warning">
                <span className="metric-val">{requirementsData.total_incomplete || 0}</span>
                <span className="metric-lbl">Incomplete / Pending</span>
              </div>
            </div>

            {(!requirementsData.all_requirements || requirementsData.all_requirements.length === 0) ? (
              <p className="empty-state-text">No requirements currently requested.</p>
            ) : (
              <ul className="overview-list">
                {requirementsData.all_requirements.slice(0, 5).map((req, idx) => (
                  <li key={idx} className="overview-item">
                    <div className="item-main-info">
                      <div className="flex-align-gap">
                        <span className="item-title">{req.requirement_name}</span>
                        {renderStudentBadge(req.studentName)}
                      </div>
                      <span className="item-sub text-muted">
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

        {/* 3. DOCUMENT REQUEST UPDATES */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <FileText className="header-icon text-amber" size={20} />
              <h2>Document Requests</h2>
            </div>
            <button className="view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div className="card-body">
            {(!documentRequestsData.recent_updates || documentRequestsData.recent_updates.length === 0) ? (
              <p className="empty-state-text">No recent document request updates.</p>
            ) : (
              <ul className="overview-list">
                {documentRequestsData.recent_updates.slice(0, 5).map((doc, idx) => (
                  <li key={`${doc.request_type}-${doc.request_id || idx}`} className="overview-item">
                    <div className="item-main-info">
                      <div className="flex-align-gap">
                        <span className="type-badge">{doc.request_type}</span>
                        <span className="item-title-sm">
                          {doc.reason_for_excuse || doc.reason_for_referral || 'Request Record'}
                        </span>
                        {renderStudentBadge(doc.studentName)}
                      </div>
                      <span className="item-sub text-muted">Requested on: {formatDate(doc.created_at)}</span>
                    </div>
                    <div>{renderStatusBadge(doc.status)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 4. UPCOMING HEALTH SCREENING */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <Calendar className="header-icon text-purple" size={20} />
              <h2>Upcoming Health Screenings</h2>
            </div>
            <button className="view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div className="card-body">
            {screeningsData.length === 0 ? (
              <p className="empty-state-text">No upcoming health screenings scheduled.</p>
            ) : (
              <div className="schedule-cards-list">
                {screeningsData.slice(0, 4).map((screening, idx) => (
                  <div key={screening.screening_schedule_id || idx} className="schedule-item-card">
                    <div className="schedule-date-box">
                      <span className="date-num">
                        {new Date(screening.scheduled_date).getDate()}
                      </span>
                      <span className="date-month">
                        {new Date(screening.scheduled_date).toLocaleString('en-US', { month: 'short' })}
                      </span>
                    </div>

                    <div className="schedule-details">
                      <div className="flex-align-gap">
                        <h4 className="schedule-title">{screening.title}</h4>
                        {renderStudentBadge(screening.studentName)}
                      </div>
                      <p className="schedule-time">
                        <Clock size={12} /> {screening.start_time} - {screening.end_time}
                      </p>
                      {screening.announcement && (
                        <p className="schedule-announcement">{screening.announcement}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. UPCOMING DOCTOR VISIT SCHEDULE */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <Stethoscope className="header-icon text-teal" size={20} />
              <h2>Upcoming Doctor Visits</h2>
            </div>
            <button className="view-all-btn" onClick={handleNavigateToClinic}>
              View All <ChevronRight size={16} />
            </button>
          </div>

          <div className="card-body">
            {appointmentsData.length === 0 ? (
              <p className="empty-state-text">No upcoming doctor appointments scheduled.</p>
            ) : (
              <div className="schedule-cards-list">
                {appointmentsData.slice(0, 4).map((appt, idx) => (
                  <div key={appt.appointment_id || idx} className="schedule-item-card border-teal">
                    <div className="schedule-date-box bg-teal">
                      <span className="date-num">
                        {new Date(appt.start_time).getDate()}
                      </span>
                      <span className="date-month">
                        {new Date(appt.start_time).toLocaleString('en-US', { month: 'short' })}
                      </span>
                    </div>

                    <div className="schedule-details">
                      <div className="flex-align-gap">
                        <h4 className="schedule-title">{appt.title || 'Doctor Consultation'}</h4>
                        {renderStudentBadge(appt.studentName)}
                      </div>
                      <p className="schedule-time">
                        <Clock size={12} /> {formatDateTime(appt.start_time)}
                      </p>
                      <div className="status-meta">
                        {renderStatusBadge(appt.appointment_status)}
                        {appt.attendance_status && (
                          <span className="attendance-pill">Attendance: {appt.attendance_status}</span>
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