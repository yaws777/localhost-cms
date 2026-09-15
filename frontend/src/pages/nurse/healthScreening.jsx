import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Calendar, Clock, Plus, Users, Eye, Activity, Smile, 
  X, CheckCircle, Edit3, Trash2, FileText, ArrowLeft, ArrowRight, QrCode, AlertCircle, Megaphone
} from 'lucide-react';
import jsQR from 'jsqr';
import '../../styles/nurse/HealthScreening.css';

const API_BASE = 'http://localhost:3001/api';

export default function HealthScreening() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);

  // Modal States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStudentSelectModal, setShowStudentSelectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Form States
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    screening_type: 'BMI',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    announcement: '',
    target_program_id: '',
    target_year_level: '',
    target_section: ''
  });

  const [filterStudents, setFilterStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Active Schedule & Selected Student for Documentation
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [scheduleStudents, setScheduleStudents] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // QR Scanner States & Refs
  const [qrInput, setQrInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState({ message: '', type: '' });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);

  // Documentation Dynamic Form State
  const [docData, setDocData] = useState({});

  // Helper to parse Date and Time into a single JavaScript Date object
  const getScheduleDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const cleanDate = dateStr.split('T')[0];
    return new Date(`${cleanDate}T${timeStr}`);
  };

  useEffect(() => {
    fetchSchedules();
    fetchPrograms();
  }, []);

  // Centralized scan handler for both JSQR and manual entry
  const processScannedStudentId = useCallback(async (studentId) => {
    if (!studentId || !activeSchedule) return;

    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/scan-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setScanFeedback({ message: data.message || `Scanned Student ID: ${studentId}`, type: 'success' });
        openViewModal(activeSchedule);
      } else {
        setScanFeedback({ message: data.error || 'Scan failed.', type: 'error' });
      }
    } catch (err) {
      console.error('Error scanning QR:', err);
      setScanFeedback({ message: 'Network or server error during scan.', type: 'error' });
    }
  }, [activeSchedule]);

  // Camera initialization & continuous jsQR detection loop
  useEffect(() => {
    if (!showQrModal || !activeSchedule) return;

    let stream = null;
    let isScanning = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          animationFrameId.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setScanFeedback({ message: 'Unable to access camera device.', type: 'error' });
      }
    };

    const scanFrame = () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan frame using jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          isScanning = false; // Pause continuous detection on hit
          processScannedStudentId(code.data);
          
          // Resume scanning after 2.5 seconds to prevent accidental duplicate triggers
          setTimeout(() => {
            isScanning = true;
          }, 2500);
        }
      }

      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    startCamera();

    // Clean up camera stream & animation loop when closing modal
    return () => {
      isScanning = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showQrModal, activeSchedule, processScannedStudentId]);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_BASE}/screenings`);
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`${API_BASE}/programs`);
      const data = await res.json();
      setPrograms(data);
    } catch (err) {
      console.error('Error fetching programs:', err);
    }
  };

  const handleFilterStudents = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();

      if (scheduleForm.target_program_id) queryParams.append('program_id', scheduleForm.target_program_id);
      if (scheduleForm.target_year_level) queryParams.append('year_level', scheduleForm.target_year_level);
      if (scheduleForm.target_section) queryParams.append('section', scheduleForm.target_section);

      const res = await fetch(`${API_BASE}/filtered-students?${queryParams.toString()}`);
      const data = await res.json();

      const studentArray = Array.isArray(data) ? data : (data.students || data.data || []);
      setFilterStudents(studentArray);
    } catch (err) {
      console.error('Error filtering students:', err);
      setFilterStudents([]);
    }
  }, [scheduleForm.target_program_id, scheduleForm.target_year_level, scheduleForm.target_section]);

  useEffect(() => {
    if (showStudentSelectModal) {
      handleFilterStudents();
    }
  }, [showStudentSelectModal, handleFilterStudents]);

  const handleNextToStudents = (e) => {
    e.preventDefault();
    setShowScheduleModal(false);
    setShowStudentSelectModal(true);
  };

  const handleBackToSchedule = () => {
    setShowStudentSelectModal(false);
    setShowScheduleModal(true);
  };

  const handleSelectAllFiltered = (e) => {
    if (e.target.checked) {
      const filteredIds = filterStudents.map(st => st.student_id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    } else {
      const filteredSet = new Set(filterStudents.map(st => st.student_id));
      setSelectedStudentIds(prev => prev.filter(id => !filteredSet.has(id)));
    }
  };

  const areAllFilteredSelected = filterStudents.length > 0 && 
    filterStudents.every(st => selectedStudentIds.includes(st.student_id));

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      alert('Screening cannot be created without at least one target student selected.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/screenings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scheduleForm, student_ids: selectedStudentIds })
      });

      const data = await res.json();
      if (res.ok) {
        setShowStudentSelectModal(false);
        resetScheduleForm();
        fetchSchedules();
      } else {
        alert(data.error || 'Failed to create screening schedule.');
      }
    } catch (err) {
      console.error('Error creating schedule:', err);
    }
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/screenings/${editingSchedule.screening_schedule_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSchedule)
      });
      if (res.ok) {
        setShowEditModal(false);
        fetchSchedules();
      }
    } catch (err) {
      console.error('Error updating schedule:', err);
    }
  };

  const handleCancelSchedule = async (id) => {
    if (window.confirm('Are you sure you want to cancel this screening? Students will be notified.')) {
      try {
        const res = await fetch(`${API_BASE}/screenings/${id}`, { method: 'DELETE' });
        if (res.ok) fetchSchedules();
      } catch (err) {
        console.error('Error cancelling schedule:', err);
      }
    }
  };

  const openViewModal = async (schedule) => {
    setActiveSchedule(schedule);
    try {
      const res = await fetch(`${API_BASE}/screenings/${schedule.screening_schedule_id}/students`);
      const data = await res.json();
      setScheduleStudents(data.students || []);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error opening participant list:', err);
    }
  };

  const handleManualScanSubmit = (e) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    processScannedStudentId(qrInput);
    setQrInput('');
  };

  const openDocumentModal = (student) => {
    if (student.attendance_status !== 'PRESENT') {
      alert('Student must be marked as PRESENT in order to document screening results.');
      return;
    }

    setSelectedStudent(student);
    setDocData({
      height_cm: student.height_cm || '',
      weight_kg: student.weight_kg || '',
      bmi_value: student.bmi_value || '',
      bmi_category: student.bmi_category || 'Normal',
      dental_findings: student.dental_findings || '',
      visual_acuity_left: student.visual_acuity_left || '20/20',
      visual_acuity_right: student.visual_acuity_right || '20/20',
      remarks: student.remarks || ''
    });
    setShowDocModal(true);
  };

  const calculateBMI = (height, weight) => {
    if (!height || !weight) return { bmi: '', category: '' };
    const hMeters = height / 100;
    const bmi = (weight / (hMeters * hMeters)).toFixed(1);
    let category = 'Normal';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi >= 25 && bmi < 29.9) category = 'Overweight';
    else if (bmi >= 30) category = 'Obese';
    return { bmi, category };
  };

  const handleDocSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/screenings/${activeSchedule.screening_schedule_id}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.student_id,
          screening_type: activeSchedule.screening_type,
          formData: docData
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowDocModal(false);
        openViewModal(activeSchedule);
      } else {
        alert(data.error || 'Failed to save document.');
      }
    } catch (err) {
      console.error('Error submitting document:', err);
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      title: '', screening_type: 'BMI', scheduled_date: '', start_time: '', end_time: '',
      announcement: '', target_program_id: '', target_year_level: '', target_section: ''
    });
    setSelectedStudentIds([]);
  };

  // Evaluate current schedule status dynamically based on current date & end time
  const now = new Date();

  const filteredSchedules = schedules.filter(s => {
    const startDt = getScheduleDateTime(s.scheduled_date, s.start_time);
    const endDt = getScheduleDateTime(s.scheduled_date, s.end_time);

    if (!startDt || !endDt) return false;

    const isPast = now > endDt;
    const isOngoing = now >= startDt && now <= endDt;
    const isUpcoming = now < startDt;

    if (activeTab === 'upcoming') return isUpcoming;
    if (activeTab === 'ongoing') return isOngoing;
    if (activeTab === 'past') return isPast;
    return true;
  });

  return (
    <div className="sti-health-container">
      {/* Header */}
      <header className="sti-header">
        <div className="sti-title-group">
          <h1>Health Screening Management</h1>
          <p>Schedule, manage, and document student health assessments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
          <Plus size={18} /> Schedule Screening
        </button>
      </header>

      {/* Tabs */}
      <div className="sti-tabs">
        <button 
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={16} /> Upcoming Screenings
        </button>
        <button 
          className={`tab-btn ${activeTab === 'ongoing' ? 'active' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          <Clock size={16} /> Ongoing Screenings
        </button>
        <button 
          className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <CheckCircle size={16} /> Past Screenings
        </button>
      </div>

      {/* Card Grid */}
      <div className="sti-card-grid">
        {filteredSchedules.length === 0 ? (
          <div className="no-records">
            <p>No screening schedules found for this status.</p>
          </div>
        ) : (
          filteredSchedules.map(sch => (
            <div key={sch.screening_schedule_id} className="sti-card">
              <div className="card-badge">
                {sch.screening_type === 'BMI' && <Activity size={14} />}
                {sch.screening_type === 'Dental' && <Smile size={14} />}
                {sch.screening_type === 'Vision' && <Eye size={14} />}
                {sch.screening_type}
              </div>
              <h3 className="card-title">{sch.title}</h3>
              <p className="card-info"><Calendar size={14} /> {sch.scheduled_date ? sch.scheduled_date.split('T')[0] : ''}</p>
              <p className="card-info"><Clock size={14} /> {sch.start_time} - {sch.end_time}</p>
              <p className="card-info"><Users size={14} /> {sch.total_students || 0} Students Assigned</p>
              {sch.announcement && (
                <p className="card-info announcement-preview">
                  <Megaphone size={14} /> {sch.announcement}
                </p>
              )}
              
              <div className="card-actions">
                {activeTab === 'upcoming' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSchedule(sch); setShowEditModal(true); }}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleCancelSchedule(sch.screening_schedule_id)}>
                      <Trash2 size={14} /> Cancel
                    </button>
                  </>
                )}

                {(activeTab === 'ongoing' || activeTab === 'past') && (
                  <button className="btn btn-primary btn-sm" onClick={() => openViewModal(sch)}>
                    <FileText size={14} /> View & Document
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: Schedule Screening Details */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Schedule Health Screening (Step 1 of 2)</h2>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleNextToStudents} className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  required 
                  value={scheduleForm.title} 
                  onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} 
                  placeholder="e.g. Annual Dental Checkup" 
                />
              </div>

              <div className="form-group">
                <label>Screening Type</label>
                <select value={scheduleForm.screening_type} onChange={e => setScheduleForm({...scheduleForm, screening_type: e.target.value})}>
                  <option value="BMI">BMI Monitoring</option>
                  <option value="Dental">Dental Assessment</option>
                  <option value="Vision">Vision Screening</option>
                </select>
              </div>

              <div className="form-group">
                <label>Scheduled Date</label>
                <input 
                  type="date" 
                  required 
                  value={scheduleForm.scheduled_date} 
                  onChange={e => setScheduleForm({...scheduleForm, scheduled_date: e.target.value})} 
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Start Time</label>
                  <input 
                    type="time" 
                    required 
                    value={scheduleForm.start_time} 
                    onChange={e => setScheduleForm({...scheduleForm, start_time: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input 
                    type="time" 
                    required 
                    value={scheduleForm.end_time} 
                    onChange={e => setScheduleForm({...scheduleForm, end_time: e.target.value})} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Announcement / Instructions (Optional)</label>
                <textarea 
                  rows={3}
                  value={scheduleForm.announcement} 
                  onChange={e => setScheduleForm({...scheduleForm, announcement: e.target.value})} 
                  placeholder="e.g. Please wear proper sports attire and bring your student ID card." 
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  Next: Select Target Students <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Select Target Students */}
      {showStudentSelectModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>Select Target Students (Step 2 of 2)</h2>
              <button className="close-btn" onClick={() => setShowStudentSelectModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSchedule} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Academic Program</label>
                  <select value={scheduleForm.target_program_id} onChange={e => setScheduleForm({...scheduleForm, target_program_id: e.target.value})}>
                    <option value="">All Programs</option>
                    {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year Level</label>
                  <select value={scheduleForm.target_year_level} onChange={e => setScheduleForm({...scheduleForm, target_year_level: e.target.value})}>
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <input type="text" placeholder="e.g. BSIT-101" value={scheduleForm.target_section} onChange={e => setScheduleForm({...scheduleForm, target_section: e.target.value})} />
                </div>
              </div>

              <div className="student-select-list">
                <label>Matching Students ({filterStudents.length}) — {selectedStudentIds.length} Total Selected</label>
                <div className="student-table-wrapper">
                  <table className="sti-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={areAllFilteredSelected} 
                            onChange={handleSelectAllFiltered}
                            disabled={filterStudents.length === 0}
                            title="Select/Deselect all matching students"
                          />
                        </th>
                        <th>Student Name</th>
                        <th>Program</th>
                        <th>Year & Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filterStudents.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#6c757d' }}>
                            No students match the selected Program, Year Level, or Section filter.
                          </td>
                        </tr>
                      ) : (
                        filterStudents.map(st => (
                          <tr key={st.student_id}>
                            <td>
                              <input 
                                type="checkbox" 
                                checked={selectedStudentIds.includes(st.student_id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, st.student_id]);
                                  else setSelectedStudentIds(selectedStudentIds.filter(id => id !== st.student_id));
                                }}
                              />
                            </td>
                            <td>{st.first_name} {st.last_name}</td>
                            <td>{st.program_name || st.program_id}</td>
                            <td>Yr {st.year_level} - {st.section}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleBackToSchedule}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={selectedStudentIds.length === 0}
                  title={selectedStudentIds.length === 0 ? "Select at least 1 student to create schedule" : ""}
                >
                  Save & Notify Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Upcoming Schedule */}
      {showEditModal && editingSchedule && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Update Screening Schedule</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="modal-body">
              <div className="form-group">
                <label>Scheduled Date</label>
                <input type="date" required value={editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : ''} onChange={e => setEditingSchedule({...editingSchedule, scheduled_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" required value={editingSchedule.start_time} onChange={e => setEditingSchedule({...editingSchedule, start_time: e.target.value})} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" required value={editingSchedule.end_time} onChange={e => setEditingSchedule({...editingSchedule, end_time: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Announcement / Instructions</label>
                <textarea rows={3} value={editingSchedule.announcement || ''} onChange={e => setEditingSchedule({...editingSchedule, announcement: e.target.value})} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update & Notify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: View & Document Ongoing/Past Screening */}
      {showViewModal && activeSchedule && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>{activeSchedule.title} - Participant List ({activeSchedule.screening_type})</h2>
              <button className="close-btn" onClick={() => setShowViewModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {activeTab === 'ongoing' && (
                <div className="qr-scanner-bar">
                  <button className="btn btn-primary" onClick={() => { setShowQrModal(true); setScanFeedback({ message: '', type: '' }); }}>
                    <QrCode size={18} /> Scan Student QR Code
                  </button>
                  <p className="qr-hint">Scan student QR code to mark attendance as PRESENT.</p>
                </div>
              )}

              <table className="sti-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Program</th>
                    <th>Year/Section</th>
                    <th>Attendance Status</th>
                    <th>Record Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleStudents.map(st => {
                    const isDocumented = st.bmi_log_id || st.dental_record_id || st.vision_record_id;
                    const activeEndDt = getScheduleDateTime(activeSchedule.scheduled_date, activeSchedule.end_time);
                    const isScheduleEnded = activeEndDt ? now > activeEndDt : false;

                    // Automatically mark pending as ABSENT if current time/date exceeds schedule end time
                    let effectiveAttendanceStatus = st.attendance_status || 'PENDING';
                    if (isScheduleEnded && effectiveAttendanceStatus === 'PENDING') {
                      effectiveAttendanceStatus = 'ABSENT';
                    }

                    const isPresent = effectiveAttendanceStatus === 'PRESENT';

                    return (
                      <tr key={st.student_id}>
                        <td>{st.first_name} {st.last_name}</td>
                        <td>{st.program_name}</td>
                        <td>Yr {st.year_level} - {st.section}</td>
                        <td>
                          <span className={`badge badge-status-${effectiveAttendanceStatus.toLowerCase()}`}>
                            {effectiveAttendanceStatus}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${isDocumented ? 'badge-success' : 'badge-warning'}`}>
                            {isDocumented ? 'Documented' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className={`btn btn-sm ${isPresent ? 'btn-secondary' : 'btn-disabled'}`} 
                            onClick={() => openDocumentModal({ ...st, attendance_status: effectiveAttendanceStatus })}
                            disabled={!isPresent}
                            title={!isPresent ? "Student must be marked PRESENT before documenting" : "Document Screening"}
                          >
                            <FileText size={14} /> Document Result
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Live Camera QR Code Scanner via jsQR */}
      {showQrModal && activeSchedule && (
        <div className="modal-overlay">
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <h2>Scan Student QR Code</h2>
              <button className="close-btn" onClick={() => setShowQrModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body text-center">
              <div className="qr-video-container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', background: '#000', marginBottom: '1rem' }}>
                <video 
                  ref={videoRef} 
                  style={{ width: '100%', height: '240px', objectFit: 'cover' }} 
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              {scanFeedback.message && (
                <div className={`scan-alert alert-${scanFeedback.type}`} style={{ marginBottom: '1rem' }}>
                  {scanFeedback.type === 'error' && <AlertCircle size={16} />}
                  {scanFeedback.type === 'success' && <CheckCircle size={16} />}
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              {/* Manual input fallback */}
              <form onSubmit={handleManualScanSubmit} className="qr-input-form">
                <input 
                  type="text" 
                  placeholder="Or enter Student ID manually..." 
                  value={qrInput} 
                  onChange={e => setQrInput(e.target.value)}
                  className="qr-text-input"
                />
                <button type="submit" className="btn btn-secondary" style={{ marginTop: '0.75rem', width: '100%' }}>
                  Submit Manual Input
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Dynamic Screening Entry Form */}
      {showDocModal && selectedStudent && activeSchedule && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Document Screening: {selectedStudent.first_name} {selectedStudent.last_name}</h2>
              <button className="close-btn" onClick={() => setShowDocModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleDocSubmit} className="modal-body">
              {/* BMI FORM */}
              {activeSchedule.screening_type === 'BMI' && (
                <>
                  <div className="form-group">
                    <label>Height (cm)</label>
                    <input 
                      type="number" step="0.1" required value={docData.height_cm} 
                      onChange={e => {
                        const h = e.target.value;
                        const { bmi, category } = calculateBMI(h, docData.weight_kg);
                        setDocData({...docData, height_cm: h, bmi_value: bmi, bmi_category: category});
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input 
                      type="number" step="0.1" required value={docData.weight_kg} 
                      onChange={e => {
                        const w = e.target.value;
                        const { bmi, category } = calculateBMI(docData.height_cm, w);
                        setDocData({...docData, weight_kg: w, bmi_value: bmi, bmi_category: category});
                      }} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Calculated BMI</label>
                    <input type="text" readOnly value={docData.bmi_value} placeholder="Auto-calculated" />
                  </div>
                  <div className="form-group">
                    <label>BMI Category</label>
                    <input type="text" readOnly value={docData.bmi_category} placeholder="Auto-categorized" />
                  </div>
                </>
              )}

              {/* DENTAL FORM */}
              {activeSchedule.screening_type === 'Dental' && (
                <>
                  <div className="form-group">
                    <label>Dental Findings</label>
                    <textarea required value={docData.dental_findings} onChange={e => setDocData({...docData, dental_findings: e.target.value})} rows={3} placeholder="Describe oral health observations..." />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Recommendations / Treatment advice..." />
                  </div>
                </>
              )}

              {/* VISION FORM */}
              {activeSchedule.screening_type === 'Vision' && (
                <>
                  <div className="form-group">
                    <label>Visual Acuity (Left Eye)</label>
                    <input type="text" required value={docData.visual_acuity_left} onChange={e => setDocData({...docData, visual_acuity_left: e.target.value})} placeholder="e.g. 20/20" />
                  </div>
                  <div className="form-group">
                    <label>Visual Acuity (Right Eye)</label>
                    <input type="text" required value={docData.visual_acuity_right} onChange={e => setDocData({...docData, visual_acuity_right: e.target.value})} placeholder="e.g. 20/20" />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Prescription / Doctor referral notes..." />
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}