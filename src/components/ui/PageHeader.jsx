import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  children
}) {
  return (
    <div className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 lg:px-8 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {backTo &&
          <Link to={createPageUrl(backTo)} className="flex-shrink-0">
            <button className="p-1 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
          </Link>
          }
          <div className="min-w-0 flex-1">
            <h1 className="text-slate-900 text-2xl font-bold truncate">{title}</h1>
            {subtitle &&
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            }
          </div>
        </div>
        {actions &&
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {actions}
        </div>
        }
      </div>
      {children}
    </div>
  );
}