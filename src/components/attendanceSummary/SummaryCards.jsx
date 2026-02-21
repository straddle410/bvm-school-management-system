import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, TrendingUp, Calendar } from 'lucide-react';

export default function SummaryCards({ totalStudents, avgAttendance, workingDays }) {
  const cards = [
    {
      icon: Users,
      label: 'Total Students',
      value: totalStudents,
      color: 'blue'
    },
    {
      icon: TrendingUp,
      label: 'Average Attendance',
      value: `${avgAttendance}%`,
      color: 'green'
    },
    {
      icon: Calendar,
      label: 'Working Days',
      value: workingDays,
      color: 'amber'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const colorMap = {
          blue: 'bg-blue-50 text-blue-600',
          green: 'bg-green-50 text-green-600',
          amber: 'bg-amber-50 text-amber-600'
        };

        return (
          <Card key={idx} className="border-0 shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorMap[card.color]}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-600">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}