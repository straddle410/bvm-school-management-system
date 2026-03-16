import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Users, TrendingUp, Loader2 } from 'lucide-react';

const PUSH_CONTEXT_TYPES = [
  'fee_reminder',
  'fee_payment',
  'absent_notification',
  'notice_posted',
  'hall_ticket_published',
  'marks_publish'
];

export default function PushHealthDashboard({ startDate, endDate }) {
  // Fetch push health metrics
  const { data: healthData, isLoading } = useQuery({
    queryKey: ['push-health', startDate, endDate],
    queryFn: async () => {
      // Get all messages in date range
      const messages = await base44.entities.Message.list();
      
      // Filter by date range
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999);
      
      const messagesInRange = messages.filter(m => {
        const msgDate = new Date(m.created_date);
        return msgDate >= rangeStart && msgDate <= rangeEnd;
      });
      
      // Count push sent (is_push_sent = true)
      const pushSent = messagesInRange.filter(m => m.is_push_sent === true).length;
      
      // Count push failed (is_push_sent = false AND context_type in pushable types)
      const pushFailed = messagesInRange.filter(m => 
        m.is_push_sent === false && PUSH_CONTEXT_TYPES.includes(m.context_type)
      ).length;
      
      // Get all students for no-token count
      const allStudents = await base44.entities.Student.list();
      
      // Get all push preferences
      const prefs = await base44.entities.StudentNotificationPreference.list();
      const prefsMap = new Map(prefs.map(p => [p.student_id, p]));
      
      // Count students without push tokens
      const noTokenStudents = allStudents.filter(s => {
        const pref = prefsMap.get(s.student_id);
        return !pref || !pref.browser_push_token;
      }).length;
      
      // Calculate success rate
      const totalAttempts = pushSent + pushFailed;
      const successRate = totalAttempts > 0 ? Math.round((pushSent / totalAttempts) * 100) : 0;
      
      return {
        pushSent,
        pushFailed,
        noTokenStudents,
        totalStudents: allStudents.length,
        successRate,
        totalAttempts
      };
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a237e]" />
      </div>
    );
  }

  if (!healthData) {
    return null;
  }

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
    <div className="space-y-5">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Push Sent"
          value={healthData.pushSent.toLocaleString()}
          sublabel={`within ${startDate} → ${endDate}`}
          icon={CheckCircle2}
          bgColor="bg-green-500"
          textColor="text-green-600"
        />
        
        <StatCard
          label="Push Failed"
          value={healthData.pushFailed.toLocaleString()}
          sublabel={`failed delivery attempts`}
          icon={AlertCircle}
          bgColor="bg-red-500"
          textColor="text-red-600"
        />
        
        <StatCard
          label="No Device Token"
          value={healthData.noTokenStudents.toLocaleString()}
          sublabel={`of ${healthData.totalStudents} total students`}
          icon={Users}
          bgColor="bg-amber-500"
          textColor="text-amber-600"
        />
        
        <StatCard
          label="Success Rate"
          value={`${healthData.successRate}%`}
          sublabel={`${healthData.pushSent} sent of ${healthData.totalAttempts} attempts`}
          icon={TrendingUp}
          bgColor="bg-blue-500"
          textColor="text-blue-600"
        />
      </div>

      {/* Health Status Section */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Push Health Status</h3>
          
          <div className="space-y-3">
            {/* Success Rate Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Overall Success Rate</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      healthData.successRate >= 95 ? 'bg-green-500' : 
                      healthData.successRate >= 80 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${healthData.successRate}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-800 min-w-[40px]">{healthData.successRate}%</span>
              </div>
            </div>

            {/* Token Coverage */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Device Token Coverage</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      healthData.totalStudents - healthData.noTokenStudents >= healthData.totalStudents * 0.95 ? 'bg-green-500' : 
                      healthData.totalStudents - healthData.noTokenStudents >= healthData.totalStudents * 0.80 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${((healthData.totalStudents - healthData.noTokenStudents) / healthData.totalStudents) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-800 min-w-[40px]">
                  {Math.round(((healthData.totalStudents - healthData.noTokenStudents) / healthData.totalStudents) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Health Recommendations */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Recommendations:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {healthData.noTokenStudents > healthData.totalStudents * 0.20 && (
                <li>• Many students lack device tokens. Encourage app installation and push notification opt-in.</li>
              )}
              {healthData.successRate < 95 && (
                <li>• Push success rate below 95%. Check student device connectivity and token validity.</li>
              )}
              {healthData.pushFailed > healthData.pushSent * 0.10 && (
                <li>• High failure rate detected. Review invalid or expired push subscriptions.</li>
              )}
              {healthData.noTokenStudents <= healthData.totalStudents * 0.10 && healthData.successRate >= 95 && (
                <li>✓ Push notification system is healthy. Continue monitoring.</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}