import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Check } from 'lucide-react';

const currentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  } else {
    return `${year - 1}-${String(year).slice(2)}`;
  }
};

export default function PublicAdmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_name: '',
    dob: '',
    gender: '',
    applying_for_class: '',
    section: 'A',
    photo_url: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    address: '',
    previous_school: '',
    documents: [],
    academic_year: currentAcademicYear()
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      if (fileType === 'photo') {
        setFormData(prev => ({ ...prev, photo_url: file_url }));
        toast.success('Photo uploaded');
      } else {
        setFormData(prev => ({
          ...prev,
          documents: [...prev.documents, file_url]
        }));
        toast.success('Document uploaded');
      }
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.student_name || !formData.parent_name || !formData.parent_email || !formData.applying_for_class) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      await base44.entities.AdmissionApplication.create({
        ...formData,
        status: 'Pending'
      });
      setSubmitted(true);
      toast.success('Application submitted successfully');
    } catch (error) {
      toast.error('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
            <p className="text-gray-600 mb-4">Your admission application has been received. Our team will review it and notify you soon.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Submit Another</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>School Admission Application</CardTitle>
            <CardDescription>Please fill out the form to apply for admission</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Student Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Student Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Student Name *</Label>
                      <Input
                        name="student_name"
                        value={formData.student_name}
                        onChange={handleInputChange}
                        placeholder="Full name"
                        required
                      />
                    </div>
                    <div>
                      <Label>Date of Birth *</Label>
                      <Input
                        name="dob"
                        type="date"
                        value={formData.dob}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Gender *</Label>
                      <Select value={formData.gender} onValueChange={(val) => handleSelectChange('gender', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
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
                      <Select value={formData.applying_for_class} onValueChange={(val) => handleSelectChange('applying_for_class', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(cls => (
                            <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Student Photo</Label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'photo')}
                      disabled={loading}
                      className="w-full p-2 border rounded-md"
                    />
                    {formData.photo_url && <p className="text-xs text-green-600 mt-1">✓ Photo uploaded</p>}
                  </div>
                </div>
              </div>

              {/* Parent Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Parent/Guardian Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Parent Name *</Label>
                      <Input
                        name="parent_name"
                        value={formData.parent_name}
                        onChange={handleInputChange}
                        placeholder="Full name"
                        required
                      />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input
                        name="parent_phone"
                        value={formData.parent_phone}
                        onChange={handleInputChange}
                        placeholder="10-digit phone"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Email Address *</Label>
                    <Input
                      name="parent_email"
                      type="email"
                      value={formData.parent_email}
                      onChange={handleInputChange}
                      placeholder="parent@example.com"
                      required
                    />
                  </div>

                  <div>
                    <Label>Residential Address</Label>
                    <Textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Full address"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Previous School (if any)</Label>
                    <Input
                      name="previous_school"
                      value={formData.previous_school}
                      onChange={handleInputChange}
                      placeholder="School name"
                    />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
                <div className="space-y-2">
                  <label className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
                    <Upload className="h-5 w-5 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Upload documents (Birth Certificate, Previous School Certificate, etc)</p>
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, 'document')}
                      disabled={loading}
                      className="hidden"
                      multiple
                    />
                  </label>
                  {formData.documents.length > 0 && (
                    <p className="text-xs text-green-600">✓ {formData.documents.length} document(s) uploaded</p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}