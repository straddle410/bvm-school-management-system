import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, XCircle, Users, BookOpen, ClipboardCheck, 
  Image, HelpCircle, Calendar, MoreHorizontal
} from 'lucide-react';
import { toast } from "sonner";

export default function Approvals() {
  const [user, setUser] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [activeTab, setActiveTab] = useState('students');
  
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list()
  });

  const { data: marks = [] } = useQuery({
    queryKey: ['marks'],
    queryFn: () => base44.entities.Marks.list()
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => base44.entities.Attendance.list()
  });

  const { data: admissions = [] } = useQuery({
    queryKey: ['admissions'],
    queryFn: () => base44.entities.Admission.list()
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['gallery-photos'],
    queryFn: () => base44.entities.GalleryPhoto.list()
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => base44.entities.Quiz.list()
  });

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types'],
    queryFn: () => base44.entities.ExamType.list()
  });

  // Filter pending items
  const pendingStudents = students.filter(s => ['Pending', 'Verified', 'Approved'].includes(s.status) && s.status !== 'Published');
  const pendingMarks = marks.filter(m => ['Draft', 'Submitted', 'Verified', 'Approved'].includes(m.status) && m.status !== 'Published');
  const pendingAttendance = attendance.filter(a => ['Taken', 'Submitted', 'Verified', 'Approved'].includes(a.status) && a.status !== 'Published');
  const pendingAdmissions = admissions.filter(a => ['Submitted', 'Under Review', 'Verified'].includes(a.status));
  const pendingPhotos = photos.filter(p => ['Pending', 'Verified', 'Approved'].includes(p.status) && p.status !== 'Published');
  const pendingQuizzes = quizzes.filter(q => ['Draft', 'Submitted', 'Approved'].includes(q.status) && q.status !== 'Published');
  const pendingEvents = events.filter(e => e.status === 'Pending');
  const pendingExams = examTypes.filter(e => ['Draft', 'Verified'].includes(e.status) && e.status !== 'Published');

  const getNextStatus = (currentStatus) => {
    const workflow = {
      'Pending': 'Verified',
      'Verified': 'Approved',
      'Approved': 'Published',
      'Draft': 'Submitted',
      'Submitted': 'Verified',
      'Taken': 'Submitted',
      'Under Review': 'Verified'
    };
    return workflow[currentStatus] || 'Published';
  };

  const bulkApprove = async (entityName, items, statusField = 'status') => {
    const promises = items.map(item => {
      const newStatus = getNextStatus(item.status);
      return base44.entities[entityName].update(item.id, { [statusField]: newStatus });
    });
    await Promise.all(promises);
    queryClient.invalidateQueries();
    toast.success(`${items.length} items approved`);
    setSelectedItems({});
  };

  const bulkPublish = async (entityName, items) => {
    const promises = items.map(item => {
      return base44.entities[entityName].update(item.id, { status: 'Published' });
    });
    await Promise.all(promises);
    queryClient.invalidateQueries();
    toast.success(`${items.length} items published`);
    setSelectedItems({});
  };

  const toggleSelect = (id) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const selectAll = (items) => {
    const newSelected = {};
    items.forEach(item => {
      newSelected[item.id] = true;
    });
    setSelectedItems(newSelected);
  };

  const clearSelection = () => {
    setSelectedItems({});
  };

  const getSelectedItems = (items) => {
    return items.filter(item => selectedItems[item.id]);
  };

  const tabs = [
    { value: 'students', label: 'Students', count: pendingStudents.length, icon: Users },
    { value: 'admissions', label: 'Admissions', count: pendingAdmissions.length, icon: Users },
    { value: 'marks', label: 'Marks', count: pendingMarks.length, icon: BookOpen },
    { value: 'attendance', label: 'Attendance', count: pendingAttendance.length, icon: ClipboardCheck },
    { value: 'photos', label: 'Gallery', count: pendingPhotos.length, icon: Image },
    { value: 'quizzes', label: 'Quizzes', count: pendingQuizzes.length, icon: HelpCircle },
    { value: 'events', label: 'Events', count: pendingEvents.length, icon: Calendar },
    { value: 'exams', label: 'Exam Types', count: pendingExams.length, icon: BookOpen },
  ];

  const totalPending = tabs.reduce((sum, tab) => sum + tab.count, 0);

  const renderApprovalList = (items, entityName, renderItem) => {
    const selected = getSelectedItems(items);
    
    return (
      <div className="space-y-4">
        {items.length > 0 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => selectAll(items)}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <span className="text-sm text-slate-500">
                {selected.length} of {items.length} selected
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm"
                disabled={selected.length === 0}
                onClick={() => bulkApprove(entityName, selected)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve Selected
              </Button>
              <Button 
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                disabled={selected.length === 0}
                onClick={() => bulkPublish(entityName, selected)}
              >
                Publish Selected
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => (
            <Card 
              key={item.id} 
              className={`border-0 shadow-sm transition-all ${selectedItems[item.id] ? 'ring-2 ring-blue-500' : ''}`}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox
                  checked={selectedItems[item.id] || false}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
                <div className="flex-1">
                  {renderItem(item)}
                </div>
                <StatusBadge status={item.status} />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => bulkApprove(entityName, [item])}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => bulkPublish(entityName, [item])}
                  >
                    Publish
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {items.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700">All Caught Up!</h3>
              <p className="text-slate-500 mt-1">No pending items to approve</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Approvals">
      <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Bulk Approvals"
        subtitle={`${totalPending} items pending approval`}
      />

      <div className="p-4 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm flex-wrap h-auto p-2 gap-2">
            {tabs.map(tab => (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value}
                className="data-[state=active]:bg-blue-50"
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
                {tab.count > 0 && (
                  <Badge className="ml-2 bg-amber-100 text-amber-700 border-0">
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="students">
              {renderApprovalList(pendingStudents, 'Student', (item) => (
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-slate-500">Class {item.class_name}-{item.section}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="admissions">
              {renderApprovalList(pendingAdmissions, 'Admission', (item) => (
                <div>
                  <p className="font-medium">{item.student_name}</p>
                  <p className="text-sm text-slate-500">Applying for Class {item.applying_for_class}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="marks">
              {renderApprovalList(pendingMarks, 'Marks', (item) => (
                <div>
                  <p className="font-medium">{item.student_name}</p>
                  <p className="text-sm text-slate-500">
                    {item.subject} - {item.exam_type} | {item.marks_obtained}/{item.max_marks}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="attendance">
              {renderApprovalList(pendingAttendance, 'Attendance', (item) => (
                <div>
                  <p className="font-medium">{item.student_name}</p>
                  <p className="text-sm text-slate-500">
                    {item.date} | Class {item.class_name}-{item.section} | 
                    {item.is_present ? ' Present' : ' Absent'}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="photos">
              {renderApprovalList(pendingPhotos, 'GalleryPhoto', (item) => (
                <div className="flex items-center gap-3">
                  <img 
                    src={item.photo_url} 
                    alt="" 
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="font-medium">{item.caption || 'Photo'}</p>
                    <p className="text-sm text-slate-500">By {item.uploaded_by}</p>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="quizzes">
              {renderApprovalList(pendingQuizzes, 'Quiz', (item) => (
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-500">
                    {item.subject} | Class {item.class_name} | {item.quiz_date}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="events">
              {renderApprovalList(pendingEvents, 'CalendarEvent', (item) => (
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.event_type} | {item.start_date}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="exams">
              {renderApprovalList(pendingExams, 'ExamType', (item) => (
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-slate-500">Max: {item.max_marks} | Pass: {item.passing_marks}</p>
                </div>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
    </LoginRequired>
  );
}