'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Trash2, SquarePen, Star } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

export default function MappingList({ mappings, selectedId, onSelect, onDelete, onEdit }) {
  const formatCoordinate = value => (typeof value === 'number' ? Math.round(value) : value || 0);
  const formatPercentage = value =>
    typeof value === 'number' ? (value * 100).toFixed(1) + '%' : '0%';
  const formatRotation = v => (typeof v === 'number' && !Number.isNaN(v) ? Math.round(v) : 0);

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
          // 👇 Keep scrollbar visible whenever content overflows
          <ScrollArea
            type="always"
            className="custom-scrollbar-red h-[250px] pr-2 p-4 border rounded"
          >
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
                    <div className="font-medium flex items-center gap-1">
                      <span>{m.name}</span>
                      {m.extraPrice === true && (
                        // [PATCH] Added tooltip-wrapped bold plus sign
                        <Tooltip content="Extra price active">
                          <span className="font-extrabold text-emerald-700 leading-none select-none">
                            +
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground relative">
                      {m.xPercent !== undefined ? (
                        <>
                          x: {formatPercentage(m.xPercent)}, y: {formatPercentage(m.yPercent)} w:{' '}
                          {formatPercentage(m.wPercent)}, h: {formatPercentage(m.hPercent)}
                        </>
                      ) : (
                        <>
                          x: {formatCoordinate(m.x)}, y: {formatCoordinate(m.y)} w:{' '}
                          {formatCoordinate(m.w)}, h: {formatCoordinate(m.h)}
                        </>
                      )}
                      · rot: {formatRotation(m.rotation)}&deg;
                    </div>

                    {m.back && (
                      <div className="text-xs my-2 text-blue-600 font-semibold">
                        Back Logo Enabled
                      </div>
                    )}
                  </div>

                  {m.active && (
                    <div>
                      <div className="absolute top-[4px] left-[4px] z-10">
                        <Star className="w-3 h-3 text-white relative" />
                      </div>
                      <div className="absolute top-0 left-0 w-12 h-12 pointer-events-none">
                        <div
                          className="absolute top-0 left-0 w-0 h-0 
                                 border-l-[32px] border-l-blue-600
                                 border-b-[32px] border-b-transparent"
                        />
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
