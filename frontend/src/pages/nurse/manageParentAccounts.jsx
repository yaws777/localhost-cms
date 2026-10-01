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

  // Fetch Parent Accounts
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
        password: editForm.resetToDefault ? '123' : '',
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
    <div className="container-mpa">
      {/* STI Top Header Banner */}
      <header className="header-mpa">
        <div className="brand-mpa">
          <div className="logo-accent-mpa">STI</div>
          <div className="brand-text-mpa">
            <h1>Parent Account Management</h1>
            <p className="subtitle-mpa">Administrator Portal</p>
          </div>
        </div>
      </header>

      {/* Search Bar & Controls */}
      <div className="controls-mpa">
        <div className="search-box-mpa">
          <Search size={18} className="search-icon-mpa" />
          <input
            type="text"
            placeholder="Search by Parent ID, Name, Username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Parent Accounts Table Card */}
      <div className="card-mpa">
        <div className="table-container-mpa">
          <table className="table-mpa">
            <thead>
              <tr>
                <th>Parent ID</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Linked Students</th>
                <th>Status</th>
                <th className="text-center-mpa">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center-mpa py-4-mpa">
                    Loading accounts...
                  </td>
                </tr>
              ) : parents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center-mpa py-4-mpa">
                    No parent accounts found.
                  </td>
                </tr>
              ) : (
                parents.map((parent) => (
                  <tr key={parent.parent_id}>
                    <td className="font-bold-mpa nowrap-cell-mpa">{parent.parent_id}</td>
                    <td>{`${parent.first_name} ${parent.last_name}`}</td>
                    <td className="username-cell-mpa">{parent.username}</td>
                    <td className="nowrap-cell-mpa">
                      <span className="badge-mpa badge-info-mpa">
                        <Users size={14} className="badge-icon-mpa" />
                        {parent.linked_students ? parent.linked_students.length : 0} Linked
                      </span>
                    </td>
                    <td className="nowrap-cell-mpa">
                      {parent.is_active ? (
                        <span className="badge-mpa badge-success-mpa">
                          <UserCheck size={12} className="badge-icon-mpa" /> Active
                        </span>
                      ) : (
                        <span className="badge-mpa badge-danger-mpa">
                          <UserX size={12} className="badge-icon-mpa" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="text-center-mpa action-cell-mpa">
                      <div className="action-buttons-mpa">
                        <button
                          type="button"
                          className="btn-icon-mpa btn-view-mpa"
                          onClick={() => setViewModalData(parent)}
                          title="View Details"
                          aria-label={`View details for ${parent.parent_id}`}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-mpa btn-edit-mpa"
                          onClick={() => handleOpenEdit(parent)}
                          title="Edit Account"
                          aria-label={`Edit account for ${parent.parent_id}`}
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewModalData && (
        <div className="modal-backdrop-mpa" onClick={() => setViewModalData(null)}>
          <div
            className="modal-content-mpa"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-modal-title"
          >
            <div className="modal-header-mpa">
              <h2 id="view-modal-title">Parent & Linked Students</h2>
              <button
                type="button"
                className="btn-close-mpa"
                aria-label="Close parent details"
                onClick={() => setViewModalData(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-mpa">
              <div className="details-section-mpa">
                <h3>Parent Account Information</h3>
                <div className="grid-2-mpa">
                  <div>
                    <strong>Parent ID:</strong> {viewModalData.parent_id}
                  </div>
                  <div>
                    <strong>Username:</strong> {viewModalData.username}
                  </div>
                  <div>
                    <strong>First Name:</strong> {viewModalData.first_name}
                  </div>
                  <div>
                    <strong>Last Name:</strong> {viewModalData.last_name}
                  </div>
                  <div>
                    <strong>Primary Phone:</strong> {viewModalData.primary_phone || 'N/A'}
                  </div>
                  <div>
                    <strong>Status:</strong> {viewModalData.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              <div className="details-section-mpa">
                <h3>Linked Student Accounts</h3>
                {viewModalData.linked_students && viewModalData.linked_students.length > 0 ? (
                  <div className="student-grid-mpa">
                    {viewModalData.linked_students.map((student) => (
                      <div key={student.student_id} className="student-card-mpa">
                        <div className="student-card-header-mpa">
                          <GraduationCap size={18} />
                          <span>{student.student_id}</span>
                        </div>
                        <div className="student-card-body-mpa">
                          <p className="student-name-mpa">
                            {student.first_name} {student.last_name}
                          </p>
                          <p>
                            <strong>Program:</strong> {student.program_name || 'N/A'}
                          </p>
                          <p>
                            <strong>Year Level & Section:</strong> Year {student.year_level} - {student.section}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-mpa">No students currently linked to this parent account.</p>
                )}
              </div>
            </div>
            <div className="modal-footer-mpa">
              <button type="button" className="btn-secondary-mpa" onClick={() => setViewModalData(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalData && (
        <div className="modal-backdrop-mpa" onClick={() => setEditModalData(null)}>
          <div
            className="modal-content-mpa modal-lg-mpa"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
          >
            <div className="modal-header-mpa">
              <h2 id="edit-modal-title">Edit Parent Account</h2>
              <button
                type="button"
                className="btn-close-mpa"
                aria-label="Close edit parent modal"
                onClick={() => setEditModalData(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUpdate} className="modal-form-mpa">
              <div className="modal-body-mpa">
                {/* Account Details */}
                <div className="form-section-mpa">
                  <h3 className="section-title-mpa">Account Details</h3>
                  <div className="grid-2-mpa">
                    <div className="form-group-mpa">
                      <label htmlFor="edit-parent-id">Parent ID</label>
                      <input
                        id="edit-parent-id"
                        type="text"
                        value={editForm.parent_id}
                        onChange={(e) => setEditForm({ ...editForm, parent_id: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-mpa">
                      <label htmlFor="edit-username">Username</label>
                      <input
                        id="edit-username"
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-mpa">
                      <label htmlFor="edit-first-name">First Name</label>
                      <input
                        id="edit-first-name"
                        type="text"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-mpa">
                      <label htmlFor="edit-last-name">Last Name</label>
                      <input
                        id="edit-last-name"
                        type="text"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Password Reset Checkbox */}
                  <div className="form-group-mpa checkbox-group-mpa">
                    <label className="checkbox-label-mpa">
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
                      <Key size={16} /> Reset Password to Default ("123")
                    </label>
                  </div>

                  {/* Account Status */}
                  <div className="form-group-mpa spacing-top-sm">
                    <label htmlFor="edit-status">Account Status</label>
                    <select
                      id="edit-status"
                      value={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: parseInt(e.target.value, 10) })}
                    >
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Manage Linked Students */}
                <div className="form-section-mpa">
                  <h3 className="section-title-mpa">Manage Linked Students</h3>

                  {/* Search and Add Student */}
                  <div className="student-search-container-mpa">
                    <label htmlFor="search-student-input">Search Student to Link</label>
                    <div className="search-box-mpa">
                      <Search size={16} className="search-icon-mpa" />
                      <input
                        id="search-student-input"
                        type="text"
                        placeholder="Search student by ID or Name..."
                        value={studentSearchInput}
                        onChange={(e) => handleSearchStudents(e.target.value)}
                      />
                    </div>

                    {/* Search Loading / Results Dropdown */}
                    {isSearchingStudents ? (
                      <div className="search-results-dropdown-mpa">
                        <div className="dropdown-item-mpa text-muted-mpa">Searching students...</div>
                      </div>
                    ) : (
                      studentSearchResults.length > 0 && (
                        <div className="search-results-dropdown-mpa">
                          {studentSearchResults.map((student) => (
                            <div key={student.student_id} className="dropdown-item-mpa">
                              <div className="dropdown-item-text-mpa">
                                <strong>{student.student_id}</strong> - {student.first_name} {student.last_name} (
                                {student.program_name || 'N/A'})
                              </div>
                              <button
                                type="button"
                                className="btn-add-sm-mpa"
                                onClick={() => handleAddStudent(student)}
                              >
                                <Plus size={14} /> Link
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>

                  {/* Currently Linked Students List */}
                  <div className="linked-students-list-mpa">
                    <h4>Currently Linked Students ({editForm.linkedStudents.length})</h4>
                    {editForm.linkedStudents.length === 0 ? (
                      <p className="text-muted-mpa">No students currently linked.</p>
                    ) : (
                      editForm.linkedStudents.map((student) => (
                        <div key={student.student_id} className="linked-student-item-mpa">
                          <div className="linked-student-info-mpa">
                            <strong>{student.student_id}</strong> - {student.first_name} {student.last_name}
                            <span className="sub-text-mpa">
                              ({student.program_name || 'N/A'} | Year {student.year_level} - {student.section})
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-danger-sm-mpa"
                            title={`Unlink ${student.student_id}`}
                            aria-label={`Unlink student ${student.student_id}`}
                            onClick={() => handleRemoveStudent(student.student_id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Lower Portion Fixed Action Buttons */}
              <div className="modal-footer-mpa">
                <button type="button" className="btn-secondary-mpa" onClick={() => setEditModalData(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-mpa">
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