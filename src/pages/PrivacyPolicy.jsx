import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">{title}</h2>
    <div className="text-slate-600 text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

const DataTable = ({ rows }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200 mt-2">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left px-4 py-2.5 font-semibold text-slate-700 w-1/2">Data Category</th>
          <th className="text-left px-4 py-2.5 font-semibold text-slate-700 w-1/2">Examples</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(([cat, ex], i) => (
          <tr key={i} className="hover:bg-slate-50/50">
            <td className="px-4 py-2.5 font-medium text-slate-700">{cat}</td>
            <td className="px-4 py-2.5 text-slate-500">{ex}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function PrivacyPolicy() {
  const [school, setSchool] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.SchoolProfile.list()
      .then(profiles => { if (profiles?.[0]) setSchool(profiles[0]); })
      .catch(() => {});
  }, []);

  const schoolName = school?.school_name || 'the School';
  const contactEmail = school?.email || 'admin@school.edu';
  const contactPhone = school?.phone || '';
  const address = school?.address || '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <Shield className="h-5 w-5 text-indigo-600" />
        <h1 className="text-base font-bold text-slate-800">Privacy Policy</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10">

          {/* Title Block */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{schoolName}</h1>
            <p className="text-sm text-slate-500">Privacy Policy &mdash; Effective Date: March 2026</p>
            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <p className="text-sm text-indigo-800">
                <strong>{schoolName}</strong> ("we", "our", or "the School") is committed to protecting the privacy of our students, parents, staff, and all users of our School Management Application. This Privacy Policy explains what information we collect, how we use it, and the rights you have regarding your data.
              </p>
            </div>
          </div>

          {/* 1. Information We Collect */}
          <Section title="1. Information We Collect">
            <p>We collect the following categories of personal information through our School Management Application:</p>
            <DataTable rows={[
              ['Student Information', 'Full name, date of birth, gender, blood group, photo, home address'],
              ['Academic Records', 'Marks, grades, exam results, progress cards, hall tickets'],
              ['Attendance Records', 'Daily attendance, half-day entries, holiday records'],
              ['Fee & Financial Data', 'Fee invoices, payment receipts, outstanding balances, discount details'],
              ['Parent / Guardian Info', 'Name, phone number, email address, relationship to student'],
              ['Staff Information', 'Name, designation, contact details, assigned classes, login credentials'],
              ['Communication Data', 'Messages sent via the app, notices read, diary entries'],
              ['Homework & Submissions', 'Homework assigned, student submissions, grades, teacher feedback'],
              ['Login & Usage Data', 'Login timestamps, IP address, device info, session activity'],
              ['Uploaded Documents', 'Student photos, admission documents, gallery photos'],
            ]} />
          </Section>

          {/* 2. How We Use Your Information */}
          <Section title="2. How We Use Your Information">
            <p>Information collected is used exclusively for the following educational and administrative purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Maintaining accurate student academic and attendance records</li>
              <li>Processing and tracking fee payments and generating receipts</li>
              <li>Communicating school notices, announcements, and updates to staff and parents</li>
              <li>Generating progress cards, hall tickets, and academic reports</li>
              <li>Facilitating homework assignments and student submissions</li>
              <li>Managing staff accounts, roles, and permissions</li>
              <li>Conducting internal analytics to improve teaching outcomes</li>
              <li>Ensuring the security and integrity of the application</li>
              <li>Complying with legal and regulatory requirements</li>
            </ul>
            <p className="mt-2 text-xs text-slate-500 italic">We do not use your data for marketing, advertising, or any purpose unrelated to school operations.</p>
          </Section>

          {/* 3. Who Has Access to Your Data */}
          <Section title="3. Who Has Access to Your Data">
            <p>Access to personal information is strictly role-based and limited to those with a legitimate need:</p>
            <DataTable rows={[
              ['School Administrators / Principal', 'Full access to all records across the system'],
              ['Teaching Staff', 'Access to records of assigned classes only (attendance, marks, homework)'],
              ['Accountant / Finance Staff', 'Access to fee invoices, payments, and financial reports only'],
              ['Exam Staff', 'Access to marks entry, exam types, and attendance records only'],
              ['Students', 'Access to their own academic records, fees, timetable, and homework'],
              ['Parents / Guardians', 'Access to their child\'s records via student login credentials'],
            ]} />
            <p>Personal data is <strong>never shared</strong> with third parties, advertisers, or external organizations without explicit written consent from the school administration, except where required by applicable law.</p>
          </Section>

          {/* 4. Children's Privacy */}
          <Section title="4. Children's Privacy">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="font-semibold text-yellow-800 mb-2">Special Protection for Minors</p>
              <p className="text-yellow-700 text-sm">Our application serves students who may be under 13 years of age. We treat all student data with the highest level of care in accordance with applicable child privacy laws.</p>
            </div>
            <ul className="list-disc list-inside space-y-1.5 pl-2 mt-3">
              <li>Student accounts are created and managed by school administrators — students do not self-register</li>
              <li>Parent/guardian consent is obtained at the time of admission, covering use of the app</li>
              <li>Student data is never used for targeted advertising, profiling, or shared with commercial entities</li>
              <li>Photos of students are stored securely and only accessible to authorized school staff and the student's own family</li>
              <li>Parents may request to review, update, or delete their child's data by contacting the school administration</li>
              <li>Student login credentials are issued securely and parents are encouraged to supervise their child's app usage</li>
            </ul>
          </Section>

          {/* 5. Data Security */}
          <Section title="5. Data Security">
            <p>We implement robust technical and organizational measures to protect your personal information:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><strong>Encrypted passwords:</strong> All user passwords are stored using industry-standard bcrypt hashing — plaintext passwords are never stored</li>
              <li><strong>Role-based access control (RBAC):</strong> Each user can only access data relevant to their role</li>
              <li><strong>Session security:</strong> Login sessions are time-limited and invalidated upon logout</li>
              <li><strong>Account lockout:</strong> Accounts are temporarily locked after repeated failed login attempts</li>
              <li><strong>Secure data storage:</strong> All data is stored on secure cloud infrastructure with access controls</li>
              <li><strong>Audit logging:</strong> Sensitive actions (e.g., fee reversals, student approvals) are logged with timestamps and user identity</li>
              <li><strong>HTTPS:</strong> All data transmitted between the app and our servers is encrypted in transit</li>
            </ul>
            <p>While we strive to protect your data, no system is completely impenetrable. In the event of a data breach, affected users will be notified in accordance with applicable law.</p>
          </Section>

          {/* 6. Data Retention */}
          <Section title="6. Data Retention">
            <p>We retain personal data for as long as it is necessary for legitimate educational and administrative purposes:</p>
            <DataTable rows={[
              ['Student academic records', 'Retained for the duration of enrollment and up to 7 years after graduation/transfer'],
              ['Attendance records', 'Retained for the current and up to 3 prior academic years'],
              ['Fee & payment records', 'Retained for a minimum of 7 years for audit and legal compliance'],
              ['Staff records', 'Retained for the duration of employment and up to 5 years after leaving'],
              ['Login & session logs', 'Retained for up to 1 year for security purposes'],
              ['Uploaded documents & photos', 'Retained while the student/staff is active; archived or deleted upon request'],
            ]} />
            <p>Data that is no longer required is either anonymized or securely deleted in accordance with our data retention policy.</p>
          </Section>

          {/* 7. Your Rights */}
          <Section title="7. Your Rights">
            <p>Subject to applicable law, you have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you or your child</li>
              <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Right to Deletion:</strong> Request deletion of data where it is no longer necessary (subject to legal retention requirements)</li>
              <li><strong>Right to Restriction:</strong> Request that we limit how we process your data in certain circumstances</li>
              <li><strong>Right to Portability:</strong> Request a copy of your data in a machine-readable format where applicable</li>
              <li><strong>Right to Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time</li>
            </ul>
            <p>To exercise any of these rights, please contact the school administration using the contact details in Section 9. We will respond to your request within 30 days.</p>
          </Section>

          {/* 8. Cookies & Local Storage */}
          <Section title="8. Cookies &amp; Local Storage">
            <p>Our app uses browser local storage (not cookies) to maintain your login session and user preferences. This data is stored only on your device and is cleared when you log out.</p>
            <p>We do not use third-party tracking cookies or analytics scripts that collect personally identifiable information.</p>
          </Section>

          {/* 9. Contact Information */}
          <Section title="9. Contact Us">
            <p>For any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact the school administration:</p>
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-800">{schoolName}</p>
              {address && <p className="text-slate-600 text-sm">{address}</p>}
              {contactPhone && <p className="text-slate-600 text-sm">Phone: {contactPhone}</p>}
              {contactEmail && <p className="text-slate-600 text-sm">Email: {contactEmail}</p>}
              {!address && !contactPhone && !contactEmail && (
                <p className="text-slate-500 text-xs italic">Please contact the school office for current contact details.</p>
              )}
            </div>
          </Section>

          {/* 10. Changes to this Policy */}
          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. When we make significant changes, we will notify users via the school's notice board within the app.</p>
            <p>Continued use of the App after changes are posted constitutes acceptance of the revised policy.</p>
          </Section>

          <p className="text-xs text-slate-400 text-center pt-4 border-t border-slate-100 mt-4">
            © {new Date().getFullYear()} {schoolName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}