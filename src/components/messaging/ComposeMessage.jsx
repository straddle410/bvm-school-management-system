import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function ComposeMessage({ sender, onClose, onSent, replyTo = null }) {
  const [recipientType, setRecipientType] = useState('individual');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(
    replyTo ? { id: replyTo.sender_id, name: replyTo.sender_name, role: replyTo.sender_role } : null
  );
  const [targetClass, setTargetClass] = useState('');
  const [targetSection, setTargetSection] = useState('A');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject || ''}` : '');
  const [body, setBody] = useState('');
  const [subjectArea, setSubjectArea] = useState('');
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState([]);

  // If sender is a student, only search teachers/admin; otherwise search all
  const isStudent = sender?.role === 'student';

  useEffect(() => {
    base44.entities.Subject.list().then(s => setSubjects(s)).catch(() => {});
    if (isStudent) {
      // Fetch all active staff from StaffAccount (staff management)
      base44.entities.StaffAccount.list()
        .then(list => {
          const active = list.filter(s => s.is_active !== false);
          setAllTeachers(active);
        })
        .catch(() => {});
    }
  }, [isStudent]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2 || recipientType !== 'individual') {
      setSearchResults([]);
      return;
    }
    const search = async () => {
      const q = searchQuery.toLowerCase();
      if (isStudent) {
        // Students can only message teachers/admin
        const teachers = await base44.entities.Teacher.list().catch(() => []);
        const teacherResults = teachers
          .filter(t => t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q))
          .slice(0, 8)
          .map(t => ({ id: t.email, name: t.name, role: 'teacher', sub: t.role || 'Teacher' }));
        setSearchResults(teacherResults);
      } else {
        const [students, teachers] = await Promise.all([
          base44.entities.Student.list().catch(() => []),
          base44.entities.Teacher.list().catch(() => []),
        ]);
        const studentResults = students
          .filter(s => s.name?.toLowerCase().includes(q) || s.student_id?.toLowerCase().includes(q))
          .slice(0, 5)
          .map(s => ({ id: s.student_id, name: s.name, role: 'student', sub: `Class ${s.class_name}-${s.section}` }));
        const teacherResults = teachers
          .filter(t => t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q))
          .slice(0, 5)
          .map(t => ({ id: t.email, name: t.name, role: 'teacher', sub: t.role }));
        setSearchResults([...studentResults, ...teacherResults]);
      }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [searchQuery, recipientType, isStudent]);

  const handleSend = async () => {
    if (!body.trim() || !sender) return;
    setSending(true);
    try {
      const academicYear = sender.academic_year || '2024-25';
      const threadId = replyTo?.thread_id || replyTo?.id || `thread_${Date.now()}`;

      if (recipientType === 'individual') {
        if (!selectedRecipient) { setSending(false); return; }
        const res = await base44.functions.invoke('sendMessage', {
          sender_id: sender.id,
          sender_name: sender.name,
          sender_role: sender.role,
          recipient_type: 'individual',
          recipient_id: selectedRecipient.id,
          recipient_name: selectedRecipient.name,
          subject: subject.trim(),
          body: body.trim(),
          thread_id: threadId,
          parent_message_id: replyTo?.id || null,
          academic_year: academicYear,
          subject_area: subjectArea || null,
        });
        if (res.status !== 200) {
          const errorMsg = res.data?.error || 'Failed to send message';
          if (res.status === 429) {
            const retryAfter = res.data?.retryAfterSeconds;
            const retryMsg = retryAfter ? ` Try again in ${Math.ceil(retryAfter / 60)} minutes.` : '';
            alert(`Rate limit: ${errorMsg}.${retryMsg}`);
          } else {
            alert(errorMsg);
          }
          setSending(false);
          return;
        }
      } else {
        if (!targetClass) { setSending(false); return; }
        const filter = { class_name: targetClass, status: 'Published' };
        if (recipientType === 'section') filter.section = targetSection;
        const students = await base44.entities.Student.filter(filter).catch(() => []);
        if (students.length === 0) { setSending(false); return; }
        const res = await base44.functions.invoke('sendMessage', {
          sender_id: sender.id,
          sender_name: sender.name,
          sender_role: sender.role,
          recipient_type: recipientType,
          academic_year: academicYear,
          subject: subject.trim(),
          body: body.trim(),
          thread_id: threadId,
          messages: students.map(s => ({
            recipient_id: s.student_id,
            recipient_name: s.name,
            recipient_class: targetClass,
            recipient_section: s.section,
          })),
        });
        if (res.status !== 200) {
          const errorMsg = res.data?.error || 'Failed to send message';
          if (res.status === 429) {
            const retryAfter = res.data?.retryAfterSeconds;
            const retryMsg = retryAfter ? ` Try again in ${Math.ceil(retryAfter / 60)} minutes.` : '';
            alert(`Rate limit: ${errorMsg}.${retryMsg}`);
          } else {
            alert(errorMsg);
          }
          setSending(false);
          return;
        }
      }
      onSent?.();
      onClose();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Error sending message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto" style={{ maxHeight: 'calc(100vh - 32px)' }}>
        <div className="bg-[#1a237e] text-white px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-base sm:text-lg">{replyTo ? 'Reply' : 'New Message'}</h2>
          <button onClick={onClose} className="flex-shrink-0"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1 min-h-[150px]">
          {!replyTo && !isStudent && (
            <div className="flex gap-2">
              {['individual', 'class', 'section'].map(t => (
                <button
                  key={t}
                  onClick={() => { setRecipientType(t); setSelectedRecipient(null); setSearchQuery(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    recipientType === t ? 'bg-[#1a237e] text-white border-[#1a237e]' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {t === 'individual' ? 'Direct' : t === 'class' ? 'Entire Class' : 'Section'}
                </button>
              ))}
            </div>
          )}

          {recipientType === 'individual' ? (
            replyTo ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-800">{replyTo.sender_name}</span>
              </div>
            ) : isStudent ? (
              // Students get a dropdown of all active staff fetched live from StaffAccount
              <Select
                value={selectedRecipient?.id || ''}
                onValueChange={val => {
                  const t = allTeachers.find(t => t.username === val);
                  if (t) setSelectedRecipient({
                    id: t.username,
                    name: t.name,
                    role: t.role || 'staff',
                    sub: t.designation || t.role || 'Staff'
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {allTeachers.map(t => (
                    <SelectItem key={t.username} value={t.username}>
                      {t.name} — {t.designation || t.role || 'Staff'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search student or teacher..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedRecipient(null); }}
                />
                {selectedRecipient && (
                  <div className="mt-1 p-2 bg-blue-50 rounded-lg flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{selectedRecipient.name}</span>
                    <span className="text-xs text-blue-500">{selectedRecipient.sub}</span>
                  </div>
                )}
                {searchResults.length > 0 && !selectedRecipient && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => { setSelectedRecipient(r); setSearchQuery(r.name); setSearchResults([]); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${r.role === 'student' ? 'bg-blue-500' : 'bg-green-500'}`}>
                          {r.name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.name}</p>
                          <p className="text-xs text-gray-500">{r.sub} • {r.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex gap-2">
              <Select value={targetClass} onValueChange={setTargetClass}>
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
              </Select>
              {recipientType === 'section' && (
                <Select value={targetSection} onValueChange={setTargetSection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['A','B','C','D'].map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          )}

          <Input placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)} />

          {subjects.length > 0 && (
            <Select value={subjectArea || '__none__'} onValueChange={val => setSubjectArea(val === '__none__' ? '' : val)}>
              <SelectTrigger><SelectValue placeholder="Related subject (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <textarea
            className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={5}
            placeholder="Type your message..."
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
          <Button onClick={handleSend} disabled={sending || !body.trim()} className="w-full bg-[#1a237e] hover:bg-[#283593] gap-2 text-sm sm:text-base">
            <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </div>
    </div>
  );
}