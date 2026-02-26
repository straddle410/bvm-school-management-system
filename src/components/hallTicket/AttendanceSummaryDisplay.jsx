import React from 'react';

export default function AttendanceSummaryDisplay({ attendanceSummary }) {
  if (!attendanceSummary) return null;

  const {
    working_days = 0,
    full_days_present = 0,
    half_days_present = 0,
    total_present_days = 0,
    attendance_percentage = 0
  } = attendanceSummary;

  const getPercentageColor = (percentage) => {
    if (percentage >= 90) return 'bg-green-50 border-green-200 text-green-700';
    if (percentage >= 75) return 'bg-blue-50 border-blue-200 text-blue-700';
    if (percentage >= 60) return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    return 'bg-red-50 border-red-200 text-red-700';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Attendance Summary</h2>
      
      {/* Summary Table */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Metric</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-900">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="px-4 py-3 text-gray-700">Working Days</td>
              <td className="px-4 py-3 text-center font-semibold text-gray-900">{working_days}</td>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50">
              <td className="px-4 py-3 text-gray-700">Full Days Present</td>
              <td className="px-4 py-3 text-center font-semibold text-blue-600">{full_days_present}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="px-4 py-3 text-gray-700">Half Days Present</td>
              <td className="px-4 py-3 text-center font-semibold text-blue-600">{half_days_present}</td>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50">
              <td className="px-4 py-3 text-gray-700">Total Present Days</td>
              <td className="px-4 py-3 text-center font-semibold text-blue-600">{total_present_days.toFixed(1)}</td>
            </tr>
            <tr className={`${getPercentageColor(attendance_percentage)}`}>
              <td className="px-4 py-3 font-semibold">Attendance Percentage</td>
              <td className="px-4 py-3 text-center font-bold text-lg">{attendance_percentage.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Attendance Status Badge */}
      <div className="flex justify-center">
        {attendance_percentage >= 75 ? (
          <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2 text-center">
            <p className="text-sm font-semibold text-green-700">✓ Satisfactory Attendance</p>
            <p className="text-xs text-green-600 mt-1">{attendance_percentage.toFixed(1)}% of working days attended</p>
          </div>
        ) : attendance_percentage >= 60 ? (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 text-center">
            <p className="text-sm font-semibold text-yellow-700">⚠ Attendance Below Target</p>
            <p className="text-xs text-yellow-600 mt-1">Attend more days to reach 75% minimum</p>
          </div>
        ) : (
          <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 text-center">
            <p className="text-sm font-semibold text-red-700">✗ Poor Attendance</p>
            <p className="text-xs text-red-600 mt-1">Attendance below required threshold</p>
          </div>
        )}
      </div>
    </div>
  );
}