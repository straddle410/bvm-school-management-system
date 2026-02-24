import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { getStaffSession } from '@/components/useStaffSession';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Save, Image as ImageIcon, Mail, Phone, Shield, Calendar, Lock, Bell, BellOff
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    phone: ''
  });
  const [enableOtp, setEnableOtp] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const session = getStaffSession();
    if (session) {
      setUser(session);
      setFormData({
        display_name: session.full_name || '',
        phone: session.phone || ''
      });
      // For staff session, use session data directly for OTP
      if (session.role?.toLowerCase() === 'admin') {
        setStaffData(session);
        setEnableOtp(true);
      }
      return;
    }
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    setFormData({
      display_name: currentUser.display_name || currentUser.full_name || '',
      phone: currentUser.phone || ''
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      let photo_url = user?.photo_url;
      if (photoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = result.file_url;
      }
      return base44.auth.updateMe({ ...formData, photo_url });
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      setPhotoFile(null);
      loadUser();
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error('Passwords do not match');
      }
      if (passwordForm.new_password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      // Call backend function to change password
      const response = await base44.functions.invoke('changePassword', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      return response;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setShowPasswordForm(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to change password');
    }
  });

  const updateOtpSetting = async (enabled) => {
    if (!staffData) return;
    try {
      await base44.entities.StaffAccount.update(staffData.id, { enable_otp_login: enabled });
      setEnableOtp(enabled);
      toast.success(`OTP login ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update OTP setting');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="My Profile"
        subtitle="Manage your account settings"
        backTo="Dashboard"
      />

      <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6 pt-24">
        {/* Profile Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar className="h-28 w-28 border-4 border-white shadow-lg">
                  <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : user.photo_url} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl">
                    {user.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                  <ImageIcon className="h-5 w-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files[0])}
                  />
                </label>
              </div>
              
              <h2 className="text-2xl font-bold text-slate-900 mt-4">{user.full_name}</h2>
              <p className="text-slate-500">{user.email}</p>
              
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-blue-100 text-blue-700 border-0 capitalize">
                  <Shield className="h-3 w-3 mr-1" />
                  {user.role || 'User'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500 mt-4">
                <Calendar className="h-4 w-4" />
                Member since {user.created_date ? format(new Date(user.created_date), 'MMMM yyyy') : 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                placeholder="Enter your display name"
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600">{user.email}</span>
                <Badge variant="outline" className="ml-auto text-xs">Verified</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+91 9876543210"
              />
            </div>
            
            <div className="flex justify-end pt-4">
              <Button 
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* OTP Login Setting - Admin Only */}
             {(user?.role?.toLowerCase() === 'admin' || staffData?.role?.toLowerCase() === 'admin') && (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  {enableOtp ? (
                    <Bell className="h-5 w-5 text-blue-600" />
                  ) : (
                    <BellOff className="h-5 w-5 text-slate-400" />
                  )}
                  <div>
                    <p className="font-medium text-slate-900">Email OTP Verification</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {enableOtp ? 'OTP verification required for login' : 'OTP verification disabled'}
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={enableOtp}
                  onCheckedChange={updateOtpSetting}
                  disabled={!staffData}
                />
              </div>
            )}

            {!showPasswordForm ? (
              <Button 
                variant="outline" 
                onClick={() => setShowPasswordForm(true)}
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                changePasswordMutation.mutate();
              }} className="space-y-4">
                <div>
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                    placeholder="Enter your current password"
                    required
                  />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                    placeholder="Enter new password (min 6 characters)"
                    required
                  />
                </div>
                <div>
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <p className="font-medium">Role</p>
                  <p className="text-sm text-slate-500">Your access level in the system</p>
                </div>
                <Badge className="capitalize">{user.role || 'user'}</Badge>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <p className="font-medium">Last Login</p>
                  <p className="text-sm text-slate-500">Your most recent sign in</p>
                </div>
                <span className="text-slate-600">
                  {user.last_login ? format(new Date(user.last_login), 'PPp') : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">Account Created</p>
                  <p className="text-sm text-slate-500">When you joined</p>
                </div>
                <span className="text-slate-600">
                  {user.created_date ? format(new Date(user.created_date), 'PP') : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}