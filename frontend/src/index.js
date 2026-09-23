import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StudentDashboard from './pages/student/studentDashboard';
import NurseDashboard from './pages/nurse/nurseDashboard';
import ParentDashboard from './pages/parent/parentDashboard';
import HealthHistoryForm from './pages/student/healthHistoryForm';
import ChooseStudentProfile from './pages/parent/chooseStudentProfile';
import MyProfile from './pages/student/myProfile';
import ClinicLogsAndRecords from './pages/student/clinicLogs&Records';
import RequestModule from './pages/student/requestModule';
import StudentLayout from './layout/studentLayout';
import NurseLayout from './layout/nurseLayout';
import DoctorVisit from './pages/nurse/doctorVisits';
import DocumentIssuance from './pages/nurse/documentIssuance';
import HealthRecords from './pages/nurse/healthRecords';  
import HealthScreening from './pages/nurse/healthScreening';  
import IncidentReport from './pages/nurse/incidentReports';    
import InsuranceVault from './pages/nurse/insuranceVault';
import MedicineInventory from './pages/nurse/medicineInventory';  
import RequirementManagement from './pages/nurse/requirementManagement';
import VisitLogConsultation from './pages/nurse/visitLogConsultation';
import WeeklyReports from './pages/nurse/weeklyReports';
import DispensedMedicine from './pages/nurse/dispensedMedicine';
import ChildProfile from './pages/parent/childProfile';
import ChildClinicRecords from './pages/parent/childClinicRecords';
import MyProfileParent from './pages/parent/myProfile';
import ParentLayout from './layout/parentLayout'
import HealthRecordProfile from './pages/nurse/healthRecordProfile';
import HealthTips from './pages/student/HealthTips';
import ManageStudentAccounts from './pages/nurse/manageStudentAccounts';
import ManageParentAccounts from './pages/nurse/manageParentAccounts';  
import NurseMessages from './pages/nurse/nurseMessages';
import StudentMessages from './components/student/StudentMessageModal'; // Import the StudentMessages component
import MyQr from './pages/student/myQr'; // Import the myQr component
import MyRequirements from './pages/student/myRequirements'; // Import the myRequirements component
import NurseNotificationSettings from './pages/nurse/nurseNotificationSettings';
import NotificationSettings from './components/student/NotificationSettings'; // Import the NotificationSettings component
import ParentNotificationSettings from './pages/parent/parentNotificationSettings'; // Import the ParentNotificationSettings component
import StudentNotificationSettings from './pages/student/studentNotificationSettings'; // Import the StudentNotificationSettings component 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    {/* Your routes defined directly in your main entry file */}
    <Routes>
      <Route path="/" element={<App />}/>
      <Route path="/Login" element={<Login />} />
      <Route path="/HealthHistoryForm" element={<HealthHistoryForm />} />
      <Route path="/ChooseStudentProfile" element={<ChooseStudentProfile />} />
      <Route path="/health-records/view/:studentId" element={<HealthRecordProfile />} />
      <Route path="/notification-settings" element={<NotificationSettings />} />

      <Route element={<ParentLayout/>}>
          <Route path="/ParentDashboard" element={<ParentDashboard />}/>
          <Route path="/ChildProfile" element={<ChildProfile />} />
          <Route path="/ChildClinicRecords" element={<ChildClinicRecords/>}/>
          <Route path="/MyProfileParent" element={<MyProfileParent/>}/>
          <Route path="/ParentNotificationSettings" element={<ParentNotificationSettings />} />
          <Route path="/notification-settings" element={<NotificationSettings />} />
      </Route>

      <Route element={<NurseLayout />}>
          <Route path="/NurseDashboard" element={<NurseDashboard />} />
          <Route path="/DoctorVisit" element={<DoctorVisit />} />
          <Route path="/DocumentIssuance" element={<DocumentIssuance />} />
          <Route path="/HealthRecords" element={<HealthRecords />} />
          <Route path="/HealthScreening" element={<HealthScreening />} />
          <Route path="/IncidentReport" element={<IncidentReport />} />
          <Route path="/InsuranceVault" element={<InsuranceVault />} />
          <Route path="/MedicineInventory" element={<MedicineInventory />} />
          <Route path="/RequirementManagement" element={<RequirementManagement />} />
          <Route path="/VisitLogConsultation" element={<VisitLogConsultation />} />
          <Route path="/WeeklyReports" element={<WeeklyReports />} />
          <Route path="/DispensedMedicine" element={<DispensedMedicine />} />
          <Route path="/NurseMessages" element={<NurseMessages />} />
          <Route path="/ManageStudentAccounts" element={<ManageStudentAccounts />} />
          <Route path="/ManageParentAccounts" element={<ManageParentAccounts />} />
          <Route path="/NurseNotificationSettings" element={<NurseNotificationSettings />} />
          <Route path="/notification-settings" element={<NotificationSettings />} />
      </Route>

      <Route element={<StudentLayout />}>
          <Route path="/StudentDashboard" element={<StudentDashboard />} />
          <Route path="/MyQr" element={<MyQr />} />
          <Route path="/ClinicLogsAndRecords" element={<ClinicLogsAndRecords />} />
          <Route path="/MyProfile" element={<MyProfile />} />
          <Route path="/RequestModule" element={<RequestModule />} />
          <Route path="/HealthTips" element={<HealthTips />} />
          <Route path="/StudentMessages" element={<StudentMessages />} />
          <Route path="/MyRequirements" element={<MyRequirements />} />
          <Route path="/StudentNotificationSettings" element={<StudentNotificationSettings />} />
          <Route path="/notification-settings" element={<NotificationSettings />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

reportWebVitals();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW Registered successfully:', registration.scope);
            })
            .catch((error) => {
                console.error('SW Registration failed:', error);
            });
    });
}