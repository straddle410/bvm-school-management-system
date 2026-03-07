import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getSubjectsForClass, getSubjectSourceLabel } from '@/components/subjectHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import AIAssistDrawer from '@/components/AIAssistDrawer';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

export default function DiaryForm({ entry, onSubmit, onCancel, academicYear: propAcademicYear }) {
   const contextAcademicYear = useAcademicYear();
   const finalAcademicYear = propAcademicYear || contextAcademicYear.academicYear;
   const todayDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
   const [showAIAssist, setShowAIAssist] = useState(false);
   const [availableClasses, setAvailableClasses] = useState([]);
   const [availableSections, setAvailableSections] = useState([]);

   // Debug logging
   useEffect(() => {
     const staffSession = localStorage.getItem('staff_session');
     console.log('[AI_ASSIST_RENDER]', { page: 'Diary', staff: !!staffSession });
   }, []);

   // Load dynamic classes
   useEffect(() => {
     if (!finalAcademicYear) return;
     getClassesForYear(finalAcademicYear).then((result) => {
       setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
     });
   }, [finalAcademicYear]);

   const [formData, setFormData] = useState(entry || {
    title: '',
    description: '',
    class_name: '',
    section: 'A',
    subject: '',
    diary_date: todayDate,
    attachment_urls: [],
    academic_year: finalAcademicYear,
    status: 'Draft'
  });

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [subjectSourceLabel, setSubjectSourceLabel] = useState('');

  // Load sections when class changes
  useEffect(() => {
    if (!formData.class_name || !finalAcademicYear) { setAvailableSections([]); return; }
    getSectionsForClass(finalAcademicYear, formData.class_name).then((result) => {
      const secs = Array.isArray(result) ? result : (result?.sections ?? []);
      setAvailableSections(secs);
      if (secs.length === 1) setFormData(f => ({ ...f, section: secs[0] }));
      else if (formData.section && !secs.includes(formData.section)) setFormData(f => ({ ...f, section: '' }));
    });
  }, [formData.class_name, finalAcademicYear]);

  // Fetch subjects when class changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (formData.class_name && finalAcademicYear) {
        console.log('[SUBJECT_FETCH]', {
          module: 'Diary',
          year: finalAcademicYear,
          classRaw: formData.class_name,
        });
        const result = await getSubjectsForClass(finalAcademicYear, formData.class_name);
        console.log('[DIARY_FORM_RESULT]', { source: result.source, subjects: result.subjects });
        setSubjects(result.subjects);
        setSubjectSourceLabel(getSubjectSourceLabel(result.source, finalAcademicYear));
        // Reset subject if not in new list
        if (result.subjects.length > 0 && !result.subjects.includes(formData.subject)) {
          setFormData(f => ({ ...f, subject: '' }));
        }
      } else {
        setSubjects([]);
        setSubjectSourceLabel('');
      }
    };
    fetchSubjects();
  }, [formData.class_name, finalAcademicYear]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      
      setFormData(prev => ({
        ...prev,
        attachment_urls: [...(prev.attachment_urls || []), ...uploadedUrls]
      }));
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url) => {
    setFormData(prev => ({
      ...prev,
      attachment_urls: prev.attachment_urls.filter(u => u !== url)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in title and description');
      return;
    }
    onSubmit(formData);
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle>{entry ? 'Edit Diary Entry' : 'Create Diary Entry'}</CardTitle>
         <Button
           size="sm"
           onClick={() => setShowAIAssist(true)}
           className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
         >
           <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Assist
         </Button>
       </CardHeader>
      <CardContent className="max-h-[80vh] overflow-y-auto">
         <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Class *</label>
              <Select
                value={formData.class_name}
                onValueChange={(val) => setFormData({ ...formData, class_name: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map(cls => (
                    <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Section *</label>
              <Select
                value={formData.section}
                onValueChange={(val) => setFormData({ ...formData, section: val })}
                disabled={availableSections.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.class_name ? 'Select Section' : 'Select class first'} />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.map(sec => (
                    <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Subject *</label>
              <Select
                value={formData.subject}
                onValueChange={(val) => setFormData({ ...formData, subject: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjectSourceLabel && <p className="text-xs text-gray-500 mt-1">{subjectSourceLabel}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Diary Date *</label>
            <Input
              type="date"
              value={formData.diary_date}
              onChange={(e) => setFormData({ ...formData, diary_date: e.target.value })}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Title *</label>
            <Input
              placeholder="e.g., Quadratic Equations Class Notes"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <Textarea
              placeholder="Write the diary content..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-32"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Attachments</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploading ? 'Uploading...' : 'Click to upload files (PDF, Images, Documents)'}
                </span>
              </label>
            </div>

            {formData.attachment_urls && formData.attachment_urls.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">Attached Files:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.attachment_urls.map((url, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      📎 File {idx + 1}
                      <button
                        type="button"
                        onClick={() => removeAttachment(url)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {entry ? 'Update' : 'Post'} Diary
            </Button>
          </div>
        </form>
        </CardContent>
        </Card>

        {showAIAssist && (
        <AIAssistDrawer
        type="diary"
        className={formData.class_name}
        section={formData.section}
        academicYear={finalAcademicYear}
        onInsert={(generated) => {
          setFormData(f => ({
            ...f,
            title: generated.title || f.title,
            description: generated.body || f.description
          }));
          toast.success('Content inserted!');
        }}
        onClose={() => setShowAIAssist(false)}
        />
        )}
        </>
        );
        }