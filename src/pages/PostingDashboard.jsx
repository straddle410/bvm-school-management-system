import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { Sparkles, Notebook, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AIAssistDrawer from '@/components/AIAssistDrawer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const todayStr = format(new Date(), 'yyyy-MM-dd');

export default function PostingDashboard() {
  const navigate = useNavigate();
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showAIAssist, setShowAIAssist] = useState(false);

  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    class_name: '',
    section: '',
    subject: '',
    diary_date: todayStr,
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

  // Fetch today's diary entries
  const { data: todayEntries = [] } = useQuery({
    queryKey: ['diary-today', academicYear, todayStr],
    queryFn: () => base44.entities.Diary.filter({ academic_year: academicYear, diary_date: todayStr }, '-created_date'),
    enabled: !!academicYear,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Diary.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary-today'] });
      queryClient.invalidateQueries({ queryKey: ['diary'] });
      toast.success('Diary entry posted successfully!');
      setForm({
        title: '',
        description: '',
        class_name: '',
        section: '',
        subject: '',
        diary_date: todayStr,
      });
    },
    onError: () => toast.error('Failed to post diary entry'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Diary.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary-today'] });
      queryClient.invalidateQueries({ queryKey: ['diary'] });
      toast.success('Entry deleted');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.class_name) { toast.error('Class is required'); return; }

    createMutation.mutate({
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
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/Dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col pb-20">
      <div className="max-w-2xl mx-auto w-full p-4 space-y-4">

        {/* Post Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Notebook className="h-5 w-5 text-pink-600" /> Post Diary Entry
            </h2>
            <button
              type="button"
              onClick={() => setShowAIAssist(true)}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI Assist
            </button>
          </div>

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
                    <SelectValue placeholder={form.class_name ? 'Select section' : 'Class first'} />
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
                <div className="mt-1 text-xs text-orange-600 py-2 px-3 bg-orange-50 rounded-lg">No subjects configured</div>
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
                className="mt-1 min-h-28"
                placeholder="What was taught, activities, homework assigned, etc."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button type="submit" className="bg-pink-600 hover:bg-pink-700" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Posting...' : 'Post Diary'}
              </Button>
            </div>
          </form>
        </div>

        {/* Today's Posted Entries */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2 px-1">
            Today's Posted Entries ({todayEntries.length})
          </h3>
          {todayEntries.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm shadow-sm">
              No diary entries posted today yet.
            </div>
          ) : (
            <div className="space-y-3">
              {todayEntries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-pink-500">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{entry.title}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{entry.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                          Class {entry.class_name}{entry.section ? `-${entry.section}` : ''}
                        </span>
                        {entry.subject && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{entry.subject}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${entry.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {entry.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete this entry?')) deleteMutation.mutate(entry.id); }}
                      className="text-gray-400 hover:text-red-500 transition flex-shrink-0 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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