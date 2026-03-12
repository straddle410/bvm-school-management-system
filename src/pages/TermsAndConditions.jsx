import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-3 border-b border-slate-200 dark:border-gray-700 pb-2">{title}</h2>
    <div className="text-slate-600 dark:text-gray-300 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
);

export default function TermsAndConditions() {
  const [schoolName, setSchoolName] = useState('the School');
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.SchoolProfile.list().then(profiles => {
      if (profiles?.[0]?.school_name) setSchoolName(profiles[0].school_name);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
     <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm">
       <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition">
         <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-gray-300" />
       </button>
       <h1 className="text-base font-bold text-slate-800 dark:text-white">Terms &amp; Conditions</h1>
     </div>

     <div className="max-w-3xl mx-auto px-4 py-8">
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 md:p-10">
         <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{schoolName}</h1>
         <p className="text-sm text-slate-500 dark:text-gray-400 mb-8">Terms and Conditions &mdash; Last updated: March 2026</p>

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the {schoolName} School Management Application ("the App"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the App.</p>
            <p>These terms apply to all users of the App, including administrators, teaching staff, support staff, students, and parents/guardians.</p>
          </Section>

          <Section title="2. Use of the Application">
            <p>The App is provided exclusively for the educational and administrative operations of {schoolName}. You agree to use the App only for its intended purpose — managing academic records, attendance, fees, communications, and related school activities.</p>
            <p>Unauthorized access, sharing of login credentials, or use of the App outside its intended scope is strictly prohibited.</p>
          </Section>

          <Section title="3. User Accounts and Responsibilities">
            <p>Each user is responsible for maintaining the confidentiality of their account credentials. You must not share your username or password with any other person.</p>
            <p>You are responsible for all activities that occur under your account. Please notify the school administration immediately if you suspect unauthorized access to your account.</p>
            <p>Staff accounts are issued by the school administration. Student accounts are created upon enrollment and subject to the school's enrollment policies.</p>
          </Section>

          <Section title="4. Data Privacy">
            <p>The school is committed to protecting your personal information. Data collected through the App — including names, contact details, academic records, attendance, and financial information — is used solely for school management purposes.</p>
            <p>Personal data will not be shared with third parties without explicit consent, except where required by law or regulatory authorities.</p>
            <p>All data is stored securely and access is restricted to authorized personnel only. Parents and students may request access to their own data by contacting the school administration.</p>
          </Section>

          <Section title="5. Prohibited Activities">
            <p>Users must not engage in any of the following:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Attempting to gain unauthorized access to other users' accounts or data</li>
              <li>Uploading or sharing offensive, defamatory, or inappropriate content</li>
              <li>Using the App to harass, bully, or threaten any individual</li>
              <li>Interfering with the App's functionality or infrastructure</li>
              <li>Using the App for any commercial purpose not authorized by the school</li>
              <li>Sharing, copying, or distributing content from the App without permission</li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <p>All content within the App — including student records, academic materials, reports, notices, and branding — is the property of {schoolName} or its respective owners.</p>
            <p>Users may not reproduce, distribute, or create derivative works from any App content without prior written permission from the school administration.</p>
          </Section>

          <Section title="7. Termination">
            <p>The school reserves the right to suspend or terminate access to the App for any user who violates these Terms and Conditions or whose association with the school ends (e.g., staff resignation, student graduation or transfer).</p>
            <p>Upon termination, the user's access will be revoked and their data will be handled in accordance with the school's data retention policy.</p>
          </Section>

          <Section title="8. Contact Information">
            <p>For questions, concerns, or requests related to these Terms and Conditions or your data, please contact the school administration:</p>
            <div className="mt-3 p-4 bg-slate-50 dark:bg-gray-700 rounded-lg border border-slate-200 dark:border-gray-600">
             <p className="font-semibold text-slate-800 dark:text-white">{schoolName}</p>
             <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Please reach out to the school office for the most current contact details.</p>
            </div>
          </Section>

          <p className="text-xs text-slate-400 dark:text-gray-500 text-center pt-4 border-t border-slate-100 dark:border-gray-700 mt-4">
            © {new Date().getFullYear()} {schoolName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}