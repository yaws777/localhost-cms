import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// 1. Import your session context provider
import { MultiAccountProvider } from './context/MultiAccountContext';
import { ThemeProvider } from './context/ThemeContext';
import { AlertProvider } from './context/AlertContext';
import { SidebarProvider } from './context/SidebarContext';

import Login from './pages/Login';
import StudentDashboard from './pages/student/studentDashboard';
import NurseDashboard from './pages/nurse/nurseDashboard';
import ParentDashboard from './pages/parent/parentDashboard';
import HealthHistoryForm from './pages/student/healthHistoryForm';
import MyProfile from './pages/student/myProfile';
import ClinicLogsAndRecords from './pages/student/clinicLogs&Records';
import RequestModule from './pages/student/requestModule';
import StudentLayout from './layout/studentLayout';
import NurseLayout from './layout/nurseLayout';
import DoctorLayout from './layout/doctorLayout';
import DoctorDashboard from './pages/doctor/doctorDashboard';
import DoctorAppointments from './pages/doctor/doctorAppointments';
import DoctorSchedule from './pages/doctor/doctorSchedule';
import DoctorConsultations from './pages/doctor/doctorConsultations';
import DoctorPatients from './pages/doctor/doctorPatients';
import DoctorTemplates from './pages/doctor/doctorTemplates';
import DoctorProfile from './pages/doctor/doctorProfile';
import ManageDoctorAccounts from './pages/nurse/manageDoctorAccounts';
import DoctorVisit from './pages/nurse/doctorVisits';
import BookCheckup from './pages/student/bookCheckup';
import DocumentIssuance from './pages/nurse/documentIssuance';
import HealthRecords from './pages/nurse/healthRecords';  
import HealthScreening from './pages/nurse/healthScreening';  
import IncidentReport from './pages/nurse/incidentReports';    
import InsuranceVault from './pages/nurse/insuranceVault';
import MedicineInventory from './pages/nurse/medicineInventory';  
import RequirementManagement from './pages/nurse/requirementManagement';
import VisitLogConsultation from './pages/nurse/visitLogConsultation';
import ReportsAnalytics from './pages/nurse/reportsAnalytics';
import DispensedMedicine from './pages/nurse/dispensedMedicine';
import ChildProfile from './pages/parent/childProfile';
import ChildClinicRecords from './pages/parent/childClinicRecords';
import MyProfileParent from './pages/parent/myProfile';
import ParentLayout from './layout/parentLayout';
import HealthRecordProfile from './pages/nurse/healthRecordProfile';
import HealthTips from './pages/student/HealthTips';
import ManageStudentAccounts from './pages/nurse/manageStudentAccounts';
import ManageParentAccounts from './pages/nurse/manageParentAccounts';  
import StudentMessages from './components/student/StudentMessageModal';
import MyQr from './pages/student/myQr';
import MyRequirements from './pages/student/myRequirements';
import NurseNotificationSettings from './pages/nurse/nurseNotificationSettings';
import NotificationSettings from './components/student/NotificationSettings';
import ParentNotificationSettings from './pages/parent/parentNotificationSettings';
import StudentNotificationSettings from './pages/student/studentNotificationSettings'; 
import ParentMessages from './components/student/ParentMessageModal';
import NurseMessages from './components/student/NurseMessageModal'

// The Doctor Schedule page is now the Availability / Booking Requests sections of Doctor Visits.
// Old links and bookmarks (/DoctorSchedule, ?tab=requests, ?doctor=..&new=1) land on the right section.
const DoctorScheduleRedirect = () => {
  const params = new URLSearchParams(useLocation().search);
  params.set('section', params.get('tab') === 'requests' ? 'requests' : 'availability');
  params.delete('tab');
  return <Navigate to={`/DoctorVisit?${params.toString()}`} replace />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  /* 2. Wrap BrowserRouter with your MultiAccountProvider */
  <ThemeProvider>
  <SidebarProvider>
  <AlertProvider>
  <MultiAccountProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}/>
        <Route path="/Login" element={<Login />} />
        <Route path="/HealthHistoryForm" element={<HealthHistoryForm />} />
        <Route path="/health-records/view/:studentId" element={<HealthRecordProfile />} />
        <Route path="/notification-settings" element={<NotificationSettings />} />

        <Route element={<ParentLayout/>}>
            <Route path="/ParentDashboard" element={<ParentDashboard />}/>
            <Route path="/ChildProfile" element={<ChildProfile />} />
            <Route path="/ChildClinicRecords" element={<ChildClinicRecords/>}/>
            <Route path="/MyProfileParent" element={<MyProfileParent/>}/>
            <Route path="/ParentNotificationSettings" element={<ParentNotificationSettings />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/ParentMessages" element={<ParentMessages />} />
        </Route>

        <Route element={<DoctorLayout />}>
            <Route path="/DoctorDashboard" element={<DoctorDashboard />} />
            <Route path="/DoctorAppointments" element={<DoctorAppointments />} />
            <Route path="/DoctorMySchedule" element={<DoctorSchedule />} />
            <Route path="/DoctorConsultations" element={<DoctorConsultations />} />
            <Route path="/DoctorPatients" element={<DoctorPatients />} />
            <Route path="/DoctorTemplates" element={<DoctorTemplates />} />
            <Route path="/DoctorProfile" element={<DoctorProfile />} />
        </Route>

        <Route element={<NurseLayout />}>
            <Route path="/NurseDashboard" element={<NurseDashboard />} />
            <Route path="/DoctorVisit" element={<DoctorVisit />} />
            <Route path="/DoctorSchedule" element={<DoctorScheduleRedirect />} />
            <Route path="/DocumentIssuance" element={<DocumentIssuance />} />
            <Route path="/HealthRecords" element={<HealthRecords />} />
            <Route path="/HealthScreening" element={<HealthScreening />} />
            <Route path="/IncidentReport" element={<IncidentReport />} />
            <Route path="/InsuranceVault" element={<InsuranceVault />} />
            <Route path="/MedicineInventory" element={<MedicineInventory />} />
            <Route path="/RestockReport" element={<Navigate to="/ReportsAnalytics?tab=inventory" replace />} />
            <Route path="/RequirementManagement" element={<RequirementManagement />} />
            <Route path="/VisitLogConsultation" element={<VisitLogConsultation />} />
            <Route path="/ReportsAnalytics" element={<ReportsAnalytics />} />
            <Route path="/WeeklyReports" element={<Navigate to="/ReportsAnalytics" replace />} />
            <Route path="/DispensedMedicine" element={<DispensedMedicine />} />
            <Route path="/ManageStudentAccounts" element={<ManageStudentAccounts />} />
            <Route path="/ManageParentAccounts" element={<ManageParentAccounts />} />
            <Route path="/ManageDoctorAccounts" element={<ManageDoctorAccounts />} />
            <Route path="/NurseNotificationSettings" element={<NurseNotificationSettings />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/NurseMessages" element={<NurseMessages />} />
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
            <Route path="/BookCheckup" element={<BookCheckup />} />
            <Route path="/StudentNotificationSettings" element={<StudentNotificationSettings />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </MultiAccountProvider>
  </AlertProvider>
  </SidebarProvider>
  </ThemeProvider>
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