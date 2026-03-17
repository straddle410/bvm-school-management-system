import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOptimisticOperation } from '@/components/hooks/useOptimisticOperation';
import { AlertCircle, RotateCcw, User, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

const deletionTypeLabels = {
  self_delete: '🚨 Self Deleted',
  admin_archive: '📦 Admin Archived',
  admin_terminated: '🚫 Admin Terminated',
  passed_out: '✅ Passed Out',
  transferred: '➡️ Transferred',
  other: '❓ Other'
};

export default function ArchivedUsers() {
  const [filter, setFilter] = useState('all');
  const { execute: restoreUser } = useOptimisticOperation('restoreUserAccount');

  const { data: deletedStudents = [], isLoading: loadingStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['deleted-students'],
    queryFn: () => base44.entities.Student.filter({ is_deleted: true }),
    staleTime: 0
  });

  const { data: deletedStaff = [], isLoading: loadingStaff, refetch: refetchStaff } = useQuery({
    queryKey: ['deleted-staff'],
    queryFn: () => base44.entities.StaffAccount.filter({ is_deleted: true }),
    staleTime: 0
  });

  const handleRestore = async (userType, userId) => {
    try {
      const result = await restoreUser({ userType, userId });
      if (result.success) {
        if (userType === 'student') {
          refetchStudents();
        } else {
          refetchStaff();
        }
      }
    } catch (error) {
      console.error('Restore failed:', error);
    }
  };

  const filteredStudents = filter === 'all' ? deletedStudents : deletedStudents.filter(s => s.deletion_type === filter);
  const filteredStaff = filter === 'all' ? deletedStaff : deletedStaff.filter(s => s.deletion_type === filter);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1a237e] mb-2">Archived Users</h1>
        <p className="text-sm text-gray-600">Manage soft-deleted student and staff accounts</p>
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Students ({deletedStudents.length})
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Staff ({deletedStaff.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          {loadingStudents ? (
            <div className="text-center py-8 text-gray-500">Loading deleted students...</div>
          ) : filteredStudents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No deleted students found
              </CardContent>
            </Card>
          ) : (
            filteredStudents.map(student => (
              <Card key={student.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {student.student_id || 'No ID'}
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {student.class_name} - {student.section}
                        </span>
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          {deletionTypeLabels[student.deletion_type] || student.deletion_type}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRestore('student', student.id)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-gray-500 space-y-1">
                  <p><strong>Parent:</strong> {student.parent_name || 'N/A'}</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                    <p className="text-red-700 font-semibold">🗑️ Deleted by: {student.deleted_by || 'System'}</p>
                    <p className="text-red-600">{student.deleted_at ? format(new Date(student.deleted_at), 'PPpp') : 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          {loadingStaff ? (
            <div className="text-center py-8 text-gray-500">Loading deleted staff...</div>
          ) : filteredStaff.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No deleted staff found
              </CardContent>
            </Card>
          ) : (
            filteredStaff.map(staff => (
              <Card key={staff.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{staff.name}</CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {staff.staff_code || 'No Code'}
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded capitalize">
                          {staff.role}
                        </span>
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          {deletionTypeLabels[staff.deletion_type] || staff.deletion_type}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRestore('staff', staff.id)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-gray-500 space-y-1">
                  <p><strong>Email:</strong> {staff.email || 'N/A'}</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                    <p className="text-red-700 font-semibold">🗑️ Deleted by: {staff.deleted_by || 'System'}</p>
                    <p className="text-red-600">{staff.deleted_at ? format(new Date(staff.deleted_at), 'PPpp') : 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}