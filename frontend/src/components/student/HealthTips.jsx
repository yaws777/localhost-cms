// healthTips.jsx
import React, { useEffect, useState } from 'react';
import '../../styles/student/HealthTipsComponents.css';

// Database mapping for all complaints from the DB image
const HEALTH_TIPS_DATABASE = {
  ASTHMAATTACK02000: {
    name: "Asthma Attack",
    prevent: [
      "Avoid known asthma triggers (dust, smoke, strong scents).",
      "Keep living/working areas clean and dust-free.",
      "Wear a mask in polluted or cold outdoor environments."
    ],
    cure: [
      "Use prescribed quick-relief rescue inhaler immediately.",
      "Sit upright and stay calm to assist airflow.",
      "Seek emergency medical assistance if symptoms worsen."
    ]
  },
  BODYPAIN02000: {
    name: "Body Pain",
    prevent: [
      "Maintain proper posture while working or studying.",
      "Stretch regularly during long hours of sitting.",
      "Stay hydrated and avoid over-exertion."
    ],
    cure: [
      "Apply warm or cold compresses to affected muscles.",
      "Take prescribed oral pain relievers (e.g., Paracetamol).",
      "Get sufficient rest and gentle light stretching."
    ]
  },
  COUGH02000: {
    name: "Cough",
    prevent: [
      "Wash hands frequently with soap and water.",
      "Wear a face mask in crowded spaces.",
      "Avoid close contact with individuals showing cold symptoms."
    ],
    cure: [
      "Drink warm liquids like water, tea, or lemon honey water.",
      "Use cough suppressants or expectorants as advised by clinic.",
      "Gargle warm salt water to relieve throat irritation."
    ]
  },
  DIFFICULTYOFBREATHING02000: {
    name: "Difficulty of Breathing",
    prevent: [
      "Avoid dusty, unventilated, or smoky environments.",
      "Refrain from heavy physical exertion during hot temperatures."
    ],
    cure: [
      "Sit upright and loosen any tight clothing around chest/neck.",
      "Administer supplemental oxygen under medical supervision.",
      "Immediate nurse evaluation or transport to nearest ER."
    ]
  },
  DIZZINESS02000: {
    name: "Dizziness",
    prevent: [
      "Drink adequate water throughout the day.",
      "Avoid sudden position changes (e.g., standing up too fast).",
      "Do not skip meals to maintain steady glucose levels."
    ],
    cure: [
      "Sit or lie down immediately in a cool, ventilated area.",
      "Sip electrolyte fluids or water slowly.",
      "Rest until dizziness completely subsides."
    ]
  },
  FEVER02000: {
    name: "Fever",
    prevent: [
      "Maintain good personal hygiene and frequent hand washing.",
      "Stay updated on routine vaccinations."
    ],
    cure: [
      "Take antipyretics like Paracetamol as prescribed.",
      "Apply cool tepid sponge baths to lower body temperature.",
      "Drink plenty of fluids to stay hydrated."
    ]
  },
  LBM02000: {
    name: "Gastrointestinal Issues (LBM)",
    prevent: [
      "Consume cleanly prepared food and purified drinking water.",
      "Wash hands thoroughly before meals and after restroom use."
    ],
    cure: [
      "Drink Oral Rehydration Salts (ORS) solution continuously.",
      "Eat bland foods (BRAT diet: Bananas, Rice, Applesauce, Toast).",
      "Avoid dairy, greasy, or spicy foods until recovered."
    ]
  },
  HEADACHE02000: {
    name: "Headache",
    prevent: [
      "Take short eye breaks from screen work (20-20-20 rule).",
      "Maintain consistent sleep schedules and proper hydration."
    ],
    cure: [
      "Rest in a quiet, dark room.",
      "Apply a cold cloth across forehead and temples.",
      "Take mild analgesics as directed by clinic staff."
    ]
  },
  HEARTBURN02000: {
    name: "Heartburn",
    prevent: [
      "Avoid eating large, heavy, or overly acidic/spicy meals.",
      "Do not lie down immediately after eating (wait 2-3 hours)."
    ],
    cure: [
      "Take over-the-counter antacids as advised.",
      "Sip warm water and remain seated upright."
    ]
  },
  HIGHBLOOD02000: {
    name: "High Blood Pressure",
    prevent: [
      "Reduce sodium/salt intake in daily diet.",
      "Manage stress levels through relaxation techniques."
    ],
    cure: [
      "Sit calmly in a quiet space and take deep breaths.",
      "Take prescribed antihypertensive medication.",
      "Recheck blood pressure after 15 minutes of rest."
    ]
  },
  INJURY02000: {
    name: "Injury",
    prevent: [
      "Observe safety protocol in activities/sports.",
      "Ensure environment is free of tripping hazards."
    ],
    cure: [
      "Apply R.I.C.E protocol (Rest, Ice, Compression, Elevation).",
      "Clean and bandage open wounds promptly.",
      "Assess for sprains or fractures."
    ]
  },
  INSECTBITES02000: {
    name: "Insect Bites",
    prevent: [
      "Apply insect repellent lotions when outdoor.",
      "Avoid standing stagnant water in nearby areas."
    ],
    cure: [
      "Wash bite area with mild soap and water.",
      "Apply anti-itch cream or calamine lotion.",
      "Avoid scratching to prevent secondary infection."
    ]
  },
  LOSTCONSIOUSNESS02000: {
    name: "Lost Consciousness",
    prevent: [
      "Ensure proper ventilation and hydration during public gatherings."
    ],
    cure: [
      "Place patient in recovery position if breathing.",
      "Call emergency services immediately.",
      "Monitor airway, breathing, and pulse constantly."
    ]
  },
  MENSTRUALCRAMPS02000: {
    name: "Menstrual Cramps",
    prevent: [
      "Exercise regularly and maintain a balanced diet.",
      "Stay hydrated during pre-menstrual period."
    ],
    cure: [
      "Apply a heating pad to the lower abdomen.",
      "Take prescribed pain relievers (e.g., Mefenamic Acid / Ibuprofen).",
      "Rest in a comfortable position."
    ]
  },
  NAUSEA02000: {
    name: "Nausea/Vomiting",
    prevent: [
      "Eat small, frequent meals rather than large portions.",
      "Avoid strong odors and fried, oily foods."
    ],
    cure: [
      "Sip clear cold liquids or ginger/chamomile tea slowly.",
      "Rest with head elevated.",
      "Take antiemetic medication if advised by nurse."
    ]
  },
  RUNNYNOSE02000: {
    name: "Runny Nose",
    prevent: [
      "Avoid known allergens and cold winds.",
      "Disinfect personal devices regularly."
    ],
    cure: [
      "Use saline nasal spray or steam inhalation.",
      "Take antihistamines as directed.",
      "Stay warm and stay hydrated."
    ]
  },
  SORETHROAT02000: {
    name: "Sore Throat",
    prevent: [
      "Avoid sharing personal utensils or drinks.",
      "Avoid vocal strain."
    ],
    cure: [
      "Gargle warm salt water every few hours.",
      "Use throat lozenges for temporary relief.",
      "Drink warm teas or water."
    ]
  },
  TOOTHACHES02000: {
    name: "Toothaches",
    prevent: [
      "Brush teeth twice daily and floss regularly.",
      "Limit sugary foods and drinks."
    ],
    cure: [
      "Rinse mouth with warm salt water.",
      "Take analgesics for pain relief.",
      "Schedule a dental examination promptly."
    ]
  }
};

const HealthTipsModal = ({ isOpen, onClose }) => {
  const [topComplaint, setTopComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchTopComplaint();
    }
  }, [isOpen]);

  const fetchTopComplaint = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/top-complaint-last-week');
      const data = await response.json();

      if (data.success && data.data) {
        setTopComplaint(data.data);
      } else {
        setTopComplaint(null);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setError("Failed to load health tips. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Retrieve health tips mapping or default fallback
  const tips = topComplaint && HEALTH_TIPS_DATABASE[topComplaint.complaint_id] 
    ? HEALTH_TIPS_DATABASE[topComplaint.complaint_id] 
    : {
        name: topComplaint?.complaint_name || "General Health Advice",
        prevent: ["Maintain general hygiene", "Stay hydrated and get 8 hours of sleep"],
        cure: ["Consult clinic staff for dedicated care", "Rest in a clean environment"]
      };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="health-tips-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2> Weekly Health Advisory</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p>Loading weekly complaint analytics...</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : !topComplaint ? (
            <p>No complaints were recorded during the previous week.</p>
          ) : (
            <>
              <div className="banner-box">
                <span className="banner-badge">Top Complaint Last Week</span>
                <h2 className="banner-title">{topComplaint.complaint_name}</h2>
                <div className="case-count">
                  {topComplaint.total_cases} total reported {topComplaint.total_cases > 1 ? 'cases' : 'case'}
                </div>
                <div className="date-range">
                  Week period: ({topComplaint.week_start} - {topComplaint.week_end})
                </div>
              </div>

              <div className="tips-grid">
                <div className="section-box prevention-box">
                  <h3> Steps to Prevent</h3>
                  <ul>
                    {tips.prevent.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="section-box cure-box">
                  <h3> Steps to Cure / Manage</h3>
                  <ul>
                    {tips.cure.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default HealthTipsModal;