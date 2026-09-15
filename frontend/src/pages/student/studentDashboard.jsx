// studentDashboard.jsx
import React, { useState } from 'react';
import HealthTipsModal from '../../components/student/HealthTips'; // Adjust import path if needed

const StudentDashboard = () => {
  const [isTipsOpen, setIsTipsOpen] = useState(false);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        
        {/* Button to open the Health Tips Modal */}
        <button 
          className="btn-primary" 
          onClick={() => setIsTipsOpen(true)}
          style={{ padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}
        >
          💡 View Weekly Health Advisory
        </button>
      </header>

      {/* Main dashboard content... */}

      {/* Health Tips Modal Component */}
      <HealthTipsModal 
        isOpen={isTipsOpen} 
        onClose={() => setIsTipsOpen(false)} 
      />
    </div>
  );
};

export default StudentDashboard;