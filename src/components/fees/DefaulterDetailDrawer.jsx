import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DefaulterDetailDrawer({ row, academicYear, onClose, onFollowUpAdded }) {
  const [newFollowUp, setNewFollowUp] = useState({
    status: 'NEW',
    priority: '',
    note: '',
    next_followup_date: ''
  });
  const [showVoided, setShowVoided] = useState(false);
  const queryClient = useQueryClient();

  // Fetch detail
  const { data, isLoading } = useQuery({
    queryKey: ['defaulter-detail', row.student.id, academicYear],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDefaulterDetail', {
        studentId: row.student.id,
        academicYear: academicYear,
        includeVoided: showVoided.toString()
      });
      return res.data;
    }
  });

  // Create follow-up mutation
  const addFollowUpMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('createFollowUp', {
        student_id: row.student.id,
        academic_year: academicYear,
        status: newFollowUp.status,
        priority: newFollowUp.priority || null,
        note: newFollowUp.note.trim(),
        next_followup_date: newFollowUp.next_followup_date || null
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Follow-up added');
      setNewFollowUp({ status: 'NEW', priority: '', note: '', next_followup_date: '' });
      queryClient.invalidateQueries({ queryKey: ['defaulter-detail'] });
      onFollowUpAdded?.();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to add follow-up';
      toast.error(msg);
    }
  });

  if (isLoading) {
    return (
      <Sheet open onOpenChange={onClose}>
        <SheetContent className="w-full sm:w-[600px] max-h-screen overflow-y-auto">
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const student = data?.student || {};
  const financial = data?.financialSummary || {};
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const followUps = data?.followUps || [];

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[600px] max-h-screen overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{student.name}</SheetTitle>
          <p className="text-sm text-gray-600">{student.admissionNo} · {student.className}</p>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Total:</span>
                  <span className="font-medium">₹{(financial.gross || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium">₹{(financial.discount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Net Amount:</span>
                  <span className="font-medium">₹{(financial.net || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid:</span>
                  <span className="font-medium">₹{(financial.paid || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-red-600">
                  <span className="font-semibold">Outstanding:</span>
                  <span className="font-bold">₹{(financial.due || 0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <p className="font-medium">{student.phone1 || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <p className="font-medium">{student.email || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.map((inv, idx) => (
                  <div key={idx} className="border rounded p-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{inv.installment}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : inv.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Net: ₹{(inv.net || 0).toLocaleString()}</span>
                      <span>Paid: ₹{(inv.paid || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="showVoided"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="showVoided" className="text-sm text-gray-600">Show Voided (Audit)</label>
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No payments recorded</p>
            ) : (
              <div className="space-y-3">
                {payments.map((p, idx) => (
                  <Card key={idx} className={p.voided ? 'opacity-60' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-sm">#{p.receiptNo}</p>
                          <p className="text-xs text-gray-600">{p.date} · {p.mode}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₹{(p.amount || 0).toLocaleString()}</p>
                          {p.voided && <span className="text-xs text-red-600 font-semibold">VOID</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Follow-ups Tab */}
          <TabsContent value="followups" className="space-y-4">
            <div className="space-y-3 mb-6">
              {followUps.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No follow-ups yet</p>
              ) : (
                followUps.map((fu, idx) => (
                  <Card key={idx} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {fu.status}
                          </span>
                          {fu.priority && (
                            <span className="ml-2 inline-block px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                              {fu.priority}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{fu.createdAt?.split('T')[0]}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{fu.note}</p>
                      {fu.nextFollowUpDate && (
                        <p className="text-xs text-gray-600">Next: {fu.nextFollowUpDate}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Add Follow-up Form */}
            <Card className="bg-gray-50 border-2 border-dashed">
              <CardHeader>
                <CardTitle className="text-sm">Add Follow-up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Status *</label>
                  <Select value={newFollowUp.status} onValueChange={(v) => setNewFollowUp({ ...newFollowUp, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="CALLED">Called</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                      <SelectItem value="PROMISED">Promised</SelectItem>
                      <SelectItem value="PAID_PARTIAL">Paid Partial</SelectItem>
                      <SelectItem value="PAID_FULL">Paid Full</SelectItem>
                      <SelectItem value="DO_NOT_CALL">Do Not Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Priority</label>
                  <Select value={newFollowUp.priority} onValueChange={(v) => setNewFollowUp({ ...newFollowUp, priority: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Next Follow-up Date</label>
                  <Input
                    type="date"
                    value={newFollowUp.next_followup_date}
                    onChange={(e) => setNewFollowUp({ ...newFollowUp, next_followup_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Note *</label>
                  <Textarea
                    placeholder="e.g. Called, promised payment by end of week..."
                    value={newFollowUp.note}
                    onChange={(e) => setNewFollowUp({ ...newFollowUp, note: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!newFollowUp.note.trim() || addFollowUpMutation.isPending}
                  onClick={() => addFollowUpMutation.mutate()}
                >
                  {addFollowUpMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Follow-up'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}