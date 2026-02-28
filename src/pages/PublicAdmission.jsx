import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { School, CheckCircle2, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from "sonner";

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default function PublicAdmission() {
  const [photoFile, setPhotoFile] = useState(null);
  const [documentFiles, setDocumentFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [applicationNo, setApplicationNo] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  
  const [formData, setFormData] = useState({
    student_name: '',
    dob: '',
    gender: 'Male',
    applying_for_class: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    address: '',
    previous_school: ''
  });

  // Fetch active academic year on mount
  useEffect(() => {
    const fetchActiveYear = async () => {
      try {
        const years = await base44.entities.AcademicYear.filter({ is_active: true });
        if (years.length > 0) {
          setAcademicYear(years[0].year);
        }
      } catch (err) {
        console.error('Failed to fetch academic year:', err);
      }
    };
    fetchActiveYear();
  }, []);

  const { data: schoolProfiles = [] } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list()
  });

  const schoolProfile = schoolProfiles[0];

  const submitMutation = useMutation({
    mutationFn: async () => {
      let photo_url = null;
      let documents = [];

      if (photoFile) {
        const result = await base44.integrations.Core.UploadFile({ file: photoFile });
        photo_url = result.file_url;
      }

      for (const file of documentFiles) {
        const result = await base44.integrations.Core.UploadFile({ file });
        documents.push(result.file_url);
      }

      // Use backend function (academic_year determined server-side)
      const response = await base44.functions.invoke('submitPublicAdmission', {
        ...formData,
        photo_url,
        documents
      });

      return response.data;
    },
    onSuccess: (data) => {
      setApplicationNo(data.application_no);
      setSubmitted(true);
      toast.success('Application submitted successfully!');
    },
    onError: (error) => {
      const message = error.response?.data?.error || 'Failed to submit application. Please try again.';
      toast.error(message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
            <p className="text-slate-600 mb-6">
              Your admission application has been received successfully.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-500">Application Number</p>
              <p className="text-xl font-bold text-blue-600">{applicationNo}</p>
            </div>
            <p className="text-sm text-slate-500">
              Please save this number for future reference. We will contact you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-4">
          {schoolProfile?.logo_url ? (
            <img src={schoolProfile.logo_url} alt="Logo" className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <School className="h-8 w-8 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-blue-900">
              {schoolProfile?.school_name || 'BVM School of Excellence'}
            </h1>
            <p className="text-sm text-slate-500">Online Admission Form</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b bg-blue-50/50">
            <CardTitle className="text-lg">Admission Application {academicYear || 'Loading...'}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Photo Upload */}
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="relative inline-block">
                    <Avatar className="h-28 w-28 border-4 border-white shadow-lg">
                      <AvatarImage src={photoFile ? URL.createObjectURL(photoFile) : undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl">
                        {formData.student_name?.[0] || '?'}
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
                  <p className="text-sm text-slate-500 mt-2">Upload Student Photo</p>
                </div>
              </div>

              {/* Student Details */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
                  Student Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Student Full Name *</Label>
                    <Input
                      value={formData.student_name}
                      onChange={(e) => setFormData({...formData, student_name: e.target.value})}
                      placeholder="Enter full name as per birth certificate"
                      required
                    />
                  </div>
                  <div>
                    <Label>Date of Birth *</Label>
                    <Input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(v) => setFormData({...formData, gender: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Applying for Class *</Label>
                    <Select
                      value={formData.applying_for_class}
                      onValueChange={(v) => setFormData({...formData, applying_for_class: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASSES.map(c => (
                          <SelectItem key={c} value={c}>Class {c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Previous School (if any)</Label>
                    <Input
                      value={formData.previous_school}
                      onChange={(e) => setFormData({...formData, previous_school: e.target.value})}
                      placeholder="Name of previous school"
                    />
                  </div>
                </div>
              </div>

              {/* Parent Details */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
                  Parent/Guardian Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Parent/Guardian Name *</Label>
                    <Input
                      value={formData.parent_name}
                      onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
                      placeholder="Enter parent/guardian full name"
                      required
                    />
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Input
                      value={formData.parent_phone}
                      onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
                      placeholder="+91 9876543210"
                      required
                    />
                  </div>
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={formData.parent_email}
                      onChange={(e) => setFormData({...formData, parent_email: e.target.value})}
                      placeholder="parent@email.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Complete Address *</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="Enter complete residential address"
                      rows={3}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
                  Documents (Optional)
                </h3>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 mb-2">
                    Upload birth certificate, previous school TC, etc.
                  </p>
                  <label className="inline-block">
                    <span className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-200 transition-colors">
                      Select Files
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setDocumentFiles(Array.from(e.target.files))}
                    />
                  </label>
                  {documentFiles.length > 0 && (
                    <p className="text-sm text-green-600 mt-3">
                      {documentFiles.length} file(s) selected
                    </p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? 'Submitting Application...' : 'Submit Application'}
                </Button>
                <p className="text-xs text-center text-slate-500 mt-4">
                  By submitting this form, you agree to the terms and conditions of admission.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}