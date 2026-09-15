import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom'; 
import { Search, Pill, Calendar, History, PlusCircle, RefreshCw, CheckCircle, AlertTriangle, Filter, X } from 'lucide-react';
import '../../styles/nurse/DispensedMedicine.css';

const MEASURED_UNITS = ['mg', 'g', 'mcg', 'mL', 'L'];

const DispensedMedicine = () => {
  const outletContext = useOutletContext() || {};
  const nurseId = typeof outletContext === 'string' || typeof outletContext === 'number'
    ? outletContext
    : outletContext.nurseId ||
      outletContext.nurse_id ||
      outletContext.nurse?.nurse_id ||
      outletContext.nurse?.id ||
      outletContext.user?.nurse_id ||
      outletContext.user?.id ||
      outletContext.user?.nurseId;

  // Form Input States
  const [searchStudent, setSearchStudent] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [inventory, setInventory] = useState([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  
  // Dosage Consumption States
  const [dosageValue, setDosageValue] = useState('');
  const [dosageUnit, setDosageUnit] = useState('');

  // Logs & Multi-Parameter Filter States
  const [history, setHistory] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterMedicine, setFilterMedicine] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/inventory/batches');
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error updating inventory panel:", err);
      setInventory([]);
    }
  }, []);

  const fetchHistory = useCallback(async (customParams = {}) => {
    try {
      const fDate = customParams.fromDate !== undefined ? customParams.fromDate : fromDate;
      const tDate = customParams.toDate !== undefined ? customParams.toDate : toDate;
      const st = customParams.filterStudent !== undefined ? customParams.filterStudent : filterStudent;
      const med = customParams.filterMedicine !== undefined ? customParams.filterMedicine : filterMedicine;

      const params = new URLSearchParams();
      if (fDate) params.append('fromDate', fDate);
      if (tDate) params.append('toDate', tDate);
      if (st) params.append('student', st);
      if (med) params.append('medicine', med);

      const res = await fetch(`http://localhost:3001/api/dispensation/history?${params.toString()}`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error updating dispensation history:", err);
      setHistory([]);
    }
  }, [fromDate, toDate, filterStudent, filterMedicine]);

  // Initial Data Load
  useEffect(() => {
    fetchInventory();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Student Search Lookup Effect
  useEffect(() => {
    if (searchStudent.trim().length > 1 && !selectedStudent) {
      fetch(`http://localhost:3001/api/students/direct?search=${encodeURIComponent(searchStudent)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => setStudents(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error("Error fetching students:", err);
          setStudents([]);
        });
    } else if (searchStudent.trim().length <= 1) {
      setStudents([]);
    }
  }, [searchStudent, selectedStudent]);

  // Update batch choices & default dosage attributes on medicine selection
  useEffect(() => {
    if (selectedMedicineId && Array.isArray(inventory)) {
      const batches = inventory.filter(b => b.medicine_id === selectedMedicineId && b.current_stock > 0);
      setAvailableBatches(batches);
      setSelectedBatchId('');
      
      const sample = inventory.find(i => i.medicine_id === selectedMedicineId);
      if (sample) {
        const unit = sample.avg_dosage_consumption_unit_of_measure || '';
        const rawVal = sample.avg_dosage_consumption_value || '';
        const isMeasuredUnit = MEASURED_UNITS.includes(unit);

        if (!isMeasuredUnit && rawVal) {
          setDosageValue(Math.max(1, Math.round(parseFloat(rawVal))).toString());
        } else {
          setDosageValue((rawVal && parseFloat(rawVal) > 0) ? rawVal : '1');
        }
        setDosageUnit(unit);
      }
    } else {
      setAvailableBatches([]);
      setSelectedBatchId('');
      setDosageValue('');
      setDosageUnit('');
    }
  }, [selectedMedicineId, inventory]);

  const handleApplyFilters = () => {
    fetchHistory();
  };

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setFilterStudent('');
    setFilterMedicine('');
    fetchHistory({ fromDate: '', toDate: '', filterStudent: '', filterMedicine: '' });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!nurseId) {
      setMessage({ 
        text: 'Nurse authentication missing from NurseLayout context. Please re-login.', 
        type: 'error' 
      });
      return;
    }

    if (!selectedStudent) {
      setMessage({ text: 'Please search and select a valid student from the dropdown list.', type: 'error' });
      return;
    }
    if (!selectedBatchId) {
      setMessage({ text: 'Please select a valid medicine batch expiration date.', type: 'error' });
      return;
    }

    const selectedBatch = inventory.find(b => b.batch_id === selectedBatchId);
    const numericValue = parseFloat(dosageValue);
    const isMeasuredUnit = MEASURED_UNITS.includes(dosageUnit);

    if (isNaN(numericValue) || numericValue <= 0) {
      setMessage({ text: 'Dosage value must be greater than 0.', type: 'error' });
      return;
    }

    if (!isMeasuredUnit && !Number.isInteger(numericValue)) {
      setMessage({ 
        text: 'Quantity dispensed for discrete items (e.g. tablets, capsules) must be a whole integer.', 
        type: 'error' 
      });
      return;
    }

    if (selectedBatch) {
      const currentStock = parseInt(selectedBatch.current_stock, 10);
      const strengthVal = parseFloat(selectedBatch.strength_unit_value);
      const remainingVol = parseFloat(selectedBatch.remaining_volume);

      if (!isMeasuredUnit) {
        if (numericValue > currentStock) {
          setMessage({ 
            text: `Requested quantity (${numericValue}) exceeds available stock (${currentStock}).`, 
            type: 'error' 
          });
          return;
        }
      } else {
        const totalAvailableVolume = currentStock > 0 
          ? remainingVol + (currentStock - 1) * strengthVal 
          : 0;

        if (numericValue > totalAvailableVolume) {
          setMessage({ 
            text: `Dosage cannot exceed current available volume (${totalAvailableVolume} ${dosageUnit}).`, 
            type: 'error' 
          });
          return;
        }
      }
    }

    try {
      const response = await fetch('http://localhost:3001/api/dispensation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.student_id,
          nurse_id: nurseId,
          batch_id: selectedBatchId,
          dosage_consumption_unit_value: numericValue,
          dosage_consumption_unit_of_measure: dosageUnit
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: 'Medicine successfully dispensed and logged!', type: 'success' });
        
        setSelectedStudent(null);
        setSearchStudent('');
        setSelectedMedicineId('');
        setSelectedBatchId('');
        setDosageValue('');
        setDosageUnit('');
        
        fetchInventory();
        fetchHistory();
      } else {
        setMessage({ text: result.error || 'Transaction rejected by server.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'A communications error occurred with the backend system.', type: 'error' });
    }
  };

  const getBatchStatus = (stock, expDate) => {
    const today = new Date();
    const expiration = new Date(expDate);
    expiration.setHours(23, 59, 59, 999);
    if (expiration < today) return { label: 'Expired', class: 'status-expired' };
    if (stock === 0) return { label: 'Out of Stock', class: 'status-out' };
    if (stock <= 10) return { label: 'Low Stock', class: 'status-low' };
    return { label: 'Available', class: 'status-ok' };
  };

  const activeBatch = inventory.find(b => b.batch_id === selectedBatchId);
  const isMeasured = MEASURED_UNITS.includes(dosageUnit);

  return (
    <div className="dispense-container">
      <header className="dispense-header">
        <h1>Medicine Dispensation Management Panel</h1>
      </header>

      {message.text && (
        <div className={`alert-banner ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {!nurseId && (
        <div className="alert-banner alert-error">
          <AlertTriangle size={18} />
          <span>Warning: No active nurse session detected from NurseLayout context.</span>
        </div>
      )}

      <div className="dispense-grid">
        <div className="card form-section">
          <h2><PlusCircle size={20} className="icon-blue" /> Dispense Medicine Form</h2>
          <form onSubmit={handleFormSubmit}>
            <div className="form-group student-search-container">
              <label htmlFor="student-search">Search Student (Name or ID)</label>
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  id="student-search"
                  type="text"
                  placeholder="Type student first name, last name, or ID..."
                  value={searchStudent}
                  onChange={(e) => {
                    setSearchStudent(e.target.value);
                    if (selectedStudent) setSelectedStudent(null);
                  }}
                  autoComplete="off"
                  required
                />
              </div>
              
              {searchStudent.trim().length > 1 && !selectedStudent && (
                <ul className="search-dropdown">
                  {Array.isArray(students) && students.length > 0 ? (
                    students.map((student) => (
                      <li 
                        key={student.student_id} 
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchStudent(`${student.first_name} ${student.last_name} (${student.student_id})`);
                          setStudents([]);
                        }}
                        className="dropdown-item"
                      >
                        <div className="student-info-row">
                          <span className="student-name">{student.first_name} {student.last_name}</span>
                          <span className="student-id-badge">ID: {student.student_id}</span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="dropdown-no-results">No students found matching query</li>
                  )}
                </ul>
              )}

              {selectedStudent && (
                <div className="selection-badge animate-fade-in">
                  <div className="badge-content">
                    <span>Selected: <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong></span>
                    <code className="badge-id">{selectedStudent.student_id}</code>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="medicine-select">Select Medicine</label>
              <select 
                id="medicine-select"
                value={selectedMedicineId} 
                onChange={(e) => setSelectedMedicineId(e.target.value)}
                required
              >
                <option value="">-- Choose Medicine --</option>
                {Array.isArray(inventory) && Array.from(new Set(inventory.map(i => i.medicine_id))).map(medId => {
                  const med = inventory.find(i => i.medicine_id === medId);
                  return <option key={medId} value={medId}>{med?.medicine_name}</option>;
                })}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="batch-select">Available Expiration Date</label>
              <select
                id="batch-select"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={!selectedMedicineId}
                required
              >
                <option value="">-- Choose Expiration Date --</option>
                {availableBatches.map((batch) => {
                  const batchIsMeasured = MEASURED_UNITS.includes(batch.avg_dosage_consumption_unit_of_measure);
                  const stockInfo = batchIsMeasured
                    ? `Stock: ${batch.current_stock} | Rem. Vol: ${batch.remaining_volume} ${batch.avg_dosage_consumption_unit_of_measure}`
                    : `Stock: ${batch.current_stock}`;
                  return (
                    <option key={batch.batch_id} value={batch.batch_id}>
                      {new Date(batch.expiration_date).toLocaleDateString()} ({stockInfo})
                    </option>
                  );
                })}
              </select>
            </div>

            {activeBatch && (
              <div className="batch-details-summary">
                <p><strong>Current Stock:</strong> {activeBatch.current_stock}</p>
                {isMeasured && (
                  <p><strong>Remaining Volume:</strong> {activeBatch.remaining_volume} {activeBatch.avg_dosage_consumption_unit_of_measure}</p>
                )}
                <p><strong>Expiration:</strong> {new Date(activeBatch.expiration_date).toLocaleDateString()}</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="dosage-input">
                {isMeasured ? `Dosage Value (${dosageUnit})` : 'Quantity Dispensed'}
              </label>
              <div className="dosage-input-group" style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="dosage-input"
                  type="number"
                  step={isMeasured ? "any" : "1"}
                  min={isMeasured ? "0.01" : "1"}
                  placeholder={isMeasured ? "0.00" : "1"}
                  value={dosageValue}
                  onKeyDown={(e) => {
                    if (!isMeasured && (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === '+')) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!isMeasured && val.includes('.')) {
                      setDosageValue(val.split('.')[0]);
                    } else {
                      setDosageValue(val);
                    }
                  }}
                  required
                />
                <input 
                  type="text" 
                  value={dosageUnit} 
                  readOnly 
                  className="unit-readonly-input" 
                  style={{ width: '120px', backgroundColor: '#f0f0f0', textAlign: 'center' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={!nurseId}>Submit Dispensation</button>
          </form>
        </div>

        <div className="card inventory-section">
          <div className="section-title-row">
            <h2><Pill size={20} className="icon-blue" /> Inventory Batches Real-time</h2>
            <button onClick={fetchInventory} className="btn-icon" title="Refresh Live Data"><RefreshCw size={16} /></button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Current Stock</th>
                  <th>Remaining Volume</th>
                  <th>Expiration Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!Array.isArray(inventory) || inventory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center-empty">No medicine items found in inventory.</td>
                  </tr>
                ) : (
                  inventory.map((item) => {
                    const status = getBatchStatus(item.current_stock, item.expiration_date);
                    const showVolume = MEASURED_UNITS.includes(item.avg_dosage_consumption_unit_of_measure);
                    return (
                      <tr key={item.batch_id}>
                        <td><strong>{item.medicine_name}</strong></td>
                        <td>{item.current_stock} units</td>
                        <td>{showVolume ? `${item.remaining_volume} ${item.avg_dosage_consumption_unit_of_measure}` : 'N/A'}</td>
                        <td>{new Date(item.expiration_date).toLocaleDateString()}</td>
                        <td><span className={`status-tag ${status.class}`}>{status.label}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card history-section-wrapper" style={{ marginTop: '20px' }}>
        <div className="section-title-row">
          <h2><History size={20} className="icon-blue" /> Dispensed Records Log History</h2>
        </div>

        <div className="filter-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={16} />
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="From Date" />
            <span>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="To Date" />
          </div>

          <input
            type="text"
            placeholder="Search student (Name/ID)..."
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />

          <input
            type="text"
            placeholder="Search medicine name..."
            value={filterMedicine}
            onChange={(e) => setFilterMedicine(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />

          <button onClick={handleApplyFilters} className="btn-submit" style={{ padding: '6px 14px', width: 'auto' }}>
            <Filter size={14} style={{ marginRight: '4px' }} /> Apply
          </button>
          
          {(fromDate || toDate || filterStudent || filterMedicine) && (
            <button onClick={handleResetFilters} style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
        
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Time Logged</th>
                <th>Dispensation Type</th>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Medicine Dispensed</th>
                <th>Qty./Volume</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(history) || history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center-empty">No transaction history logs matched your parameters.</td>
                </tr>
              ) : (
                history.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.dispensed_at).toLocaleString()}</td>
                    <td>
                      <span className={`status-tag ${log.dispensation_type === 'Direct Dispensation' ? 'status-ok' : 'status-low'}`}>
                        {log.dispensation_type}
                      </span>
                    </td>
                    <td><code>{log.student_id}</code></td>
                    <td>{log.first_name} {log.last_name}</td>
                    <td>{log.medicine_name}</td>
                    <td><strong>{log.dosage_consumption_unit_value} {log.dosage_consumption_unit_of_measure}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DispensedMedicine;