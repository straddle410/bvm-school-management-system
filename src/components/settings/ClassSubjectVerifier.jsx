import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function ClassSubjectVerifier() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('verifyAndCleanupClassSubjectMapping', {});
      
      if (response.data?.success) {
        setResult(response.data);
        toast.success(`✓ Verified and cleaned: ${response.data.message}`);
      } else {
        toast.error('Verification failed');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-amber-900 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Class Subject Verification Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-800">
          This tool checks if all subjects in Class Subject Mapping exist in Subject Management. 
          Any orphaned subjects will be automatically removed.
        </p>
        
        <Button 
          onClick={handleVerify}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Zap className="h-4 w-4 mr-2" />
          {loading ? 'Running verification...' : 'Run Verification & Cleanup'}
        </Button>

        {result && (
          <div className="space-y-3 mt-4 p-3 bg-white rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <strong>{result.message}</strong>
            </div>

            {result.cleaned_configs > 0 && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <p className="font-medium text-green-900 mb-2">✓ Cleaned Configs:</p>
                {result.cleaned_configs && (
                  <p className="text-sm text-green-800">
                    Updated {result.cleaned_configs} class configuration(s)
                  </p>
                )}
              </div>
            )}

            {Object.keys(result.orphaned_details || {}).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="font-medium text-red-900 mb-2">🗑️ Removed Orphaned Subjects:</p>
                {Object.entries(result.orphaned_details).map(([classYear, subjects]) => (
                  <p key={classYear} className="text-sm text-red-800">
                    <strong>{classYear}:</strong> {subjects.join(', ')}
                  </p>
                ))}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="font-medium text-blue-900 mb-2">📋 All Subjects in Management:</p>
              <div className="flex flex-wrap gap-1">
                {result.all_subjects?.map(s => (
                  <span key={s} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}