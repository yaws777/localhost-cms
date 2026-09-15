import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    AlertTriangle, 
    Plus, 
    PhoneCall, 
    Search, 
    Eye, 
    Edit, 
    Trash2, 
    X, 
    Calendar, 
    User, 
    MapPin, 
    FileText, 
    Activity, 
    Check, 
    RefreshCw 
} from 'lucide-react';
import '../../styles/nurse/IncidentReports.css';

const IncidentReport = () => {
    // 1. Get nurseId from NurseLayout Outlet context
    const { nurseId } = useOutletContext() || {};

    // Data States
    const [reports, setReports] = useState([]);
    const [hotlines, setHotlines] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Modals
    const [showAddIncidentModal, setShowAddIncidentModal] = useState(false);
    const [showHotlineDirectoryModal, setShowHotlineDirectoryModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);

    // Add Incident Form State
    const [studentSearch, setStudentSearch] = useState('');
    const [studentResults, setStudentResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [incidentData, setIncidentData] = useState({
        incident_datetime: '',
        incident_location: '',
        incident_description: '',
        first_aid_administered: '',
        current_physical_situation: ''
    });

    // Hotline Form State (For adding/editing)
    const [editingHotlineId, setEditingHotlineId] = useState(null);
    const [hotlineFormData, setHotlineFormData] = useState({
        facility_name: '',
        contact_number: '',
        description_notes: ''
    });

    // Fetch Incident Reports
    const fetchIncidentReports = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (dateFilter) params.append('date', dateFilter);

            const res = await fetch(`http://localhost:3001/api/incident-reports?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setReports(data.reports);
            }
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, dateFilter]);

    // Fetch Emergency Hotlines
    const fetchHotlines = useCallback(async () => {
        try {
            const res = await fetch(`http://localhost:3001/api/emergency-hotlines`);
            const data = await res.json();
            if (data.success) {
                setHotlines(data.hotlines);
            }
        } catch (error) {
            console.error('Error fetching hotlines:', error);
        }
    }, []);

    useEffect(() => {
        fetchIncidentReports();
        fetchHotlines();
    }, [fetchIncidentReports, fetchHotlines]);

    // Search Students for Add Modal
    const handleStudentSearchChange = async (e) => {
        const query = e.target.value;
        setStudentSearch(query);

        // Clear selected student if query is edited
        if (selectedStudent) {
            setSelectedStudent(null);
        }

        if (query.trim().length > 0) {
            try {
                const url = `http://localhost:3001/api/incident-reports/students?q=${encodeURIComponent(query.trim())}`;
                console.log('[Frontend] Searching students:', url);

                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const data = await res.json();
                console.log('[Frontend] Search results:', data);

                if (data.success && Array.isArray(data.students)) {
                    setStudentResults(data.students);
                } else if (Array.isArray(data)) {
                    setStudentResults(data);
                } else {
                    setStudentResults([]);
                }
            } catch (err) {
                console.error('[Frontend] Student search error:', err.message);
                setStudentResults([]);
            }
        } else {
            setStudentResults([]);
        }
    };

    const handleSelectStudent = (student) => {
        const sId = student.student_id || student.id || '';
        const fName = student.first_name || student.firstname || student.name || 'Student';
        const lName = student.last_name || student.lastname || '';

        setSelectedStudent(student);
        setStudentSearch(`${fName} ${lName} (${sId})`.trim());
        setStudentResults([]);
    };

    // Submit Incident Report Form
    const handleSaveIncident = async (e) => {
        e.preventDefault();
        
        const sId = selectedStudent?.student_id || selectedStudent?.id;
        if (!selectedStudent || !sId) {
            alert('Please search and select a valid student from the dropdown list.');
            return;
        }
        if (!nurseId) {
            alert('Nurse identity missing. Please re-login.');
            return;
        }

        try {
            const payload = {
                student_id: sId,
                nurse_id: nurseId,
                ...incidentData
            };

            const res = await fetch(`http://localhost:3001/api/incident-reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                alert('Incident report documented successfully!');
                setShowAddIncidentModal(false);
                resetIncidentForm();
                fetchIncidentReports();
            } else {
                alert(data.message || 'Error saving report');
            }
        } catch (error) {
            console.error('Save incident error:', error);
            alert('Failed to connect to the server.');
        }
    };

    const resetIncidentForm = () => {
        setSelectedStudent(null);
        setStudentSearch('');
        setStudentResults([]);
        setIncidentData({
            incident_datetime: '',
            incident_location: '',
            incident_description: '',
            first_aid_administered: '',
            current_physical_situation: ''
        });
    };

    // Hotline Form Operations (Create/Update/Delete)
    const handleSaveHotline = async (e) => {
        e.preventDefault();
        const method = editingHotlineId ? 'PUT' : 'POST';
        const endpoint = editingHotlineId 
            ? `http://localhost:3001/api/emergency-hotlines/${editingHotlineId}`
            : `http://localhost:3001/api/emergency-hotlines`;

        try {
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hotlineFormData)
            });
            const data = await res.json();
            if (data.success) {
                fetchHotlines();
                resetHotlineForm();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleEditHotline = (hotline) => {
        setEditingHotlineId(hotline.hotline_id);
        setHotlineFormData({
            facility_name: hotline.facility_name,
            contact_number: hotline.contact_number,
            description_notes: hotline.description_notes || ''
        });
    };

    const handleDeleteHotline = async (hotline_id) => {
        if (!window.confirm('Are you sure you want to delete this emergency contact?')) return;
        try {
            const res = await fetch(`http://localhost:3001/api/emergency-hotlines/${hotline_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) fetchHotlines();
        } catch (error) {
            console.error(error);
        }
    };

    const resetHotlineForm = () => {
        setEditingHotlineId(null);
        setHotlineFormData({ facility_name: '', contact_number: '', description_notes: '' });
    };

    return (
        <div className="incident-page-container">
            {/* Header Banner */}
            <div className="incident-header flex-between">
                <div>
                    <h2><AlertTriangle className="header-icon" /> Incident Reports</h2>
                    <p>Document, review, and manage campus health and safety incidents.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowHotlineDirectoryModal(true)}>
                        <PhoneCall size={18} /> Emergency Hotlines
                    </button>
                    <button className="btn btn-primary" onClick={() => { resetIncidentForm(); setShowAddIncidentModal(true); }}>
                        <Plus size={18} /> Document Incident
                    </button>
                </div>
            </div>

            {/* Filter and Search Section */}
            <div className="filter-card">
                <div className="search-group flex-grow">
                    <Search className="search-icon" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by student name, program, year level, or section..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control"
                    />
                </div>
                <div className="date-group">
                    <Calendar className="date-icon" size={18} />
                    <input 
                        type="date" 
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="form-control"
                    />
                </div>
                {(searchQuery || dateFilter) && (
                    <button className="btn btn-light" onClick={() => { setSearchQuery(''); setDateFilter(''); }}>
                        Reset
                    </button>
                )}
            </div>

            {/* Incident Reports Table */}
            <div className="table-card">
                {loading ? (
                    <div className="empty-state">
                        <RefreshCw className="spin-icon" size={30} />
                        <p>Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="empty-state">
                        <AlertTriangle size={40} className="text-muted" />
                        <p>No incident reports found.</p>
                    </div>
                ) : (
                    <table className="sti-table">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Student Name</th>
                                <th>Program / Yr / Sec</th>
                                <th>Location</th>
                                <th>Documented By</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report) => (
                                <tr key={report.incident_id}>
                                    <td>{new Date(report.incident_datetime).toLocaleString()}</td>
                                    <td>
                                        <strong>{report.student_first_name || 'Unknown'} {report.student_last_name || 'Student'}</strong>
                                        <br />
                                        <small className="text-muted">{report.student_id}</small>
                                    </td>
                                    <td>
                                        {report.program_name || 'N/A'} - {report.year_level || ''}{report.section || ''}
                                    </td>
                                    <td>{report.incident_location}</td>
                                    <td>{report.nurse_first_name ? `Nurse ${report.nurse_first_name} ${report.nurse_last_name}` : 'N/A'}</td>
                                    <td>
                                        <button 
                                            className="btn-icon btn-view" 
                                            title="View Details"
                                            onClick={() => { setSelectedReport(report); setShowViewModal(true); }}
                                        >
                                            <Eye size={16} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* =========================================
               MODAL 1: ADD INCIDENT REPORT
            ========================================= */}
            {showAddIncidentModal && (
                <div className="modal-overlay">
                    <div className="modal-container large-modal">
                        <div className="modal-header">
                            <h3><AlertTriangle size={20} /> Document Incident Report</h3>
                            <button className="close-btn" onClick={() => setShowAddIncidentModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveIncident} className="modal-body">
                            
                            {/* Student Search Field */}
                            <div className="form-group relative-container">
                                <label><User size={16} /> Search & Select Student *</label>
                                <input 
                                    type="text" 
                                    placeholder="Type student name or ID..."
                                    value={studentSearch}
                                    onChange={handleStudentSearchChange}
                                    className="form-control"
                                    autoComplete="off"
                                    required
                                />

                                {/* Search Results Dropdown */}
                                {studentResults.length > 0 && (
                                    <ul className="autocomplete-dropdown">
                                        {studentResults.map((s, index) => {
                                            const sId = s.student_id || s.id || index;
                                            const fName = s.first_name || s.firstname || s.name || 'Student';
                                            const lName = s.last_name || s.lastname || '';
                                            const prog = s.program_name || s.program || '';
                                            const yr = s.year_level || s.year || '';
                                            const sec = s.section || '';

                                            return (
                                                <li key={sId} onMouseDown={() => handleSelectStudent(s)}>
                                                    <strong>{fName} {lName}</strong> ({sId}) 
                                                    {prog && <span> - {prog} {yr}{sec}</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {/* Selected Student Badge */}
                                {selectedStudent && (
                                    <div className="selected-student-badge">
                                        <Check size={14} /> Selected: {selectedStudent.first_name || selectedStudent.firstname} {selectedStudent.last_name || selectedStudent.lastname} ({selectedStudent.student_id || selectedStudent.id})
                                    </div>
                                )}
                            </div>

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label><Calendar size={16} /> Date & Time of Incident *</label>
                                    <input 
                                        type="datetime-local" 
                                        value={incidentData.incident_datetime}
                                        onChange={(e) => setIncidentData({ ...incidentData, incident_datetime: e.target.value })}
                                        className="form-control"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label><MapPin size={16} /> Incident Location *</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. 3rd Floor Gymnasium"
                                        value={incidentData.incident_location}
                                        onChange={(e) => setIncidentData({ ...incidentData, incident_location: e.target.value })}
                                        className="form-control"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label><FileText size={16} /> Incident Description</label>
                                <textarea 
                                    rows="3" 
                                    placeholder="Describe what happened..."
                                    value={incidentData.incident_description}
                                    onChange={(e) => setIncidentData({ ...incidentData, incident_description: e.target.value })}
                                    className="form-control"
                                />
                            </div>

                            <div className="form-group">
                                <label><Activity size={16} /> First Aid Administered</label>
                                <textarea 
                                    rows="2" 
                                    placeholder="Details of first aid or immediate care provided..."
                                    value={incidentData.first_aid_administered}
                                    onChange={(e) => setIncidentData({ ...incidentData, first_aid_administered: e.target.value })}
                                    className="form-control"
                                />
                            </div>

                            <div className="form-group">
                                <label>Current Physical Situation / Disposition</label>
                                <textarea 
                                    rows="2" 
                                    placeholder="e.g. Sent home, Referred to hospital, Back to class..."
                                    value={incidentData.current_physical_situation}
                                    onChange={(e) => setIncidentData({ ...incidentData, current_physical_situation: e.target.value })}
                                    className="form-control"
                                />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-light" onClick={() => setShowAddIncidentModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Incident Report</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================
               MODAL 2: VIEW INCIDENT DETAILS
            ========================================= */}
            {showViewModal && selectedReport && (
                <div className="modal-overlay">
                    <div className="modal-container medium-modal">
                        <div className="modal-header">
                            <h3><FileText size={20} /> Incident Details</h3>
                            <button className="close-btn" onClick={() => setShowViewModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body view-details-body">
                            <div className="detail-card highlight-box">
                                <div>
                                    <label>Student Name</label>
                                    <h4>{selectedReport.student_first_name} {selectedReport.student_last_name}</h4>
                                    <p>{selectedReport.student_id} | {selectedReport.program_name} {selectedReport.year_level}-{selectedReport.section}</p>
                                </div>
                            </div>

                            <div className="detail-grid">
                                <div>
                                    <label>Date & Time</label>
                                    <p>{new Date(selectedReport.incident_datetime).toLocaleString()}</p>
                                </div>
                                <div>
                                    <label>Location</label>
                                    <p>{selectedReport.incident_location}</p>
                                </div>
                            </div>

                            <div className="detail-section">
                                <label>Incident Description</label>
                                <div className="detail-text">{selectedReport.incident_description || 'No description provided.'}</div>
                            </div>

                            <div className="detail-section">
                                <label>First Aid Administered</label>
                                <div className="detail-text">{selectedReport.first_aid_administered || 'None recorded.'}</div>
                            </div>

                            <div className="detail-section">
                                <label>Current Physical Situation / Disposition</label>
                                <div className="detail-text">{selectedReport.current_physical_situation || 'None recorded.'}</div>
                            </div>

                            <div className="detail-section text-muted small">
                                Recorded by: Nurse {selectedReport.nurse_first_name} {selectedReport.nurse_last_name}
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
               MODAL 3: EMERGENCY HOTLINE DIRECTORY
            ========================================= */}
            {showHotlineDirectoryModal && (
                <div className="modal-overlay">
                    <div className="modal-container large-modal">
                        <div className="modal-header">
                            <h3><PhoneCall size={20} /> Emergency Hotline Directory</h3>
                            <button className="close-btn" onClick={() => setShowHotlineDirectoryModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {/* Inline Form to Add / Edit Hotline */}
                            <form onSubmit={handleSaveHotline} className="hotline-form-box">
                                <h4>{editingHotlineId ? 'Edit Emergency Contact' : 'Add New Emergency Contact'}</h4>
                                <div className="form-grid-3">
                                    <input 
                                        type="text" 
                                        placeholder="Facility/Agency Name *" 
                                        value={hotlineFormData.facility_name} 
                                        onChange={(e) => setHotlineFormData({ ...hotlineFormData, facility_name: e.target.value })}
                                        className="form-control"
                                        required 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Contact Number *" 
                                        value={hotlineFormData.contact_number} 
                                        onChange={(e) => setHotlineFormData({ ...hotlineFormData, contact_number: e.target.value })}
                                        className="form-control"
                                        required 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Notes / Description" 
                                        value={hotlineFormData.description_notes} 
                                        onChange={(e) => setHotlineFormData({ ...hotlineFormData, description_notes: e.target.value })}
                                        className="form-control"
                                    />
                                </div>
                                <div className="hotline-form-actions">
                                    {editingHotlineId && (
                                        <button type="button" className="btn btn-light" onClick={resetHotlineForm}>Cancel Edit</button>
                                    )}
                                    <button type="submit" className="btn btn-primary">
                                        {editingHotlineId ? 'Update Hotline' : 'Add Hotline'}
                                    </button>
                                </div>
                            </form>

                            {/* Hotlines List */}
                            <div className="hotline-list">
                                {hotlines.length === 0 ? (
                                    <p className="text-muted text-center py-3">No emergency hotlines available.</p>
                                ) : (
                                    <table className="sti-table">
                                        <thead>
                                            <tr>
                                                <th>Facility / Agency</th>
                                                <th>Contact Number</th>
                                                <th>Notes</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hotlines.map((h) => (
                                                <tr key={h.hotline_id}>
                                                    <td><strong>{h.facility_name}</strong></td>
                                                    <td><span className="contact-chip">{h.contact_number}</span></td>
                                                    <td>{h.description_notes || '—'}</td>
                                                    <td className="action-cell">
                                                        <button className="btn-icon text-primary" onClick={() => handleEditHotline(h)}>
                                                            <Edit size={16} />
                                                        </button>
                                                        <button className="btn-icon text-danger" onClick={() => handleDeleteHotline(h.hotline_id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowHotlineDirectoryModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentReport;  