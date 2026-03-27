import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

const CsvDataTable = ({ data, columns }) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!data.length) return null;

  return (
    <div className="w-full overflow-x-auto border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-12">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#1a1a1a] text-white">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="p-4 font-heading text-[10px] tracking-tighter border-b-4 border-black uppercase text-crab-accent"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y-2 divide-black">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-crab-accent/5 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="p-4 font-mono text-xs border-r-2 border-black last:border-r-0"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CsvDataTable;
