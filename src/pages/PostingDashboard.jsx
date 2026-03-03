import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import DiaryForm from '@/components/diary/DiaryForm';
import HomeworkForm from '@/components/homework/HomeworkForm';
import { Button } from '@/components/ui/button';

// Placeholder components for Notice and Quiz
function NoticeFormPlaceholder() {
  return (
    <div className="p-6">
      <p className="text-gray-600">Use the Notices page to create and post notices.</p>
      <a href="/pages/Notices" className="text-indigo-600 font-semibold mt-2 inline-block">
        Go to Notices
      </a>
    </div>
  );
}

function QuizFormPlaceholder() {
  return (
    <div className="p-6">
      <p className="text-gray-600">Use the Quiz page to create and manage quizzes.</p>
      <a href="/pages/Quiz" className="text-indigo-600 font-semibold mt-2 inline-block">
        Go to Quiz
      </a>
    </div>
  );
}

export default function PostingDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get('tab') || 'diary';

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="hover:bg-white/20 p-2 rounded-lg transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-4xl mx-auto p-4">
          <Tabs defaultValue={tab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="diary">Diary</TabsTrigger>
              <TabsTrigger value="homework">Homework</TabsTrigger>
              <TabsTrigger value="notice">Notice</TabsTrigger>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
            </TabsList>

            {/* Diary Tab */}
            <TabsContent value="diary" className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Post Diary</h2>
              <DiaryForm />
            </TabsContent>

            {/* Homework Tab */}
            <TabsContent value="homework" className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Post Homework</h2>
              <HomeworkForm />
            </TabsContent>

            {/* Notice Tab */}
            <TabsContent value="notice" className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Post Notice</h2>
              <NoticeFormPlaceholder />
            </TabsContent>

            {/* Quiz Tab */}
            <TabsContent value="quiz" className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Post Quiz</h2>
              <QuizFormPlaceholder />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}