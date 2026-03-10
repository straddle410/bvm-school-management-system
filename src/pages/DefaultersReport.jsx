import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Eye, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';
import { useAcademicYear } from '@/components/AcademicYearContext';
import DefaulterDetailDrawer from '@/components/fees/DefaulterDetailDrawer';

export default function DefaultersReportPage() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({
    className: '',
    section: '',
    minDue: 1,
    daysSinceLastPaymentMin: '',
    status: '',
    search: ''
  });
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch defaulters
  const { data, isLoading, error } = useQuery({
    queryKey: ['defaulters', academicYear, filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        academicYear: academicYear,
        page: page.toString(),
        pageSize: '50',
        minDue: filters.minDue.toString(),
        ...(filters.className && { className: filters.className }),
        ...(filters.section && { section: filters.section }),
        ...(filters.daysSinceLastPaymentMin !== undefined && filters.daysSinceLastPaymentMin !== '' && { daysSinceLastPaymentMin: filters.daysSinceLastPaymentMin }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search })
      });

      const res = await base44.functions.invoke('getDefaultersReport', { ...Object.fromEntries(params) });
      return res.data;
    }
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        academicYear: academicYear,
        ...(filters.className && { className: filters.className }),
        ...(filters.section && { section: filters.section }),
        ...(filters.minDue && { minDue: filters.minDue.toString() }),
        ...(filters.search && { search: filters.search })
      });

      const res = await base44.functions.invoke('exportDefaultersReport', { ...Object.fromEntries(params) });
      
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defaulters_${academicYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Defaulters report exported');
    } catch (err) {
      toast.error('Failed to export report');
      console.error(err);
    }
  };

  const handleOpenDetail = (row) => {
    setSelectedStudent(row);
    setIsDetailOpen(true);
  };

  const copyPhone = (phone) => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success('Phone copied to clipboard');
    }
  };

  const openWhatsApp = (phone) => {
    if (phone) {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Defaulters Report">
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </LoginRequired>
    );
  }

  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const meta = data?.meta || {};

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Defaulters Report">
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Defaulters Report</h1>
            <p className="text-gray-600">Track students with outstanding fees for follow-up</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Due</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">₹{(summary.totalDue || 0).toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{summary.countStudents || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Never Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{summary.countNeverPaid || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">No Payment (90+ days)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{summary.countNoPayment90Days || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
                <Input
                  placeholder="Min Due (₹)"
                  type="number"
                  value={filters.minDue}
                  onChange={(e) => { setFilters({ ...filters, minDue: parseInt(e.target.value) || 0 }); setPage(1); }}
                />
                <Input
                  placeholder="Days Since Last Payment"
                  type="number"
                  value={filters.daysSinceLastPaymentMin}
                  onChange={(e) => { setFilters({ ...filters, daysSinceLastPaymentMin: e.target.value }); setPage(1); }}
                />
                <Select value={filters.status} onValueChange={(v) => { setFilters({ ...filters, status: v }); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Follow-up Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="CALLED">Called</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                    <SelectItem value="PROMISED">Promised</SelectItem>
                    <SelectItem value="DO_NOT_CALL">Do Not Call</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search name/phone"
                  value={filters.search}
                  onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
                />
                <Button variant="outline" onClick={() => { setFilters({ className: '', section: '', minDue: 1, daysSinceLastPaymentMin: '', status: '', search: '' }); setPage(1); }}>
                  Reset
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Student</th>
                      <th className="px-4 py-3 text-left font-semibold">Class</th>
                      <th className="px-4 py-3 text-right font-semibold">Due</th>
                      <th className="px-4 py-3 text-left font-semibold">Last Payment</th>
                      <th className="px-4 py-3 text-center font-semibold">Days Since</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold">Follow-up Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-6 text-center text-gray-500">
                          No defaulters found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={idx} className={`border-b hover:bg-gray-50 ${row.daysSinceLastPayment !== null && row.daysSinceLastPayment >= 90 ? 'bg-orange-50' : ''}`}>
                          <td className="px-4 py-3 font-medium">{row.student.name}</td>
                          <td className="px-4 py-3">{row.class.name}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">₹{(row.due || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm">{row.lastPaymentDate || 'Never'}</td>
                          <td className="px-4 py-3 text-center text-sm">{row.daysSinceLastPayment !== null ? row.daysSinceLastPayment : 'N/A'}</td>
                          <td className="px-4 py-3">
                            {row.phone1 ? (
                              <button
                                onClick={() => copyPhone(row.phone1)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                {row.phone1}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {row.latestFollowUp ? (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                {row.latestFollowUp.status}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">No follow-up</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleOpenDetail(row)}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {row.phone1 && (
                                <button
                                  onClick={() => openWhatsApp(row.phone1)}
                                  className="text-green-600 hover:bg-green-50 p-1 rounded"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        {isDetailOpen && (
          <DefaulterDetailDrawer
            row={selectedStudent}
            academicYear={academicYear}
            onClose={() => setIsDetailOpen(false)}
            onFollowUpAdded={() => {
              queryClient.invalidateQueries({ queryKey: ['defaulters'] });
              setIsDetailOpen(false);
            }}
          />
        )}
      </div>
    </LoginRequired>
  );
}