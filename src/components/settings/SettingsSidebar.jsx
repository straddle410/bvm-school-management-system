import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const MENU_GROUPS = [
  {
    label: 'School',
    items: [
      { id: 'school-profile', label: 'School Profile', requiredRoles: ['admin', 'principal'] },
      { id: 'academic-years', label: 'Academic Years', requiredRoles: ['admin', 'principal'] },
      { id: 'transport', label: 'Transport', requiredRoles: ['admin', 'principal'] },
    ],
  },
  {
    label: 'Academics',
    items: [
      { id: 'subjects', label: 'Subjects', requiredRoles: ['admin', 'principal'] },
      { id: 'class-subjects', label: 'Class Subjects', requiredRoles: ['admin', 'principal'] },
      { id: 'class-sections', label: 'Class Sections', requiredRoles: ['admin', 'principal'] },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'notifications', label: 'Notifications', requiredRoles: ['admin', 'principal'] },
      { id: 'banners', label: 'Banners', requiredRoles: ['admin', 'principal'] },
    ],
  },
  {
    label: 'Fees',
    items: [
      { id: 'fees-backup', label: 'Fees Backup', requiredRoles: ['admin', 'principal', 'accountant'] },
    ],
  },
  {
    label: 'Backups',
    items: [
      { id: 'full-backup', label: 'Full School Backup', requiredRoles: ['admin', 'principal'] },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'data-reset', label: 'Data Reset', requiredRoles: ['admin', 'principal'], isDanger: true },
    ],
  },
];

export default function SettingsSidebar({ activeItem, onItemSelect, userRole, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter menu items based on user role and search query
  const filteredGroups = useMemo(() => {
    return MENU_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        const hasRole = item.requiredRoles.includes(userRole || 'user');
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
        return hasRole && matchesSearch;
      }),
    })).filter(group => group.items.length > 0);
  }, [searchQuery, userRole]);

  const handleItemClick = (itemId) => {
    onItemSelect(itemId);
    if (onClose) onClose(); // Close drawer on mobile
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Search */}
      <div className="p-4 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search settings…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Menu Groups */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {filteredGroups.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-8">No settings found</div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeItem === item.id
                        ? 'bg-white text-slate-900 border border-slate-300 shadow-sm'
                        : `text-slate-600 hover:bg-white/50 ${item.isDanger ? 'hover:text-red-600' : 'hover:text-slate-900'}`
                    } ${item.isDanger ? 'text-red-600' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
    </div>
  );
}