import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getSubjectsForClass } from '@/components/subjectHelper';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AIAssistDrawer from '@/components/AIAssistDrawer';

export default function PostingDashboard() {
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [saving, setSaving] = useState(false);

  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    class_name: '',
    section: '',
    subject: '',
    diary_date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    const staffData = getStaffSession();
    setUser(staffData);
  }, []);

  // Load dynamic classes
  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then((result) => {
      setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
    });
  }, [academicYear]);

  // Load sections when class changes
  useEffect(() => {
    if (!form.class_name || !academicYear) { setAvailableSections([]); return; }
    getSectionsForClass(academicYear, form.class_name).then((result) => {
      const secs = Array.isArray(result) ? result : (result?.sections ?? []);
      setAvailableSections(secs);
      if (secs.length === 1) setForm(f => ({ ...f, section: secs[0] }));
      else if (form.section && !secs.includes(form.section)) setForm(f => ({ ...f, section: '' }));
    });
  }, [form.class_name, academicYear]);

  // Load subjects when class changes
  useEffect(() => {
    if (!form.class_name || !academicYear) { setSubjects([]); return; }
    getSubjectsForClass(academicYear, form.class_name).then((result) => {
      setSubjects(result.subjects || []);
      if (form.subject && !(result.subjects || []).includes(form.subject)) {
        setForm(f => ({ ...f, subject: '' }));
      }
    });
  }, [form.class_name, academicYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.class_name) { toast.error('Class is required'); return; }
    if (!form.diary_date) { toast.error('Date is required'); return; }

    setSaving(true);
    try {
      await base44.entities.Diary.create({
        title: form.title,
        description: form.description,
        class_name: form.class_name,
        section: form.section,
        subject: form.subject,
        diary_date: form.diary_date,
        academic_year: academicYear,
        status: 'Published',
        posted_by: user?.email,
        posted_by_name: user?.name,
      });
      toast.success('Diary entry posted successfully!');
      // Reset form
      setForm({
        title: '',
        description: '',
        class_name: '',
        section: '',
        subject: '',
        diary_date: format(new Date(), 'yyyy-MM-dd'),
      });
    } catch (err) {
      toast.error('Failed to post diary entry');
      console.error('[PostingDashboard] Diary save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col">
      {/* Form */}
      <main className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Class & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Class *</Label>
                  <Select value={form.class_name} onValueChange={(v) => setForm({ ...form, class_name: v, section: '', subject: '' })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableClasses.map((cls) => (
                        <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section</Label>
                  <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })} disabled={availableSections.length === 0}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={form.class_name ? 'Select section' : 'Select class first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.map((sec) => (
                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label>Subject</Label>
                {!form.class_name ? (
                  <div className="mt-1 text-xs text-gray-500 py-2 px-3 bg-gray-100 rounded-lg">Select class first</div>
                ) : subjects.length === 0 ? (
                  <div className="mt-1 text-xs text-orange-600 py-2 px-3 bg-orange-50 rounded-lg">No subjects configured for this class</div>
                ) : (
                  <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((sub) => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date */}
              <div>
                <Label>Diary Date *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.diary_date}
                  onChange={(e) => setForm({ ...form, diary_date: e.target.value })}
                  required
                />
              </div>

              {/* Title */}
              <div>
                <Label>Title *</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g., Today's lesson on Fractions"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label>Description *</Label>
                <Textarea
                  className="mt-1 min-h-32"
                  placeholder="What was taught, activities, homework assigned, etc."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-pink-600 hover:bg-pink-700" disabled={saving}>
                  {saving ? 'Posting...' : 'Post Diary'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* AI Assist Drawer */}
      {showAIAssist && (
        <AIAssistDrawer
          type="diary"
          className={form.class_name}
          section={form.section}
          academicYear={academicYear}
          onInsert={(generated) => {
            setForm(f => ({
              ...f,
              title: generated.title || f.title,
              description: generated.body || f.description,
            }));
            setShowAIAssist(false);
            toast.success('Content inserted!');
          }}
          onClose={() => setShowAIAssist(false)}
        />
      )}
    </div>
  );
}