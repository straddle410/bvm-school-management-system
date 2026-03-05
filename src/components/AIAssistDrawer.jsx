import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Copy, RotateCcw, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Template definitions
const TEMPLATES = {
  notice: [
    { value: 'General Notice', label: 'General Notice' },
    { value: 'Exam Notice', label: 'Exam Notice' },
    { value: 'PTM Notice', label: 'PTM Notice' },
    { value: 'Fee Reminder', label: 'Fee Reminder' },
    { value: 'Holiday Notice', label: 'Holiday Notice' },
    { value: 'Event/Trip Notice', label: 'Event/Trip Notice' },
  ],
  homework: [
    { value: 'Simple Homework', label: 'Simple Homework' },
    { value: 'Reading + Writing', label: 'Reading + Writing' },
    { value: 'Worksheet style', label: 'Worksheet style' },
    { value: 'Project/Activity', label: 'Project/Activity' },
    { value: 'Revision/Practice', label: 'Revision/Practice' },
  ],
  diary: [
    { value: 'Daily Summary', label: 'Daily Summary' },
    { value: 'Behavior/Discipline Note', label: 'Behavior/Discipline Note' },
    { value: 'Appreciation/Praise Note', label: 'Appreciation/Praise Note' },
    { value: 'Reminder Note', label: 'Reminder Note' },
  ],
  quiz: [
    { value: 'Subject Quiz', label: 'Subject Quiz' },
    { value: 'General Knowledge Quiz', label: 'General Knowledge Quiz' },
    { value: 'Mixed Quiz', label: 'Mixed Quiz' },
    { value: 'Quick 5 Questions', label: 'Quick 5 Questions' },
    { value: '10 Questions Standard', label: '10 Questions Standard' },
  ],
};

const GK_CATEGORIES = ['Sports', 'Current Affairs', 'Science', 'India', 'World', 'Logic'];

export default function AIAssistDrawer({ type, className, section, academicYear, onInsert, onClose }) {
  const [step, setStep] = useState(1); // 1: Template, 2: Details, 3: Preview
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);

  // Step 2 form fields
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('friendly');
  const [length, setLength] = useState('short');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [quizConfig, setQuizConfig] = useState({
    mode: 'subject',
    count: '5',
    difficulty: 'medium',
    format: 'mcq',
    gkCategory: 'Sports',
  });
  const [availableSubjects, setAvailableSubjects] = useState([]);

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template);
    
    // For Subject/Mixed quiz, fetch available subjects
    if (type === 'quiz' && (template === 'Subject Quiz' || template === 'Mixed Quiz') && className) {
      try {
        const result = await (async () => {
          const { getSubjectsForClass } = await import('@/components/subjectHelper');
          return await getSubjectsForClass(academicYear, className);
        })();
        setAvailableSubjects(result.subjects || []);
        if (result.subjects?.length > 0) {
          setSubject(result.subjects[0]);
        }
      } catch (e) {
        console.warn('Could not fetch subjects:', e);
      }
    }
    
    setStep(2);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type,
        template: selectedTemplate,
        academic_year: academicYear,
        class_name: className,
        section,
        topic: topic || undefined,
        tone,
        length,
      };

      if (type === 'homework' && dueDate) {
        payload.due_date = dueDate;
      }

      if (type === 'quiz') {
        payload.quiz = {
          mode: quizConfig.mode,
          count: parseInt(quizConfig.count),
          difficulty: quizConfig.difficulty,
          format: quizConfig.format,
        };
        if (quizConfig.mode !== 'gk' && subject) {
          payload.subject = subject;
        }
        if (quizConfig.mode === 'gk' || quizConfig.mode === 'mixed') {
          payload.quiz.gk_category = quizConfig.gkCategory;
        }
      }

      if (type === 'homework' && subject) {
        payload.subject = subject;
      }

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt(type, selectedTemplate, payload),
        response_json_schema: buildSchema(type),
        add_context_from_internet: false,
      });

      setGenerated(res);
      setStep(3);
    } catch (e) {
      setError(e.message || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    onInsert(generated);
    onClose();
  };

  const handleRegenerate = () => {
    setStep(2);
    setGenerated(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <Drawer open={true} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh] flex flex-col">
        <DrawerHeader className="border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <DrawerTitle>AI Assist - {type.charAt(0).toUpperCase() + type.slice(1)}</DrawerTitle>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Class {className} | Section {section} | Year {academicYear}
          </p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-3">Choose a template:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEMPLATES[type]?.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => handleTemplateSelect(t.value)}
                      className="p-3 text-left border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all"
                    >
                      <p className="font-medium text-sm">{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Template:</strong> {selectedTemplate}
                </p>
              </div>

              <div>
                <Label className="text-xs">Topic (optional)</Label>
                <Input
                  placeholder="e.g., Quadratic Equations, Annual Day Event..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank for default based on class level</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="strict">Strict</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Length</Label>
                  <Select value={length} onValueChange={setLength}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {type === 'homework' && (
                <>
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Mathematics, English..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Due Date (optional)</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {type === 'diary' && (
                <div>
                  <Label className="text-xs">Subject (optional)</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Mathematics, Science..."
                    className="mt-1"
                  />
                </div>
              )}

              {type === 'quiz' && (
                <>
                  <div>
                    <Label className="text-xs">Quiz Type</Label>
                    <Select
                      value={quizConfig.mode}
                      onValueChange={(v) => {
                        setQuizConfig({ ...quizConfig, mode: v });
                        if (v === 'gk' && !quizConfig.gkCategory) {
                          setQuizConfig({ ...quizConfig, mode: v, gkCategory: 'Sports' });
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subject">Subject</SelectItem>
                        <SelectItem value="gk">General Knowledge</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(quizConfig.mode === 'subject' || quizConfig.mode === 'mixed') && (
                    <div>
                      <Label className="text-xs">Subject</Label>
                      <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSubjects.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(quizConfig.mode === 'gk' || quizConfig.mode === 'mixed') && (
                    <div>
                      <Label className="text-xs">GK Category</Label>
                      <Select
                        value={quizConfig.gkCategory}
                        onValueChange={(v) =>
                          setQuizConfig({ ...quizConfig, gkCategory: v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GK_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Question Count</Label>
                      <Select
                        value={quizConfig.count}
                        onValueChange={(v) =>
                          setQuizConfig({ ...quizConfig, count: v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Questions</SelectItem>
                          <SelectItem value="10">10 Questions</SelectItem>
                          <SelectItem value="20">20 Questions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Difficulty</Label>
                      <Select
                        value={quizConfig.difficulty}
                        onValueChange={(v) =>
                          setQuizConfig({ ...quizConfig, difficulty: v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && generated && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-800">✓ Content generated successfully</p>
              </div>

              {(type === 'notice' || type === 'diary') && generated.title && (
                <div>
                  <Label className="text-xs font-semibold">Title</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm border">
                    {generated.title}
                  </div>
                </div>
              )}

              {(type === 'notice' || type === 'diary') && generated.body && (
                <div>
                  <Label className="text-xs font-semibold">Content</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm border whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {generated.body}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(generated.body)}
                    className="mt-2"
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
              )}

              {type === 'homework' && (
                <>
                  {generated.title && (
                    <div>
                      <Label className="text-xs font-semibold">Title</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm border">
                        {generated.title}
                      </div>
                    </div>
                  )}
                  {generated.instructions && (
                    <div>
                      <Label className="text-xs font-semibold">Instructions</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm border whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {generated.instructions}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generated.instructions)}
                        className="mt-2"
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  )}
                </>
              )}

              {type === 'quiz' && generated.title && (
                <div>
                  <Label className="text-xs font-semibold">Title</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm border">
                    {generated.title}
                  </div>
                </div>
              )}

              {type === 'quiz' && generated.questions && (
                <div>
                  <Label className="text-xs font-semibold">
                    Questions ({generated.questions.length})
                  </Label>
                  <div className="mt-1 space-y-3 max-h-48 overflow-y-auto">
                    {generated.questions.slice(0, 3).map((q, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded border text-xs">
                        <p className="font-medium">Q{idx + 1}: {q.question}</p>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-1 ml-2 text-gray-600">
                            {q.options.map((opt, i) => (
                              <p key={i}>
                                {String.fromCharCode(65 + i)}. {opt}
                              </p>
                            ))}
                            <p className="text-green-700 font-medium mt-1">
                              ✓ Answer: {q.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {generated.questions.length > 3 && (
                      <p className="text-xs text-gray-500">
                        ... and {generated.questions.length - 3} more questions
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  ℹ️ Please review the content before publishing.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="border-t p-4 flex gap-2 justify-end">
          {step === 1 && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button variant="outline" onClick={handleRegenerate}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={handleInsert}
                className="bg-green-600 hover:bg-green-700"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Insert into Form
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function buildPrompt(type, template, payload) {
  const classLevel = getClassLevel(payload.class_name);
  const base = `Generate content for a school setting. Class: ${payload.class_name}, Level: ${classLevel}, Academic Year: ${payload.academic_year}, Tone: ${payload.tone}, Length: ${payload.length}.`;

  if (type === 'notice') {
    return `${base} Template: ${template}. Topic: ${payload.topic || 'Important school matter'}. Generate a school notice with clear title and body. Use bullet points where appropriate. Make it age-appropriate for ${classLevel} students.`;
  }

  if (type === 'homework') {
    const subject = payload.subject || 'General';
    const topic = payload.topic || `Chapter/Unit from ${subject}`;
    return `${base} Template: ${template}. Subject: ${subject}. Topic: ${topic}. Generate homework/assignment with title and detailed instructions. Include learning objectives if relevant.`;
  }

  if (type === 'diary') {
    const subject = payload.subject || 'General';
    return `${base} Template: ${template}. Subject: ${subject}. Topic: ${payload.topic || 'Class activities'}. Generate a classroom diary entry with optional title and description. Be warm, encouraging, and age-appropriate.`;
  }

  if (type === 'quiz') {
    const quizInfo = payload.quiz;
    const count = quizInfo.count || 5;
    const mode = quizInfo.mode || 'subject';
    if (mode === 'subject') {
      return `${base} Subject: ${payload.subject || 'General'}. Topic: ${payload.topic || payload.subject}. Difficulty: ${quizInfo.difficulty}. Generate exactly ${count} MCQ questions appropriate for ${classLevel} students. Include correct answers. Format as JSON with questions array.`;
    } else if (mode === 'gk') {
      return `${base} General Knowledge category: ${quizInfo.gk_category || 'General'}. Difficulty: ${quizInfo.difficulty}. Generate exactly ${count} GK MCQ questions for ${classLevel} students. Include correct answers. Format as JSON with questions array.`;
    } else {
      return `${base} Subject: ${payload.subject || 'General'}, GK: ${quizInfo.gk_category || 'General'}. Difficulty: ${quizInfo.difficulty}. Generate ${count} mixed MCQ questions (mix of subject + GK). Include correct answers. Format as JSON with questions array.`;
    }
  }

  return base;
}

function buildSchema(type) {
  if (type === 'notice' || type === 'diary') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['body'],
    };
  }

  if (type === 'homework') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        instructions: { type: 'string' },
        materials: { type: 'string' },
        submission_note: { type: 'string' },
      },
      required: ['title', 'instructions'],
    };
  }

  if (type === 'quiz') {
    return {
      type: 'object',
      properties: {
        title: { type: 'string' },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              answer: { type: 'string' },
            },
            required: ['question', 'options', 'answer'],
          },
        },
      },
      required: ['title', 'questions'],
    };
  }

  return { type: 'object' };
}

function getClassLevel(className) {
  const classNum = parseInt(className);
  if (isNaN(classNum)) return 'Early Primary';
  if (classNum <= 2) return 'Early Primary (Class 1-2)';
  if (classNum <= 5) return 'Middle Primary (Class 3-5)';
  if (classNum <= 8) return 'Upper Primary (Class 6-8)';
  return 'Secondary (Class 9-12)';
}