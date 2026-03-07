import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getSubjectsForClass, getSubjectSourceLabel } from '@/components/subjectHelper';
import { X, Plus, Trash2, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIAssistDrawer from '@/components/AIAssistDrawer';
import { toast } from 'sonner';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

const TYPES = ['MCQ','Descriptive','Project','Assignment','Other'];
const TYPES = ['MCQ','Descriptive','Project','Assignment','Other'];

const emptyMCQ = () => ({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' });
const emptyDesc = () => ({ question: '' });

export default function HomeworkForm({ editItem, user, onClose, onSaved, isInline = false }) {
   const { academicYear } = useAcademicYear();
   const [showAIAssist, setShowAIAssist] = useState(false);
   const [availableClasses, setAvailableClasses] = useState([]);
   const [availableSections, setAvailableSections] = useState([]);
   const [form, setForm] = useState({
     title: '',
     subject: '',
     class_name: '',
     section: 'All',
     due_date: '',
     homework_type: 'Assignment',
     submission_mode: 'VIEW_ONLY',
     description: '',
     max_marks: '',
     mcq_questions: [emptyMCQ()],
     descriptive_questions: [emptyDesc()],
     attachment_url: '',
     assigned_by: user?.full_name || '',
   });

   // Debug logging
   useEffect(() => {
     const staffSession = localStorage.getItem('staff_session');
     console.log('[AI_ASSIST_RENDER]', { page: 'Homework', staff: !!staffSession, isInline });
   }, [isInline]);

   // Load dynamic classes
   useEffect(() => {
     if (!academicYear) return;
     getClassesForYear(academicYear).then((result) => {
       setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
     });
   }, [academicYear]);

   // Load dynamic sections when class changes
   useEffect(() => {
     if (!form.class_name || !academicYear) { setAvailableSections([]); return; }
     getSectionsForClass(academicYear, form.class_name).then((result) => {
       const secs = Array.isArray(result) ? result : (result?.sections ?? []);
       setAvailableSections(secs);
       if (secs.length === 1) setForm(f => ({ ...f, section: secs[0] }));
       else if (form.section && form.section !== 'All' && !secs.includes(form.section)) setForm(f => ({ ...f, section: 'All' }));
     });
   }, [form.class_name, academicYear]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [subjectSource, setSubjectSource] = useState('GLOBAL');
  const [subjectSourceLabel, setSubjectSourceLabel] = useState('');

  // Fetch subjects when class changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (form.class_name && academicYear) {
        console.log('[SUBJECT_FETCH]', {
          module: 'Homework',
          year: academicYear,
          classRaw: form.class_name,
        });
        const result = await getSubjectsForClass(academicYear, form.class_name);
        console.log('[HW_FORM_RESULT]', { source: result.source, subjects: result.subjects });
        setSubjects(result.subjects);
        setSubjectSource(result.source);
        setSubjectSourceLabel(getSubjectSourceLabel(result.source, academicYear));
        // Reset subject if not in new list
        if (result.subjects.length > 0 && !result.subjects.includes(form.subject)) {
          setForm(f => ({ ...f, subject: '' }));
        }
      } else {
        setSubjects([]);
        setSubjectSource('GLOBAL');
        setSubjectSourceLabel('');
      }
    };
    fetchSubjects();
  }, [form.class_name, academicYear]);

  useEffect(() => {
    if (editItem) {
      setForm({
        title: editItem.title || '',
        subject: editItem.subject || '',
        class_name: editItem.class_name || '',
        section: editItem.section || 'All',
        due_date: editItem.due_date || '',
        homework_type: editItem.homework_type || 'Assignment',
        submission_mode: editItem.submission_mode || 'VIEW_ONLY',
        description: editItem.description || '',
        max_marks: editItem.max_marks || '',
        mcq_questions: editItem.mcq_questions?.length ? editItem.mcq_questions : [emptyMCQ()],
        descriptive_questions: editItem.descriptive_questions?.length ? editItem.descriptive_questions : [emptyDesc()],
        attachment_url: editItem.attachment_url || '',
        assigned_by: editItem.assigned_by || user?.full_name || '',
      });
    }
  }, [editItem]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('attachment_url', file_url);
    setUploading(false);
  };

  const handleMCQChange = (idx, field, value) => {
    const updated = [...form.mcq_questions];
    updated[idx] = { ...updated[idx], [field]: value };
    set('mcq_questions', updated);
  };

  const handleDescChange = (idx, value) => {
    const updated = [...form.descriptive_questions];
    updated[idx] = { question: value };
    set('descriptive_questions', updated);
  };

  const handleSave = async () => {
    if (!form.title || !form.class_name || !form.subject || !form.due_date) {
      alert('Please fill all required fields.');
      return;
    }
    setLoading(true);
    const data = {
      ...form,
      max_marks: form.max_marks ? Number(form.max_marks) : undefined,
      academic_year: academicYear,
      status: 'Draft', // Always save new homework as Draft
    };
    console.log('[HW_SAVE]', { class: form.class_name, section: form.section, status: 'Draft', academic_year: academicYear });
    if (editItem) {
      await base44.entities.Homework.update(editItem.id, data);
    } else {
      await base44.entities.Homework.create(data);
      toast.success('Homework saved as Draft');
    }
    setLoading(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" style={{ paddingBottom: '64px' }}>
      <div className="bg-white w-full max-w-md rounded-t-3xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
        <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 flex items-center justify-between border-b">
             <h2 className="font-bold text-slate-800">{editItem ? 'Edit Homework' : 'Create Homework'}</h2>
             <div className="flex items-center gap-2">
               <Button
                 size="sm"
                 onClick={() => setShowAIAssist(true)}
                 className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
               >
                 <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Assist
               </Button>
               <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
             </div>
           </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="e.g. Chapter 3 Exercise" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Class *</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.class_name} onChange={e => set('class_name', e.target.value)}>
                <option value="">Select</option>
                {availableClasses.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Section</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.section} onChange={e => set('section', e.target.value)}>
                <option value="All">All</option>
                {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Subject *</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.subject} onChange={e => set('subject', e.target.value)}>
                <option value="">Select</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {subjectSourceLabel && <p className="text-xs text-gray-500 mt-1">{subjectSourceLabel}</p>}
              <p className="text-xs text-gray-400 mt-0.5">Year: {academicYear} | Class: {form.class_name || '—'} | Source: {subjectSource} | Count: {subjects.length}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Due Date *</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Type *</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.homework_type} onChange={e => set('homework_type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Max Marks</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.max_marks} onChange={e => set('max_marks', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Submission Mode</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.submission_mode} onChange={e => set('submission_mode', e.target.value)}>
              <option value="VIEW_ONLY">View Only</option>
              <option value="SUBMISSION_REQUIRED">Students Must Submit</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Instructions</label>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Write homework instructions..." />
          </div>

          {/* MCQ Section */}
          {form.homework_type === 'MCQ' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">MCQ Questions</label>
                <button onClick={() => set('mcq_questions', [...form.mcq_questions, emptyMCQ()])} className="text-xs text-[#1a237e] font-medium flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add Question
                </button>
              </div>
              {form.mcq_questions.map((q, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700">Q{i + 1}</span>
                    {form.mcq_questions.length > 1 && (
                      <button onClick={() => set('mcq_questions', form.mcq_questions.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2" placeholder="Question text" value={q.question} onChange={e => handleMCQChange(i, 'question', e.target.value)} />
                  {['A','B','C','D'].map(opt => (
                    <div key={opt} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-500 w-4">{opt}.</span>
                      <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" placeholder={`Option ${opt}`} value={q[`option_${opt.toLowerCase()}`]} onChange={e => handleMCQChange(i, `option_${opt.toLowerCase()}`, e.target.value)} />
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Correct Answer:</span>
                    {['A','B','C','D'].map(opt => (
                      <button key={opt} onClick={() => handleMCQChange(i, 'correct_answer', opt)}
                        className={`w-7 h-7 rounded-full text-xs font-bold ${q.correct_answer === opt ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Descriptive Section */}
          {form.homework_type === 'Descriptive' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">Questions</label>
                <button onClick={() => set('descriptive_questions', [...form.descriptive_questions, emptyDesc()])} className="text-xs text-[#1a237e] font-medium flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {form.descriptive_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-500 mt-2">Q{i + 1}.</span>
                  <textarea className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Write question..." value={q.question} onChange={e => handleDescChange(i, e.target.value)} />
                  {form.descriptive_questions.length > 1 && (
                    <button className="mt-2" onClick={() => set('descriptive_questions', form.descriptive_questions.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attachment */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Attachment (optional)</label>
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-3 py-2.5 cursor-pointer text-sm text-gray-500 hover:bg-gray-50">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : form.attachment_url ? 'Change File' : 'Upload File'}
              <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
            {form.attachment_url && <p className="text-xs text-green-600 mt-1">✓ File uploaded</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Teacher Name</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" value={form.assigned_by} onChange={e => set('assigned_by', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2 pb-4">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white rounded-xl">
              {loading ? 'Saving...' : editItem ? 'Update' : 'Create Homework'}
            </Button>
          </div>
        </div>
        </div>

        {showAIAssist && (
        <AIAssistDrawer
          type="homework"
          className={form.class_name}
          section={form.section}
          academicYear={academicYear}
          onInsert={(generated) => {
            setForm(f => ({
              ...f,
              title: generated.title || f.title,
              description: generated.instructions || f.description
            }));
            toast.success('Content inserted!');
          }}
          onClose={() => setShowAIAssist(false)}
        />
        )}
        </div>
        );
        }