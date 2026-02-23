import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableGrid({ entries, title }) {
  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No timetable entries found</p>
        </CardContent>
      </Card>
    );
  }

  // Get unique times
  const timeSlots = [...new Set(entries.map(e => e.start_time))].sort();
  
  // Group entries by day
  const entriesByDay = {};
  DAYS.forEach(day => {
    entriesByDay[day] = entries.filter(e => e.day === day);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left font-semibold">Time</th>
              {DAYS.map(day => (
                <th key={day} className="border p-3 text-left font-semibold">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(time => (
              <tr key={time} className="hover:bg-gray-50">
                <td className="border p-3 font-medium bg-gray-50 whitespace-nowrap">
                  {time} - {entries.find(e => e.start_time === time)?.end_time}
                </td>
                {DAYS.map(day => {
                  const entry = entriesByDay[day]?.find(e => e.start_time === time);
                  return (
                    <td key={`${day}-${time}`} className="border p-3">
                      {entry ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-blue-700">{entry.subject}</div>
                          <div className="text-xs text-gray-600">{entry.teacher_name}</div>
                          {entry.room_number && (
                            <div className="text-xs text-gray-500">Room: {entry.room_number}</div>
                          )}
                          {entry.notes && (
                            <div className="text-xs text-orange-600 italic">{entry.notes}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-300 text-center">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}