import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function RbacTest() {
  const [user, setUser] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const { academicYear } = useAcademicYear();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (err) {
      console.error('Failed to load user:', err);
    }
  };

  const runTests = async () => {
    setLoading(true);
    setTests([]);
    setSummary(null);

    const results = [];
    const testFunctions = [
      {
        name: 'getStudentLedger',
        payload: { studentId: 'S001', academicYear: academicYear || '2025-26' },
        expectedRoles: ['admin', 'principal', 'accountant']
      },
      {
        name: 'getOutstandingReport',
        payload: { academicYear: academicYear || '2025-26' },
        expectedRoles: ['admin', 'principal', 'accountant']
      },
      {
        name: 'recordFeePayment',
        payload: {
          invoiceId: 'fake_invoice',
          amountPaid: 100,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: 'Cash'
        },
        expectedRoles: ['admin', 'principal', 'accountant']
      },
      {
        name: 'generateProgressCards',
        payload: { academicYear: academicYear || '2025-26' },
        expectedRoles: ['admin', 'principal']
      },
      {
        name: 'getCollectionByClass',
        payload: { academicYear: academicYear || '2025-26' },
        expectedRoles: ['admin', 'principal', 'accountant']
      }
    ];

    const userRole = (user?.role || '').toLowerCase();
    const isAuthorized = testFunctions[0].expectedRoles.includes(userRole);

    for (const test of testFunctions) {
      try {
        const response = await base44.functions.invoke(test.name, test.payload);
        
        // Function succeeded (200 or 2xx)
        const result = {
          name: test.name,
          status: response.status || 200,
          result: isAuthorized ? 'PASS ✓' : 'FAIL ✗ (Unauthorized role succeeded)',
          resultType: isAuthorized ? 'pass' : 'fail'
        };
        results.push(result);
      } catch (err) {
        const status = err.response?.status || err.status || 500;
        const message = err.response?.data?.error || err.message || 'Unknown error';

        // Determine pass/fail based on role and status
        let resultType = 'fail';
        let resultText = '';

        if (status === 403) {
          // 403 is expected for unauthorized roles
          resultType = isAuthorized ? 'fail' : 'pass';
          resultText = isAuthorized ? 'FAIL ✗ (Unauthorized 403)' : 'PASS ✓ (Correctly blocked)';
        } else if (status === 400 || status === 404) {
          // 400/404 is OK for authorized roles (data validation/not found, not permission)
          resultType = isAuthorized ? 'pass' : 'fail';
          resultText = isAuthorized ? 'PASS ✓ (Authorized, non-permission error)' : 'FAIL ✗ (Bad request error)';
        } else {
          // Other errors
          resultType = 'fail';
          resultText = `FAIL ✗ (Status ${status})`;
        }

        const result = {
          name: test.name,
          status,
          result: resultText,
          resultType,
          message
        };
        results.push(result);
      }
    }

    const passCount = results.filter(r => r.resultType === 'pass').length;
    const failCount = results.filter(r => r.resultType === 'fail').length;

    setTests(results);
    setSummary({
      total: results.length,
      passed: passCount,
      failed: failCount,
      overall: failCount === 0 ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'
    });

    setLoading(false);
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="RBAC Test">
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>RBAC Security Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Role</p>
                    <p className="font-semibold capitalize">{user.role || 'unknown'}</p>
                  </div>
                </div>
              )}

              <Button 
                onClick={runTests} 
                disabled={loading}
                className="w-full bg-[#1a237e] hover:bg-[#283593]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  'Run Tests'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Summary */}
          {summary && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold">{summary.total}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-600">Passed</p>
                    <p className="text-2xl font-bold text-green-600">{summary.passed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-red-600">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Result</p>
                    <p className={`text-lg font-bold ${summary.failed === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.overall}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Table */}
          {tests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Function</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">HTTP Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Result</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tests.map((test, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{test.name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded font-mono text-xs ${
                              test.status === 200 ? 'bg-green-100 text-green-800' :
                              test.status === 403 ? 'bg-blue-100 text-blue-800' :
                              test.status >= 400 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {test.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {test.resultType === 'pass' ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  <span className="text-green-600 font-semibold">{test.result}</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  <span className="text-red-600 font-semibold">{test.result}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs">
                            {test.message && (
                              <div className="flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="break-words">{test.message}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Legend */}
          {tests.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">PASS Criteria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Admin/Principal/Accountant roles:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
                  <li>Functions return 200 → <span className="text-green-600 font-semibold">PASS</span></li>
                  <li>Functions return 400/404 (data validation error) → <span className="text-green-600 font-semibold">PASS</span></li>
                  <li>Functions return 403 → <span className="text-red-600 font-semibold">FAIL</span></li>
                </ul>
                <p className="mt-4"><strong>Teacher role:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
                  <li>Functions return 403 → <span className="text-green-600 font-semibold">PASS</span></li>
                  <li>Functions return 200 → <span className="text-red-600 font-semibold">FAIL</span></li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LoginRequired>
  );
}