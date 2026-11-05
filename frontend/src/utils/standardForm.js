// standardForm.js
// The standard check-up form of a doctor: an ordered list of fields, edited in Templates exactly like a template (label, type, options, hint,
// required, unit, add, remove, reorder). Four fields are saved in the assessment itself (chief complaint, clinical findings, diagnosis,
// treatment plan: the `core` keys); every other field is the doctor's own question and its answer is saved with the check-up under its key (s1, s2 ...).
// The server (GET /api/doctor/:id/standard-form) returns the saved form merged with these defaults.
export const CORE_KEYS = ['chief_complaint', 'clinical_findings', 'diagnosis', 'treatment_recommendations'];
export const CORE_NAMES = {
    chief_complaint: 'Chief complaint',
    clinical_findings: 'Clinical findings',
    diagnosis: 'Diagnosis',
    treatment_recommendations: 'Treatment plan'
};
export const isCoreKey = (key) => CORE_KEYS.includes(key);
export const isExtraKey = (key) => /^s\d+$/.test(String(key || ''));

export const STANDARD_FORM_DEFAULT = {
    fields: [
        { key: 'chief_complaint', label: 'Why the student came (reason for the check-up)', type: 'text', required: true, hint: 'e.g. Headache and fever since yesterday', options: undefined, unit: '' },
        { key: 'clinical_findings', label: 'Clinical findings', type: 'textarea', required: true, hint: '', options: undefined, unit: '' },
        { key: 'diagnosis', label: 'Diagnosis', type: 'textarea', required: true, hint: '', options: undefined, unit: '' },
        { key: 'treatment_recommendations', label: 'Treatment plan / recommendations', type: 'textarea', required: true, hint: '', options: undefined, unit: '' }
    ],
    prescription_enabled: true
};

// A core field is stored as text in the assessment: a checklist becomes "a, b"
export const asText = (value) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''));
