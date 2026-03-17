import React from 'react';
import { Loader2 } from 'lucide-react';

export default function FullPageSpinner({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-40">
      <Loader2 className="h-10 w-10 text-[#1a237e] animate-spin mb-3" />
      <p className="text-sm text-gray-600 font-medium">{message}</p>
    </div>
  );
}