import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, X, ChevronRight, ChevronLeft, Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSubjectsForClass } from '@/components/subjectHelper';
import { useAcademicYear } from '@/components/AcademicYearContext';

const TEMPLATES = {
  notice: [
    'General Notice',
    'Exam Notice',
    'PTM Notice',
    'Fee Reminder',
    'Holiday Notice',
    'Event/Trip Notice'
  ],
  homework: [
    'Simple Homework',
    'Reading + Writing',
    'Worksheet style',
    'Project/Activity',
    'Revision/Practice'
  ],
  diary: [
    'Daily Summary',
    'Behavior/Discipline Note',
    'Appreciation/Praise Note',
    'Reminder Note'
  ],
  quiz: [
    'Subject Quiz',
    'General Knowledge Quiz',
    'Mixed Quiz',
    'Quick 5 Questions',
    '10 Questions Standard'
  ]
};

const GK_CATEGORIES = ['Mixed', 'Current Affairs', 'Sports', 'Science GK', 'India', 'World', 'Logic'];

export default function AIAssistDrawer({ type, className, section, academicYear, onInsert, onClose }) {
  const { academicYear: contextYear } = useAcademicYear();
  const year = academicYear || contextYear;
  
  const [step, setStep] = useState(1); // 1: template, 2: details, 3: preview
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('friendly');
  const [length, setLength] = useState('short');
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [quizMode, setQuizMode] = useState('subject');
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [gkCategory, setGkCategory] = useState('Mixed');
  const [dueDate, setDueDate] = useState('');

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template);

    // Load subjects for subject-based quiz or homework
    if ((type === 'quiz' || type === 'homework') && template !== 'General Knowledge Quiz') {
      const result = await getSubjectsForClass(year, className);
      setSubjects(result.subjects);
      if (result.subjects.length > 0) {
        setSelectedSubject(result.subjects[0]);
      }
    }
    setStep(2);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const payload = {
        type,
        template: selectedTemplate,
        academic_year: year,
        class_name: className,
        section,
        topic: topic || undefined,
        tone,
        length
      };

      if (type === 'homework' && dueDate) {
        payload.due_date = dueDate;
      }

      if (type === 'homework' || (type === 'quiz' && quizMode === 'subject')) {
        payload.subject = selectedSubject;
      }

      if (type === 'quiz') {
        payload.quiz = {
          mode: quizMode,
          count: parseInt(quizCount),
          difficulty: quizDifficulty,
          format: 'mcq'
        };
      }

      const response = await base44.functions.invoke('generateStaffContent', payload);

      if (response.status >= 400) {
        alert('Generation failed: ' + (response.data?.error || 'Unknown error'));
        setLoading(false);
        return;
      }

      setGenerated(response.data?.generated);
      setStep(3);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    onInsert(generated, type);
    onClose();
  };

  const handleCopy = () => {
    const text = JSON.stringify(generated, null, 2);
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleRegenerate = () => {
    setGenerated(null);
    setStep(2);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full max-h-[90vh] overflow-y-auto rounded-t-3xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1a237e] to-[#283593] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">AI Assist - {type.charAt(0).toUpperCase() + type.slice(1)}</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 pb-20">
          {/* STEP 1: Template Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700">Choose a template:</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES[type].map((template) => (
                  <button
                    key={template}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-3 border-2 border-slate-200 rounded-xl hover:border-[#1a237e] hover:bg-blue-50 transition text-sm font-medium text-slate-700"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Details Input */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-semibold text-blue-900">Template: {selectedTemplate}</p>
              </div>

              {/* Topic */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Topic (optional)</label>
                <input
                  type="text"
                  placeholder="E.g., Chapter 5, Geometry basics..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Subject Dropdown (homework/quiz) */}
              {(type === 'homework' || (type === 'quiz' && quizMode === 'subject')) && subjects.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* GK Category for GK Quiz */}
              {type === 'quiz' && quizMode === 'gk' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Category</label>
                  <select
                    value={gkCategory}
                    onChange={(e) => setGkCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {GK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quiz Mode */}
              {type === 'quiz' && selectedTemplate !== 'Subject Quiz' && selectedTemplate !== 'General Knowledge Quiz' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Quiz Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQuizMode('subject')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        quizMode === 'subject'
                          ? 'bg-[#1a237e] text-white'
                          : 'border border-slate-200 text-slate-700 hover:border-[#1a237e]'
                      }`}
                    >
                      Subject
                    </button>
                    <button
                      onClick={() => setQuizMode('gk')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        quizMode === 'gk'
                          ? 'bg-[#1a237e] text-white'
                          : 'border border-slate-200 text-slate-700 hover:border-[#1a237e]'
                      }`}
                    >
                      GK
                    </button>
                    <button
                      onClick={() => setQuizMode('mixed')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        quizMode === 'mixed'
                          ? 'bg-[#1a237e] text-white'
                          : 'border border-slate-200 text-slate-700 hover:border-[#1a237e]'
                      }`}
                    >
                      Mixed
                    </button>
                  </div>
                </div>
              )}

              {/* Quiz Count */}
              {type === 'quiz' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Number of Questions</label>
                  <select
                    value={quizCount}
                    onChange={(e) => setQuizCount(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={20}>20 Questions</option>
                  </select>
                </div>
              )}

              {/* Quiz Difficulty */}
              {type === 'quiz' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Difficulty</label>
                  <div className="flex gap-2">
                    {['easy', 'medium', 'hard'].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setQuizDifficulty(diff)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          quizDifficulty === diff
                            ? 'bg-[#1a237e] text-white'
                            : 'border border-slate-200 text-slate-700'
                        }`}
                      >
                        {diff.charAt(0).toUpperCase() + diff.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Due Date for Homework */}
              {type === 'homework' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Due Date (optional)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Tone */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tone</label>
                <div className="flex gap-2">
                  {['friendly', 'formal', 'strict'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        tone === t
                          ? 'bg-[#1a237e] text-white'
                          : 'border border-slate-200 text-slate-700'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Length */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Length</label>
                <div className="flex gap-2">
                  {['short', 'medium'].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLength(l)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        length === l
                          ? 'bg-[#1a237e] text-white'
                          : 'border border-slate-200 text-slate-700'
                      }`}
                    >
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex-1 bg-[#1a237e] hover:bg-[#283593] text-white flex items-center justify-center gap-2"
                >
                  {loading ? 'Generating...' : 'Generate'}
                  {!loading && <Sparkles className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Insert */}
          {step === 3 && generated && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-900">✓ Review before publishing</p>
              </div>

              {/* Generated Content Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                {generated.title && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">TITLE:</p>
                    <p className="text-sm text-slate-800 font-medium">{generated.title}</p>
                  </div>
                )}
                {generated.body && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">BODY:</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{generated.body}</p>
                  </div>
                )}
                {generated.instructions && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">INSTRUCTIONS:</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{generated.instructions}</p>
                  </div>
                )}
                {generated.materials && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">MATERIALS:</p>
                    <p className="text-sm text-slate-700">{generated.materials}</p>
                  </div>
                )}
                {generated.submission_note && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">SUBMISSION:</p>
                    <p className="text-sm text-slate-700">{generated.submission_note}</p>
                  </div>
                )}
                {Array.isArray(generated.questions) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">QUESTIONS ({generated.questions.length}):</p>
                    <div className="space-y-2">
                      {generated.questions.slice(0, 3).map((q, idx) => (
                        <div key={idx} className="text-xs text-slate-700">
                          <p className="font-medium">Q{idx + 1}. {q.question}</p>
                          {q.options && (
                            <p className="text-slate-600 ml-2">Options: {q.options.join(', ')}</p>
                          )}
                        </div>
                      ))}
                      {generated.questions.length > 3 && (
                        <p className="text-xs text-slate-500 italic">... +{generated.questions.length - 3} more questions</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleInsert}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  <ChevronRight className="h-4 w-4" />
                  Insert into Form
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}