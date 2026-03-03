import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoginRequired from '@/components/LoginRequired';
import StaffManagement from './StaffManagement';
import Teachers from './Teachers';

export default function Staff() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'add');

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Staff">
      <div className="min-h-screen bg-slate-50">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
            <div className="px-4 lg:px-8">
              <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-auto p-0">
                <TabsTrigger 
                  value="add" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#1a237e] data-[state=active]:bg-transparent px-4 py-4"
                >
                  Add Staff
                </TabsTrigger>
                <TabsTrigger 
                  value="manage" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#1a237e] data-[state=active]:bg-transparent px-4 py-4"
                >
                  Staff Management
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="add" className="m-0">
            <Teachers />
          </TabsContent>

          <TabsContent value="manage" className="m-0">
            <StaffManagement />
          </TabsContent>
        </Tabs>
      </div>
    </LoginRequired>
  );
}