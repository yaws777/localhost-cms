// medicineInventory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  Edit, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  Activity, 
  Layers,
  FilePlus2,
  X,
  Settings2,
  Printer
} from 'lucide-react';
import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/MedicineInventory.css';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/datetime';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Sachet', 'Patch',
  'Syrup', 'Suspension', 'Drops', 'Bottle',
  'Vial', 'Prefilled Syringe',
  'Ointment', 'Cream', 'Inhaler', 'Spray', 'Gel', 'Box'
];

const DISCRETE_UNITS = [
  'Tablet/s', 'Capsule/s', 'Patch/es', 'Sachet', 
  'Vial', 'Prefilled Syringe', 'Spray/s', 'Inhaler', 'Box/es'
];

const REQUIRES_SPECIFY_COMPLAINTS = [
  'injury', 
  'others', 
  'gastrointestinal issues', 
  'body pain'
];

// Strength describes the package only (e.g. 500 mg per tablet, 60 mL per bottle).
const DOSAGE_FORM_STRENGTH_UNITS = {
  'Tablet': ['mg', 'g', 'mcg'],
  'Capsule': ['mg', 'g', 'mcg'],
  'Sachet': ['mg', 'g', 'mcg'],
  'Patch': ['mg', 'mcg'],
  'Inhaler': ['mg', 'mcg'],
  'Syrup': ['mL', 'L', 'mg', 'mcg'],
  'Suspension': ['mL', 'L', 'mg', 'mcg'],
  'Drops': ['mL', 'L', 'mg', 'mcg'],
  'Bottle': ['mL', 'L', 'mg', 'mcg'],
  'Vial': ['mL', 'L', 'mg', 'mcg'],
  'Prefilled Syringe': ['mL', 'mg'],
  'Ointment': ['g', 'mg', 'mL'],
  'Cream': ['g', 'mg', 'mL'],
  'Gel': ['g', 'mg', 'mL'],
  'Spray': ['mg', 'mcg', 'mL'],
  'Box': ['pcs.']
};

// The dispense unit is chosen by dosage form: a piece unit (Tablet/s, Capsule/s, ...) and/or a
// measured unit convertible from the strength unit (mL, g, ...).
const PIECE_DISPENSE_UNIT_BY_FORM = {
  'Tablet': 'Tablet/s',
  'Capsule': 'Capsule/s',
  'Sachet': 'Sachet',
  'Patch': 'Patch/es',
  'Inhaler': 'Inhaler',
  'Vial': 'Vial',
  'Prefilled Syringe': 'Prefilled Syringe',
  'Spray': 'Spray/s',
  'Box': 'Box/es'
};

const VOLUME_ONLY_MEASURED_FORMS = ['Vial', 'Prefilled Syringe', 'Spray'];
const ANY_MEASURED_FORMS = ['Syrup', 'Suspension', 'Drops', 'Bottle', 'Ointment', 'Cream', 'Gel', 'Box'];

const getDispenseUnitOptions = (dosageForm, strengthUnit) => {
  const options = [];
  const pieceUnit = PIECE_DISPENSE_UNIT_BY_FORM[dosageForm];
  if (pieceUnit) options.push(pieceUnit);

  const measured = getConsumptionUnitOptions(strengthUnit);
  if (ANY_MEASURED_FORMS.includes(dosageForm)) {
    options.push(...measured);
  } else if (VOLUME_ONLY_MEASURED_FORMS.includes(dosageForm)) {
    options.push(...measured.filter(u => u === 'mL' || u === 'L'));
  }
  return [...new Set(options)];
};

const getConsumptionUnitOptions = (strengthUnit) => {
  if (DISCRETE_UNITS.includes(strengthUnit)) return [strengthUnit];
  switch (strengthUnit) {
    case 'g': return ['g', 'mg', 'mcg'];
    case 'mg': return ['mg', 'mcg'];
    case 'mcg': return ['mcg'];
    case 'L': return ['L', 'mL'];
    case 'mL': return ['mL'];
    case 'pcs.': return ['pcs.'];
    default: return [];
  }
};

const getStockLabel = (item) => {
  if (!item) return 'units';

  const stock = Number(item.current_stock) || 0;
  const isSingular = stock <= 1;
  
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
  
  const form = item.dosage_form || item.form_type;
  if (!form) return isSingular ? 'unit' : 'units';
  
  const formLower = String(form).toLowerCase().trim();
  
  if (VALID_DOSAGE_FORMS[formLower]) {
    return isSingular 
      ? VALID_DOSAGE_FORMS[formLower] 
      : (PLURAL_FORMS[formLower] || `${VALID_DOSAGE_FORMS[formLower]}s`);
  }
  
  if (!isSingular && !formLower.endsWith('s')) {
    return form + 's';
  }
  
  return form;
};

export default function MedicineInventory() {
  const { showConfirm } = useAlert();
  const [inventory, setInventory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
  const [isManageMedicinesOpen, setIsManageMedicinesOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const [medicineSearchTerm, setMedicineSearchTerm] = useState('');
  const [complaintSearchTerm, setComplaintSearchTerm] = useState('');
  const [isEditingMedicine, setIsEditingMedicine] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState(null);

  const initialMedForm = {
    generic_name: '',
    brand_name: '',
    dosage_form: 'Tablet',
    strength_unit_value: '',
    strength_unit_of_measure: 'mg',
    // Dispense limit (max quantity per dispensation) and dispense unit of measure
    dispense_limit: '1',
    dispense_unit_of_measure: 'Tablet/s',
    low_stock_level: 10,
    critical_stock_level: 5,
    adequate_stock_level: 20,
    indications: []
  };

  const [medForm, setMedForm] = useState(initialMedForm);
  const [batchForm, setBatchForm] = useState({ 
    medicine_id: '', 
    current_stock: '', 
    expiration_date: '', 
    remaining_volume: '' 
  });
  const [editingBatch, setEditingBatch] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const showAlert = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const fetchData = useCallback(async () => {
    try {
      const invRes = await fetch(`${API_BASE_URL}/inventory`);
      if (invRes.ok) setInventory(await invRes.json());
    } catch (e) { console.error("Inventory pipeline error", e); }

    try {
      const compRes = await fetch(`${API_BASE_URL}/complaints`);
      if (compRes.ok) setComplaints(await compRes.json());
    } catch (e) { console.error("Complaints pipeline error", e); }

    try {
      const medRes = await fetch(`${API_BASE_URL}/medicines`);
      if (medRes.ok) setMedicinesList(await medRes.json());
    } catch (e) { console.error("Medicines listing load failure", e); }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDosageFormChange = (form) => {
    const defaultStrengthUnit = (DOSAGE_FORM_STRENGTH_UNITS[form] || [])[0] || '';
    const defaultDispenseUnit = getDispenseUnitOptions(form, defaultStrengthUnit)[0] || defaultStrengthUnit;

    setMedForm(prev => ({
      ...prev,
      dosage_form: form,
      strength_unit_of_measure: defaultStrengthUnit,
      dispense_unit_of_measure: defaultDispenseUnit,
      dispense_limit: DISCRETE_UNITS.includes(defaultDispenseUnit)
        ? '1'
        : (prev.dispense_limit || '1')
    }));
  };

  // Strength is package-only: changing it keeps the dispense unit when it is still valid.
  const handleStrengthUnitChange = (unit) => {
    setMedForm(prev => {
      const dispenseOptions = getDispenseUnitOptions(prev.dosage_form, unit);
      const keepDispenseUnit = dispenseOptions.includes(prev.dispense_unit_of_measure);
      const nextDispenseUnit = keepDispenseUnit
        ? prev.dispense_unit_of_measure
        : (dispenseOptions[0] || unit);

      return {
        ...prev,
        strength_unit_of_measure: unit,
        strength_unit_value: DISCRETE_UNITS.includes(unit) ? '1' : prev.strength_unit_value,
        dispense_unit_of_measure: nextDispenseUnit,
        dispense_limit: !keepDispenseUnit && DISCRETE_UNITS.includes(nextDispenseUnit)
          ? '1'
          : prev.dispense_limit
      };
    });
  };

  const handleDispenseUnitChange = (unit) => {
    setMedForm(prev => ({
      ...prev,
      dispense_unit_of_measure: unit,
      dispense_limit: DISCRETE_UNITS.includes(unit)
        ? String(Math.max(1, Math.round(parseFloat(prev.dispense_limit) || 1)))
        : prev.dispense_limit
    }));
  };

  const handleDispenseLimitChange = (rawValue) => {
    if (DISCRETE_UNITS.includes(medForm.dispense_unit_of_measure) && rawValue.includes('.')) {
      setMedForm(prev => ({ ...prev, dispense_limit: rawValue.split('.')[0] }));
      return;
    }
    setMedForm(prev => ({ ...prev, dispense_limit: rawValue }));
  };

  const getStockStatus = (stock, lowThreshold = 10, criticalThreshold = 5) => {
    if (stock <= criticalThreshold) return { label: 'Critical', class: 'critical' };
    if (stock <= lowThreshold) return { label: 'Low Stock', class: 'low' };
    return { label: 'Adequate', class: 'adequate' };
  };

  // Status is judged on the medicine's total stock across all its batches, not on a single batch
  const getMedicineStatus = (item) =>
    getStockStatus(Number(item.medicine_total_stock ?? item.current_stock), item.low_stock_level, item.critical_stock_level);

  // One entry per medicine (batches with the same medicine_id are merged) for the Low / Critical counters
  const medicineStatusCounts = (() => {
    const perMedicine = new Map();
    inventory.forEach(i => { if (!perMedicine.has(i.medicine_id)) perMedicine.set(i.medicine_id, getMedicineStatus(i).class); });
    const classes = [...perMedicine.values()];
    return { low: classes.filter(c => c === 'low').length, critical: classes.filter(c => c === 'critical').length };
  })();

  const getExpirationAlert = (expiryDate) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const exp = new Date(expiryDate);
    exp.setHours(0,0,0,0);
    
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { msg: '🚨 Expired!', style: { color: 'var(--status-critical-text)', fontWeight: 'bold' } };
    } else if (diffDays <= 7) {
      return { msg: `⚠️ Alert (${diffDays} days left)`, style: { color: 'var(--status-low-text)', fontWeight: '600' } };
    }
    return { msg: formatDate(expiryDate), style: { color: 'inherit' } };
  };

  const requiresSpecifyText = (complaintName) => {
    if (!complaintName) return false;
    return REQUIRES_SPECIFY_COMPLAINTS.includes(complaintName.toLowerCase().trim());
  };

  const toggleComplaint = (comp, isChecked) => {
    if (isChecked) {
      setMedForm(prev => ({
        ...prev,
        indications: [...prev.indications, { complaint_id: String(comp.complaint_id), specify_complaint_text: '' }]
      }));
    } else {
      setMedForm(prev => ({
        ...prev,
        indications: prev.indications.filter(ind => String(ind.complaint_id) !== String(comp.complaint_id))
      }));
    }
  };

  const handleSpecifyTextChange = (complaintId, text) => {
    setMedForm(prev => ({
      ...prev,
      indications: prev.indications.map(ind => 
        String(ind.complaint_id) === String(complaintId)
          ? { ...ind, specify_complaint_text: text }
          : ind
      )
    }));
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    if (!medForm.generic_name.trim() || !medForm.brand_name.trim()) return;

    const isLegacyDiscreteStrength = DISCRETE_UNITS.includes(medForm.strength_unit_of_measure);
    const isDiscreteDispense = DISCRETE_UNITS.includes(medForm.dispense_unit_of_measure);
    const dispenseLimit = parseFloat(medForm.dispense_limit);

    if (!(dispenseLimit > 0)) {
      showAlert('Dispense limit must be greater than 0.', 'error');
      return;
    }

    const payload = {
      ...medForm,
      strength_unit_value: isLegacyDiscreteStrength ? 1 : (parseFloat(medForm.strength_unit_value) || 1),
      dispense_limit: isDiscreteDispense ? Math.max(1, Math.round(dispenseLimit)) : dispenseLimit,
      indications: medForm.indications
    };

    const endpoint = isEditingMedicine 
      ? `${API_BASE_URL}/medicines/${editingMedicineId}` 
      : `${API_BASE_URL}/medicines`;
    const method = isEditingMedicine ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Execution failure encountered', 'error');
      } else {
        showAlert(isEditingMedicine ? 'Medicine updated successfully.' : 'Medicine added.', 'success');
        setMedForm(initialMedForm); 
        setIsEditingMedicine(false);
        setEditingMedicineId(null);
        setComplaintSearchTerm('');
        setIsMedicineModalOpen(false); 
        fetchData();
      }
    } catch (err) {
      showAlert('API communication error.', 'error');
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    const selectedMed = medicinesList.find(m => m.medicine_id === batchForm.medicine_id);
    const isDiscrete = selectedMed && DISCRETE_UNITS.includes(selectedMed.dispense_unit_of_measure);
    const maxVal = selectedMed ? parseFloat(selectedMed.strength_unit_value) : 0;
    
    let volumeInput;
    let stockInput = parseInt(batchForm.current_stock) || 0;

    if (isDiscrete) {
      volumeInput = 1;
    } else {
      volumeInput = batchForm.remaining_volume !== '' ? parseFloat(batchForm.remaining_volume) : maxVal;
      
      if (volumeInput === 0 && stockInput > 0) {
        stockInput = stockInput - 1;
        volumeInput = stockInput > 0 ? maxVal : 0;
        showAlert(`Container depleted! 1 unit automatically deducted from stock. New stock: ${stockInput}, remaining reset to ${volumeInput} ${selectedMed?.strength_unit_of_measure || ''}.`, 'info');
      } else if (volumeInput < 0 || volumeInput > maxVal) {
        showAlert(`Value must be between 0 and full container capacity (${maxVal} ${selectedMed?.strength_unit_of_measure || ''})`, 'error');
        return;
      }
    }

    const endpoint = editingBatch 
      ? `${API_BASE_URL}/batches/${editingBatch.batch_id}` 
      : `${API_BASE_URL}/batches`;
    const method = editingBatch ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...batchForm,
          current_stock: stockInput,
          remaining_volume: volumeInput
        })
      });

      if (res.ok) {
        showAlert(editingBatch ? 'Batch metrics updated.' : 'New batch committed.', 'success');
        setBatchForm({ medicine_id: '', current_stock: '', expiration_date: '', remaining_volume: '' });
        setEditingBatch(null);
        setIsBatchModalOpen(false); 
        fetchData();
      } else {
        const errData = await res.json();
        showAlert(errData.error || 'Execution of batch processing failed.', 'error');
      }
    } catch (err) {
      showAlert('API communication error.', 'error');
    }
  };

  const handleDeleteBatch = async (batchId) => {
    const confirmed = await showConfirm('Confirm deletion of this batch entry?', { danger: true, confirmLabel: 'Delete' });
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE_URL}/batches/${batchId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Target batch deleted.', 'success');
        fetchData();
      } else {
        const data = await res.json();
        showAlert(data.error || 'Failed to delete batch.', 'error');
      }
    } catch (err) {
      showAlert('API communication error.', 'error');
    }
  };

  // PRINT PREVIEW PDF EXPORT
  const handleExportPDF = () => {
    const filteredInventory = inventory.filter(item => {
      const query = searchTerm.toLowerCase();
      const medName = `${item.generic_name} ${item.brand_name}`.toLowerCase();
      const complaintsText = (item.connected_complaints || '').toLowerCase();
      return medName.includes(query) || complaintsText.includes(query);
    });

    const printWindow = window.open('', '_blank', 'width=950,height=750');
    if (!printWindow) {
      showAlert('Please allow popups to preview and print the report.', 'warning');
      return;
    }

    const reportDate = formatDate(new Date());

    const tableRowsHtml = filteredInventory.map(item => {
      const statusEval = getMedicineStatus(item);
      const stockUnitLabel = getStockLabel(item);
      const formattedDate = item.expiration_date 
        ? formatDate(new Date(item.expiration_date)) 
        : 'N/A';
      const medName = `<strong>${item.generic_name}</strong><br/><span style="color: #64748b; font-size: 11px;">(${item.brand_name})</span>`;
      const dosageFormText = item.dosage_form || '';
      const displayStrengthText = item.display_strength || `${item.strength_unit_value || ''} ${item.strength_unit_of_measure || ''}`.trim();
      const formStrength = `${dosageFormText} - ${displayStrengthText}`;

      return `
        <tr>
          <td>${medName}</td>
          <td>${formStrength}</td>
          <td>${item.connected_complaints || 'Unmapped'}</td>
          <td>${item.current_stock} ${stockUnitLabel}</td>
          <td>${formattedDate}</td>
          <td>${statusEval.label}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Medicine Inventory Report</title>
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
              <span><strong>SCHOOL CLINIC MEDICINE INVENTORY REPORT</strong></span>
              <span>Date Generated: ${reportDate} | Total Records: ${filteredInventory.length}</span>
          </div>

          <table>
              <thead>
                  <tr>
                      <th>Medicine Name</th>
                      <th>Form & Strength</th>
                      <th>Indications</th>
                      <th>Stock</th>
                      <th>Expiration Date</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRowsHtml || '<tr><td colspan="6">No medicine inventory records found.</td></tr>'}
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

  const selectedMedForBatch = medicinesList.find(m => m.medicine_id === batchForm.medicine_id);
  const isBatchDiscreteUnit = selectedMedForBatch && DISCRETE_UNITS.includes(selectedMedForBatch.dispense_unit_of_measure);
  const batchUnitMeasure = selectedMedForBatch ? selectedMedForBatch.strength_unit_of_measure : '';
  const maxBatchVolume = selectedMedForBatch ? selectedMedForBatch.strength_unit_value : null;

  const batchDosageForm = selectedMedForBatch?.dosage_form || editingBatch?.dosage_form || editingBatch?.form_type;
  const isLegacyDiscreteStrength = DISCRETE_UNITS.includes(medForm.strength_unit_of_measure);
  const isDispenseUnitDiscrete = DISCRETE_UNITS.includes(medForm.dispense_unit_of_measure);
  const strengthUnitOptions = [...new Set([
    ...(DOSAGE_FORM_STRENGTH_UNITS[medForm.dosage_form] || []),
    medForm.strength_unit_of_measure
  ].filter(Boolean))];
  const dispenseUnitOptions = [...new Set([
    ...getDispenseUnitOptions(medForm.dosage_form, medForm.strength_unit_of_measure),
    medForm.dispense_unit_of_measure
  ].filter(Boolean))];

  const filteredComplaints = complaints
    .filter(comp => 
      (comp.complaint_name || '').toLowerCase().includes(complaintSearchTerm.toLowerCase().trim())
    )
    .sort((a, b) => {
      const nameA = (a.complaint_name || '').toLowerCase().trim();
      const nameB = (b.complaint_name || '').toLowerCase().trim();
      if (nameA === 'others') return 1;
      if (nameB === 'others') return -1;
      return 0;
    });

  return (
    <div className="inventory-dashboard">
      {/* Header Container styled matching Insurance Vault Theme */}
      <div className="dashboard-header-container">
        <div className="dashboard-title-area">
          <h1>Medicine Inventory</h1>
          <p className="dashboard-subtitle">Manage clinic medicine stock and monitor shortage alerts</p>
        </div>
        
        <div className="header-actions-group">
          <button className="btn-secondary-action" onClick={handleExportPDF}>
            <Printer size={18} /> <span>export</span>
          </button>

          <button className="btn-secondary-action" onClick={() => {
            setMedForm(initialMedForm);
            setIsEditingMedicine(false);
            setComplaintSearchTerm('');
            setIsMedicineModalOpen(true);
          }}>
            <PlusCircle size={18} /> <span>Add Medicine Item</span>
          </button>
          
          <button className="btn-secondary-action" onClick={() => setIsManageMedicinesOpen(true)}>
            <Settings2 size={18} /> <span>Edit Medicine Item</span>
          </button>

          <button className="btn-primary-action" onClick={() => setIsBatchModalOpen(true)}>
            <Layers size={18} /> <span>Add Batches</span>
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`global-notification-banner ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="metrics-grid-layout">
        <div className="centered-metric-card">
          <div className="metric-card-icon total"><Package size={22} /></div>
          <div className="metric-card-value">{new Set(inventory.map(i => i.medicine_id)).size}</div>
          <div className="metric-card-label">Total Items</div>
        </div>
        <div className="centered-metric-card">
          <div className="metric-card-icon low"><AlertTriangle size={22} /></div>
          <div className="metric-card-value">
            {medicineStatusCounts.low}
          </div>
          <div className="metric-card-label">Low Stock</div>
        </div>
        <div className="centered-metric-card">
          <div className="metric-card-icon critical"><Activity size={22} /></div>
          <div className="metric-card-value">
            {medicineStatusCounts.critical}
          </div>
          <div className="metric-card-label">Critical</div>
        </div>
      </div>

      {/* Main Inventory Search Bar */}
      <div className="search-bar-container">
        <Search size={18} className="search-icon-placement" />
        <input
          type="text"
          className="rounded-search-input"
          placeholder="Search inventory by medicine indication..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="table-wrapper-block">
        <table className="clean-dashboard-table">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Medicine</th>
              <th style={{ width: '20%' }}>Connected Indications</th>
              <th style={{ width: '15%' }}>Stock Units</th>
              <th style={{ width: '15%' }}>Rem. Capacity/Volume</th>
              <th style={{ width: '10%' }}>Expiry</th>
              <th style={{ width: '10%' }}>Status</th>
              <th style={{ textAlign: 'center', width: '5%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.filter(item => {
              const query = searchTerm.toLowerCase();
              const medName = `${item.generic_name} ${item.brand_name}`.toLowerCase();
              const complaintsText = (item.connected_complaints || '').toLowerCase();
              return medName.includes(query) || complaintsText.includes(query);
            }).map(item => {
              const statusEval = getMedicineStatus(item);
              const medicineTotal = Number(item.medicine_total_stock ?? item.current_stock);
              const expiryDetails = getExpirationAlert(item.expiration_date);
              const isDiscreteItem = DISCRETE_UNITS.includes(item.dispense_unit_of_measure);
              const stockUnitLabel = getStockLabel(item);

              return (
                <tr key={item.batch_id}>
                  <td>
                    <span className="med-title-text">{item.generic_name} ({item.brand_name})</span>
                    <small className="med-sub-details">{item.dosage_form} - {item.display_strength}</small>
                  </td>
                  <td><span className="med-indications-subtitle">{item.connected_complaints || 'Unmapped'}</span></td>
                  <td>
                    <div className="stock-visualization-wrapper">
                      <span className="stock-count-number">{item.current_stock} {stockUnitLabel}</span>
                      <div className="stock-progress-track">
                        <div
                          className={`stock-progress-bar ${statusEval.class}`}
                          style={{ width: `${Math.min((medicineTotal / (item.adequate_stock_level || 30)) * 100, 100)}%` }}
                        />
                      </div>
                      <small className="med-sub-details">Total (all batches): {medicineTotal}</small>
                    </div>
                  </td>
                  <td>
                    <strong>{isDiscreteItem ? 'N/A' : item.display_remaining}</strong>
                  </td>
                  <td><span style={expiryDetails.style}>{expiryDetails.msg}</span></td>
                  <td><span className={`pill-badge ${statusEval.class}`}>{statusEval.label}</span></td>
                  <td>
                    <div className="table-action-row-buttons">
                      <button
                        className="action-icon-button edit"
                        title="Adjust Volume / Stock"
                        aria-label="Adjust Volume or Stock"
                        onClick={() => {
                          setEditingBatch(item);
                          const normalizedDate = new Date(item.expiration_date).toISOString().split('T')[0];
                          setBatchForm({
                            medicine_id: item.medicine_id,
                            current_stock: item.current_stock,
                            expiration_date: normalizedDate,
                            remaining_volume: item.remaining_volume
                          });
                          setIsBatchModalOpen(true); 
                        }}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-icon-button delete"
                        title="Delete Batch"
                        aria-label="Delete Batch"
                        onClick={() => handleDeleteBatch(item.batch_id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manage Medicines Modal */}
      {isManageMedicinesOpen && (
        <div className="modal-overlay-bg">
          <div className="modal-content-container modal-md">
            <div className="modal-header-section">
              <h3><Settings2 size={20} /> Edit Medicines</h3>
              <button 
                className="action-icon-button close-modal" 
                aria-label="Close modal"
                onClick={() => setIsManageMedicinesOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-form">
              <div className="search-bar-container modal-search">
                <Search size={18} className="search-icon-placement" />
                <input
                  type="text"
                  className="rounded-search-input"
                  placeholder="Search medicines by name or complaint..."
                  value={medicineSearchTerm}
                  onChange={e => setMedicineSearchTerm(e.target.value)}
                />
              </div>
              <div className="modal-scroll-table-container">
                <table className="clean-dashboard-table compact">
                  <tbody>
                    {medicinesList
                      .filter(m => {
                        const query = medicineSearchTerm.toLowerCase();
                        const medName = `${m.generic_name} ${m.brand_name}`.toLowerCase();
                        const complaintsText = (m.connected_complaints || '').toLowerCase();
                        return medName.includes(query) || complaintsText.includes(query);
                      })
                      .map(med => {
                        const isLegacyDiscreteMed = DISCRETE_UNITS.includes(med.strength_unit_of_measure);
                        const isDiscreteDispenseMed = DISCRETE_UNITS.includes(med.dispense_unit_of_measure);
                        return (
                          <tr key={med.medicine_id}>
                            <td style={{ fontWeight: '500' }}>
                              {med.generic_name} ({med.brand_name})
                              <div className="med-sub-details">
                                {med.dosage_form} | {med.display_strength_value} {med.display_strength_unit}
                                {' | '}Dispense limit: {isDiscreteDispenseMed ? Math.round(parseFloat(med.dispense_limit) || 0) : med.display_avg_value} {med.dispense_unit_of_measure}
                              </div>
                              <div className="med-indications-text">
                                <em>Indications: {med.connected_complaints || 'None'}</em>
                              </div>
                            </td>
                            <td className="action-cell">
                              <button
                                className="action-icon-button edit"
                                title="Edit Medicine Item"
                                aria-label="Edit Medicine Item"
                                onClick={() => {
                                  setEditingMedicineId(med.medicine_id);
                                  setMedForm({
                                    generic_name: med.generic_name,
                                    brand_name: med.brand_name,
                                    dosage_form: med.dosage_form,
                                    strength_unit_value: isLegacyDiscreteMed ? '1' : med.strength_unit_value,
                                    strength_unit_of_measure: med.strength_unit_of_measure,
                                    dispense_limit: isDiscreteDispenseMed
                                      ? String(Math.max(1, Math.round(parseFloat(med.dispense_limit) || 1)))
                                      : med.dispense_limit,
                                    dispense_unit_of_measure: med.dispense_unit_of_measure,
                                    low_stock_level: med.low_stock_level,
                                    critical_stock_level: med.critical_stock_level,
                                    adequate_stock_level: med.adequate_stock_level,
                                    indications: med.indications || []
                                  });
                                  setIsEditingMedicine(true);
                                  setComplaintSearchTerm('');
                                  setIsManageMedicinesOpen(false);
                                  setIsMedicineModalOpen(true);
                                }}
                              >
                                <Edit size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register / Edit Medicine Modal */}
      {isMedicineModalOpen && (
        <div className="modal-overlay-bg">
          <div className="modal-content-container modal-lg">
            <div className="modal-header-section">
              <h3><FilePlus2 size={20} /> {isEditingMedicine ? 'Edit Medicine' : 'Create Medicine Item'}</h3>
              <button 
                className="action-icon-button close-modal" 
                aria-label="Close modal"
                onClick={() => {
                  setIsMedicineModalOpen(false);
                  setIsEditingMedicine(false);
                  setComplaintSearchTerm('');
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveMedicine} className="modal-form-wrapper">
              <div className="modal-body-form scrollable-modal-body">
                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Generic Name</label>
                    <input
                      type="text"
                      className="modal-input-field"
                      placeholder="e.g., Paracetamol"
                      value={medForm.generic_name}
                      onChange={e => setMedForm({ ...medForm, generic_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>Brand Name</label>
                    <input
                      type="text"
                      className="modal-input-field"
                      placeholder="e.g., Biogesic"
                      value={medForm.brand_name}
                      onChange={e => setMedForm({ ...medForm, brand_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Dosage Form</label>
                    <select
                      className="modal-select-dropdown"
                      value={medForm.dosage_form}
                      onChange={e => handleDosageFormChange(e.target.value)}
                      required
                    >
                      {DOSAGE_FORMS.map(df => (
                        <option key={df} value={df}>{df}</option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-form-group">
                    <label>Strength Unit Value</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="modal-input-field"
                      value={medForm.strength_unit_value}
                      onChange={e => setMedForm({ ...medForm, strength_unit_value: e.target.value })}
                      disabled={isLegacyDiscreteStrength}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>Strength Unit of Measure</label>
                    <select
                      className="modal-select-dropdown"
                      value={medForm.strength_unit_of_measure}
                      onChange={e => handleStrengthUnitChange(e.target.value)}
                      required
                    >
                      {strengthUnitOptions.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <small className="field-help-text" style={{ display: 'block', marginTop: '-6px', marginBottom: '12px' }}>
                  Strength is the package strength only (e.g. 500 mg per tablet, 60 mL per bottle).
                </small>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Dispense Limit</label>
                    <input
                      type="number"
                      step={isDispenseUnitDiscrete ? '1' : '0.01'}
                      min={isDispenseUnitDiscrete ? '1' : '0.01'}
                      className="modal-input-field"
                      value={medForm.dispense_limit}
                      onChange={e => handleDispenseLimitChange(e.target.value)}
                      onKeyDown={e => {
                        if (isDispenseUnitDiscrete && ['.', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      required
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>Dispense Unit of Measure</label>
                    <select
                      className="modal-select-dropdown"
                      value={medForm.dispense_unit_of_measure}
                      onChange={e => handleDispenseUnitChange(e.target.value)}
                      required
                    >
                      {dispenseUnitOptions.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <small className="field-help-text" style={{ display: 'block', marginTop: '-6px', marginBottom: '12px' }}>
                  Maximum quantity that can be dispensed at once (e.g. a limit of 1 {medForm.dispense_unit_of_measure || 'Tablet/s'} per dispensation).
                </small>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>Critical Alert Threshold</label>
                    <input
                      type="number"
                      className="modal-input-field"
                      value={medForm.critical_stock_level}
                      onChange={e => setMedForm({ ...medForm, critical_stock_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>Low Alert Threshold</label>
                    <input
                      type="number"
                      className="modal-input-field"
                      value={medForm.low_stock_level}
                      onChange={e => setMedForm({ ...medForm, low_stock_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="modal-form-group">
                    <label>Adequate Threshold</label>
                    <input
                      type="number"
                      className="modal-input-field"
                      value={medForm.adequate_stock_level}
                      onChange={e => setMedForm({ ...medForm, adequate_stock_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Indications & Complaint mapping */}
                <div className="modal-form-group">
                  <label className="input-field-label">Medicine Indications</label>
                  
                  <div className="search-bar-container modal-search" style={{ marginBottom: '10px' }}>
                    <Search size={16} className="search-icon-placement" />
                    <input
                      type="text"
                      className="rounded-search-input"
                      placeholder="Search medicine indication..."
                      value={complaintSearchTerm}
                      onChange={e => setComplaintSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="scrollable-checkbox-box">
                    {filteredComplaints.length > 0 ? (
                      filteredComplaints.map(comp => {
                        const currentIndication = medForm.indications.find(ind => String(ind.complaint_id) === String(comp.complaint_id));
                        const isChecked = !!currentIndication;
                        const needsSpecify = requiresSpecifyText(comp.complaint_name);

                        return (
                          <div key={comp.complaint_id} className="checkbox-item-wrapper">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => toggleComplaint(comp, e.target.checked)}
                              />
                              <span>{comp.complaint_name}</span>
                            </label>

                            {isChecked && needsSpecify && (
                              <input
                                type="text"
                                className="modal-input-field specify-input"
                                placeholder={`Specify details for ${comp.complaint_name}...`}
                                value={currentIndication?.specify_complaint_text || ''}
                                onChange={e => handleSpecifyTextChange(comp.complaint_id, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '4px 0' }}>
                        No matching medical conditions found.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => {
                  setIsMedicineModalOpen(false);
                  setComplaintSearchTerm('');
                }}>Cancel</button>
                <button type="submit" className="btn-primary-action">{isEditingMedicine ? 'Update Medicine' : 'Save Medicine'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Batch Modal */}
      {isBatchModalOpen && (
        <div className="modal-overlay-bg">
          <div className="modal-content-container modal-sm">
            <div className="modal-header-section">
              <h3><Layers size={20} /> {editingBatch ? 'Modify Batch' : 'Add Inventory Batch'}</h3>
              <button 
                className="action-icon-button close-modal" 
                aria-label="Close modal"
                onClick={() => { setIsBatchModalOpen(false); setEditingBatch(null); }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddBatch} className="modal-form-wrapper">
              <div className="modal-body-form scrollable-modal-body">
                <div className="modal-form-group">
                  <label>Select Medicine</label>
                  <select
                    className="modal-select-dropdown"
                    value={batchForm.medicine_id}
                    onChange={e => {
                      const selected = medicinesList.find(m => m.medicine_id === e.target.value);
                      const isDiscrete = selected && DISCRETE_UNITS.includes(selected.dispense_unit_of_measure);
                      setBatchForm({
                        ...batchForm, 
                        medicine_id: e.target.value,
                        remaining_volume: isDiscrete ? 1 : (selected ? selected.strength_unit_value : '')
                      });
                    }}
                    disabled={!!editingBatch}
                    required
                  >
                    <option value="">-- Select Medicine --</option>
                    {medicinesList.map(med => (
                      <option key={med.medicine_id} value={med.medicine_id}>
                        {med.generic_name} ({med.brand_name}) - {med.display_strength_value} {med.display_strength_unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-form-row">
                  <div className="modal-form-group">
                    <label>
                      Current Stock {batchDosageForm ? `(${batchDosageForm})` : 'Units'}
                    </label>
                    <input
                      type="number"
                      className="modal-input-field"
                      min="0"
                      value={batchForm.current_stock}
                      onChange={e => setBatchForm({ ...batchForm, current_stock: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>

                  {selectedMedForBatch && !isBatchDiscreteUnit && (
                    <div className="modal-form-group">
                      <label>
                        Remaining Capacity (in {batchUnitMeasure})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="modal-input-field"
                        value={batchForm.remaining_volume}
                        placeholder={`Max: ${maxBatchVolume} ${batchUnitMeasure}`}
                        onChange={e => setBatchForm({ ...batchForm, remaining_volume: e.target.value })}
                        required
                      />
                      <small className="field-help-text">
                        Enter value measured in <strong>{batchUnitMeasure}</strong> (Max: {maxBatchVolume} {batchUnitMeasure})
                      </small>
                    </div>
                  )}
                </div>

                <div className="modal-form-group">
                  <label>Expiration Date</label>
                  <input
                    type="date"
                    className="modal-input-field"
                    value={batchForm.expiration_date}
                    onChange={e => setBatchForm({ ...batchForm, expiration_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => { setIsBatchModalOpen(false); setEditingBatch(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  {editingBatch ? 'Save Changes' : 'Commit Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}