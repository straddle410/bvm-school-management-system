import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

export default function TableBuilder({ onInsert, onClose }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [data, setData] = useState(Array(3).fill(null).map(() => Array(3).fill('')));

  const handleRowsChange = (newRows) => {
    setRows(newRows);
    const newData = Array(newRows).fill(null).map((_, i) => 
      data[i] ? data[i] : Array(cols).fill('')
    );
    setData(newData);
  };

  const handleColsChange = (newCols) => {
    setCols(newCols);
    const newData = data.map(row => {
      const newRow = [...row];
      while (newRow.length < newCols) newRow.push('');
      return newRow.slice(0, newCols);
    });
    setData(newData);
  };

  const handleCellChange = (row, col, value) => {
    const newData = data.map((r, i) => 
      i === row ? r.map((c, j) => j === col ? value : c) : r
    );
    setData(newData);
  };

  const generateTable = () => {
    let html = '<table style="width:100%; border-collapse: collapse; border: 1px solid #ddd; margin: 15px 0;">';
    
    // Header row
    html += '<tr style="background-color: #1a237e;">';
    for (let c = 0; c < cols; c++) {
      html += `<th style="border: 1px solid #ddd; padding: 10px; color: white; font-weight: bold; text-align: center;">${data[0][c] || `Col ${c + 1}`}</th>`;
    }
    html += '</tr>';
    
    // Data rows
    for (let r = 1; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="border: 1px solid #ddd; padding: 10px; text-align: left;">${data[r][c] || ''}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    
    onInsert(html);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Create Table</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rows</Label>
          <Input type="number" min="2" max="20" value={rows} onChange={e => handleRowsChange(parseInt(e.target.value))} />
        </div>
        <div>
          <Label>Columns</Label>
          <Input type="number" min="1" max="10" value={cols} onChange={e => handleColsChange(parseInt(e.target.value))} />
        </div>
      </div>

      {/* Excel-like table editor */}
      <div className="border rounded-lg overflow-auto max-h-64 bg-white">
        <table className="border-collapse w-full text-sm">
          <tbody>
            {data.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={`${r}-${c}`} className="border border-gray-300">
                    <input
                      type="text"
                      value={cell}
                      onChange={e => handleCellChange(r, c, e.target.value)}
                      placeholder={r === 0 ? `Header ${c + 1}` : ''}
                      className={`w-full px-2 py-2 border-0 focus:ring-1 focus:ring-blue-500 focus:outline-none ${
                        r === 0 ? 'bg-blue-50 font-semibold' : ''
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={generateTable} className="bg-blue-600 hover:bg-blue-700">Insert Table</Button>
      </div>
    </div>
  );
}