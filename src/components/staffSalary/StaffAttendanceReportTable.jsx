import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

const STATUS_COLORS = {
  Present: 'bg-green-100 text-green-700',
  Absent: 'bg-red-100 text-red-700',
  'Half Day': 'bg-yellow-100 text-yellow-700',
  Leave: 'bg-blue-100 text-blue-700',
  Holiday: 'bg-gray-100 text-gray-600',
};

export default function StaffAttendanceReportTable({ staffSummary, dateFrom, dateTo }) {
  const [expandedId, setExpandedId] = useState(null);

  if (staffSummary.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-slate-500">No staff data found.</CardContent></Card>
    );
  }

  return (
    <div className="space-y-2">
      {staffSummary.map(s => {
        const isExpanded = expandedId === s.id;
        const totalDays = s.present + s.absent + s.halfDay + s.leave + s.holiday;
        const effectiveDays = s.present + s.halfDay * 0.5;
        return (
          <Card key={s.id} className="border-0 shadow-sm dark:bg-gray-800 overflow-hidden">
            <CardContent className="p-0">
              {/* Summary Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.designation}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  <MiniStat label="P" count={s.present} cls="text-green-600" />
                  <MiniStat label="A" count={s.absent} cls="text-red-600" />
                  <MiniStat label="H" count={s.halfDay} cls="text-yellow-600" />
                  <MiniStat label="L" count={s.leave} cls="text-blue-600" />
                  <span className="text-xs text-slate-500 ml-1">
                    Eff: <span className="font-semibold text-slate-700 dark:text-gray-200">{effectiveDays}/{totalDays}</span>
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-gray-300">Date</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-gray-300">Status</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-gray-300">Check-in</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-gray-300">Check-out</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-gray-300">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.records
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(r => (
                          <tr key={r.id || r.date} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2 text-slate-700 dark:text-gray-300 whitespace-nowrap">
                              {formatDate(r.date)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[r.status] || ''}`}>
                                {r.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-gray-400">
                              {r.checkin_time ? (
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.checkin_time}</span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-gray-400">
                              {r.checkout_time ? (
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.checkout_time}</span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-500 dark:text-gray-400 truncate max-w-[120px]" title={r.remarks || ''}>
                              {r.remarks || '—'}
                            </td>
                          </tr>
                        ))}
                      {s.records.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-400">No records in this range</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MiniStat({ label, count, cls }) {
  return (
    <span className={`text-xs font-semibold ${cls}`}>
      {label}:{count}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
}