import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, RotateCcw } from 'lucide-react'; 
import '../../styles/nurse/HealthRecords.css'; 

export default function HealthRecord() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Search and Dropdown Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [programType, setProgramType] = useState('all'); // 'all' | 'course' | 'strand'
    const [selectedProgram, setSelectedProgram] = useState('all'); // e.g. BSIT, BSHM, STEM, TVL
    const [selectedSection, setSelectedSection] = useState('all'); // 'all' | 'A' | 'B' | 'C'
    const [selectedYear, setSelectedYear] = useState('all');

    // Automatically normalize selected year if switching to Strand (max 2 years)
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
        return [1, 2, 3, 4]; // Default & Course
    }, [programType]);

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
                setStudents(data.students || []);
            } else {
                setErrorMsg(data.message || "Failed to retrieve records.");
            }
        } catch (err) {
            setErrorMsg("Network error loading search system catalog data index.");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, programType, selectedProgram, selectedSection, selectedYear]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    // Client-side filtering fallback to ensure full UI integrity
    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            // Filter by Program Type
            if (programType !== 'all' && student.program_type) {
                if (student.program_type.toLowerCase() !== programType.toLowerCase()) return false;
            }
            // Filter by Course / Strand
            if (selectedProgram !== 'all' && student.program_id) {
                if (student.program_id.toLowerCase() !== selectedProgram.toLowerCase()) return false;
            }
            // Filter by Section (A, B, C)
            if (selectedSection !== 'all' && student.section) {
                const sec = student.section.toString().toLowerCase();
                const targetSec = selectedSection.toLowerCase();
                if (sec !== targetSec && !sec.endsWith(targetSec)) return false;
            }
            // Filter by Year Level
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

    return (
        <div className="directory-page-wrapper">
            <div className="directory-header-block">
                <h2>Student Health Records</h2>
                <p>Search profiles and review medical information checklist histories.</p>
            </div>

            {/* Organized Search & Dropdown Filter Layout */}
            <div className="search-filter-panel">
                <div className="search-input-container">
                    <Search className="search-icon-inside" size={18} />
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
                            onChange={(e) => setProgramType(e.target.value)}
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
                            {programType !== 'strand' && (
                                <>
                                    <option value="BSIT">BSIT</option>
                                    <option value="BSCS">BSCS</option>
                                    <option value="BSHM">BSHM</option>
                                    <option value="BSTM">BSTM</option>
                                    <option value="BSBA">BSBA</option>
                                </>
                            )}
                            {programType !== 'course' && (
                                <>
                                    <option value="STEM">STEM</option>
                                    <option value="ABM">ABM</option>
                                    <option value="HUMSS">HUMSS</option>
                                    <option value="TVL">TVL</option>
                                </>
                            )}
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
                <div className="panel-header">
                    <h3>Directory Results ({filteredStudents.length})</h3>
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