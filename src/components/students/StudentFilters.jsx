import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function StudentFilters({ search, onSearch, filterClass, onFilterClass, filterSection, onFilterSection, filterStatus, onFilterStatus }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name or Student ID..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-9 rounded-xl border-gray-200 bg-gray-50"
        />
      </div>
      <Select value={filterClass} onValueChange={onFilterClass}>
        <SelectTrigger className="w-full sm:w-36 rounded-xl border-gray-200 bg-gray-50">
          <SelectValue placeholder="All Classes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Classes</SelectItem>
          {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterSection} onValueChange={onFilterSection}>
        <SelectTrigger className="w-full sm:w-32 rounded-xl border-gray-200 bg-gray-50">
          <SelectValue placeholder="Section" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sections</SelectItem>
          {SECTIONS.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={onFilterStatus}>
        <SelectTrigger className="w-full sm:w-36 rounded-xl border-gray-200 bg-gray-50">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="Pending">Pending</SelectItem>
          <SelectItem value="Verified">Verified</SelectItem>
          <SelectItem value="Approved">Approved</SelectItem>
          <SelectItem value="Published">Active</SelectItem>
          <SelectItem value="Passed Out">Passed Out</SelectItem>
          <SelectItem value="Transferred">Transferred</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}