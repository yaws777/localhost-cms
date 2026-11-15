// insuranceVault.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Search,
    FolderPlus,
    Eye,
    Trash2,
    FileUp,
    FilePlus,
    X,
    Folder,
    FileText,
    FileImage,
    UserCheck,
    Download,
    Printer,
    ShieldCheck,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    AlertTriangle,
    CloudUpload
} from 'lucide-react';

import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/InsuranceVault.css';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/datetime';

const API = 'http://localhost:3001';
const DRAWER_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// "BSIT - 4B"
const classLabel = (r) => {
    const code = r.program_id || r.program_name || 'N/A';
    const yearSection = `${r.year_level || ''}${r.section || ''}`;
    return yearSection ? `${code} - ${yearSection}` : String(code);
};
const programCode = (r) => String(r.program_id || r.program_name || 'N/A');
const fullName = (r) => `${r.student_first_name ?? r.first_name ?? ''} ${r.student_last_name ?? r.last_name ?? ''}`.trim();
const initialsOf = (r) => `${(r.student_first_name ?? r.first_name ?? '').charAt(0)}${(r.student_last_name ?? r.last_name ?? '').charAt(0)}`.toUpperCase();
const nurseOf = (r) => r.nurse_name || r.managed_by_nurse_id || 'N/A';
const localDateKey = (value) => (value ? new Date(value).toLocaleDateString('en-CA') : '');

const relativeDate = (value) => {
    if (!value) return 'N/A';
    const a = new Date(value);
    const b = new Date();
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    const days = Math.round((b - a) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days > 1 && days < 14) return `${days} days ago`;
    return formatDate(new Date(value));
};

const extOf = (urlOrName) => (urlOrName || '').split('?')[0].split('.').pop().toLowerCase();
const absoluteUrl = (fileUrl) => (fileUrl.startsWith('http')
    ? fileUrl
    : `${API}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`);

// Helper: Categorize file extension or MIME type
const getFileTypeCategory = (mimeOrExt) => {
    const val = mimeOrExt?.toLowerCase() || '';
    if (val.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => val.includes(ext))) {
        return 'image';
    }
    if (val.includes('pdf')) {
        return 'pdf';
    }
    if (val.includes('video') || ['mp4', 'webm', 'ogg'].some(ext => val.includes(ext))) {
        return 'video';
    }
    if (val.includes('audio') || ['mp3', 'wav', 'ogg'].some(ext => val.includes(ext))) {
        return 'audio';
    }
    if (val.includes('text') || val.includes('json') || ['txt', 'csv', 'json', 'log'].some(ext => val.includes(ext))) {
        return 'text';
    }
    return 'unknown';
};

const tileClassOf = (ext) => {
    if (ext === 'pdf') return 'pdf-iv';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image-iv';
    if (['doc', 'docx'].includes(ext)) return 'doc-iv';
    return '';
};

const InsuranceVault = () => {
    const { nurseId } = useOutletContext();
    const { showAlert, showConfirm } = useAlert();

    // Main States
    const [vaultFolders, setVaultFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter + sort States
    const [searchTerm, setSearchTerm] = useState('');
    const [programFilter, setProgramFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [emptyOnly, setEmptyOnly] = useState(false);
    const [sort, setSort] = useState({ key: 'updated', dir: 'desc' });

    // Modal / drawer visibility States
    const [isCreateVaultModalOpen, setIsCreateVaultModalOpen] = useState(false);
    const [fileTarget, setFileTarget] = useState(null);
    const [drawerId, setDrawerId] = useState(null);

    // Drawer files
    const [vaultFiles, setVaultFiles] = useState([]);

    // Student Search Modal State
    const [studentSearch, setStudentSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [listOpen, setListOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);

    // File Upload Form State
    const [fileFormData, setFileFormData] = useState({
        document_name: '',
        description_notes: '',
        file: null
    });
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // File Preview Modal State
    const [previewModal, setPreviewModal] = useState({
        isOpen: false,
        title: '',
        url: '',
        content: '',
        fileType: 'unknown',
        isBlob: false
    });

    const drawerRef = useRef(null);
    const drawerCloseRef = useRef(null);

    const drawerFolder = useMemo(
        () => vaultFolders.find(f => f.student_id === drawerId) || null,
        [vaultFolders, drawerId]
    );

    // Fetch Vault Folders List
    const fetchVaultFolders = async () => {
        try {
            const res = await fetch(`${API}/api/insurance-vault`);
            const data = await res.json();
            setVaultFolders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching vaults:", err);
            setVaultFolders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVaultFolders();
    }, []);

    // Fetch Files inside a Student Vault Folder
    const fetchStudentVaultFiles = async (studentId) => {
        try {
            const res = await fetch(`${API}/api/insurance-vault/student/${studentId}/files`);
            const data = await res.json();
            setVaultFiles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching vault files:", err);
            setVaultFiles([]);
        }
    };

    // Derived: filtered + sorted rows, counts
    const programOptions = useMemo(
        () => [...new Set(vaultFolders.map(programCode))].sort(),
        [vaultFolders]
    );
    const totalFiles = useMemo(
        () => vaultFolders.reduce((n, f) => n + Number(f.total_files || 0), 0),
        [vaultFolders]
    );
    const emptyCount = useMemo(
        () => vaultFolders.filter(f => Number(f.total_files || 0) === 0).length,
        [vaultFolders]
    );

    const filteredFolders = useMemo(() => {
        let result = vaultFolders.slice();

        if (searchTerm.trim()) {
            const query = searchTerm.trim().toLowerCase();
            result = result.filter(v =>
                fullName(v).toLowerCase().includes(query) ||
                classLabel(v).toLowerCase().includes(query) ||
                (v.program_name && v.program_name.toLowerCase().includes(query)) ||
                (v.section && v.section.toLowerCase().includes(query)) ||
                (v.year_level && v.year_level.toString().includes(query)) ||
                (v.student_id && v.student_id.toString().toLowerCase().includes(query))
            );
        }
        if (programFilter) {
            result = result.filter(v => programCode(v) === programFilter);
        }
        if (dateFilter) {
            result = result.filter(v => v.last_updated && localDateKey(v.last_updated) === dateFilter);
        }
        if (emptyOnly) {
            result = result.filter(v => Number(v.total_files || 0) === 0);
        }

        const m = sort.dir === 'asc' ? 1 : -1;
        result.sort((a, b) => {
            if (sort.key === 'name') return m * fullName(a).localeCompare(fullName(b));
            if (sort.key === 'files') return m * (Number(a.total_files || 0) - Number(b.total_files || 0));
            return m * ((new Date(a.last_updated || 0)) - (new Date(b.last_updated || 0)));
        });
        return result;
    }, [vaultFolders, searchTerm, programFilter, dateFilter, emptyOnly, sort]);

    const filtersOn = Boolean(searchTerm.trim() || programFilter || dateFilter || emptyOnly);
    const clearFilters = () => {
        setSearchTerm('');
        setProgramFilter('');
        setDateFilter('');
        setEmptyOnly(false);
    };

    const toggleSort = (key) => {
        setSort(prev => (prev.key === key
            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: key === 'name' ? 'asc' : 'desc' }));
    };

    const sortIcon = (key) => {
        if (sort.key !== key) return <ArrowUpDown size={16} aria-hidden="true" />;
        return sort.dir === 'asc' ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />;
    };
    const ariaSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');

    // Drawer: focus in, Esc closes, Tab stays inside, focus returns to the opener
    useEffect(() => {
        if (!drawerId) return undefined;
        const opener = document.activeElement;
        drawerCloseRef.current?.focus();

        const onKey = (e) => {
            // a dialog (form, preview, alert, confirmation) sits above the drawer: it handles the key
            if (document.querySelector('.shared-modal-panel')) return;
            if (e.key === 'Escape') {
                setDrawerId(null);
                return;
            }
            if (e.key !== 'Tab' || !drawerRef.current) return;
            const items = [...drawerRef.current.querySelectorAll(DRAWER_FOCUSABLE)].filter(el => el.offsetParent !== null);
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (!drawerRef.current.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
        };
    }, [drawerId]);

    // Open preview for existing uploaded vault document
    const handlePreviewRemote = (fileUrl, docName) => {
        if (!fileUrl) return;
        const fullUrl = absoluteUrl(fileUrl);
        const category = getFileTypeCategory(extOf(fullUrl));

        setPreviewModal({
            isOpen: true,
            title: docName || 'Insurance File',
            url: fullUrl,
            content: '',
            fileType: category,
            isBlob: false
        });
    };

    // Open preview for local file selected before uploading
    const handlePreviewLocal = () => {
        const file = fileFormData.file;
        if (!file) return;

        const category = getFileTypeCategory(file.type || file.name);

        if (category === 'text') {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewModal({
                    isOpen: true,
                    title: file.name,
                    url: '',
                    content: e.target.result,
                    fileType: 'text',
                    isBlob: false
                });
            };
            reader.readAsText(file);
        } else {
            const objectUrl = URL.createObjectURL(file);
            setPreviewModal({
                isOpen: true,
                title: file.name,
                url: objectUrl,
                content: '',
                fileType: category,
                isBlob: true
            });
        }
    };

    // Close preview modal & release Memory
    const closePreviewModal = () => {
        if (previewModal.isBlob && previewModal.url) {
            URL.revokeObjectURL(previewModal.url);
        }
        setPreviewModal({
            isOpen: false,
            title: '',
            url: '',
            content: '',
            fileType: 'unknown',
            isBlob: false
        });
    };

    // EXPORT REPORT FOR ALL INSURANCE VAULT FOLDERS
    const handleExportAllReport = () => {
        const rowsToExport = filteredFolders.length > 0 ? filteredFolders : vaultFolders;

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            showAlert('Please allow popups to preview and print the report.', 'warning');
            return;
        }

        const reportDate = formatDate(new Date());

        const tableRowsHtml = rowsToExport.map(folder => {
            const lastUpdated = folder.last_updated ? formatDate(new Date(folder.last_updated)) : 'N/A';

            return `
                <tr>
                    <td>${escapeHtml(folder.student_id)}</td>
                    <td><strong>${escapeHtml(fullName(folder))}</strong></td>
                    <td>${escapeHtml(classLabel(folder))}</td>
                    <td>${folder.total_files || 0} File(s)</td>
                    <td>${lastUpdated}</td>
                    <td>${escapeHtml(nurseOf(folder))}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Insurance Vault Summary Report</title>
                <style>
                    body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
                    .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
                    .report-header img { height: 60px; margin-right: 20px; }
                    .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
                    .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 16px; font-weight: 500; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 35px; }
                    th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
                    td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: middle; }
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
                    <span><strong>INSURANCE VAULT REPOSITORY SUMMARY REPORT</strong></span>
                    <span>Date Generated: ${reportDate}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Student Name</th>
                            <th>Program & Section</th>
                            <th>Total Files</th>
                            <th>Last Updated</th>
                            <th>Managed By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="6">No insurance vault folders found.</td></tr>'}
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

    // EXPORT REPORT FOR SPECIFIC STUDENT INSURANCE VAULT
    const handleExportSingleReport = () => {
        if (!drawerFolder) return;

        const printWindow = window.open('', '_blank', 'width=950,height=750');
        if (!printWindow) {
            showAlert('Please allow popups to preview and print the report.', 'warning');
            return;
        }

        const reportDate = formatDate(new Date());

        const tableRowsHtml = vaultFiles.map(file => {
            const uploadedDate = file.uploaded_at ? formatDate(new Date(file.uploaded_at)) : 'N/A';

            return `
                <tr>
                    <td><strong>${escapeHtml(file.document_name || 'Unnamed Document')}</strong></td>
                    <td>${escapeHtml(file.description_notes || 'None')}</td>
                    <td>${uploadedDate}</td>
                    <td>${escapeHtml(nurseOf(file))}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Individual Student Insurance Vault Report - ${escapeHtml(drawerFolder.student_id || 'Student')}</title>
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
                    td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: middle; }
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
                    <span><strong>INDIVIDUAL INSURANCE VAULT REPORT</strong></span>
                    <span>Date Generated: ${reportDate}</span>
                </div>

                <div class="details-card">
                    <div><strong>Student Name:</strong> ${escapeHtml(fullName(drawerFolder))}</div>
                    <div><strong>Student ID:</strong> ${escapeHtml(drawerFolder.student_id || 'N/A')}</div>
                    <div><strong>Program & Section:</strong> ${escapeHtml(classLabel(drawerFolder))}</div>
                    <div><strong>Total Stored Files:</strong> ${vaultFiles.length}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Document Name / Title</th>
                            <th>Description / Notes</th>
                            <th>Date Uploaded</th>
                            <th>Managed By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="4">No documents found in this student vault.</td></tr>'}
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

    // Search Students for Auto-complete
    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (studentSearch.trim().length > 0 && !selectedStudent) {
                try {
                    const res = await fetch(`${API}/api/insurance-vault/search?query=${encodeURIComponent(studentSearch.trim())}`);
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

    const vaultIds = useMemo(() => new Set(vaultFolders.map(f => String(f.student_id))), [vaultFolders]);
    const hasVault = (st) => vaultIds.has(String(st.student_id));

    // first selectable option whenever results change
    useEffect(() => {
        setActiveIdx(searchResults.findIndex(st => !hasVault(st)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchResults, vaultIds]);

    const showList = isCreateVaultModalOpen && listOpen && studentSearch.trim().length > 0 && !selectedStudent;

    const pickStudent = (st) => {
        if (!st || hasVault(st)) return;
        setSelectedStudent(st);
        setStudentSearch(`${st.first_name} ${st.last_name}`);
        setSearchResults([]);
        setListOpen(false);
    };

    const moveActive = (dir) => {
        const n = searchResults.length;
        if (!n) return;
        let i = activeIdx;
        for (let step = 0; step < n; step += 1) {
            i = (i + dir + n) % n;
            if (!hasVault(searchResults[i])) {
                setActiveIdx(i);
                return;
            }
        }
    };

    const handleStudentKeyDown = (e) => {
        if (!showList) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveActive(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveActive(-1);
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            pickStudent(searchResults[activeIdx]);
        } else if (e.key === 'Escape') {
            // close the list first, not the dialog
            e.stopPropagation();
            setListOpen(false);
        }
    };

    // OPEN CREATE VAULT MODAL
    const handleOpenCreateVaultModal = () => {
        setSelectedStudent(null);
        setStudentSearch('');
        setSearchResults([]);
        setListOpen(false);
        setIsCreateVaultModalOpen(true);
    };

    // CONFIRM CREATE VAULT FOLDER
    const handleConfirmCreateVault = async (e) => {
        e.preventDefault();
        if (!selectedStudent) {
            showAlert('Please search and select a student first.', 'warning');
            return;
        }

        try {
            const res = await fetch(`${API}/api/insurance-vault/create-vault`, {
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
                showAlert('Vault folder created.', 'success');
            } else {
                showAlert(result.error || 'Failed to create vault.', 'error');
            }
        } catch (err) {
            console.error("Create vault error:", err);
            showAlert('Failed to create vault.', 'error');
        }
    };

    // OPEN ADD FILE MODAL
    const handleOpenAddFileModal = (folder) => {
        setFileTarget(folder);
        setFileFormData({ document_name: '', description_notes: '', file: null });
        setDragOver(false);
    };

    const takeFile = (file) => {
        if (!file) return;
        setFileFormData(prev => ({
            ...prev,
            file,
            document_name: prev.document_name.trim() ? prev.document_name : file.name.replace(/\.[^.]+$/, '')
        }));
    };

    const removePickedFile = () => {
        setFileFormData(prev => ({ ...prev, file: null }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // UPLOAD FILE INTO VAULT
    const handleAddFileToVault = async (e) => {
        e.preventDefault();
        if (!fileFormData.document_name.trim()) {
            showAlert('Please enter a document name.', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('student_id', fileTarget.student_id);
        formData.append('document_name', fileFormData.document_name.trim());
        formData.append('description_notes', fileFormData.description_notes);
        formData.append('managed_by_nurse_id', nurseId);
        if (fileFormData.file) {
            formData.append('file', fileFormData.file);
        }

        try {
            const res = await fetch(`${API}/api/insurance-vault/add-file`, {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                const studentId = fileTarget.student_id;
                setFileTarget(null);
                fetchVaultFolders();
                if (drawerId === studentId) {
                    fetchStudentVaultFiles(studentId);
                }
                showAlert('File added to the vault.', 'success');
            } else {
                showAlert(result.error || 'Failed to add file.', 'error');
            }
        } catch (err) {
            console.error("Add file error:", err);
            showAlert('Failed to add file.', 'error');
        }
    };

    // VIEW VAULT FOLDER CONTENTS
    const handleOpenViewVault = (folder) => {
        setVaultFiles([]);
        fetchStudentVaultFiles(folder.student_id);
        setDrawerId(folder.student_id);
    };

    // DELETE INDIVIDUAL FILE
    const handleDeleteFile = async (vaultFileId) => {
        const confirmed = await showConfirm('Are you sure you want to delete this file from the vault?', { danger: true, confirmLabel: 'Delete' });
        if (!confirmed) return;
        try {
            const res = await fetch(`${API}/api/insurance-vault/file/${vaultFileId}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (result.success) {
                fetchStudentVaultFiles(drawerId);
                fetchVaultFolders();
                showAlert('File deleted.', 'success');
            } else {
                showAlert(result.error || 'Failed to delete file.', 'error');
            }
        } catch (err) {
            console.error("Delete file error:", err);
            showAlert('Failed to delete file.', 'error');
        }
    };

    // DELETE ENTIRE VAULT FOLDER
    const handleDeleteVaultFolder = async (studentId) => {
        const confirmed = await showConfirm('Are you sure you want to delete this entire insurance vault folder and all its contents?', { danger: true, confirmLabel: 'Delete' });
        if (!confirmed) return;
        try {
            const res = await fetch(`${API}/api/insurance-vault/student/${studentId}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (result.success) {
                if (drawerId === studentId) setDrawerId(null);
                fetchVaultFolders();
                showAlert('Vault folder deleted.', 'success');
            } else {
                showAlert(result.error || 'Failed to delete vault folder.', 'error');
            }
        } catch (err) {
            console.error("Delete vault folder error:", err);
            showAlert('Failed to delete vault folder.', 'error');
        }
    };

    const emptyIsFiltered = vaultFolders.length > 0;

    return (
        <div className="insurance-vault-container-iv">
            {/* Header */}
            <div className="vault-header-iv">
                <div className="vault-title-iv">
                    <div className="vault-title-icon-iv" aria-hidden="true"><ShieldCheck size={26} /></div>
                    <div>
                        <h2>Insurance Vault</h2>
                        <p role="status" aria-live="polite">
                            {vaultFolders.length} folders · {totalFiles} files{filtersOn ? ` · ${filteredFolders.length} shown` : ''}
                        </p>
                    </div>
                </div>
                <div className="vault-header-actions-iv">
                    <button
                        type="button"
                        className="btn-icon-iv ghost-iv"
                        onClick={handleExportAllReport}
                        aria-label="Export report"
                        title="Export report"
                    >
                        <Printer size={20} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="btn-icon-iv primary-iv"
                        onClick={handleOpenCreateVaultModal}
                        aria-label="Add vault folder"
                        title="Add vault folder"
                    >
                        <FolderPlus size={20} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="vault-filter-bar-iv" role="search">
                <div className="field-iv search-box-iv">
                    <Search size={18} aria-hidden="true" />
                    <label htmlFor="vault-search-iv" className="sr-only-iv">Search vault folders</label>
                    <input
                        id="vault-search-iv"
                        className="input-iv"
                        type="search"
                        placeholder="Name, ID, section"
                        autoComplete="off"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="program-filter-iv">
                    <label htmlFor="vault-program-iv" className="sr-only-iv">Program</label>
                    <select
                        id="vault-program-iv"
                        className="select-iv"
                        value={programFilter}
                        onChange={(e) => setProgramFilter(e.target.value)}
                    >
                        <option value="">All programs</option>
                        {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                <div className="date-filter-box-iv">
                    <label htmlFor="vault-date-iv" className="sr-only-iv">Last updated on</label>
                    <input
                        id="vault-date-iv"
                        className="input-iv"
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    />
                </div>

                <div className="segmented-iv" role="group" aria-label="Show">
                    <button type="button" aria-pressed={!emptyOnly} onClick={() => setEmptyOnly(false)}>
                        All <span className="segmented-count-iv">{vaultFolders.length}</span>
                    </button>
                    <button type="button" aria-pressed={emptyOnly} onClick={() => setEmptyOnly(true)}>
                        Empty <span className="segmented-count-iv">{emptyCount}</span>
                    </button>
                </div>

                {filtersOn && (
                    <button
                        type="button"
                        className="btn-icon-iv ghost-iv"
                        onClick={clearFilters}
                        aria-label="Clear filters"
                        title="Clear filters"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                )}

                <div className="sort-select-iv">
                    <label htmlFor="vault-sort-iv" className="sr-only-iv">Sort by</label>
                    <select
                        id="vault-sort-iv"
                        className="select-iv"
                        value={`${sort.key}-${sort.dir}`}
                        onChange={(e) => {
                            const [key, dir] = e.target.value.split('-');
                            setSort({ key, dir });
                        }}
                    >
                        <option value="updated-desc">Newest update</option>
                        <option value="updated-asc">Oldest update</option>
                        <option value="name-asc">Name A to Z</option>
                        <option value="files-desc">Most files</option>
                        <option value="files-asc">Fewest files</option>
                    </select>
                </div>
            </div>

            {/* Vault Folders Table */}
            <div className="vault-table-wrapper-iv">
                {loading ? (
                    <div className="vault-loading-iv" role="status">Loading...</div>
                ) : filteredFolders.length === 0 ? (
                    <div className="vault-empty-iv">
                        <div className="vault-empty-icon-iv" aria-hidden="true"><Folder size={28} /></div>
                        <h3>{emptyIsFiltered ? 'No folders match' : 'No vault folders yet'}</h3>
                        {emptyIsFiltered ? (
                            <button type="button" className="btn-icon-iv primary-iv" onClick={clearFilters} aria-label="Clear filters" title="Clear filters">
                                <X size={20} aria-hidden="true" />
                            </button>
                        ) : (
                            <button type="button" className="btn-icon-iv primary-iv" onClick={handleOpenCreateVaultModal} aria-label="Add vault folder" title="Add vault folder">
                                <FolderPlus size={20} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="vault-table-iv">
                        <thead>
                            <tr>
                                <th scope="col" aria-sort={ariaSort('name')}>
                                    <button type="button" className="sort-btn-iv" onClick={() => toggleSort('name')} title="Sort by student">
                                        Student {sortIcon('name')}
                                    </button>
                                </th>
                                <th scope="col">Program</th>
                                <th scope="col" aria-sort={ariaSort('files')}>
                                    <button type="button" className="sort-btn-iv" onClick={() => toggleSort('files')} title="Sort by files">
                                        Files {sortIcon('files')}
                                    </button>
                                </th>
                                <th scope="col" aria-sort={ariaSort('updated')}>
                                    <button type="button" className="sort-btn-iv" onClick={() => toggleSort('updated')} title="Sort by update">
                                        Updated {sortIcon('updated')}
                                    </button>
                                </th>
                                <th scope="col">Managed by</th>
                                <th scope="col"><span className="sr-only-iv">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFolders.map((folder) => {
                                const count = Number(folder.total_files || 0);
                                const name = fullName(folder);
                                return (
                                    <tr key={folder.student_id}>
                                        <td>
                                            <div className="student-cell-iv">
                                                <div className="avatar-iv" aria-hidden="true">{initialsOf(folder)}</div>
                                                <div>
                                                    <button type="button" className="student-link-iv" onClick={() => handleOpenViewVault(folder)}>
                                                        {name}
                                                    </button>
                                                    <div className="student-id-iv">{folder.student_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Program"><span className="class-iv">{classLabel(folder)}</span></td>
                                        <td data-label="Files">
                                            {count > 0 ? (
                                                <span className="chip-iv blue-iv"><FileText size={14} aria-hidden="true" />{count} {count === 1 ? 'file' : 'files'}</span>
                                            ) : (
                                                <span className="chip-iv warn-iv"><AlertTriangle size={14} aria-hidden="true" />Empty</span>
                                            )}
                                        </td>
                                        <td data-label="Updated">
                                            {folder.last_updated ? (
                                                <time dateTime={new Date(folder.last_updated).toISOString()} title={formatDate(new Date(folder.last_updated))}>
                                                    {relativeDate(folder.last_updated)}
                                                </time>
                                            ) : 'N/A'}
                                        </td>
                                        <td data-label="Managed by" className="muted-iv">{nurseOf(folder)}</td>
                                        <td>
                                            <div className="action-buttons-iv">
                                                <button type="button" className="btn-icon-iv view-iv" aria-label={`Open vault of ${name}`} title="Open vault" onClick={() => handleOpenViewVault(folder)}>
                                                    <Eye size={18} aria-hidden="true" />
                                                </button>
                                                <button type="button" className="btn-icon-iv add-file-iv" aria-label={`Add file for ${name}`} title="Add file" onClick={() => handleOpenAddFileModal(folder)}>
                                                    <FileUp size={18} aria-hidden="true" />
                                                </button>
                                                <button type="button" className="btn-icon-iv delete-iv" aria-label={`Delete vault of ${name}`} title="Delete vault" onClick={() => handleDeleteVaultFolder(folder.student_id)}>
                                                    <Trash2 size={18} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* DRAWER: VAULT CONTENTS */}
            {drawerFolder && (
                <div
                    className="drawer-layer-iv"
                    onClick={(e) => { if (e.target === e.currentTarget) setDrawerId(null); }}
                    role="presentation"
                >
                    <aside ref={drawerRef} className="drawer-iv" role="dialog" aria-modal="true" aria-labelledby="vault-drawer-title-iv">
                        <div className="drawer-header-iv">
                            <h3 id="vault-drawer-title-iv">
                                {fullName(drawerFolder)}
                                <span className="drawer-sub-iv">{drawerFolder.student_id} · {classLabel(drawerFolder)}</span>
                            </h3>
                            <div className="drawer-header-actions-iv">
                                <button type="button" className="btn-icon-iv on-blue-iv" onClick={handleExportSingleReport} aria-label="Export student report" title="Export student report">
                                    <Printer size={20} aria-hidden="true" />
                                </button>
                                <button type="button" ref={drawerCloseRef} className="btn-icon-iv on-blue-iv" onClick={() => setDrawerId(null)} aria-label="Close vault" title="Close">
                                    <X size={20} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        <div className="drawer-body-iv">
                            <dl className="vault-info-banner-iv">
                                <div><dt>Files</dt><dd>{vaultFiles.length}</dd></div>
                                <div><dt>Updated</dt><dd>{drawerFolder.last_updated ? formatDate(new Date(drawerFolder.last_updated)) : 'N/A'}</dd></div>
                                <div><dt>Managed by</dt><dd>{nurseOf(drawerFolder)}</dd></div>
                            </dl>

                            <div className="vault-files-header-iv">
                                <h4>Files</h4>
                                <button type="button" className="btn-icon-iv primary-iv" onClick={() => handleOpenAddFileModal(drawerFolder)} aria-label="Add file" title="Add file">
                                    <FilePlus size={20} aria-hidden="true" />
                                </button>
                            </div>

                            {vaultFiles.length === 0 ? (
                                <div className="vault-empty-iv">
                                    <div className="vault-empty-icon-iv" aria-hidden="true"><Folder size={28} /></div>
                                    <h3>No files</h3>
                                </div>
                            ) : (
                                <ul className="files-list-iv">
                                    {vaultFiles.map((file) => {
                                        const ext = extOf(file.file_url);
                                        const isImage = tileClassOf(ext) === 'image-iv';
                                        return (
                                            <li key={file.vault_file_id} className="file-item-iv">
                                                <div className={`file-tile-iv ${tileClassOf(ext)}`} aria-hidden="true">
                                                    {isImage ? <FileImage size={22} /> : <FileText size={22} />}
                                                </div>
                                                <div className="file-body-iv">
                                                    <strong className="file-title-iv">{file.document_name}</strong>
                                                    <p className="file-meta-iv">
                                                        {ext ? `${ext.toUpperCase()} · ` : ''}{formatDate(new Date(file.uploaded_at))} · {nurseOf(file)}
                                                    </p>
                                                    {file.description_notes && <p className="file-notes-iv">{file.description_notes}</p>}
                                                </div>
                                                <div className="file-actions-iv">
                                                    {file.file_url && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn-icon-iv view-iv"
                                                                onClick={() => handlePreviewRemote(file.file_url, file.document_name)}
                                                                aria-label={`Preview ${file.document_name}`}
                                                                title="Preview"
                                                            >
                                                                <Eye size={18} aria-hidden="true" />
                                                            </button>
                                                            <a
                                                                href={absoluteUrl(file.file_url)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn-icon-iv ghost-iv"
                                                                aria-label={`Download ${file.document_name}`}
                                                                title="Download"
                                                            >
                                                                <Download size={18} aria-hidden="true" />
                                                            </a>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn-icon-iv delete-iv"
                                                        onClick={() => handleDeleteFile(file.vault_file_id)}
                                                        aria-label={`Delete ${file.document_name}`}
                                                        title="Delete file"
                                                    >
                                                        <Trash2 size={18} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            {/* MODAL 1: ADD INSURANCE VAULT / FOLDER */}
            <Modal
                isOpen={isCreateVaultModalOpen}
                onClose={() => setIsCreateVaultModalOpen(false)}
                title="Add vault folder"
                size="md"
                footer={
                    <>
                        <button type="button" className="shared-btn shared-btn-secondary" onClick={() => setIsCreateVaultModalOpen(false)}>Cancel</button>
                        <button type="submit" form="vault-create-form-iv" className="shared-btn shared-btn-primary" disabled={!selectedStudent}>Create</button>
                    </>
                }
            >
                <form id="vault-create-form-iv" onSubmit={handleConfirmCreateVault}>
                    <div className="form-group-iv">
                        <label htmlFor="vault-student-iv">Student</label>
                        <div className="combo-iv">
                            <div className="field-iv">
                                <Search size={18} aria-hidden="true" />
                                <input
                                    id="vault-student-iv"
                                    className="input-iv"
                                    type="text"
                                    role="combobox"
                                    aria-expanded={showList}
                                    aria-controls="vault-student-list-iv"
                                    aria-autocomplete="list"
                                    aria-activedescendant={showList && activeIdx >= 0 ? `vault-opt-${activeIdx}-iv` : undefined}
                                    placeholder="Name or ID"
                                    autoComplete="off"
                                    value={studentSearch}
                                    onChange={(e) => {
                                        setStudentSearch(e.target.value);
                                        setSelectedStudent(null);
                                        setListOpen(true);
                                    }}
                                    onKeyDown={handleStudentKeyDown}
                                    required
                                />
                            </div>
                            {showList && (
                                <ul className="search-dropdown-iv" id="vault-student-list-iv" role="listbox" aria-label="Students">
                                    {searchResults.length === 0 ? (
                                        <li className="search-none-iv" role="option" aria-disabled="true" aria-selected="false">No student found</li>
                                    ) : searchResults.map((st, i) => {
                                        const taken = hasVault(st);
                                        return (
                                            <li
                                                key={st.student_id}
                                                id={`vault-opt-${i}-iv`}
                                                role="option"
                                                aria-selected={i === activeIdx}
                                                aria-disabled={taken || undefined}
                                                className="search-option-iv"
                                                onMouseDown={(e) => { e.preventDefault(); pickStudent(st); }}
                                            >
                                                <div>
                                                    {st.first_name} {st.last_name}
                                                    <span className="search-item-sub-iv">{st.student_id} · {classLabel(st)}</span>
                                                </div>
                                                {taken && <span className="chip-iv ok-iv">Has vault</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>

                    {selectedStudent && (
                        <div className="selected-student-card-iv">
                            <UserCheck size={22} aria-hidden="true" />
                            <div>
                                <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong>
                                <span>{selectedStudent.student_id} · {classLabel(selectedStudent)}</span>
                            </div>
                        </div>
                    )}
                </form>
            </Modal>

            {/* MODAL 2: UPLOAD FILE INTO VAULT */}
            <Modal
                isOpen={Boolean(fileTarget)}
                onClose={() => setFileTarget(null)}
                title="Add file"
                size="md"
                footer={
                    <>
                        <button type="button" className="shared-btn shared-btn-secondary" onClick={() => setFileTarget(null)}>Cancel</button>
                        <button type="submit" form="vault-file-form-iv" className="shared-btn shared-btn-primary">Upload</button>
                    </>
                }
            >
                {fileTarget && (
                    <form id="vault-file-form-iv" onSubmit={handleAddFileToVault}>
                        <p className="student-id-iv" style={{ marginBottom: '1rem' }}>
                            {fullName(fileTarget)} · {fileTarget.student_id}
                        </p>

                        <div className="form-group-iv">
                            <label htmlFor="vault-doc-name-iv">Document name</label>
                            <input
                                id="vault-doc-name-iv"
                                className="input-iv"
                                type="text"
                                placeholder="Insurance policy"
                                value={fileFormData.document_name}
                                onChange={(e) => setFileFormData({ ...fileFormData, document_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group-iv">
                            <span className="form-label-iv">File</span>
                            <label
                                htmlFor="vault-file-input-iv"
                                className={`dropzone-iv${dragOver ? ' over-iv' : ''}`}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    takeFile(e.dataTransfer.files[0]);
                                }}
                            >
                                <CloudUpload size={28} aria-hidden="true" />
                                <strong>Choose a file</strong>
                                <span>or drop it here</span>
                            </label>
                            <input
                                id="vault-file-input-iv"
                                ref={fileInputRef}
                                className="sr-only-iv"
                                type="file"
                                tabIndex={-1}
                                onChange={(e) => takeFile(e.target.files[0])}
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.mp4,.mp3,.txt"
                            />
                            {fileFormData.file && (
                                <div className="picked-file-iv">
                                    <div className={`file-tile-iv ${tileClassOf(extOf(fileFormData.file.name))}`} aria-hidden="true">
                                        {tileClassOf(extOf(fileFormData.file.name)) === 'image-iv' ? <FileImage size={22} /> : <FileText size={22} />}
                                    </div>
                                    <div className="picked-file-text-iv">
                                        <b>{fileFormData.file.name}</b>
                                        <span>{extOf(fileFormData.file.name).toUpperCase()} · {Math.max(1, Math.round(fileFormData.file.size / 1024))} KB</span>
                                    </div>
                                    <button type="button" className="btn-icon-iv view-iv" onClick={handlePreviewLocal} aria-label="Preview file" title="Preview">
                                        <Eye size={18} aria-hidden="true" />
                                    </button>
                                    <button type="button" className="btn-icon-iv ghost-iv" onClick={removePickedFile} aria-label="Remove file" title="Remove file">
                                        <X size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-group-iv">
                            <label htmlFor="vault-doc-notes-iv">Notes</label>
                            <textarea
                                id="vault-doc-notes-iv"
                                className="textarea-iv"
                                rows="3"
                                placeholder="Policy number, remarks"
                                value={fileFormData.description_notes}
                                onChange={(e) => setFileFormData({ ...fileFormData, description_notes: e.target.value })}
                            ></textarea>
                        </div>
                    </form>
                )}
            </Modal>

            {/* MODAL 3: FILE PREVIEW */}
            <Modal
                isOpen={previewModal.isOpen}
                onClose={closePreviewModal}
                title={previewModal.title}
                size="lg"
            >
                <div className="preview-body-iv">
                    {previewModal.fileType === 'image' && (
                        <img src={previewModal.url} alt={previewModal.title} className="preview-media-img-iv" />
                    )}

                    {previewModal.fileType === 'pdf' && (
                        <iframe src={previewModal.url} title={previewModal.title} className="preview-media-iframe-iv" />
                    )}

                    {previewModal.fileType === 'video' && (
                        <video src={previewModal.url} controls className="preview-media-video-iv" />
                    )}

                    {previewModal.fileType === 'audio' && (
                        <audio src={previewModal.url} controls className="preview-media-audio-iv" />
                    )}

                    {previewModal.fileType === 'text' && (
                        <pre className="preview-media-text-iv">
                            <code>{previewModal.content}</code>
                        </pre>
                    )}

                    {previewModal.fileType === 'unknown' && (
                        <div className="preview-unsupported-iv">
                            <FileText size={32} aria-hidden="true" />
                            <p>No preview</p>
                            {previewModal.url && (
                                <a
                                    href={previewModal.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-icon-iv primary-iv"
                                    aria-label="Download file"
                                    title="Download"
                                >
                                    <Download size={20} aria-hidden="true" />
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default InsuranceVault;
