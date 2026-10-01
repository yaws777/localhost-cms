import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom'; 
import { 
  Search, 
  Pill, 
  Calendar, 
  History, 
  PlusCircle, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Filter, 
  X, 
  QrCode, 
  Eye, 
  RotateCcw,
  Clock
} from 'lucide-react';
import jsQR from 'jsqr';
import '../../styles/nurse/DispensedMedicine.css';

// Included 'pcs.' to treat piece-counted boxes as volume-backed stock
const MEASURED_UNITS = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];

const convertUnit = (val, fromUnit, toUnit) => {
  if (fromUnit === toUnit || !fromUnit || !toUnit) return val;
  const toBase = (v, u) => {
    switch (u) {
      case 'g': return v * 1000000;
      case 'mg': return v * 1000;
      case 'mcg': return v;
      case 'L': return v * 1000;
      case 'mL': return v;
      case 'pcs.': return v;
      default: return v;
    }
  };
  const fromBase = (v, u) => {
    switch (u) {
      case 'g': return v / 1000000;
      case 'mg': return v / 1000;
      case 'mcg': return v / 1000000;
      case 'L': return v / 1000;
      case 'mL': return v;
      case 'pcs.': return v;
      default: return v;
    }
  };
  return fromBase(toBase(val, fromUnit), toUnit);
};

// Helper function to check if item packaging or unit indicates a box
const isBoxUnit = (item) => {
  if (!item) return false;
  const fields = [
    item.unit,
    item.unit_of_measure,
    item.packaging,
    item.package_type,
    item.strength_unit_of_measure,
    item.dosage_unit,
    item.avg_dosage_consumption_unit_of_measure
  ];
  return fields.some(field => typeof field === 'string' && field.toLowerCase().includes('box'));
};

// Helper function to derive singular dosage form name
const getSingularDosageForm = (item) => {
  if (!item) return 'unit';

  const VALID_DOSAGE_FORMS = {
    'tablet': 'tablet',
    'capsule': 'capsule',
    'sachet': 'sachet',
    'patch': 'patch',
    'syrup': 'syrup',
    'suspension': 'suspension',
    'drops': 'drop',
    'bottle': 'bottle',
    'vial': 'vial',
    'prefilled syringe': 'prefilled syringe',
    'ointment': 'ointment',
    'cream': 'cream',
    'inhaler': 'inhaler',
    'spray': 'spray',
    'gel': 'gel',
    'box': 'box'
  };

  const dosageForm = item.dosage_form || item.form_type;
  const dosageUnit = item.dosage_unit;
  const packaging = item.packaging || item.package_type;
  
  let unit = dosageForm || dosageUnit || packaging || 'unit';
  const unitLower = String(unit).toLowerCase().trim();

  if (VALID_DOSAGE_FORMS[unitLower]) {
    return VALID_DOSAGE_FORMS[unitLower];
  }

  if (unitLower.endsWith('s') && unitLower.length > 1) {
    return unitLower.slice(0, -1);
  }

  return unitLower;
};

// Helper function to format strength per dosage form (e.g. "(80 ml per spray)")
const getStrengthPerDosageForm = (item) => {
  if (!item || item.strength_unit_value === undefined || item.strength_unit_value === null || item.strength_unit_value === '' || !item.strength_unit_of_measure) {
    return '';
  }
  
  const val = item.strength_unit_value;
  const unit = item.strength_unit_of_measure;
  const form = getSingularDosageForm(item);

  return `(${val} ${unit} per ${form})`;
};

// Helper function to get the appropriate dosage form/unit label for stock display
const getStockLabel = (item) => {
  if (!item) return 'unit';
  
  const VALID_DOSAGE_FORMS = {
    'tablet': 'Tablet',
    'capsule': 'Capsule',
    'sachet': 'Sachet',
    'patch': 'Patch',
    'syrup': 'Syrup',
    'suspension': 'Suspension',
    'drops': 'Drops',
    'bottle': 'Bottle',
    'vial': 'Vial',
    'prefilled syringe': 'Prefilled Syringe',
    'ointment': 'Ointment',
    'cream': 'Cream',
    'inhaler': 'Inhaler',
    'spray': 'Spray',
    'gel': 'Gel',
    'box': 'Box'
  };

  const PLURAL_FORMS = {
    'tablet': 'Tablets',
    'capsule': 'Capsules',
    'sachet': 'Sachets',
    'patch': 'Patches',
    'syrup': 'Syrups',
    'suspension': 'Suspensions',
    'drops': 'Drops',
    'bottle': 'Bottles',
    'vial': 'Vials',
    'prefilled syringe': 'Prefilled Syringes',
    'ointment': 'Ointments',
    'cream': 'Creams',
    'inhaler': 'Inhalers',
    'spray': 'Sprays',
    'gel': 'Gels',
    'box': 'Boxes'
  };
  
  const dosageForm = item.dosage_form || item.form_type;
  const dosageUnit = item.dosage_unit;
  const strengthUnit = item.strength_unit_of_measure;
  const avgDosageUnit = item.avg_dosage_consumption_unit_of_measure;
  const packaging = item.packaging || item.package_type;
  
  let unit = dosageForm || dosageUnit || strengthUnit || avgDosageUnit || packaging || 'unit';
  const unitLower = String(unit).toLowerCase().trim();
  const stock = Number(item.current_stock);
  
  if (VALID_DOSAGE_FORMS[unitLower]) {
    // 0 or 1 stock uses singular form, 2 or more uses plural form
    if (stock <= 1) {
      return VALID_DOSAGE_FORMS[unitLower];
    }
    return PLURAL_FORMS[unitLower] || VALID_DOSAGE_FORMS[unitLower] + 's';
  }
  
  if (MEASURED_UNITS.includes(unitLower)) {
    return unitLower;
  }
  
  if (stock >= 2 && !unitLower.endsWith('s') && unitLower !== 'unit') {
    return unit + 's';
  }
  
  return unit;
};

// Helper function to format full current stock display with strength unit per dosage form
const formatCurrentStock = (item) => {
  if (!item) return '0 units';
  const stockUnit = getStockLabel(item);
  const strengthInfo = getStrengthPerDosageForm(item);
  return `${item.current_stock} ${stockUnit}${strengthInfo ? ` ${strengthInfo}` : ''}`;
};

// Stock status helper function
const getStockStatus = (stock, lowThreshold = 10, criticalThreshold = 5) => {
  if (stock <= criticalThreshold) return { label: 'Critical', class: 'critical' };
  if (stock <= lowThreshold) return { label: 'Low Stock', class: 'low' };
  return { label: 'Adequate', class: 'adequate' };
};

const DispensedMedicine = () => {
  const location = useLocation();
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
  
  // QR Code Scanner States & Refs
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [qrError, setQrError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

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

  // Modal States
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // Stop QR Scanner Stream and Frame Loops
  const stopQRScan = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanningQR(false);
    setQrError('');
  }, []);

  // Handle scanned QR result
  const handleScannedCode = useCallback(async (scannedText) => {
    const cleanText = scannedText.trim();
    stopQRScan();
    setSearchStudent(cleanText);

    try {
      const res = await fetch(`http://localhost:3001/api/students/direct?search=${encodeURIComponent(cleanText)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const match = data.find(s => String(s.student_id) === cleanText) || data[0];
          setSelectedStudent(match);
          setSearchStudent(`${match.first_name} ${match.last_name} (${match.student_id})`);
          setStudents([]);
        }
      }
    } catch (err) {
      console.error("Error fetching scanned student:", err);
    }
  }, [stopQRScan]);

  // QR Scanning Continuous Loop via Canvas & jsQR
  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!canvas) return;
      const context = canvas.getContext('2d');
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        handleScannedCode(code.data);
        return;
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [handleScannedCode]);

  // Start Camera for QR Scanning
  const startQRScan = useCallback(async () => {
    setIsScanningQR(true);
    setQrError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        await videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error("Error accessing camera for QR scan:", err);
      setQrError('Unable to access camera. Please verify device permissions.');
    }
  }, [tick]);

  useEffect(() => {
    if (location.state?.openQrScanner) {
      startQRScan();
    }
  }, [location.state, startQRScan]);

  useEffect(() => {
    return () => {
      stopQRScan();
    };
  }, [stopQRScan]);

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

  useEffect(() => {
    fetchInventory();
    fetchHistory();
  }, [fetchInventory, fetchHistory]);

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

  useEffect(() => {
    if (selectedMedicineId && Array.isArray(inventory)) {
      const batches = inventory.filter(b => b.medicine_id === selectedMedicineId && b.current_stock > 0);
      setAvailableBatches(batches);
      setSelectedBatchId('');
      
      const sample = inventory.find(i => i.medicine_id === selectedMedicineId);
      if (sample) {
        const unit = sample.avg_dosage_consumption_unit_of_measure || sample.strength_unit_of_measure || '';
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

  // Date Range Constraint Handlers
  const handleFromDateChange = (e) => {
    const newFromDate = e.target.value;
    setFromDate(newFromDate);

    if (toDate && newFromDate > toDate) {
      setToDate(newFromDate);
    }
  };

  const handleToDateChange = (e) => {
    const newToDate = e.target.value;
    if (fromDate && newToDate < fromDate) {
      setToDate(fromDate);
    } else {
      setToDate(newToDate);
    }
  };

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
      const strengthUnit = selectedBatch.strength_unit_of_measure;

      if (!isMeasuredUnit) {
        if (numericValue > currentStock) {
          setMessage({ 
            text: `Requested quantity (${numericValue}) exceeds available stock (${currentStock}).`, 
            type: 'error' 
          });
          return;
        }
      } else {
        const reqInBatchUnit = convertUnit(numericValue, dosageUnit, strengthUnit);
        const totalAvailableBatchUnit = currentStock > 0 
          ? remainingVol + (currentStock - 1) * strengthVal 
          : 0;

        if (reqInBatchUnit > totalAvailableBatchUnit) {
          const availInDispenseUnit = convertUnit(totalAvailableBatchUnit, strengthUnit, dosageUnit);
          setMessage({ 
            text: `Dosage cannot exceed current available volume/count (${availInDispenseUnit.toFixed(2)} ${dosageUnit}).`, 
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

  // Filter logs specifically for TODAY'S DISPENSED
  const todaysDispensedLogs = useMemo(() => {
    if (!Array.isArray(history)) return [];
    const today = new Date().toLocaleDateString();
    return history.filter(log => {
      if (!log.dispensed_at) return false;
      return new Date(log.dispensed_at).toLocaleDateString() === today;
    });
  }, [history]);

  const activeBatch = inventory.find(b => b.batch_id === selectedBatchId);
  const isMeasured = MEASURED_UNITS.includes(dosageUnit);

  return (
    <div className="dispense-container">
      <header className="dispense-header">
        <div className="header-title-block">
          <h1>Medicine Dispensation Management Panel</h1>
          <p className="header-subtitle">Process student medication dispensing and monitor inventory real-time.</p>
        </div>
        <div className="header-actions">
          <button 
            type="button" 
            className="btn-dispense-log"
            onClick={() => setIsLogModalOpen(true)}
            title="Open Full Dispensed Records Log History"
          >
            <History size={18} />
            <span>Dispense Log</span>
          </button>
        </div>
      </header>

      {message.text && (
        <div className={`alert-banner ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{message.text}</span>
          </div>
          <button className="alert-close-btn" onClick={() => setMessage({ text: '', type: '' })} aria-label="Close message">
            <X size={16} />
          </button>
        </div>
      )}

      {!nurseId && (
        <div className="alert-banner alert-error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>Warning: No active nurse session detected from NurseLayout context.</span>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      {isScanningQR && (
        <div className="modal-overlay">
          <div className="qr-modal-card">
            <button
              type="button"
              className="modal-close-icon"
              onClick={stopQRScan}
              title="Close QR Scanner"
              aria-label="Close QR Scanner"
            >
              <X size={20} />
            </button>
            
            <h3>Scan Student QR Code</h3>
            
            {qrError ? (
              <div className="alert-banner alert-error" style={{ margin: '12px 0' }}>
                <AlertTriangle size={18} />
                <span>{qrError}</span>
              </div>
            ) : (
              <div className="qr-video-wrapper">
                <video ref={videoRef} className="qr-video-element" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
            )}

            <p className="qr-hint-text">
              Position student QR code within camera view to automatically scan ID.
            </p>

            <button type="button" onClick={stopQRScan} className="btn-secondary-action">
              Cancel Scan
            </button>
          </div>
        </div>
      )}

      <div className="dispense-grid">
        {/* Dispense Medicine Form */}
        <div className="card form-section">
          <h2><PlusCircle size={20} className="icon-blue" /> Dispense Medicine Form</h2>
          <form onSubmit={handleFormSubmit}>
            <div className="form-group student-search-container">
              <label htmlFor="student-search">Search Student (Name or ID)</label>
              <div className="search-input-wrapper">
                <div className="input-with-icon">
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
                <button
                  type="button"
                  className="qr-scan-btn"
                  onClick={startQRScan}
                  title="Search student by QR code"
                >
                  <QrCode size={18} />
                  <span>Scan QR</span>
                </button>
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
                {Array.isArray(inventory) && Array.from(
                  new Set(
                    inventory
                      .filter(item => Number(item.current_stock) >= 1)
                      .map(item => item.medicine_id)
                  )
                ).map(medId => {
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
                  const batchIsMeasured = MEASURED_UNITS.includes(batch.strength_unit_of_measure);
                  const stockLabel = formatCurrentStock(batch);

                  const stockInfo = batchIsMeasured
                    ? `Stock: ${stockLabel} | Rem. Vol/Pcs: ${batch.remaining_volume} ${batch.strength_unit_of_measure}`
                    : `Stock: ${stockLabel}`;

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
                <p>
                  <strong>Current Stock:</strong>{' '}
                  <span className={isBoxUnit(activeBatch) ? "stock-box-badge" : ""}>
                    {formatCurrentStock(activeBatch)}
                  </span>
                </p>
                {MEASURED_UNITS.includes(activeBatch.strength_unit_of_measure) && (
                  <p><strong>Remaining Volume / Pieces:</strong> {activeBatch.remaining_volume} {activeBatch.strength_unit_of_measure}</p>
                )}
                <p><strong>Expiration:</strong> {new Date(activeBatch.expiration_date).toLocaleDateString()}</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="dosage-input">
                {isMeasured ? `Dosage Value (${dosageUnit})` : 'Quantity Dispensed'}
              </label>
              <div className="dosage-input-group">
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
                  placeholder="Unit"
                />
              </div>
            </div>

            <div className="form-submit-wrapper">
              <button type="submit" className="btn-submit" disabled={!nurseId}>
                Submit Dispensation
              </button>
            </div>
          </form>
        </div>

        {/* Real-time Inventory Section */}
        <div className="card inventory-section">
          <div className="section-title-row">
            <h2><Pill size={20} className="icon-blue" /> Inventory Batches Real-time</h2>
            <button onClick={fetchInventory} className="btn-icon" title="Refresh Live Data" aria-label="Refresh inventory list">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Current Stock</th>
                  <th>Remaining Vol/Pcs</th>
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
                    const status = getStockStatus(item.current_stock, item.low_stock_level, item.critical_stock_level);
                    const showVolume = MEASURED_UNITS.includes(item.strength_unit_of_measure);
                    const isBox = isBoxUnit(item);

                    return (
                      <tr key={item.batch_id}>
                        <td><strong>{item.medicine_name}</strong></td>
                        <td>
                          <span className={isBox ? "stock-box-badge" : ""}>
                            {formatCurrentStock(item)}
                          </span>
                        </td>
                        <td>{showVolume ? `${item.remaining_volume} ${item.strength_unit_of_measure}` : 'N/A'}</td>
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

      {/* TODAY'S DISPENSED SECTION */}
      <div className="card history-section-wrapper">
        <div className="section-title-row">
          <h2><Clock size={20} className="icon-blue" /> Today's Dispensed</h2>
          <span className="todays-badge">{new Date().toLocaleDateString()}</span>
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
                <th className="action-column">Action</th>
              </tr>
            </thead>
            <tbody>
              {todaysDispensedLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center-empty">
                    No medicine dispensations recorded for today yet.
                  </td>
                </tr>
              ) : (
                todaysDispensedLogs.map((log) => (
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
                    <td className="action-column">
                      <button 
                        type="button" 
                        className="btn-icon-row"
                        onClick={() => setSelectedLogDetail(log)}
                        title="View Dispensation Record Details"
                        aria-label={`View details for transaction ${log.id}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: FULL DISPENSED LOG HISTORY */}
      {isLogModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card log-history-modal">
            <div className="modal-header">
              <div className="modal-header-title">
                <History size={22} className="icon-blue" />
                <h3>Dispensed Records Log History</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-icon"
                onClick={() => setIsLogModalOpen(false)}
                title="Close Log History Modal"
                aria-label="Close Modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Filter Toolbar */}
              <div className="filter-toolbar">
                <div className="filter-item date-range-group">
                  <Calendar size={16} className="filter-icon" />
                  <input 
                    type="date" 
                    value={fromDate} 
                    max={toDate || undefined}
                    onChange={handleFromDateChange} 
                    title="From Date" 
                  />
                  <span className="date-sep">to</span>
                  <input 
                    type="date" 
                    value={toDate} 
                    min={fromDate || undefined}
                    onChange={handleToDateChange} 
                    title="To Date" 
                  />
                </div>

                <div className="filter-item">
                  <input
                    type="text"
                    placeholder="Search student (Name/ID)..."
                    value={filterStudent}
                    onChange={(e) => setFilterStudent(e.target.value)}
                    className="filter-text-input"
                  />
                </div>

                <div className="filter-item">
                  <input
                    type="text"
                    placeholder="Search medicine name..."
                    value={filterMedicine}
                    onChange={(e) => setFilterMedicine(e.target.value)}
                    className="filter-text-input"
                  />
                </div>

                <div className="filter-actions-row">
                  <button onClick={handleApplyFilters} className="btn-filter-apply">
                    <Filter size={14} /> <span>Apply</span>
                  </button>
                  
                  {(fromDate || toDate || filterStudent || filterMedicine) && (
                    <button onClick={handleResetFilters} className="btn-filter-reset">
                      <RotateCcw size={14} /> <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Full Log History Table */}
              <div className="table-responsive modal-table-wrap">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Date / Time Logged</th>
                      <th>Dispensation Type</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Medicine Dispensed</th>
                      <th>Qty./Volume</th>
                      <th className="action-column">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(history) || history.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center-empty">
                          No transaction history logs matched your parameters.
                        </td>
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
                          <td className="action-column">
                            <button 
                              type="button" 
                              className="btn-icon-row"
                              onClick={() => setSelectedLogDetail(log)}
                              title="View Dispensation Record Details"
                              aria-label={`View details for transaction ${log.id}`}
                            >
                              <Eye size={17} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setIsLogModalOpen(false)} 
                className="btn-secondary-action"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISPENSATION DETAIL VIEW */}
      {selectedLogDetail && (
        <div className="modal-overlay">
          <div className="modal-card detail-view-modal">
            <div className="modal-header">
              <h3>Dispensation Transaction Detail</h3>
              <button 
                type="button" 
                className="modal-close-icon"
                onClick={() => setSelectedLogDetail(null)}
                aria-label="Close Details Modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body detail-grid">
              <div className="detail-item">
                <span className="detail-label">Transaction ID:</span>
                <span className="detail-value">#{selectedLogDetail.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date & Time:</span>
                <span className="detail-value">{new Date(selectedLogDetail.dispensed_at).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Student Name:</span>
                <span className="detail-value">{selectedLogDetail.first_name} {selectedLogDetail.last_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Student ID:</span>
                <span className="detail-value"><code>{selectedLogDetail.student_id}</code></span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Medicine Name:</span>
                <span className="detail-value">{selectedLogDetail.medicine_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Dispensed Amount:</span>
                <span className="detail-value">{selectedLogDetail.dosage_consumption_unit_value} {selectedLogDetail.dosage_consumption_unit_of_measure}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Dispensation Type:</span>
                <span className="detail-value">{selectedLogDetail.dispensation_type}</span>
              </div>
              {selectedLogDetail.nurse_name && (
                <div className="detail-item">
                  <span className="detail-label">Dispensed By:</span>
                  <span className="detail-value">{selectedLogDetail.nurse_name}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary-action" 
                onClick={() => setSelectedLogDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispensedMedicine;