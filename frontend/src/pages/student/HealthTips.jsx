// healthTipsModule.jsx
import React, { useState, useEffect } from 'react';
import '../../styles/student/HealthTipsModule.css';

// Complete dictionary for all complaints
const TIPS_DICTIONARY = {
  ASTHMAATTACK02000: {
    prevent: [
      "Avoid triggers like dust, smoke, pollen, and chemical fumes.",
      "Keep living and workspace areas properly ventilated.",
      "Wear a mask in cold or highly polluted outdoor weather."
    ],
    cure: [
      "Use prescribed quick-relief inhaler immediately.",
      "Sit upright and loosen tight clothing around the neck.",
      "Stay calm to maintain steady breathing; seek emergency help if severe."
    ]
  },
  BODYPAIN02000: {
    prevent: [
      "Maintain good ergonomic posture during long study/work hours.",
      "Take regular movement breaks and stretch every hour.",
      "Stay well-hydrated throughout the day."
    ],
    cure: [
      "Apply warm or cold compress to affected areas for 15-20 minutes.",
      "Take OTC pain relievers (e.g., Paracetamol or Ibuprofen).",
      "Get adequate rest and avoid heavy physical exertion."
    ]
  },
  COUGH02000: {
    prevent: [
      "Practice regular hand washing with soap and water.",
      "Wear a mask around people with respiratory symptoms.",
      "Avoid close contact with active cold patients."
    ],
    cure: [
      "Drink warm fluids like honey tea or warm water.",
      "Gargle with warm salt water 3 times daily.",
      "Take expectorants or cough suppressants as directed by clinic staff."
    ]
  },
  DIFFICULTYOFBREATHING02000: {
    prevent: [
      "Avoid crowded, poorly ventilated, or dusty environments.",
      "Avoid intense physical exertion in extreme heat."
    ],
    cure: [
      "Sit upright and lean slightly forward with arms supported.",
      "Administer supplemental oxygen if available in clinic.",
      "Contact emergency services if breathing does not normalize."
    ]
  },
  DIZZINESS02000: {
    prevent: [
      "Drink at least 8 glasses of water daily.",
      "Avoid standing up too quickly from a sitting or lying position.",
      "Never skip scheduled meals."
    ],
    cure: [
      "Sit or lie down immediately in a cool, well-ventilated area.",
      "Sip electrolyte fluids or fruit juice slowly.",
      "Keep eyes closed and rest until the sensation passes."
    ]
  },
  FEVER02000: {
    prevent: [
      "Maintain strong immune hygiene with proper nutrition and rest.",
      "Keep updated with seasonal vaccinations."
    ],
    cure: [
      "Take antipyretics like Paracetamol according to prescribed dosage.",
      "Apply tepid sponge baths on forehead and neck.",
      "Increase fluid intake to prevent dehydration."
    ]
  },
  LBM02000: {
    prevent: [
      "Ensure food is thoroughly cooked and water is purified.",
      "Wash hands thoroughly before meals and after using the restroom."
    ],
    cure: [
      "Drink Oral Rehydration Salts (ORS) solution continuously.",
      "Follow the BRAT diet (Bananas, Rice, Applesauce, Toast).",
      "Avoid oily, spicy, and dairy products until fully recovered."
    ]
  },
  HEADACHE02000: {
    prevent: [
      "Follow the 20-20-20 rule during screen use.",
      "Maintain consistent sleep hours and adequate hydration."
    ],
    cure: [
      "Rest in a quiet, dark, and well-ventilated room.",
      "Apply a cold compress on the forehead or back of the neck.",
      "Take mild analgesics as recommended by health staff."
    ]
  },
  HEARTBURN02000: {
    prevent: [
      "Avoid large, heavy, or highly acidic/spicy meals.",
      "Do not lie down within 2 to 3 hours after eating."
    ],
    cure: [
      "Take antacids as recommended.",
      "Sip warm water and remain seated in an upright posture."
    ]
  },
  HIGHBLOODO2000: {
    prevent: [
      "Reduce daily sodium/salt and caffeine intake.",
      "Manage stress through light exercise and breathing techniques."
    ],
    cure: [
      "Sit quietly in a peaceful setting and practice deep, slow breaths.",
      "Take prescribed blood pressure medication.",
      "Recheck vital signs after resting for 15 minutes."
    ]
  },
  INJURY02000: {
    prevent: [
      "Use appropriate protective gear during sports and physical tasks.",
      "Keep walkways free of tripping hazards."
    ],
    cure: [
      "Apply R.I.C.E protocol (Rest, Ice, Compression, Elevation).",
      "Clean open wounds with clean water and sterile antiseptic.",
      "Seek medical evaluation for swelling or severe pain."
    ]
  },
  INSECTBITES02000: {
    prevent: [
      "Apply insect repellent lotion on exposed skin outdoors.",
      "Eliminate standing water sources nearby."
    ],
    cure: [
      "Wash the bite location with mild soap and clean water.",
      "Apply anti-itch lotion or calamine cream.",
      "Avoid scratching to prevent skin infections."
    ]
  },
  LOSTCONSIOUSNESS02000: {
    prevent: [
      "Ensure adequate hydration and air circulation in crowded spaces.",
      "Avoid sudden exhaustion or skipping meals."
    ],
    cure: [
      "Place patient in the recovery position (on their side).",
      "Call emergency services immediately.",
      "Check and monitor airway, breathing, and pulse constantly."
    ]
  },
  MENSTRUALCRAMPS02000: {
    prevent: [
      "Maintain regular physical exercise and balanced nutrition.",
      "Stay hydrated and avoid high sodium intake before periods."
    ],
    cure: [
      "Apply a heating pad or hot water bag to the lower abdomen.",
      "Take prescribed anti-inflammatory medication (e.g., Mefenamic Acid).",
      "Rest with feet slightly elevated."
    ]
  },
  NAUSEA02000: {
    prevent: [
      "Eat smaller, more frequent meals throughout the day.",
      "Avoid strong food odors and greasy/fatty foods."
    ],
    cure: [
      "Sip clear cold liquids, ginger ale, or warm ginger tea slowly.",
      "Rest with head elevated higher than your chest.",
      "Avoid sudden body movements."
    ]
  },
  RUNNYNOSE02000: {
    prevent: [
      "Avoid exposure to cold winds and known air allergens.",
      "Disinfect frequently touched objects."
    ],
    cure: [
      "Use saline nasal sprays or perform warm steam inhalation.",
      "Take antihistamines as recommended by clinic staff.",
      "Drink warm water and rest."
    ]
  },
  SORETHROAT02000: {
    prevent: [
      "Do not share personal water bottles or eating utensils.",
      "Avoid excessive shouting or straining your voice."
    ],
    cure: [
      "Gargle warm salt water every 3–4 hours.",
      "Use throat lozenges or honey tea to soothe mucosal tissue.",
      "Stay well hydrated."
    ]
  },
  TOOTHACHES02000: {
    prevent: [
      "Brush teeth twice daily with fluoride toothpaste and floss regularly.",
      "Limit consumption of sugary drinks and candies."
    ],
    cure: [
      "Rinse mouth thoroughly with warm salt water.",
      "Take oral pain relievers for temporary comfort.",
      "Schedule an appointment with a dentist immediately."
    ]
  }
};

const HealthTips = () => {
  const [complaints, setComplaints] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllComplaints();
  }, []);

  const fetchAllComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/all-chief-complaints');
      const data = await response.json();

      if (data.success) {
        setComplaints(data.data);
      } else {
        setError('Failed to retrieve chief complaints list.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Unable to reach server. Please ensure localhost:3001 is running.');
    } finally {
      setLoading(false);
    }
  };

  // Filter complaints based on user search input
  const filteredComplaints = complaints.filter(item =>
    item.complaint_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="health-module-container">
      <header className="module-header">
        <div>
          <h1>🏥 Health Advisory & Care Directory</h1>
          <p>Comprehensive guide for prevention and cure across all recorded chief complaints</p>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search complaint (e.g. Fever, Asthma)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="module-status">Loading complaints database...</div>
      ) : error ? (
        <div className="module-status error">{error}</div>
      ) : filteredComplaints.length === 0 ? (
        <div className="module-status">No matching complaints found for "{searchTerm}"</div>
      ) : (
        <div className="complaints-grid">
          {filteredComplaints.map((item) => {
            const tips = TIPS_DICTIONARY[item.complaint_id] || {
              prevent: ["Maintain general hygiene", "Get sufficient rest and stay hydrated"],
              cure: ["Consult clinic staff for medical guidance"]
            };

            return (
              <div key={item.complaint_id} className="complaint-card">
                {/* Visual interface header: only showing complaint_name */}
                <div className="card-header">
                  <h2>{item.complaint_name}</h2>
                </div>

                <div className="card-content">
                  <div className="tip-box prevention">
                    <h3>🛡️ Prevention Steps</h3>
                    <ul>
                      {tips.prevent.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="tip-box cure">
                    <h3>💊 Cure / Management Steps</h3>
                    <ul>
                      {tips.cure.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HealthTips;