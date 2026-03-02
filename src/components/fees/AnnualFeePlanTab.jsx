import React, { useState } from 'react';
import FeePlanManager from './FeePlanManager';
import GenerateInvoices from './GenerateInvoices';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AnnualFeePlanTab({ academicYear }) {
  const [sub, setSub] = useState('plan');

  return (
    <div className="space-y-4">
      <Tabs value={sub} onValueChange={setSub}>
        <TabsList>
          <TabsTrigger value="plan">Set Fee Plan</TabsTrigger>
          <TabsTrigger value="generate">Generate Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="plan" className="pt-4">
          <FeePlanManager academicYear={academicYear} />
        </TabsContent>
        <TabsContent value="generate" className="pt-4">
          <GenerateInvoices academicYear={academicYear} />
        </TabsContent>
      </Tabs>
    </div>
  );
}