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
  const [selectedIds, setSelectedIds] = useState([]);

  // Generate QR payload: staff_code|qr_token
  const buildQRPayload = (staff_code, qr_token) => `${staff_code}|${qr_token}`;

  const generateQRImage = async (staff_code, qr_token) => {
    return QRCode.toDataURL(buildQRPayload(staff_code, qr_token), {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
  };

  useEffect(() => {
    Promise.all([
      base44.entities.StaffAccount.filter({ is_active: true }),
      base44.entities.SchoolProfile.list(),
    ]).then(async ([staff, profiles]) => {
      const validStaff = staff.filter(s => s.staff_code);

      // Ensure every staff member has a qr_token; assign one if missing
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

      // Generate QR images using staff_code|qr_token
      const entries = await Promise.all(updatedStaff.map(async (s) => {
        const url = await generateQRImage(s.staff_code, s.qr_token);
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
    const url = await generateQRImage(staff.staff_code, token);
    setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, qr_token: token } : s));
    setFiltered(prev => prev.map(s => s.id === staff.id ? { ...s, qr_token: token } : s));
    setQrImages(prev => ({ ...prev, [staff.id]: url }));
  };

  const handlePrint = () => window.print();

  const handleSelectAll = () => setSelectedIds(filtered.map(s => s.id));
  const handleClearAll = () => setSelectedIds([]);
  const handleToggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toPrint = selectedIds.length > 0 ? filtered.filter(s => selectedIds.includes(s.id)) : filtered;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white print:m-0 print:p-0">
      {/* Controls — hidden on print */}
      <div className="no-print bg-[#1a237e] text-white px-4 py-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:gap-3 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">Staff QR Code Cards</h1>
            <p className="text-white/70 text-sm">Print on A4 sheet — 9 cards per page (3×3 grid)</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
            <Button onClick={handleSelectAll} variant="outline" className="bg-white/10 text-white hover:bg-white/20 text-sm">
              Select All ({filtered.length})
            </Button>
            <Button onClick={handleClearAll} variant="outline" className="bg-white/10 text-white hover:bg-white/20 text-sm">
              Clear
            </Button>
            <Button onClick={handlePrint} className="bg-white text-[#1a237e] hover:bg-white/90 gap-2">
              <Printer className="h-4 w-4" />
              Print ({toPrint.length})
            </Button>
            {selectedIds.length > 0 && <span className="text-white text-sm font-semibold">Selected: {selectedIds.length}</span>}
          </div>
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
        <div className="p-4 print:p-0 print:m-0">
          {/* Staff without staff_code warning */}
          {staffList.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-yellow-800 text-sm">
              ⚠️ No staff members have a Staff Code assigned. Please add staff codes in Staff management first.
            </div>
          )}

          {/* Selection Checklist */}
          {filtered.length > 0 && (
            <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200 no-print">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Select Staff Members to Print</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {filtered.map(staff => (
                  <label key={staff.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(staff.id)}
                      onChange={() => handleToggle(staff.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-800">{staff.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Print grid — 3x3 for A4 */}
          <div
            id="print-area"
            className="grid gap-1.5 grid-cols-3"
          >
            {toPrint.map(staff => (
              <div
                key={staff.id}
                className="bg-white border border-[#1a237e] p-1 flex flex-col items-center text-center print-card h-full"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {/* School name */}
                <p className="text-[7px] font-bold text-[#1a237e] uppercase tracking-tight mb-0.5">{schoolName}</p>

                {/* Staff photo or avatar */}
                {staff.photo_url ? (
                  <img src={staff.photo_url} alt={staff.name} className="w-7 h-7 rounded-full object-cover border border-[#1a237e] mb-0.5" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#e8eaf6] flex items-center justify-center mb-0.5 border border-[#1a237e]">
                    <span className="text-[#1a237e] font-bold text-xs">
                      {staff.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}

                {/* Name & designation */}
                <p className="font-bold text-gray-900 text-[7px] leading-tight">{staff.name}</p>
                <p className="text-[6px] text-gray-500 mt-0.5">{staff.designation || staff.role || 'Staff'}</p>
                <p className="text-[6px] text-[#1a237e] font-semibold mt-0.5">Code: {staff.staff_code}</p>

                {/* QR Code */}
                <div className="mt-2 p-1 border border-gray-200 rounded flex-1 flex items-center justify-center">
                  {qrImages[staff.id] ? (
                    <img src={qrImages[staff.id]} alt={`QR for ${staff.name}`} className="w-28 h-28" />
                  ) : (
                    <div className="w-28 h-28 bg-gray-100 flex items-center justify-center text-[6px] text-gray-400">
                      Generating...
                    </div>
                  )}
                </div>
                <p className="text-[6px] text-gray-400 mt-1">Scan at kiosk</p>
                <button
                  onClick={() => reissueQR(staff)}
                  className="no-print mt-0.5 text-[6px] text-red-500 underline hover:text-red-700"
                  title="Invalidates old card and generates a new QR token"
                >
                  🔄 Reissue
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            overflow: visible !important; 
            width: 210mm !important; 
            height: 297mm !important;
          }
          #print-area {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4px !important;
            padding: 8mm !important;
            width: 210mm !important;
            height: auto !important;
            box-sizing: border-box !important;
          }
          .print-card {
            border: 1px solid #1a237e !important;
            padding: 2px !important;
            min-height: 210px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-radius: 2px !important;
          }
          .print-card p { margin: 1px 0 !important; }
          .print-card img { object-fit: cover !important; }
        }
      `}</style>
    </div>
  );
}