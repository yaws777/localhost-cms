import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search,
  Edit,
  Eye,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  X,
  Key,
  Users,
  GraduationCap,
  Save
} from 'lucide-react';
import '../../styles/nurse/ManageParentAccounts.css';

const API_BASE = 'http://localhost:3001/manageParentAccount';

export default function ManageParentAccount() {
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [viewModalData, setViewModalData] = useState(null);
  const [editModalData, setEditModalData] = useState(null);

  // Edit Form state
  const [editForm, setEditForm] = useState({
    original_parent_id: '',
    parent_id: '',
    user_id: '',
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    resetToDefault: false,
    is_active: 1,
    linkedStudents: []
  });

  // Student Search inside Edit Modal
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);

  // Fetch Parent Accounts (wrapped with useCallback to satisfy useEffect dependencies)
  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}?search=${search}`);
      if (response.data.success) {
        setParents(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching parent accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  // Open Edit Modal
  const handleOpenEdit = (parent) => {
    setEditForm({
      original_parent_id: parent.parent_id,
      parent_id: parent.parent_id,
      user_id: parent.user_id,
      first_name: parent.first_name,
      last_name: parent.last_name,
      username: parent.username,
      password: '',
      resetToDefault: false,
      is_active: parent.is_active,
      linkedStudents: parent.linked_students ? [...parent.linked_students] : []
    });
    setStudentSearchInput('');
    setStudentSearchResults([]);
    setEditModalData(parent);
  };

  // Search Students to Link
  const handleSearchStudents = async (query) => {
    setStudentSearchInput(query);
    if (!query.trim()) {
      setStudentSearchResults([]);
      return;
    }
    setIsSearchingStudents(true);
    try {
      const res = await axios.get(`${API_BASE}/students?search=${query}`);
      if (res.data.success) {
        setStudentSearchResults(res.data.data);
      }
    } catch (err) {
      console.error('Error searching students:', err);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  // Add student to link list
  const handleAddStudent = (student) => {
    if (!editForm.linkedStudents.some((s) => s.student_id === student.student_id)) {
      setEditForm((prev) => ({
        ...prev,
        linkedStudents: [...prev.linkedStudents, student]
      }));
    }
    setStudentSearchInput('');
    setStudentSearchResults([]);
  };

  // Remove student from link list
  const handleRemoveStudent = (studentId) => {
    setEditForm((prev) => ({
      ...prev,
      linkedStudents: prev.linkedStudents.filter((s) => s.student_id !== studentId)
    }));
  };

  // Handle Save Update
  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        original_parent_id: editForm.original_parent_id,
        parent_id: editForm.parent_id,
        user_id: editForm.user_id,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        username: editForm.username,
        password: editForm.resetToDefault ? '123' : editForm.password,
        resetToDefault: editForm.resetToDefault,
        is_active: editForm.is_active,
        linked_student_ids: editForm.linkedStudents.map((s) => s.student_id)
      };

      const res = await axios.put(API_BASE, payload);
      if (res.data.success) {
        alert('Parent account updated successfully!');
        setEditModalData(null);
        fetchParents();
      }
    } catch (err) {
      console.error('Error saving parent account:', err);
      alert('Failed to update parent account.');
    }
  };

  return (
    <div className="sti-container">
      {/* STI Top Header Banner */}
      <div className="sti-header">
        <div className="sti-brand">
          <div className="sti-logo-accent">STI</div>
          <div>
            <h1>Parent Account Management</h1>
            <p className="sti-subtitle">Administrator Portal</p>
          </div>
        </div>
      </div>

      {/* Search Bar & Controls */}
      <div className="sti-controls">
        <div className="sti-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Parent ID, Name, Username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Parent Accounts Table */}
      <div className="sti-card">
        <table className="sti-table">
          <thead>
            <tr>
              <th>Parent ID</th>
              <th>Full Name</th>
              <th>Username</th>
              <th>Linked Students</th>
              <th>Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-4">Loading accounts...</td>
              </tr>
            ) : parents.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4">No parent accounts found.</td>
              </tr>
            ) : (
              parents.map((parent) => (
                <tr key={parent.parent_id}>
                  <td className="font-bold">{parent.parent_id}</td>
                  <td>{`${parent.first_name} ${parent.last_name}`}</td>
                  <td>{parent.username}</td>
                  <td>
                    <span className="badge badge-info">
                      <Users size={14} style={{ marginRight: '4px' }} />
                      {parent.linked_students ? parent.linked_students.length : 0} Linked
                    </span>
                  </td>
                  <td>
                    {parent.is_active ? (
                      <span className="badge badge-success">
                        <UserCheck size={12} style={{ marginRight: '4px' }} /> Active
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        <UserX size={12} style={{ marginRight: '4px' }} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="text-center">
                    <button className="btn-icon btn-view" onClick={() => setViewModalData(parent)} title="View Details">
                      <Eye size={16} />
                    </button>
                    <button className="btn-icon btn-edit" onClick={() => handleOpenEdit(parent)} title="Edit Account">
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewModalData && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Parent & Linked Students Details</h2>
              <button className="btn-close" onClick={() => setViewModalData(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <h3>Parent Account Information</h3>
                <div className="grid-2">
                  <div><strong>Parent ID:</strong> {viewModalData.parent_id}</div>
                  <div><strong>Username:</strong> {viewModalData.username}</div>
                  <div><strong>First Name:</strong> {viewModalData.first_name}</div>
                  <div><strong>Last Name:</strong> {viewModalData.last_name}</div>
                  <div><strong>Primary Phone:</strong> {viewModalData.primary_phone || 'N/A'}</div>
                  <div><strong>Status:</strong> {viewModalData.is_active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>

              <div className="details-section">
                <h3>Linked Student Accounts</h3>
                {viewModalData.linked_students && viewModalData.linked_students.length > 0 ? (
                  <div className="student-grid">
                    {viewModalData.linked_students.map((student) => (
                      <div key={student.student_id} className="student-card">
                        <div className="student-card-header">
                          <GraduationCap size={18} />
                          <span>{student.student_id}</span>
                        </div>
                        <div className="student-card-body">
                          <p className="student-name">{student.first_name} {student.last_name}</p>
                          <p><strong>Program:</strong> {student.program_name || 'N/A'}</p>
                          <p><strong>Year Level & Section:</strong> Year {student.year_level} - {student.section}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No students currently linked to this parent account.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalData && (
        <div className="modal-backdrop">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>Edit Parent Account</h2>
              <button className="btn-close" onClick={() => setEditModalData(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUpdate}>
              <div className="modal-body">
                {/* Account Details */}
                <div className="form-section">
                  <h3 className="section-title">Account Details</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Parent ID</label>
                      <input
                        type="text"
                        value={editForm.parent_id}
                        onChange={(e) => setEditForm({ ...editForm, parent_id: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Password & Reset */}
                  <div className="grid-2" style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder={editForm.resetToDefault ? 'Set to "123"' : 'Enter new password'}
                        value={editForm.resetToDefault ? '123' : editForm.password}
                        disabled={editForm.resetToDefault}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      />
                    </div>
                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editForm.resetToDefault}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              resetToDefault: e.target.checked,
                              password: e.target.checked ? '123' : ''
                            })
                          }
                        />
                        <Key size={16} /> Reset to Default ("123")
                      </label>
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label>Account Status</label>
                    <select
                      value={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: parseInt(e.target.value) })}
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Manage Linked Students */}
                <div className="form-section">
                  <h3 className="section-title">Manage Linked Students</h3>

                  {/* Search and Add Student */}
                  <div className="student-search-container">
                    <label>Search Student to Link</label>
                    <div className="sti-search-box">
                      <Search size={16} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search student by ID or Name..."
                        value={studentSearchInput}
                        onChange={(e) => handleSearchStudents(e.target.value)}
                      />
                    </div>

                    {/* Search Loading / Results Dropdown */}
                    {isSearchingStudents ? (
                      <div className="search-results-dropdown">
                        <div className="dropdown-item text-muted">Searching students...</div>
                      </div>
                    ) : studentSearchResults.length > 0 && (
                      <div className="search-results-dropdown">
                        {studentSearchResults.map((student) => (
                          <div key={student.student_id} className="dropdown-item">
                            <div>
                              <strong>{student.student_id}</strong> - {student.first_name} {student.last_name} ({student.program_name || 'N/A'})
                            </div>
                            <button
                              type="button"
                              className="btn-add-sm"
                              onClick={() => handleAddStudent(student)}
                            >
                              <Plus size={14} /> Link
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Currently Linked Students List */}
                  <div className="linked-students-list">
                    <h4>Currently Linked Students ({editForm.linkedStudents.length})</h4>
                    {editForm.linkedStudents.length === 0 ? (
                      <p className="text-muted">No students currently linked.</p>
                    ) : (
                      editForm.linkedStudents.map((student) => (
                        <div key={student.student_id} className="linked-student-item">
                          <div>
                            <strong>{student.student_id}</strong> - {student.first_name} {student.last_name}
                            <span className="sub-text">
                              ({student.program_name || 'N/A'} | Year {student.year_level} - {student.section})
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-danger-sm"
                            onClick={() => handleRemoveStudent(student.student_id)}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditModalData(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}