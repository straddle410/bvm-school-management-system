/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdmissionLanding from './pages/AdmissionLanding';
import Admissions from './pages/Admissions';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import Approvals from './pages/Approvals';
import Attendance from './pages/Attendance';
import AttendanceReport from './pages/AttendanceReport';
import AttendanceReports from './pages/AttendanceReports';
import AttendanceSummaryReport from './pages/AttendanceSummaryReport';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import Diary from './pages/Diary';
import DiaryManagement from './pages/DiaryManagement';
import ExamManagement from './pages/ExamManagement';
import Fees from './pages/Fees';
import Gallery from './pages/Gallery';
import HallTicketManagement from './pages/HallTicketManagement';
import HolidayCalendar from './pages/HolidayCalendar';
import HomeworkManage from './pages/HomeworkManage';
import IDCards from './pages/IDCards';
import Marks from './pages/Marks';
import MarksReview from './pages/MarksReview';
import Messaging from './pages/Messaging';
import More from './pages/More';
import Notices from './pages/Notices';
import ProductionReset from './pages/ProductionReset';
import PublicAdmission from './pages/PublicAdmission';
import PublicAdmissionForm from './pages/PublicAdmissionForm';
import Quiz from './pages/Quiz';
import Reports from './pages/Reports';
import ReportsManagement from './pages/ReportsManagement';
import Results from './pages/Results';
import Settings from './pages/Settings';
import StaffLogin from './pages/StaffLogin';
import StaffManagement from './pages/StaffManagement';
import StudentDashboard from './pages/StudentDashboard';
import StudentHallTicketView from './pages/StudentHallTicketView';
import StudentHomework from './pages/StudentHomework';
import StudentLogin from './pages/StudentLogin';
import StudentMessaging from './pages/StudentMessaging';
import StudentNotifications from './pages/StudentNotifications';
import StudentProfile from './pages/StudentProfile';
import Students from './pages/Students';
import SubjectManagement from './pages/SubjectManagement';
import Teachers from './pages/Teachers';
import TimetableManagement from './pages/TimetableManagement';
import UserProfile from './pages/UserProfile';
import CollectionReport from './pages/CollectionReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdmissionLanding": AdmissionLanding,
    "Admissions": Admissions,
    "AnalyticsDashboard": AnalyticsDashboard,
    "Approvals": Approvals,
    "Attendance": Attendance,
    "AttendanceReport": AttendanceReport,
    "AttendanceReports": AttendanceReports,
    "AttendanceSummaryReport": AttendanceSummaryReport,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Diary": Diary,
    "DiaryManagement": DiaryManagement,
    "ExamManagement": ExamManagement,
    "Fees": Fees,
    "Gallery": Gallery,
    "HallTicketManagement": HallTicketManagement,
    "HolidayCalendar": HolidayCalendar,
    "HomeworkManage": HomeworkManage,
    "IDCards": IDCards,
    "Marks": Marks,
    "MarksReview": MarksReview,
    "Messaging": Messaging,
    "More": More,
    "Notices": Notices,
    "ProductionReset": ProductionReset,
    "PublicAdmission": PublicAdmission,
    "PublicAdmissionForm": PublicAdmissionForm,
    "Quiz": Quiz,
    "Reports": Reports,
    "ReportsManagement": ReportsManagement,
    "Results": Results,
    "Settings": Settings,
    "StaffLogin": StaffLogin,
    "StaffManagement": StaffManagement,
    "StudentDashboard": StudentDashboard,
    "StudentHallTicketView": StudentHallTicketView,
    "StudentHomework": StudentHomework,
    "StudentLogin": StudentLogin,
    "StudentMessaging": StudentMessaging,
    "StudentNotifications": StudentNotifications,
    "StudentProfile": StudentProfile,
    "Students": Students,
    "SubjectManagement": SubjectManagement,
    "Teachers": Teachers,
    "TimetableManagement": TimetableManagement,
    "UserProfile": UserProfile,
    "CollectionReport": CollectionReport,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};