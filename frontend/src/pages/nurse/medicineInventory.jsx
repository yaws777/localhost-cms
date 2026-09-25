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
  Settings2
} from 'lucide-react';
import '../../styles/nurse/MedicineInventory.css'; 

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

const DOSAGE_FORM_UNITS = {
  'Tablet': ['mg', 'g', 'mcg', 'Tablet/s'],
  'Capsule': ['mg', 'g', 'mcg', 'Capsule/s'],
  'Sachet': ['mg', 'g', 'mcg', 'Sachet'],
  'Patch': ['mg', 'mcg', 'Patch/es'],
  'Inhaler': ['mg', 'mcg', 'Inhaler'],
  'Syrup': ['mL', 'L', 'mg', 'mcg'],
  'Suspension': ['mL', 'L', 'mg', 'mcg'],
  'Drops': ['mL', 'L', 'mg', 'mcg'],
  'Bottle': ['mL', 'L', 'mg', 'mcg'],
  'Vial': ['mL', 'L', 'mg', 'mcg', 'Vial'],
  'Prefilled Syringe': ['mL', 'mg', 'Prefilled Syringe'],
  'Ointment': ['g', 'mg', 'mL'],
  'Cream': ['g', 'mg', 'mL'],
  'Gel': ['g', 'mg', 'mL'],
  'Spray': ['mg', 'mcg', 'mL', 'Spray/s'],
  'Box': [ 'Box/es', 'pcs.']
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

export default function MedicineInventory() {
  const [inventory, setInventory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
  const [isManageMedicinesOpen, setIsManageMedicinesOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  
  const [medicineSearchTerm, setMedicineSearchTerm] = useState('');
  const [isEditingMedicine, setIsEditingMedicine] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState(null);

  const initialMedForm = {
    generic_name: '',
    brand_name: '',
    dosage_form: 'Tablet',
    strength_unit_value: '',
    strength_unit_of_measure: 'mg',
    avg_dosage_consumption_value: '',
    avg_dosage_consumption_unit_of_measure: 'mg',
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
    const validStrengthUnits = DOSAGE_FORM_UNITS[form] || [];
    const defaultStrengthUnit = validStrengthUnits[0] || '';
    const isDiscrete = DISCRETE_UNITS.includes(defaultStrengthUnit);
    const validConsumptionUnits = getConsumptionUnitOptions(defaultStrengthUnit);
    
    setMedForm(prev => ({
      ...prev,
      dosage_form: form,
      strength_unit_of_measure: defaultStrengthUnit,
      strength_unit_value: isDiscrete ? '1' : prev.strength_unit_value,
      avg_dosage_consumption_value: isDiscrete ? '1' : prev.avg_dosage_consumption_value,
      avg_dosage_consumption_unit_of_measure: isDiscrete ? defaultStrengthUnit : (validConsumptionUnits[0] || defaultStrengthUnit)
    }));
  };

  const handleStrengthUnitChange = (unit) => {
    const isDiscrete = DISCRETE_UNITS.includes(unit);
    const validConsumptionUnits = getConsumptionUnitOptions(unit);

    setMedForm(prev => ({
      ...prev,
      strength_unit_of_measure: unit,
      strength_unit_value: isDiscrete ? '1' : prev.strength_unit_value,
      avg_dosage_consumption_value: isDiscrete ? '1' : prev.avg_dosage_consumption_value,
      avg_dosage_consumption_unit_of_measure: isDiscrete ? unit : (validConsumptionUnits[0] || unit)
    }));
  };

  const getStockStatus = (stock, lowThreshold = 10, criticalThreshold = 5) => {
    if (stock <= criticalThreshold) return { label: 'Critical', class: 'critical' };
    if (stock <= lowThreshold) return { label: 'Low Stock', class: 'low' };
    return { label: 'Adequate', class: 'adequate' };
  };

  const getExpirationAlert = (expiryDate) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const exp = new Date(expiryDate);
    exp.setHours(0,0,0,0);
    
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { msg: '🚨 Expired!', style: { color: '#B42318', fontWeight: 'bold' } };
    } else if (diffDays <= 7) {
      return { msg: `⚠️ Alert (${diffDays} days left)`, style: { color: '#B54708', fontWeight: '600' } };
    }
    return { msg: expiryDate, style: { color: 'inherit' } };
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

    const isDiscrete = DISCRETE_UNITS.includes(medForm.strength_unit_of_measure);
    const payload = {
      ...medForm,
      strength_unit_value: isDiscrete ? 1 : (parseFloat(medForm.strength_unit_value) || 1),
      avg_dosage_consumption_value: isDiscrete ? 1 : (parseFloat(medForm.avg_dosage_consumption_value) || 1),
      avg_dosage_consumption_unit_of_measure: isDiscrete ? medForm.strength_unit_of_measure : medForm.avg_dosage_consumption_unit_of_measure,
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
    const isDiscrete = selectedMed && DISCRETE_UNITS.includes(selectedMed.strength_unit_of_measure);
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
    if (!window.confirm('Confirm deletion of this batch entry?')) return;
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

  const selectedMedForBatch = medicinesList.find(m => m.medicine_id === batchForm.medicine_id);
  const isBatchDiscreteUnit = selectedMedForBatch && DISCRETE_UNITS.includes(selectedMedForBatch.strength_unit_of_measure);
  const batchUnitMeasure = selectedMedForBatch ? selectedMedForBatch.strength_unit_of_measure : '';
  const maxBatchVolume = selectedMedForBatch ? selectedMedForBatch.strength_unit_value : null;

  const isCurrentMedDiscrete = DISCRETE_UNITS.includes(medForm.strength_unit_of_measure);

  return (
    <div className="inventory-dashboard">
      <div className="dashboard-header-container">
        <div className="dashboard-title-area">
          <h1>Medicine Inventory</h1>
          <p className="dashboard-subtitle">Manage clinic medicine stock and monitor shortage alerts</p>
        </div>
        
        <div className="header-actions-group">
          <button className="btn-secondary-action" onClick={() => {
            setMedForm(initialMedForm);
            setIsEditingMedicine(false);
            setIsMedicineModalOpen(true);
          }}>
            <PlusCircle size={18} /> Add Medicine Item
          </button>
          
          <button className="btn-secondary-action" onClick={() => setIsManageMedicinesOpen(true)}>
            <Settings2 size={18} /> Edit Medicine Item
          </button>

          <button className="btn-primary-action" onClick={() => setIsBatchModalOpen(true)}>
            <Layers size={18} /> Add Batches
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
            {inventory.filter(i => i.current_stock > i.critical_stock_level && i.current_stock <= i.low_stock_level).length}
          </div>
          <div className="metric-card-label">Low Stock</div>
        </div>
        <div className="centered-metric-card">
          <div className="metric-card-icon critical"><Activity size={22} /></div>
          <div className="metric-card-value">
            {inventory.filter(i => i.current_stock <= i.critical_stock_level).length}
          </div>
          <div className="metric-card-label">Critical</div>
        </div>
      </div>

      {/* Main Inventory Search Bar (Searches medicine names AND chief complaints/indications) */}
      <div className="search-bar-container">
        <Search size={18} className="search-icon-placement" />
        <input
          type="text"
          className="rounded-search-input"
          placeholder="Search inventory by medicine or complaint/indication..."
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
              const statusEval = getStockStatus(item.current_stock, item.low_stock_level, item.critical_stock_level);
              const expiryDetails = getExpirationAlert(item.expiration_date);
              const isDiscreteItem = DISCRETE_UNITS.includes(item.strength_unit_of_measure);

              return (
                <tr key={item.batch_id}>
                  <td>
                    <span className="med-title-text">{item.generic_name} ({item.brand_name})</span>
                    <small style={{ color: '#667085' }}>{item.dosage_form} - {item.display_strength}</small>
                  </td>
                  <td><span className="med-indications-subtitle">{item.connected_complaints || 'Unmapped'}</span></td>
                  <td>
                    <div className="stock-visualization-wrapper">
                      <span className="stock-count-number">{item.current_stock} units</span>
                      <div className="stock-progress-track">
                        <div 
                          className={`stock-progress-bar ${statusEval.class}`}
                          style={{ width: `${Math.min((item.current_stock / (item.adequate_stock_level || 30)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{isDiscreteItem ? 'N/A' : item.display_remaining}</strong>
                  </td>
                  <td><span style={expiryDetails.style}>{expiryDetails.msg}</span></td>
                  <td><span className={`pill-badge ${statusEval.class}`}>{statusEval.label}</span></td>
                  <td>
                    <div className="table-action-row-buttons" style={{ justifyContent: 'center' }}>
                      <button
                        className="action-icon-button edit"
                        title="Adjust Volume / Stock"
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
          <div className="modal-content-container" style={{ maxWidth: '650px' }}>
            <div className="modal-header-section">
              <h3><Settings2 size={20} /> Edit Medicines</h3>
              <button className="action-icon-button" onClick={() => setIsManageMedicinesOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-form">
              <div className="search-bar-container" style={{ margin: '0 0 15px 0' }}>
                <Search size={18} className="search-icon-placement" />
                <input
                  type="text"
                  className="rounded-search-input"
                  placeholder="Search medicines by name or complaint..."
                  value={medicineSearchTerm}
                  onChange={e => setMedicineSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e4e7ec', borderRadius: '8px' }}>
                <table className="clean-dashboard-table">
                  <tbody>
                    {medicinesList
                      .filter(m => {
                        const query = medicineSearchTerm.toLowerCase();
                        const medName = `${m.generic_name} ${m.brand_name}`.toLowerCase();
                        const complaintsText = (m.connected_complaints || '').toLowerCase();
                        return medName.includes(query) || complaintsText.includes(query);
                      })
                      .map(med => {
                        const isDiscreteMed = DISCRETE_UNITS.includes(med.strength_unit_of_measure);
                        return (
                          <tr key={med.medicine_id}>
                            <td style={{ fontWeight: '500' }}>
                              {med.generic_name} ({med.brand_name})
                              <div style={{ fontSize: '0.75rem', color: '#667085' }}>
                                {med.dosage_form} | {med.display_strength_value} {med.display_strength_unit}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#475467' }}>
                                <em>Indications: {med.connected_complaints || 'None'}</em>
                              </div>
                            </td>
                            <td style={{ width: '80px', textAlign: 'center' }}>
                              <button
                                className="action-icon-button edit"
                                onClick={() => {
                                  setEditingMedicineId(med.medicine_id);
                                  setMedForm({
                                    generic_name: med.generic_name,
                                    brand_name: med.brand_name,
                                    dosage_form: med.dosage_form,
                                    strength_unit_value: isDiscreteMed ? '1' : med.strength_unit_value,
                                    strength_unit_of_measure: med.strength_unit_of_measure,
                                    avg_dosage_consumption_value: isDiscreteMed ? '1' : med.avg_dosage_consumption_value,
                                    avg_dosage_consumption_unit_of_measure: isDiscreteMed ? med.strength_unit_of_measure : med.avg_dosage_consumption_unit_of_measure,
                                    low_stock_level: med.low_stock_level,
                                    critical_stock_level: med.critical_stock_level,
                                    adequate_stock_level: med.adequate_stock_level,
                                    indications: med.indications || []
                                  });
                                  setIsEditingMedicine(true);
                                  setIsManageMedicinesOpen(false);
                                  setIsMedicineModalOpen(true);
                                }}
                              >
                                <Edit size={16} /> Edit
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
          <div className="modal-content-container" style={{ maxWidth: '600px' }}>
            <div className="modal-header-section">
              <h3><FilePlus2 size={20} /> {isEditingMedicine ? 'Edit Medicine' : 'Create Medicine Item'}</h3>
              <button 
                className="action-icon-button" 
                onClick={() => {
                  setIsMedicineModalOpen(false);
                  setIsEditingMedicine(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveMedicine}>
              <div className="modal-body-form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="modal-form-group" style={{ flex: 1 }}>
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
                  <div className="modal-form-group" style={{ flex: 1 }}>
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

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="modal-form-group" style={{ flex: 1 }}>
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
                  <div className="modal-form-group" style={{ flex: 1 }}>
                    <label>Strength Unit Value</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      className="modal-input-field"
                      value={medForm.strength_unit_value}
                      onChange={e => setMedForm({ ...medForm, strength_unit_value: e.target.value })}
                      disabled={isCurrentMedDiscrete}
                      required
                    />
                  </div>
                  <div className="modal-form-group" style={{ flex: 1 }}>
                    <label>Strength Unit of Measure</label>
                    <select
                      className="modal-select-dropdown"
                      value={medForm.strength_unit_of_measure}
                      onChange={e => handleStrengthUnitChange(e.target.value)}
                      required
                    >
                      {(DOSAGE_FORM_UNITS[medForm.dosage_form] || []).map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isCurrentMedDiscrete && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="modal-form-group" style={{ flex: 1 }}>
                      <label>Avg Dosage Value</label>
                      <input
                        type="number"
                        step="0.01"
                        className="modal-input-field"
                        value={medForm.avg_dosage_consumption_value}
                        onChange={e => setMedForm({ ...medForm, avg_dosage_consumption_value: e.target.value })}
                      />
                    </div>
                    <div className="modal-form-group" style={{ flex: 1 }}>
                      <label>Avg Dosage Unit of Measure</label>
                      <select
                        className="modal-select-dropdown"
                        value={medForm.avg_dosage_consumption_unit_of_measure}
                        onChange={e => setMedForm({ ...medForm, avg_dosage_consumption_unit_of_measure: e.target.value })}
                      >
                        {getConsumptionUnitOptions(medForm.strength_unit_of_measure).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="modal-form-group" style={{ flex: 1 }}>
                    <label>Critical Alert Threshold</label>
                    <input
                      type="number"
                      className="modal-input-field"
                      value={medForm.critical_stock_level}
                      onChange={e => setMedForm({ ...medForm, critical_stock_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="modal-form-group" style={{ flex: 1 }}>
                    <label>Low Alert Threshold</label>
                    <input
                      type="number"
                      className="modal-input-field"
                      value={medForm.low_stock_level}
                      onChange={e => setMedForm({ ...medForm, low_stock_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="modal-form-group" style={{ flex: 1 }}>
                    <label>Adequate Threshold</label>
                    <input
                      type="number"
                      className="modal-input-field"
                      value={medForm.adequate_stock_level}
                      onChange={e => setMedForm({ ...medForm, adequate_stock_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Indications & Complaint mapping with specify_complaint_text for specific complaints */}
                <div className="modal-form-group">
                  <label>Indications / Chief Complaints</label>
                  <div className="scrollable-checkbox-box">
                    {complaints.map(comp => {
                      const currentIndication = medForm.indications.find(ind => String(ind.complaint_id) === String(comp.complaint_id));
                      const isChecked = !!currentIndication;
                      const needsSpecify = requiresSpecifyText(comp.complaint_name);

                      return (
                        <div key={comp.complaint_id} style={{ marginBottom: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
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
                              className="modal-input-field"
                              placeholder={`Specify details for ${comp.complaint_name}...`}
                              value={currentIndication?.specify_complaint_text || ''}
                              onChange={e => handleSpecifyTextChange(comp.complaint_id, e.target.value)}
                              style={{ marginTop: '4px', marginLeft: '24px', width: 'calc(100% - 24px)' }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="modal-footer-actions">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsMedicineModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action">{isEditingMedicine ? 'Update Medicine' : 'Save Medicine'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Batch Modal */}
      {isBatchModalOpen && (
        <div className="modal-overlay-bg">
          <div className="modal-content-container">
            <div className="modal-header-section">
              <h3><Layers size={20} /> {editingBatch ? 'Modify Batch' : 'Add Inventory Batch'}</h3>
              <button className="action-icon-button" onClick={() => { setIsBatchModalOpen(false); setEditingBatch(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddBatch}>
              <div className="modal-body-form">
                <div className="modal-form-group">
                  <label>Select Medicine</label>
                  <select
                    className="modal-select-dropdown"
                    value={batchForm.medicine_id}
                    onChange={e => {
                      const selected = medicinesList.find(m => m.medicine_id === e.target.value);
                      const isDiscrete = selected && DISCRETE_UNITS.includes(selected.strength_unit_of_measure);
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
                        {med.generic_name} ({med.brand_name}) - {med.strength_unit_of_measure}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="modal-form-group" style={{ flex: 1 }}>
                    <label>Current Stock Units</label>
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
                    <div className="modal-form-group" style={{ flex: 1 }}>
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
                      <small style={{ color: '#667085', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
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
