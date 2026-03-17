import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobileSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Select...', 
  disabled = false,
  className = '',
  label = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-gray-200 bg-white text-left transition-all min-h-[44px]",
          isOpen ? "border-primary" : "border-gray-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className={value ? "text-foreground font-medium" : "text-muted-foreground"}>
          {selectedLabel}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Bottom Sheet Overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-lg animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-100">
              <h3 className="font-semibold text-foreground">{label || 'Select option'}</h3>
            </div>

            {/* Options List */}
            <div className="max-h-72 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-left font-medium transition-colors min-h-[48px] flex items-center",
                    value === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-gray-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Close Button */}
            <div className="p-3 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}