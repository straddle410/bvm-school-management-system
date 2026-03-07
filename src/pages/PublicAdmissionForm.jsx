import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Check, AlertCircle } from 'lucide-react';

export default function PublicAdmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [admissionYears, setAdmissionYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearError, setYearError] = useState(null);
  const [availableClasses, setAvailableClasses] = useState([]);

  const [formData, setFormData] = useState({
    student_name: '',
    dob: '',
    gender: '',
    applying_for_class: '',
    photo_url: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    address: '',
    previous_school: '',
    documents: [],
    academic_year: ''
  });

  // Load admission open years and available classes on mount
  useEffect(() => {
    const loadAdmissionData = async () => {
      try {
        const response = await base44.functions.invoke('getAdmissionOpenYears', {});
        const years = response.data.years || [];
        
        if (years.length === 0) {
          setYearError('Admissions are currently closed.');
        } else {
          setAdmissionYears(years);
          // If only one year, auto-select it and load classes
          if (years.length === 1) {
            setSelectedYear(years[0].year);
            setFormData(prev => ({ ...prev, academic_year: years[0].year }));
            await loadClassesForYear(years[0].year);
          }
        }
      } catch (error) {
        const msg = error.response?.data?.error || 'Failed to load admission years';
        setYearError(msg);
      } finally {
        setPageLoading(false);
      }
    };

    loadAdmissionData();
  }, []);

  // Load available classes for a given academic year
  const loadClassesForYear = async (year) => {
    try {
      const sectionConfigs = await base44.entities.SectionConfig.filter({
        academic_year: year,
        is_active: true
      });
      // Extract unique class names and sort
      const classNames = [...new Set(sectionConfigs.map(s => s.class_name))];
      setAvailableClasses(classNames);
    } catch (error) {
      console.error('Failed to load classes:', error);
      setAvailableClasses([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    setFormData(prev => ({ ...prev, academic_year: value }));
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

    if (!formData.student_name || !formData.parent_name || !formData.parent_email || !formData.applying_for_class || !formData.address.trim()) {
      if (!formData.address.trim()) {
        toast.error('Residential address is required.');
      } else {
        toast.error('Please fill all required fields');
      }
      return;
    }

    try {
      setLoading(true);
      const response = await base44.functions.invoke('submitPublicAdmission', {
        student_name: formData.student_name,
        dob: formData.dob,
        gender: formData.gender,
        applying_for_class: formData.applying_for_class,
        parent_name: formData.parent_name,
        parent_phone: formData.parent_phone,
        parent_email: formData.parent_email,
        address: formData.address.trim(),
        previous_school: formData.previous_school,
        photo_url: formData.photo_url,
        documents: formData.documents,
        academic_year: formData.academic_year
      });
      setSubmitted(true);
      toast.success('Application submitted successfully');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to submit application';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (yearError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Admissions Closed</h2>
            <p className="text-gray-600">{yearError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            {/* Academic Year Selection */}
            {admissionYears.length > 1 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3">Select Academic Year for Admission</h3>
                <Select value={selectedYear || ''} onValueChange={handleYearChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {admissionYears.map((yr) => (
                      <SelectItem key={yr.year} value={yr.year}>{yr.year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show selected year info */}
            {selectedYear && (
              <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-800">
                ✓ Admissions Open For Academic Year {selectedYear}
              </div>
            )}

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
                    <Label>Residential Address *</Label>
                    <Textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Full address"
                      rows={3}
                      required
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