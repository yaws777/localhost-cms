// assessmentSuggestions.js
// Pick lists for the check-up form (chief complaint, diagnosis, prescription parts) and the treatment plan that writes itself
// from the diagnosis, the complaint, the vital signs, the prescription and the follow-up. The doctor can edit the plan or write it again.
import { abnormalVitals, VITAL_FIELDS } from './vitals';

export const OTHER = 'Other';

// which list a check-up purpose uses (purposes come from the specializations table, so match by words)
export const visitGroupOf = (visitType) => {
    const t = String(visitType || '');
    if (/dental|dentist|oral/i.test(t)) return 'dental';
    if (/vision|eye|optom|ophthal/i.test(t)) return 'vision';
    return 'general';
};

const COMPLAINTS = {
    general: [
        'Headache', 'Fever', 'Cough and colds', 'Sore throat', 'Stomach ache', 'Nausea or vomiting', 'Diarrhea', 'Dizziness',
        'Body or muscle pain', 'Menstrual cramps', 'Skin rash or itching', 'Injury or wound', 'Difficulty breathing', 'Fatigue or weakness',
        'Medical clearance'
    ],
    dental: ['Toothache', 'Bleeding or swollen gums', 'Sensitive teeth', 'Broken or chipped tooth', 'Cavity', 'Mouth sores', 'Braces concern', 'Oral check-up'],
    vision: ['Blurred vision', 'Eye pain or redness', 'Itchy or watery eyes', 'Eye strain', 'Cannot read the board', 'Headache when reading', 'Eye exam or glasses']
};

// name -> care lines of the treatment plan
const DIAGNOSES = {
    general: {
        'Tension headache': ['Rest in a quiet, well lit place and drink enough water.', 'Limit screen time and take regular breaks.', 'Get 7 to 8 hours of sleep.'],
        'Migraine': ['Rest in a dark, quiet room.', 'Avoid known triggers (skipped meals, lack of sleep, bright light).', 'Keep a headache diary.'],
        'Viral fever or flu': ['Rest and drink plenty of fluids.', 'Wear a mask and stay away from classes until the fever is gone for 24 hours.', 'Monitor the temperature every 4 to 6 hours.'],
        'Upper respiratory infection': ['Rest and drink warm fluids.', 'Wash hands often and cover the mouth when coughing.', 'Wear a mask while symptoms last.'],
        'Acute sore throat': ['Gargle with warm salt water.', 'Drink warm fluids and avoid cold or fried food.', 'Rest the voice.'],
        'Acute gastritis': ['Eat small, frequent, bland meals.', 'Avoid spicy, oily and acidic food, coffee and soft drinks.', 'Do not skip meals.'],
        'Gastroenteritis': ['Drink oral rehydration solution and plenty of fluids.', 'Eat a bland diet (rice, banana, toast).', 'Wash hands before eating and after using the toilet.'],
        'Dysmenorrhea': ['Apply a warm compress on the lower abdomen.', 'Rest and drink warm fluids.', 'Light exercise and enough sleep can help.'],
        'Allergic reaction or dermatitis': ['Avoid the suspected trigger.', 'Keep the skin clean and do not scratch.', 'Apply a cool compress on the itchy area.'],
        'Minor wound or abrasion': ['Wound cleaned and dressed.', 'Keep the wound clean and dry; change the dressing daily.', 'Watch for redness, swelling, pus or fever.'],
        'Muscle strain or sprain': ['Rest the affected part and avoid strenuous activity.', 'Apply a cold compress for 15 minutes, several times a day, for the first 48 hours.', 'Keep the area elevated.'],
        'Dehydration': ['Drink water or oral rehydration solution little by little.', 'Rest in a cool place.', 'Avoid sweet drinks and caffeine.'],
        'Fatigue or lack of sleep': ['Sleep at least 8 hours at regular times.', 'Eat balanced meals and drink enough water.', 'Limit late-night screen use.'],
        'Elevated blood pressure': ['Rest and recheck the blood pressure after 15 minutes.', 'Limit salty food and caffeine.', 'Refer for further evaluation if it stays high.'],
        'Asthma': ['Avoid triggers (dust, smoke, strong smells, cold air).', 'Keep the rescue inhaler within reach.', 'Seek help right away if breathing becomes difficult.'],
        'No findings': ['No treatment needed.', 'Keep up healthy habits: balanced meals, enough water, regular sleep and exercise.']
    },
    dental: {
        'Dental caries': ['Dental filling or restoration is advised.', 'Brush twice a day with fluoride toothpaste and floss daily.', 'Limit sweet food and drinks.'],
        'Gingivitis': ['Brush gently twice a day and floss daily.', 'Rinse with warm salt water or an antiseptic mouthwash.', 'Schedule a dental cleaning.'],
        'Pulpitis': ['Avoid very hot, cold and hard food on the affected tooth.', 'Root canal treatment or extraction may be needed.', 'Return right away if there is swelling or fever.'],
        'Tooth fracture': ['Avoid chewing on the affected tooth.', 'Restoration or crown is advised.', 'Keep the area clean.'],
        'Oral ulcer': ['Avoid spicy, salty and acidic food.', 'Rinse with warm salt water.', 'Return if it does not heal in 2 weeks.'],
        'Malocclusion': ['Orthodontic evaluation is advised.', 'Keep the teeth and braces clean.'],
        'Healthy oral condition': ['No treatment needed.', 'Brush twice a day, floss daily and visit the dentist every 6 months.']
    },
    vision: {
        'Refractive error': ['Eyeglasses or contact lenses are advised.', 'Take regular breaks when reading or using screens (20-20-20 rule).', 'Recheck the eyes every year.'],
        'Astigmatism': ['Eyeglasses are advised.', 'Take regular breaks from screens.', 'Recheck the eyes every year.'],
        'Conjunctivitis': ['Do not rub or touch the eyes; wash hands often.', 'Do not share towels or eye drops.', 'Stay home until the redness and discharge are gone.'],
        'Dry eye or eye strain': ['Take regular breaks from screens and blink often.', 'Keep the screen at arm length and avoid reading in dim light.', 'Use lubricating eye drops as advised.'],
        'Stye': ['Apply a warm compress for 10 minutes, 3 to 4 times a day.', 'Do not squeeze the stye.', 'Return if it grows or does not improve in a week.'],
        'Normal vision': ['No treatment needed.', 'Recheck the eyes once a year.']
    }
};

export const complaintOptions = (visitType) => [...COMPLAINTS[visitGroupOf(visitType)], OTHER];
export const diagnosisOptions = (visitType) => [...Object.keys(DIAGNOSES[visitGroupOf(visitType)]), OTHER];

export const RX_OPTIONS = {
    dosage: ['1 tablet', '2 tablets', '1 capsule', '5 mL', '10 mL', '1 drop', '2 drops', '1 sachet', '1 application'],
    frequency: ['Once a day', 'Twice a day', '3 times a day', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'At bedtime', 'Only when needed'],
    duration: ['1 day', '2 days', '3 days', '5 days', '7 days', '10 days', '14 days', 'Until finished'],
    instructions: ['After meals', 'Before meals', 'With a full glass of water', 'At bedtime', 'Do not take on an empty stomach']
};

export const PLACEHOLDERS = {
    chief_complaint: 'Pick the main reason for the visit',
    clinical_findings: 'e.g. Throat red, no swollen tonsils, lungs clear',
    diagnosis: 'Pick the diagnosis',
    treatment_recommendations: 'Written for you from the diagnosis. Edit as needed.'
};

const GENERIC_PLAN = ['Rest and drink enough water.', 'Eat balanced meals and get enough sleep.'];

const rxLine = (r) => {
    const name = String(r.medicine || '').trim();
    if (!name) return '';
    const how = [r.dosage, r.frequency, r.duration && (/^until/i.test(r.duration) ? r.duration.toLowerCase() : `for ${r.duration}`)].filter(Boolean).join(', ');
    const extra = String(r.instructions || '').trim();
    return `${name}${how ? `: ${how}` : ''}${extra ? ` (${extra.charAt(0).toLowerCase()}${extra.slice(1)})` : ''}.`;
};

// oral exam findings (the dental "Findings" checklist) -> care lines of the treatment plan
const FINDING_CARE = [
    [/cavit|caries|decay/i, ['Dental filling or restoration is advised for the cavity.', 'Limit sweet food and drinks; brush twice a day with fluoride toothpaste.']],
    [/plaque|tartar/i, ['Dental cleaning (scaling) is advised.', 'Brush twice a day and floss daily.']],
    [/bleeding gum|gingiv|swollen gum/i, ['Brush gently with a soft toothbrush and floss daily.', 'Rinse with warm salt water or an antiseptic mouthwash.']],
    [/sensitiv/i, ['Use toothpaste for sensitive teeth.', 'Avoid very hot, cold and acidic food and drinks.']],
    [/misalign|malocclusion|crowd/i, ['Orthodontic evaluation is advised.', 'Keep the teeth and braces clean.']]
];

// the findings picked (list or "a, b" text) -> care lines, no repeats
const findingLines = (findings) => {
    const picked = (Array.isArray(findings) ? findings : String(findings || '').split(',')).map((s) => String(s).trim()).filter(Boolean);
    const out = [];
    picked.forEach((p) => FINDING_CARE.forEach(([re, ls]) => { if (re.test(p)) ls.forEach((l) => { if (!out.includes(l)) out.push(l); }); }));
    return out;
};

// the treatment plan as text, one line each. ctx: { visitType, complaint, diagnosis, findings, prescriptions, vitals, followUp: { needed, date, notes } }
export const buildTreatmentPlan = (ctx) => {
    const group = DIAGNOSES[visitGroupOf(ctx.visitType)];
    const diagnosis = String(ctx.diagnosis || '').trim();
    const complaint = String(ctx.complaint || '').trim();
    const fromFindings = findingLines(ctx.findings);
    if (!diagnosis && !complaint && fromFindings.length === 0) return '';

    const care = group[diagnosis];
    const lines = [];
    (care || (fromFindings.length > 0 ? [] : GENERIC_PLAN)).forEach((l) => lines.push(l));
    fromFindings.forEach((l) => { if (!lines.includes(l)) lines.push(l); });

    const rx = (ctx.prescriptions || []).map(rxLine).filter(Boolean);
    if (rx.length > 0) lines.push(`Medicine: ${rx.join(' ')}`);

    const off = abnormalVitals(ctx.vitals || {});
    if (off.length > 0) {
        lines.push(`Recheck vital signs (${off.map((f) => `${f.label.toLowerCase()} ${ctx.vitals[f.key]} ${f.unit}`).join(', ')}).`);
    }

    if (ctx.followUp && ctx.followUp.needed) {
        lines.push(`Follow-up${ctx.followUp.date ? ` on ${ctx.followUp.date}` : ' as soon as possible'}${ctx.followUp.notes ? `: ${ctx.followUp.notes}` : '.'}`);
    }

    lines.push('Return to the clinic if the symptoms get worse or do not improve.');
    return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
};

// the vitals of a check-up from its time-in columns (in_temperature ...)
export const inVitalValues = (appt) => Object.fromEntries(VITAL_FIELDS.map((f) => [f.key, appt?.[`in_${f.key}`] ?? '']));
