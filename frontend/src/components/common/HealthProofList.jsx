import React from 'react';

const CONDITION_LABELS = {
    has_allergies: 'History of Allergies',
    has_asthma: 'Asthma',
    has_other_respiratory: 'Other Respiratory Problems',
    has_blood_disorders: 'Blood Disorders',
    has_chicken_pox: 'Chicken Pox',
    has_digestive_disorders: 'Digestive Disorders',
    has_heart_problems: 'Heart Problems',
    has_kidney_bladder_problems: 'Kidney/Bladder Problems',
    has_measles: 'Measles',
    has_metabolic_diseases: 'Metabolic Diseases',
    has_muscle_bone_disorder: 'Muscle/Bone Disorder',
    has_seizure_episode: 'Seizure Episode',
    has_surgery: 'History of Surgery',
    has_vision_problem: 'Vision Problem',
    has_hearing_problem: 'Hearing Problem',
    has_other_condition: 'Other Condition'
};

const getFileUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://localhost:3001${url.startsWith('/') ? '' : '/'}${url}`;
};

// Lists the optional proof files uploaded with the Health History form.
export default function HealthProofList({ proofs }) {
    const entries = Object.entries(proofs || {}).filter(([key]) => CONDITION_LABELS[key]);
    if (entries.length === 0) return null;

    return (
        <div className="health-proof-list" style={{ margin: '12px 0 18px' }}>
            <h4 style={{ margin: '0 0 6px' }}>Uploaded Proofs</h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
                {entries.map(([key, proof]) => {
                    const url = getFileUrl(proof.file_url);
                    const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(proof.file_url || '');
                    return (
                        <li key={key} style={{ marginBottom: '8px' }}>
                            {CONDITION_LABELS[key]}:{' '}
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                {proof.original_name || 'View proof'}
                            </a>
                            {isImage && (
                                <div>
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={url}
                                            alt={`${CONDITION_LABELS[key]} proof`}
                                            style={{ marginTop: '4px', maxWidth: '160px', maxHeight: '120px', borderRadius: '6px', border: '1px solid #e2e8f0', objectFit: 'cover' }}
                                        />
                                    </a>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
