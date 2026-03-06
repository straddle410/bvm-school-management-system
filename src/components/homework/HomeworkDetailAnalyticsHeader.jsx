import React from 'react';
import { TrendingUp, Users, CheckCircle2, Clock, AlertCircle, Zap } from 'lucide-react';

export default function HomeworkDetailAnalyticsHeader({
  totalAssigned = 0,
  submitted = 0,
  pending = 0,
  graded = 0,
  revisionRequired = 0,
  lateCount = 0,
  averageMarks = null,
  highestMarks = null,
  lowestMarks = null,
}) {
  const completionPercent = totalAssigned > 0 ? Math.round((submitted / totalAssigned) * 100) : 0;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-4 space-y-4">
      {/* Main metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Total Assigned</p>
              <p className="text-2xl font-bold text-slate-900">{totalAssigned}</p>
            </div>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">Submitted</p>
              <p className="text-2xl font-bold text-blue-700">{submitted}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-orange-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-orange-700">{pending}</p>
            </div>
            <Clock className="h-5 w-5 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium">Graded</p>
              <p className="text-2xl font-bold text-green-700">{graded}</p>
            </div>
            <Zap className="h-5 w-5 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-red-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-medium">Revision Req</p>
              <p className="text-2xl font-bold text-red-700">{revisionRequired}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-yellow-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-600 font-medium">Late</p>
              <p className="text-2xl font-bold text-yellow-700">{lateCount}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Completion bar and marks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold text-gray-700">Completion Rate</p>
              <p className="text-sm font-bold text-indigo-600">{completionPercent}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>

        {averageMarks !== null && (
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Marks Statistics</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-600">Average</p>
                  <p className="text-lg font-bold text-gray-900">{averageMarks.toFixed(1)}</p>
                </div>
                {highestMarks !== null && (
                  <div>
                    <p className="text-[10px] text-green-600">Highest</p>
                    <p className="text-lg font-bold text-green-700">{highestMarks}</p>
                  </div>
                )}
                {lowestMarks !== null && (
                  <div>
                    <p className="text-[10px] text-red-600">Lowest</p>
                    <p className="text-lg font-bold text-red-700">{lowestMarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}