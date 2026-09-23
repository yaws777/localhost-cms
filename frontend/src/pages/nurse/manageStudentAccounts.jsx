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
  Layers
} from 'lucide-react';
import '../../styles/nurse/ManageStudentAccounts.css';

const API_BASE = 'http://localhost:3001/api';
const DOMAIN_EXTENSION = '@baliuag.sti.edu.ph';

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

  // Form State for Single Student Creation
  const [studentForm, setStudentForm] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    program_id: '',
    year_level: '1',
    section: '',
    is_active: true
  });

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
    password: '',
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
    year_level: '',
    section: '',
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
    password: '',
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

          const studentId = row.student_id || row.id || '';
          const firstName = row.first_name || row.firstname || '';
          const lastName = row.last_name || row.lastname || '';
          const usernameClean = row.username ? row.username.replace(DOMAIN_EXTENSION, '').trim() : '';
          const password = row.password || '123';
          const programId = row.program_id || defaultProg;
          const yearLevel = row.year_level || row.year || '1';
          const section = row.section || '';
          const isActive = row.is_active !== undefined ? (String(row.is_active) === '1' || String(row.is_active).toLowerCase() === 'true') : true;

          const hasParent = Boolean(row.parent_id || row.parent_username);
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
            selected_parent_id: row.parent_id || '',
            new_parent: hasParent ? {
              parent_id: row.parent_id || '',
              first_name: row.parent_first_name || '',
              last_name: row.parent_last_name || '',
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
      updated[index] = { ...updated[index], [field]: value };
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
    setEditForm({
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      program_id: student.program_id,
      year_level: student.year_level,
      section: student.section,
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
      parent_id: '',
      first_name: '',
      last_name: '',
      username: '',
      password: '',
      primary_phone: '',
      is_active: true
    });
    setIsEditModalOpen(true);
  };

  const resetAddForm = () => {
    setStudentForm({
      student_id: '',
      first_name: '',
      last_name: '',
      username: '',
      password: '',
      program_id: Array.isArray(programs) && programs.length > 0 ? programs[0].program_id : '',
      year_level: '1',
      section: '',
      is_active: true
    });
    setParentOption('none');
    setParentSearch('');
    setParentSearchResults([]);
    setSelectedParentId('');
    setNewParentForm({
      parent_id: '',
      first_name: '',
      last_name: '',
      username: '',
      password: '',
      primary_phone: '',
      is_active: true
    });
  };

  return (
    <div className="sti-container">
      <header className="sti-header">
        <div className="sti-brand">
          <GraduationCap className="sti-icon-brand" size={32} />
          <div>
            <h1>STI College Student Management</h1>
            <p>Admin Portal - Account Administration</p>
          </div>
        </div>
      </header>

      <main className="sti-content">
        <div className="sti-actions-bar">
          <div className="sti-search-wrapper">
            <Search className="sti-search-icon" size={18} />
            <input
              type="text"
              className="sti-search-input"
              placeholder="Search student ID, name, or username..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div className="sti-btn-group">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="sti-hidden-input" 
              onChange={handleCSVImport} 
            />
            <button 
              type="button"
              className="sti-btn sti-btn-secondary" 
              onClick={() => fileInputRef.current.click()}
              title="Import CSV data into batch creation form"
            >
              <Upload size={18} />
              <span>Batch Import CSV</span>
            </button>

            <button 
              type="button"
              className="sti-btn sti-btn-secondary" 
              onClick={handleCSVExport}
              title="Export accounts list to CSV"
            >
              <Download size={18} />
              <span>Export CSV</span>
            </button>

            <button 
              type="button"
              className="sti-btn sti-btn-primary"
              onClick={() => { resetAddForm(); setIsAddModalOpen(true); }}
            >
              <UserPlus size={18} />
              <span>Add Student Account</span>
            </button>
          </div>
        </div>

        <div className="sti-card">
          <div className="sti-card-header">
            <Users size={20} />
            <h2>Student Accounts List</h2>
          </div>
          <div className="sti-table-container">
            <table className="sti-table">
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
                      <td className="sti-font-bold">{student.student_id}</td>
                      <td>{`${student.first_name} ${student.last_name}`}</td>
                      <td>{student.username || <span className="sti-text-muted">N/A</span>}</td>
                      <td>
                        <span className="sti-badge sti-badge-blue">
                          {student.program_name || student.program_id}
                        </span>
                      </td>
                      <td>Yr {student.year_level} - {student.section}</td>
                      <td>
                        {student.parent_id ? (
                          <div className="sti-parent-info-cell">
                            <span className="sti-parent-link" title={`Username: ${student.parent_username || 'N/A'}`}>
                              <LinkIcon size={14} /> <strong>{student.parent_id}</strong>
                            </span>
                            {student.parent_first_name && (
                              <small className="sti-text-muted">
                                ({student.parent_first_name} {student.parent_last_name})
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="sti-text-muted">None</span>
                        )}
                      </td>
                      <td>
                        {Number(student.is_active) === 1 ? (
                          <span className="sti-badge sti-badge-success">
                            <UserCheck size={12} /> Active
                          </span>
                        ) : (
                          <span className="sti-badge sti-badge-danger">
                            <UserX size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td>
                        {/* Strictly Lucide Icons for Row Actions */}
                        <div className="sti-actions-cell">
                          <button 
                            type="button"
                            className="sti-btn-icon" 
                            title="View Student Details"
                            onClick={() => openViewModal(student)}
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            type="button"
                            className="sti-btn-icon" 
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
                    <td colSpan="8" className="sti-empty-table">
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
        <div className="sti-modal-overlay">
          <div className="sti-modal sti-modal-lg">
            <div className="sti-modal-header">
              <div className="sti-modal-title">
                <Layers size={22} />
                <h3>Batch Pre-Fill Account Creation ({batchStudents.length} Records)</h3>
              </div>
              <button type="button" className="sti-close-btn" onClick={() => setIsBatchModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit} className="sti-modal-body">
              <p className="sti-text-muted sti-mb-16">
                Review and modify the pre-filled CSV batch records below before creating all accounts.
              </p>

              <div className="sti-batch-table-wrapper">
                <table className="sti-table sti-table-compact">
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
                            className="sti-input-sm sti-w-100"
                            value={item.student_id}
                            onChange={(e) => handleBatchFieldChange(idx, 'student_id', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            className="sti-input-sm sti-w-110"
                            value={item.first_name}
                            onChange={(e) => handleBatchFieldChange(idx, 'first_name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            className="sti-input-sm sti-w-110"
                            value={item.last_name}
                            onChange={(e) => handleBatchFieldChange(idx, 'last_name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            placeholder="username"
                            className="sti-input-sm sti-w-120"
                            value={item.username}
                            onChange={(e) => handleBatchFieldChange(idx, 'username', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            required
                            className="sti-input-sm sti-w-90"
                            value={item.password}
                            onChange={(e) => handleBatchFieldChange(idx, 'password', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="sti-input-sm sti-w-110"
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
                          <div className="sti-inline-flex-gap-4">
                            <select
                              className="sti-input-sm sti-w-45"
                              value={item.year_level}
                              onChange={(e) => handleBatchFieldChange(idx, 'year_level', e.target.value)}
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                            </select>
                            <input
                              type="text"
                              className="sti-input-sm sti-w-50"
                              value={item.section}
                              onChange={(e) => handleBatchFieldChange(idx, 'section', e.target.value)}
                            />
                          </div>
                        </td>
                        <td>
                          {item.new_parent ? (
                            <div className="sti-batch-parent-info">
                              <span>
                                <strong>P-ID:</strong> 
                                <input 
                                  type="text" 
                                  value={item.new_parent.parent_id} 
                                  onChange={(e) => handleBatchParentFieldChange(idx, 'parent_id', e.target.value)}
                                  className="sti-input-xs sti-w-70"
                                />
                              </span>
                              <span>
                                <strong>User:</strong> 
                                <input 
                                  type="text" 
                                  value={item.new_parent.username} 
                                  onChange={(e) => handleBatchParentFieldChange(idx, 'username', e.target.value)}
                                  className="sti-input-xs sti-w-80"
                                />
                              </span>
                            </div>
                          ) : (
                            <span className="sti-text-muted">None</span>
                          )}
                        </td>
                        <td>
                          {/* Strictly Lucide Icon for Row Action */}
                          <button
                            type="button"
                            className="sti-btn-icon sti-text-danger"
                            title="Remove row from batch"
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

              <div className="sti-modal-footer">
                <button 
                  type="button" 
                  className="sti-btn sti-btn-secondary" 
                  onClick={() => setIsBatchModalOpen(false)}
                  disabled={isSubmittingBatch}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="sti-btn sti-btn-primary"
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
        <div className="sti-modal-overlay">
          <div className="sti-modal">
            <div className="sti-modal-header">
              <h3>Student & Linked Parent Details</h3>
              <button type="button" className="sti-close-btn" onClick={() => setIsViewModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="sti-modal-body">
              <div className="sti-section-title">Student Details</div>
              <div className="sti-details-grid">
                <div><strong>Student ID:</strong> {selectedStudentView.student_id}</div>
                <div><strong>Full Name:</strong> {selectedStudentView.first_name} {selectedStudentView.last_name}</div>
                <div><strong>Username:</strong> {selectedStudentView.username}</div>
                <div><strong>Program:</strong> {selectedStudentView.program_name || selectedStudentView.program_id}</div>
                <div><strong>Year & Section:</strong> Yr {selectedStudentView.year_level} - {selectedStudentView.section}</div>
                <div>
                  <strong>Status: </strong>
                  {Number(selectedStudentView.is_active) === 1 ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="sti-section-title sti-mt-16">Linked Parent Account Details</div>
              {selectedStudentView.parent_id ? (
                <div className="sti-parent-details-card">
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
                <p className="sti-text-muted">No parent account is linked to this student.</p>
              )}

              <div className="sti-modal-footer">
                <button type="button" className="sti-btn sti-btn-secondary" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Single Student Account */}
      {isAddModalOpen && (
        <div className="sti-modal-overlay">
          <div className="sti-modal">
            <div className="sti-modal-header">
              <h3>Create Student Account</h3>
              <button type="button" className="sti-close-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="sti-modal-body">
              <div className="sti-section-title">Student Information</div>
              <div className="sti-form-grid">
                <div className="sti-form-group">
                  <label>Student ID *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.student_id}
                    onChange={(e) => setStudentForm({ ...studentForm, student_id: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.first_name}
                    onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.last_name}
                    onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>Username (Auto appended domain) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. john.doe"
                    value={studentForm.username}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    required
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>Program *</label>
                  <select
                    value={studentForm.program_id}
                    onChange={(e) => setStudentForm({ ...studentForm, program_id: e.target.value })}
                  >
                    {Array.isArray(programs) && programs.map((p) => (
                      <option key={p.program_id} value={p.program_id}>
                        {p.program_id} - {p.program_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sti-form-group">
                  <label>Year Level *</label>
                  <select
                    value={studentForm.year_level}
                    onChange={(e) => setStudentForm({ ...studentForm, year_level: e.target.value })}
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div className="sti-form-group">
                  <label>Section *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                  />
                </div>

                <div className="sti-form-group sti-checkbox-group">
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

              <div className="sti-section-title">Parent Account Association</div>
              <div className="sti-radio-options">
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
                <div className="sti-parent-box">
                  <label>Search Parent ID, Username, or Name</label>
                  <input
                    type="text"
                    placeholder="Type to search parent..."
                    value={parentSearch}
                    onChange={(e) => handleParentSearch(e.target.value, false)}
                  />
                  {Array.isArray(parentSearchResults) && parentSearchResults.length > 0 && (
                    <ul className="sti-search-list">
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
                    <p className="sti-selected-text">Selected Parent ID: <strong>{selectedParentId}</strong></p>
                  )}
                </div>
              )}

              {parentOption === 'new' && (
                <div className="sti-parent-box sti-form-grid">
                  <div className="sti-form-group">
                    <label>Parent ID *</label>
                    <input
                      type="text"
                      required
                      value={newParentForm.parent_id}
                      onChange={(e) => setNewParentForm({ ...newParentForm, parent_id: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={newParentForm.first_name}
                      onChange={(e) => setNewParentForm({ ...newParentForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={newParentForm.last_name}
                      onChange={(e) => setNewParentForm({ ...newParentForm, last_name: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Parent Username *</label>
                    <input
                      type="text"
                      required
                      value={newParentForm.username}
                      onChange={(e) => setNewParentForm({ ...newParentForm, username: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Parent Password *</label>
                    <input
                      type="password"
                      required
                      value={newParentForm.password}
                      onChange={(e) => setNewParentForm({ ...newParentForm, password: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Primary Phone</label>
                    <input
                      type="text"
                      value={newParentForm.primary_phone}
                      onChange={(e) => setNewParentForm({ ...newParentForm, primary_phone: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group sti-checkbox-group">
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

              <div className="sti-modal-footer">
                <button type="button" className="sti-btn sti-btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sti-btn sti-btn-primary">
                  Create Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Student Account & Manage Parent Link */}
      {isEditModalOpen && (
        <div className="sti-modal-overlay">
          <div className="sti-modal">
            <div className="sti-modal-header">
              <h3>Update Student Account ({editForm.student_id})</h3>
              <button type="button" className="sti-close-btn" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="sti-modal-body">
              <div className="sti-section-title">Student Details</div>
              <div className="sti-form-grid">
                <div className="sti-form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  />
                </div>

                <div className="sti-form-group">
                  <label>Program</label>
                  <select
                    value={editForm.program_id}
                    onChange={(e) => setEditForm({ ...editForm, program_id: e.target.value })}
                  >
                    {Array.isArray(programs) && programs.map((p) => (
                      <option key={p.program_id} value={p.program_id}>
                        {p.program_id} - {p.program_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sti-form-group">
                  <label>Year Level</label>
                  <select
                    value={editForm.year_level}
                    onChange={(e) => setEditForm({ ...editForm, year_level: e.target.value })}
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div className="sti-form-group">
                  <label>Section</label>
                  <input
                    type="text"
                    required
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                  />
                </div>

                <div className="sti-form-group sti-checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    />
                    Is Active Account
                  </label>
                </div>

                <div className="sti-form-group sti-checkbox-group">
                  <label className={editForm.reset_password ? 'sti-reset-active' : ''}>
                    <input
                      type="checkbox"
                      checked={editForm.reset_password}
                      onChange={(e) => setEditForm({ ...editForm, reset_password: e.target.checked })}
                    />
                    Reset password to default ("123")
                  </label>
                </div>
              </div>

              <div className="sti-section-title">Linked Parent Account Management</div>
              
              <div className="sti-current-parent-info">
                <strong>Current Linked Parent: </strong> 
                {editForm.current_parent_id ? (
                  <span>
                    ID: <strong>{editForm.current_parent_id}</strong> 
                    {editForm.current_parent_name && ` (${editForm.current_parent_name})`}
                    {editForm.current_parent_username && ` - Username: ${editForm.current_parent_username}`}
                  </span>
                ) : (
                  <span className="sti-text-muted">No Parent Linked</span>
                )}
              </div>

              <div className="sti-radio-options">
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
                    <Unlink size={14} className="sti-inline-icon" />
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
                <div className="sti-parent-box">
                  <label>Search Existing Parent Account</label>
                  <input
                    type="text"
                    placeholder="Search parent ID, username, or name..."
                    value={editParentSearch}
                    onChange={(e) => handleParentSearch(e.target.value, true)}
                  />
                  {Array.isArray(editParentSearchResults) && editParentSearchResults.length > 0 && (
                    <ul className="sti-search-list">
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
                    <p className="sti-selected-text">Selected Parent ID to Link: <strong>{editSelectedParentId}</strong></p>
                  )}
                </div>
              )}

              {parentAction === 'new' && (
                <div className="sti-parent-box sti-form-grid">
                  <div className="sti-form-group">
                    <label>Parent ID *</label>
                    <input
                      type="text"
                      required
                      value={editNewParentForm.parent_id}
                      onChange={(e) => setEditNewParentForm({ ...editNewParentForm, parent_id: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={editNewParentForm.first_name}
                      onChange={(e) => setEditNewParentForm({ ...editNewParentForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={editNewParentForm.last_name}
                      onChange={(e) => setEditNewParentForm({ ...editNewParentForm, last_name: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Parent Username *</label>
                    <input
                      type="text"
                      required
                      value={editNewParentForm.username}
                      onChange={(e) => setEditNewParentForm({ ...editNewParentForm, username: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Parent Password *</label>
                    <input
                      type="password"
                      required
                      value={editNewParentForm.password}
                      onChange={(e) => setEditNewParentForm({ ...editNewParentForm, password: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group">
                    <label>Primary Phone</label>
                    <input
                      type="text"
                      value={editNewParentForm.primary_phone}
                      onChange={(e) => setEditNewParentForm({ ...editNewParentForm, primary_phone: e.target.value })}
                    />
                  </div>
                  <div className="sti-form-group sti-checkbox-group">
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

              <div className="sti-modal-footer">
                <button type="button" className="sti-btn sti-btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="sti-btn sti-btn-primary">
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