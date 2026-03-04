import React, { useState, useEffect } from 'react';
import { getStaffSession } from '@/components/useStaffSession';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

/**
 * Wraps staff-only pages. 
 * If not logged in → shows a login prompt.
 * If logged in but wrong role → shows access denied.
 * allowedRoles: if omitted, any logged-in user is allowed.
 * 
 * On successful login, checks sessionStorage for postLoginRedirect and redirects there.
 */
export default function LoginRequired({ children, allowedRoles, pageName }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    const session = getStaffSession();
    setUser(session);
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-sm max-w-xs w-full">
          <div className="h-16 w-16 rounded-2xl bg-[#e8eaf6] flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="h-8 w-8 text-[#1a237e]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Staff Login Required</h2>
          <p className="text-sm text-gray-500 mb-6">
            {pageName ? `The "${pageName}" section` : 'This section'} is only accessible to authorised staff members.
          </p>
          <Button
            className="w-full bg-[#1a237e] hover:bg-[#283593] text-white rounded-xl"
            onClick={() => {
              // Save intended destination so StaffLogin can redirect back after login
              sessionStorage.setItem('postLoginRedirect', window.location.href);
              window.location.href = createPageUrl('StaffLogin');
            }}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Login
          </Button>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.some(r => r.toLowerCase() === (user.role || '').toLowerCase())) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-sm max-w-xs w-full">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500">
            You don't have permission to access this section. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return children;
}