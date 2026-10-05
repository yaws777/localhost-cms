// manageStudentAccounts.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  Edit, 
  Eye,
  GraduationCap, 
  UserCheck, 
  UserX, 
  X, 
  Check, 
  Link as LinkIcon,
  Users,
  User,
  Phone,
  Unlink,
  Upload,
  Download,
  Trash2,
  Layers,
  Printer
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/ManageStudentAccounts.css';

const API_BASE = 'http://localhost:3001/api';
const DOMAIN_EXTENSION = '@baliuag.sti.edu.ph';

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

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStudentView, setSelectedStudentView] = useState(null);

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

  // Form State for Single Student Creation (Default ID initialized with '02000')
  const [studentForm, setStudentForm] = useState({
    student_id: '02000',
    first_name: '',
    last_name: '',
    username: '',
    password: '123',
    program_id: '',
    year_level: '1',
    section: 'A',
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
    program_id: '',
    year_level: '1',
    section: 'A',
    is_active: true,
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
    fetchStudents();
  }, []);

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

  const fetchStudents = async (query = '') => {
    try {
      const res = await fetch(`${API_BASE}/students/manageStudentAccounts?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setStudents([]);
    }
  };

  // EXPORT REPORT FOR ALL STUDENT ACCOUNTS
  const handleExportAllReport = () => {
    const rowsToExport = Array.isArray(students) ? students : [];

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
                      <th>Yr / Sec</th>
                      <th>Linked Parent</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRowsHtml || '<tr><td colspan="7">No student accounts found.</td></tr>'}
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

  // EXPORT REPORT FOR SPECIFIC STUDENT ACCOUNT
  const handleExportSingleReport = () => {
    if (!selectedStudentView) return;

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

  // Enforce student_id prefix '02000' & autofill username (e.g. bernardo.345411)
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

  // Handlers for dynamic student/parent last name changes with auto username & parent_id generation
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
      
      return {
        ...prev,
        last_name: effectiveParentLastName,
        parent_id: generateParentId(effectiveParentLastName)
      };
    });
  };

  const handleParentLastNameChange = (e) => {
    const parentLastName = e.target.value;
    setNewParentForm(prev => ({
      ...prev,
      last_name: parentLastName,
      parent_id: generateParentId(parentLastName)
    }));
  };

  const handleEditParentLastNameChange = (e) => {
    const parentLastName = e.target.value;
    setEditNewParentForm(prev => ({
      ...prev,
      last_name: parentLastName,
      parent_id: generateParentId(parentLastName)
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

  const handleCreateStudent = async (e) => {
    e.preventDefault();
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
        alert('Student Account created successfully!');
        setIsAddModalOpen(false);
        resetAddForm();
        fetchStudents(searchQuery);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Error creating student:', err);
      alert('Failed to create student account.');
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    const payload = {
      ...editForm,
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
        alert('Student details updated successfully!');
        setIsEditModalOpen(false);
        fetchStudents(searchQuery);
      } else {
        const err = await res.json();
        alert(`Failed to update student account: ${err.error}`);
      }
    } catch (err) {
      console.error('Error updating student:', err);
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
          alert('CSV file is empty or missing data rows.');
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
          const autoParentId = row.parent_id || generateParentId(parentLastName, idx + 1);
          const hasParent = Boolean(row.parent_id || row.parent_username || row.parent_last_name);
          const parentOption = hasParent ? 'new' : 'none';

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
              username: row.parent_username ? row.parent_username.replace(DOMAIN_EXTENSION, '').trim() : '',
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
        alert('Failed to parse CSV file.');
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
        updated[index] = {
          ...updated[index],
          new_parent: { ...updated[index].new_parent, [field]: value }
        };
      }
      return updated;
    });
  };

  const handleRemoveBatchRow = (index) => {
    setBatchStudents(prev => prev.filter((_, i) => i !== index));
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (batchStudents.length === 0) return;

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
      alert(`Successfully created all ${successCount} student account(s).`);
      setIsBatchModalOpen(false);
      setBatchStudents([]);
    } else {
      alert(`Batch Finished: Success: ${successCount}, Failed: ${failCount}`);
    }
  };

  const handleCSVExport = () => {
    if (!students || students.length === 0) {
      alert('No student account data available to export.');
      return;
    }

    const headers = [
      'student_id','first_name','last_name','username','program_id',
      'program_name','year_level','section','is_active','parent_id',
      'parent_username','parent_first_name','parent_last_name','parent_phone'
    ];

    const csvRows = [headers.join(',')];

    students.forEach(s => {
      const row = [
        `"${s.student_id || ''}"`,
        `"${s.first_name || ''}"`,
        `"${s.last_name || ''}"`,
        `"${s.username || ''}"`,
        `"${s.program_id || ''}"`,
        `"${s.program_name || ''}"`,
        `"${s.year_level || ''}"`,
        `"${s.section || ''}"`,
        `"${s.is_active}"`,
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

    setEditForm({
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      program_id: student.program_id,
      year_level: yLevel,
      section: sec,
      is_active: Number(student.is_active) === 1,
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
      username: '',
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
          <GraduationCap className="icon-brand-msa" size={32} />
          <div>
            <h1>STI College Student Management</h1>
            <p>Admin Portal - Account Administration</p>
          </div>
        </div>
      </header>

      <main className="content-msa">
        <div className="actions-bar-msa">
          <div className="search-wrapper-msa">
            <Search className="search-icon-msa" size={18} />
            <input
              type="text"
              className="search-input-msa"
              placeholder="Search student ID, name, or username..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div className="btn-group-msa">
            <button 
              type="button"
              className="btn-msa btn-secondary-msa" 
              onClick={handleExportAllReport}
              style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Export printable PDF report of student accounts"
            >
              <Printer size={18} />
              <span>export</span>
            </button>

            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden-input-msa" 
              onChange={handleCSVImport} 
            />
            <button 
              type="button"
              className="btn-msa btn-secondary-msa" 
              onClick={() => fileInputRef.current.click()}
              title="Import CSV data into batch creation form"
            >
              <Upload size={18} />
              <span>Batch Import CSV</span>
            </button>

            <button 
              type="button"
              className="btn-msa btn-secondary-msa" 
              onClick={handleCSVExport}
              title="Export accounts list to CSV"
            >
              <Download size={18} />
              <span>Export CSV</span>
            </button>

            <button 
              type="button"
              className="btn-msa btn-primary-msa"
              onClick={() => { resetAddForm(); setIsAddModalOpen(true); }}
            >
              <UserPlus size={18} />
              <span>Add Student Account</span>
            </button>
          </div>
        </div>

        <div className="card-msa">
          <div className="card-header-msa">
            <Users size={20} />
            <h2>Student Accounts List</h2>
          </div>
          <div className="table-container-msa">
            <table className="table-msa">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Program</th>
                  <th>Year / Section</th>
                  <th>Linked Parent</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(students) && students.length > 0 ? (
                  students.map((student) => (
                    <tr key={student.student_id}>
                      <td className="font-bold-msa">{student.student_id}</td>
                      <td>{`${student.first_name} ${student.last_name}`}</td>
                      <td>{student.username || <span className="text-muted-msa">N/A</span>}</td>
                      <td>
                        <span className="badge-msa badge-blue-msa">
                          {student.program_id}
                        </span>
                      </td>
                      <td>{student.year_level} - {student.section}</td>
                      <td>
                        {student.parent_id ? (
                          <div className="parent-info-cell-msa">
                            <span className="parent-link-msa" title={`Username: ${student.parent_username || 'N/A'}`}>
                              <LinkIcon size={14} /> <strong>{student.parent_id}</strong>
                            </span>
                            {student.parent_first_name && (
                              <small className="text-muted-msa">
                                ({student.parent_first_name} {student.parent_last_name})
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-msa">None</span>
                        )}
                      </td>
                      <td>
                        {Number(student.is_active) === 1 ? (
                          <span className="badge-msa badge-success-msa">
                            <UserCheck size={12} /> Active
                          </span>
                        ) : (
                          <span className="badge-msa badge-danger-msa">
                            <UserX size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="actions-cell-msa">
                          <button 
                            type="button"
                            className="btn-icon-msa" 
                            title="View Student Details"
                            onClick={() => openViewModal(student)}
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            type="button"
                            className="btn-icon-msa" 
                            title="Edit Student Account"
                            onClick={() => openEditModal(student)}
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="empty-table-msa">
                      No student accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

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
        <div className="modal-overlay-msa" onClick={(e) => { if (e.target === e.currentTarget) setIsViewModalOpen(false); }}>
          <div className="modal-msa">
            <div className="modal-header-msa">
              <h3>Student & Linked Parent Details</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn-msa btn-secondary-msa" 
                  onClick={handleExportSingleReport}
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> export
                </button>
                <button type="button" className="close-btn-msa" onClick={() => setIsViewModalOpen(false)}>
                  <X size={20} />
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
                  <div><strong>Program:</strong> {selectedStudentView.program_name || selectedStudentView.program_id}</div>
                  <div><strong>Year & Section:</strong> {selectedStudentView.year_level} - {selectedStudentView.section}</div>
                  <div>
                    <strong>Status: </strong>
                    {Number(selectedStudentView.is_active) === 1 ? 'Active' : 'Inactive'}
                  </div>
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
                      <label>Parent Username *</label>
                      <div className="domain-input-group-msa">
                        <input
                          type="text"
                          required
                          placeholder="e.g. parent.bernardo"
                          value={newParentForm.username}
                          onChange={(e) => setNewParentForm({ ...newParentForm, username: e.target.value })}
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
                    <div className="form-group-msa">
                      <label>Primary Phone</label>
                      <input
                        type="text"
                        value={newParentForm.primary_phone}
                        onChange={(e) => setNewParentForm({ ...newParentForm, primary_phone: e.target.value })}
                      />
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

                  <div className="form-group-msa checkbox-group-msa">
                    <label>
                      <input
                        type="checkbox"
                        checked={editForm.is_active}
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      />
                      Is Active Account
                    </label>
                  </div>

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
                      <label>Parent Username *</label>
                      <div className="domain-input-group-msa">
                        <input
                          type="text"
                          required
                          placeholder="e.g. parent.bernardo"
                          value={editNewParentForm.username}
                          onChange={(e) => setEditNewParentForm({ ...editNewParentForm, username: e.target.value })}
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
                    <div className="form-group-msa">
                      <label>Primary Phone</label>
                      <input
                        type="text"
                        value={editNewParentForm.primary_phone}
                        onChange={(e) => setEditNewParentForm({ ...editNewParentForm, primary_phone: e.target.value })}
                      />
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
    </div>
  );
}