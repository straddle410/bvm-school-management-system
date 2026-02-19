import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Download, Search, Printer } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function IDCard({ student, school }) {
  return (
    <div
      className="relative bg-white rounded-xl overflow-hidden shadow-lg"
      style={{ width: 280, minHeight: 170, border: '2px solid #1a237e' }}
    >
      {/* Top stripe */}
      <div className="h-8 w-full flex items-center justify-between px-3" style={{ background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)' }}>
        {school?.logo_url && (
          <img src={school.logo_url} alt="Logo" className="h-5 w-5 object-contain rounded" />
        )}
        <p className="text-white text-[9px] font-bold text-center flex-1 truncate px-1">
          {school?.school_name || 'BVM School of Excellence'}
        </p>
        <div className="w-5" />
      </div>
      
      {/* Yellow banner */}
      <div className="bg-yellow-400 text-center py-0.5">
        <p className="text-[8px] font-bold text-gray-900 uppercase tracking-wider">Student Identity Card</p>
      </div>
      
      {/* Content */}
      <div className="p-3 flex gap-3">
        {/* Photo */}
        <div className="flex-shrink-0">
          <div
            className="rounded-lg overflow-hidden border-2 border-[#1a237e]"
            style={{ width: 56, height: 64 }}
          >
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-50 flex items-center justify-center text-[#1a237e] font-bold text-xl">
                {student.name?.[0] || 'S'}
              </div>
            )}
          </div>
        </div>
        
        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#1a237e] text-xs leading-tight truncate">{student.name}</p>
          <div className="mt-1 space-y-0.5">
            <InfoRow label="ID" value={student.student_id || student.id?.slice(0, 8).toUpperCase()} />
            <InfoRow label="Class" value={`${student.class_name}-${student.section}`} />
            <InfoRow label="Roll" value={student.roll_no || '-'} />
            <InfoRow label="Year" value={student.academic_year || '2024-25'} />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="bg-[#1a237e] px-3 py-1.5 flex items-center justify-between">
        <div>
          {school?.phone && (
            <p className="text-[8px] text-blue-200">{school.phone}</p>
          )}
          {school?.website && (
            <p className="text-[8px] text-blue-200">{school.website}</p>
          )}
        </div>
        <div className="h-8 w-8 bg-white rounded flex items-center justify-center">
          <p className="text-[6px] text-center text-gray-600 font-bold leading-tight">QR<br/>CODE</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-1">
      <span className="text-[9px] text-gray-500 w-8 flex-shrink-0">{label}:</span>
      <span className="text-[9px] font-semibold text-gray-800 truncate">{value}</span>
    </div>
  );
}

export default function IDCards() {
  const [filterClass, setFilterClass] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const printRef = useRef();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-published'],
    queryFn: () => base44.entities.Student.filter({ status: 'Published' })
  });

  const { data: schoolProfiles = [] } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list()
  });

  const school = schoolProfiles[0];

  const filtered = students.filter(s => {
    const matchClass = filterClass === 'all' || s.class_name === filterClass;
    const matchSection = filterSection === 'all' || s.section === filterSection;
    const matchSearch = !searchQuery || s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchClass && matchSection && matchSearch;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="ID Cards">
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b px-4 py-4 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1a237e]" />
              <h1 className="font-bold text-gray-900">ID Card Generator</h1>
            </div>
            <Button onClick={handlePrint} className="bg-[#1a237e] hover:bg-[#283593] text-sm">
              <Printer className="mr-2 h-4 w-4" />
              Print All ({filtered.length})
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {['A', 'B', 'C', 'D'].map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">Loading students...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-gray-500">No published students found</p>
              <p className="text-xs text-gray-400 mt-1">Only Published students appear here</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{filtered.length} ID cards</p>
              <div
                ref={printRef}
                className="flex flex-wrap gap-4"
                id="id-cards-print"
              >
                {filtered.map(student => (
                  <IDCard key={student.id} student={student} school={school} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #id-cards-print, #id-cards-print * { visibility: visible; }
          #id-cards-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </LoginRequired>
  );
}