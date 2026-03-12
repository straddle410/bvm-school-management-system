import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronDown, ChevronRight, HelpCircle, Phone, Mail, Globe, BookOpen, GraduationCap, Users, User, X, CheckCircle2, Clock } from 'lucide-react';
import { createPageUrl } from '@/utils';

const GUIDES = [
  {
    id: 'admin',
    title: 'Admin Guide',
    icon: Users,
    color: '#1a237e',
    bg: '#e8eaf6',
    description: 'For school administrators and principals',
    sections: [
      {
        title: 'Logging In',
        steps: [
          'Open the app and tap "Staff Login" on the home screen.',
          'Enter your Username and Password provided by the system administrator.',
          'Tap "Login". On first login you will be prompted to set a new password.',
          'If you forget your password, contact another admin to reset it from the Staff module.',
        ],
      },
      {
        title: 'Dashboard Overview',
        steps: [
          'The Dashboard shows a summary of students, staff, attendance, and pending approvals.',
          'Tap any stat card to drill into the details for that module.',
          'The bottom navigation gives quick access to Notices, Gallery, Approvals, and More.',
          'The academic year selector (top-right) lets you switch between years.',
        ],
      },
      {
        title: 'Managing Students',
        steps: [
          'Go to More → Students to view all enrolled students.',
          'Use the search bar and filters (class, section, status) to find students.',
          'Tap a student card to view their full profile, edit details, or view fee/attendance history.',
          'To add a new student, tap the "+ Add Student" button and fill in the form.',
          'To approve a pending admission, go to the Approvals page and tap "Approve" on the application.',
          'Approved students are assigned a Student ID automatically.',
        ],
      },
      {
        title: 'Managing Staff',
        steps: [
          'Go to More → Staff Management to view all staff accounts.',
          'Tap "+ Add Staff" to create a new staff account with a role (Teacher, Accountant, etc.).',
          'Assign permissions to control what each staff member can access.',
          'To reset a staff password, open their profile and tap "Reset Password".',
          'Deactivate a staff account by setting their status to Inactive.',
        ],
      },
      {
        title: 'Approving Admissions',
        steps: [
          'New admissions appear on the Approvals page (bottom nav).',
          'Tap an application to review the student details and documents.',
          'Tap "Verify" to mark the application as verified, then "Approve" to confirm admission.',
          'Once approved, a Student ID is auto-generated and the student can log in.',
          'To reject an application, tap "Reject" and enter a reason.',
        ],
      },
      {
        title: 'Setting Up Timetable',
        steps: [
          'Go to More → Timetable Management.',
          'Select a class and section, then tap "+ Add Slot" to add a period.',
          'Assign a subject and teacher to each time slot.',
          'The timetable is visible to both teachers and students once saved.',
          'For exam timetables, go to More → Exam Management → Timetable.',
        ],
      },
      {
        title: 'Managing Fees & Invoices',
        steps: [
          'Go to the Fees module from the bottom navigation or More menu.',
          'Set up Fee Heads (e.g., Tuition, Transport) under Fees → Fee Heads.',
          'Create a Fee Plan and assign it to classes under Fees → Fee Plans.',
          'Generate invoices for all students under Fees → Generate Invoices.',
          'Record a fee payment by searching for a student and tapping "Record Payment".',
          'Print or share the receipt from the payment confirmation screen.',
          'View outstanding dues under Reports → Outstanding Report.',
        ],
      },
      {
        title: 'Publishing Notices',
        steps: [
          'Go to Notices from the bottom navigation.',
          'Tap "+ New Notice" to create a notice.',
          'Set the title, content, notice type, and target audience (All / Students / Staff).',
          'Tap "Publish" to make it immediately visible to the selected audience.',
          'Pin important notices to keep them at the top of the list.',
        ],
      },
      {
        title: 'Uploading Gallery Photos',
        steps: [
          'Go to Gallery from the bottom navigation.',
          'Tap "+ New Album" to create an album for an event.',
          'Open the album and tap "Upload Photos" to add images.',
          'Set album visibility (Public, Staff Only, or Students & Parents).',
          'Published albums are visible to the selected audience immediately.',
        ],
      },
      {
        title: 'Generating Reports',
        steps: [
          'Go to More → Reports for all academic and analytical reports.',
          'For attendance reports, go to Reports → Attendance Summary.',
          'For fee reports, go to More → Finance Reports (Daily Closing, Day Book, Defaulters, etc.).',
          'For academic performance, go to Reports → Performance Analytics.',
          'Most reports can be filtered by date, class, and section, and exported.',
        ],
      },
      {
        title: 'App Settings',
        steps: [
          'Go to More → Settings to configure school-wide settings.',
          'Update school name, logo, address, and contact details under School Profile.',
          'Configure classes and sections under Class & Section Config.',
          'Set up subjects per class under Subject Management.',
          'Manage the current academic year under Academic Year settings.',
          'Configure fee receipt format under Fees → Receipt Settings.',
        ],
      },
    ],
  },
  {
    id: 'teacher',
    title: 'Teacher Guide',
    icon: BookOpen,
    color: '#2e7d32',
    bg: '#e8f5e9',
    description: 'For teachers and teaching staff',
    sections: [
      {
        title: 'Logging In',
        steps: [
          'Tap "Staff Login" on the home screen.',
          'Enter your Username and Password provided by the administrator.',
          'On first login, you will be required to change your password.',
          'Contact your administrator if you cannot log in or forgot your password.',
        ],
      },
      {
        title: 'Dashboard',
        steps: [
          'Your dashboard shows today\'s schedule, pending tasks, and quick stats.',
          'Pending items (marks not submitted, attendance not taken) appear as alerts.',
          'Use the bottom navigation to move between modules.',
        ],
      },
      {
        title: 'Taking Attendance',
        steps: [
          'Go to Attendance from the bottom navigation.',
          'Select your class and section, then select today\'s date.',
          'Mark each student as Present, Absent, or Half Day.',
          'For half-day, specify morning or afternoon and optionally add a reason.',
          'Tap "Submit Attendance" when done. Attendance locks automatically at 3:00 PM.',
          'To mark a holiday, tap "Mark Holiday" and enter the reason.',
        ],
      },
      {
        title: 'Entering Marks',
        steps: [
          'Go to More → Marks Entry.',
          'Select the Exam Type, Class, Section, and Subject.',
          'Enter marks for each student in the table. Marks auto-save as you type.',
          'Tap "Submit for Review" when all marks are entered.',
          'Marks will be verified and published by the admin/principal.',
        ],
      },
      {
        title: 'Publishing Results',
        steps: [
          'Only admins can publish results — as a teacher, submit marks for review.',
          'You can view submitted marks under Marks → View Submitted.',
          'After admin publishes results, students can view them in their portal.',
        ],
      },
      {
        title: 'Creating Homework',
        steps: [
          'Go to More → Homework.',
          'Tap "+ Assign Homework" and select the class, section, subject, and due date.',
          'Choose the homework type: Assignment, MCQ, Descriptive, or Project.',
          'Add questions or instructions, then set the submission mode (View Only or Submission Required).',
          'Tap "Publish" to make it visible to students.',
          'View submissions and grade them from the homework detail screen.',
        ],
      },
      {
        title: 'Managing Timetable',
        steps: [
          'Go to More → Timetable Management to view or manage your class timetable.',
          'Admins create and edit timetables; teachers can view their assigned schedule.',
          'Your personal timetable is visible on your dashboard.',
        ],
      },
      {
        title: 'Viewing Student Profiles',
        steps: [
          'Go to More → Students and search by name, ID, or filter by class.',
          'Tap a student card to view their profile, attendance history, and marks.',
          'You can view only students in your assigned classes.',
        ],
      },
    ],
  },
  {
    id: 'student',
    title: 'Student Guide',
    icon: GraduationCap,
    color: '#1565c0',
    bg: '#e3f2fd',
    description: 'For students and parents/guardians',
    sections: [
      {
        title: 'Logging In',
        steps: [
          'Open the app and tap "Student Login" on the home screen.',
          'Enter your Student ID (e.g., S25011) in the Student ID field.',
          'Enter your password. The default password is BVM123 — change it after first login.',
          'Tap "Sign In" to enter your dashboard.',
          'If you forget your password, ask the class teacher or school admin to reset it.',
        ],
      },
      {
        title: 'Viewing Your Dashboard',
        steps: [
          'The dashboard shows your name, class, section, and today\'s summary.',
          'You can see today\'s notices, upcoming homework, and recent attendance.',
          'Use the bottom navigation to move between different sections of the app.',
        ],
      },
      {
        title: 'Checking Attendance',
        steps: [
          'Tap "Attendance" from the bottom navigation or dashboard.',
          'Your monthly attendance calendar is shown with colour-coded days.',
          'Green = Present, Red = Absent, Orange = Half Day, Grey = Holiday.',
          'Scroll up to see your total attendance percentage for the year.',
        ],
      },
      {
        title: 'Viewing Marks & Results',
        steps: [
          'Tap "Results" from the bottom navigation.',
          'Select the Exam Type to view your subject-wise marks.',
          'Your grade and marks are shown for each subject.',
          'Progress cards (report cards) can be downloaded when published by the school.',
          'Hall tickets for upcoming exams are available under Results → Hall Tickets.',
        ],
      },
      {
        title: 'Downloading Fee Receipts',
        steps: [
          'Tap "Fees" from the More menu.',
          'Your fee invoice and payment history are shown.',
          'Tap any payment entry to view the receipt details.',
          'Tap "Download" or "Share" to save the receipt as a PDF.',
          'Outstanding fee balance is shown at the top of the Fees screen.',
        ],
      },
      {
        title: 'Viewing Homework',
        steps: [
          'Tap "Homework" from the bottom navigation.',
          'Active homework assignments are listed with subject, due date, and type.',
          'Tap an assignment to read the instructions.',
          'For MCQ or Descriptive homework, answer the questions and tap "Submit".',
          'For Assignment/Project types, you may upload a file as your submission.',
          'Submitted homework shows a green "Submitted" badge.',
        ],
      },
      {
        title: 'Checking Timetable',
        steps: [
          'Tap "Timetable" from the More menu or dashboard.',
          'Your weekly class timetable is shown by day.',
          'Exam timetables are displayed separately when published by the school.',
        ],
      },
      {
        title: 'Viewing Notices & Gallery',
        steps: [
          'Tap "Notices" from the bottom navigation to read school announcements.',
          'Pinned notices appear at the top. Tap any notice to read the full content.',
          'Tap "Gallery" from the bottom navigation to browse school event photos.',
          'Tap an album to view all photos from that event.',
        ],
      },
    ],
  },
  {
    id: 'staff',
    title: 'Staff Guide',
    icon: User,
    color: '#6a1b9a',
    bg: '#f3e5f5',
    description: 'For support staff, admin staff, and other roles',
    sections: [
      {
        title: 'Logging In',
        steps: [
          'Tap "Staff Login" on the home screen.',
          'Enter the Username and Password provided by your administrator.',
          'Change your password on first login when prompted.',
          'If you are locked out, contact the school admin to unlock your account.',
        ],
      },
      {
        title: 'Dashboard',
        steps: [
          'Your dashboard shows modules relevant to your assigned role and permissions.',
          'Widgets and quick-access buttons are shown based on what your admin has enabled.',
          'Contact your administrator if you need access to a module not visible to you.',
        ],
      },
      {
        title: 'Viewing Notices',
        steps: [
          'Tap "Notices" from the bottom navigation to read school announcements.',
          'Notices targeted to "All" or "Staff" are visible to you.',
          'Tap a notice to read the full content. Attachments can be downloaded.',
        ],
      },
      {
        title: 'Accessing Assigned Features',
        steps: [
          'Your admin controls which modules you can access (e.g., Fees, Attendance, Marks).',
          'Modules you have access to appear in the bottom navigation or the More menu.',
          'If you cannot access a feature you need, request your administrator to update your permissions.',
          'Changes to permissions take effect on your next login.',
        ],
      },
      {
        title: 'Changing Your Password',
        steps: [
          'Go to More → Change Password.',
          'Enter your current password, then enter and confirm your new password.',
          'Your new password must be at least 8 characters long.',
          'Tap "Update Password" to save. You will need to log in again with the new password.',
        ],
      },
    ],
  },
];

const StepList = ({ steps }) => (
  <ol className="space-y-2 mt-2">
    {steps.map((step, i) => (
      <li key={i} className="flex gap-3 text-sm text-slate-600">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
        <span>{step}</span>
      </li>
    ))}
  </ol>
);

const SubSection = ({ section }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{section.title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-white">
          <StepList steps={section.steps} />
        </div>
      )}
    </div>
  );
};

const GuideCard = ({ guide, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen || false);
  const Icon = guide.icon;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: guide.bg }}>
          <Icon className="h-5 w-5" style={{ color: guide.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800">{guide.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{guide.description}</p>
        </div>
        {open
          ? <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-2 border-t border-slate-100 pt-4">
          {guide.sections.map(section => (
            <SubSection key={section.title} section={section} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function HelpGuide() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [school, setSchool] = useState(null);
  const [updates, setUpdates] = useState({ recent: [], comingSoon: [] });

  useEffect(() => {
    base44.entities.SchoolProfile.list()
      .then(p => { if (p?.[0]) setSchool(p[0]); })
      .catch(() => {});

    base44.entities.AppUpdates.filter({ is_active: true }, '-created_date')
      .then(items => {
        setUpdates({
          recent: items.filter(i => i.type === 'recent'),
          comingSoon: items.filter(i => i.type === 'coming_soon'),
        });
      })
      .catch(() => {});
  }, []);

  // Filtered guides based on search query
  const filteredGuides = useMemo(() => {
    if (!query.trim()) return GUIDES;
    const q = query.toLowerCase();
    return GUIDES
      .map(guide => {
        const matchingSections = guide.sections.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.steps.some(step => step.toLowerCase().includes(q))
        );
        if (guide.title.toLowerCase().includes(q) || guide.description.toLowerCase().includes(q)) {
          return guide; // show whole guide
        }
        if (matchingSections.length > 0) {
          return { ...guide, sections: matchingSections };
        }
        return null;
      })
      .filter(Boolean);
  }, [query]);

  const hasSearch = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <HelpCircle className="h-5 w-5 text-indigo-600 flex-shrink-0" />
        <h1 className="text-base font-bold text-slate-800">Help &amp; User Guide</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Intro */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4">
          <p className="text-sm text-indigo-800 font-medium">Welcome to the Help Centre</p>
          <p className="text-xs text-indigo-600 mt-1">Find step-by-step instructions for every feature. Select your role below to get started.</p>
        </div>

        {/* Notice Banner */}
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-xl px-5 py-4 flex gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">📌</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Please Note</p>
            <p className="text-sm text-amber-700 mt-1 leading-relaxed">
              Some features mentioned in this guide may not be available in the current version of the app. These features are planned and will be included in future updates. We are constantly improving the app to serve you better. Thank you for your patience!
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search help topics… (e.g. attendance, fees, login)"
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search result count */}
        {hasSearch && (
          <p className="text-xs text-slate-500 px-1">
            {filteredGuides.length === 0
              ? 'No results found. Try different keywords.'
              : `Found results in ${filteredGuides.length} guide${filteredGuides.length > 1 ? 's' : ''}.`}
          </p>
        )}

        {/* Guide Cards */}
        {filteredGuides.length > 0
          ? filteredGuides.map(guide => (
              <GuideCard key={guide.id} guide={guide} defaultOpen={hasSearch} />
            ))
          : hasSearch && (
            <div className="text-center py-12 text-slate-400">
              <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No help topics matched your search.</p>
              <button onClick={() => setQuery('')} className="mt-2 text-indigo-500 text-sm underline">Clear search</button>
            </div>
          )}

        {/* Recent Updates & Coming Soon */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="text-lg">🚀</span>
            <p className="font-bold text-slate-800">Recent Updates &amp; Coming Soon</p>
          </div>

          {/* Recently Added */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-700">✅ Recently Added Features</p>
            </div>
            <ul className="space-y-2">
              {UPDATES.recentlyAdded.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Coming Soon */}
          <div className="px-5 pt-3 pb-5 mt-1 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-blue-700">🔜 Coming Soon</p>
            </div>
            <ul className="space-y-2">
              {UPDATES.comingSoon.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                  <span className="text-blue-300 mt-0.5 flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 italic mt-4">
              This list is updated regularly. Check back for the latest improvements!
            </p>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-2">
          <p className="font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Phone className="h-4 w-4 text-indigo-500" />
            Still need help?
          </p>
          <p className="text-xs text-slate-500 mb-4">Contact the school administration for further assistance.</p>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{school?.school_name || 'School Administration'}</p>
            {school?.address && (
              <p className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">📍</span>{school.address}
              </p>
            )}
            {school?.phone && (
              <a href={`tel:${school.phone}`} className="text-sm text-indigo-600 flex items-center gap-2 hover:underline">
                <Phone className="h-3.5 w-3.5" />{school.phone}
              </a>
            )}
            {school?.email && (
              <a href={`mailto:${school.email}`} className="text-sm text-indigo-600 flex items-center gap-2 hover:underline">
                <Mail className="h-3.5 w-3.5" />{school.email}
              </a>
            )}
            {school?.website && (
              <a href={school.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 flex items-center gap-2 hover:underline">
                <Globe className="h-3.5 w-3.5" />{school.website}
              </a>
            )}
            {!school?.phone && !school?.email && (
              <p className="text-xs text-slate-400 italic">Contact details will appear here once the school profile is set up.</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          {school?.school_name || 'School'} · Help &amp; User Guide · v2.0
        </p>
      </div>
    </div>
  );
}