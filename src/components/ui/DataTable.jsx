import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ArrowUpDown } from 'lucide-react';

export default function DataTable({ 
  columns, 
  data, 
  loading,
  emptyMessage = "No data found",
  onRowClick,
  onSort
}) {
  const handleHeaderClick = (accessor) => {
    if (onSort) {
      onSort(accessor);
    }
  };
  if (loading) {
    return (
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {columns.map((col, i) => (
                <TableHead 
                  key={i} 
                  className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group"
                  onClick={() => handleHeaderClick(col.accessor)}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    {onSort && <ArrowUpDown className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1,2,3,4,5].map((i) => (
              <TableRow key={i}>
                {columns.map((col, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {columns.map((col, i) => (
                <TableHead 
                  key={i} 
                  className="font-semibold text-slate-700"
                  style={{ width: col.width }}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-slate-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow 
                  key={row.id || i}
                  className={onRowClick ? "cursor-pointer hover:bg-blue-50/50" : ""}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col, j) => (
                    <TableCell key={j} className="py-4">
                      {col.cell ? col.cell(row) : row[col.accessor]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}