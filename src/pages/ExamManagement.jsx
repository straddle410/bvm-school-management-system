import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import ProgressCardGenerator from '@/components/hallTicket/ProgressCardGenerator';
import ProgressCardsList from '@/components/hallTicket/ProgressCardsList';

export default function ExamManagement() {
  const [user, setUser] = useState(null);
  const { academicYear } = useAcademicYear();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          setUser(JSON.parse(session));
          return;
        }
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <PageHeader
        title="Exam Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate Cards</TabsTrigger>
            <TabsTrigger value="view">View Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-6">
            <ProgressCardGenerator />
          </TabsContent>

          <TabsContent value="view" className="mt-6">
            <ProgressCardsList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}