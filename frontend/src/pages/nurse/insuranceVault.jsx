import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Search, 
    FolderPlus, 
    Eye, 
    Trash2, 
    FileUp, 
    X, 
    Calendar, 
    Folder, 
    FileText, 
    UserCheck,
    Download
} from 'lucide-react';
import '../../styles/nurse/InsuranceVault.css';

const InsuranceVault = () => {
    const { nurseId } = useOutletContext();

    // Main States
    const [vaultFolders, setVaultFolders] = useState([]);
    const [filteredFolders, setFilteredFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Modal Visibility States
    const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState(false);
    const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    // Selected States
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [vaultFiles, setVaultFiles] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Student Search Modal State
    const [studentSearch, setStudentSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // File Upload Form State
    const [fileFormData, setFileFormData] = useState({
        document_name: '',
        description_notes: '',
        file: null
    });

    // Fetch Vault Folders List
    const fetchVaultFolders = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:3001/api/insurance-vault');
            const data = await res.json();
            if (Array.isArray(data)) {
                setVaultFolders(data);
                setFilteredFolders(data);
            } else {
                setVaultFolders([]);
                setFilteredFolders([]);
            }
        } catch (err) {
            console.error("Error fetching vaults:", err);
            setVaultFolders([]);
            setFilteredFolders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVaultFolders();
    }, []);

    // Search Students for Auto-complete (Trigger on 1 or more characters)
    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (studentSearch.trim().length > 0 && !selectedStudent) {
                try {
                    const res = await fetch(`http://localhost:3001/api/insurance-vault/search?query=${encodeURIComponent(studentSearch.trim())}`);
                    if (!res.ok) {
                        console.error("API response error status:", res.status);
                        setSearchResults([]);
                        return;
                    }

                    const data = await res.json();
                    const list = Array.isArray(data) 
                        ? data 
                        : (data.data || data.students || data.results || []);

                    setSearchResults(list);
                } catch (err) {
                    console.error("Student search error:", err);
                    setSearchResults([]);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [studentSearch, selectedStudent]);

    // Apply Client-side Filters
    useEffect(() => {
        let result = Array.isArray(vaultFolders) ? vaultFolders : [];

        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            result = result.filter(v => 
                `${v.student_first_name || ''} ${v.student_last_name || ''}`.toLowerCase().includes(query) ||
                (v.program_name && v.program_name.toLowerCase().includes(query)) ||
                (v.section && v.section.toLowerCase().includes(query)) ||
                (v.year_level && v.year_level.toString().includes(query)) ||
                (v.student_id && v.student_id.toLowerCase().includes(query))
            );
        }

        if (dateFilter) {
            result = result.filter(v => {
                if (!v.last_updated) return false;
                const vaultDate = new Date(v.last_updated).toISOString().split('T')[0];
                return vaultDate === dateFilter;
            });
        }

        setFilteredFolders(result);
    }, [searchTerm, dateFilter, vaultFolders]);

    // Fetch Files inside a Student Vault Folder
    const fetchStudentVaultFiles = async (studentId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/insurance-vault/student/${studentId}/files`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setVaultFiles(data);
            } else {
                setVaultFiles([]);
            }
        } catch (err) {
            console.error("Error fetching vault files:", err);
            setVaultFiles([]);
        }
    };

    // OPEN CREATE VAULT MODAL
    const handleOpenCreateVaultModal = () => {
        setSelectedStudent(null);
        setStudentSearch('');
        setSearchResults([]);
        setIsCreateVaultModalOpen(true);
    };

    // CONFIRM CREATE VAULT FOLDER
    const handleConfirmCreateVault = async (e) => {
        e.preventDefault();
        if (!selectedStudent) {
            alert("Please search and select a student first.");
            return;
        }

        try {
            const res = await fetch('http://localhost:3001/api/insurance-vault/create-vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: selectedStudent.student_id,
                    managed_by_nurse_id: nurseId
                })
            });
            const result = await res.json();
            if (result.success) {
                setIsCreateVaultModalOpen(false);
                fetchVaultFolders();
            } else {
                alert(result.error || 'Failed to create vault.');
            }
        } catch (err) {
            console.error("Create vault error:", err);
        }
    };

    // OPEN ADD FILE MODAL
    const handleOpenAddFileModal = (folder) => {
        setSelectedFolder(folder);
        setFileFormData({ document_name: '', description_notes: '', file: null });
        setIsAddFileModalOpen(true);
    };

    // UPLOAD FILE INTO VAULT
    const handleAddFileToVault = async (e) => {
        e.preventDefault();
        if (!fileFormData.document_name) {
            alert("Please enter a document name.");
            return;
        }

        const formData = new FormData();
        formData.append('student_id', selectedFolder.student_id);
        formData.append('document_name', fileFormData.document_name);
        formData.append('description_notes', fileFormData.description_notes);
        formData.append('managed_by_nurse_id', nurseId);
        if (fileFormData.file) {
            formData.append('file', fileFormData.file);
        }

        try {
            const res = await fetch('http://localhost:3001/api/insurance-vault/add-file', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                setIsAddFileModalOpen(false);
                fetchVaultFolders();
                if (isViewModalOpen && selectedFolder) {
                    fetchStudentVaultFiles(selectedFolder.student_id);
                }
            } else {
                alert(result.error || 'Failed to add file.');
            }
        } catch (err) {
            console.error("Add file error:", err);
        }
    };

    // VIEW VAULT FOLDER CONTENTS
    const handleOpenViewVault = (folder) => {
        setSelectedFolder(folder);
        fetchStudentVaultFiles(folder.student_id);
        setIsViewModalOpen(true);
    };

    // DELETE INDIVIDUAL FILE
    const handleDeleteFile = async (vaultFileId) => {
        if (window.confirm("Are you sure you want to delete this file from the vault?")) {
            try {
                const res = await fetch(`http://localhost:3001/api/insurance-vault/file/${vaultFileId}`, {
                    method: 'DELETE'
                });
                const result = await res.json();
                if (result.success) {
                    fetchStudentVaultFiles(selectedFolder.student_id);
                    fetchVaultFolders();
                }
            } catch (err) {
                console.error("Delete file error:", err);
            }
        }
    };

    // DELETE ENTIRE VAULT FOLDER
    const handleDeleteVaultFolder = async (studentId) => {
        if (window.confirm("Are you sure you want to delete this entire insurance vault folder and all its contents?")) {
            try {
                const res = await fetch(`http://localhost:3001/api/insurance-vault/student/${studentId}`, {
                    method: 'DELETE'
                });
                const result = await res.json();
                if (result.success) {
                    fetchVaultFolders();
                }
            } catch (err) {
                console.error("Delete vault folder error:", err);
            }
        }
    };

    return (
        <div className="insurance-vault-container-iv">
            {/* Header */}
            <div className="vault-header-iv">
                <div>
                    <h2>Insurance Vault Repository</h2>
                    <p className="subtitle-iv">Manage student insurance folders and document repositories.</p>
                </div>
                <button className="btn-add-vault-iv" onClick={handleOpenCreateVaultModal}>
                    <FolderPlus size={18} /> Add Insurance Vault/Folder
                </button>
            </div>

            {/* Filter Bar */}
            <div className="vault-filter-bar-iv">
                <div className="search-box-iv">
                    <Search className="search-icon-iv" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search student name, ID, program, section, or year level..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && <X className="clear-icon-iv" size={16} onClick={() => setSearchTerm('')} />}
                </div>

                <div className="date-filter-box-iv">
                    <Calendar size={18} className="date-icon-iv" />
                    <input 
                        type="date" 
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    />
                    {dateFilter && <X className="clear-icon-iv" size={16} onClick={() => setDateFilter('')} />}
                </div>
            </div>

            {/* Vault Folders Table */}
            <div className="vault-table-wrapper-iv">
                {loading ? (
                    <div className="vault-loading-iv">Loading Insurance Vault Folders...</div>
                ) : filteredFolders.length === 0 ? (
                    <div className="vault-empty-iv">No insurance vaults found.</div>
                ) : (
                    <table className="vault-table-iv">
                        <thead>
                            <tr>
                                <th>Student ID</th>
                                <th>Student Name</th>
                                <th>Program & Section</th>
                                <th>Files in Vault</th>
                                <th>Last Updated</th>
                                <th>Managed By</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFolders.map((folder) => (
                                <tr key={folder.student_id}>
                                    <td className="font-semibold-iv">{folder.student_id}</td>
                                    <td className="student-name-cell-iv">
                                        <Folder size={16} className="folder-icon-iv" />
                                        {folder.student_first_name} {folder.student_last_name}
                                    </td>
                                    <td>
                                        <span className="badge-program-iv">
                                            {folder.program_name} {folder.year_level ? `- Yr ${folder.year_level}` : ''} ({folder.section || 'N/A'})
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge-file-count-iv">
                                            {folder.total_files} File(s)
                                        </span>
                                    </td>
                                    <td>{folder.last_updated ? new Date(folder.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</td>
                                    <td>{folder.nurse_name || folder.managed_by_nurse_id}</td>
                                    <td>
                                        <div className="action-buttons-iv">
                                            <button className="btn-action-iv view-iv" title="Open Vault Folder" onClick={() => handleOpenViewVault(folder)}>
                                                <Eye size={16} />
                                            </button>
                                            <button className="btn-action-iv add-file-iv" title="Add File to Vault" onClick={() => handleOpenAddFileModal(folder)}>
                                                <FileUp size={16} />
                                            </button>
                                            <button className="btn-action-iv delete-iv" title="Delete Folder" onClick={() => handleDeleteVaultFolder(folder.student_id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL 1: ADD INSURANCE VAULT / FOLDER */}
            {isCreateVaultModalOpen && (
                <div className="modal-overlay-iv">
                    <div className="modal-card-iv">
                        <div className="modal-header-iv">
                            <h3>Add Insurance Vault Folder</h3>
                            <button className="close-btn-iv" onClick={() => setIsCreateVaultModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleConfirmCreateVault}>
                            <div className="modal-body-iv">
                                <div className="form-group-iv search-form-group-iv">
                                    <label>Search Student (Name or Student ID)</label>
                                    <input 
                                        type="text"
                                        placeholder="Type student name or ID..."
                                        value={studentSearch}
                                        onChange={(e) => {
                                            setStudentSearch(e.target.value);
                                            setSelectedStudent(null);
                                        }}
                                        required
                                    />
                                    {searchResults.length > 0 && !selectedStudent && (
                                        <ul className="search-dropdown-iv">
                                            {searchResults.map((st) => (
                                                <li 
                                                    key={st.student_id} 
                                                    onClick={() => {
                                                        setSelectedStudent(st);
                                                        setStudentSearch(`${st.first_name} ${st.last_name}`);
                                                        setSearchResults([]);
                                                    }}
                                                >
                                                    <div className="search-item-name-iv">{st.first_name} {st.last_name}</div>
                                                    <div className="search-item-sub-iv">ID: {st.student_id} | {st.program_name} ({st.section || 'N/A'})</div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {selectedStudent && (
                                    <div className="selected-student-card-iv">
                                        <div className="card-row-iv"><UserCheck size={18} color="#0055a5" /> <strong>Student Name:</strong> {selectedStudent.first_name} {selectedStudent.last_name}</div>
                                        <div className="card-row-iv"><strong>Student ID:</strong> {selectedStudent.student_id}</div>
                                        <div className="card-row-iv"><strong>Program:</strong> {selectedStudent.program_name}</div>
                                        <div className="card-row-iv"><strong>Year & Section:</strong> Year {selectedStudent.year_level || 'N/A'} - {selectedStudent.section || 'N/A'}</div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer-iv">
                                <button type="button" className="btn-secondary-iv" onClick={() => setIsCreateVaultModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-iv" disabled={!selectedStudent}>Confirm Vault Folder</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: UPLOAD FILE INTO VAULT */}
            {isAddFileModalOpen && selectedFolder && (
                <div className="modal-overlay-iv">
                    <div className="modal-card-iv">
                        <div className="modal-header-iv">
                            <h3>Upload File to Vault</h3>
                            <button className="close-btn-iv" onClick={() => setIsAddFileModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddFileToVault}>
                            <div className="modal-body-iv">
                                <div className="selected-student-card-iv">
                                    <strong>Vault Folder:</strong> {selectedFolder.student_first_name} {selectedFolder.student_last_name} ({selectedFolder.student_id})
                                </div>

                                <div className="form-group-iv" style={{ marginTop: '14px' }}>
                                    <label>Document Name / Title</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., Insurance Policy, PhilHealth Form" 
                                        value={fileFormData.document_name}
                                        onChange={(e) => setFileFormData({ ...fileFormData, document_name: e.target.value })}
                                        required 
                                    />
                                </div>

                                <div className="form-group-iv">
                                    <label>Select Document File</label>
                                    <input 
                                        type="file" 
                                        onChange={(e) => setFileFormData({ ...fileFormData, file: e.target.files[0] })}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    />
                                </div>

                                <div className="form-group-iv">
                                    <label>Description / Notes</label>
                                    <textarea 
                                        rows="3" 
                                        placeholder="Enter additional remarks or policy numbers..."
                                        value={fileFormData.description_notes}
                                        onChange={(e) => setFileFormData({ ...fileFormData, description_notes: e.target.value })}
                                    ></textarea>
                                </div>
                            </div>
                            <div className="modal-footer-iv">
                                <button type="button" className="btn-secondary-iv" onClick={() => setIsAddFileModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-iv">Upload File</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: VIEW VAULT FOLDER CONTENTS */}
            {isViewModalOpen && selectedFolder && (
                <div className="modal-overlay-iv">
                    <div className="modal-card-iv modal-large-iv">
                        <div className="modal-header-iv">
                            <h3>Vault Contents - {selectedFolder.student_first_name} {selectedFolder.student_last_name}</h3>
                            <button className="close-btn-iv" onClick={() => setIsViewModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body-iv">
                            <div className="vault-info-banner-iv">
                                <div><strong>Student ID:</strong> {selectedFolder.student_id}</div>
                                <div><strong>Program:</strong> {selectedFolder.program_name} ({selectedFolder.section})</div>
                            </div>

                            <div className="vault-files-header-iv">
                                <h4>Files Stored in Vault ({vaultFiles.length})</h4>
                                <button className="btn-add-vault-iv" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => handleOpenAddFileModal(selectedFolder)}>
                                    <FileUp size={14} /> Add File
                                </button>
                            </div>

                            {vaultFiles.length === 0 ? (
                                <div className="vault-empty-iv">No files uploaded in this student's vault folder yet.</div>
                            ) : (
                                <ul className="files-list-iv">
                                    {vaultFiles.map((file) => (
                                        <li key={file.vault_file_id} className="file-item-iv">
                                            <div className="file-info-iv">
                                                <FileText size={20} className="file-icon-iv" />
                                                <div>
                                                    <strong className="file-title-iv">{file.document_name}</strong>
                                                    <p className="file-meta-iv">
                                                        Uploaded: {new Date(file.uploaded_at).toLocaleDateString()} | By: {file.nurse_name || file.managed_by_nurse_id}
                                                    </p>
                                                    {file.description_notes && <p className="file-notes-iv">{file.description_notes}</p>}
                                                </div>
                                            </div>
                                            <div className="file-actions-iv">
                                                {file.file_url && (
                                                    <a href={`http://localhost:3001${file.file_url}`} target="_blank" rel="noopener noreferrer" className="btn-action-iv view-iv" title="View/Download">
                                                        <Download size={16} />
                                                    </a>
                                                )}
                                                <button className="btn-action-iv delete-iv" onClick={() => handleDeleteFile(file.vault_file_id)} title="Delete File">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="modal-footer-iv">
                            <button type="button" className="btn-primary-iv" onClick={() => setIsViewModalOpen(false)}>Close Vault</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InsuranceVault;