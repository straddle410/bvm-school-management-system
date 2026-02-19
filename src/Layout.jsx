import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  ClipboardCheck, FileText, Image, HelpCircle, Settings, LogOut,
  Menu, X, ChevronDown, Bell, School, UserPlus, Award, Clock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', roles: ['admin', 'principal', 'teacher', 'staff'] },
  { name: 'Students', icon: GraduationCap, page: 'Students', roles: ['admin', 'principal', 'teacher', 'staff'] },
  { name: 'Teachers', icon: Users, page: 'Teachers', roles: ['admin', 'principal'] },
  { name: 'Attendance', icon: ClipboardCheck, page: 'Attendance', roles: ['admin', 'principal', 'teacher'] },
  { name: 'Exams & Marks', icon: BookOpen, page: 'Marks', roles: ['admin', 'principal', 'teacher'] },
  { name: 'Admissions', icon: UserPlus, page: 'Admissions', roles: ['admin', 'principal'] },
  { name: 'Gallery', icon: Image, page: 'Gallery', roles: ['admin', 'principal', 'teacher', 'staff', 'student', 'parent'] },
  { name: 'Daily Quiz', icon: HelpCircle, page: 'Quiz', roles: ['admin', 'principal', 'teacher', 'student'] },
  { name: 'Calendar', icon: Calendar, page: 'Calendar', roles: ['admin', 'principal', 'teacher', 'staff', 'student', 'parent'] },
  { name: 'Reports', icon: FileText, page: 'Reports', roles: ['admin', 'principal'] },
  { name: 'Approvals', icon: Clock, page: 'Approvals', roles: ['admin', 'principal'] },
  { name: 'Settings', icon: Settings, page: 'Settings', roles: ['admin'] },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, profiles] = await Promise.all([
        base44.auth.me(),
        base44.entities.SchoolProfile.list()
      ]);
      setUser(currentUser);
      if (profiles.length > 0) {
        setSchoolProfile(profiles[0]);
      }
    } catch (e) {
      console.log('Not logged in');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const userRole = user?.role || 'user';
  const filteredNav = navItems.filter(item => item.roles.includes(userRole));

  // Public pages that don't need layout
  if (['PublicAdmission', 'Login'].includes(currentPageName)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-2">
          {schoolProfile?.logo_url ? (
            <img src={schoolProfile.logo_url} alt="Logo" className="h-8 w-8 object-contain" />
          ) : (
            <School className="h-8 w-8 text-blue-600" />
          )}
          <span className="font-bold text-blue-900">
            {schoolProfile?.school_name || 'BVM School'}
          </span>
        </div>
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.photo_url} />
          <AvatarFallback className="bg-blue-100 text-blue-700">
            {user?.full_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {schoolProfile?.logo_url ? (
                  <img src={schoolProfile.logo_url} alt="Logo" className="h-12 w-12 object-contain" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <School className="h-7 w-7 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="font-bold text-blue-900 leading-tight">
                    {schoolProfile?.school_name || 'BVM School'}
                  </h1>
                  <p className="text-xs text-slate-500">
                    {schoolProfile?.academic_year || '2024-25'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {filteredNav.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : ''}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.photo_url} />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {user?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 capitalize">{userRole}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('Profile')} className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen">
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}