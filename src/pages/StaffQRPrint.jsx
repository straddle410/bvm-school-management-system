import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, Download, Search } from 'lucide-react';
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

      // Ensure every staff member has a qr_token
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

      // Generate QR images
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

  const selectedStaff = filtered.filter(s => selectedIds.has(s.id));

  const handlePrint = () => {
    if (selectedStaff.length === 0) {
      alert('Please select at least one staff member.');
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="no-print sticky top-0 z-40 bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Staff QR Code Cards</h1>
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search by name, code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg pl-10 pr-3 py-2 text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <label className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded border border-white/20 cursor-pointer hover:bg-white/20">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Select All</span>
              </label>
              <Button 
                onClick={handlePrint}
                disabled={selectedStaff.length === 0}
                className="gap-2 bg-white text-[#1a237e] hover:bg-white/90"
              >
                <Printer className="h-4 w-4" />
                Print ({selectedStaff.length})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-semibold">No staff found</p>
            <p className="text-sm mt-1">Make sure staff members have Staff Code and is_active enabled.</p>
          </div>
        ) : (
          <>
            {/* Print Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 print-grid">
              {selectedStaff.map(staff => (
                <div
                  key={staff.id}
                  className="bg-white border border-gray-300 rounded p-3 flex flex-col items-center text-center shadow-sm relative"
                  style={{ pageBreakInside: 'avoid', aspectRatio: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  {/* Checkbox */}
                  <label className="absolute top-2 right-2 no-print cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(staff.id)}
                      onChange={() => toggleSelect(staff.id)}
                      className="w-4 h-4"
                    />
                  </label>

                  {/* School Name (tiny) */}
                  <p className="text-[9px] font-bold text-[#1a237e] uppercase tracking-wide mb-1">{schoolName}</p>

                  {/* Photo */}
                  {staff.photo_url ? (
                    <img src={staff.photo_url} alt={staff.name} className="w-12 h-12 rounded-full object-cover border border-[#1a237e] mb-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#e8eaf6] flex items-center justify-center border border-[#1a237e] mb-1">
                      <span className="text-[#1a237e] font-bold text-sm">{staff.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                  )}

                  {/* Name */}
                  <p className="font-semibold text-gray-900 text-[11px] leading-tight break-words line-clamp-2">{staff.name}</p>

                  {/* Designation */}
                  <p className="text-[8px] text-gray-600">{staff.designation || 'Staff'}</p>

                  {/* Code */}
                  <p className="text-[9px] text-[#1a237e] font-bold mt-0.5">{staff.staff_code}</p>

                  {/* QR Code */}
                  {qrImages[staff.id] ? (
                    <img src={qrImages[staff.id]} alt="QR" className="w-16 h-16 mt-1 border border-gray-300" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 mt-1 flex items-center justify-center">
                      <span className="text-[8px] text-gray-400">...</span>
                    </div>
                  )}

                  {/* Reissue Button */}
                  <button
                    onClick={() => reissueQR(staff)}
                    className="no-print text-[8px] text-red-600 underline hover:text-red-800 font-bold mt-0.5"
                  >
                    Reissue
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          body, html { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          main, .p-4, .max-w-7xl { margin: 0; padding: 0; }
          
          @page {
            size: A4;
            margin: 5mm;
          }
          
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4mm !important;
            padding: 5mm !important;
          }
        }
      `}</style>
    </div>
  );
}