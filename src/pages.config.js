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
import Admissions from './pages/Admissions';
import Approvals from './pages/Approvals';
import Attendance from './pages/Attendance';
import AttendanceReport from './pages/AttendanceReport';
import AttendanceReports from './pages/AttendanceReports';
import AttendanceSummaryReport from './pages/AttendanceSummaryReport';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import ExamManagement from './pages/ExamManagement';
import Gallery from './pages/Gallery';
import HallTicketManagement from './pages/HallTicketManagement';
import HolidayCalendar from './pages/HolidayCalendar';
import HomeworkManage from './pages/HomeworkManage';
import IDCards from './pages/IDCards';
import Marks from './pages/Marks';
import MarksReview from './pages/MarksReview';
import More from './pages/More';
import Notices from './pages/Notices';
import Profile from './pages/Profile';
import PublicAdmission from './pages/PublicAdmission';
import Quiz from './pages/Quiz';
import Reports from './pages/Reports';
import Results from './pages/Results';
import Settings from './pages/Settings';
import StaffLogin from './pages/StaffLogin';
import StaffManagement from './pages/StaffManagement';
import StudentDashboard from './pages/StudentDashboard';
import StudentHallTicketView from './pages/StudentHallTicketView';
import StudentHomework from './pages/StudentHomework';
import StudentLogin from './pages/StudentLogin';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import TimetableManagement from './pages/TimetableManagement';
import SubjectManagement from './pages/SubjectManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admissions": Admissions,
    "Approvals": Approvals,
    "Attendance": Attendance,
    "AttendanceReport": AttendanceReport,
    "AttendanceReports": AttendanceReports,
    "AttendanceSummaryReport": AttendanceSummaryReport,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "ExamManagement": ExamManagement,
    "Gallery": Gallery,
    "HallTicketManagement": HallTicketManagement,
    "HolidayCalendar": HolidayCalendar,
    "HomeworkManage": HomeworkManage,
    "IDCards": IDCards,
    "Marks": Marks,
    "MarksReview": MarksReview,
    "More": More,
    "Notices": Notices,
    "Profile": Profile,
    "PublicAdmission": PublicAdmission,
    "Quiz": Quiz,
    "Reports": Reports,
    "Results": Results,
    "Settings": Settings,
    "StaffLogin": StaffLogin,
    "StaffManagement": StaffManagement,
    "StudentDashboard": StudentDashboard,
    "StudentHallTicketView": StudentHallTicketView,
    "StudentHomework": StudentHomework,
    "StudentLogin": StudentLogin,
    "Students": Students,
    "Teachers": Teachers,
    "TimetableManagement": TimetableManagement,
    "SubjectManagement": SubjectManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};