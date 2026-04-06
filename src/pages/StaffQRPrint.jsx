import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, Search } from 'lucide-react';
import QRCode from 'qrcode';

export default function StaffQRPrint() {
  const [staffList, setStaffList] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrImages, setQrImages] = useState({});
  const [schoolName, setSchoolName] = useState('BVM School');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    Promise.all([
      base44.entities.StaffAccount.filter({ is_active: true }),
      base44.entities.SchoolProfile.list(),
    ]).then(async ([staff, profiles]) => {
      const validStaff = staff.filter(s => s.staff_code);

      // Ensure every staff member has qr_token
      const updatedStaff = await Promise.all(validStaff.map(async (s) => {
        if (!s.qr_token) {
          const token = crypto.randomUUID();
          await base44.entities.StaffAccount.update(s.id, { qr_token: token });
          return { ...s, qr_token: token };
        }
        return s;
      }));

      setStaffList(updatedStaff);
      setFiltered(updatedStaff);
      if (profiles?.[0]?.school_name) setSchoolName(profiles[0].school_name);

      // Generate QR codes
      const entries = await Promise.all(updatedStaff.map(async (s) => {
        const url = await QRCode.toDataURL(`${s.staff_code}|${s.qr_token}`, {
          width: 150,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        return [s.id, url];
      }));
      setQrImages(Object.fromEntries(entries));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(staffList.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.staff_code?.toLowerCase().includes(q) ||
      s.designation?.toLowerCase().includes(q)
    ));
  }, [search, staffList]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  const reissueQR = async (staff) => {
    const token = crypto.randomUUID();
    await base44.entities.StaffAccount.update(staff.id, { qr_token: token });
    const url = await QRCode.toDataURL(`${staff.staff_code}|${token}`, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, qr_token: token } : s));
    setFiltered(prev => prev.map(s => s.id === staff.id ? { ...s, qr_token: token } : s));
    setQrImages(prev => ({ ...prev, [staff.id]: url }));
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one staff member to print.');
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <style>{`
        @media print {
          * { margin: 0; padding: 0; }
          body, html { background: white; }
          
          .no-print { display: none !important; }
          .staff-card:not(.selected) { display: none !important; }
          
          @page {
            size: A4;
            margin: 8mm;
          }
          
          .grid-container {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 3mm !important;
            width: 100% !important;
          }
          
          .staff-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 6mm !important;
            width: 100% !important;
            height: auto !important;
            border: 0.5pt solid #999 !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            gap: 2mm !important;
          }
          
          .checkbox-col { display: none !important; }
          .staff-card p { margin: 0 !important; }
          .staff-card img { margin: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print sticky top-0 z-40 bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-3">Staff QR Code Cards</h1>
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search by name, code, designation..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <label className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded border border-white/20 cursor-pointer hover:bg-white/20 transition">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm font-medium">Select All</span>
              </label>
              <Button 
                onClick={handlePrint}
                disabled={selectedIds.size === 0}
                className="gap-2 bg-white text-[#1a237e] hover:bg-white/90"
              >
                <Printer className="h-4 w-4" />
                Print ({selectedIds.size})
              </Button>
            </div>
          </div>

          {filtered.length > 0 && (
            <p className="text-white/70 text-sm mt-2">
              Showing {filtered.length} staff | Selected: {selectedIds.size}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-semibold">No staff found</p>
            <p className="text-sm mt-1">Make sure staff members have Staff Code assigned and is_active enabled.</p>
          </div>
        ) : (
          <div className="grid-container grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(staff => (
              <div
                key={staff.id}
                className={`staff-card rounded-lg border-2 p-4 shadow-sm transition-all cursor-pointer ${
                  selectedIds.has(staff.id)
                    ? 'selected border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                onClick={() => toggleSelect(staff.id)}
              >
                {/* Checkbox */}
                <div className="checkbox-col w-full flex justify-end mb-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(staff.id)}
                    onChange={e => {
                      e.stopPropagation();
                      toggleSelect(staff.id);
                    }}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                {/* School Badge */}
                <div className="text-[10px] font-bold text-[#1a237e] uppercase tracking-widest bg-[#e8eaf6] px-2 py-1 rounded-full">
                  {schoolName.split(' ')[0]}
                </div>

                {/* Photo */}
                <div className="mt-3 mb-2">
                  {staff.photo_url ? (
                    <img 
                      src={staff.photo_url} 
                      alt={staff.name} 
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#1a237e] mx-auto"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e8eaf6] to-[#c5cae9] flex items-center justify-center border-2 border-[#1a237e] mx-auto">
                      <span className="text-[#1a237e] font-bold text-lg">
                        {staff.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <p className="font-bold text-gray-900 text-sm leading-snug break-words line-clamp-2">
                  {staff.name}
                </p>

                {/* Designation */}
                <p className="text-xs text-gray-600 mb-2">
                  {staff.designation || staff.role || 'Staff'}
                </p>

                {/* Staff Code */}
                <p className="text-xs font-semibold text-[#1a237e] bg-gray-100 px-2 py-1 rounded mb-2">
                  {staff.staff_code}
                </p>

                {/* QR Code */}
                <div className="bg-white border border-gray-300 rounded p-2 mb-2">
                  {qrImages[staff.id] ? (
                    <img 
                      src={qrImages[staff.id]} 
                      alt={`QR for ${staff.name}`} 
                      className="w-20 h-20"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-400">Loading...</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reissueQR(staff);
                  }}
                  className="no-print text-xs text-red-600 hover:text-red-800 font-semibold underline"
                >
                  Reissue QR
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}