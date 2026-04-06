import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, Search, RotateCcw } from 'lucide-react';
import QRCode from 'qrcode';

export default function StaffQRPrint() {
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrImages, setQrImages] = useState({});
  const [schoolName, setSchoolName] = useState('BVM School');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.StaffAccount.filter({ is_active: true }),
      base44.entities.SchoolProfile.list(),
    ]).then(async ([staff, profiles]) => {
      const validStaff = staff.filter(s => s.staff_code).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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

  const filtered = staffList.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.staff_code?.toLowerCase().includes(search.toLowerCase()) ||
    s.designation?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStaff = staffList.filter(s => selectedIds.has(s.id));

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
    setQrImages(prev => ({ ...prev, [staff.id]: url }));
  };

  const handlePrint = () => {
    if (selectedStaff.length === 0) {
      alert('Please select at least one staff member to print.');
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="no-print sticky top-0 z-40 bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Staff QR Code Cards</h1>
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:bg-white/20"
              />
            </div>
            
            <div className="flex gap-2 items-center">
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
                disabled={selectedStaff.length === 0}
                className="gap-2 bg-white text-[#1a237e] hover:bg-white/90"
              >
                <Printer className="h-4 w-4" />
                Print ({selectedStaff.length})
              </Button>
            </div>
          </div>
          <p className="text-white/70 text-xs mt-2">{staffList.length} total staff • {filtered.length} visible • {selectedStaff.length} selected</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded border border-gray-200">
            <p className="text-lg font-semibold text-gray-700">No active staff found</p>
            <p className="text-sm text-gray-500 mt-1">Add staff with Staff Code to see them here.</p>
          </div>
        ) : (
          <>
            {/* Staff List */}
            <div className="bg-white rounded border border-gray-200 mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Staff Code</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Designation</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(staff => (
                      <tr 
                        key={staff.id}
                        className={`border-b border-gray-200 hover:bg-gray-50 transition ${
                          selectedIds.has(staff.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(staff.id)}
                            onChange={() => toggleSelect(staff.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {staff.photo_url ? (
                              <img src={staff.photo_url} alt={staff.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs">
                                {staff.name?.charAt(0)?.toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-gray-900">{staff.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[#1a237e] font-bold">{staff.staff_code}</td>
                        <td className="px-4 py-3 text-gray-600">{staff.designation || '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => reissueQR(staff)}
                            className="text-red-600 hover:text-red-800 font-bold text-xs flex items-center gap-1 transition"
                            title="Reissue QR code"
                          >
                            <RotateCcw className="h-3 w-3" /> Reissue
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Preview Section */}
            {selectedStaff.length > 0 && (
              <div className="no-print mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Print Preview ({selectedStaff.length})</h2>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-[#1a237e] font-semibold underline hover:no-underline"
                  >
                    {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                </div>

                {showPreview && (
                  <div className="bg-white rounded border border-gray-200 p-4">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {selectedStaff.map(staff => (
                        <div
                          key={staff.id}
                          className="bg-white border-2 border-gray-300 rounded p-2 flex flex-col items-center text-center"
                          style={{ aspectRatio: '1' }}
                        >
                          {/* School Name */}
                          <p className="text-[7px] font-bold text-[#1a237e] uppercase tracking-wider mb-0.5">{schoolName}</p>

                          {/* Photo */}
                          {staff.photo_url ? (
                            <img src={staff.photo_url} alt={staff.name} className="w-8 h-8 rounded-full object-cover border border-[#1a237e] mb-0.5" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#e8eaf6] flex items-center justify-center border border-[#1a237e] mb-0.5">
                              <span className="text-[#1a237e] font-bold text-[9px]">{staff.name?.charAt(0)?.toUpperCase()}</span>
                            </div>
                          )}

                          {/* Name */}
                          <p className="font-semibold text-gray-900 text-[8px] leading-tight line-clamp-2">{staff.name}</p>

                          {/* Designation */}
                          <p className="text-[7px] text-gray-600 line-clamp-1">{staff.designation || 'Staff'}</p>

                          {/* Code */}
                          <p className="text-[7px] text-[#1a237e] font-bold mt-0.5">{staff.staff_code}</p>

                          {/* QR Code */}
                          {qrImages[staff.id] ? (
                            <img src={qrImages[staff.id]} alt="QR" className="w-12 h-12 mt-0.5" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 mt-0.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body, html { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          
          @page {
            size: A4;
            margin: 5mm;
          }
          
          main, .max-w-6xl { width: 100%; padding: 0; margin: 0; }
          
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5mm !important;
          }
        }
      `}</style>

      {/* Hidden Print Grid */}
      <div className="hidden print:block print-grid p-[5mm]">
        {selectedStaff.map(staff => (
          <div
            key={staff.id}
            className="bg-white border border-gray-300 rounded p-2 flex flex-col items-center text-center"
            style={{ pageBreakInside: 'avoid', aspectRatio: '1' }}
          >
            {/* School Name */}
            <p className="text-[9px] font-bold text-[#1a237e] uppercase tracking-wider mb-1">{schoolName}</p>

            {/* Photo */}
            {staff.photo_url ? (
              <img src={staff.photo_url} alt={staff.name} className="w-10 h-10 rounded-full object-cover border border-[#1a237e] mb-1" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#e8eaf6] flex items-center justify-center border border-[#1a237e] mb-1">
                <span className="text-[#1a237e] font-bold text-xs">{staff.name?.charAt(0)?.toUpperCase()}</span>
              </div>
            )}

            {/* Name */}
            <p className="font-semibold text-gray-900 text-[10px] leading-tight line-clamp-2">{staff.name}</p>

            {/* Designation */}
            <p className="text-[8px] text-gray-600">{staff.designation || 'Staff'}</p>

            {/* Code */}
            <p className="text-[9px] text-[#1a237e] font-bold mt-1">{staff.staff_code}</p>

            {/* QR Code */}
            {qrImages[staff.id] ? (
              <img src={qrImages[staff.id]} alt="QR" className="w-14 h-14 mt-1" />
            ) : (
              <div className="w-14 h-14 bg-gray-100 mt-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}