import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import '../../styles/parent/ParentDashboard.css';

const API_BASE_URL = 'http://localhost:3001/api';

export default function ParentDashboard() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [activeStudentId, setActiveStudentId] = useState('');
    const [loading, setLoading] = useState(true);

    // Context from ParentLayout
    const context = useOutletContext(); 
    const selectedChildId = context?.selectedChildId || localStorage.getItem('selectedStudentId');

    // Dashboard Data States
    const [clinicVisits, setClinicVisits] = useState([]);
    const [dispensations, setDispensations] = useState([]);
    const [requirements, setRequirements] = useState([]);
    const [screenings, setScreenings] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [documents, setDocuments] = useState([]);

    useEffect(() => {
        const parseArrayData = async (response, fallbackKeys = []) => {
            if (!response.ok) return [];
            try {
                const json = await response.json();
                if (Array.isArray(json)) return json;
                if (Array.isArray(json.data)) return json.data;
                for (const key of fallbackKeys) {
                    if (Array.isArray(json[key])) return json[key];
                }
                return [];
            } catch (err) {
                console.error("Error parsing response JSON:", err);
                return [];
            }
        };

        const fetchAllData = async (studentId, programId, yearLevel, section) => {
            try {
                const [
                    visitsRes, dispenseRes, reqsRes, screeningsRes,
                    appointmentsRes, incidentsRes, docsRes
                ] = await Promise.all([
                    fetch(`${API_BASE_URL}/student/${studentId}/clinic-visits`),
                    fetch(`${API_BASE_URL}/student/${studentId}/dispensations`),
                    fetch(`${API_BASE_URL}/student/${studentId}/requirements`),
                    fetch(`${API_BASE_URL}/student/${studentId}/screenings?programId=${programId}&yearLevel=${yearLevel}&section=${section}`),
                    fetch(`${API_BASE_URL}/student/${studentId}/doctor-appointments`),
                    fetch(`${API_BASE_URL}/student/${studentId}/incidents`),
                    fetch(`${API_BASE_URL}/student/${studentId}/document-requests`)
                ]);

                const [
                    visitsData, dispenseData, reqsData, screeningsData,
                    appointmentsData, incidentsData, docsData
                ] = await Promise.all([
                    parseArrayData(visitsRes, ['visits', 'clinicVisits']),
                    parseArrayData(dispenseRes, ['dispensations', 'medicines']),
                    parseArrayData(reqsRes, ['requirements']),
                    parseArrayData(screeningsRes, ['screenings']),
                    parseArrayData(appointmentsRes, ['appointments', 'doctorAppointments']),
                    parseArrayData(incidentsRes, ['incidents', 'incidentReports']),
                    parseArrayData(docsRes, ['documents', 'documentRequests'])
                ]);

                setClinicVisits(visitsData);
                setDispensations(dispenseData);
                setRequirements(reqsData);
                setScreenings(screeningsData);
                setAppointments(appointmentsData);
                setIncidents(incidentsData);
                setDocuments(docsData);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        const storedUser = localStorage.getItem('user');
        const studentId = selectedChildId || localStorage.getItem('selectedStudentId');
        
        if (storedUser && studentId) {
            const user = JSON.parse(storedUser);
            setUserData(user);
            setActiveStudentId(studentId);
            setLoading(true);

            fetch(`${API_BASE_URL}/get-student-by-studentId/${studentId}`)
                .then(res => res.json())
                .then(childJson => {
                    const student = childJson.student || childJson.data || childJson;
                    if (student && (student.program_id || student.year_level || student.section)) {
                        const { program_id = '', year_level = '', section = '' } = student;
                        fetchAllData(studentId, program_id, year_level, section);
                    } else {
                        fetchAllData(studentId, '', '', '');
                    }
                })
                .catch(error => {
                    console.error("Failed to fetch child profile details:", error);
                    fetchAllData(studentId, '', '', '');
                });

        } else {
            navigate('/');
        }
    }, [navigate, selectedChildId]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Helper navigation handler to direct to internal child route
    const handleViewAll = (targetPath, tabName = '') => {
        navigate(targetPath, { state: { activeTab: tabName } });
    };

    if (!userData || loading) return <div className="loading-screen">Loading student records...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1>Parent Dashboard</h1>
                    <h2>Welcome, {userData.firstName || userData.first_name} {userData.lastName || userData.last_name}!</h2>
                    <p>Parent ID: {userData.id || userData.parent_id} | Student ID: {activeStudentId}</p>
                </div>
            </header>

            <div className="dashboard-grid">
                
                {/* 1. Clinic Visits Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Recent Clinic Visits</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'visits')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {clinicVisits.length === 0 ? (
                        <p className="empty-state">No recent visits.</p>
                    ) : (
                        clinicVisits.slice(0, 2).map((visit, idx) => (
                            <div key={idx} className="card-item-summary">
                                <div>
                                    <strong>{formatDate(visit.visit_date)}</strong>
                                    <p className="summary-subtext">{visit.nursing_intervention || 'Routine checkup'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </section>

                {/* 2. Medicine Dispensations Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Medicine Dispensations</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'dispensations')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {dispensations.length === 0 ? (
                        <p className="empty-state">No medicines dispensed recently.</p>
                    ) : (
                        dispensations.slice(0, 2).map((med, idx) => (
                            <div key={idx} className="card-item-summary">
                                <div>
                                    <strong>{med.type || 'Medicine'}</strong>
                                    <p className="summary-subtext">Dispensed: {formatDate(med.dispensed_at)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </section>

                {/* 3. List of Requirements Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Special Requirements</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'requirements')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {requirements.length === 0 ? (
                        <p className="empty-state">No requirements listed.</p>
                    ) : (
                        requirements.slice(0, 2).map((req, idx) => (
                            <div key={idx} className="card-item-summary flex-between">
                                <div>
                                    <strong>{req.requirement_name}</strong>
                                    <p className="summary-subtext">Due: {formatDate(req.submission_deadline)}</p>
                                </div>
                                <span className={`status-badge ${req.status?.toLowerCase() || 'pending'}`}>
                                    {req.status || 'Pending'}
                                </span>
                            </div>
                        ))
                    )}
                </section>

                {/* 4. Health Screenings Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Upcoming Screenings</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'screenings')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {screenings.length === 0 ? (
                        <p className="empty-state">No upcoming screenings.</p>
                    ) : (
                        screenings.slice(0, 2).map((screen, idx) => (
                            <div key={idx} className="card-item-summary">
                                <div>
                                    <strong>{screen.title}</strong>
                                    <p className="summary-subtext">Date: {formatDate(screen.scheduled_date)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </section>

                {/* 5. Doctor Appointments Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Doctor Appointments</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'appointments')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {appointments.length === 0 ? (
                        <p className="empty-state">No recent appointments.</p>
                    ) : (
                        appointments.slice(0, 2).map((appt, idx) => (
                            <div key={idx} className="card-item-summary flex-between">
                                <div>
                                    <strong>{appt.title}</strong>
                                    <p className="summary-subtext">{formatDate(appt.start_time)}</p>
                                </div>
                                <span className="status-badge">{appt.appointment_status || 'Scheduled'}</span>
                            </div>
                        ))
                    )}
                </section>

                {/* 6. Incident Reports Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Incident Reports</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'incidents')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {incidents.length === 0 ? (
                        <p className="empty-state">No incidents reported.</p>
                    ) : (
                        incidents.slice(0, 2).map((incident, idx) => (
                            <div key={idx} className="card-item-summary">
                                <div>
                                    <strong>{formatDate(incident.incident_datetime)}</strong>
                                    <p className="summary-subtext">Location: {incident.incident_location || 'Campus'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </section>

                {/* 7. Document Requests Summary */}
                <section className="dashboard-card">
                    <div className="card-header">
                        <h3>Document Requests</h3>
                        <button 
                            className="btn-view-all" 
                            onClick={() => handleViewAll('/ChildClinicRecords', 'documents')}
                        >
                            View All &rarr;
                        </button>
                    </div>
                    {documents.length === 0 ? (
                        <p className="empty-state">No document requests found.</p>
                    ) : (
                        documents.slice(0, 2).map((doc, idx) => (
                            <div key={idx} className="card-item-summary flex-between">
                                <div>
                                    <strong>{doc.document_type}</strong>
                                    <p className="summary-subtext">Req: {formatDate(doc.created_at)}</p>
                                </div>
                                <span className="status-badge">{doc.status || 'Submitted'}</span>
                            </div>
                        ))
                    )}
                </section>

            </div>
        </div>
    );
}