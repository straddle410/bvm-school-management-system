import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const colorVariants = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  rose: 'bg-rose-50 text-rose-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

export default function StatsCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  color = 'blue',
  trend,
  onClick 
}) {
  return (
    <Card 
      className={cn(
        "p-6 bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center",
            colorVariants[color]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </Card>
  );
}