import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RotateCcw, Download } from 'lucide-react'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
                const response = await fetch('https://localhost-cms.onrender.com/api/academic-programs');
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

    // Fetch students and enrich with healthInfo from /api/profile/:studentId (exact pattern from healthRecordProfile.jsx)
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

            const response = await fetch(`https://localhost-cms.onrender.com/api/health-records/students?${queryParams}`);
            const data = await response.json();

            if (data.success) {
                const rawStudents = data.students || [];

                // Fetch healthInfo per student identical to healthRecordProfile.jsx
                const enrichedStudents = await Promise.all(
                    rawStudents.map(async (student) => {
                        try {
                            const profileRes = await fetch(`https://localhost-cms.onrender.com/api/profile/${student.student_id}`);
                            const profileData = await profileRes.json();

                            let parsedHealth = {};
                            if (profileData.success && profileData.healthInfo) {
                                parsedHealth = { ...profileData.healthInfo };
                            } else {
                                parsedHealth = { ...student };
                            }

                            // Convert 1 -> true and 0 -> false (exact logic from healthRecordProfile.jsx)
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

    // Auto-generates detailed health history string for JSX table and PDF report using healthInfo
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

    // PDF Generation & Window Preview Function
    const handleExportPDF = () => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const buildPdf = (imgData = null) => {
            if (imgData) {
                doc.addImage(imgData, 'PNG', 14, 10, 22, 22);
            }

            const headerX = imgData ? 40 : 14;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text("STI College Baliuag", headerX, 16);

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text("Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan.", headerX, 22);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text("STUDENT HEALTH RECORDS REPORT", headerX, 29);

            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(14, 34, 283, 34);

            const tableColumns = ["Student ID", "Full Name", "Program", "Section", "Year Level", "Health History"];

            const tableRows = filteredStudents.map((student) => [
                student.student_id || 'N/A',
                `${student.last_name || ''}, ${student.first_name || ''}`,
                student.program_id || 'N/A',
                student.section || 'N/A',
                student.year_level ? `Year ${student.year_level}` : 'N/A',
                formatHealthHistory(student)
            ]);

            autoTable(doc, {
                startY: 38,
                head: [tableColumns],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [0, 86, 179],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 9
                },
                bodyStyles: {
                    fontSize: 8.5,
                    textColor: [30, 30, 30]
                },
                columnStyles: {
                    0: { cellWidth: 32 },
                    1: { cellWidth: 50 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 25 },
                    4: { cellWidth: 25 },
                    5: { cellWidth: 'auto' }
                },
                alternateRowStyles: {
                    fillColor: [248, 249, 250]
                },
                margin: { left: 14, right: 14 }
            });

            const finalY = doc.lastAutoTable.finalY || 120;
            const pageHeight = doc.internal.pageSize.height;
            let footerY = finalY + 20;

            if (footerY + 25 > pageHeight) {
                doc.addPage();
                footerY = 30;
            }

            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text("Prepared by:", 14, footerY);

            doc.setFont('helvetica', 'bold');
            doc.text("Marilou H. Balarao", 14, footerY + 10);

            doc.setFont('helvetica', 'normal');
            doc.text("School Nurse", 14, footerY + 15);

            const pdfBlobUrl = doc.output('bloburl');
            window.open(pdfBlobUrl, '_blank');
        };

        const logoImg = document.getElementById('sti-logo-export');
        if (logoImg && logoImg.complete && logoImg.naturalWidth !== 0) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = logoImg.naturalWidth;
                canvas.height = logoImg.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(logoImg, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                buildPdf(dataURL);
            } catch (err) {
                buildPdf(null);
            }
        } else {
            buildPdf(null);
        }
    };

    return (
        <div className="directory-page-wrapper">
            <img 
                id="sti-logo-export" 
                src={stiLogo} 
                alt="STI Logo" 
                style={{ display: 'none' }} 
            />

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
                        title="Preview Health Records PDF"
                    >
                        <Download size={15} />
                        <span>Export</span>
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