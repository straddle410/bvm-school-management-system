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
    <div className="bg-white border-b border-slate-100 sticky top-0 z-40 lg:top-0">
      <div className="px-4 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {backTo && (
              <Link to={createPageUrl(backTo)}>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              {subtitle && (
                <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}