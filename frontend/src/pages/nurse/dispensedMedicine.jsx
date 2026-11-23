// dispensedMedicine.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom'; 
import { 
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
  Clock,
  Printer,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
  Plus,
  Search,
  Send,
  Users
} from 'lucide-react';
import jsQR from 'jsqr';
import stiLogo from '../../assets/sti-logof.png';
import { formatDate, formatDateTime } from '../../utils/datetime';
import FormDocument from '../../components/common/FormDocument';
import { buildDispensedModel } from '../../utils/formModels';
import { useRecordSync, notifyRecordChanged } from '../../hooks/useRecordSync';
import '../../styles/nurse/DispensedMedicine.css';

// Measured units allow continuous decimal values (liquids, weights, volumes)
const MEASURED_UNITS = ['mg', 'g', 'mcg', 'mL', 'L'];

// Helper to check if a unit of measure is continuous/measured vs discrete
const isMeasuredUnitFn = (unit) => {
  if (!unit) return false;
  return MEASURED_UNITS.some(u => u.toLowerCase() === String(unit).trim().toLowerCase());
};

// Global value formatter: Strips decimals for discrete units ('Tablet/s', 'Capsule/s', 'Patch/es', 'Sachet', 'Vial', 'Prefilled Syringe', 'Spray/s', 'Inhaler', 'Box/es', 'pcs.', etc.)
const formatUnitValue = (val, unit) => {
  if (val === undefined || val === null || val === '') return '';
  const num = parseFloat(val);
  if (isNaN(num)) return val;

  if (!isMeasuredUnitFn(unit)) {
    return Math.round(num).toString();
  }
  return num.toString();
};

const convertUnit = (val, fromUnit, toUnit) => {
  if (fromUnit === toUnit || !fromUnit || !toUnit) return val;
  const toBase = (v, u) => {
    switch (String(u).toLowerCase()) {
      case 'g': return v * 1000000;
      case 'mg': return v * 1000;
      case 'mcg': return v;
      case 'l': return v * 1000;
      case 'ml': return v;
      default: return v;
    }
  };
  const fromBase = (v, u) => {
    switch (String(u).toLowerCase()) {
      case 'g': return v / 1000000;
      case 'mg': return v / 1000;
      case 'mcg': return v / 1000000;
      case 'l': return v / 1000;
      case 'ml': return v;
      default: return v;
    }
  };
  return fromBase(toBase(val, fromUnit), toUnit);
};

const isBoxUnit = (item) => {
  if (!item) return false;
  const fields = [
    item.unit,
    item.unit_of_measure,
    item.packaging,
    item.package_type,
    item.strength_unit_of_measure,
    item.dosage_unit,
    item.dispense_unit_of_measure
  ];
  return fields.some(field => typeof field === 'string' && field.toLowerCase().includes('box'));
};

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

const getStrengthPerDosageForm = (item) => {
  if (!item || item.strength_unit_value === undefined || item.strength_unit_value === null || item.strength_unit_value === '' || !item.strength_unit_of_measure) {
    return '';
  }
  
  const unit = item.strength_unit_of_measure;
  const val = formatUnitValue(item.strength_unit_value, unit);
  const form = getSingularDosageForm(item);

  return `(${val} ${unit} per ${form})`;
};

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
  const avgDosageUnit = item.dispense_unit_of_measure;
  const packaging = item.packaging || item.package_type;
  
  let unit = dosageForm || dosageUnit || strengthUnit || avgDosageUnit || packaging || 'unit';
  const unitLower = String(unit).toLowerCase().trim();
  const stock = Number(item.current_stock);
  
  if (VALID_DOSAGE_FORMS[unitLower]) {
    if (stock <= 1) {
      return VALID_DOSAGE_FORMS[unitLower];
    }
    return PLURAL_FORMS[unitLower] || VALID_DOSAGE_FORMS[unitLower] + 's';
  }
  
  if (isMeasuredUnitFn(unitLower)) {
    return unitLower;
  }
  
  if (stock >= 2 && !unitLower.endsWith('s') && unitLower !== 'unit') {
    return unit + 's';
  }
  
  return unit;
};

const formatCurrentStock = (item) => {
  if (!item) return '0 units';
  const stockUnit = getStockLabel(item);
  const strengthInfo = getStrengthPerDosageForm(item);
  return `${item.current_stock} ${stockUnit}${strengthInfo ? ` ${strengthInfo}` : ''}`;
};

// stock count only (no strength per dosage form), for the dispense form
const formatStockOnly = (item) => (item ? `${item.current_stock} ${getStockLabel(item)}` : '0 units');

// conditions that need the nurse to say what it is (same list as the clinic visit form)
const CONDITIONAL_COMPLAINT_NAMES = ['injury', 'others', 'gastrointestinal issues', 'body pain'];

// "Injury (cut on left hand)" for the log tables, report and detail
const conditionText = (log) => {
  if (!log || !log.complaint_name) return '—';
  return log.specify_complaint_text ? `${log.complaint_name} (${log.specify_complaint_text})` : log.complaint_name;
};

// A batch is dispensable for a medical condition only if its medicine is linked to it
// through medicine_indications (the API returns the linked ids as `complaint_ids`).
const isBatchLinkedToComplaint = (batch, complaintId) => {
  if (!batch || !complaintId) return false;
  return String(batch.complaint_ids || '').split(',').includes(String(complaintId));
};

// a batch that can still be used: stock left and not past its expiration date (end of that day)
const isLiveBatch = (b) => {
  if (!b || !(Number(b.current_stock) > 0)) return false;
  const exp = new Date(b.expiration_date);
  if (isNaN(exp)) return true;
  exp.setHours(23, 59, 59, 999);
  return exp >= new Date();
};

const getStockStatus = (stock, lowThreshold = 10, criticalThreshold = 5) => {
  if (stock <= criticalThreshold) return { label: 'Critical', class: 'critical-dm', bar: 'level-crit-dm', Icon: AlertTriangle };
  if (stock <= lowThreshold) return { label: 'Low Stock', class: 'status-low-dm', bar: 'level-low-dm', Icon: AlertTriangle };
  return { label: 'Adequate', class: 'adequate-dm', bar: 'level-ok-dm', Icon: CheckCircle };
};

// status is never colour alone: icon + label
const StatusChip = ({ status }) => (
  <span className={`status-tag-dm ${status.class}`}>
    <status.Icon size={14} aria-hidden="true" />
    {status.label}
  </span>
);

// common conditions come first; the rest sit behind "View more"
const COMMON_COMPLAINTS = ['fever', 'headache', 'cough', 'body pain', 'sore throat', 'runny nose', 'menstrual cramps', 'dizziness'];
const COMPLAINTS_COLLAPSED = 8;
const EXPIRY_WARN_DAYS = 60;

// whole days from today to a date (negative = past)
const daysUntil = (date) => {
  const d = new Date(date);
  if (isNaN(d)) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
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
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [specifyComplaintText, setSpecifyComplaintText] = useState('');
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [openGroups, setOpenGroups] = useState({}); // medicine ids whose batches are open; all closed at first
  const [showAllComplaints, setShowAllComplaints] = useState(false); // "View more" on the condition picker

  // Dosage Consumption States
  const [dosageValue, setDosageValue] = useState('');
  const [dosageUnit, setDosageUnit] = useState('');

  // Logs & Multi-Parameter Filter States
  const [history, setHistory] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterMedicine, setFilterMedicine] = useState('');

  // Modal States
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // NOTIFICATION ALERT MODAL STATE
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // CONFIRMATION MODAL STATE
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const showAlertModal = (title, message, type = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const closeAlertModal = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  };

  const showConfirmModal = (title, message, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
  };

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

  // Handle scanned QR result with Active Account Filter
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
        } else {
          setSelectedStudent(null);
          showAlertModal(
            'Inactive or Unregistered Student', 
            `No active student account found matching ID or QR content "${cleanText}". Inactive accounts cannot be scanned or processed.`,
            'warning'
          );
        }
      } else {
        showAlertModal('Error', 'Unable to verify student status from server.', 'error');
      }
    } catch (err) {
      console.error("Error fetching scanned student:", err);
      showAlertModal('Error', 'A network error occurred while scanning student QR code.', 'error');
    }
  }, [stopQRScan]);

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
      showAlertModal('Camera Error', 'Unable to access camera. Please check browser camera permissions.', 'error');
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

  const fetchComplaints = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/complaints');
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const data = await res.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading medical conditions:", err);
      setComplaints([]);
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
    fetchComplaints();
  }, [fetchComplaints]);

  // a release was saved or changed elsewhere (check-up time out, visit documentation, incident report): list and stock follow
  useRecordSync(['visit', 'incident'], useCallback(() => {
    fetchInventory();
    fetchHistory();
  }, [fetchInventory, fetchHistory]));

  useEffect(() => {
    if (searchStudent.trim().length > 1 && !selectedStudent) {
      fetch(`http://localhost:3001/api/students/direct?search=${encodeURIComponent(searchStudent)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => setStudents(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error("Error fetching active students:", err);
          setStudents([]);
        });
    } else if (searchStudent.trim().length <= 1) {
      setStudents([]);
    }
  }, [searchStudent, selectedStudent]);

  useEffect(() => {
    if (selectedMedicineId && selectedComplaintId && Array.isArray(inventory)) {
      // soonest expiry first, and that batch is picked for the nurse
      const batches = inventory.filter(b =>
        b.medicine_id === selectedMedicineId &&
        isLiveBatch(b) &&
        isBatchLinkedToComplaint(b, selectedComplaintId)
      ).sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));
      setAvailableBatches(batches);
      setSelectedBatchId(batches.length > 0 ? batches[0].batch_id : '');
      
      // Dispense unit and dispense limit come from the medicine (dispense_limit / dispense_unit_of_measure columns)
      const sample = inventory.find(i => i.medicine_id === selectedMedicineId);
      if (sample) {
        const unit = sample.dispense_unit_of_measure || sample.strength_unit_of_measure || '';
        const limit = parseFloat(sample.dispense_limit);
        const isMeasured = isMeasuredUnitFn(unit);

        if (!isMeasured && limit > 0) {
          setDosageValue(Math.max(1, Math.round(limit)).toString());
        } else {
          setDosageValue(limit > 0 ? String(limit) : '1');
        }
        setDosageUnit(unit);
      }
    } else {
      setAvailableBatches([]);
      setSelectedBatchId('');
      setDosageValue('');
      setDosageUnit('');
    }
  }, [selectedMedicineId, selectedComplaintId, inventory]);

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

  // Execution after modal confirmation
  const executeDispense = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/dispensation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.student_id,
          nurse_id: nurseId,
          batch_id: selectedBatchId,
          complaint_id: selectedComplaintId,
          specify_complaint_text: isSpecifyRequired ? specifyComplaintText.trim() : null,
          dosage_consumption_unit_value: parseFloat(dosageValue),
          dosage_consumption_unit_of_measure: dosageUnit
        })
      });

      const result = await response.json();

      if (response.ok) {
        showAlertModal('Success', 'Medicine was successfully dispensed and logged.', 'success');
        
        setSelectedStudent(null);
        setSearchStudent('');
        setSelectedComplaintId('');
        setSpecifyComplaintText('');
        setSelectedMedicineId('');
        setSelectedBatchId('');
        setDosageValue('');
        setDosageUnit('');

        fetchInventory();
        fetchHistory();
        notifyRecordChanged(['visit', 'incident']);
      } else {
        if (result.code === 'DOSE_GAP') showAlertModal('Too Soon to Dispense', result.error, 'warning');
        else showAlertModal('Dispensation Error', result.error || 'Transaction rejected by server.', 'error');
      }
    } catch (error) {
      showAlertModal('System Error', 'A communications error occurred with the backend system.', 'error');
    }
  };

  // Form Validation & Whole Number Integer Check
  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (!nurseId) {
      showAlertModal('Authentication Error', 'Nurse authentication missing from NurseLayout context. Please re-login.', 'error');
      return;
    }

    if (!selectedStudent) {
      showAlertModal('Validation Error', 'Please search and select a valid active student from the dropdown list.', 'warning');
      return;
    }

    if (!selectedComplaintId) {
      showAlertModal('Validation Error', 'Please select the medical condition the medicine is dispensed for.', 'warning');
      return;
    }

    if (isSpecifyRequired && !specifyComplaintText.trim()) {
      showAlertModal('Validation Error', 'Please specify the medical condition.', 'warning');
      return;
    }

    if (!selectedBatchId) {
      showAlertModal('Validation Error', 'Please select a valid medicine batch expiration date.', 'warning');
      return;
    }

    const selectedBatch = inventory.find(b => b.batch_id === selectedBatchId);
    const numericValue = parseFloat(dosageValue);
    const isMeasuredUnit = isMeasuredUnitFn(dosageUnit);

    if (isNaN(numericValue) || numericValue <= 0) {
      showAlertModal('Validation Error', 'Dosage value must be greater than 0.', 'warning');
      return;
    }

    const dispenseLimit = parseFloat(selectedBatch?.dispense_limit);
    if (dispenseLimit > 0 && numericValue > dispenseLimit) {
      showAlertModal(
        'Dispense Limit Exceeded',
        `This medicine can only be dispensed up to ${formatUnitValue(dispenseLimit, dosageUnit)} ${dosageUnit} per dispensation.`,
        'warning'
      );
      return;
    }

    // Strict Whole Integer Validation for discrete item units
    if (!isMeasuredUnit && !Number.isInteger(numericValue)) {
      showAlertModal('Validation Error', 'Quantity dispensed for discrete items (e.g. Tablet/s, Capsule/s, Patch/es, Sachet, Vial, Prefilled Syringe, Spray/s, Inhaler, Box/es, pcs.) must be a whole number or integer.', 'warning');
      return;
    }

    if (selectedBatch) {
      const currentStock = parseInt(selectedBatch.current_stock, 10);
      const strengthVal = parseFloat(selectedBatch.strength_unit_value);
      const remainingVol = parseFloat(selectedBatch.remaining_volume);
      const strengthUnit = selectedBatch.strength_unit_of_measure;

      if (!isMeasuredUnit) {
        if (numericValue > currentStock) {
          showAlertModal('Stock Exceeded', `Requested quantity (${numericValue}) exceeds available stock (${currentStock}).`, 'error');
          return;
        }
      } else {
        const reqInBatchUnit = convertUnit(numericValue, dosageUnit, strengthUnit);
        const totalAvailableBatchUnit = currentStock > 0 
          ? remainingVol + (currentStock - 1) * strengthVal 
          : 0;

        if (reqInBatchUnit > totalAvailableBatchUnit) {
          const availInDispenseUnit = convertUnit(totalAvailableBatchUnit, strengthUnit, dosageUnit);
          showAlertModal('Stock Exceeded', `Dosage cannot exceed current available volume/count (${availInDispenseUnit.toFixed(2)} ${dosageUnit}).`, 'error');
          return;
        }
      }
    }

    // Trigger Confirmation Modal
    const medName = selectedBatch ? selectedBatch.medicine_name : 'Selected Medicine';
    const studentName = `${selectedStudent.first_name} ${selectedStudent.last_name}`;

    showConfirmModal(
      'Confirm Medicine Dispensation',
      `Are you sure you want to dispense ${formatUnitValue(numericValue, dosageUnit)} ${dosageUnit} of ${medName} to ${studentName} (${selectedStudent.student_id})?`,
      executeDispense
    );
  };

  // PRINT PREVIEW PDF EXPORT
  // PRINT PREVIEW PDF EXPORT WITH MEDICINE QUANTITY/VOLUME SUMMARY
  const handleExportPDF = () => {
    const rowsToExport = Array.isArray(history) ? history : [];

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      showAlertModal('Popup Blocked', 'Please allow popups to preview and print the report.', 'warning');
      return;
    }

    const reportDate = formatDate(new Date());

    // 1. Calculate aggregated total quantity/volume and dispensation count per medicine
    const medicineTotals = rowsToExport.reduce((acc, log) => {
      const medName = log.medicine_name ? log.medicine_name.trim() : 'Unknown Medicine';
      const unit = log.dosage_consumption_unit_of_measure || '';
      const val = parseFloat(log.dosage_consumption_unit_value) || 0;

      if (!acc[medName]) {
        acc[medName] = { totalQty: 0, count: 0, unit: unit };
      }
      acc[medName].totalQty += val;
      acc[medName].count += 1;
      if (!acc[medName].unit && unit) {
        acc[medName].unit = unit;
      }
      return acc;
    }, {});

    // 2. Generate HTML summary cards for medicines present in the report
    const summaryItemsHtml = Object.keys(medicineTotals).length > 0
      ? Object.entries(medicineTotals).map(([medName, data]) => {
          const formattedTotal = formatUnitValue(data.totalQty, data.unit);
          const qtyText = `${formattedTotal} ${data.unit}`.trim();
          return `
            <div class="summary-card">
              <span class="summary-label">${medName}</span>
              <span class="summary-badge">${qtyText} (${data.count} log${data.count > 1 ? 's' : ''})</span>
            </div>
          `;
        }).join('')
      : '<span style="font-size: 12px; color: #64748b;">No medicine dispensation records found in current selection.</span>';

    const tableRowsHtml = rowsToExport.map(log => {
      const dateTime = formatDateTime(new Date(log.dispensed_at));
      const stId = log.student_id || 'N/A';
      const stName = `${log.first_name || ''} ${log.last_name || ''}`.trim() || 'N/A';
      const medName = log.medicine_name || 'N/A';
      const qty = `${formatUnitValue(log.dosage_consumption_unit_value, log.dosage_consumption_unit_of_measure)} ${log.dosage_consumption_unit_of_measure || ''}`.trim();
      const dispType = log.dispensation_type || 'Direct Dispensation';

      return `
        <tr>
          <td>${dateTime}</td>
          <td>${stId}</td>
          <td><strong>${stName}</strong></td>
          <td>${medName}</td>
          <td>${conditionText(log)}</td>
          <td>${qty}</td>
          <td>${dispType}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Dispensed Medicine Report Log</title>
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
              /* Medicine Summary Box Styling */
              .summary-section {
                  background-color: #f8fafc;
                  border: 1px solid #cbd5e1;
                  border-radius: 6px;
                  padding: 10px 14px;
                  margin-bottom: 20px;
              }
              .summary-title {
                  font-size: 11px;
                  font-weight: bold;
                  color: #1e3a8a;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 8px;
              }
              .summary-grid {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 8px;
              }
              .summary-card {
                  background-color: #ffffff;
                  border: 1px solid #cbd5e1;
                  border-radius: 4px;
                  padding: 5px 10px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  font-size: 12px;
              }
              .summary-label {
                  color: #334155;
                  font-weight: 600;
              }
              .summary-badge {
                  background-color: #0056b3;
                  color: #ffffff;
                  font-size: 11px;
                  font-weight: bold;
                  padding: 2px 7px;
                  border-radius: 10px;
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
              <span><strong>DISPENSED MEDICINE REPORT LOG</strong></span>
              <span>Date Generated: ${reportDate} | Total Records: ${rowsToExport.length}</span>
          </div>

          <div class="summary-section">
              <div class="summary-title">Dispensed Medicine Quantity / Volume Summary</div>
              <div class="summary-grid">
                  ${summaryItemsHtml}
              </div>
          </div>

          <table>
              <thead>
                  <tr>
                      <th>Date & Time</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Medicine Dispensed</th>
                      <th>Medical Condition</th>
                      <th>Qty / Volume</th>
                      <th>Dispensation Type</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRowsHtml || '<tr><td colspan="7">No dispensed medicine records found.</td></tr>'}
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

  const todaysDispensedLogs = useMemo(() => {
    if (!Array.isArray(history)) return [];
    const today = formatDate(new Date());
    return history.filter(log => {
      if (!log.dispensed_at) return false;
      return formatDate(new Date(log.dispensed_at)) === today;
    });
  }, [history]);

  // Inventory batches grouped by medicine: one row per medicine, its batches open on demand (soonest expiry first)
  const inventoryGroups = useMemo(() => {
    if (!Array.isArray(inventory)) return [];
    const map = new Map();
    inventory.forEach((b) => {
      if (!map.has(b.medicine_id)) map.set(b.medicine_id, { medicine_id: b.medicine_id, name: b.medicine_name, batches: [], sample: b });
      // only live batches (stock left, not expired); emptied and expired ones stay in the database for the history and forecast
      if (isLiveBatch(b)) map.get(b.medicine_id).batches.push(b);
    });
    const groups = Array.from(map.values());
    groups.forEach((g) => g.batches.sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date)));
    return groups.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [inventory]);

  const visibleGroups = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    return q ? inventoryGroups.filter((g) => String(g.name).toLowerCase().includes(q)) : inventoryGroups;
  }, [inventoryGroups, inventorySearch]);

  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectedComplaint = complaints.find(c => String(c.complaint_id) === String(selectedComplaintId));
  const isSpecifyRequired = Boolean(selectedComplaint) &&
    CONDITIONAL_COMPLAINT_NAMES.includes(String(selectedComplaint.complaint_name).trim().toLowerCase());

  const activeBatch = inventory.find(b => b.batch_id === selectedBatchId);
  const isMeasured = isMeasuredUnitFn(dosageUnit);
  const activeMedicine = inventory.find(b => b.medicine_id === selectedMedicineId);
  const dispenseLimit = parseFloat(activeMedicine?.dispense_limit) || 0;

  // Close the top-most modal with Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (alertModal.isOpen) setAlertModal((prev) => ({ ...prev, isOpen: false }));
      else if (confirmModal.isOpen) setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
      else if (selectedLogDetail) setSelectedLogDetail(null);
      else if (isLogModalOpen) setIsLogModalOpen(false);
      else if (isScanningQR) stopQRScan();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [alertModal.isOpen, confirmModal.isOpen, selectedLogDetail, isLogModalOpen, isScanningQR, stopQRScan]);

  // Medical conditions: the common ones first, "Others" last; the rest stay behind "View more"
  const complaintRank = (c) => {
    const name = String(c.complaint_name).trim().toLowerCase();
    if (name === 'others') return 99;
    const i = COMMON_COMPLAINTS.indexOf(name);
    return i === -1 ? COMMON_COMPLAINTS.length : i;
  };
  const orderedComplaints = [...complaints].sort(
    (a, b) => complaintRank(a) - complaintRank(b) || String(a.complaint_name).localeCompare(String(b.complaint_name))
  );
  const shownComplaints = showAllComplaints
    ? orderedComplaints
    : orderedComplaints.filter((c, i) => i < COMPLAINTS_COLLAPSED || String(c.complaint_id) === String(selectedComplaintId));
  const hiddenComplaintCount = orderedComplaints.length - shownComplaints.length;

  // Medicines linked to the chosen condition (live batches only)
  const medicineOptions = selectedComplaintId
    ? Array.from(
        new Set(
          inventory
            .filter((item) => isLiveBatch(item) && isBatchLinkedToComplaint(item, selectedComplaintId))
            .map((item) => item.medicine_id)
        )
      ).map((medId) => {
        const linked = inventory.filter(
          (i) => i.medicine_id === medId && isLiveBatch(i) && isBatchLinkedToComplaint(i, selectedComplaintId)
        );
        const first = linked[0];
        const total = linked.reduce((sum, b) => sum + Number(b.current_stock || 0), 0);
        return { id: medId, name: first.medicine_name, first, total };
      })
    : [];

  const strengthText = (item) =>
    item && item.strength_unit_value !== undefined && item.strength_unit_value !== null && item.strength_unit_value !== '' && item.strength_unit_of_measure
      ? `${formatUnitValue(item.strength_unit_value, item.strength_unit_of_measure)} ${item.strength_unit_of_measure}`
      : '';

  const groupTotal = (g) => {
    const first = g.batches[0] || g.sample;
    return Number(first.medicine_total_stock ?? g.batches.reduce((s, b) => s + Number(b.current_stock || 0), 0));
  };

  // Stat tiles
  const statDispensed = todaysDispensedLogs.length;
  const statStudents = new Set(todaysDispensedLogs.map((l) => l.student_id)).size;
  const statLow = inventoryGroups.filter((g) => {
    const first = g.batches[0] || g.sample;
    return getStockStatus(groupTotal(g), first.low_stock_level, first.critical_stock_level).label !== 'Adequate';
  }).length;
  const statExpiring = inventory.filter((b) => isLiveBatch(b) && daysUntil(b.expiration_date) <= EXPIRY_WARN_DAYS).length;

  // Quantity stepper
  const qtyStep = isMeasured && dispenseLimit >= 10 ? 5 : 1;
  const stepDosage = (dir) => {
    const cur = parseFloat(dosageValue);
    let next = (isNaN(cur) ? 0 : cur) + dir * qtyStep;
    if (dispenseLimit > 0) next = Math.min(next, dispenseLimit);
    next = Math.max(next, qtyStep);
    setDosageValue(String(next));
  };

  const numericDosage = parseFloat(dosageValue);
  const quantityOk = !isNaN(numericDosage) && numericDosage > 0 && (dispenseLimit <= 0 || numericDosage <= dispenseLimit);
  const specifyOk = !isSpecifyRequired || Boolean(specifyComplaintText.trim());
  const readyToSubmit = Boolean(selectedStudent && selectedComplaint && activeMedicine && activeBatch);

  const stepClass = (done) => `step-num-dm${done ? ' done-dm' : ''}`;
  const StepMark = ({ done, n }) => (done ? <Check size={16} aria-hidden="true" /> : n);

  return (
    <div className="dispense-container-dm">
      <div className="dm-page">
      {/* Header */}
      <header className="dispense-header-dm">
        <div className="header-title-block-dm">
          <h1>Medicine Dispensation</h1>
          <p className="header-subtitle-dm">Dispense to a student and watch stock live.</p>
        </div>
        <div className="header-actions-dm">
          <span className="date-pill-dm"><Calendar size={18} aria-hidden="true" />{formatDate(new Date())}</span>
          <button
            type="button"
            className="btn-dm"
            onClick={handleExportPDF}
            title="Export dispense log"
            aria-label="Export dispense log"
          >
            <Printer size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-dm btn-dm-solid"
            onClick={() => setIsLogModalOpen(true)}
            title="Open dispense log"
            aria-label="Open dispense log"
          >
            <History size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {!nurseId && (
        <div className="alert-banner-dm alert-error-dm" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <span>No active nurse session.</span>
          </div>
        </div>
      )}

      {/* Stat strip */}
      <section className="stats-dm" aria-label="Today at a glance">
        <div className="stat-dm">
          <span className="stat-ic-dm tone-info-dm"><Pill size={22} aria-hidden="true" /></span>
          <div><div className="stat-n-dm">{statDispensed}</div><div className="stat-l-dm">Dispensed today</div></div>
        </div>
        <div className="stat-dm">
          <span className="stat-ic-dm tone-ok-dm"><Users size={22} aria-hidden="true" /></span>
          <div><div className="stat-n-dm">{statStudents}</div><div className="stat-l-dm">Students served</div></div>
        </div>
        <div className="stat-dm">
          <span className="stat-ic-dm tone-low-dm"><AlertTriangle size={22} aria-hidden="true" /></span>
          <div><div className="stat-n-dm">{statLow}</div><div className="stat-l-dm">Low or critical</div></div>
        </div>
        <div className="stat-dm">
          <span className="stat-ic-dm tone-bad-dm"><Clock size={22} aria-hidden="true" /></span>
          <div><div className="stat-n-dm">{statExpiring}</div><div className="stat-l-dm">Expiring in {EXPIRY_WARN_DAYS} days</div></div>
        </div>
      </section>

      {/* GLOBAL ALERT / SYSTEM NOTIFICATION MODAL */}
      {alertModal.isOpen && (
        <div className="modal-overlay-dm">
          <div className="modal-card-dm alert-modal-card-dm" role="dialog" aria-modal="true" aria-labelledby="dm-alert-title">
            <div className="modal-header-dm">
              <div className="modal-header-title-dm">
                {alertModal.type === 'success' && <CheckCircle size={24} style={{ color: 'var(--status-adequate-text)' }} aria-hidden="true" />}
                {alertModal.type === 'error' && <AlertTriangle size={24} style={{ color: 'var(--status-critical-text)' }} aria-hidden="true" />}
                {alertModal.type === 'warning' && <AlertTriangle size={24} style={{ color: 'var(--status-low-text)' }} aria-hidden="true" />}
                {alertModal.type === 'info' && <Info size={24} style={{ color: 'var(--text-brand)' }} aria-hidden="true" />}
                <h3 id="dm-alert-title">{alertModal.title}</h3>
              </div>
              <button type="button" className="modal-close-icon-dm" onClick={closeAlertModal} aria-label="Close" title="Close">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body-dm">
              <p>{alertModal.message}</p>
            </div>
            <div className="modal-footer-dm">
              <button type="button" className="btn-confirm-dm" onClick={closeAlertModal}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPERATION CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="modal-overlay-dm">
          <div className="modal-card-dm confirm-modal-card-dm" role="dialog" aria-modal="true" aria-labelledby="dm-confirm-title">
            <div className="modal-header-dm">
              <div className="modal-header-title-dm">
                <HelpCircle size={24} style={{ color: 'var(--text-brand)' }} aria-hidden="true" />
                <h3 id="dm-confirm-title">{confirmModal.title}</h3>
              </div>
              <button type="button" className="modal-close-icon-dm" onClick={closeConfirmModal} aria-label="Close" title="Close">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body-dm">
              <p>{confirmModal.message}</p>
            </div>
            <div className="modal-footer-dm">
              <button type="button" className="btn-secondary-action-dm" onClick={closeConfirmModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-confirm-dm"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  closeConfirmModal();
                  if (action) action();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      {isScanningQR && (
        <div className="modal-overlay-dm">
          <div className="qr-modal-card-dm" role="dialog" aria-modal="true" aria-labelledby="dm-qr-title">
            <button
              type="button"
              className="modal-close-icon-dm"
              onClick={stopQRScan}
              title="Close QR scanner"
              aria-label="Close QR scanner"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <h3 id="dm-qr-title">Scan student QR code</h3>

            {qrError ? (
              <div className="alert-banner-dm alert-error-dm" style={{ margin: '12px 0' }} role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{qrError}</span>
              </div>
            ) : (
              <div className="qr-video-wrapper-dm">
                <video ref={videoRef} className="qr-video-element-dm" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
            )}

            <p className="qr-hint-text-dm">Hold the student QR code in view.</p>

            <button type="button" onClick={stopQRScan} className="btn-secondary-action-dm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="dispense-grid-dm">
        {/* Dispense Medicine Form */}
        <section className="card-dm form-section-dm" aria-labelledby="dm-form-title">
          <div className="card-hd-dm">
            <h2 id="dm-form-title"><PlusCircle size={20} className="icon-blue-dm" aria-hidden="true" /> Dispense form</h2>
          </div>
          <form onSubmit={handleFormSubmit} noValidate>
            {/* 1. Student */}
            <div className="step-dm">
              <span className={stepClass(Boolean(selectedStudent))}><StepMark done={Boolean(selectedStudent)} n={1} /></span>
              <div className="step-body-dm student-search-container-dm">
                <h3 className="step-title-dm">Student</h3>
                <div className="row-dm">
                  <label className="field-dm" htmlFor="student-search">
                    <Search size={20} aria-hidden="true" />
                    <input
                      id="student-search"
                      type="text"
                      placeholder="Name or ID"
                      aria-label="Search active student by name or ID"
                      value={searchStudent}
                      onChange={(e) => {
                        setSearchStudent(e.target.value);
                        if (selectedStudent) setSelectedStudent(null);
                      }}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-dm"
                    onClick={startQRScan}
                    title="Scan student QR code"
                    aria-label="Scan student QR code"
                  >
                    <QrCode size={20} aria-hidden="true" />
                  </button>
                </div>

                {searchStudent.trim().length > 1 && !selectedStudent && (
                  Array.isArray(students) && students.length > 0 ? (
                    <ul className="results-dm">
                      {students.map((student) => (
                        <li key={student.student_id}>
                          <button
                            type="button"
                            className="result-dm"
                            onClick={() => {
                              setSelectedStudent(student);
                              setSearchStudent(`${student.first_name} ${student.last_name} (${student.student_id})`);
                              setStudents([]);
                            }}
                          >
                            <strong>{student.first_name} {student.last_name}</strong>
                            <span className="sid-dm">{student.student_id}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint-dm">No active student found.</p>
                  )
                )}

                {selectedStudent && (
                  <div className="picked-dm animate-fade-in-dm">
                    <div>
                      <div className="picked-name-dm">{selectedStudent.first_name} {selectedStudent.last_name}</div>
                      <span className="sid-dm">{selectedStudent.student_id}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-dm btn-dm-ghost"
                      onClick={() => { setSelectedStudent(null); setSearchStudent(''); }}
                      title="Clear student"
                      aria-label="Clear student"
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Medical condition */}
            <div className="step-dm">
              <span className={stepClass(Boolean(selectedComplaint) && specifyOk)}>
                <StepMark done={Boolean(selectedComplaint) && specifyOk} n={2} />
              </span>
              <div className="step-body-dm">
                <h3 className="step-title-dm" id="dm-condition-title">Medical condition</h3>
                <div className="chips-dm" role="group" aria-labelledby="dm-condition-title">
                  {shownComplaints.map((c) => {
                    const on = String(c.complaint_id) === String(selectedComplaintId);
                    return (
                      <button
                        key={c.complaint_id}
                        type="button"
                        className="pill-dm"
                        aria-pressed={on}
                        onClick={() => {
                          if (on) return;
                          setSelectedComplaintId(c.complaint_id);
                          setSpecifyComplaintText('');
                          setSelectedMedicineId('');
                          setSelectedBatchId('');
                        }}
                      >
                        {on && <Check size={16} aria-hidden="true" />}
                        {String(c.complaint_name).trim()}
                      </button>
                    );
                  })}
                </div>
                {orderedComplaints.length > COMPLAINTS_COLLAPSED && (
                  <div>
                    <button
                      type="button"
                      className="btn-dm btn-dm-ghost btn-dm-more"
                      aria-expanded={showAllComplaints}
                      onClick={() => setShowAllComplaints((v) => !v)}
                    >
                      {showAllComplaints ? 'View less' : `View more (${hiddenComplaintCount})`}
                      {showAllComplaints ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                    </button>
                  </div>
                )}
                {isSpecifyRequired && (
                  <label className="field-dm" htmlFor="specify-complaint">
                    <input
                      id="specify-complaint"
                      type="text"
                      maxLength={255}
                      placeholder="Specify the condition"
                      aria-label="Specify the medical condition"
                      value={specifyComplaintText}
                      onChange={(e) => setSpecifyComplaintText(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 3. Medicine and batch */}
            <div className="step-dm">
              <span className={stepClass(Boolean(selectedBatchId))}><StepMark done={Boolean(selectedBatchId)} n={3} /></span>
              <div className="step-body-dm">
                <h3 className="step-title-dm">Medicine and batch</h3>
                {!selectedComplaintId && <p className="hint-dm">Pick a condition first.</p>}
                {selectedComplaintId && medicineOptions.length === 0 && (
                  <p className="field-help-text-dm">No medicine in stock for this condition.</p>
                )}
                {medicineOptions.length > 0 && (
                  <div className="pick-grid-dm two-dm" role="group" aria-label="Medicine">
                    {medicineOptions.map((m) => {
                      const on = m.id === selectedMedicineId;
                      const unit = m.first.dispense_unit_of_measure || m.first.strength_unit_of_measure || '';
                      const limit = parseFloat(m.first.dispense_limit);
                      const strength = strengthText(m.first);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="opt-dm"
                          aria-pressed={on}
                          onClick={() => setSelectedMedicineId(m.id)}
                        >
                          <span className="opt-text-dm">
                            <span className="opt-name-dm">{m.name}{strength ? ` ${strength}` : ''}</span>
                            <span className="opt-meta-dm">
                              {m.total} {getStockLabel({ ...m.first, current_stock: m.total })}
                              {limit > 0 ? ` · max ${formatUnitValue(limit, unit)} ${unit}` : ''}
                            </span>
                          </span>
                          {on && <CheckCircle size={20} className="opt-tick-dm" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {availableBatches.length > 0 && (
                  <div>
                    <div className="sub-title-dm" id="dm-batch-title">Batch (soonest expiry first)</div>
                    <div className="pick-grid-dm two-dm" role="group" aria-labelledby="dm-batch-title">
                      {availableBatches.map((batch) => {
                        const on = batch.batch_id === selectedBatchId;
                        const d = daysUntil(batch.expiration_date);
                        return (
                          <button
                            key={batch.batch_id}
                            type="button"
                            className="opt-dm"
                            aria-pressed={on}
                            onClick={() => setSelectedBatchId(batch.batch_id)}
                          >
                            <span className="opt-text-dm">
                              <span className="opt-name-dm">{formatDate(new Date(batch.expiration_date))}</span>
                              <span className="opt-meta-dm">
                                <span className={isBoxUnit(batch) ? 'stock-box-badge-dm' : ''}>{formatStockOnly(batch)}</span>
                                {isMeasuredUnitFn(batch.dispense_unit_of_measure) && (
                                  <> · {batch.remaining_volume} {batch.strength_unit_of_measure} left</>
                                )}
                              </span>
                              {d <= EXPIRY_WARN_DAYS && (
                                <span className="chip-dm tone-low-dm">
                                  <AlertTriangle size={14} aria-hidden="true" />
                                  Expires in {d} {d === 1 ? 'day' : 'days'}
                                </span>
                              )}
                            </span>
                            {on && <CheckCircle size={20} className="opt-tick-dm" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Quantity */}
            <div className="step-dm">
              <span className={stepClass(Boolean(selectedBatchId) && quantityOk)}>
                <StepMark done={Boolean(selectedBatchId) && quantityOk} n={4} />
              </span>
              <div className="step-body-dm">
                <h3 className="step-title-dm">{isMeasured ? 'Dosage' : 'Quantity'}</h3>
                <div className="qty-dm">
                  <div className="stepper-dm">
                    <button
                      type="button"
                      className="btn-dm"
                      onClick={() => stepDosage(-1)}
                      disabled={!selectedMedicineId}
                      title="Decrease"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={20} aria-hidden="true" />
                    </button>
                    <input
                      id="dosage-input"
                      className="qty-input-dm"
                      type="number"
                      step={isMeasured ? 'any' : '1'}
                      min={isMeasured ? '0.01' : '1'}
                      max={dispenseLimit > 0 ? dispenseLimit : undefined}
                      placeholder={isMeasured ? '0.00' : '1'}
                      aria-label={isMeasured ? `Dosage value in ${dosageUnit}` : 'Quantity dispensed'}
                      value={dosageValue}
                      disabled={!selectedMedicineId}
                      onKeyDown={(e) => {
                        if (!isMeasured && (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-')) {
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
                    />
                    <button
                      type="button"
                      className="btn-dm"
                      onClick={() => stepDosage(1)}
                      disabled={!selectedMedicineId}
                      title="Increase"
                      aria-label="Increase quantity"
                    >
                      <Plus size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <span className="unit-dm">{dosageUnit || 'Unit'}</span>
                  {dispenseLimit > 0 && (
                    <span className="chip-dm inline-dm tone-info-dm">
                      Max {formatUnitValue(dispenseLimit, dosageUnit)} {dosageUnit}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Submit bar */}
            <div className="foot-dm">
              <div className="foot-text-dm" aria-live="polite">
                <strong>
                  {readyToSubmit
                    ? `${selectedStudent.first_name} ${selectedStudent.last_name} · ${activeMedicine.medicine_name}`
                    : 'Nothing selected yet'}
                </strong>
                <span>
                  {readyToSubmit
                    ? `${formatUnitValue(dosageValue, dosageUnit)} ${dosageUnit} · ${String(selectedComplaint.complaint_name).trim()}`
                    : 'Fill the four steps.'}
                </span>
              </div>
              <button
                type="submit"
                className="btn-dm btn-dm-solid btn-dm-lg"
                disabled={!nurseId}
                title="Submit dispensation"
                aria-label="Submit dispensation"
              >
                <Send size={22} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>

        {/* Real-time Inventory Section */}
        <section className="card-dm inventory-section-dm" aria-labelledby="dm-inv-title">
          <div className="card-hd-dm">
            <h2 id="dm-inv-title"><Pill size={20} className="icon-blue-dm" aria-hidden="true" /> Inventory</h2>
            <div className="card-tools-dm">
              <label className="field-dm inv-search-dm">
                <Search size={20} aria-hidden="true" />
                <input
                  type="search"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search medicine"
                  aria-label="Search medicine"
                />
              </label>
              <button type="button" onClick={fetchInventory} className="btn-dm" title="Refresh inventory" aria-label="Refresh inventory list">
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="table-responsive-dm inv-scroll-dm">
            <table className="custom-table-dm inv-table-dm">
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Level</th>
                  <th scope="col">Nearest expiry</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="action-column-dm"><span className="sr-only-dm">Batches</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center-empty-dm">{inventorySearch ? 'No match.' : 'No medicine in inventory.'}</td>
                  </tr>
                ) : (
                  visibleGroups.map((g) => {
                    const first = g.batches[0] || g.sample;
                    // judged on the medicine's total stock across its batches, not one batch alone
                    const total = groupTotal(g);
                    const status = getStockStatus(total, first.low_stock_level, first.critical_stock_level);
                    const lowLevel = Number(first.low_stock_level) || 10;
                    const pct = Math.min(100, Math.round((total / (lowLevel * 2.5)) * 100));
                    const isOpen = !!openGroups[g.medicine_id];
                    const panelId = `inv-batches-${g.medicine_id}`;
                    return (
                      <React.Fragment key={g.medicine_id}>
                        <tr className="inv-group-row-dm">
                          <td><strong>{g.name}</strong> <span className="inv-count-dm">{g.batches.length} {g.batches.length === 1 ? 'batch' : 'batches'}</span></td>
                          <td>{total} {getStockLabel(first)}</td>
                          <td>
                            <div className={`level-dm ${status.bar}`} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
                          </td>
                          <td>{g.batches.length ? formatDate(new Date(first.expiration_date)) : 'None'}</td>
                          <td><StatusChip status={status} /></td>
                          <td className="action-column-dm">
                            {g.batches.length > 0 && <button
                              type="button"
                              className="btn-icon-row-dm inv-toggle-dm"
                              onClick={() => toggleGroup(g.medicine_id)}
                              aria-expanded={isOpen}
                              aria-controls={panelId}
                              aria-label={`${isOpen ? 'Hide' : 'Show'} batches of ${g.name}`}
                              title={isOpen ? 'Hide batches' : 'Show batches'}
                            >
                              {isOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                            </button>}
                          </td>
                        </tr>
                        {isOpen && g.batches.map((item, i) => {
                          const showVolume = isMeasuredUnitFn(item.dispense_unit_of_measure);
                          const d = daysUntil(item.expiration_date);
                          return (
                            <tr key={item.batch_id} id={i === 0 ? panelId : undefined} className="inv-batch-row-dm">
                              <td className="inv-batch-label-dm">Batch {i + 1}</td>
                              <td>
                                <span className={isBoxUnit(item) ? 'stock-box-badge-dm' : ''}>{formatCurrentStock(item)}</span>
                                {showVolume && <span className="inv-vol-dm"> / {item.remaining_volume} {item.strength_unit_of_measure} left</span>}
                              </td>
                              <td></td>
                              <td>{formatDate(new Date(item.expiration_date))}</td>
                              <td>
                                {d <= EXPIRY_WARN_DAYS && (
                                  <span className="status-tag-dm status-low-dm">
                                    <AlertTriangle size={14} aria-hidden="true" />
                                    Expires in {d} {d === 1 ? 'day' : 'days'}
                                  </span>
                                )}
                              </td>
                              <td></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* TODAY'S DISPENSED SECTION */}
      <section className="card-dm history-section-wrapper-dm" aria-labelledby="dm-today-title">
        <div className="card-hd-dm">
          <h2 id="dm-today-title"><Clock size={20} className="icon-blue-dm" aria-hidden="true" /> Today's dispensed</h2>
          <span className="todays-badge-dm">{todaysDispensedLogs.length} {todaysDispensedLogs.length === 1 ? 'record' : 'records'}</span>
        </div>

        <div className="table-responsive-dm">
          <table className="custom-table-dm">
            <thead>
              <tr>
                <th scope="col">Date / Time Logged</th>
                <th scope="col">Dispensation Type</th>
                <th scope="col">Student ID</th>
                <th scope="col">Student Name</th>
                <th scope="col">Medicine Dispensed</th>
                <th scope="col">Medical Condition</th>
                <th scope="col">Qty./Volume</th>
                <th scope="col" className="action-column-dm"><span className="sr-only-dm">View</span></th>
              </tr>
            </thead>
            <tbody>
              {todaysDispensedLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center-empty-dm">
                    Nothing dispensed today yet.
                  </td>
                </tr>
              ) : (
                todaysDispensedLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(new Date(log.dispensed_at))}</td>
                    <td>
                      <span className={`status-tag-dm ${log.dispensation_type === 'Direct Dispensation' ? 'status-ok-dm' : 'tone-info-dm'}`}>
                        {log.dispensation_type}
                      </span>
                    </td>
                    <td><code className="sid-code-dm">{log.student_id}</code></td>
                    <td>{log.first_name} {log.last_name}</td>
                    <td>{log.medicine_name}</td>
                    <td>{conditionText(log)}</td>
                    <td><strong>{formatUnitValue(log.dosage_consumption_unit_value, log.dosage_consumption_unit_of_measure)} {log.dosage_consumption_unit_of_measure}</strong></td>
                    <td className="action-column-dm">
                      <button
                        type="button"
                        className="btn-icon-row-dm"
                        onClick={() => setSelectedLogDetail(log)}
                        title="View record"
                        aria-label={`View details for transaction ${log.id}`}
                      >
                        <Eye size={18} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL: FULL DISPENSED LOG HISTORY */}
      {isLogModalOpen && (
        <div className="modal-overlay-dm">
          <div className="modal-card-dm log-history-modal-dm" role="dialog" aria-modal="true" aria-labelledby="dm-log-title">
            <div className="modal-header-dm">
              <div className="modal-header-title-dm">
                <History size={22} className="icon-blue-dm" aria-hidden="true" />
                <h3 id="dm-log-title">Dispensed records</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-dm"
                onClick={() => setIsLogModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="modal-body-dm" style={{ overflow: 'hidden' }}>
              <div className="filter-toolbar-dm">
                <div className="filter-item-dm date-range-group-dm">
                  <Calendar size={16} className="filter-icon-dm" aria-hidden="true" />
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={handleFromDateChange}
                    title="From date"
                    aria-label="From date"
                  />
                  <span className="date-sep-dm">to</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={handleToDateChange}
                    title="To date"
                    aria-label="To date"
                  />
                </div>

                <div className="filter-item-dm">
                  <input
                    type="text"
                    placeholder="Student name or ID"
                    aria-label="Search student by name or ID"
                    value={filterStudent}
                    onChange={(e) => setFilterStudent(e.target.value)}
                    className="filter-text-input-dm"
                  />
                </div>

                <div className="filter-item-dm">
                  <input
                    type="text"
                    placeholder="Medicine name"
                    aria-label="Search medicine name"
                    value={filterMedicine}
                    onChange={(e) => setFilterMedicine(e.target.value)}
                    className="filter-text-input-dm"
                  />
                </div>

                <div className="filter-actions-row-dm">
                  <button type="button" onClick={handleApplyFilters} className="btn-dm btn-dm-solid" title="Apply filters" aria-label="Apply filters">
                    <Filter size={18} aria-hidden="true" />
                  </button>

                  {(fromDate || toDate || filterStudent || filterMedicine) && (
                    <button type="button" onClick={handleResetFilters} className="btn-dm" title="Reset filters" aria-label="Reset filters">
                      <RotateCcw size={18} aria-hidden="true" />
                    </button>
                  )}

                  <button type="button" onClick={handleExportPDF} className="btn-dm" title="Export dispense log" aria-label="Export dispense log">
                    <Printer size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="modal-table-wrap-dm">
                <table className="custom-table-dm">
                  <thead>
                    <tr>
                      <th scope="col">Date / Time Logged</th>
                      <th scope="col">Dispensation Type</th>
                      <th scope="col">Student ID</th>
                      <th scope="col">Student Name</th>
                      <th scope="col">Medicine Dispensed</th>
                      <th scope="col">Medical Condition</th>
                      <th scope="col">Qty./Volume</th>
                      <th scope="col" className="action-column-dm"><span className="sr-only-dm">View</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(history) || history.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center-empty-dm">
                          No records match.
                        </td>
                      </tr>
                    ) : (
                      history.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDateTime(new Date(log.dispensed_at))}</td>
                          <td>
                            <span className={`status-tag-dm ${log.dispensation_type === 'Direct Dispensation' ? 'status-ok-dm' : 'tone-info-dm'}`}>
                              {log.dispensation_type}
                            </span>
                          </td>
                          <td><code className="sid-code-dm">{log.student_id}</code></td>
                          <td>{log.first_name} {log.last_name}</td>
                          <td>{log.medicine_name}</td>
                          <td>{conditionText(log)}</td>
                          <td><strong>{formatUnitValue(log.dosage_consumption_unit_value, log.dosage_consumption_unit_of_measure)} {log.dosage_consumption_unit_of_measure}</strong></td>
                          <td className="action-column-dm">
                            <button
                              type="button"
                              className="btn-icon-row-dm"
                              onClick={() => setSelectedLogDetail(log)}
                              title="View record"
                              aria-label={`View details for transaction ${log.id}`}
                            >
                              <Eye size={18} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer-dm">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="btn-secondary-action-dm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISPENSATION DETAIL VIEW */}
      {selectedLogDetail && (
        <div className="modal-overlay-dm">
          <div className="modal-card-dm detail-view-modal-dm" role="dialog" aria-modal="true" aria-labelledby="dm-detail-title">
            <div className="modal-header-dm">
              <h3 id="dm-detail-title">Dispensation record</h3>
              <button
                type="button"
                className="modal-close-icon-dm"
                onClick={() => setSelectedLogDetail(null)}
                title="Close"
                aria-label="Close"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body-dm">
              <FormDocument model={buildDispensedModel(selectedLogDetail)} />
            </div>
            <div className="modal-footer-dm">
              <button
                type="button"
                className="btn-secondary-action-dm"
                onClick={() => setSelectedLogDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DispensedMedicine;
