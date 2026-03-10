import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Key, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetStudentPassword() {
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast.error('Enter student ID or name');
      return;
    }

    setLoading(true);
    try {
      const id = studentId.trim();
      const byId = await base44.entities.Student.filter({ student_id: id }, null, 10);
      const byName = await base44.entities.Student.filter({ name: { $regex: id, $options: 'i' } }, null, 10);
      const combined = [...new Map([...byId, ...byName].map(s => [s.id, s])).values()];
      setStudents(combined);
      if (combined.length === 0) toast.error('No students found');
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('resetStudentPasswordByAdmin', {
        student_id: selectedStudent.student_id
      });
      setTempPassword(res.data.temporary_password);
      setShowConfirm(false);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reset Student Password
            </CardTitle>
            <CardDescription>Search for a student and reset their password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student ID or Name
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="e.g., S25007 or John"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </form>

            {/* Search Results */}
            {students.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Found {students.length} student(s)</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-gray-500">
                          {student.student_id} • Class {student.class_name} {student.section}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudent(student);
                          setShowConfirm(true);
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Temp Password Display */}
            {tempPassword && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-900 mb-3">✓ Password Reset Successfully</p>
                <div className="bg-white border rounded p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Temporary Password</p>
                    <p className="font-mono text-lg font-bold text-green-600">{tempPassword}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="gap-2"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-gray-600 mt-3 p-2 bg-yellow-50 rounded">
                  ⚠️ Share this password with {selectedStudent?.name}. They must change it on first login.
                </p>
                <Button
                  className="w-full mt-3"
                  variant="outline"
                  onClick={() => {
                    setTempPassword('');
                    setStudents([]);
                    setStudentId('');
                  }}
                >
                  Reset Another Student
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password?</AlertDialogTitle>
            <AlertDialogDescription>
              Reset password for <strong>{selectedStudent?.name}</strong> ({selectedStudent?.student_id})?
              A temporary password will be generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleResetConfirm} disabled={loading}>
            {loading ? 'Resetting...' : 'Yes, Reset'}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}