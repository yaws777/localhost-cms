// healthScreening.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Calendar, Clock, Plus, Users, Eye, Activity, Smile, 
  X, CheckCircle, Edit3, Trash2, FileText, ArrowLeft, ArrowRight, QrCode, AlertCircle, Megaphone, Printer
} from 'lucide-react';
import jsQR from 'jsqr';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/HealthScreening.css';

const API_BASE = 'http://localhost:3001/api';

// Helper to get today's local date in YYYY-MM-DD format
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get current local time in HH:MM format
const getCurrentTimeString = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to calculate minimum end time (1 minute after start time)
const getMinEndTime = (startTime) => {
  if (!startTime) return undefined;
  const [h, m] = startTime.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return startTime;
  const totalMinutes = h * 60 + m + 1;
  if (totalMinutes >= 24 * 60) return '23:59';
  const nextH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const nextM = String(totalMinutes % 60).padStart(2, '0');
  return `${nextH}:${nextM}`;
};

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

  // EXPORT REPORT FOR ALL HEALTH SCREENINGS
  const handleExportAllReport = () => {
    const rowsToExport = filteredSchedules.length > 0 ? filteredSchedules : schedules;

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      alert('Please allow popups to preview and print the report.');
      return;
    }

    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const tableRowsHtml = rowsToExport.map(sch => {
      const dateStr = sch.scheduled_date ? sch.scheduled_date.split('T')[0] : 'N/A';
      const timeStr = `${sch.start_time || ''} - ${sch.end_time || ''}`;

      return `
        <tr>
          <td><strong>${sch.title || 'N/A'}</strong></td>
          <td>${sch.screening_type || 'N/A'}</td>
          <td>${dateStr}</td>
          <td>${timeStr}</td>
          <td>${sch.total_students || 0}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Health Screening Report</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 25px;
            color: #0f172a;
          }
          .report-header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #0056b3;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .report-header img {
            height: 60px;
            margin-right: 20px;
          }
          .report-title h2 {
            margin: 0;
            font-size: 20px;
            color: #1e3a8a;
          }
          .report-title p {
            margin: 4px 0 0;
            font-size: 13px;
            color: #475569;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #475569;
            margin-bottom: 16px;
            font-weight: 500;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 35px;
          }
          th {
            background-color: #f1f5f9;
            color: #0f172a;
            text-align: left;
            padding: 9px 10px;
            border: 1px solid #cbd5e1;
            font-weight: bold;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .signature-section {
            margin-top: 40px;
            font-size: 13px;
          }
          .signature-title {
            color: #475569;
            margin-bottom: 35px;
          }
          .signature-name {
            font-weight: bold;
            font-size: 14px;
            color: #0f172a;
          }
          .signature-role {
            font-style: italic;
            color: #64748b;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <img src="${stiLogo}" alt="STI Logo" />
          <div class="report-title">
            <h2>STI COLLEGE BALIUAG</h2>
            <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan</p>
          </div>
        </div>

        <div class="meta-info">
          <span><strong>HEALTH SCREENING SUMMARY REPORT</strong></span>
          <span>Date Generated: ${reportDate}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Screening Title</th>
              <th>Type</th>
              <th>Date</th>
              <th>Time</th>
              <th>Assigned Students</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="5">No health screenings found.</td></tr>'}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="signature-title">Prepared by:</div>
          <div class="signature-name">Marilou H. Balarao</div>
          <div class="signature-role">School Nurse</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // EXPORT REPORT FOR SINGLE HEALTH SCREENING
  const handleExportSingleReport = () => {
    if (!activeSchedule) return;

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      alert('Please allow popups to preview and print the report.');
      return;
    }

    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const dateStr = activeSchedule.scheduled_date ? activeSchedule.scheduled_date.split('T')[0] : 'N/A';
    const timeStr = `${activeSchedule.start_time || ''} - ${activeSchedule.end_time || ''}`;

    const tableRowsHtml = scheduleStudents.map(st => {
      const studentName = `${st.first_name || ''} ${st.last_name || ''}`.trim();
      const progYrSec = `${st.program_name || ''} (Yr ${st.year_level || ''} - ${st.section || ''})`;
      
      const activeEndDt = getScheduleDateTime(activeSchedule.scheduled_date, activeSchedule.end_time);
      const isScheduleEnded = activeEndDt ? now > activeEndDt : false;

      let effectiveAttendanceStatus = st.attendance_status || 'PENDING';
      if (isScheduleEnded && effectiveAttendanceStatus === 'PENDING') {
        effectiveAttendanceStatus = 'ABSENT';
      }

      const isDocumented = st.bmi_log_id || st.dental_record_id || st.vision_record_id;
      const recordStatusStr = isDocumented ? 'Documented' : 'Pending';

      return `
        <tr>
          <td>${st.student_id || ''}</td>
          <td><strong>${studentName}</strong></td>
          <td>${progYrSec}</td>
          <td>${effectiveAttendanceStatus}</td>
          <td>${recordStatusStr}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Health Screening Participant Report</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 25px;
            color: #0f172a;
          }
          .report-header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #0056b3;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .report-header img {
            height: 60px;
            margin-right: 20px;
          }
          .report-title h2 {
            margin: 0;
            font-size: 20px;
            color: #1e3a8a;
          }
          .report-title p {
            margin: 4px 0 0;
            font-size: 13px;
            color: #475569;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #475569;
            margin-bottom: 16px;
            font-weight: 500;
          }
          .details-card {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 13px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 35px;
          }
          th {
            background-color: #f1f5f9;
            color: #0f172a;
            text-align: left;
            padding: 9px 10px;
            border: 1px solid #cbd5e1;
            font-weight: bold;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .signature-section {
            margin-top: 40px;
            font-size: 13px;
          }
          .signature-title {
            color: #475569;
            margin-bottom: 35px;
          }
          .signature-name {
            font-weight: bold;
            font-size: 14px;
            color: #0f172a;
          }
          .signature-role {
            font-style: italic;
            color: #64748b;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <img src="${stiLogo}" alt="STI Logo" />
          <div class="report-title">
            <h2>STI COLLEGE BALIUAG</h2>
            <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan</p>
          </div>
        </div>

        <div class="meta-info">
          <span><strong>INDIVIDUAL SCREENING PARTICIPANT REPORT</strong></span>
          <span>Date Generated: ${reportDate}</span>
        </div>

        <div class="details-card">
          <div><strong>Screening Title:</strong> ${activeSchedule.title || 'N/A'}</div>
          <div><strong>Screening Type:</strong> ${activeSchedule.screening_type || 'N/A'}</div>
          <div><strong>Scheduled Date:</strong> ${dateStr}</div>
          <div><strong>Time:</strong> ${timeStr}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Program & Year/Section</th>
              <th>Attendance Status</th>
              <th>Record Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="5">No participants found.</td></tr>'}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="signature-title">Prepared by:</div>
          <div class="signature-name">Marilou H. Balarao</div>
          <div class="signature-role">School Nurse</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          isScanning = false;
          processScannedStudentId(code.data);
          
          setTimeout(() => {
            isScanning = true;
          }, 2500);
        }
      }

      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    startCamera();

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

    if (scheduleForm.scheduled_date < getTodayString()) {
      alert('Scheduled date cannot be in the past.');
      return;
    }

    if (scheduleForm.scheduled_date === getTodayString() && scheduleForm.start_time < getCurrentTimeString()) {
      alert('Start time cannot be in the past for today.');
      return;
    }

    if (scheduleForm.end_time <= scheduleForm.start_time) {
      alert('End time must be after start time.');
      return;
    }

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

    const cleanDate = editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : '';
    if (cleanDate < getTodayString()) {
      alert('Scheduled date cannot be in the past.');
      return;
    }

    if (cleanDate === getTodayString() && editingSchedule.start_time < getCurrentTimeString()) {
      alert('Start time cannot be in the past for today.');
      return;
    }

    if (editingSchedule.end_time <= editingSchedule.start_time) {
      alert('End time must be after start time.');
      return;
    }

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
    <div className="container-hs">
      {/* Header */}
      <header className="header-hs">
        <div className="title-group-hs">
          <h1>Health Screening Management</h1>
          <p>Schedule, manage, and document student health assessments</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn-hs btn-secondary-hs" 
            onClick={handleExportAllReport}
            style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={18} /> export
          </button>
          <button type="button" className="btn-hs btn-primary-hs" onClick={() => setShowScheduleModal(true)}>
            <Plus size={18} /> Schedule Screening
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-hs">
        <button 
          type="button"
          className={`tab-btn-hs ${activeTab === 'upcoming' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={16} /> Upcoming Screenings
        </button>
        <button 
          type="button"
          className={`tab-btn-hs ${activeTab === 'ongoing' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('ongoing')}
        >
          <Clock size={16} /> Ongoing Screenings
        </button>
        <button 
          type="button"
          className={`tab-btn-hs ${activeTab === 'past' ? 'active-hs' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <CheckCircle size={16} /> Past Screenings
        </button>
      </div>

      {/* Card Grid */}
      <div className="card-grid-hs">
        {filteredSchedules.length === 0 ? (
          <div className="no-records-hs">
            <p>No screening schedules found for this status.</p>
          </div>
        ) : (
          filteredSchedules.map(sch => (
            <div key={sch.screening_schedule_id} className="card-hs">
              <div className="card-badge-hs">
                {sch.screening_type === 'BMI' && <Activity size={14} />}
                {sch.screening_type === 'Dental' && <Smile size={14} />}
                {sch.screening_type === 'Vision' && <Eye size={14} />}
                {sch.screening_type}
              </div>
              <h3 className="card-title-hs">{sch.title}</h3>
              <p className="card-info-hs"><Calendar size={14} /> {sch.scheduled_date ? sch.scheduled_date.split('T')[0] : ''}</p>
              <p className="card-info-hs"><Clock size={14} /> {sch.start_time} - {sch.end_time}</p>
              <p className="card-info-hs"><Users size={14} /> {sch.total_students || 0} Students Assigned</p>
              {sch.announcement && (
                <p className="card-info-hs announcement-preview-hs">
                  <Megaphone size={14} /> {sch.announcement}
                </p>
              )}
              
              <div className="card-actions-hs">
                {activeTab === 'upcoming' && (
                  <>
                    <button 
                      type="button"
                      className="btn-hs btn-icon-hs btn-secondary-hs" 
                      onClick={() => { setEditingSchedule(sch); setShowEditModal(true); }}
                      title="Edit Schedule"
                      aria-label="Edit Schedule"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      type="button"
                      className="btn-hs btn-icon-hs btn-danger-hs" 
                      onClick={() => handleCancelSchedule(sch.screening_schedule_id)}
                      title="Cancel Schedule"
                      aria-label="Cancel Schedule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}

                {(activeTab === 'ongoing' || activeTab === 'past') && (
                  <button 
                    type="button"
                    className="btn-hs btn-icon-hs btn-primary-hs" 
                    onClick={() => openViewModal(sch)}
                    title="View & Document Screening"
                    aria-label="View & Document Screening"
                  >
                    <FileText size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: Schedule Screening Details */}
      {showScheduleModal && (
        <div className="modal-overlay-hs">
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Schedule Health Screening (Step 1 of 2)</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowScheduleModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleNextToStudents} className="modal-form-hs">
              <div className="modal-body-hs">
                <div className="form-group-hs">
                  <label>Title</label>
                  <input 
                    type="text" 
                    required 
                    value={scheduleForm.title} 
                    onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} 
                    placeholder="e.g. Annual Dental Checkup" 
                  />
                </div>

                <div className="form-group-hs">
                  <label>Screening Type</label>
                  <select value={scheduleForm.screening_type} onChange={e => setScheduleForm({...scheduleForm, screening_type: e.target.value})}>
                    <option value="BMI">BMI Monitoring</option>
                    <option value="Dental">Dental Assessment</option>
                    <option value="Vision">Vision Screening</option>
                  </select>
                </div>

                <div className="form-group-hs">
                  <label>Scheduled Date</label>
                  <input 
                    type="date" 
                    required 
                    min={getTodayString()}
                    value={scheduleForm.scheduled_date} 
                    onChange={e => {
                      const newDate = e.target.value;
                      setScheduleForm(prev => ({
                        ...prev,
                        scheduled_date: newDate,
                        start_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.start_time,
                        end_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.end_time
                      }));
                    }} 
                  />
                </div>

                <div className="form-grid-hs">
                  <div className="form-group-hs">
                    <label>Start Time</label>
                    <input 
                      type="time" 
                      required 
                      min={scheduleForm.scheduled_date === getTodayString() ? getCurrentTimeString() : undefined}
                      max={scheduleForm.end_time || undefined}
                      value={scheduleForm.start_time} 
                      onChange={e => {
                        const newStart = e.target.value;
                        setScheduleForm(prev => ({
                          ...prev,
                          start_time: newStart,
                          end_time: prev.end_time && newStart && prev.end_time <= newStart ? '' : prev.end_time
                        }));
                      }} 
                    />
                  </div>
                  <div className="form-group-hs">
                    <label>End Time</label>
                    <input 
                      type="time" 
                      required 
                      disabled={!scheduleForm.start_time}
                      min={getMinEndTime(scheduleForm.start_time)}
                      value={scheduleForm.end_time} 
                      onChange={e => {
                        const newEnd = e.target.value;
                        if (newEnd && scheduleForm.start_time && newEnd <= scheduleForm.start_time) {
                          alert('End time must be after Start time.');
                          setScheduleForm(prev => ({ ...prev, end_time: '' }));
                          return;
                        }
                        setScheduleForm(prev => ({ ...prev, end_time: newEnd }));
                      }} 
                      placeholder={!scheduleForm.start_time ? "Select Start Time first" : ""}
                    />
                  </div>
                </div>

                <div className="form-group-hs">
                  <label>Announcement / Instructions (Optional)</label>
                  <textarea 
                    rows={3}
                    value={scheduleForm.announcement} 
                    onChange={e => setScheduleForm({...scheduleForm, announcement: e.target.value})} 
                    placeholder="e.g. Please wear proper sports attire and bring your student ID card." 
                  />
                </div>
              </div>

              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button type="submit" className="btn-hs btn-primary-hs">
                  Next: Select Target Students <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Select Target Students */}
      {showStudentSelectModal && (
        <div className="modal-overlay-hs">
          <div className="modal-hs modal-lg-hs">
            <div className="modal-header-hs">
              <h2>Select Target Students (Step 2 of 2)</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowStudentSelectModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="modal-form-hs">
              <div className="modal-body-hs">
                <div className="form-grid-hs">
                  <div className="form-group-hs">
                    <label>Academic Program</label>
                    <select value={scheduleForm.target_program_id} onChange={e => setScheduleForm({...scheduleForm, target_program_id: e.target.value})}>
                      <option value="">All Programs</option>
                      {programs.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label>Year Level</label>
                    <select value={scheduleForm.target_year_level} onChange={e => setScheduleForm({...scheduleForm, target_year_level: e.target.value})}>
                      <option value="">All Years</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                  <div className="form-group-hs">
                    <label>Section</label>
                    <input type="text" placeholder="e.g. BSIT-101" value={scheduleForm.target_section} onChange={e => setScheduleForm({...scheduleForm, target_section: e.target.value})} />
                  </div>
                </div>

                <div className="student-select-list-hs">
                  <span className="list-title-hs">
                    Matching Students ({filterStudents.length}) — {selectedStudentIds.length} Total Selected
                  </span>
                  <div className="table-wrapper-hs">
                    <table className="table-hs">
                      <thead>
                        <tr>
                          <th className="col-checkbox-hs">
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
                            <td colSpan="4" className="empty-table-msg-hs">
                              No students match the selected Program, Year Level, or Section filter.
                            </td>
                          </tr>
                        ) : (
                          filterStudents.map(st => (
                            <tr key={st.student_id}>
                              <td className="col-checkbox-hs">
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
              </div>

              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={handleBackToSchedule}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  type="submit" 
                  className="btn-hs btn-primary-hs"
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
        <div className="modal-overlay-hs">
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Update Screening Schedule</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="modal-form-hs">
              <div className="modal-body-hs">
                <div className="form-group-hs">
                  <label>Scheduled Date</label>
                  <input 
                    type="date" 
                    required 
                    min={getTodayString()}
                    value={editingSchedule.scheduled_date ? editingSchedule.scheduled_date.split('T')[0] : ''} 
                    onChange={e => {
                      const newDate = e.target.value;
                      setEditingSchedule(prev => ({
                        ...prev,
                        scheduled_date: newDate,
                        start_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.start_time,
                        end_time: newDate === getTodayString() && prev.start_time < getCurrentTimeString() ? '' : prev.end_time
                      }));
                    }} 
                  />
                </div>
                <div className="form-grid-hs">
                  <div className="form-group-hs">
                    <label>Start Time</label>
                    <input 
                      type="time" 
                      required 
                      min={editingSchedule.scheduled_date?.split('T')[0] === getTodayString() ? getCurrentTimeString() : undefined}
                      max={editingSchedule.end_time || undefined}
                      value={editingSchedule.start_time} 
                      onChange={e => {
                        const newStart = e.target.value;
                        setEditingSchedule(prev => ({
                          ...prev,
                          start_time: newStart,
                          end_time: prev.end_time && newStart && prev.end_time <= newStart ? '' : prev.end_time
                        }));
                      }} 
                    />
                  </div>
                  <div className="form-group-hs">
                    <label>End Time</label>
                    <input 
                      type="time" 
                      required 
                      disabled={!editingSchedule.start_time}
                      min={getMinEndTime(editingSchedule.start_time)}
                      value={editingSchedule.end_time} 
                      onChange={e => {
                        const newEnd = e.target.value;
                        if (newEnd && editingSchedule.start_time && newEnd <= editingSchedule.start_time) {
                          alert('End time must be after Start time.');
                          setEditingSchedule(prev => ({ ...prev, end_time: '' }));
                          return;
                        }
                        setEditingSchedule(prev => ({ ...prev, end_time: newEnd }));
                      }} 
                    />
                  </div>
                </div>
                <div className="form-group-hs">
                  <label>Announcement / Instructions</label>
                  <textarea rows={3} value={editingSchedule.announcement || ''} onChange={e => setEditingSchedule({...editingSchedule, announcement: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-hs btn-primary-hs">Update & Notify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: View & Document Ongoing/Past Screening */}
      {showViewModal && activeSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs modal-lg-hs">
            <div className="modal-header-hs">
              <h2>{activeSchedule.title} - Participant List ({activeSchedule.screening_type})</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn-hs btn-secondary-hs" 
                  onClick={handleExportSingleReport}
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> export
                </button>
                <button type="button" className="close-btn-hs" onClick={() => setShowViewModal(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="modal-body-hs">
              {activeTab === 'ongoing' && (
                <div className="qr-scanner-bar-hs">
                  <button type="button" className="btn-hs btn-primary-hs" onClick={() => { setShowQrModal(true); setScanFeedback({ message: '', type: '' }); }}>
                    <QrCode size={18} /> Scan Student QR Code
                  </button>
                  <p className="qr-hint-hs">Scan student QR code to mark attendance as PRESENT.</p>
                </div>
              )}

              <div className="table-wrapper-hs">
                <table className="table-hs">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Program</th>
                      <th>Year/Section</th>
                      <th>Attendance Status</th>
                      <th>Record Status</th>
                      <th className="col-action-hs">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleStudents.map(st => {
                      const isDocumented = st.bmi_log_id || st.dental_record_id || st.vision_record_id;
                      const activeEndDt = getScheduleDateTime(activeSchedule.scheduled_date, activeSchedule.end_time);
                      const isScheduleEnded = activeEndDt ? now > activeEndDt : false;

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
                            <span className={`badge-hs badge-status-${effectiveAttendanceStatus.toLowerCase()}-hs`}>
                              {effectiveAttendanceStatus}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-hs ${isDocumented ? 'badge-success-hs' : 'badge-warning-hs'}`}>
                              {isDocumented ? 'Documented' : 'Pending'}
                            </span>
                          </td>
                          <td className="col-action-hs">
                            <button 
                              type="button"
                              className={`btn-hs btn-icon-hs ${isPresent ? 'btn-primary-hs' : 'btn-disabled-hs'}`} 
                              onClick={() => openDocumentModal({ ...st, attendance_status: effectiveAttendanceStatus })}
                              disabled={!isPresent}
                              title={!isPresent ? "Student must be marked PRESENT before documenting" : "Document Result"}
                              aria-label="Document Result"
                            >
                              <FileText size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer-hs">
              <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Live Camera QR Code Scanner via jsQR */}
      {showQrModal && activeSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs modal-sm-hs">
            <div className="modal-header-hs">
              <h2>Scan Student QR Code</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowQrModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-hs text-center-hs">
              <div className="qr-video-container-hs">
                <video ref={videoRef} className="qr-video-hs" />
                <canvas ref={canvasRef} className="qr-canvas-hs" />
              </div>

              {scanFeedback.message && (
                <div className={`scan-alert-hs alert-${scanFeedback.type}-hs`}>
                  {scanFeedback.type === 'error' && <AlertCircle size={16} />}
                  {scanFeedback.type === 'success' && <CheckCircle size={16} />}
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleManualScanSubmit} className="qr-input-form-hs">
                <input 
                  type="text" 
                  placeholder="Or enter Student ID manually..." 
                  value={qrInput} 
                  onChange={e => setQrInput(e.target.value)}
                  className="qr-text-input-hs"
                />
                <button type="submit" className="btn-hs btn-secondary-hs btn-full-hs">
                  Submit Manual Input
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Dynamic Screening Entry Form */}
      {showDocModal && selectedStudent && activeSchedule && (
        <div className="modal-overlay-hs">
          <div className="modal-hs">
            <div className="modal-header-hs">
              <h2>Document Screening: {selectedStudent.first_name} {selectedStudent.last_name}</h2>
              <button type="button" className="close-btn-hs" onClick={() => setShowDocModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDocSubmit} className="modal-form-hs">
              <div className="modal-body-hs">
                {/* BMI FORM */}
                {activeSchedule.screening_type === 'BMI' && (
                  <>
                    <div className="form-group-hs">
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
                    <div className="form-group-hs">
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
                    <div className="form-group-hs">
                      <label>Calculated BMI</label>
                      <input type="text" readOnly value={docData.bmi_value} placeholder="Auto-calculated" />
                    </div>
                    <div className="form-group-hs">
                      <label>BMI Category</label>
                      <input type="text" readOnly value={docData.bmi_category} placeholder="Auto-categorized" />
                    </div>
                  </>
                )}

                {/* DENTAL FORM */}
                {activeSchedule.screening_type === 'Dental' && (
                  <>
                    <div className="form-group-hs">
                      <label>Dental Findings</label>
                      <textarea required value={docData.dental_findings} onChange={e => setDocData({...docData, dental_findings: e.target.value})} rows={3} placeholder="Describe oral health observations..." />
                    </div>
                    <div className="form-group-hs">
                      <label>Remarks</label>
                      <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Recommendations / Treatment advice..." />
                    </div>
                  </>
                )}

                {/* VISION FORM */}
                {activeSchedule.screening_type === 'Vision' && (
                  <>
                    <div className="form-group-hs">
                      <label>Visual Acuity (Left Eye)</label>
                      <input type="text" required value={docData.visual_acuity_left} onChange={e => setDocData({...docData, visual_acuity_left: e.target.value})} placeholder="e.g. 20/20" />
                    </div>
                    <div className="form-group-hs">
                      <label>Visual Acuity (Right Eye)</label>
                      <input type="text" required value={docData.visual_acuity_right} onChange={e => setDocData({...docData, visual_acuity_right: e.target.value})} placeholder="e.g. 20/20" />
                    </div>
                    <div className="form-group-hs">
                      <label>Remarks</label>
                      <textarea value={docData.remarks} onChange={e => setDocData({...docData, remarks: e.target.value})} rows={2} placeholder="Prescription / Doctor referral notes..." />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer-hs">
                <button type="button" className="btn-hs btn-secondary-hs" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn-hs btn-primary-hs">Save Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}