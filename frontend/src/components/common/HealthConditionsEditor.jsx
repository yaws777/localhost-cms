import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Paperclip, X } from 'lucide-react';
import '../../styles/student/HealthHistoryForm.css';

// ---------------------------------------------------------------------------
// One health-conditions editor for the student's Health History form and the
// nurse's edit of it: a card per condition, its fields inside, an optional proof file.
// Parent renders it inside an element with the `hh-page` class (the hh-* styles hang on it).
// ---------------------------------------------------------------------------

// Field builders. `group`: at least one member of the same group must be filled.
const text = (name, label, group) => ({ kind: 'text', name, label, group });
const num = (name, label) => ({ kind: 'number', name, label });
const date = (name, label) => ({ kind: 'date', name, label });
const checks = (items, title, group) => ({ kind: 'checks', items, title, group });

export const CONDITIONS = [
    {
        key: 'has_allergies', label: 'History of Allergies', fields: [
            text('allergy_food', 'Food:', 'type'),
            text('allergy_medicine', 'Medicine:', 'type'),
            text('allergy_insect_sting', 'Insect Sting:', 'type'),
            text('allergy_environmental', 'Environmental:', 'type'),
            text('allergy_others', 'Others:', 'type'),
            checks([
                ['reaction_diarrhea', 'Diarrhea'], ['reaction_hives', 'Hives'], ['reaction_local', 'Local Reaction'],
                ['reaction_rash', 'Rash'], ['reaction_swelling', 'Swelling'], ['reaction_trouble_breathing', 'Trouble Breathing']
            ], 'Reactions:', 'reaction'),
            text('reaction_others', 'Other Reaction:', 'reaction'),
            text('allergy_medication_taken', 'Medication Taken:')
        ]
    },
    { key: 'has_asthma', label: 'Asthma', fields: [text('asthma_triggers', 'Triggers:'), text('asthma_medication_taken', 'Medication Taken:')] },
    { key: 'has_other_respiratory', label: 'Other Respiratory Illness', fields: [text('other_respiratory_specify', 'Specify:'), text('other_respiratory_medication', 'Medication Taken:')] },
    {
        key: 'has_blood_disorders', label: 'Blood Disorders', fields: [
            checks([['blood_disorder_anemia', 'Anemia'], ['blood_disorder_leukopenia', 'Leukopenia'], ['blood_disorder_thrombocytopenia', 'Thrombocytopenia']], null, 'type')
        ]
    },
    { key: 'has_chicken_pox', label: 'Chicken Pox / Bulutong', fields: [num('chicken_pox_age', 'Age:')] },
    {
        key: 'has_digestive_disorders', label: 'Digestive Disorders', fields: [
            checks([['digestive_ulcer', 'Ulcer'], ['digestive_appendicitis', 'Appendicitis'], ['digestive_gastritis', 'Gastritis'], ['digestive_hemorrhoids', 'Hemorrhoids']], null, 'type'),
            text('digestive_medication_taken', 'Medication Taken:')
        ]
    },
    { key: 'has_heart_problems', label: 'Heart Problems', fields: [text('heart_problems_specify', 'Specify:'), text('heart_problems_medication', 'Medication:')] },
    { key: 'has_kidney_bladder_problems', label: 'Kidney or Bladder Problems', fields: [text('kidney_bladder_specify', 'Specify:'), text('kidney_bladder_medication', 'Medication:')] },
    { key: 'has_measles', label: 'Measles / Tigdas', fields: [num('measles_age', 'Age:')] },
    {
        key: 'has_metabolic_diseases', label: 'Metabolic Diseases', fields: [
            checks([['metabolic_hyperglycemia', 'Hyperglycemia'], ['metabolic_hypoglycemia', 'Hypoglycemia']], null, 'type')
        ]
    },
    { key: 'has_muscle_bone_disorder', label: 'Muscle/Bone/Mobility Disorder', fields: [text('muscle_bone_specify', 'Specify:')] },
    { key: 'has_seizure_episode', label: 'Seizure Episode', fields: [date('seizure_last_episode_date', 'Date of last episode:'), text('seizure_medication_taken', 'Medication:')] },
    { key: 'has_surgery', label: 'Surgery', fields: [text('surgery_specify', 'Specify:'), date('surgery_date', 'Date:')] },
    {
        key: 'has_vision_problem', label: 'Vision Problem', fields: [
            text('vision_specify', 'Specify:'),
            checks([['vision_with_eyeglasses', 'with eyeglasses'], ['vision_with_contact_lens', 'with contact lens']])
        ]
    },
    { key: 'has_hearing_problem', label: 'Hearing Problem', fields: [text('hearing_specify', 'Specify:')] },
    { key: 'has_other_condition', label: 'Other health condition not listed', fields: [text('other_condition_specify', 'Specify:')] }
];

const namesOf = (f) => (f.kind === 'checks' ? f.items.map(([name]) => name) : [f.name]);

// condition key -> every field name inside it
const CONDITION_NAMES = {};
// field name -> every field name of its condition (to clear the red flags together)
const GROUP_MEMBERS = {};
// every column the form owns, with its empty value
export const EMPTY_HEALTH_INFO = {};
CONDITIONS.forEach((c) => {
    CONDITION_NAMES[c.key] = c.fields.flatMap(namesOf);
    CONDITION_NAMES[c.key].forEach((n) => { GROUP_MEMBERS[n] = CONDITION_NAMES[c.key]; });
    EMPTY_HEALTH_INFO[c.key] = false;
    c.fields.forEach((f) => {
        if (f.kind === 'checks') f.items.forEach(([name]) => { EMPTY_HEALTH_INFO[name] = false; });
        else EMPTY_HEALTH_INFO[f.name] = '';
    });
});

// A saved record (null columns, 1 / 0 flags) -> the shape the form edits
export const toFormInfo = (raw) => {
    const out = { ...EMPTY_HEALTH_INFO };
    Object.keys(EMPTY_HEALTH_INFO).forEach((key) => {
        const v = raw ? raw[key] : undefined;
        if (typeof EMPTY_HEALTH_INFO[key] === 'boolean') out[key] = v === true || v === 1 || v === '1';
        else out[key] = v === null || v === undefined ? '' : v;
    });
    return out;
};

const isFilled = (v) => (typeof v === 'boolean' ? v : v !== null && v !== undefined && String(v).trim() !== '');

// A checked condition needs at least ONE of its inputs filled. Returns the
// invalid field names, the condition keys to open and the labels for the message.
export const findHealthProblems = (info) => {
    const invalidNames = [];
    const keys = [];
    const labels = [];
    CONDITIONS.forEach((c) => {
        if (!info[c.key]) return;
        const names = CONDITION_NAMES[c.key];
        if (!names.some((n) => isFilled(info[n]))) {
            invalidNames.push(...names);
            keys.push(c.key);
            labels.push(c.label);
        }
    });
    return { invalidNames, keys, labels };
};

const proofUrl = (url) => {
    if (!url) return '#';
    if (/^https?:\/\//.test(url)) return url;
    return `http://localhost:3001${url.startsWith('/') ? '' : '/'}${url}`;
};

// ---------------------------------------------------------------------------
// State of the editor: values, open cards, red flags, picked proof files
// ---------------------------------------------------------------------------
export function useHealthConditions(initial, { openTicked = false } = {}) {
    const [info, setInfo] = useState(() => toFormInfo(initial));
    // Which condition cards are expanded. Expanding never checks a condition.
    const [openCards, setOpenCards] = useState(() => {
        const open = {};
        if (openTicked) CONDITIONS.forEach((c) => { if (toFormInfo(initial)[c.key]) open[c.key] = true; });
        return open;
    });
    // Field names flagged as missing after a failed save
    const [invalid, setInvalid] = useState({});
    // Optional proof file per condition, keyed by its has_* flag
    const [proofFiles, setProofFiles] = useState({});

    // Clear the red flag on a field (and on its whole "at least one" group)
    const clearInvalid = useCallback((names) => {
        setInvalid((prev) => {
            if (!names.some((n) => prev[n])) return prev;
            const next = { ...prev };
            names.forEach((n) => { delete next[n]; });
            return next;
        });
    }, []);

    const setField = useCallback((name, value) => {
        setInfo((prev) => ({ ...prev, [name]: value }));
        clearInvalid(GROUP_MEMBERS[name] || [name]);
    }, [clearInvalid]);

    // The condition checkbox: checking opens its card, unchecking closes it
    const toggleCondition = useCallback((key, checked) => {
        setInfo((prev) => ({ ...prev, [key]: checked }));
        setOpenCards((prev) => ({ ...prev, [key]: checked }));
        if (!checked) clearInvalid(CONDITION_NAMES[key]);
    }, [clearInvalid]);

    // The title / arrow only expands or collapses, never checks
    const toggleCard = useCallback((key) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] })), []);

    const setProof = useCallback((key, file) => setProofFiles((prev) => ({ ...prev, [key]: file })), []);

    // Flags the empty conditions and opens them. Returns the problems found.
    const validate = useCallback(() => {
        const problems = findHealthProblems(info);
        if (problems.invalidNames.length) {
            const flags = {};
            problems.invalidNames.forEach((n) => { flags[n] = true; });
            setInvalid(flags);
            setOpenCards((prev) => {
                const next = { ...prev };
                problems.keys.forEach((k) => { next[k] = true; });
                return next;
            });
        }
        return problems;
    }, [info]);

    // Files that go with the request: only for conditions still ticked
    const filesToSend = () => Object.entries(proofFiles).filter(([key, file]) => file && info[key]);

    return { info, openCards, invalid, proofFiles, setField, toggleCondition, toggleCard, setProof, validate, filesToSend };
}

// ---------------------------------------------------------------------------
// Optional proof file input with a live preview (image thumbnail, or file name for PDFs)
// `saved` = the proof already stored for this condition (shown until a new file is picked)
// ---------------------------------------------------------------------------
export function ProofUpload({ id, file, onChange, saved }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    // Bumped on Remove so the native file input is remounted and clears its filename
    const [inputKey, setInputKey] = useState(0);

    useEffect(() => {
        if (!file || !file.type.startsWith('image/')) {
            setPreviewUrl(null);
            return undefined;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <div className="hh-proof hh-span-all">
            <label className="hh-lbl" htmlFor={id}>{saved ? 'Replace Proof (Optional):' : 'Upload Proof (Optional):'}</label>
            {saved && !file && (
                <p className="hh-proof-row">
                    <span className="hh-proof-name">
                        <Paperclip className="hh-ic" aria-hidden="true" />
                        <a href={proofUrl(saved.file_url)} target="_blank" rel="noopener noreferrer">{saved.original_name || 'View proof'}</a>
                    </span>
                </p>
            )}
            <input
                key={inputKey}
                id={id}
                className="hh-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => onChange(e.target.files[0] || null)}
            />
            {file && (
                <div className="hh-proof-card">
                    <div className="hh-proof-row">
                        <span className="hh-proof-name">
                            <Paperclip className="hh-ic" aria-hidden="true" />
                            <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                        </span>
                        <button
                            type="button"
                            className="hh-btn hh-btn-secondary"
                            onClick={() => { onChange(null); setInputKey((k) => k + 1); }}
                        >
                            <X className="hh-ic" aria-hidden="true" /> Remove
                        </button>
                    </div>
                    {previewUrl && <img src={previewUrl} alt="Proof preview" />}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// The cards. `editor` = useHealthConditions(); `savedProofs` = { has_x: { file_url, original_name } }
// `idPrefix` keeps ids unique when two editors could exist on a page.
// ---------------------------------------------------------------------------
export default function HealthConditionsEditor({ editor, savedProofs, idPrefix = '' }) {
    const { info, openCards, invalid, proofFiles, setField, toggleCondition, toggleCard, setProof } = editor;
    const pid = (name) => `${idPrefix}${name}`;

    const renderField = (f) => {
        if (f.kind === 'checks') {
            const chips = (
                <div className="hh-chips">
                    {f.items.map(([name, label]) => (
                        <label key={name} className="hh-chip">
                            <input
                                type="checkbox"
                                id={pid(name)}
                                name={name}
                                checked={!!info[name]}
                                onChange={(e) => setField(name, e.target.checked)}
                                aria-invalid={invalid[name] ? 'true' : undefined}
                            /> {label}
                        </label>
                    ))}
                </div>
            );
            return f.title ? (
                <fieldset key={f.items[0][0]} className="hh-group hh-span-all">
                    <legend>{f.title}</legend>
                    {chips}
                </fieldset>
            ) : (
                <div key={f.items[0][0]} className="hh-chips-wrap hh-span-all">
                    {chips}
                </div>
            );
        }
        return (
            <label key={f.name} className="hh-field" htmlFor={pid(f.name)}>
                <span className="hh-lbl">{f.label}</span>
                <input
                    id={pid(f.name)}
                    type={f.kind}
                    name={f.name}
                    min={f.kind === 'number' ? 0 : undefined}
                    value={info[f.name]}
                    onChange={(e) => setField(f.name, e.target.value)}
                    aria-invalid={invalid[f.name] ? 'true' : undefined}
                />
            </label>
        );
    };

    return (
        <div className="hh-conds">
            {CONDITIONS.map((c) => {
                const checked = !!info[c.key];
                const isOpen = !!openCards[c.key];
                return (
                    <div key={c.key} className={`hh-cond${checked ? ' is-checked' : ''}${isOpen ? ' is-open' : ''}`}>
                        <div className="hh-cond-head">
                            <label className="hh-cond-check">
                                <input
                                    type="checkbox"
                                    id={pid(c.key)}
                                    name={c.key}
                                    aria-label={c.label}
                                    checked={checked}
                                    onChange={(e) => toggleCondition(c.key, e.target.checked)}
                                />
                            </label>
                            <button
                                type="button"
                                className="hh-cond-btn"
                                aria-expanded={isOpen}
                                aria-controls={pid(`panel_${c.key}`)}
                                onClick={() => toggleCard(c.key)}
                            >
                                <span>{c.label}</span>
                                <ChevronDown className="hh-ic hh-chev" aria-hidden="true" />
                            </button>
                        </div>
                        {isOpen && (
                            <div className="hh-panel" id={pid(`panel_${c.key}`)}>
                                <fieldset className="hh-fields" disabled={!checked}>
                                    <ProofUpload
                                        id={pid(`proof_${c.key}`)}
                                        file={proofFiles[c.key]}
                                        onChange={(file) => setProof(c.key, file)}
                                        saved={savedProofs ? savedProofs[c.key] : undefined}
                                    />
                                    {c.fields.map(renderField)}
                                </fieldset>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
