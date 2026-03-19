import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, MessageSquare, RotateCcw } from 'lucide-react';
import { toast } from "sonner";

const ABSENT_PLACEHOLDERS = [
  { key: '{student_name}', label: 'Student Name' },
  { key: '{class}', label: 'Class' },
  { key: '{section}', label: 'Section' },
  { key: '{date}', label: 'Date' },
  { key: '{school_name}', label: 'School Name' },
];

const FEE_PLACEHOLDERS = [
  { key: '{student_name}', label: 'Student Name' },
  { key: '{class}', label: 'Class' },
  { key: '{parent_name}', label: 'Parent Name' },
  { key: '{amount_due}', label: 'Amount Due' },
  { key: '{school_name}', label: 'School Name' },
];

const DEFAULT_ABSENT_MESSAGE = `Dear student/parent, {student_name} was marked absent today (Class {class}-{section}). If this is incorrect, please contact the school.`;

const DEFAULT_FEE_MESSAGE = `Dear {parent_name}, fee of ₹{amount_due} is pending for {student_name} ({class}). Please pay at the earliest.`;

function TemplateEditor({ title, description, value, onChange, placeholders, defaultMessage, onSave, isSaving }) {
  const textareaRef = useRef(null);

  const insertPlaceholder = (placeholder) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + placeholder);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = value.substring(0, start) + placeholder + value.substring(end);
    onChange(newVal);
    // Restore cursor position after placeholder
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + placeholder.length;
      el.focus();
    }, 0);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-indigo-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Placeholder chips */}
        <div>
          <Label className="text-xs text-slate-500 mb-2 block">Click to insert placeholder:</Label>
          <div className="flex flex-wrap gap-2">
            {placeholders.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => insertPlaceholder(p.key)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-xs font-mono font-medium transition-colors"
              >
                {p.key}
              </button>
            ))}
          </div>
        </div>

        {/* Message textarea */}
        <div>
          <Label>Message Template</Label>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={5}
            placeholder={defaultMessage}
            className="mt-1 font-sans text-sm"
            dir="auto"
          />
          <p className="text-xs text-slate-400 mt-1">
            Supports Telugu text. Placeholders like {'{student_name}'} will be auto-replaced when sending.
          </p>
        </div>

        {/* Preview */}
        {value && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 mb-1">Preview (sample values):</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {value
                .replace('{student_name}', 'Ravi Kumar')
                .replace('{class}', '7')
                .replace('{section}', 'A')
                .replace('{date}', new Date().toLocaleDateString('en-IN'))
                .replace('{parent_name}', 'Mr. Suresh Kumar')
                .replace('{amount_due}', '5000')
                .replace('{school_name}', 'BVM School')
              }
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={onSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
          <Button
            variant="outline"
            onClick={() => onChange(defaultMessage)}
            title="Reset to default"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MessageTemplatesTab() {
  const queryClient = useQueryClient();

  const { data: schoolProfiles = [] } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list(),
  });

  const profile = schoolProfiles[0];

  const [absentMsg, setAbsentMsg] = useState('');
  const [feeMsg, setFeeMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setAbsentMsg(profile.absent_message_template || DEFAULT_ABSENT_MESSAGE);
      setFeeMsg(profile.fee_reminder_template || DEFAULT_FEE_MESSAGE);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async ({ field, value }) => {
      if (!profile) throw new Error('School profile not found');
      return base44.entities.SchoolProfile.update(profile.id, { [field]: value });
    },
    onSuccess: (_, { field }) => {
      queryClient.invalidateQueries(['school-profile']);
      toast.success('Template saved successfully');
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Message Templates</strong> — Customise the messages sent for absent notifications and fee reminders. 
          Use placeholders (e.g. <code className="bg-blue-100 px-1 rounded">{'{student_name}'}</code>) which get auto-filled when the message is sent. 
          Telugu text is fully supported.
        </p>
      </div>

      <TemplateEditor
        title="Absent Notification Message"
        description="Sent to students/parents when a student is marked absent"
        value={absentMsg}
        onChange={setAbsentMsg}
        placeholders={ABSENT_PLACEHOLDERS}
        defaultMessage={DEFAULT_ABSENT_MESSAGE}
        onSave={() => saveMutation.mutate({ field: 'absent_message_template', value: absentMsg })}
        isSaving={saveMutation.isPending && saveMutation.variables?.field === 'absent_message_template'}
      />

      <TemplateEditor
        title="Fee Reminder Message"
        description="Sent to parents of defaulter students as a fee payment reminder"
        value={feeMsg}
        onChange={setFeeMsg}
        placeholders={FEE_PLACEHOLDERS}
        defaultMessage={DEFAULT_FEE_MESSAGE}
        onSave={() => saveMutation.mutate({ field: 'fee_reminder_template', value: feeMsg })}
        isSaving={saveMutation.isPending && saveMutation.variables?.field === 'fee_reminder_template'}
      />
    </div>
  );
}