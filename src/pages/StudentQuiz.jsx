import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Brain, CheckCircle2, XCircle, HelpCircle, Send, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StudentMinimalFooterNav from '@/components/StudentMinimalFooterNav';

function getStudentSession() {
  try { return JSON.parse(localStorage.getItem('student_session')); } catch { return null; }
}

export default function StudentQuiz() {
  const [student, setStudent] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showResults, setShowResults] = useState(null);
  const [answers, setAnswers] = useState({});
  const [answeredQuestions, setAnsweredQuestions] = useState({});
  const [tab, setTab] = useState('today'); // 'today' | 'history'
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const s = getStudentSession();
    if (!s) { window.location.href = createPageUrl('StudentLogin'); return; }
    setStudent(s);
    // Mark quiz notifications as read
    base44.functions.invoke('markStudentNotificationsRead', {
      student_id: s.student_id,
      event_types: ['QUIZ_PUBLISHED'],
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent('student-notifications-read'));
  }, []);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['student-quizzes', student?.academic_year],
    queryFn: () => base44.entities.Quiz.filter(
      { status: 'Published', academic_year: student.academic_year },
      '-quiz_date', 100
    ),
    enabled: !!student,
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ['student-quiz-attempts', student?.student_id],
    queryFn: () => base44.entities.QuizAttempt.filter({ student_id: student.student_id }, '-created_date', 200),
    enabled: !!student,
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async () => {
      let score = 0;
      const answersData = Object.entries(answers).map(([i, answer]) => ({
        question_index: parseInt(i),
        answer,
      }));
      selectedQuiz.questions.forEach((q, i) => {
        if (q.type === 'MCQ' && answers[i] === q.correct_answer) score++;
      });
      const res = await base44.functions.invoke('submitQuizAttempt', {
        student_id: student.student_id,
        attempt: {
          quiz_id: selectedQuiz.id,
          student_id: student.student_id,
          student_name: student.name,
          answers: answersData,
          score,
          attempt_date: format(new Date(), 'yyyy-MM-dd'),
          academic_year: student.academic_year,
        },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return { ...res.data, score };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['student-quiz-attempts']);
      setShowResults(data);
      setAnswers({});
      setAnsweredQuestions({});
    },
  });

  if (!student) return null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Filter quizzes for student's class
  const myQuizzes = quizzes.filter(q =>
    !q.class_name || q.class_name === student.class_name
  );
  const todayQuizzes = myQuizzes.filter(q => q.quiz_date === todayStr);
  const myAttempts = attempts.filter(a => a.student_id === student.student_id);

  const hasAttempted = (quizId) =>
    myAttempts.some(a => a.quiz_id === quizId && a.attempt_date === todayStr);

  // --- Quiz Taking View ---
  if (selectedQuiz && !showResults) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] pb-24">
        <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedQuiz(null); setAnswers({}); setAnsweredQuestions({}); }} className="p-1 hover:bg-white/20 rounded-lg transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">{selectedQuiz.title}</h1>
              <p className="text-sm text-blue-100">{selectedQuiz.subject}</p>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 space-y-5 max-w-xl mx-auto">
          {selectedQuiz.questions.map((q, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{q.question}</p>
                  <span className="text-[10px] text-gray-400 uppercase">{q.type}</span>
                </div>
              </div>

              {q.type === 'MCQ' ? (
                <div className="space-y-2 ml-10">
                  {q.options.filter(o => o).map((opt, j) => {
                    const isSelected = answers[i] === opt;
                    const isAnswered = !!answeredQuestions[i];
                    const isCorrect = opt === q.correct_answer;
                    return (
                      <div
                        key={j}
                        onClick={() => {
                          if (!isAnswered) {
                            setAnswers(prev => ({ ...prev, [i]: opt }));
                            setAnsweredQuestions(prev => ({ ...prev, [i]: true }));
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                          isSelected
                            ? isAnswered
                              ? isCorrect ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800'
                              : 'bg-indigo-50 border-indigo-400 text-indigo-800'
                            : isAnswered && !isSelected ? 'border-gray-100 text-gray-400' : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                        }`}
                      >
                        <span className="font-semibold">{String.fromCharCode(65 + j)}.</span>
                        <span className="flex-1">{opt}</span>
                        {isSelected && isAnswered && (isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[i] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  placeholder="Write your answer here..."
                  className="w-full ml-10 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  rows={3}
                />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm text-gray-500">
              Answered: <span className="font-bold text-indigo-700">{Object.keys(answeredQuestions).length}</span>/{selectedQuiz.questions.length}
            </p>
            <button
              onClick={() => submitAttemptMutation.mutate()}
              disabled={submitAttemptMutation.isPending || Object.keys(answeredQuestions).length < selectedQuiz.questions.filter(q => q.type === 'MCQ').length}
              className="flex items-center gap-2 bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
            >
              <Send className="h-4 w-4" />
              {submitAttemptMutation.isPending ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
        <StudentMinimalFooterNav />
      </div>
    );
  }

  // --- Results View ---
  if (showResults) {
    const mcqCount = selectedQuiz?.questions?.filter(q => q.type === 'MCQ').length || 0;
    const pct = mcqCount > 0 ? Math.round((showResults.score / mcqCount) * 100) : 0;
    return (
      <div className="min-h-screen bg-[#f0f4ff] pb-24">
        <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowResults(null); setSelectedQuiz(null); }} className="p-1 hover:bg-white/20 rounded-lg transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">Quiz Results</h1>
              <p className="text-sm text-blue-100">{selectedQuiz?.title}</p>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 max-w-xl mx-auto space-y-4">
          {/* Score Card */}
          <div className={`rounded-2xl shadow-sm p-6 text-center ${pct >= 60 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-5xl font-bold mb-1 ${pct >= 60 ? 'text-green-600' : 'text-red-500'}`}>{showResults.score}/{mcqCount}</p>
            <p className={`text-lg font-semibold ${pct >= 60 ? 'text-green-700' : 'text-red-600'}`}>{pct}% Correct</p>
            <p className="text-sm text-gray-500 mt-1">{pct >= 80 ? '🌟 Excellent!' : pct >= 60 ? '👍 Good job!' : '📖 Keep practicing!'}</p>
          </div>

          {/* Answer Review */}
          <div className="space-y-3">
            {selectedQuiz?.questions.map((q, i) => {
              const userAns = answers[i];
              const isCorrect = q.type === 'MCQ' && userAns === q.correct_answer;
              return (
                <div key={i} className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${isCorrect ? 'border-green-400' : q.type === 'Descriptive' ? 'border-yellow-400' : 'border-red-400'}`}>
                  <div className="flex gap-2 mb-2">
                    <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: isCorrect ? '#22c55e' : q.type === 'Descriptive' ? '#eab308' : '#ef4444' }}>{i + 1}</span>
                    <p className="text-sm font-semibold text-gray-800">{q.question}</p>
                  </div>
                  <div className="ml-8 text-xs space-y-1">
                    {q.type === 'MCQ' ? (
                      <>
                        <p className="text-gray-600">Your answer: <span className="font-semibold">{userAns || 'Not answered'}</span></p>
                        <p className={isCorrect ? 'text-green-700 font-semibold' : 'text-red-700'}>
                          Correct: <span className="font-semibold">{q.correct_answer}</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-600">Your answer: <span className="font-semibold">{userAns || '—'}</span></p>
                        <p className="text-yellow-700">Model answer: <span className="font-semibold">{q.correct_answer}</span></p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => { setShowResults(null); setSelectedQuiz(null); }}
            className="w-full bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-3 rounded-2xl font-bold text-sm"
          >
            Back to Quizzes
          </button>
        </div>
        <StudentMinimalFooterNav />
      </div>
    );
  }

  // --- Main Quiz List ---
  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(createPageUrl('StudentDashboard'))} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Quiz</h1>
            <p className="text-sm text-blue-100">{student.class_name}-{student.section}</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {[['today', "Today's Quiz"], ['history', 'My Attempts']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-xl mx-auto">
        {tab === 'today' ? (
          isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}</div>
          ) : todayQuizzes.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <Brain className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500 font-medium">No quizzes today</p>
              <p className="text-gray-400 text-xs mt-1">Check back later for new quizzes</p>
            </div>
          ) : (
            todayQuizzes.map(quiz => {
              const attempted = hasAttempted(quiz.id);
              return (
                <div key={quiz.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Brain className="h-5 w-5 text-purple-600" />
                    </div>
                    {attempted && <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>}
                  </div>
                  <p className="font-bold text-gray-800 mb-0.5">{quiz.title}</p>
                  <p className="text-xs text-gray-500 mb-3">{quiz.subject} · {quiz.questions?.length || 0} questions</p>
                  <button
                    onClick={() => { setSelectedQuiz(quiz); setAnswers({}); setAnsweredQuestions({}); }}
                    disabled={attempted}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                      attempted
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white hover:opacity-90'
                    }`}
                  >
                    {attempted ? 'Already Attempted' : 'Start Quiz'}
                  </button>
                </div>
              );
            })
          )
        ) : (
          myAttempts.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <HelpCircle className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500 font-medium">No attempts yet</p>
              <p className="text-gray-400 text-xs mt-1">Take a quiz to see your history</p>
            </div>
          ) : (
            myAttempts.map(attempt => {
              const quiz = quizzes.find(q => q.id === attempt.quiz_id);
              return (
                <div key={attempt.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{quiz?.title || 'Quiz'}</p>
                    <p className="text-xs text-gray-500">{quiz?.subject} · {attempt.attempt_date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-indigo-700">{attempt.score}/{quiz?.questions?.length || '?'}</p>
                    <p className="text-xs text-gray-400">Score</p>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
      <StudentMinimalFooterNav />
    </div>
  );
}