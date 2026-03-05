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
import ChangeStaffPassword from './pages/ChangeStaffPassword';
import ClassCollectionSummaryReport from './pages/ClassCollectionSummaryReport';
import CollectionReport from './pages/CollectionReport';
import DailyClosingReport from './pages/DailyClosingReport';
import Dashboard from './pages/Dashboard';
import DayBookReport from './pages/DayBookReport';
import DefaultersReport from './pages/DefaultersReport';
import Diary from './pages/Diary';
import DiaryManagement from './pages/DiaryManagement';
import ExamManagement from './pages/ExamManagement';
import Fees from './pages/Fees';
import Gallery from './pages/Gallery';
import HallTicketManagement from './pages/HallTicketManagement';
import HolidayCalendar from './pages/HolidayCalendar';
import Homework from './pages/Homework';
import HomeworkManage from './pages/HomeworkManage';
import IDCards from './pages/IDCards';
import Marks from './pages/Marks';
import MarksReview from './pages/MarksReview';
import Messaging from './pages/Messaging';
import More from './pages/More';
import Notices from './pages/Notices';
import OutstandingReport from './pages/OutstandingReport';
import ParentStatement from './pages/ParentStatement';
import PostingDashboard from './pages/PostingDashboard';
import PrintReceiptA5 from './pages/PrintReceiptA5';
import ProductionReset from './pages/ProductionReset';
import Profile from './pages/Profile';
import PublicAdmission from './pages/PublicAdmission';
import PublicAdmissionForm from './pages/PublicAdmissionForm';
import Quiz from './pages/Quiz';
import RbacTest from './pages/RbacTest';
import Reports from './pages/Reports';
import ReportsManagement from './pages/ReportsManagement';
import Results from './pages/Results';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import StaffLogin from './pages/StaffLogin';
import StudentAttendance from './pages/StudentAttendance';
import StudentDashboard from './pages/StudentDashboard';
import StudentDiary from './pages/StudentDiary';
import StudentFees from './pages/StudentFees';
import StudentHallTicketView from './pages/StudentHallTicketView';
import StudentHomework from './pages/StudentHomework';
import StudentLedgerReport from './pages/StudentLedgerReport';
import StudentLogin from './pages/StudentLogin';
import StudentMarks from './pages/StudentMarks';
import StudentMessaging from './pages/StudentMessaging';
import StudentMore from './pages/StudentMore';
import StudentNotices from './pages/StudentNotices';
import StudentNotifications from './pages/StudentNotifications';
import StudentProfile from './pages/StudentProfile';
import StudentTimetable from './pages/StudentTimetable';
import Students from './pages/Students';
import SubjectManagement from './pages/SubjectManagement';
import Teachers from './pages/Teachers';
import TimetableManagement from './pages/TimetableManagement';
import UserProfile from './pages/UserProfile';
import Home from './pages/Home';
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
    "ChangeStaffPassword": ChangeStaffPassword,
    "ClassCollectionSummaryReport": ClassCollectionSummaryReport,
    "CollectionReport": CollectionReport,
    "DailyClosingReport": DailyClosingReport,
    "Dashboard": Dashboard,
    "DayBookReport": DayBookReport,
    "DefaultersReport": DefaultersReport,
    "Diary": Diary,
    "DiaryManagement": DiaryManagement,
    "ExamManagement": ExamManagement,
    "Fees": Fees,
    "Gallery": Gallery,
    "HallTicketManagement": HallTicketManagement,
    "HolidayCalendar": HolidayCalendar,
    "Homework": Homework,
    "HomeworkManage": HomeworkManage,
    "IDCards": IDCards,
    "Marks": Marks,
    "MarksReview": MarksReview,
    "Messaging": Messaging,
    "More": More,
    "Notices": Notices,
    "OutstandingReport": OutstandingReport,
    "ParentStatement": ParentStatement,
    "PostingDashboard": PostingDashboard,
    "PrintReceiptA5": PrintReceiptA5,
    "ProductionReset": ProductionReset,
    "Profile": Profile,
    "PublicAdmission": PublicAdmission,
    "PublicAdmissionForm": PublicAdmissionForm,
    "Quiz": Quiz,
    "RbacTest": RbacTest,
    "Reports": Reports,
    "ReportsManagement": ReportsManagement,
    "Results": Results,
    "Settings": Settings,
    "Staff": Staff,
    "StaffLogin": StaffLogin,
    "StudentAttendance": StudentAttendance,
    "StudentDashboard": StudentDashboard,
    "StudentDiary": StudentDiary,
    "StudentFees": StudentFees,
    "StudentHallTicketView": StudentHallTicketView,
    "StudentHomework": StudentHomework,
    "StudentLedgerReport": StudentLedgerReport,
    "StudentLogin": StudentLogin,
    "StudentMarks": StudentMarks,
    "StudentMessaging": StudentMessaging,
    "StudentMore": StudentMore,
    "StudentNotices": StudentNotices,
    "StudentNotifications": StudentNotifications,
    "StudentProfile": StudentProfile,
    "StudentTimetable": StudentTimetable,
    "Students": Students,
    "SubjectManagement": SubjectManagement,
    "Teachers": Teachers,
    "TimetableManagement": TimetableManagement,
    "UserProfile": UserProfile,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Profile",
    Pages: PAGES,
    Layout: __Layout,
};