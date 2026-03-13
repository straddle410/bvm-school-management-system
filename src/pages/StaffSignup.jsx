import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import bcrypt from 'npm:bcryptjs@2.4.3';

export default function StaffSignup() {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    role: '',
    designation: '',
    qualification: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!formData.mobile.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!formData.role) {
      toast.error('Please select a role');
      return;
    }
    if (!formData.designation.trim()) {
      toast.error('Department is required');
      return;
    }
    if (!formData.qualification.trim()) {
      toast.error('Qualification is required');
      return;
    }
    if (!formData.password) {
      toast.error('Password is required');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Hash password
      const password_hash = await bcrypt.hash(formData.password, 10);

      // Create pending staff account (no staff_code yet)
      await base44.entities.StaffAccount.create({
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        role: formData.role.toLowerCase(),
        designation: formData.designation.trim(),
        qualification: formData.qualification.trim(),
        password_hash,
        is_active: false,
        status: 'pending',
        username: `temp_${Date.now()}`, // Temporary username until approved
        force_password_change: false,
      });

      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Application Submitted!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your application has been submitted successfully. Please wait for admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={createPageUrl('StaffLogin')}>
              <Button className="w-full">Back to Login</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Staff Registration</CardTitle>
          <CardDescription>Apply for a staff position</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter your full name"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Phone Number *</Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                placeholder="Enter your phone number"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange('role', value)}
                disabled={loading}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="exam_staff">Exam Staff</SelectItem>
                  <SelectItem value="librarian">Librarian</SelectItem>
                  <SelectItem value="staff">Support Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="designation">Department *</Label>
              <Input
                id="designation"
                value={formData.designation}
                onChange={(e) => handleChange('designation', e.target.value)}
                placeholder="e.g., Mathematics, Science"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualification">Qualification *</Label>
              <Input
                id="qualification"
                value={formData.qualification}
                onChange={(e) => handleChange('qualification', e.target.value)}
                placeholder="e.g., B.Ed, M.Sc"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Minimum 6 characters"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>

            <div className="pt-4 space-y-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>

              <a href={createPageUrl('StaffLogin')} className="block">
                <Button type="button" variant="outline" className="w-full" disabled={loading}>
                  Back to Login
                </Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}