import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getStaffSession } from '@/components/useStaffSession';
import LoginRequired from '@/components/LoginRequired';
import { can, getEffectivePermissions } from '@/components/permissionHelper';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, AlertCircle } from 'lucide-react';
import TimetableForm from '@/components/timetable/TimetableForm';
import TimetableList from '@/components/timetable/TimetableList';
import TimetableGrid from '@/components/timetable/TimetableGrid';
import { toast } from 'sonner';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

export default function TimetableManagement() {
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filters, setFilters] = useState({ class: '', section: '', teacher: '' });
  const [viewMode, setViewMode] = useState('class'); // 'class' or 'teacher'
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then((result) => {
      setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
    });
  }, [academicYear]);

  useEffect(() => {
    if (!filters.class || !academicYear) { setAvailableSections([]); return; }
    getSectionsForClass(academicYear, filters.class).then((result) => {
      setAvailableSections(Array.isArray(result) ? result : (result?.sections ?? []));
    });
  }, [filters.class, academicYear]);

  // Check if user has edit permissions (admin, principal, or exam_staff with timetable_manage)
  const userWithPerms = user ? { ...user, effective_permissions: getEffectivePermissions(user || {}) } : null;
  const canManageTimetable = userWithPerms ? can(userWithPerms, 'timetable_manage') : false;
  const canEdit = user && (['admin', 'principal'].includes(user.role) || canManageTimetable);
  const isTeacher = user && user.role === 'teacher';
  const viewOnly = isTeacher && !canManageTimetable;

  const { data: timetables = [], isLoading } = useQuery({
    queryKey: ['timetables', academicYear, filters],
    queryFn: async () => {
      const query = { academic_year: academicYear };
      if (filters.class) query.class_name = filters.class;
      const entries = await base44.entities.Timetable.filter(query);
      
      if (filters.section) {
        return entries.filter(e => e.section === filters.section);
      }
      if (filters.teacher) {
        return entries.filter(e => e.teacher_name.toLowerCase().includes(filters.teacher.toLowerCase()));
      }
      return entries;
    }
  });

  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const createMutation = useMutation({
    mutationFn: async (data, days) => {
      // For multi-day creation, create one entry per day
      if (days && days.length > 1) {
        const existingEntries = await base44.entities.Timetable.filter({
          academic_year: data.academic_year,
          class_name: data.class_name,
          section: data.section,
          subject: data.subject,
          start_time: data.start_time,
          end_time: data.end_time
        });
        
        // Check for existing entries on any selected day
        const conflictingDays = days.filter(day =>
          existingEntries.some(e => e.day === day)
        );
        
        if (conflictingDays.length > 0) {
          throw new Error(`Duplicate entry exists for ${conflictingDays.join(', ')} on this subject/time slot`);
        }
        
        const promises = days.map(day =>
          base44.entities.Timetable.create({ ...data, day })
        );
        return Promise.all(promises);
      } else {
        return base44.entities.Timetable.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      setShowForm(false);
      setEditingEntry(null);
      toast.success('Timetable entry created successfully');
    },
    onError: (error) => toast.error(error.message || 'Failed to create entry')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Timetable.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      setShowForm(false);
      setEditingEntry(null);
      toast.success('Timetable entry updated successfully');
    },
    onError: (error) => toast.error('Failed to update entry')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Timetable.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      toast.success('Timetable entry deleted successfully');
    },
    onError: (error) => toast.error('Failed to delete entry')
  });

  const handleSubmit = (formData, selectedDays) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData });
    } else {
      createMutation.mutate(formData, selectedDays);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this timetable entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  // Get unique teachers from timetables
  const uniqueTeachers = [...new Set(timetables.map(t => t.teacher_name))];

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'exam_staff']} pageName="Timetable Management">
    <div className="min-h-screen bg-gray-100 p-4">
      <PageHeader
        title="Timetable Management"
        subtitle="Create and manage class timetables"
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Add Entry Button - Only for admin/principal */}
          {!showForm && canEdit && !viewOnly && (
           <Button
             onClick={() => setShowForm(true)}
             className="bg-blue-600 hover:bg-blue-700"
           >
             <Plus className="h-4 w-4 mr-2" /> Add Timetable Entry
           </Button>
         )}
         
         {viewOnly && (
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
             <p className="text-sm text-blue-800">
               📖 <strong>View Only:</strong> Teachers can view timetables but cannot edit. Contact admin to make changes.
             </p>
           </div>
         )}

        {/* Form */}
        {showForm && (
          <TimetableForm
            entry={editingEntry}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            academicYear={academicYear}
          />
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Class</label>
                <select
                  value={filters.class}
                  onChange={(e) => setFilters({ ...filters, class: e.target.value, section: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All Classes</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>Class {cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Section</label>
                <select
                  value={filters.section}
                  onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!filters.class}
                >
                  <option value="">All Sections</option>
                  {availableSections.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Teacher</label>
                <select
                  value={filters.teacher}
                  onChange={(e) => setFilters({ ...filters, teacher: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All Teachers</option>
                  {uniqueTeachers.map(teacher => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ class: '', section: '', teacher: '' })}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-gray-500 text-center">Loading timetables...</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="conflicts">Check Conflicts</TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <TimetableList
                entries={timetables}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleEdit}
                canEdit={canEdit && !viewOnly}
              />
            </TabsContent>

            <TabsContent value="grid">
              {filters.class && filters.section ? (
                <TimetableGrid
                  entries={timetables}
                  title={`Class ${filters.class} - ${filters.section} Timetable`}
                />
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex gap-3 items-start">
                      <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Select Class and Section</p>
                        <p className="text-sm text-gray-600">Choose a class and section to view the grid timetable</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="conflicts">
              <ConflictChecker entries={timetables} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
    </LoginRequired>
  );
}

function ConflictChecker({ entries }) {
  const conflicts = [];

  // Check for teacher conflicts
  const teacherSlots = {};
  entries.forEach(entry => {
    const key = `${entry.teacher_name}-${entry.day}-${entry.start_time}`;
    if (teacherSlots[key]) {
      conflicts.push({
        type: 'Teacher Conflict',
        details: `${entry.teacher_name} assigned to multiple classes at ${entry.start_time} on ${entry.day}`
      });
    }
    teacherSlots[key] = true;
  });

  // Check for room conflicts
  const roomSlots = {};
  entries.forEach(entry => {
    if (entry.room_number) {
      const key = `${entry.room_number}-${entry.day}-${entry.start_time}`;
      if (roomSlots[key]) {
        conflicts.push({
          type: 'Room Conflict',
          details: `Room ${entry.room_number} assigned to multiple classes at ${entry.start_time} on ${entry.day}`
        });
      }
      roomSlots[key] = true;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conflict Check</CardTitle>
      </CardHeader>
      <CardContent>
        {conflicts.length === 0 ? (
          <p className="text-green-600 font-medium">✓ No conflicts detected</p>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict, idx) => (
              <div key={idx} className="border-l-4 border-red-500 bg-red-50 p-3 rounded">
                <p className="font-semibold text-red-700">{conflict.type}</p>
                <p className="text-sm text-red-600">{conflict.details}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}