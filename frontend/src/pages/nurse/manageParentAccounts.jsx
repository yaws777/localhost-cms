import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Search,
  Edit,
  Eye,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Key,
  Users,
  GraduationCap,
  Save,
  Printer
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/datetime';
import '../../styles/nurse/ManageParentAccounts.css';

const API_BASE = 'https://localhost-cms.onrender.com/manageParentAccount';

const EMPTY_FORM = {
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
};

const formKey = (f) =>
  JSON.stringify([
    f.parent_id,
    f.first_name,
    f.last_name,
    f.username,
    Number(f.is_active),
    f.resetToDefault,
    f.linkedStudents.map((s) => s.student_id)
  ]);

const initialsOf = (first, last) =>
  `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();

const StatusBadge = ({ active }) =>
  active ? (
    <span className="badge-mpa badge-success-mpa">
      <UserCheck size={14} aria-hidden="true" /> Active
    </span>
  ) : (
    <span className="badge-mpa badge-danger-mpa">
      <UserX size={14} aria-hidden="true" /> Inactive
    </span>
  );

export default function ManageParentAccount() {
  const { showAlert, showConfirm } = useAlert();

  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [initialLoad, setInitialLoad] = useState(true);

  // Modals state
  const [viewModalData, setViewModalData] = useState(null);
  const [editModalData, setEditModalData] = useState(null);

  // Edit form state
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editBaseline, setEditBaseline] = useState('');
  const [invalidFields, setInvalidFields] = useState([]);
  const [saving, setSaving] = useState(false);

  // Student search inside the edit modal
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);

  const parentsSeq = useRef(0);
  const studentsSeq = useRef(0);

  // Export code below reports through this helper
  const showFeedback = (type, title, message) => showAlert(message, type, { title });

  // Fetch Parent Accounts
  const fetchParents = useCallback(async () => {
    const seq = ++parentsSeq.current;
    try {
      const response = await axios.get(`${API_BASE}?search=${encodeURIComponent(search)}`);
      if (seq === parentsSeq.current && response.data.success) {
        setParents(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching parent accounts:', err);
      if (seq === parentsSeq.current) {
        showAlert('Could not load parent accounts.', 'error');
      }
    } finally {
      if (seq === parentsSeq.current) setInitialLoad(false);
    }
  }, [search, showAlert]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const counts = useMemo(() => {
    const active = parents.filter((p) => p.is_active).length;
    return { all: parents.length, active, inactive: parents.length - active };
  }, [parents]);

  const visibleParents = useMemo(() => {
    if (statusFilter === 'active') return parents.filter((p) => p.is_active);
    if (statusFilter === 'inactive') return parents.filter((p) => !p.is_active);
    return parents;
  }, [parents, statusFilter]);

  const isDirty = Boolean(editModalData) && formKey(editForm) !== editBaseline;

  // EXPORT REPORT FOR ALL PARENT ACCOUNTS
  const handleExportAllReport = () => {
    const rowsToExport = Array.isArray(visibleParents) ? visibleParents : [];

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      showFeedback('warning', 'Popup Blocked', 'Please allow popups in your browser settings to preview and print the report.');
      return;
    }

    const reportDate = formatDate(new Date());

    const tableRowsHtml = rowsToExport.map(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      const linkedCount = p.linked_students ? p.linked_students.length : 0;
      const statusStr = p.is_active ? 'Active' : 'Inactive';

      return `
        <tr>
          <td>${p.parent_id || ''}</td>
          <td><strong>${fullName}</strong></td>
          <td>${p.username || 'N/A'}</td>
          <td>${p.primary_phone || 'N/A'}</td>
          <td>${linkedCount} Student(s)</td>
          <td>${statusStr}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Parent Accounts Summary Report</title>
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
              <span><strong>PARENT ACCOUNTS SUMMARY REPORT</strong></span>
              <span>Date Generated: ${reportDate}</span>
          </div>

          <table>
              <thead>
                  <tr>
                      <th>Parent ID</th>
                      <th>Parent Name</th>
                      <th>Username</th>
                      <th>Primary Phone</th>
                      <th>Linked Students</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRowsHtml || '<tr><td colspan="6">No parent accounts found.</td></tr>'}
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

  // EXPORT REPORT FOR SPECIFIC PARENT ACCOUNT
  const handleExportSingleReport = () => {
    if (!viewModalData) return;

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      showFeedback('warning', 'Popup Blocked', 'Please allow popups in your browser settings to preview and print the report.');
      return;
    }

    const reportDate = formatDate(new Date());

    const parentName = `${viewModalData.first_name || ''} ${viewModalData.last_name || ''}`.trim();
    const parentStatus = viewModalData.is_active ? 'Active' : 'Inactive';

    const linkedStudentsList = viewModalData.linked_students || [];
    const tableRowsHtml = linkedStudentsList.map(s => {
      const studentName = `${s.first_name || ''} ${s.last_name || ''}`.trim();
      const progName = s.program_name || 'N/A';
      const yrSec = `Year ${s.year_level || ''} - ${s.section || ''}`;

      return `
        <tr>
          <td>${s.student_id || ''}</td>
          <td><strong>${studentName}</strong></td>
          <td>${progName}</td>
          <td>${yrSec}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Individual Parent Account Report - ${viewModalData.parent_id || 'Parent'}</title>
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
              <span><strong>INDIVIDUAL PARENT ACCOUNT REPORT</strong></span>
              <span>Date Generated: ${reportDate}</span>
          </div>

          <div class="details-card">
              <div><strong>Parent Name:</strong> ${parentName}</div>
              <div><strong>Parent ID:</strong> ${viewModalData.parent_id || 'N/A'}</div>
              <div><strong>Username:</strong> ${viewModalData.username || 'N/A'}</div>
              <div><strong>Primary Phone:</strong> ${viewModalData.primary_phone || 'N/A'}</div>
              <div><strong>Account Status:</strong> ${parentStatus}</div>
          </div>

          <h3 style="font-size: 14px; color: #1e3a8a; margin-bottom: 10px;">Linked Student Accounts</h3>
          <table>
              <thead>
                  <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Program</th>
                      <th>Year Level & Section</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRowsHtml || '<tr><td colspan="4">No students currently linked to this parent account.</td></tr>'}
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

  // Open Edit Modal
  const handleOpenEdit = (parent) => {
    const form = {
      original_parent_id: parent.parent_id,
      parent_id: parent.parent_id,
      user_id: parent.user_id,
      first_name: parent.first_name,
      last_name: parent.last_name,
      username: parent.username,
      password: '',
      resetToDefault: false,
      is_active: parent.is_active ? 1 : 0,
      linkedStudents: parent.linked_students ? [...parent.linked_students] : []
    };
    setEditForm(form);
    setEditBaseline(formKey(form));
    setInvalidFields([]);
    setStudentSearchInput('');
    setStudentSearchResults([]);
    setEditModalData(parent);
  };

  const setField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setInvalidFields((prev) => prev.filter((k) => k !== key));
  };

  // Close edit modal, asking first when there are unsaved changes
  const requestCloseEdit = async () => {
    if (isDirty) {
      const ok = await showConfirm('Close without saving?', {
        title: 'Discard changes',
        confirmLabel: 'Discard',
        danger: true
      });
      if (!ok) return;
    }
    setEditModalData(null);
  };

  // Search Students to Link
  const handleSearchStudents = async (query) => {
    setStudentSearchInput(query);
    const seq = ++studentsSeq.current;
    if (!query.trim()) {
      setStudentSearchResults([]);
      setIsSearchingStudents(false);
      return;
    }
    setIsSearchingStudents(true);
    try {
      const res = await axios.get(`${API_BASE}/students?search=${encodeURIComponent(query)}`);
      if (seq === studentsSeq.current && res.data.success) {
        setStudentSearchResults(res.data.data);
      }
    } catch (err) {
      console.error('Error searching students:', err);
    } finally {
      if (seq === studentsSeq.current) setIsSearchingStudents(false);
    }
  };

  // Add student to link list
  const handleAddStudent = (student) => {
    setEditForm((prev) =>
      prev.linkedStudents.some((s) => s.student_id === student.student_id)
        ? prev
        : { ...prev, linkedStudents: [...prev.linkedStudents, student] }
    );
    studentsSeq.current += 1;
    setStudentSearchInput('');
    setStudentSearchResults([]);
    setIsSearchingStudents(false);
  };

  // Remove student from link list (asks first)
  const handleRemoveStudent = async (student) => {
    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.student_id;
    const ok = await showConfirm(`Unlink ${name}?`, {
      title: 'Unlink student',
      confirmLabel: 'Unlink',
      danger: true
    });
    if (!ok) return;
    setEditForm((prev) => ({
      ...prev,
      linkedStudents: prev.linkedStudents.filter((s) => s.student_id !== student.student_id)
    }));
  };

  // Perform API call for Update
  const executeSaveUpdate = async () => {
    setSaving(true);
    try {
      const payload = {
        original_parent_id: editForm.original_parent_id,
        parent_id: editForm.parent_id.trim(),
        user_id: editForm.user_id,
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        username: editForm.username.trim(),
        password: editForm.resetToDefault ? '123' : '',
        resetToDefault: editForm.resetToDefault,
        is_active: editForm.is_active,
        linked_student_ids: editForm.linkedStudents.map((s) => s.student_id)
      };

      const res = await axios.put(API_BASE, payload);
      if (res.data.success) {
        setEditModalData(null);
        fetchParents();
        showAlert(
          editForm.resetToDefault ? 'Account updated. Password reset.' : 'Account updated.',
          'success',
          { title: 'Saved' }
        );
      } else {
        showAlert(res.data.message || 'Could not update the account.', 'error', { title: 'Update failed' });
      }
    } catch (err) {
      console.error('Error saving parent account:', err);
      showAlert(err.response?.data?.message || 'Could not update the account.', 'error', { title: 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  // Handle Save Update Request (validates, then confirms)
  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    if (saving) return;

    const missing = ['parent_id', 'username', 'first_name', 'last_name'].filter(
      (k) => !String(editForm[k] || '').trim()
    );
    setInvalidFields(missing);
    if (missing.length) {
      showAlert('Fill in all required fields.', 'warning', { title: 'Missing details' });
      return;
    }
    if (!isDirty) return;

    const deactivating = Boolean(editModalData.is_active) && Number(editForm.is_active) === 0;
    const ok = await showConfirm(
      deactivating
        ? `Deactivate ${editForm.first_name} ${editForm.last_name}? Sign-in stops.`
        : `Save changes to "${editForm.parent_id}"?`,
      {
        title: deactivating ? 'Deactivate account' : 'Save changes',
        confirmLabel: deactivating ? 'Deactivate' : 'Save',
        danger: deactivating
      }
    );
    if (!ok) return;
    await executeSaveUpdate();
  };

  const openEditFromView = () => {
    const parent = viewModalData;
    setViewModalData(null);
    if (parent) handleOpenEdit(parent);
  };

  const linkedIds = editForm.linkedStudents.map((s) => s.student_id);
  const availableResults = studentSearchResults.filter((s) => !linkedIds.includes(s.student_id));

  return (
    <div className="container-mpa">
      {/* STI header band */}
      <header className="header-mpa">
        <span className="logo-mpa">
          <Users size={28} aria-hidden="true" />
        </span>
        <div>
          <h1>Parent Accounts</h1>
          <p className="subtitle-mpa">Nurse portal</p>
        </div>
      </header>

      {/* Search, status filter, count, export */}
      <section className="card-mpa toolbar-mpa" aria-label="Filters">
        <div className="search-box-mpa">
          <label htmlFor="mpa-search" className="vh-mpa">
            Search parents
          </label>
          <Search size={18} className="search-icon-mpa" aria-hidden="true" />
          <input
            id="mpa-search"
            className="input-mpa"
            type="search"
            placeholder="Search by ID, name, username"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="seg-mpa" role="group" aria-label="Filter by status">
          {[
            ['all', 'All'],
            ['active', 'Active'],
            ['inactive', 'Inactive']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            >
              {label} <span className="seg-n-mpa">{counts[key]}</span>
            </button>
          ))}
        </div>

        <p className="count-mpa" role="status" aria-live="polite">
          {visibleParents.length} of {parents.length}
        </p>

        <button
          type="button"
          className="btn-mpa btn-icon-mpa btn-secondary-mpa"
          onClick={handleExportAllReport}
          aria-label="Export report"
          title="Export report"
        >
          <Printer size={20} aria-hidden="true" />
        </button>
      </section>

      {/* Parent Accounts Table Card */}
      <section className="card-mpa table-card-mpa" aria-label="Parent accounts">
        <div className="table-container-mpa">
          <table className="table-mpa">
            <thead>
              <tr>
                <th scope="col">Parent</th>
                <th scope="col">Username</th>
                <th scope="col">Phone</th>
                <th scope="col">Students</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="vh-mpa">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {initialLoad ? (
                <tr className="empty-mpa">
                  <td colSpan="6" role="status">
                    Loading accounts...
                  </td>
                </tr>
              ) : visibleParents.length === 0 ? (
                <tr className="empty-mpa">
                  <td colSpan="6">
                    <Search size={32} aria-hidden="true" />
                    No parent accounts found
                  </td>
                </tr>
              ) : (
                visibleParents.map((parent) => {
                  const fullName = `${parent.first_name} ${parent.last_name}`;
                  const linkedCount = parent.linked_students ? parent.linked_students.length : 0;
                  return (
                    <tr key={parent.parent_id}>
                      <td className="cell-parent-mpa">
                        <div className="who-mpa">
                          <span className="avatar-mpa" aria-hidden="true">
                            {initialsOf(parent.first_name, parent.last_name)}
                          </span>
                          <div className="who-text-mpa">
                            <button
                              type="button"
                              className="name-btn-mpa"
                              onClick={() => setViewModalData(parent)}
                            >
                              {fullName}
                            </button>
                            <span className="sub-mpa mono-mpa">{parent.parent_id}</span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Username">
                        <span className="mono-mpa">{parent.username}</span>
                      </td>
                      <td data-label="Phone">{parent.primary_phone || 'N/A'}</td>
                      <td data-label="Students">
                        <span className="badge-mpa badge-info-mpa">
                          <Users size={14} aria-hidden="true" /> {linkedCount} linked
                        </span>
                      </td>
                      <td data-label="Status">
                        <StatusBadge active={parent.is_active} />
                      </td>
                      <td className="cell-actions-mpa">
                        <div className="actions-mpa">
                          <button
                            type="button"
                            className="btn-mpa btn-icon-mpa"
                            onClick={() => setViewModalData(parent)}
                            title={`View ${fullName}`}
                            aria-label={`View ${fullName}`}
                          >
                            <Eye size={20} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn-mpa btn-icon-mpa"
                            onClick={() => handleOpenEdit(parent)}
                            title={`Edit ${fullName}`}
                            aria-label={`Edit ${fullName}`}
                          >
                            <Edit size={20} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* VIEW DETAILS MODAL */}
      <Modal
        isOpen={Boolean(viewModalData)}
        onClose={() => setViewModalData(null)}
        size="lg"
        title={viewModalData ? `${viewModalData.first_name} ${viewModalData.last_name}` : ''}
        icon={
          viewModalData ? (
            <span className="avatar-mpa lg" aria-hidden="true">
              {initialsOf(viewModalData.first_name, viewModalData.last_name)}
            </span>
          ) : null
        }
        footer={
          <>
            <button
              type="button"
              className="btn-mpa btn-icon-mpa btn-secondary-mpa"
              onClick={handleExportSingleReport}
              aria-label="Export report"
              title="Export report"
            >
              <Printer size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn-mpa btn-icon-mpa btn-primary-mpa"
              onClick={openEditFromView}
              aria-label="Edit account"
              title="Edit account"
            >
              <Edit size={20} aria-hidden="true" />
            </button>
          </>
        }
      >
        {viewModalData && (
          <>
            <dl className="facts-mpa">
              <div>
                <dt>Parent ID</dt>
                <dd className="mono-mpa">{viewModalData.parent_id}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd className="mono-mpa">{viewModalData.username}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{viewModalData.primary_phone || 'N/A'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge active={viewModalData.is_active} />
                </dd>
              </div>
            </dl>

            <h3 className="section-title-mpa">
              Linked students ({viewModalData.linked_students ? viewModalData.linked_students.length : 0})
            </h3>
            {viewModalData.linked_students && viewModalData.linked_students.length > 0 ? (
              <ul className="student-grid-mpa">
                {viewModalData.linked_students.map((student) => (
                  <li key={student.student_id} className="student-card-mpa">
                    <span className="avatar-mpa sm" aria-hidden="true">
                      <GraduationCap size={16} />
                    </span>
                    <div>
                      <p className="student-name-mpa">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="sub-mpa mono-mpa">{student.student_id}</p>
                      <p className="sub-mpa">{student.program_name || 'N/A'}</p>
                      <p className="sub-mpa">
                        Year {student.year_level} - {student.section}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-line-mpa">
                <Users size={16} aria-hidden="true" /> No linked students
              </p>
            )}
          </>
        )}
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        isOpen={Boolean(editModalData)}
        onClose={requestCloseEdit}
        closeOnBackdrop={false}
        size="xl"
        title="Edit account"
        icon={
          editModalData ? (
            <span className="avatar-mpa lg" aria-hidden="true">
              {initialsOf(editModalData.first_name, editModalData.last_name)}
            </span>
          ) : null
        }
        footer={
          <div className="modal-footer-actions-mpa">
            <button type="button" className="btn-mpa btn-secondary-mpa" onClick={requestCloseEdit}>
              Cancel
            </button>
            <button
              type="submit"
              form="edit-parent-form"
              className="btn-mpa btn-primary-mpa"
              disabled={!isDirty || saving}
            >
              <Save size={16} aria-hidden="true" /> Save
            </button>
          </div>
        }
      >
        <form id="edit-parent-form" onSubmit={handleSaveUpdate} noValidate>
          <div className="edit-cols-mpa">
            {/* Account */}
            <section className="form-section-mpa" aria-labelledby="mpa-account-title">
              <h3 id="mpa-account-title" className="section-title-mpa">
                Account
              </h3>
              <div className="grid-2-mpa">
                <div className="form-group-mpa">
                  <label htmlFor="edit-first-name">First name</label>
                  <input
                    id="edit-first-name"
                    className="input-mpa"
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setField('first_name', e.target.value)}
                    aria-required="true"
                    aria-invalid={invalidFields.includes('first_name') || undefined}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group-mpa">
                  <label htmlFor="edit-last-name">Last name</label>
                  <input
                    id="edit-last-name"
                    className="input-mpa"
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setField('last_name', e.target.value)}
                    aria-required="true"
                    aria-invalid={invalidFields.includes('last_name') || undefined}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group-mpa">
                  <label htmlFor="edit-parent-id">Parent ID</label>
                  <input
                    id="edit-parent-id"
                    className="input-mpa"
                    type="text"
                    value={editForm.parent_id}
                    onChange={(e) => setField('parent_id', e.target.value)}
                    aria-required="true"
                    aria-invalid={invalidFields.includes('parent_id') || undefined}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group-mpa">
                  <label htmlFor="edit-username">Username</label>
                  <input
                    id="edit-username"
                    className="input-mpa"
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setField('username', e.target.value)}
                    aria-required="true"
                    aria-invalid={invalidFields.includes('username') || undefined}
                    autoComplete="off"
                  />
                </div>
              </div>

              <fieldset className="form-group-mpa">
                <legend>Status</legend>
                <div className="seg-mpa">
                  <label>
                    <input
                      type="radio"
                      name="edit-status"
                      value="1"
                      checked={Number(editForm.is_active) === 1}
                      onChange={() => setField('is_active', 1)}
                    />
                    <span>
                      <UserCheck size={16} aria-hidden="true" /> Active
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="edit-status"
                      value="0"
                      checked={Number(editForm.is_active) === 0}
                      onChange={() => setField('is_active', 0)}
                    />
                    <span>
                      <UserX size={16} aria-hidden="true" /> Inactive
                    </span>
                  </label>
                </div>
              </fieldset>

              <label className="switch-mpa">
                <input
                  type="checkbox"
                  role="switch"
                  checked={editForm.resetToDefault}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      resetToDefault: e.target.checked,
                      password: e.target.checked ? '123' : ''
                    })
                  }
                />
                <span className="switch-track-mpa" aria-hidden="true" />
                <Key size={16} aria-hidden="true" /> Reset password
              </label>
            </section>

            {/* Linked students */}
            <section className="form-section-mpa" aria-labelledby="mpa-students-title">
              <h3 id="mpa-students-title" className="section-title-mpa">
                Linked students ({editForm.linkedStudents.length})
              </h3>

              <div className="search-box-mpa">
                <label htmlFor="search-student-input" className="vh-mpa">
                  Find student
                </label>
                <Search size={16} className="search-icon-mpa" aria-hidden="true" />
                <input
                  id="search-student-input"
                  className="input-mpa"
                  type="search"
                  placeholder="Find by ID or name"
                  autoComplete="off"
                  value={studentSearchInput}
                  onChange={(e) => handleSearchStudents(e.target.value)}
                />
              </div>

              {isSearchingStudents ? (
                <p className="results-mpa sub-mpa" role="status">
                  Searching...
                </p>
              ) : (
                studentSearchInput.trim() && (
                  <ul className="results-mpa" aria-label="Search results">
                    {availableResults.length === 0 ? (
                      <li className="empty-line-mpa">
                        <Search size={16} aria-hidden="true" /> No match
                      </li>
                    ) : (
                      availableResults.slice(0, 6).map((student) => {
                        const name = `${student.first_name} ${student.last_name}`;
                        return (
                          <li key={student.student_id}>
                            <button
                              type="button"
                              className="result-row-mpa"
                              onClick={() => handleAddStudent(student)}
                              aria-label={`Link ${name}`}
                            >
                              <span className="result-text-mpa">
                                <strong>{name}</strong>
                                <span className="sub-mpa">
                                  {student.student_id} · {student.program_name || 'N/A'}
                                </span>
                              </span>
                              <Plus size={16} aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )
              )}

              <ul className="linked-list-mpa">
                {editForm.linkedStudents.length === 0 ? (
                  <li className="empty-line-mpa">
                    <Users size={16} aria-hidden="true" /> No linked students
                  </li>
                ) : (
                  editForm.linkedStudents.map((student) => {
                    const name = `${student.first_name} ${student.last_name}`;
                    return (
                      <li key={student.student_id} className="linked-row-mpa">
                        <div className="linked-main-mpa">
                          <span className="avatar-mpa sm" aria-hidden="true">
                            <GraduationCap size={16} />
                          </span>
                          <div>
                            <p className="student-name-mpa">{name}</p>
                            <p className="sub-mpa">
                              <span className="mono-mpa">{student.student_id}</span> · {student.program_name || 'N/A'}
                            </p>
                            <p className="sub-mpa">
                              Year {student.year_level} - {student.section}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-mpa btn-icon-mpa btn-danger-mpa"
                          onClick={() => handleRemoveStudent(student)}
                          title={`Unlink ${name}`}
                          aria-label={`Unlink ${name}`}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          </div>
        </form>
      </Modal>
    </div>
  );
}
