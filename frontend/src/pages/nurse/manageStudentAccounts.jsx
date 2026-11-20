// manageStudentAccounts.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CalendarRange,
  ChevronsUp,
  Search,
  UserPlus, 
  Edit, 
  Eye,
  GraduationCap, 
  UserCheck, 
  UserX,
  X,
  Check,
  FilterX,
  Users,
  User,
  Phone,
  Unlink,
  Upload,
  Download,
  Trash2,
  Layers,
  Printer,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';

import StudentSchoolYearModal, { schoolYearText } from '../../components/nurse/StudentSchoolYearModal';
import stiLogo from '../../assets/sti-logof.png';
import { formatDate } from '../../utils/datetime';
import '../../styles/nurse/ManageStudentAccounts.css';

const API_BASE = 'http://localhost:3001/api';
const DOMAIN_EXTENSION = '@baliuag.sti.edu.ph';
const SECTIONS = ['A', 'B', 'C'];
const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'drop', label: 'Drop' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Other' }
];
const NO_FILTERS = { program_id: '', school_year: '', section: '', status: '' };

// status key of an account: active | graduated | drop | transfer | other (inactive without a reason is "other")
const statusOf = (s) => {
  if (Number(s.is_active) === 1) return 'active';
  const reason = String(s.inactive_reason || '').toLowerCase();
  return ['graduated', 'drop', 'transfer'].includes(reason) ? reason : 'other';
};
const initialsOf = (s) => `${(s.first_name || '').trim()[0] || ''}${(s.last_name || '').trim()[0] || ''}`.toUpperCase() || '?';
// class tag like "BSIT - 4B"
const classTag = (s) => `${s.program_id || ''} - ${s.year_level || ''}${s.section || ''}`;

// Helper function to validate Philippine phone number format (09XXXXXXXXX or +639XXXXXXXXX)
const isValidPhPhone = (phone) => {
  if (!phone) return false;
  const cleanPhone = phone.trim();
  return /^(09|\+639)\d{9}$/.test(cleanPhone);
};

// Helper function to auto-generate parent_id in PARENT-[LASTNAME]001 format
const generateParentId = (lastName, count = 1) => {
  if (!lastName || !lastName.trim()) return '';
  const cleanLastName = lastName.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!cleanLastName) return '';
  const paddedIndex = String(count).padStart(3, '0');
  return `PARENT-${cleanLastName}${paddedIndex}`;
};

// Helper function to auto-generate username prefix in [lastname].[idSuffix] format
const generateAutoUsername = (lastName, studentId) => {
  const cleanLastName = (lastName || '').trim().toLowerCase().replace(/\s+/g, '');
  const suffix = (studentId || '').startsWith('02000') 
    ? (studentId || '').slice(5) 
    : (studentId || '');
  
  if (cleanLastName && suffix) {
    return `${cleanLastName}.${suffix}`;
  }
  return cleanLastName || suffix;
};

export default function ManageStudentAccounts() {
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const { userId } = useOutletContext() || {};

  // School years and list filters (program, school year, section, status)
  const [schoolYearInfo, setSchoolYearInfo] = useState(null);
  const [isSchoolYearOpen, setIsSchoolYearOpen] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const fetchSeq = useRef(0);
  const [noParentOnly, setNoParentOnly] = useState(false);
  const anyFilter = Object.values(filters).some(Boolean) || noParentOnly;

  // the server filters by program / school year / section / search; the status chips filter here so every chip can show its count
  const statusCount = (key) => students.filter((s) => statusOf(s) === key).length;
  const activeStudentCount = statusCount('active');
  const noParentCount = students.filter((s) => Number(s.is_active) === 1 && !s.parent_id).length;
  const visibleStudents = students.filter((s) => (
    (!filters.status || statusOf(s) === filters.status) &&
    (!noParentOnly || (Number(s.is_active) === 1 && !s.parent_id))
  ));

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStudentView, setSelectedStudentView] = useState(null);

  // Unified Alert & Confirmation Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'info', // 'info' | 'success' | 'error' | 'warning' | 'confirm'
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  const showAlert = (title, message, type = 'info') => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: null,
      confirmText: 'OK',
      cancelText: 'Cancel'
    });
  };

  const showConfirm = (title, message, onConfirm, confirmText = 'Yes, Proceed', type = 'confirm') => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText: 'Cancel'
    });
  };

  const closeModalConfig = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  // Helper to determine program type ('strand' vs 'course')
  const getProgramType = (programId) => {
    const selectedProg = programs.find((p) => String(p.program_id) === String(programId));
    if (!selectedProg) return 'course';
    const type = (
      selectedProg.academic_program ||
      selectedProg.type ||
      selectedProg.program_type ||
      ''
    ).toLowerCase();
    return type.includes('strand') ? 'strand' : 'course';
  };

  // last year of the program: 2nd year of a strand, 4th year of a course
  const isFinalYear = (programId, yearLevel) => Number(yearLevel) >= (getProgramType(programId) === 'strand' ? 2 : 4);
  const originalActive = (studentId) => {
    const found = students.find((s) => s.student_id === studentId);
    return !found || Number(found.is_active) === 1;
  };

  // Form State for Single Student Creation
  const [studentForm, setStudentForm] = useState({
    student_id: '02000',
    first_name: '',
    last_name: '',
    username: '',
    password: '123',
    program_id: '',
    year_level: '1',
    section: 'A',
    school_year: '',
    is_active: true
  });

  // Password default toggle states
  const [useDefaultPassword, setUseDefaultPassword] = useState(true);
  const [useParentDefaultPassword, setUseParentDefaultPassword] = useState(true);

  // Parent Creation Option State (For Add Modal)
  const [parentOption, setParentOption] = useState('none');
  const [parentSearch, setParentSearch] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');

  const [newParentForm, setNewParentForm] = useState({
    parent_id: '',
    first_name: '',
    last_name: '',
    username: '',
    password: '123',
    primary_phone: '',
    is_active: true
  });

  // Batch Pre-Fill State
  const [batchStudents, setBatchStudents] = useState([]);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Edit State
  const [editForm, setEditForm] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    username: '',
    program_id: '',
    year_level: '1',
    section: 'A',
    school_year: '',
    is_active: true,
    inactive_reason: '',
    inactive_reason_other: '',
    reset_password: false,
    current_parent_id: null,
    current_parent_name: '',
    current_parent_username: ''
  });

  // Parent Management State for Edit Modal
  const [parentAction, setParentAction] = useState('keep');
  const [editParentSearch, setEditParentSearch] = useState('');
  const [editParentSearchResults, setEditParentSearchResults] = useState([]);
  const [editSelectedParentId, setEditSelectedParentId] = useState('');
  const [editNewParentForm, setEditNewParentForm] = useState({
    parent_id: '',
    first_name: '',
    last_name: '',
    username: '',
    password: '123',
    primary_phone: '',
    is_active: true
  });

  useEffect(() => {
    fetchPrograms();
    fetchSchoolYears();
  }, []);

  // the list loads on start and again whenever a server filter changes (status is applied on the page)
  useEffect(() => {
    fetchStudents(searchQuery, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.program_id, filters.school_year, filters.section]);

  // Esc closes the top-most dialog of this page
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modalConfig.isOpen) closeModalConfig();
      else if (isViewModalOpen) setIsViewModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fetchSchoolYears = async () => {
    try {
      const res = await fetch(`${API_BASE}/school-years`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.years)) throw new Error(data?.error || 'Failed to load the school years');
      setSchoolYearInfo(data);
      setStudentForm(prev => (prev.school_year ? prev : { ...prev, school_year: data.current || '' }));
    } catch (err) {
      console.error('Error fetching school years:', err);
      setSchoolYearInfo(null);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`${API_BASE}/academic-programs/manageStudentAccounts`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPrograms(data);
        if (data.length > 0) {
          setStudentForm(prev => ({ ...prev, program_id: data[0].program_id }));
        }
      } else {
        setPrograms([]);
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
      setPrograms([]);
    }
  };

  const fetchStudents = async (query = '', active = filtersRef.current) => {
    const seq = ++fetchSeq.current;
    const params = new URLSearchParams({ search: query });
    Object.entries(active).forEach(([key, value]) => { if (value && key !== 'status') params.set(key, value); });
    try {
      const res = await fetch(`${API_BASE}/students/manageStudentAccounts?${params.toString()}`);
      const data = await res.json();
      if (seq !== fetchSeq.current) return; // a newer search or filter answered meanwhile
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      console.error('Error fetching students:', err);
      setStudents([]);
    }
  };

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const clearAllFilters = () => { setFilters(NO_FILTERS); setNoParentOnly(false); };

  // Multi-select to move students up one year level (strand stops at 2nd year, course at 4th year)
  const [pickedIds, setPickedIds] = useState([]);
  const [pickMode, setPickMode] = useState(false);
  const stopPicking = () => { setPickMode(false); setPickedIds([]); };
  const canMoveUp = (s) => Number(s.is_active) === 1 && !isFinalYear(s.program_id, s.year_level);
  const movable = visibleStudents.filter(canMoveUp);
  const movableIds = new Set(movable.map((s) => s.student_id));
  const picked = pickedIds.filter((id) => movableIds.has(id));
  const allPicked = movable.length > 0 && picked.length === movable.length;

  const togglePicked = (id) => setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAllPicked = () => setPickedIds(allPicked ? [] : movable.map((s) => s.student_id));

  const handleMoveUp = () => {
    if (!picked.length) return;
    showConfirm(
      'Move up',
      `Move ${picked.length} student(s) to the next year level?`,
      async () => {
        closeModalConfig();
        try {
          const res = await fetch(`${API_BASE}/students/move-up/manageStudentAccounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_ids: picked })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Could not move students up.');
          const skipped = (data.skipped_final_year || 0) + (data.skipped_inactive || 0) + (data.not_found || 0);
          stopPicking();
          await fetchStudents(searchQuery, filtersRef.current);
          showAlert('Moved up', `${data.moved} moved${skipped ? `, ${skipped} skipped` : ''}.`, skipped ? 'warning' : 'success');
        } catch (err) {
          showAlert('Error', err.message || 'Could not move students up.', 'error');
        }
      },
      'Move up'
    );
  };

  // EXPORT REPORT FOR ALL STUDENT ACCOUNTS
  const handleExportAllReport = () => {
    const rowsToExport = visibleStudents;

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      showAlert('Popup Blocked', 'Please allow popups in your browser to preview and print the report.', 'warning');
      return;
    }

    const reportDate = formatDate(new Date());

    const tableRowsHtml = rowsToExport.map(s => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim();
      const parentInfo = s.parent_id 
        ? `${s.parent_id} (${s.parent_first_name || ''} ${s.parent_last_name || ''})`.trim()
        : 'None';
      const statusStr = Number(s.is_active) === 1 ? 'Active' : 'Inactive';

      return `
        <tr>
          <td>${s.student_id || ''}</td>
          <td><strong>${fullName}</strong></td>
          <td>${s.username || 'N/A'}</td>
          <td>${s.program_id || 'N/A'}</td>
          <td>${s.school_year ? schoolYearText(s.school_year) : 'N/A'}</td>
          <td>${s.year_level || ''} - ${s.section || ''}</td>
          <td>${parentInfo}</td>
          <td>${statusStr}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Student Accounts Summary Report</title>
          <style>
              body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
              .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
              .report-header img { height: 60px; margin-right: 20px; }
              .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
              .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
              .meta-info { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 16px; font-weight: 500; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 35px; }
              th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
              td { padding: 8px 10px; border: 1px solid #e2e8f0; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .signature-section { margin-top: 40px; font-size: 13px; }
              .signature-title { color: #475569; margin-bottom: 35px; }
              .signature-name { font-weight: bold; font-size: 14px; color: #0f172a; }
              .signature-role { font-style: italic; color: #64748b; }
              @media print { body { margin: 0; } }
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
              <span><strong>STUDENT ACCOUNTS SUMMARY REPORT</strong></span>
              <span>Date Generated: ${reportDate}</span>
          </div>

          <table>
              <thead>
                  <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Username</th>
                      <th>Program</th>
                      <th>School Year</th>
                      <th>Yr / Sec</th>
                      <th>Linked Parent</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRowsHtml || '<tr><td colspan="8">No student accounts found.</td></tr>'}
              </tbody>
          </table>

          <div class="signature-section">
              <div class="signature-title">Prepared by:</div>
              <div class="signature-name">Marilou H. Balarao</div>
              <div class="signature-role">School Nurse</div>
          </div>

          <script>
              window.onload = function() { window.print(); };
          </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // EXPORT REPORT FOR SPECIFIC STUDENT ACCOUNT
  const handleExportSingleReport = () => {
    if (!selectedStudentView) return;

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      showAlert('Popup Blocked', 'Please allow popups in your browser to preview and print the report.', 'warning');
      return;
    }

    const reportDate = formatDate(new Date());

    const studentName = `${selectedStudentView.first_name || ''} ${selectedStudentView.last_name || ''}`.trim();
    const studentStatus = Number(selectedStudentView.is_active) === 1 ? 'Active' : 'Inactive';
    const parentName = selectedStudentView.parent_first_name 
      ? `${selectedStudentView.parent_first_name} ${selectedStudentView.parent_last_name}` 
      : 'N/A';
    const parentStatus = selectedStudentView.parent_id 
      ? (Number(selectedStudentView.parent_is_active) === 1 ? 'Active' : 'Inactive') 
      : 'N/A';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Individual Student Account Report - ${selectedStudentView.student_id || 'Student'}</title>
          <style>
              body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
              .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
              .report-header img { height: 60px; margin-right: 20px; }
              .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
              .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
              .meta-info { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 16px; font-weight: 500; }
              .details-card { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 35px; }
              th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
              td { padding: 8px 10px; border: 1px solid #e2e8f0; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .signature-section { margin-top: 40px; font-size: 13px; }
              .signature-title { color: #475569; margin-bottom: 35px; }
              .signature-name { font-weight: bold; font-size: 14px; color: #0f172a; }
              .signature-role { font-style: italic; color: #64748b; }
              @media print { body { margin: 0; } }
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
              <span><strong>INDIVIDUAL STUDENT ACCOUNT REPORT</strong></span>
              <span>Date Generated: ${reportDate}</span>
          </div>

          <div class="details-card">
              <div><strong>Student Name:</strong> ${studentName}</div>
              <div><strong>Student ID:</strong> ${selectedStudentView.student_id || 'N/A'}</div>
              <div><strong>Username:</strong> ${selectedStudentView.username || 'N/A'}</div>
              <div><strong>Program:</strong> ${selectedStudentView.program_name || selectedStudentView.program_id || 'N/A'}</div>
              <div><strong>Year Level & Section:</strong> ${selectedStudentView.year_level || ''} - ${selectedStudentView.section || ''}</div>
              <div><strong>Account Status:</strong> ${studentStatus}</div>
          </div>

          <h3 style="font-size: 14px; color: #1e3a8a; margin-bottom: 10px;">Linked Parent Account Details</h3>
          <table>
              <thead>
                  <tr>
                      <th>Parent ID</th>
                      <th>Parent Name</th>
                      <th>Username</th>
                      <th>Primary Phone</th>
                      <th>Parent Status</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td>${selectedStudentView.parent_id || 'None'}</td>
                      <td>${parentName}</td>
                      <td>${selectedStudentView.parent_username || 'N/A'}</td>
                      <td>${selectedStudentView.parent_phone || 'N/A'}</td>
                      <td>${parentStatus}</td>
                  </tr>
              </tbody>
          </table>

          <div class="signature-section">
              <div class="signature-title">Prepared by:</div>
              <div class="signature-name">Marilou H. Balarao</div>
              <div class="signature-role">School Nurse</div>
          </div>

          <script>
              window.onload = function() { window.print(); };
          </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Enforce student_id prefix '02000' & autofill username
  const handleStudentIdChange = (e) => {
    const value = e.target.value;
    let newId = value;
    if (!value.startsWith('02000')) {
      newId = '02000';
    }
    setStudentForm((prev) => {
      const autoUser = generateAutoUsername(prev.last_name, newId);
      return {
        ...prev,
        student_id: newId,
        username: autoUser
      };
    });
  };

  const handleProgramChange = (e, isEdit = false) => {
    const selectedProgId = e.target.value;
    const progType = getProgramType(selectedProgId);

    if (isEdit) {
      setEditForm(prev => {
        let yLevel = prev.year_level;
        if (progType === 'strand' && Number(yLevel) > 2) {
          yLevel = '1';
        }
        return { ...prev, program_id: selectedProgId, year_level: yLevel };
      });
    } else {
      setStudentForm(prev => {
        let yLevel = prev.year_level;
        if (progType === 'strand' && Number(yLevel) > 2) {
          yLevel = '1';
        }
        return { ...prev, program_id: selectedProgId, year_level: yLevel };
      });
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    fetchStudents(query);
  };

  const formatUsernameInput = (val) => {
    if (!val) return '';
    const clean = val.replace(DOMAIN_EXTENSION, '').trim();
    return clean ? `${clean}${DOMAIN_EXTENSION}` : '';
  };

  const handleDefaultPasswordToggle = (e) => {
    const checked = e.target.checked;
    setUseDefaultPassword(checked);
    setStudentForm(prev => ({ ...prev, password: checked ? '123' : '' }));
  };

  const handleParentDefaultPasswordToggle = (e) => {
    const checked = e.target.checked;
    setUseParentDefaultPassword(checked);
    setNewParentForm(prev => ({ ...prev, password: checked ? '123' : '' }));
  };

  // Enforce parent username format with fixed '.parent' suffix (e.g., lastname.parent)
  const handleParentUsernameChange = (val, isEdit = false) => {
    let clean = val.trim().toLowerCase();
    const base = clean.replace(/(\.parent|parent\.)/g, '').replace(/[^a-z0-9._-]/g, '');
    const formatted = base ? `${base}.parent` : '';
    
    if (isEdit) {
      setEditNewParentForm(prev => ({ ...prev, username: formatted }));
    } else {
      setNewParentForm(prev => ({ ...prev, username: formatted }));
    }
  };

  // Dynamic student/parent last name changes with auto username lastname.parent & parent_id generation
  const handleStudentLastNameChange = (e) => {
    const lastName = e.target.value;

    setStudentForm(prev => {
      const autoUser = generateAutoUsername(lastName, prev.student_id);
      return {
        ...prev,
        last_name: lastName,
        username: autoUser
      };
    });

    setNewParentForm(prev => {
      const effectiveParentLastName = prev.last_name && prev.last_name !== studentForm.last_name 
        ? prev.last_name 
        : lastName;
      const cleanParentLastName = effectiveParentLastName.trim().toLowerCase().replace(/\s+/g, '');

      return {
        ...prev,
        last_name: effectiveParentLastName,
        parent_id: generateParentId(effectiveParentLastName),
        username: cleanParentLastName ? `${cleanParentLastName}.parent` : ''
      };
    });
  };

  const handleParentLastNameChange = (e) => {
    const parentLastName = e.target.value;
    const cleanParentLastName = parentLastName.trim().toLowerCase().replace(/\s+/g, '');
    setNewParentForm(prev => ({
      ...prev,
      last_name: parentLastName,
      parent_id: generateParentId(parentLastName),
      username: cleanParentLastName ? `${cleanParentLastName}.parent` : ''
    }));
  };

  const handleEditParentLastNameChange = (e) => {
    const parentLastName = e.target.value;
    const cleanParentLastName = parentLastName.trim().toLowerCase().replace(/\s+/g, '');
    setEditNewParentForm(prev => ({
      ...prev,
      last_name: parentLastName,
      parent_id: generateParentId(parentLastName),
      username: cleanParentLastName ? `${cleanParentLastName}.parent` : ''
    }));
  };

  const handleParentSearch = async (query, isEdit = false) => {
    if (isEdit) {
      setEditParentSearch(query);
    } else {
      setParentSearch(query);
    }

    if (!query.trim()) {
      if (isEdit) setEditParentSearchResults([]);
      else setParentSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/parents/search/manageStudentAccounts?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (isEdit) {
        setEditParentSearchResults(Array.isArray(data) ? data : []);
      } else {
        setParentSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error searching parents:', err);
      if (isEdit) setEditParentSearchResults([]);
      else setParentSearchResults([]);
    }
  };

  const handleCreateStudent = (e) => {
    e.preventDefault();

    // Validate Philippine Phone Number if creating a new parent
    if (parentOption === 'new' && newParentForm.primary_phone && !isValidPhPhone(newParentForm.primary_phone)) {
      showAlert('Validation Error', 'Please enter a valid Philippine phone number format (e.g. 09196398319 or +639196398319).', 'warning');
      return;
    }

    showConfirm(
      'Confirm Account Creation',
      `Are you sure you want to create a new student account for ${studentForm.first_name} ${studentForm.last_name}?`,
      () => executeCreateStudent(),
      'Create Student'
    );
  };

  const executeCreateStudent = async () => {
    const payload = {
      ...studentForm,
      username: formatUsernameInput(studentForm.username),
      parent_option: parentOption,
      selected_parent_id: selectedParentId,
      new_parent: parentOption === 'new' ? {
        ...newParentForm,
        username: formatUsernameInput(newParentForm.username)
      } : null
    };

    try {
      const res = await fetch(`${API_BASE}/students/manageStudentAccounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showAlert('Success', 'Student Account created successfully!', 'success');
        setIsAddModalOpen(false);
        resetAddForm();
        fetchStudents(searchQuery);
      } else {
        const err = await res.json();
        showAlert('Error', `Error: ${err.error || 'Failed to create student account'}`, 'error');
      }
    } catch (err) {
      console.error('Error creating student:', err);
      showAlert('Error', 'Failed to create student account.', 'error');
    }
  };

  const handleUpdateStudent = (e) => {
    e.preventDefault();

    // Validate Philippine Phone Number if creating/updating a new parent
    if (parentAction === 'new' && editNewParentForm.primary_phone && !isValidPhPhone(editNewParentForm.primary_phone)) {
      showAlert('Validation Error', 'Please enter a valid Philippine phone number format (e.g. 09196398319 or +639196398319).', 'warning');
      return;
    }

    // an account that is turned off needs the reason; Graduated is only for the last year (2nd year strand, 4th year course)
    if (!editForm.is_active) {
      if (!editForm.inactive_reason && originalActive(editForm.student_id)) {
        showAlert('Validation Error', 'Choose the reason the account is inactive: Transfer, Graduated, Drop or Other.', 'warning');
        return;
      }
      if (editForm.inactive_reason === 'Other' && !editForm.inactive_reason_other.trim()) {
        showAlert('Validation Error', 'Specify the other reason.', 'warning');
        return;
      }
      if (editForm.inactive_reason === 'Graduated' && !isFinalYear(editForm.program_id, editForm.year_level)) {
        showAlert('Validation Error', 'Graduated is only for 2nd year strand and 4th year course students.', 'warning');
        return;
      }
    }

    showConfirm(
      'Confirm Update',
      `Are you sure you want to save changes for student account ${editForm.student_id}?`,
      () => executeUpdateStudent(),
      'Save Changes'
    );
  };

  const executeUpdateStudent = async () => {
    const payload = {
      ...editForm,
      username: formatUsernameInput(editForm.username),
      parent_action: parentAction,
      selected_parent_id: editSelectedParentId,
      new_parent: parentAction === 'new' ? {
        ...editNewParentForm,
        username: formatUsernameInput(editNewParentForm.username)
      } : null
    };

    try {
      const res = await fetch(`${API_BASE}/students/${editForm.student_id}/manageStudentAccounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showAlert('Success', 'Student details updated successfully!', 'success');
        setIsEditModalOpen(false);
        fetchStudents(searchQuery);
      } else {
        const err = await res.json();
        showAlert('Error', `Failed to update student account: ${err.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('Error updating student:', err);
      showAlert('Error', 'Failed to update student account.', 'error');
    }
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          showAlert('Invalid CSV', 'CSV file is empty or missing data rows.', 'error');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const defaultProg = programs.length > 0 ? programs[0].program_id : '';

        const parsedBatch = lines.slice(1).map((line, idx) => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row = {};
          headers.forEach((header, hIdx) => {
            row[header] = values[hIdx] || '';
          });

          const rawStudentId = row.student_id || row.id || '';
          const studentId = rawStudentId.startsWith('02000') ? rawStudentId : `02000${rawStudentId}`;
          const firstName = row.first_name || row.firstname || '';
          const lastName = row.last_name || row.lastname || '';
          const autoUser = generateAutoUsername(lastName, studentId);
          const usernameClean = row.username ? row.username.replace(DOMAIN_EXTENSION, '').trim() : autoUser;
          const password = row.password || '123';
          const programId = row.program_id || defaultProg;
          const progType = getProgramType(programId);
          let yearLevel = row.year_level || row.year || '1';
          if (progType === 'strand' && Number(yearLevel) > 2) {
            yearLevel = '1';
          }
          const rawSection = (row.section || 'A').toUpperCase();
          const section = ['A', 'B', 'C'].includes(rawSection) ? rawSection : 'A';
          const isActive = row.is_active !== undefined ? (String(row.is_active) === '1' || String(row.is_active).toLowerCase() === 'true') : true;

          const parentLastName = row.parent_last_name || lastName;
          const cleanParentLastName = parentLastName.trim().toLowerCase().replace(/\s+/g, '');
          const autoParentId = row.parent_id || generateParentId(parentLastName, idx + 1);
          const hasParent = Boolean(row.parent_id || row.parent_username || row.parent_last_name);
          const parentOption = hasParent ? 'new' : 'none';

          const parentUsernameClean = row.parent_username 
            ? row.parent_username.replace(DOMAIN_EXTENSION, '').trim() 
            : `${cleanParentLastName}.parent`;

          return {
            id: idx,
            student_id: studentId,
            first_name: firstName,
            last_name: lastName,
            username: usernameClean,
            password: password,
            program_id: programId,
            year_level: yearLevel,
            section: section,
            is_active: isActive,
            parent_option: parentOption,
            selected_parent_id: autoParentId,
            new_parent: hasParent ? {
              parent_id: autoParentId,
              first_name: row.parent_first_name || '',
              last_name: parentLastName,
              username: parentUsernameClean,
              password: row.parent_password || '123',
              primary_phone: row.parent_phone || row.primary_phone || '',
              is_active: true
            } : null
          };
        });

        setBatchStudents(parsedBatch);
        setIsBatchModalOpen(true);
      } catch (err) {
        console.error('Error parsing CSV:', err);
        showAlert('CSV Error', 'Failed to parse CSV file.', 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleBatchFieldChange = (index, field, value) => {
    setBatchStudents(prev => {
      const updated = [...prev];
      let item = { ...updated[index], [field]: value };

      if (field === 'program_id') {
        const progType = getProgramType(value);
        if (progType === 'strand' && Number(item.year_level) > 2) {
          item.year_level = '1';
        }
      }

      if (field === 'student_id' || field === 'last_name') {
        if (field === 'student_id' && !value.startsWith('02000')) {
          item.student_id = '02000';
        }
        item.username = generateAutoUsername(item.last_name, item.student_id);
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleBatchParentFieldChange = (index, field, value) => {
    setBatchStudents(prev => {
      const updated = [...prev];
      if (updated[index].new_parent) {
        let val = value;
        if (field === 'username') {
          let clean = val.trim().toLowerCase();
          const base = clean.replace(/(\.parent|parent\.)/g, '').replace(/[^a-z0-9._-]/g, '');
          val = base ? `${base}.parent` : '';
        }
        updated[index] = {
          ...updated[index],
          new_parent: { ...updated[index].new_parent, [field]: val }
        };
      }
      return updated;
    });
  };

  const handleRemoveBatchRow = (index) => {
    const item = batchStudents[index];
    const nameStr = item ? `${item.first_name} ${item.last_name}`.trim() : '';
    const label = nameStr ? `for "${nameStr}"` : `at position #${index + 1}`;

    showConfirm(
      'Confirm Removal',
      `Are you sure you want to remove the record ${label} from the batch list?`,
      () => {
        setBatchStudents(prev => prev.filter((_, i) => i !== index));
      },
      'Remove Row',
      'warning'
    );
  };

  const handleBatchSubmit = (e) => {
    e.preventDefault();
    if (batchStudents.length === 0) return;

    showConfirm(
      'Confirm Batch Creation',
      `Are you sure you want to process and create all ${batchStudents.length} student account(s)?`,
      () => executeBatchSubmit(),
      'Submit Batch'
    );
  };

  const executeBatchSubmit = async () => {
    setIsSubmittingBatch(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchStudents.length; i++) {
      const item = batchStudents[i];
      const payload = {
        student_id: item.student_id,
        first_name: item.first_name,
        last_name: item.last_name,
        username: formatUsernameInput(item.username),
        password: item.password,
        program_id: item.program_id,
        year_level: item.year_level,
        section: item.section,
        is_active: item.is_active,
        parent_option: item.parent_option,
        selected_parent_id: item.selected_parent_id,
        new_parent: item.parent_option === 'new' && item.new_parent ? {
          ...item.new_parent,
          username: formatUsernameInput(item.new_parent.username)
        } : null
      };

      try {
        const res = await fetch(`${API_BASE}/students/manageStudentAccounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    }

    setIsSubmittingBatch(false);

    if (successCount > 0) fetchStudents(searchQuery);

    if (failCount === 0) {
      showAlert('Batch Complete', `Successfully created all ${successCount} student account(s).`, 'success');
      setIsBatchModalOpen(false);
      setBatchStudents([]);
    } else {
      showAlert('Batch Process Finished', `Batch Creation Completed.\nSuccess: ${successCount}, Failed: ${failCount}`, failCount > 0 && successCount > 0 ? 'warning' : 'error');
    }
  };

  const handleCSVExport = () => {
    if (visibleStudents.length === 0) {
      showAlert('Export Failed', 'No student account data available to export.', 'warning');
      return;
    }

    const headers = [
      'student_id','first_name','last_name','username','program_id',
      'program_name','school_year','year_level','section','is_active','inactive_reason','parent_id',
      'parent_username','parent_first_name','parent_last_name','parent_phone'
    ];

    const csvRows = [headers.join(',')];

    visibleStudents.forEach(s => {
      const row = [
        `"${s.student_id || ''}"`,
        `"${s.first_name || ''}"`,
        `"${s.last_name || ''}"`,
        `"${s.username || ''}"`,
        `"${s.program_id || ''}"`,
        `"${s.program_name || ''}"`,
        `"${s.school_year || ''}"`,
        `"${s.year_level || ''}"`,
        `"${s.section || ''}"`,
        `"${s.is_active}"`,
        `"${s.inactive_reason || ''}"`,
        `"${s.parent_id || ''}"`,
        `"${s.parent_username || ''}"`,
        `"${s.parent_first_name || ''}"`,
        `"${s.parent_last_name || ''}"`,
        `"${s.parent_phone || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student_accounts_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openViewModal = (student) => {
    setSelectedStudentView(student);
    setIsViewModalOpen(true);
  };

  const openEditModal = (student) => {
    const progType = getProgramType(student.program_id);
    let yLevel = String(student.year_level || '1');
    if (progType === 'strand' && Number(yLevel) > 2) {
      yLevel = '1';
    }
    const sec = ['A', 'B', 'C'].includes((student.section || '').toUpperCase()) 
      ? student.section.toUpperCase() 
      : 'A';

    const cleanLastName = (student.last_name || '').trim().toLowerCase().replace(/\s+/g, '');
    const cleanStudentUsername = (student.username || '').replace(DOMAIN_EXTENSION, '').trim();

    setEditForm({
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      username: cleanStudentUsername,
      program_id: student.program_id,
      year_level: yLevel,
      section: sec,
      school_year: student.school_year || schoolYearInfo?.current || '',
      is_active: Number(student.is_active) === 1,
      inactive_reason: student.inactive_reason || '',
      inactive_reason_other: student.inactive_reason_other || '',
      reset_password: false,
      current_parent_id: student.parent_id,
      current_parent_name: student.parent_first_name ? `${student.parent_first_name} ${student.parent_last_name}` : '',
      current_parent_username: student.parent_username
    });
    setParentAction('keep');
    setEditParentSearch('');
    setEditParentSearchResults([]);
    setEditSelectedParentId('');
    setEditNewParentForm({
      parent_id: generateParentId(student.last_name),
      first_name: '',
      last_name: student.last_name || '',
      username: cleanLastName ? `${cleanLastName}.parent` : '',
      password: '123',
      primary_phone: '',
      is_active: true
    });
    setIsEditModalOpen(true);
  };

  const resetAddForm = () => {
    setStudentForm({
      student_id: '02000',
      first_name: '',
      last_name: '',
      username: '',
      password: '123',
      program_id: Array.isArray(programs) && programs.length > 0 ? programs[0].program_id : '',
      year_level: '1',
      section: 'A',
      school_year: schoolYearInfo?.current || '',
      is_active: true
    });
    setUseDefaultPassword(true);
    setParentOption('none');
    setParentSearch('');
    setParentSearchResults([]);
    setSelectedParentId('');
    setNewParentForm({
      parent_id: '',
      first_name: '',
      last_name: '',
      username: '',
      password: '123',
      primary_phone: '',
      is_active: true
    });
    setUseParentDefaultPassword(true);
  };

  return (
    <div className="student-container-msa">
      <header className="header-msa">
        <div className="brand-msa">
          <GraduationCap className="icon-brand-msa" size={32} aria-hidden="true" />
          <div>
            <h1>Student Accounts</h1>
            <p className="header-sub-msa">
              <CalendarRange size={16} aria-hidden="true" />
              <span>{schoolYearInfo?.current ? schoolYearText(schoolYearInfo.current) : 'School year not set'}</span>
            </p>
          </div>
        </div>

        <div className="header-actions-msa" role="toolbar" aria-label="Account actions">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden-input-msa"
            onChange={handleCSVImport}
            tabIndex={-1}
            aria-hidden="true"
          />
          <button type="button" className="btn-hdr-msa" onClick={() => setIsSchoolYearOpen(true)} aria-label="Change school year" title="Change school year">
            <CalendarRange size={20} aria-hidden="true" />
          </button>
          <span className="divider-msa" aria-hidden="true" />
          <button type="button" className="btn-hdr-msa" onClick={() => fileInputRef.current.click()} aria-label="Import CSV" title="Import CSV">
            <Upload size={20} aria-hidden="true" />
          </button>
          <button type="button" className="btn-hdr-msa" onClick={handleCSVExport} aria-label="Export CSV" title="Export CSV">
            <Download size={20} aria-hidden="true" />
          </button>
          <button type="button" className="btn-hdr-msa" onClick={handleExportAllReport} aria-label="Print report" title="Print report">
            <Printer size={20} aria-hidden="true" />
          </button>
          <span className="divider-msa" aria-hidden="true" />
          <button
            type="button"
            className="btn-hdr-msa btn-hdr-primary-msa"
            onClick={() => { resetAddForm(); setIsAddModalOpen(true); }}
            aria-label="Add student account"
            title="Add student account"
          >
            <UserPlus size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="content-msa">
        <section className="stats-msa" aria-label="Account summary">
          <button
            type="button"
            className="stat-msa"
            aria-pressed={filters.status === 'active' && !noParentOnly}
            onClick={() => { setNoParentOnly(false); setFilter('status', filters.status === 'active' && !noParentOnly ? '' : 'active'); }}
          >
            <span className="stat-ico-msa stat-ok-msa"><Users size={20} aria-hidden="true" /></span>
            <span><span className="stat-num-msa">{activeStudentCount}</span><span className="stat-lbl-msa">Active accounts</span></span>
          </button>
          <button
            type="button"
            className="stat-msa"
            aria-pressed={filters.status === 'graduated'}
            onClick={() => { setNoParentOnly(false); setFilter('status', filters.status === 'graduated' ? '' : 'graduated'); }}
          >
            <span className="stat-ico-msa stat-info-msa"><GraduationCap size={20} aria-hidden="true" /></span>
            <span><span className="stat-num-msa">{statusCount('graduated')}</span><span className="stat-lbl-msa">Graduated</span></span>
          </button>
          <div className="stat-msa stat-static-msa">
            <span className="stat-ico-msa stat-bad-msa"><UserX size={20} aria-hidden="true" /></span>
            <span><span className="stat-num-msa">{students.length - activeStudentCount}</span><span className="stat-lbl-msa">Inactive</span></span>
          </div>
          <button
            type="button"
            className="stat-msa"
            aria-pressed={noParentOnly}
            onClick={() => { setNoParentOnly((v) => !v); setFilter('status', ''); }}
          >
            <span className="stat-ico-msa stat-warn-msa"><Unlink size={20} aria-hidden="true" /></span>
            <span><span className="stat-num-msa">{noParentCount}</span><span className="stat-lbl-msa">Active, no parent</span></span>
          </button>
        </section>

        <section className="card-msa" aria-label="Student roster">
          <div className="toolbar-msa">
            <div className="search-wrapper-msa">
              <label className="sr-only-msa" htmlFor="msa-search">Search students</label>
              <Search className="search-icon-msa" size={18} aria-hidden="true" />
              <input
                id="msa-search"
                type="search"
                className="search-input-msa"
                placeholder="ID, name or username"
                value={searchQuery}
                onChange={handleSearchChange}
                autoComplete="off"
              />
            </div>

            <div className="filters-msa" role="group" aria-label="Filter student accounts">
              <label className="sr-only-msa" htmlFor="filter-program-msa">Program</label>
              <select id="filter-program-msa" className="field-msa" value={filters.program_id} onChange={(e) => setFilter('program_id', e.target.value)}>
                <option value="">All programs</option>
                {programs.map((p) => (
                  <option key={p.program_id} value={p.program_id}>{p.program_id} - {p.program_name}</option>
                ))}
              </select>
              <label className="sr-only-msa" htmlFor="filter-year-msa">School year</label>
              <select id="filter-year-msa" className="field-msa" value={filters.school_year} onChange={(e) => setFilter('school_year', e.target.value)}>
                <option value="">All school years</option>
                {(schoolYearInfo?.years || []).map((y) => (
                  <option key={y.school_year} value={y.school_year}>
                    {schoolYearText(y.school_year)}{y.is_current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              <label className="sr-only-msa" htmlFor="filter-section-msa">Section</label>
              <select id="filter-section-msa" className="field-msa" value={filters.section} onChange={(e) => setFilter('section', e.target.value)}>
                <option value="">All sections</option>
                {SECTIONS.map((sec) => <option key={sec} value={sec}>Section {sec}</option>)}
              </select>
              <button
                type="button"
                className="btn-tool-msa"
                onClick={clearAllFilters}
                disabled={!anyFilter}
                aria-label="Clear filters"
                title="Clear filters"
              >
                <FilterX size={20} aria-hidden="true" />
              </button>
            </div>

            <span className="divider-msa divider-tool-msa" aria-hidden="true" />
            <button
              type="button"
              className="btn-tool-msa"
              aria-pressed={pickMode}
              onClick={() => (pickMode ? stopPicking() : setPickMode(true))}
              aria-label="Select students to move up one year level"
              title="Move up one year level"
            >
              <ChevronsUp size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="chips-msa" role="group" aria-label="Account status">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.value || 'all'}
                type="button"
                className="chip-msa"
                aria-pressed={!noParentOnly && filters.status === c.value}
                onClick={() => { setNoParentOnly(false); setFilter('status', c.value); }}
              >
                {c.label} <span className="chip-n-msa">{c.value ? statusCount(c.value) : students.length}</span>
              </button>
            ))}
            <span className="chips-count-msa" role="status" aria-live="polite">{visibleStudents.length} shown</span>
          </div>

          <div className="table-container-msa">
            <table className="table-msa table-roster-msa">
              <thead>
                <tr>
                  {pickMode && (
                    <th scope="col" className="check-col-msa">
                      <input
                        type="checkbox"
                        checked={allPicked}
                        onChange={toggleAllPicked}
                        disabled={!movable.length}
                        aria-label="Select all students that can move up"
                        title="Select all that can move up"
                      />
                    </th>
                  )}
                  <th scope="col">Student</th>
                  <th scope="col">Program</th>
                  <th scope="col">School year</th>
                  <th scope="col">Parent</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only-msa">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.length > 0 ? (
                  visibleStudents.map((student) => {
                    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
                    const isPicked = picked.includes(student.student_id);
                    const reasonText = student.inactive_reason === 'Other' && student.inactive_reason_other
                      ? student.inactive_reason_other
                      : student.inactive_reason;
                    return (
                      <tr key={student.student_id} className={isPicked ? 'row-picked-msa' : ''}>
                        {pickMode && (
                          <td className="check-col-msa">
                            <input
                              type="checkbox"
                              checked={isPicked}
                              onChange={() => togglePicked(student.student_id)}
                              disabled={!canMoveUp(student)}
                              aria-label={`Select ${fullName}${canMoveUp(student) ? '' : (Number(student.is_active) === 1 ? ', last year' : ', inactive')}`}
                              title={canMoveUp(student) ? 'Select' : (Number(student.is_active) === 1 ? 'Last year' : 'Inactive')}
                            />
                          </td>
                        )}
                        <td className="who-cell-msa">
                          <div className="who-msa">
                            <span className="avatar-msa" aria-hidden="true">{initialsOf(student)}</span>
                            <span>
                              <span className="who-name-msa">{fullName}</span>
                              <span className="mono-msa">{student.student_id}</span>
                            </span>
                          </div>
                        </td>
                        <td data-label="Program">
                          <span className="badge-msa badge-blue-msa">{classTag(student)}</span>
                        </td>
                        <td data-label="School year">
                          {student.school_year ? schoolYearText(student.school_year) : <span className="text-muted-msa">N/A</span>}
                        </td>
                        <td data-label="Parent" className="parent-cell-msa">
                          {student.parent_id ? (
                            <div className="parent-info-cell-msa" title={`Username: ${student.parent_username || 'N/A'}`}>
                              <span>{student.parent_first_name ? `${student.parent_first_name} ${student.parent_last_name || ''}`.trim() : 'Parent linked'}</span>
                              <span className="mono-msa">{student.parent_id}</span>
                            </div>
                          ) : (
                            <span className="text-muted-msa none-msa"><Unlink size={16} aria-hidden="true" /> None</span>
                          )}
                        </td>
                        <td data-label="Status">
                          {Number(student.is_active) === 1 ? (
                            <span className="badge-msa badge-success-msa"><UserCheck size={14} aria-hidden="true" /> Active</span>
                          ) : (
                            <span className="badge-msa badge-danger-msa"><UserX size={14} aria-hidden="true" /> {reasonText || 'Inactive'}</span>
                          )}
                        </td>
                        <td className="act-cell-msa">
                          <div className="actions-cell-msa">
                            <button
                              type="button"
                              className="btn-icon-msa"
                              aria-label={`View ${fullName}`}
                              title="View details"
                              onClick={() => openViewModal(student)}
                            >
                              <Eye size={18} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-msa"
                              aria-label={`Edit ${fullName}`}
                              title="Edit account"
                              onClick={() => openEditModal(student)}
                            >
                              <Edit size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="empty-row-msa">
                    <td colSpan={pickMode ? 7 : 6} className="empty-table-msa">
                      <Search size={32} aria-hidden="true" />
                      <div>{anyFilter || searchQuery ? 'No accounts match.' : 'No accounts yet.'}</div>
                      {(anyFilter || searchQuery) && (
                        <button
                          type="button"
                          className="btn-tool-msa"
                          onClick={() => { clearAllFilters(); setSearchQuery(''); fetchStudents('', NO_FILTERS); }}
                          aria-label="Clear search and filters"
                          title="Clear search and filters"
                        >
                          <FilterX size={20} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {pickMode && (
        <div className="movebar-msa" role="region" aria-label="Move up selection">
          <span><strong>{picked.length}</strong> selected</span>
          <button
            type="button"
            className="movebar-go-msa"
            onClick={handleMoveUp}
            disabled={!picked.length}
            aria-label={`Move ${picked.length} selected up one year level`}
            title="Move up one year level"
          >
            <Check size={20} aria-hidden="true" />
          </button>
          <button type="button" className="movebar-x-msa" onClick={stopPicking} aria-label="Cancel selection" title="Cancel">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Modal: Batch Pre-Fill & Review CSV Data */}
      {isBatchModalOpen && (
        <div className="modal-overlay-msa" onClick={(e) => { if (e.target === e.currentTarget) setIsBatchModalOpen(false); }}>
          <div className="modal-msa modal-lg-msa">
            <div className="modal-header-msa">
              <div className="modal-title-msa">
                <Layers size={22} />
                <h3>Batch Pre-Fill Account Creation ({batchStudents.length} Records)</h3>
              </div>
              <button type="button" className="close-btn-msa" aria-label="Close batch import modal" onClick={() => setIsBatchModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit} className="modal-content-msa">
              <div className="modal-body-msa">
                <p className="text-muted-msa mb-16-msa">
                  Review and modify the pre-filled CSV batch records below before creating all accounts.
                </p>

                <div className="batch-table-wrapper-msa">
                  <table className="table-msa table-compact-msa">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student ID *</th>
                        <th>First Name *</th>
                        <th>Last Name *</th>
                        <th>Username *</th>
                        <th>Password</th>
                        <th>Program</th>
                        <th>Yr / Sec</th>
                        <th>Parent Pre-Fill Info</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchStudents.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <input
                              type="text"
                              required
                              className="input-sm-msa w-120-msa"
                              value={item.student_id}
                              onChange={(e) => handleBatchFieldChange(idx, 'student_id', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              required
                              className="input-sm-msa w-110-msa"
                              value={item.first_name}
                              onChange={(e) => handleBatchFieldChange(idx, 'first_name', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              required
                              className="input-sm-msa w-110-msa"
                              value={item.last_name}
                              onChange={(e) => handleBatchFieldChange(idx, 'last_name', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              required
                              placeholder="e.g. bernardo.345411"
                              className="input-sm-msa w-160-msa"
                              value={item.username}
                              onChange={(e) => handleBatchFieldChange(idx, 'username', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              required
                              className="input-sm-msa w-90-msa"
                              value={item.password}
                              onChange={(e) => handleBatchFieldChange(idx, 'password', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              className="input-sm-msa w-110-msa"
                              value={item.program_id}
                              onChange={(e) => handleBatchFieldChange(idx, 'program_id', e.target.value)}
                            >
                              {programs.map((p) => (
                                <option key={p.program_id} value={p.program_id}>
                                  {p.program_id}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="inline-flex-gap-4-msa">
                              <select
                                className="input-sm-msa w-45-msa"
                                value={item.year_level}
                                onChange={(e) => handleBatchFieldChange(idx, 'year_level', e.target.value)}
                              >
                                <option value="1">1</option>
                                <option value="2">2</option>
                                {getProgramType(item.program_id) !== 'strand' && (
                                  <>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </>
                                )}
                              </select>
                              <select
                                className="input-sm-msa w-50-msa"
                                value={item.section}
                                onChange={(e) => handleBatchFieldChange(idx, 'section', e.target.value)}
                              >
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                              </select>
                            </div>
                          </td>
                          <td>
                            {item.new_parent ? (
                              <div className="batch-parent-info-msa">
                                <span>
                                  <strong>P-ID:</strong> 
                                  <input 
                                    type="text" 
                                    value={item.new_parent.parent_id} 
                                    onChange={(e) => handleBatchParentFieldChange(idx, 'parent_id', e.target.value)}
                                    className="input-xs-msa w-70-msa"
                                  />
                                </span>
                                <span>
                                  <strong>User:</strong> 
                                  <input 
                                    type="text" 
                                    value={item.new_parent.username} 
                                    onChange={(e) => handleBatchParentFieldChange(idx, 'username', e.target.value)}
                                    className="input-xs-msa w-80-msa"
                                  />
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-msa">None</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-icon-msa text-danger-msa"
                              title="Remove row from batch"
                              aria-label={`Remove row ${idx + 1} from batch`}
                              onClick={() => handleRemoveBatchRow(idx)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer-msa">
                <button 
                  type="button" 
                  className="btn-msa btn-secondary-msa" 
                  onClick={() => setIsBatchModalOpen(false)}
                  disabled={isSubmittingBatch}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-msa btn-primary-msa"
                  disabled={isSubmittingBatch || batchStudents.length === 0}
                >
                  {isSubmittingBatch ? 'Creating Batch...' : `Submit Batch (${batchStudents.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Student & Parent Details */}
      {isViewModalOpen && selectedStudentView && (
        <div className="modal-overlay-msa drawer-overlay-msa" onClick={(e) => { if (e.target === e.currentTarget) setIsViewModalOpen(false); }}>
          <div className="modal-msa drawer-msa" role="dialog" aria-modal="true" aria-labelledby="msa-drawer-title">
            <div className="modal-header-msa">
              <div className="who-msa">
                <span className="avatar-msa avatar-lg-msa" aria-hidden="true">{initialsOf(selectedStudentView)}</span>
                <div>
                  <h3 id="msa-drawer-title">{`${selectedStudentView.first_name || ''} ${selectedStudentView.last_name || ''}`.trim()}</h3>
                  <span className="mono-msa">{selectedStudentView.student_id}</span>
                </div>
              </div>
              <div className="drawer-actions-msa">
                <button
                  type="button"
                  className="btn-icon-msa"
                  onClick={() => { const s = selectedStudentView; setIsViewModalOpen(false); openEditModal(s); }}
                  aria-label="Edit account"
                  title="Edit account"
                >
                  <Edit size={18} aria-hidden="true" />
                </button>
                <button type="button" className="btn-icon-msa" onClick={handleExportSingleReport} aria-label="Print report" title="Print report">
                  <Printer size={18} aria-hidden="true" />
                </button>
                <button type="button" className="btn-icon-msa" onClick={() => setIsViewModalOpen(false)} aria-label="Close" title="Close" autoFocus>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="modal-content-msa">
              <div className="modal-body-msa">
                <div className="section-title-msa">Student Details</div>
                <div className="details-grid-msa">
                  <div><strong>Student ID:</strong> {selectedStudentView.student_id}</div>
                  <div><strong>Full Name:</strong> {selectedStudentView.first_name} {selectedStudentView.last_name}</div>
                  <div><strong>Username:</strong> {selectedStudentView.username}</div>
                  <div><strong>Program:</strong> {selectedStudentView.program_name || selectedStudentView.program_id} ({classTag(selectedStudentView)})</div>
                  <div><strong>School Year:</strong> {selectedStudentView.school_year ? schoolYearText(selectedStudentView.school_year) : 'N/A'}</div>
                  <div>
                    <strong>Status: </strong>
                    {Number(selectedStudentView.is_active) === 1 ? 'Active' : 'Inactive'}
                  </div>
                  {Number(selectedStudentView.is_active) !== 1 && selectedStudentView.inactive_reason && (
                    <div>
                      <strong>Reason: </strong>
                      {selectedStudentView.inactive_reason === 'Other' && selectedStudentView.inactive_reason_other ? `Other - ${selectedStudentView.inactive_reason_other}` : selectedStudentView.inactive_reason}
                      {selectedStudentView.graduated_school_year ? ` (${selectedStudentView.graduated_school_year})` : ''}
                    </div>
                  )}
                </div>

                <div className="section-title-msa mt-16-msa">Linked Parent Account Details</div>
                {selectedStudentView.parent_id ? (
                  <div className="parent-details-card-msa">
                    <div><User size={16} /> <strong>Parent ID:</strong> {selectedStudentView.parent_id}</div>
                    <div><strong>Full Name:</strong> {selectedStudentView.parent_first_name ? `${selectedStudentView.parent_first_name} ${selectedStudentView.parent_last_name}` : 'Not specified'}</div>
                    <div><strong>Username:</strong> {selectedStudentView.parent_username || 'N/A'}</div>
                    <div><Phone size={16} /> <strong>Primary Phone:</strong> {selectedStudentView.parent_phone || 'Not specified'}</div>
                    <div>
                      <strong>Status: </strong>
                      {Number(selectedStudentView.parent_is_active) === 1 ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-msa">No parent account is linked to this student.</p>
                )}
              </div>

              <div className="modal-footer-msa">
                <button type="button" className="btn-msa btn-secondary-msa" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Single Student Account */}
      {isAddModalOpen && (
        <div className="modal-overlay-msa" onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="modal-msa">
            <div className="modal-header-msa">
              <h3>Create Student Account</h3>
              <button type="button" className="close-btn-msa" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="modal-content-msa">
              <div className="modal-body-msa">
                <div className="section-title-msa">Student Information</div>
                <div className="form-grid-msa">
                  <div className="form-group-msa">
                    <label>Student ID *</label>
                    <input
                      type="text"
                      required
                      value={studentForm.student_id}
                      onChange={handleStudentIdChange}
                      placeholder="e.g. 02000345411"
                    />
                  </div>

                  <div className="form-group-msa">
                    <label>First Name *</label>
                    <input
                      type="text"
                      required
                      value={studentForm.first_name}
                      onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                      placeholder="e.g. Juan"
                    />
                  </div>

                  <div className="form-group-msa">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      required
                      value={studentForm.last_name}
                      onChange={handleStudentLastNameChange}
                      placeholder="e.g. Bernardo"
                    />
                  </div>

                  <div className="form-group-msa col-span-2-msa">
                    <label>Username (Autofilled: lastname.IDnumber) *</label>
                    <div className="domain-input-group-msa">
                      <input
                        type="text"
                        required
                        placeholder="e.g. bernardo.345411"
                        value={studentForm.username}
                        onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                      />
                      <span className="domain-suffix-msa">{DOMAIN_EXTENSION}</span>
                    </div>
                  </div>

                  <div className="form-group-msa checkbox-group-msa">
                    <label>
                      <input
                        type="checkbox"
                        checked={useDefaultPassword}
                        onChange={handleDefaultPasswordToggle}
                      />
                      Use default password ("123")
                    </label>
                  </div>

                  <div className="form-group-msa">
                    <label>Program *</label>
                    <select
                      value={studentForm.program_id}
                      onChange={(e) => handleProgramChange(e, false)}
                    >
                      {Array.isArray(programs) && programs.map((p) => (
                        <option key={p.program_id} value={p.program_id}>
                          {p.program_id} - {p.program_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-msa">
                    <label>Year Level *</label>
                    <select
                      value={studentForm.year_level}
                      onChange={(e) => setStudentForm({ ...studentForm, year_level: e.target.value })}
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      {getProgramType(studentForm.program_id) !== 'strand' && (
                        <>
                          <option value="3">3rd Year</option>
                          <option value="4">4th Year</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group-msa">
                    <label>Section *</label>
                    <select
                      required
                      value={studentForm.section}
                      onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>

                  <div className="form-group-msa">
                    <label htmlFor="add-school-year-msa">School Year *</label>
                    <select
                      id="add-school-year-msa"
                      required
                      value={studentForm.school_year}
                      onChange={(e) => setStudentForm({ ...studentForm, school_year: e.target.value })}
                    >
                      {(schoolYearInfo?.years || []).map((y) => (
                        <option key={y.school_year} value={y.school_year}>
                          {schoolYearText(y.school_year)}{y.is_current ? ' (current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-msa checkbox-group-msa">
                    <label>
                      <input
                        type="checkbox"
                        checked={studentForm.is_active}
                        onChange={(e) => setStudentForm({ ...studentForm, is_active: e.target.checked })}
                      />
                      Is Active Account
                    </label>
                  </div>
                </div>

                <div className="section-title-msa">Parent Account Association</div>
                <div className="radio-options-msa">
                  <label>
                    <input
                      type="radio"
                      name="parentOption"
                      value="none"
                      checked={parentOption === 'none'}
                      onChange={() => setParentOption('none')}
                    />
                    No Parent Account
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="parentOption"
                      value="existing"
                      checked={parentOption === 'existing'}
                      onChange={() => setParentOption('existing')}
                    />
                    Link Existing Parent
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="parentOption"
                      value="new"
                      checked={parentOption === 'new'}
                      onChange={() => setParentOption('new')}
                    />
                    Create New Parent
                  </label>
                </div>

                {parentOption === 'existing' && (
                  <div className="parent-box-msa">
                    <label>Search Parent ID, Username, or Name</label>
                    <input
                      type="text"
                      placeholder="Type to search parent..."
                      value={parentSearch}
                      onChange={(e) => handleParentSearch(e.target.value, false)}
                    />
                    {Array.isArray(parentSearchResults) && parentSearchResults.length > 0 && (
                      <ul className="search-list-msa">
                        {parentSearchResults.map((parent) => (
                          <li 
                            key={parent.parent_id}
                            className={selectedParentId === parent.parent_id ? 'selected' : ''}
                            onClick={() => setSelectedParentId(parent.parent_id)}
                          >
                            <strong>ID: {parent.parent_id}</strong> | User: {parent.username} ({parent.first_name} {parent.last_name})
                            {selectedParentId === parent.parent_id && <Check size={16} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedParentId && (
                      <p className="selected-text-msa">Selected Parent ID: <strong>{selectedParentId}</strong></p>
                    )}
                  </div>
                )}

                {parentOption === 'new' && (
                  <div className="parent-box-msa form-grid-msa">
                    <div className="form-group-msa">
                      <label>Parent ID *</label>
                      <input
                        type="text"
                        required
                        value={newParentForm.parent_id}
                        onChange={(e) => setNewParentForm({ ...newParentForm, parent_id: e.target.value })}
                      />
                    </div>
                    <div className="form-group-msa">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={newParentForm.first_name}
                        onChange={(e) => setNewParentForm({ ...newParentForm, first_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group-msa">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={newParentForm.last_name}
                        onChange={handleParentLastNameChange}
                      />
                    </div>
                    <div className="form-group-msa col-span-2-msa">
                      <label>Parent Username (Autofilled: lastname.parent) *</label>
                      <div className="domain-input-group-msa">
                        <input
                          type="text"
                          required
                          placeholder="lastname.parent"
                          value={newParentForm.username}
                          onChange={(e) => handleParentUsernameChange(e.target.value, false)}
                        />
                        <span className="domain-suffix-msa">{DOMAIN_EXTENSION}</span>
                      </div>
                    </div>
                    <div className="form-group-msa checkbox-group-msa">
                      <label>
                        <input
                          type="checkbox"
                          checked={useParentDefaultPassword}
                          onChange={handleParentDefaultPasswordToggle}
                        />
                        Use default password ("123")
                      </label>
                    </div>

                    {/* Philippine Phone Format with Real-Time Validation */}
                    <div className="form-group-msa">
                      <label>Primary Phone *</label>
                      <input
                        type="text"
                        placeholder="e.g. 09196398319 or +639196398319"
                        className={
                          newParentForm.primary_phone
                            ? isValidPhPhone(newParentForm.primary_phone)
                              ? 'input-valid-msa'
                              : 'input-invalid-msa'
                            : ''
                        }
                        value={newParentForm.primary_phone}
                        onChange={(e) => setNewParentForm({ ...newParentForm, primary_phone: e.target.value })}
                      />
                      {newParentForm.primary_phone && (
                        <small className={isValidPhPhone(newParentForm.primary_phone) ? 'text-success-msa' : 'text-danger-msa'}>
                          {isValidPhPhone(newParentForm.primary_phone)
                            ? '✓ Valid Philippine phone number format'
                            : '✕ Invalid format. Must start with 09 (11 digits) or +639 (13 characters)'}
                        </small>
                      )}
                    </div>

                    <div className="form-group-msa checkbox-group-msa">
                      <label>
                        <input
                          type="checkbox"
                          checked={newParentForm.is_active}
                          onChange={(e) => setNewParentForm({ ...newParentForm, is_active: e.target.checked })}
                        />
                        Parent Active
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer-msa">
                <button type="button" className="btn-msa btn-secondary-msa" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-msa btn-primary-msa">
                  Create Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Student Account & Manage Parent Link */}
      {isEditModalOpen && (
        <div className="modal-overlay-msa" onClick={(e) => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="modal-msa">
            <div className="modal-header-msa">
              <h3>Update Student Account ({editForm.student_id})</h3>
              <button type="button" className="close-btn-msa" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="modal-content-msa">
              <div className="modal-body-msa">
                <div className="section-title-msa">Student Details</div>
                <div className="form-grid-msa">
                  <div className="form-group-msa">
                    <label>First Name</label>
                    <input
                      type="text"
                      required
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group-msa">
                    <label>Last Name</label>
                    <input
                      type="text"
                      required
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group-msa col-span-2-msa">
                    <label>Username *</label>
                    <div className="domain-input-group-msa">
                      <input
                        type="text"
                        required
                        placeholder="e.g. bernardo.345411"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      />
                      <span className="domain-suffix-msa">{DOMAIN_EXTENSION}</span>
                    </div>
                  </div>

                  <div className="form-group-msa">
                    <label>Program</label>
                    <select
                      value={editForm.program_id}
                      onChange={(e) => handleProgramChange(e, true)}
                    >
                      {Array.isArray(programs) && programs.map((p) => (
                        <option key={p.program_id} value={p.program_id}>
                          {p.program_id} - {p.program_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-msa">
                    <label>Year Level</label>
                    <select
                      value={editForm.year_level}
                      onChange={(e) => setEditForm({ ...editForm, year_level: e.target.value })}
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      {getProgramType(editForm.program_id) !== 'strand' && (
                        <>
                          <option value="3">3rd Year</option>
                          <option value="4">4th Year</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group-msa">
                    <label>Section</label>
                    <select
                      required
                      value={editForm.section}
                      onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>

                  <div className="form-group-msa">
                    <label htmlFor="edit-school-year-msa">School Year</label>
                    <select
                      id="edit-school-year-msa"
                      required
                      value={editForm.school_year}
                      onChange={(e) => setEditForm({ ...editForm, school_year: e.target.value })}
                    >
                      {[...new Set([editForm.school_year, ...(schoolYearInfo?.years || []).map((y) => y.school_year)].filter(Boolean))].map((label) => (
                        <option key={label} value={label}>
                          {schoolYearText(label)}{label === schoolYearInfo?.current ? ' (current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-msa checkbox-group-msa">
                    <label>
                      <input
                        type="checkbox"
                        checked={editForm.is_active}
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked, ...(e.target.checked ? { inactive_reason: '', inactive_reason_other: '' } : {}) })}
                      />
                      Is Active Account
                    </label>
                  </div>

                  {!editForm.is_active && (
                    <div className="form-group-msa col-span-2-msa">
                      <label htmlFor="edit-inactive-reason-msa">Reason the account is inactive *</label>
                      <select
                        id="edit-inactive-reason-msa"
                        required
                        value={editForm.inactive_reason}
                        onChange={(e) => setEditForm({ ...editForm, inactive_reason: e.target.value, inactive_reason_other: '' })}
                        aria-describedby="edit-inactive-reason-note-msa"
                      >
                        <option value="">-- Select the reason --</option>
                        <option value="Transfer">Transfer</option>
                        {isFinalYear(editForm.program_id, editForm.year_level) && <option value="Graduated">Graduated</option>}
                        <option value="Drop">Drop</option>
                        <option value="Other">Other (specify)</option>
                      </select>
                      <small id="edit-inactive-reason-note-msa">
                        Graduated is only offered to 2nd year strand and 4th year course students. A graduated student is kept in the screening Archive.
                      </small>
                      {editForm.inactive_reason === 'Other' && (
                        <input
                          type="text"
                          required
                          maxLength={150}
                          aria-label="Specify the other reason"
                          placeholder="Specify the reason"
                          value={editForm.inactive_reason_other}
                          onChange={(e) => setEditForm({ ...editForm, inactive_reason_other: e.target.value })}
                        />
                      )}
                    </div>
                  )}

                  <div className="form-group-msa checkbox-group-msa">
                    <label className={editForm.reset_password ? 'reset-active-msa' : ''}>
                      <input
                        type="checkbox"
                        checked={editForm.reset_password}
                        onChange={(e) => setEditForm({ ...editForm, reset_password: e.target.checked })}
                      />
                      Reset password to default ("123")
                    </label>
                  </div>
                </div>

                <div className="section-title-msa">Linked Parent Account Management</div>
                
                <div className="current-parent-info-msa">
                  <strong>Current Linked Parent: </strong> 
                  {editForm.current_parent_id ? (
                    <span>
                      ID: <strong>{editForm.current_parent_id}</strong> 
                      {editForm.current_parent_name && ` (${editForm.current_parent_name})`}
                      {editForm.current_parent_username && ` - Username: ${editForm.current_parent_username}`}
                    </span>
                  ) : (
                    <span className="text-muted-msa">No Parent Linked</span>
                  )}
                </div>

                <div className="radio-options-msa">
                  <label>
                    <input
                      type="radio"
                      name="parentAction"
                      value="keep"
                      checked={parentAction === 'keep'}
                      onChange={() => setParentAction('keep')}
                    />
                    Keep Current Link
                  </label>
                  {editForm.current_parent_id && (
                    <label>
                      <input
                        type="radio"
                        name="parentAction"
                        value="remove"
                        checked={parentAction === 'remove'}
                        onChange={() => setParentAction('remove')}
                      />
                      <Unlink size={14} className="inline-icon-msa" />
                      Remove Parent Link
                    </label>
                  )}
                  <label>
                    <input
                      type="radio"
                      name="parentAction"
                      value="existing"
                      checked={parentAction === 'existing'}
                      onChange={() => setParentAction('existing')}
                    />
                    Replace / Link Existing Parent
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="parentAction"
                      value="new"
                      checked={parentAction === 'new'}
                      onChange={() => setParentAction('new')}
                    />
                    Create & Link New Parent
                  </label>
                </div>

                {parentAction === 'existing' && (
                  <div className="parent-box-msa">
                    <label>Search Existing Parent Account</label>
                    <input
                      type="text"
                      placeholder="Search parent ID, username, or name..."
                      value={editParentSearch}
                      onChange={(e) => handleParentSearch(e.target.value, true)}
                    />
                    {Array.isArray(editParentSearchResults) && editParentSearchResults.length > 0 && (
                      <ul className="search-list-msa">
                        {editParentSearchResults.map((parent) => (
                          <li 
                            key={parent.parent_id}
                            className={editSelectedParentId === parent.parent_id ? 'selected' : ''}
                            onClick={() => setEditSelectedParentId(parent.parent_id)}
                          >
                            <strong>ID: {parent.parent_id}</strong> | User: {parent.username} ({parent.first_name} {parent.last_name})
                            {editSelectedParentId === parent.parent_id && <Check size={16} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    {editSelectedParentId && (
                      <p className="selected-text-msa">Selected Parent ID to Link: <strong>{editSelectedParentId}</strong></p>
                    )}
                  </div>
                )}

                {parentAction === 'new' && (
                  <div className="parent-box-msa form-grid-msa">
                    <div className="form-group-msa">
                      <label>Parent ID *</label>
                      <input
                        type="text"
                        required
                        value={editNewParentForm.parent_id}
                        onChange={(e) => setEditNewParentForm({ ...editNewParentForm, parent_id: e.target.value })}
                      />
                    </div>
                    <div className="form-group-msa">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={editNewParentForm.first_name}
                        onChange={(e) => setEditNewParentForm({ ...editNewParentForm, first_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group-msa">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={editNewParentForm.last_name}
                        onChange={handleEditParentLastNameChange}
                      />
                    </div>
                    <div className="form-group-msa col-span-2-msa">
                      <label>Parent Username (Autofilled: lastname.parent) *</label>
                      <div className="domain-input-group-msa">
                        <input
                          type="text"
                          required
                          placeholder="lastname.parent"
                          value={editNewParentForm.username}
                          onChange={(e) => handleParentUsernameChange(e.target.value, true)}
                        />
                        <span className="domain-suffix-msa">{DOMAIN_EXTENSION}</span>
                      </div>
                    </div>
                    <div className="form-group-msa checkbox-group-msa">
                      <label>
                        <input
                          type="checkbox"
                          checked={editNewParentForm.password === '123'}
                          onChange={(e) => setEditNewParentForm({ ...editNewParentForm, password: e.target.checked ? '123' : '' })}
                        />
                        Use default password ("123")
                      </label>
                    </div>

                    {/* Philippine Phone Format with Real-Time Validation */}
                    <div className="form-group-msa">
                      <label>Primary Phone *</label>
                      <input
                        type="text"
                        placeholder="e.g. 09196398319 or +639196398319"
                        className={
                          editNewParentForm.primary_phone
                            ? isValidPhPhone(editNewParentForm.primary_phone)
                              ? 'input-valid-msa'
                              : 'input-invalid-msa'
                            : ''
                        }
                        value={editNewParentForm.primary_phone}
                        onChange={(e) => setEditNewParentForm({ ...editNewParentForm, primary_phone: e.target.value })}
                      />
                      {editNewParentForm.primary_phone && (
                        <small className={isValidPhPhone(editNewParentForm.primary_phone) ? 'text-success-msa' : 'text-danger-msa'}>
                          {isValidPhPhone(editNewParentForm.primary_phone)
                            ? '✓ Valid Philippine phone number format'
                            : '✕ Invalid format. Must start with 09 (11 digits) or +639 (13 characters)'}
                        </small>
                      )}
                    </div>

                    <div className="form-group-msa checkbox-group-msa">
                      <label>
                        <input
                          type="checkbox"
                          checked={editNewParentForm.is_active}
                          onChange={(e) => setEditNewParentForm({ ...editNewParentForm, is_active: e.target.checked })}
                        />
                        Parent Active
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer-msa">
                <button type="button" className="btn-msa btn-secondary-msa" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-msa btn-primary-msa">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Set School Year */}
      {isSchoolYearOpen && (
        <StudentSchoolYearModal
          info={schoolYearInfo}
          apiBase={API_BASE}
          senderId={userId}
          onClose={() => setIsSchoolYearOpen(false)}
          onSaved={(data) => {
            setIsSchoolYearOpen(false);
            fetchSchoolYears();
            fetchStudents(searchQuery);
            setStudentForm(prev => ({ ...prev, school_year: data.school_year }));
            showAlert('School Year Set', data.message, 'success');
          }}
        />
      )}

      {/* Modal: Custom Alert & Confirmation Modal */}
      {modalConfig.isOpen && (
        <div className="modal-overlay-msa" style={{ zIndex: 1100 }}>
          <div className="modal-msa" style={{ maxWidth: '420px', width: '90%' }} role="alertdialog" aria-modal="true" aria-label={modalConfig.title}>
            <div className="modal-header-msa" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {modalConfig.type === 'success' && <CheckCircle className="text-success-msa" size={22} />}
                {modalConfig.type === 'error' && <XCircle className="text-danger-msa" size={22} />}
                {modalConfig.type === 'warning' && <AlertTriangle style={{ color: 'var(--status-low-text)' }} size={22} />}
                {(modalConfig.type === 'info' || modalConfig.type === 'confirm') && <AlertCircle className="text-blue-msa" size={22} />}
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>{modalConfig.title}</h3>
              </div>
              <button type="button" className="close-btn-msa" onClick={closeModalConfig}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-msa" style={{ padding: '20px 16px', fontSize: '0.875rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{modalConfig.message}</p>
            </div>
            <div className="modal-footer-msa" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px' }}>
              {modalConfig.onConfirm ? (
                <>
                  <button 
                    type="button" 
                    className="btn-msa btn-secondary-msa" 
                    onClick={closeModalConfig}
                  >
                    {modalConfig.cancelText || 'Cancel'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-msa btn-primary-msa" 
                    onClick={() => {
                      const action = modalConfig.onConfirm;
                      closeModalConfig();
                      if (action) action();
                    }}
                  >
                    {modalConfig.confirmText || 'Confirm'}
                  </button>
                </>
              ) : (
                <button 
                  type="button" 
                  className="btn-msa btn-primary-msa" 
                  onClick={closeModalConfig}
                >
                  {modalConfig.confirmText || 'OK'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}