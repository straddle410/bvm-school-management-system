import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, HelpCircle, Calendar, CheckCircle2, XCircle, Send, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'General Knowledge'];

export default function Quiz() {
   const [user, setUser] = useState(null);
   const [activeTab, setActiveTab] = useState('quizzes');
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [selectedQuiz, setSelectedQuiz] = useState(null);
   const [showResults, setShowResults] = useState(null);
   const [answers, setAnswers] = useState({});
   const [answeredQuestions, setAnsweredQuestions] = useState({});
   const [quizForm, setQuizForm] = useState({
     title: '',
     quiz_date: format(new Date(), 'yyyy-MM-dd'),
     subject: '',
     questions: [
       { question: '', type: 'MCQ', options: ['', '', '', ''], correct_answer: '' },
       { question: '', type: 'MCQ', options: ['', '', '', ''], correct_answer: '' }
     ]
   });

   const queryClient = useQueryClient();

   useEffect(() => {
     const session = localStorage.getItem('staff_session');
     if (session) {
       try {
         const parsed = JSON.parse(session);
         setUser(parsed);
       } catch {}
     } else {
       base44.auth.me().then(setUser).catch(() => {});
     }
   }, []);

   const { data: quizzes = [], isLoading } = useQuery({
     queryKey: ['quizzes'],
     queryFn: async () => {
       try {
         return await base44.entities.Quiz.list('-quiz_date');
       } catch {
         return [];
       }
     }
   });

   const { data: attempts = [] } = useQuery({
     queryKey: ['quiz-attempts'],
     queryFn: async () => {
       try {
         return await base44.entities.QuizAttempt.list();
       } catch {
         return [];
       }
     }
   });

  const createQuizMutation = useMutation({
    mutationFn: async (data) => {
      const quiz = await base44.entities.Quiz.create(data);
      await base44.entities.Quiz.update(quiz.id, { status: 'Published' });
      return quiz;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
      setShowCreateDialog(false);
      setActiveTab('manage');
      resetQuizForm();
      toast.success('Quiz created and published successfully');
    }
  });

  const submitQuizMutation = useMutation({
    mutationFn: (id) => base44.entities.Quiz.update(id, { status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
      toast.success('Quiz published!');
    }
  });

  const deleteQuizMutation = useMutation({
    mutationFn: (id) => base44.entities.Quiz.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
      toast.success('Quiz deleted successfully');
    }
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async () => {
      let score = 0;
      const answersData = Object.entries(answers).map(([i, answer]) => ({
        question_index: parseInt(i),
        answer
      }));

      selectedQuiz.questions.forEach((q, i) => {
        if (q.type === 'MCQ' && answers[i] === q.correct_answer) {
          score++;
        }
      });

      return base44.entities.QuizAttempt.create({
        quiz_id: selectedQuiz.id,
        student_id: user?.id || 'anonymous',
        student_name: user?.full_name || user?.name || 'Anonymous',
        answers: answersData,
        score,
        attempt_date: format(new Date(), 'yyyy-MM-dd')
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['quiz-attempts']);
      setShowResults(data);
       setSelectedQuiz(null);
       setAnswers({});
       setAnsweredQuestions({});
      }
  });

  const resetQuizForm = () => {
    setQuizForm({
      title: '',
      quiz_date: format(new Date(), 'yyyy-MM-dd'),
      class_name: '',
      subject: '',
      questions: [
        { question: '', type: 'MCQ', options: ['', '', '', ''], correct_answer: '' },
        { question: '', type: 'MCQ', options: ['', '', '', ''], correct_answer: '' }
      ]
    });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...quizForm.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQuestions = [...quizForm.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuizForm({ ...quizForm, questions: newQuestions });
  };

  const userRole = user?.role || 'user';
  const isTeacher = ['admin', 'principal', 'teacher'].includes(userRole);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const todayQuizzes = quizzes.filter(q => 
    q.quiz_date === todayStr && q.status === 'Published'
  );

  const hasAttemptedToday = (quizId) => {
    return attempts.some(a => 
      a.quiz_id === quizId && 
      a.student_id === user?.id && 
      a.attempt_date === todayStr
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Daily Quiz"
        subtitle="Test your knowledge"
        actions={
          user && (user.role === 'Admin' || user.role === 'admin' || user.role === 'Principal' || user.role === 'principal' || user.role === 'Teacher' || user.role === 'teacher') && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Post Quiz
            </Button>
          )
        }
      />

      <div className="p-4 lg:p-8">
        {showResults ? (
          // Quiz Results View
          <Card className="border-0 shadow-sm max-w-2xl mx-auto">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Quiz Results</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedQuiz?.title || 'Quiz'}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setShowResults(null)}>
                  ← Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-2">Your Score</p>
                <p className="text-5xl font-bold text-blue-600 mb-2">
                  {showResults.score}/{selectedQuiz?.questions?.filter(q => q.type === 'MCQ').length || 0}
                </p>
                <p className="text-lg text-slate-700">
                  {Math.round((showResults.score / (selectedQuiz?.questions?.filter(q => q.type === 'MCQ').length || 1)) * 100)}% Correct
                </p>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold text-slate-900">Answer Review</h3>
                {selectedQuiz?.questions.map((q, i) => {
                  const isCorrect = q.type === 'MCQ' && answers[i] === q.correct_answer;
                  const userAnswer = answers[i];
                  return (
                    <div key={i} className={`p-4 rounded-lg border-2 ${isCorrect ? 'bg-green-50 border-green-200' : q.type === 'Descriptive' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold ${isCorrect ? 'bg-green-600' : q.type === 'Descriptive' ? 'bg-yellow-600' : 'bg-red-600'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{q.question}</p>
                          <div className="mt-2 space-y-1 text-sm">
                            {q.type === 'MCQ' ? (
                              <>
                                <p className="text-slate-600">Your answer: <span className="font-semibold">{userAnswer || 'Not answered'}</span></p>
                                <p className={`${isCorrect ? 'text-green-700 font-semibold' : 'text-red-700'}`}>
                                  Correct answer: <span className="font-semibold">{q.correct_answer}</span>
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-slate-600">Your answer: <span className="font-semibold">{userAnswer || 'Not answered'}</span></p>
                                <p className="text-yellow-700">Model answer: <span className="font-semibold">{q.correct_answer}</span></p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isCorrect && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                          {!isCorrect && q.type === 'MCQ' && <XCircle className="h-6 w-6 text-red-600" />}
                          {q.type === 'Descriptive' && <HelpCircle className="h-6 w-6 text-yellow-600" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setShowResults(null)}>
                  Back to Quizzes
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : selectedQuiz ? (
          // Quiz Taking View
          <Card className="border-0 shadow-sm max-w-2xl mx-auto">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedQuiz.title}</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedQuiz.subject}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setSelectedQuiz(null)}>
                  ← Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {selectedQuiz.questions.map((q, i) => (
                <div key={i} className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{q.question}</p>
                      <span className="text-xs text-slate-400 uppercase">{q.type}</span>
                    </div>
                  </div>

                  {q.type === 'MCQ' ? (
                    <div className="ml-11 space-y-2">
                      {q.options.map((opt, j) => {
                        const isSelected = answers[i] === opt;
                        const isCorrect = opt === q.correct_answer;
                        const showFeedback = answeredQuestions[i] && isSelected;

                        return (
                          <div
                            key={j}
                            onClick={() => {
                              if (!answeredQuestions[i]) {
                                setAnswers({ ...answers, [i]: opt });
                                setAnsweredQuestions({ ...answeredQuestions, [i]: true });
                              }
                            }}
                            className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected
                                ? showFeedback
                                  ? isCorrect
                                    ? 'bg-green-50 border-green-500'
                                    : 'bg-red-50 border-red-500'
                                  : 'bg-blue-50 border-blue-500'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              id={`q${i}-o${j}`}
                              checked={isSelected}
                              onChange={() => {}}
                              disabled={answeredQuestions[i]}
                              className="cursor-pointer"
                            />
                            <Label htmlFor={`q${i}-o${j}`} className="cursor-pointer flex-1">
                              {opt}
                            </Label>
                            {showFeedback && (
                              isCorrect ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Textarea
                      value={answers[i] || ''}
                      onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                      placeholder="Write your answer here..."
                      className="ml-11"
                      rows={4}
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-between items-center pt-4">
                <p className="text-sm text-slate-500">
                  Answered: {Object.keys(answeredQuestions).length}/{selectedQuiz.questions.length}
                </p>
                <Button 
                  onClick={() => submitAttemptMutation.mutate()}
                  disabled={submitAttemptMutation.isPending || Object.keys(answeredQuestions).length < selectedQuiz.questions.length}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submitAttemptMutation.isPending ? 'Submitting...' : 'Submit Quiz'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white border shadow-sm">
              <TabsTrigger value="quizzes">Today's Quizzes</TabsTrigger>
              {isTeacher && <TabsTrigger value="manage">Manage Quizzes</TabsTrigger>}
              <TabsTrigger value="history">My Attempts</TabsTrigger>
            </TabsList>

            <TabsContent value="quizzes" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {todayQuizzes.map(quiz => {
                  const attempted = hasAttemptedToday(quiz.id);
                  const attemptCount = attempts.filter(a => a.quiz_id === quiz.id).length;
                  return (
                    <Card key={quiz.id} className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <HelpCircle className="h-5 w-5 text-amber-600" />
                          </div>
                          {attempted && (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <CardTitle className="text-lg mt-3">{quiz.title}</CardTitle>
                        <p className="text-sm text-slate-500">
                          {quiz.subject}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-slate-600 mb-1">
                              {quiz.questions?.length || 2} questions
                            </p>
                            <p className="text-xs text-blue-600 font-semibold">
                              {attemptCount} student{attemptCount !== 1 ? 's' : ''} answered
                            </p>
                          </div>
                          <Button 
                            className="w-full"
                            disabled={attempted}
                            onClick={() => setSelectedQuiz(quiz)}
                          >
                            {attempted ? 'Already Answered' : 'Start Quiz'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {todayQuizzes.length === 0 && (
                  <div className="col-span-full py-16 text-center">
                    <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No Quizzes Today</h3>
                    <p className="text-slate-500 mt-1">Check back later for new quizzes</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {user && (user.role === 'Admin' || user.role === 'admin' || user.role === 'Principal' || user.role === 'principal' || user.role === 'Teacher' || user.role === 'teacher') && (
              <TabsContent value="manage" className="mt-6">
                <div className="space-y-4">
                  {quizzes.map(quiz => {
                    const attemptCount = attempts.filter(a => a.quiz_id === quiz.id).length;
                    return (
                      <Card key={quiz.id} className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                              <HelpCircle className="h-6 w-6 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{quiz.title}</h3>
                              <p className="text-sm text-slate-500">
                                {quiz.subject} • {quiz.quiz_date}
                              </p>
                              {quiz.status === 'Published' && (
                                <p className="text-xs text-blue-600 font-semibold mt-1">
                                  {attemptCount} student{attemptCount !== 1 ? 's' : ''} answered
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={quiz.status} />
                            {quiz.status === 'Draft' && (
                              <Button 
                                size="sm"
                                onClick={() => submitQuizMutation.mutate(quiz.id)}
                              >
                                Publish
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this quiz?')) {
                                  deleteQuizMutation.mutate(quiz.id);
                                }
                              }}
                              disabled={deleteQuizMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {quizzes.length === 0 && (
                    <div className="py-16 text-center">
                      <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-700">No Quizzes Created</h3>
                      <p className="text-slate-500 mt-1">Create your first quiz to get started</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="history" className="mt-6">
              <div className="space-y-4">
                {attempts
                  .filter(a => a.student_id === user?.id)
                  .map(attempt => {
                    const quiz = quizzes.find(q => q.id === attempt.quiz_id);
                    return (
                      <Card key={attempt.id} className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                              <CheckCircle2 className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{quiz?.title || 'Quiz'}</h3>
                              <p className="text-sm text-slate-500">
                                {quiz?.subject} • {attempt.attempt_date}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">
                              {attempt.score}/{quiz?.questions?.length || 3}
                            </p>
                            <p className="text-sm text-slate-500">Score</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                {attempts.filter(a => a.student_id === user?.id).length === 0 && (
                  <div className="py-16 text-center">
                    <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No Attempts Yet</h3>
                    <p className="text-slate-500 mt-1">Take a quiz to see your history</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create Quiz Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Daily Quiz</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
           e.preventDefault();
           createQuizMutation.mutate({...quizForm, status: 'Draft'});
          }} className="space-y-6">
           <div className="space-y-4">
             <div>
               <Label>Quiz Title *</Label>
               <Input
                 value={quizForm.title}
                 onChange={(e) => setQuizForm({...quizForm, title: e.target.value})}
                 placeholder="e.g., Math Quiz - Day 1"
                 required
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Quiz Date *</Label>
                 <Input
                   type="date"
                   value={quizForm.quiz_date}
                   onChange={(e) => setQuizForm({...quizForm, quiz_date: e.target.value})}
                   required
                 />
               </div>
               <div>
                 <Label>Class *</Label>
                 <Select
                   value={quizForm.class_name}
                   onValueChange={(v) => setQuizForm({...quizForm, class_name: v})}
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
             </div>
             <div>
               <Label>Subject *</Label>
               <Select
                 value={quizForm.subject}
                 onValueChange={(v) => setQuizForm({...quizForm, subject: v})}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select subject" />
                 </SelectTrigger>
                 <SelectContent>
                   {SUBJECTS.map(s => (
                     <SelectItem key={s} value={s}>{s}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>

            <div className="space-y-6">
              <h3 className="font-semibold">Questions</h3>
              
              {/* Questions */}
              {quizForm.questions.map((q, i) => (
                <Card key={i} className="p-4 bg-slate-50 border-0">
                  {q.type === 'MCQ' ? (
                    <>
                      <Label className="text-xs text-slate-500 uppercase">MCQ Question {i + 1}</Label>
                      <Input
                        value={q.question}
                        onChange={(e) => updateQuestion(i, 'question', e.target.value)}
                        placeholder="Enter MCQ question"
                        className="mt-2"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {q.options.map((opt, j) => (
                          <Input
                            key={j}
                            value={opt}
                            onChange={(e) => updateOption(i, j, e.target.value)}
                            placeholder={`Option ${j + 1}`}
                          />
                        ))}
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs">Correct Answer</Label>
                        <Select
                          value={q.correct_answer}
                          onValueChange={(v) => updateQuestion(i, 'correct_answer', v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select correct answer" />
                          </SelectTrigger>
                          <SelectContent>
                            {q.options.filter(o => o).map((opt, j) => (
                              <SelectItem key={j} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <Label className="text-xs text-slate-500 uppercase">Descriptive Question</Label>
                      <Input
                        value={q.question}
                        onChange={(e) => updateQuestion(i, 'question', e.target.value)}
                        placeholder="Enter descriptive question"
                        className="mt-2"
                      />
                      <Textarea
                        value={q.correct_answer}
                        onChange={(e) => updateQuestion(i, 'correct_answer', e.target.value)}
                        placeholder="Model answer (for reference)"
                        className="mt-2"
                        rows={3}
                      />
                    </>
                  )}
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createQuizMutation.isPending}>
                {createQuizMutation.isPending ? 'Creating...' : 'Create Quiz'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}