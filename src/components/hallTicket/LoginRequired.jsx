import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, AlertCircle } from 'lucide-react';

export default function HallTicketLoginRequired({ children, allowedRoles = ['admin'] }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const ss = localStorage.getItem('staff_session');
        if (ss) {
          const session = JSON.parse(ss);
          setUser(session);
        }
      } catch (e) {
        console.error('Auth check failed');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <Lock className="w-12 h-12 mx-auto text-blue-600" />
            <h2 className="text-xl font-bold">Login Required</h2>
            <p className="text-slate-600">Only authorized staff can access hall ticket management</p>
            <Link to={createPageUrl('StaffLogin')}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Go to Staff Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-red-600" />
            <h2 className="text-xl font-bold text-red-600">Access Denied</h2>
            <p className="text-slate-600">Only administrators can manage hall tickets</p>
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="outline" className="w-full">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}