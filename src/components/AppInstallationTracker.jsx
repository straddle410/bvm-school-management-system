import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, Users, ChevronDown, Loader2 } from 'lucide-react';

export default function AppInstallationTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    installed: false,
    notInstalled: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('getStudentAppInstallationStatus');
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching app installation status:', err);
    } finally {
      setLoading(false);
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
            <div className="w-5 h-5">⚠️</div>
            <p>Error loading app installation status: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, installed_students, not_installed_students } = data;

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
          label="App Installed"
          value={summary.app_installed_count.toLocaleString()}
          sublabel="Students with active app"
          icon={Download}
          bgColor="bg-green-500"
          textColor="text-green-600"
        />

        <StatCard
          label="App Not Installed"
          value={summary.app_not_installed_count.toLocaleString()}
          sublabel="Never opened or no token"
          icon={Users}
          bgColor="bg-orange-500"
          textColor="text-orange-600"
        />

        <StatCard
          label="Installation Rate"
          value={`${summary.installation_rate}%`}
          sublabel={`of ${summary.total_students} students`}
          icon={Users}
          bgColor="bg-blue-500"
          textColor="text-blue-600"
        />
      </div>

      {/* Expandable Sections */}
      <Collapsible
        open={expandedSections.installed}
        onOpenChange={(open) =>
          setExpandedSections({ ...expandedSections, installed: open })
        }
      >
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>Students with App Installed ({installed_students.length})</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.installed ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <StudentTable students={installed_students} />
          {installed_students.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No students with app installed
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={expandedSections.notInstalled}
        onOpenChange={(open) =>
          setExpandedSections({ ...expandedSections, notInstalled: open })
        }
      >
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>Students without App Installed ({not_installed_students.length})</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.notInstalled ? 'rotate-180' : ''
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <StudentTable students={not_installed_students} />
          {not_installed_students.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              All students have app installed
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StudentTable({ students }) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Student ID</th>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Class</th>
            <th className="px-4 py-3 text-left font-medium">Section</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}