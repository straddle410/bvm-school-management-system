import React from 'react';
import { BarChart3, BookOpen, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';

export default function HomeworkDashboardSummary({
  totalPublished = 0,
  totalDraft = 0,
  totalActive = 0,
  totalClosed = 0,
  overallSubmissionRate = 0,
  totalPendingReview = 0,
  totalGraded = 0,
  totalRevisionRequired = 0,
  totalLateSubmissions = 0,
}) {
  const cards = [
    { label: 'Published', value: totalPublished, icon: BookOpen, color: 'blue', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
    { label: 'Draft', value: totalDraft, icon: Clock, color: 'gray', bgColor: 'bg-gray-50', textColor: 'text-gray-700' },
    { label: 'Active', value: totalActive, icon: TrendingUp, color: 'green', bgColor: 'bg-green-50', textColor: 'text-green-700' },
    { label: 'Closed', value: totalClosed, icon: CheckCircle2, color: 'neutral', bgColor: 'bg-slate-50', textColor: 'text-slate-700' },
    { label: 'Submission Rate', value: `${Math.round(overallSubmissionRate)}%`, icon: BarChart3, color: 'indigo', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
    { label: 'Pending Review', value: totalPendingReview, icon: AlertCircle, color: 'orange', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
    { label: 'Graded', value: totalGraded, icon: CheckCircle2, color: 'green', bgColor: 'bg-green-50', textColor: 'text-green-700' },
    { label: 'Revision Required', value: totalRevisionRequired, icon: AlertCircle, color: 'red', bgColor: 'bg-red-50', textColor: 'text-red-700' },
    { label: 'Late Submissions', value: totalLateSubmissions, icon: AlertCircle, color: 'red', bgColor: 'bg-red-50', textColor: 'text-red-700' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`${card.bgColor} rounded-lg p-4 border border-gray-200 shadow-sm`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1 font-medium">{card.label}</p>
                <p className={`${card.textColor} text-2xl font-bold`}>{card.value}</p>
              </div>
              <Icon className={`${card.textColor} h-5 w-5 mt-1 flex-shrink-0`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}