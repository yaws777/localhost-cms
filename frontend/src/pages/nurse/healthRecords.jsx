// healthRecords.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RotateCcw, Printer } from 'lucide-react'; 
import stiLogo from '../../assets/sti-logof.png'; 
import '../../styles/nurse/HealthRecords.css'; 

export default function HealthRecord() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [academicPrograms, setAcademicPrograms] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Search and Dropdown Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [programType, setProgramType] = useState('all'); 
    const [selectedProgram, setSelectedProgram] = useState('all');
    const [selectedSection, setSelectedSection] = useState('all');
    const [selectedYear, setSelectedYear] = useState('all');

    // Fetch Academic Programs catalog on mount
    useEffect(() => {
        const fetchPrograms = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/academic-programs');
                const data = await response.json();
                if (data.success) {
                    setAcademicPrograms(data.programs || []);
                }
            } catch (err) {
                console.error("Error fetching academic programs catalog:", err);
            }
        };
        fetchPrograms();
    }, []);

    // Filter dynamic programs based on selected Academic Type
    const filteredProgramOptions = useMemo(() => {
        if (programType === 'all') return academicPrograms;
        return academicPrograms.filter(
            (program) => program.type?.toLowerCase() === programType.toLowerCase()
        );
    }, [academicPrograms, programType]);

    // Normalize selected year if switching to Strand
    useEffect(() => {
        if (programType === 'strand' && (selectedYear === '3' || selectedYear === '4')) {
            setSelectedYear('all');
        }
    }, [programType, selectedYear]);

    // Dynamic Year Options based on Academic Program Type
    const yearOptions = useMemo(() => {
        if (programType === 'strand') {
            return [1, 2];
        }
        return [1, 2, 3, 4];
    }, [programType]);

    // Fetch students and enrich with healthInfo from /api/profile/:studentId
    const fetchStudents = useCallback(async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const queryParams = new URLSearchParams({ 
                search: searchTerm,
                program_type: programType,
                program: selectedProgram,
                section: selectedSection,
                year_level: selectedYear
            }).toString();

            const response = await fetch(`http://localhost:3001/api/health-records/students?${queryParams}`);
            const data = await response.json();

            if (data.success) {
                const rawStudents = data.students || [];

                // Fetch healthInfo per student
                const enrichedStudents = await Promise.all(
                    rawStudents.map(async (student) => {
                        try {
                            const profileRes = await fetch(`http://localhost:3001/api/profile/${student.student_id}`);
                            const profileData = await profileRes.json();

                            let parsedHealth = {};
                            if (profileData.success && profileData.healthInfo) {
                                parsedHealth = { ...profileData.healthInfo };
                            } else {
                                parsedHealth = { ...student };
                            }

                            for (let key in parsedHealth) {
                                if (parsedHealth[key] === 1) parsedHealth[key] = true;
                                if (parsedHealth[key] === 0) parsedHealth[key] = false;
                            }

                            return {
                                ...student,
                                healthInfo: parsedHealth
                            };
                        } catch (err) {
                            return { ...student, healthInfo: student };
                        }
                    })
                );

                setStudents(enrichedStudents);
            } else {
                setErrorMsg(data.message || "Failed to retrieve records.");
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setErrorMsg("Network error loading search system catalog data index.");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, programType, selectedProgram, selectedSection, selectedYear]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    // Client-side filtering fallback
    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            if (programType !== 'all' && student.program_type) {
                if (student.program_type.toLowerCase() !== programType.toLowerCase()) return false;
            }
            if (selectedProgram !== 'all' && student.program_id) {
                if (student.program_id.toLowerCase() !== selectedProgram.toLowerCase()) return false;
            }
            if (selectedSection !== 'all' && student.section) {
                const sec = student.section.toString().toLowerCase();
                const targetSec = selectedSection.toLowerCase();
                if (sec !== targetSec && !sec.endsWith(targetSec)) return false;
            }
            if (selectedYear !== 'all' && student.year_level) {
                if (student.year_level.toString() !== selectedYear.toString()) return false;
            }
            return true;
        });
    }, [students, programType, selectedProgram, selectedSection, selectedYear]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setProgramType('all');
        setSelectedProgram('all');
        setSelectedSection('all');
        setSelectedYear('all');
    };

    // Auto-generates detailed health history string for JSX table and PDF report
    const formatHealthHistory = (student) => {
        if (!student) return 'No Known Conditions';

        const h = student.healthInfo || student;
        const conditions = [];

        if (h.has_allergies) {
            const allergyTypes = [
                h.allergy_food && `Food (${h.allergy_food})`,
                h.allergy_medicine && `Meds (${h.allergy_medicine})`,
                h.allergy_insect_sting && `Sting (${h.allergy_insect_sting})`,
                h.allergy_environmental && `Env (${h.allergy_environmental})`,
                h.allergy_others
            ].filter(Boolean);
            conditions.push(allergyTypes.length > 0 ? `Allergies: ${allergyTypes.join(', ')}` : 'Allergies');
        }

        if (h.has_asthma) {
            conditions.push(h.asthma_triggers ? `Asthma (${h.asthma_triggers})` : 'Asthma');
        }

        if (h.has_other_respiratory) {
            conditions.push(h.other_respiratory_specify ? `Respiratory: ${h.other_respiratory_specify}` : 'Respiratory Issue');
        }

        if (h.has_blood_disorders) {
            const bloodTypes = [
                h.blood_disorder_anemia && 'Anemia',
                h.blood_disorder_leukopenia && 'Leukopenia',
                h.blood_disorder_thrombocytopenia && 'Thrombocytopenia'
            ].filter(Boolean);
            conditions.push(bloodTypes.length > 0 ? `Blood Disorder: ${bloodTypes.join(', ')}` : 'Blood Disorder');
        }

        if (h.has_chicken_pox) conditions.push('Chicken Pox');
        if (h.has_measles) conditions.push('Measles');

        if (h.has_digestive_disorders) {
            const digestiveTypes = [
                h.digestive_ulcer && 'Ulcer',
                h.digestive_appendicitis && 'Appendicitis',
                h.digestive_gastritis && 'Gastritis',
                h.digestive_hemorrhoids && 'Hemorrhoids'
            ].filter(Boolean);
            conditions.push(digestiveTypes.length > 0 ? `Digestive: ${digestiveTypes.join(', ')}` : 'Digestive Disorder');
        }

        if (h.has_heart_problems) {
            conditions.push(h.heart_problems_specify ? `Heart: ${h.heart_problems_specify}` : 'Heart Problem');
        }

        if (h.has_kidney_bladder_problems) {
            conditions.push(h.kidney_bladder_specify ? `Kidney/Bladder: ${h.kidney_bladder_specify}` : 'Kidney/Bladder Problem');
        }

        if (h.has_metabolic_diseases) {
            const metabolic = [
                h.metabolic_hyperglycemia && 'Hyperglycemia',
                h.metabolic_hypoglycemia && 'Hypoglycemia'
            ].filter(Boolean);
            conditions.push(metabolic.length > 0 ? `Metabolic: ${metabolic.join(', ')}` : 'Metabolic Disease');
        }

        if (h.has_muscle_bone_disorder) {
            conditions.push(h.muscle_bone_specify ? `Muscle/Bone: ${h.muscle_bone_specify}` : 'Muscle/Bone Disorder');
        }

        if (h.has_seizure_episode) conditions.push('Seizures');

        if (h.has_surgery) {
            conditions.push(h.surgery_specify ? `Surgery (${h.surgery_specify})` : 'Surgery History');
        }

        if (h.has_vision_problem) {
            conditions.push(h.vision_specify ? `Vision: ${h.vision_specify}` : 'Vision Problem');
        }

        if (h.has_hearing_problem) {
            conditions.push(h.hearing_specify ? `Hearing: ${h.hearing_specify}` : 'Hearing Problem');
        }

        if (h.has_other_condition) {
            conditions.push(h.other_condition_specify || 'Other Condition');
        }

        if (conditions.length > 0) {
            return conditions.join('; ');
        }

        return student.health_history || 'No Known Conditions';
    };

    // Print Preview PDF Export (Matches ManageParentAccount / ManageStudentAccounts / VisitLogConsultation)
    const handleExportPDF = () => {
        const rowsToExport = Array.isArray(filteredStudents) ? filteredStudents : [];

        const printWindow = window.open('', '_blank', 'width=1000,height=750');
        if (!printWindow) {
            alert('Please allow popups to preview and print the report.');
            return;
        }

        const reportDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const tableRowsHtml = rowsToExport.map(student => {
            const stId = student.student_id || 'N/A';
            const lastName = student.last_name || 'N/A';
            const firstName = student.first_name || 'N/A';
            const prog = student.program_id || 'N/A';
            const yearLvl = student.year_level ? `Year ${student.year_level}` : 'N/A';
            const sec = student.section || 'N/A';
            const historyText = formatHealthHistory(student);

            return `
                <tr>
                    <td>${stId}</td>
                    <td><strong>${lastName}</strong></td>
                    <td>${firstName}</td>
                    <td>${prog}</td>
                    <td>${yearLvl}</td>
                    <td>${sec}</td>
                    <td>${historyText}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Student Health Records Report</title>
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
                        <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan.</p>
                    </div>
                </div>

                <div class="meta-info">
                    <span><strong>STUDENT HEALTH RECORDS REPORT</strong></span>
                    <span>Date Generated: ${reportDate} | Total Records: ${rowsToExport.length}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Last Name</th>
                            <th>First Name</th>
                            <th>Program</th>
                            <th>Year Level</th>
                            <th>Section</th>
                            <th>Health History</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="7">No student health records found matching criteria.</td></tr>'}
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

    return (
        <div className="directory-page-wrapper">
            <div className="directory-header-block">
                <h2>Student Health Records</h2>
                <p>Search profiles and review medical information checklist histories.</p>
            </div>

            {/* Search and Filters */}
            <div className="search-filter-panel">
                <div className="search-input-container">
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by student ID, name, or keywords..." 
                        className="main-search-input"
                    />
                </div>

                <div className="dropdown-filter-grid">
                    <div className="filter-group">
                        <label htmlFor="program-type-select">Academic Type</label>
                        <select 
                            id="program-type-select"
                            value={programType} 
                            onChange={(e) => {
                                setProgramType(e.target.value);
                                setSelectedProgram('all');
                            }}
                            className="filter-select"
                        >
                            <option value="all">All Types</option>
                            <option value="course">College (Course)</option>
                            <option value="strand">Senior High (Strand)</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="program-select">Course / Strand</label>
                        <select 
                            id="program-select"
                            value={selectedProgram} 
                            onChange={(e) => setSelectedProgram(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Programs</option>
                            {filteredProgramOptions.map((program) => (
                                <option key={program.program_id} value={program.program_id}>
                                    {program.program_id} - {program.program_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="section-select">Section</label>
                        <select 
                            id="section-select"
                            value={selectedSection} 
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Sections</option>
                            <option value="A">Section A</option>
                            <option value="B">Section B</option>
                            <option value="C">Section C</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="year-select">Year Level</label>
                        <select 
                            id="year-select"
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Year Levels</option>
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>
                                    {programType === 'strand' ? `Grade ${year + 10} (Year ${year})` : `Year ${year}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-action-group">
                        <button 
                            type="button" 
                            onClick={handleResetFilters} 
                            className="btn-reset-filter"
                            title="Reset Filters"
                        >
                            <RotateCcw size={15} />
                            <span>Reset</span>
                        </button>
                    </div>
                </div>
            </div>

            {errorMsg && <div className="error-message">{errorMsg}</div>}

            <div className="directory-card-panel">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Directory Results ({filteredStudents.length})</h3>
                    <button 
                        type="button"
                        onClick={handleExportPDF}
                        disabled={filteredStudents.length === 0}
                        className="btn-export"
                        style={{
                            width: 'auto',
                            minWidth: 'unset',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            cursor: filteredStudents.length === 0 ? 'not-allowed' : 'pointer'
                        }}
                        title="Preview Health Records Report"
                    >
                        <Printer size={15} />
                        <span>export</span>
                    </button>
                </div>

                {loading ? (
                    <div className="status-placeholder">Querying structural schema indices...</div>
                ) : filteredStudents.length === 0 ? (
                    <div className="status-placeholder">No matching student files found.</div>
                ) : (
                    <div className="table-responsive-wrapper">
                        <table className="profile-data-table">
                            <thead>
                                <tr>
                                    <th>Student ID</th>
                                    <th>Last Name</th>
                                    <th>First Name</th>
                                    <th>Program</th>
                                    <th>Year Level</th>
                                    <th>Section</th>
                                    <th>Health History</th>
                                    <th className="action-col">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <tr key={student.student_id}>
                                        <td className="font-semibold">{student.student_id}</td>
                                        <td>{student.last_name}</td>
                                        <td>{student.first_name}</td>
                                        <td>
                                            <span className="program-tag-badge">
                                                {student.program_id}
                                            </span>
                                        </td>
                                        <td>{student.year_level}</td>
                                        <td>{student.section || 'N/A'}</td>
                                        <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                                            {formatHealthHistory(student)}
                                        </td>
                                        <td className="action-col">
                                            <button 
                                                onClick={() => navigate(`/health-records/view/${student.student_id}`)}
                                                className="btn-icon-only"
                                                title="View Profile"
                                                aria-label={`View profile for student ${student.student_id}`}
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}