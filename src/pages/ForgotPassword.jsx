import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Phone, AlertCircle } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSchoolInfo = async () => {
      try {
        const profiles = await base44.entities.SchoolProfile.list();
        if (profiles.length > 0) {
          setSchoolProfile(profiles[0]);
        }
      } catch (err) {
        console.error('Error loading school profile:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSchoolInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
      <button
        onClick={() => navigate('/StaffLogin')}
        className="absolute top-4 left-4 flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Login
      </button>

      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white rounded-t-lg">
          <CardTitle className="text-center text-2xl">Password Reset</CardTitle>
          <CardDescription className="text-center text-blue-100 mt-1">
            Account Access Recovery
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">
          <div className="space-y-6">
            {/* Info Box */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">To reset your password:</p>
                <p>Please contact your school administrator. Admin can reset passwords from the Admin Panel.</p>
              </div>
            </div>

            {/* Contact Info */}
            {!loading && schoolProfile && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900">School Contact Information</h3>
                
                {schoolProfile.school_name && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">School Name</p>
                    <p className="text-sm font-medium text-gray-900">{schoolProfile.school_name}</p>
                  </div>
                )}

                {schoolProfile.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                      <a href={`tel:${schoolProfile.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {schoolProfile.phone}
                      </a>
                    </div>
                  </div>
                )}

                {schoolProfile.email && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <a href={`mailto:${schoolProfile.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {schoolProfile.email}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Back Button */}
            <Button
              onClick={() => navigate('/StaffLogin')}
              className="w-full bg-gradient-to-r from-[#1a237e] to-[#283593]"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}