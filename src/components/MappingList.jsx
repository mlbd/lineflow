'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Trash2, SquarePen, Star } from 'lucide-react';

export default function MappingList({ mappings, selectedId, onSelect, onDelete, onEdit }) {
  const formatCoordinate = value => {
    if (typeof value === 'number') {
      return Math.round(value);
    }
    return value || 0;
  };

  const formatPercentage = value => {
    if (typeof value === 'number') {
      return (value * 100).toFixed(1) + '%';
    }
    return '0%';
  };

  const formatRotation = v => (typeof v === 'number' && !Number.isNaN(v) ? Math.round(v) : 0); // NEW

  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold mb-4 px-4">Placement Areas</h2>

      <div>
        {mappings.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center">
            No placement areas yet.
            <br />
            Click and drag on image to create one.
          </div>
        ) : (
          <ScrollArea className="h-[250px] pr-2 p-4">
            <div className="space-y-2">
              {mappings.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'pr-3 pl-6 relative py-1 rounded border flex items-center justify-between cursor-pointer hover:bg-muted group',
                    m.id === selectedId ? 'bg-blue-100 border-blue-500' : 'border-border'
                  )}
                  onClick={() => onSelect(m.id)}
                >
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground relative">
                      {/* Show percentage coordinates if available, otherwise show pixel coordinates */}
                      {m.xPercent !== undefined ? (
                        <>
                          x: {formatPercentage(m.xPercent)}, y: {formatPercentage(m.yPercent)} w:{' '}
                          {formatPercentage(m.wPercent)}, h: {formatPercentage(m.hPercent)}
                          {/* */}
                        </>
                      ) : (
                        <>
                          x: {formatCoordinate(m.x)}, y: {formatCoordinate(m.y)} w:{' '}
                          {formatCoordinate(m.w)}, h: {formatCoordinate(m.h)}
                          {/* */}
                        </>
                      )}
                      {/* NEW: rotation display */} · rot: {formatRotation(m.rotation)}&deg;{' '}
                      {/* NEW */}
                    </div>

                    {m.back && (
                      <div className="text-xs my-2 text-blue-600 font-semibold">
                        Back Logo Enabled
                      </div>
                    )}
                  </div>
                  {m.active && (
                    <div>
                      {/* The main element you want the star on */}
                      <div className="absolute top-[4px] left-[4px] z-10">
                        <Star className="w-3 h-3 text-white relative">
                          {/* Not directly supported — we overlay the triangle separately */}
                        </Star>
                      </div>

                      {/* Triangle inside the top-left of the Star */}
                      <div className="absolute top-0 left-0 w-12 h-12 pointer-events-none">
                        {/* Triangle shape */}
                        <div
                          className="absolute top-0 left-0 w-0 h-0 
                                        border-l-[32px] border-l-blue-600
                                        border-b-[32px] border-b-transparent"
                        ></div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                    <SquarePen
                      size={16}
                      className="text-primary hover:text-blue-600"
                      onClick={e => {
                        e.stopPropagation();
                        onEdit(m.id);
                      }}
                    />
                    <Trash2
                      size={16}
                      className="text-red-500 hover:text-red-700"
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(m.id);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
