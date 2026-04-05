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

  useEffect(() => {
    Promise.all([
      base44.entities.StaffAccount.filter({ is_active: true }),
      base44.entities.SchoolProfile.list(),
    ]).then(([staff, profiles]) => {
      const validStaff = staff.filter(s => s.staff_code);
      setStaffList(validStaff);
      setFiltered(validStaff);
      if (profiles?.[0]?.school_name) setSchoolName(profiles[0].school_name);

      // Generate QR codes for all staff
      const promises = validStaff.map(async (s) => {
        const url = await QRCode.toDataURL(s.staff_code, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        return [s.id, url];
      });
      Promise.all(promises).then(entries => {
        setQrImages(Object.fromEntries(entries));
      });
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

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Controls — hidden on print */}
      <div className="no-print bg-[#1a237e] text-white px-4 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Staff QR Code Cards</h1>
          <p className="text-white/70 text-sm">Print and distribute to staff for kiosk attendance</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 w-48"
            />
          </div>
          <Button onClick={handlePrint} className="bg-white text-[#1a237e] hover:bg-white/90 gap-2">
            <Printer className="h-4 w-4" />
            Print All ({filtered.length})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p className="text-lg font-semibold">No staff found</p>
          <p className="text-sm mt-1">Make sure staff members have a Staff Code assigned.</p>
        </div>
      ) : (
        <div className="p-4">
          {/* Staff without staff_code warning */}
          {staffList.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-yellow-800 text-sm">
              ⚠️ No staff members have a Staff Code assigned. Please add staff codes in Staff management first.
            </div>
          )}

          {/* Print grid */}
          <div
            id="print-area"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          >
            {filtered.map(staff => (
              <div
                key={staff.id}
                className="bg-white rounded-xl border-2 border-[#1a237e] p-4 flex flex-col items-center text-center shadow print-card"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {/* School name */}
                <p className="text-[10px] font-bold text-[#1a237e] uppercase tracking-wide mb-1">{schoolName}</p>

                {/* Staff photo or avatar */}
                {staff.photo_url ? (
                  <img src={staff.photo_url} alt={staff.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#1a237e] mb-2" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#e8eaf6] flex items-center justify-center mb-2 border-2 border-[#1a237e]">
                    <span className="text-[#1a237e] font-bold text-lg">
                      {staff.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}

                {/* Name & designation */}
                <p className="font-bold text-gray-900 text-sm leading-tight">{staff.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{staff.designation || staff.role || 'Staff'}</p>
                <p className="text-xs text-[#1a237e] font-semibold mt-0.5">Code: {staff.staff_code}</p>

                {/* QR Code */}
                <div className="mt-3 p-1 border border-gray-200 rounded-lg">
                  {qrImages[staff.id] ? (
                    <img src={qrImages[staff.id]} alt={`QR for ${staff.name}`} className="w-24 h-24" />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                      Generating...
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Scan at kiosk to check in</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #print-area {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            padding: 8px !important;
          }
          .print-card {
            border: 2px solid #1a237e !important;
            padding: 8px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}