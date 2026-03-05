import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, AlertCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const [staffAccount, setStaffAccount] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    setError('');
    try {
      const session = JSON.parse(localStorage.getItem('staff_session') || '{}');
      const token = session?.staff_session_token;
      if (!token) {
        setError('No session token found. Please login again. [TOKEN_MISSING]');
        setIsLoading(false);
        return;
      }
      const res = await base44.functions.invoke('getMyStaffProfile', {
        staff_session_token: token,
      });

      if (!res.data || res.data.error) {
        const code = res.data?.code || 'UNKNOWN';
        setError(`${res.data?.error || 'Could not load profile'} [${code}]`);
        setIsLoading(false);
        return;
      }

      // Now fetch full StaffAccount record by canonical ID returned by server
      const canonicalId = res.data.staff_id;
      const accounts = await base44.entities.StaffAccount.filter({ id: canonicalId });
      if (!accounts || accounts.length === 0) {
        setError('Staff account record not found');
        setIsLoading(false);
        return;
      }

      const acct = accounts[0];
      setStaffAccount(acct);
      setFormData({
        mobile: acct.mobile || '',
        qualification: acct.qualification || '',
        address_line1: acct.address_line1 || '',
        address_line2: acct.address_line2 || '',
        city: acct.city || '',
        state: acct.state || '',
        pincode: acct.pincode || '',
        emergency_contact_name: acct.emergency_contact_name || '',
        emergency_contact_phone: acct.emergency_contact_phone || '',
        photo_url: acct.photo_url || '',
      });
    } catch (err) {
      console.error('Profile load error:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res.file_url) {
        setFormData(prev => ({ ...prev, photo_url: res.file_url }));
        toast.success('Photo uploaded');
      }
    } catch {
      toast.error('Failed to upload photo');
    }
  };

  const handleSave = async () => {
    if (formData.mobile && !/^\d{10,}$/.test(formData.mobile.replace(/[\s\-]/g, ''))) {
      toast.error('Phone must be numeric with at least 10 digits');
      return;
    }
    if (formData.emergency_contact_phone && !/^\d{10,}$/.test(formData.emergency_contact_phone.replace(/[\s\-]/g, ''))) {
      toast.error('Emergency contact phone must be numeric with at least 10 digits');
      return;
    }
    try {
      setIsSaving(true);
      const session = JSON.parse(localStorage.getItem('staff_session') || '{}');
      const res = await base44.functions.invoke('updateMyProfile', {
        ...formData,
        staff_session_token: session?.staff_session_token || null,
      });
      if (res.data?.success) {
        toast.success('Profile updated successfully');
        setIsEditing(false);
        loadProfile();
      } else {
        toast.error(res.data?.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Error saving profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !staffAccount) {
    const isLinkMissing = error?.includes('LINK_MISSING') || error?.includes('not linked') || error?.includes('log in again');
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-[#1a237e] hover:opacity-70">
            <ArrowLeft className="h-5 w-5" /> Back
          </button>
          <Card className={isLinkMissing ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
            <CardContent className="pt-6 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isLinkMissing ? 'text-red-600' : 'text-amber-600'}`} />
                <div>
                  <p className="font-semibold text-gray-900">
                    {isLinkMissing ? 'Session not linked' : 'Profile not found'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {isLinkMissing
                      ? 'Your session is not linked to a staff account. Please log out and log in again.'
                      : (error || 'Your staff account could not be loaded.')}
                  </p>
                </div>
              </div>
              {isLinkMissing && (
                <button
                  onClick={() => {
                    localStorage.removeItem('staff_session');
                    base44.auth.logout(createPageUrl('StaffLogin'));
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  <LogOut className="h-4 w-4" /> Log out and login again
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-[#1a237e] hover:opacity-70 font-medium">
          <ArrowLeft className="h-5 w-5" /> Back
        </button>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex gap-4 flex-1">
                <div className="relative">
                  {formData.photo_url ? (
                    <img src={formData.photo_url} alt={staffAccount.name} className="h-20 w-20 rounded-full object-cover border-2 border-[#1a237e]" />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#1a237e] to-[#3949ab] flex items-center justify-center text-white font-bold text-xl">
                      {staffAccount.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow cursor-pointer hover:bg-gray-100">
                      <Upload className="h-4 w-4 text-[#1a237e]" />
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">{staffAccount.name}</h1>
                  <p className="text-sm text-gray-600">{staffAccount.designation || staffAccount.role}</p>
                  <p className="text-xs text-gray-500 mt-1">{staffAccount.email}</p>
                </div>
              </div>
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)} className="bg-[#1a237e] hover:bg-[#0f1b5e]">
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Personal Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Personal Details</CardTitle>
            <CardDescription>Phone, address, and emergency contact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                {isEditing ? (
                  <Input name="mobile" value={formData.mobile} onChange={handleInputChange} placeholder="10+ digits" className="mt-1" />
                ) : (
                  <p className="mt-1 text-gray-900">{formData.mobile || '—'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <p className="mt-1 text-gray-900">{staffAccount.gender || '—'}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Address Line 1</label>
              {isEditing ? (
                <Input name="address_line1" value={formData.address_line1} onChange={handleInputChange} className="mt-1" />
              ) : (
                <p className="mt-1 text-gray-900">{formData.address_line1 || '—'}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Address Line 2</label>
              {isEditing ? (
                <Input name="address_line2" value={formData.address_line2} onChange={handleInputChange} className="mt-1" />
              ) : (
                <p className="mt-1 text-gray-900">{formData.address_line2 || '—'}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">City</label>
                {isEditing ? <Input name="city" value={formData.city} onChange={handleInputChange} className="mt-1" /> : <p className="mt-1 text-gray-900">{formData.city || '—'}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">State</label>
                {isEditing ? <Input name="state" value={formData.state} onChange={handleInputChange} className="mt-1" /> : <p className="mt-1 text-gray-900">{formData.state || '—'}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Pincode</label>
                {isEditing ? <Input name="pincode" value={formData.pincode} onChange={handleInputChange} className="mt-1" /> : <p className="mt-1 text-gray-900">{formData.pincode || '—'}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <label className="text-sm font-medium text-gray-700">Emergency Contact Name</label>
                {isEditing ? (
                  <Input name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleInputChange} className="mt-1" />
                ) : (
                  <p className="mt-1 text-gray-900">{formData.emergency_contact_name || '—'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Emergency Contact Phone</label>
                {isEditing ? (
                  <Input name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleInputChange} placeholder="10+ digits" className="mt-1" />
                ) : (
                  <p className="mt-1 text-gray-900">{formData.emergency_contact_phone || '—'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Professional Details</CardTitle>
            <CardDescription>Qualification and experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Qualification</label>
              {isEditing ? (
                <Input name="qualification" value={formData.qualification} onChange={handleInputChange} placeholder="e.g., B.A., M.Sc., B.Ed" className="mt-1" />
              ) : (
                <p className="mt-1 text-gray-900">{formData.qualification || '—'}</p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Experience (years)</label>
                <p className="mt-1 text-gray-900">{staffAccount.experience_years || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Joining Date</label>
                <p className="mt-1 text-gray-900">{staffAccount.joining_date || '—'}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Staff Code</label>
                <p className="mt-1 text-gray-900">{staffAccount.staff_code || '—'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                <p className="mt-1 text-gray-900">{staffAccount.dob || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Details</CardTitle>
            <CardDescription>Read-only information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Role:</span><span className="font-medium capitalize">{staffAccount.role}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Status:</span><span className="font-medium">{staffAccount.is_active ? 'Active' : 'Inactive'}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Classes Assigned:</span><span className="font-medium">{staffAccount.classes?.join(', ') || '—'}</span></div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-3 mt-6">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-green-600 hover:bg-green-700">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button onClick={() => { setIsEditing(false); loadProfile(); }} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}