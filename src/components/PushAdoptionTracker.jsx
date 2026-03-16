import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, AlertCircle, Users, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PushAdoptionTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    enabled: false,
    notEnabled: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('getStudentPushStatus', {
        page: 1,
        limit: 50,
      });
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching push status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async () => {
    try {
      setSendingReminder(true);
      await base44.functions.invoke('sendPushEnableReminder');
      toast.success('Reminder sent to students who have not enabled notifications.');
      await fetchData();
    } catch (err) {
      toast.error('Failed to send reminder: ' + err.message);
      console.error('Error sending reminder:', err);
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a237e]" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p>Error loading push status: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, push_enabled_students, push_not_enabled_students, pagination } = data;

  const StatCard = ({ label, value, sublabel, icon: Icon, bgColor, textColor }) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">{label}</p>
            <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
            {sublabel && <p className="text-gray-500 text-xs mt-2">{sublabel}</p>}
          </div>
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${bgColor}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Push Enabled Students"
          value={summary.push_enabled_count.toLocaleString()}
          sublabel="Active subscriptions"
          icon={CheckCircle2}
          bgColor="bg-green-500"
          textColor="text-green-600"
        />

        <StatCard
          label="Push Not Enabled"
          value={summary.push_not_enabled_count.toLocaleString()}
          sublabel="No active subscriptions"
          icon={AlertCircle}
          bgColor="bg-orange-500"
          textColor="text-orange-600"
        />

        <StatCard
          label="Adoption Rate"
          value={`${summary.adoption_rate}%`}
          sublabel={`of ${summary.total_students} students`}
          icon={Users}
          bgColor="bg-blue-500"
          textColor="text-blue-600"
        />
      </div>

      {/* Expandable Sections */}
      <Collapsible
        open={expandedSections.enabled}
        onOpenChange={(open) =>
          setExpandedSections({ ...expandedSections, enabled: open })
        }
      >
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>Students with Push Enabled ({pagination.total_enabled})</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.enabled ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <StudentTable students={push_enabled_students} showDate={true} />
          {push_enabled_students.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No students with push enabled
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={expandedSections.notEnabled}
        onOpenChange={(open) =>
          setExpandedSections({ ...expandedSections, notEnabled: open })
        }
      >
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>Students without Push Enabled ({pagination.total_not_enabled})</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.notEnabled ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <StudentTable students={push_not_enabled_students} showDate={false} />
          {push_not_enabled_students.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No students without push enabled
            </div>
          )}
          {push_not_enabled_students.length > 0 && (
            <Button
              onClick={handleSendReminder}
              disabled={sendingReminder}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {sendingReminder ? 'Sending...' : 'Send Reminder to Enable Notifications'}
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StudentTable({ students, showDate }) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Student ID</th>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Class</th>
            <th className="px-4 py-3 text-left font-medium">Section</th>
            {showDate && (
              <th className="px-4 py-3 text-left font-medium">Push Enabled Date</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.length === 0 ? (
            <tr>
              <td colSpan={showDate ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
                No students found
              </td>
            </tr>
          ) : (
            students.map((student) => (
              <tr key={student.student_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{student.student_id}</td>
                <td className="px-4 py-3">{student.name}</td>
                <td className="px-4 py-3">{student.class_name}</td>
                <td className="px-4 py-3">{student.section}</td>
                {showDate && (
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(student.push_enabled_date).toLocaleDateString()}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}