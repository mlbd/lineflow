'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useMemo } from 'react';

/** Fallback: compute a unique name by appending _N if needed. */
function getUniqueName(desiredName, existingNames, currentName = '') {
  const base = String(desiredName || '').trim();
  if (!base) return currentName || `area_${Date.now()}`;

  const list = Array.isArray(existingNames) ? existingNames.filter(Boolean) : [];
  const lowerSet = new Set(list.map(n => n.toLowerCase()));

  if (!lowerSet.has(base.toLowerCase())) return base;

  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}_(\\d+)$`, 'i');

  let next = 2;
  for (const name of list) {
    if (!name) continue;
    if (name.toLowerCase() === base.toLowerCase()) {
      next = Math.max(next, 2);
      continue;
    }
    const m = name.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) next = Math.max(next, n + 1);
    }
  }
  return `${base}_${next}`;
}

export default function EditMappingModal({
  mapping,
  open,
  onClose,
  onSave,
  /** Names of other placements in the same array (exclude current one) */
  existingNames = [],
}) {
  const [form, setForm] = useState(null);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (mapping) setForm(mapping);
  }, [mapping]);

  const existingLower = useMemo(
    () =>
      new Set(
        (existingNames || []).map(n =>
          String(n || '')
            .trim()
            .toLowerCase()
        )
      ),
    [existingNames]
  );

  const validateName = val => {
    const v = String(val || '').trim();
    if (!v) return 'Name is required.';
    if (existingLower.has(v.toLowerCase())) return 'This name already exists.';
    return '';
  };

  useEffect(() => {
    if (!form) return;
    setNameError(validateName(form.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.name, existingLower]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleBackLogoChange = enabled => {
    setForm(prev => {
      if (enabled) return { ...prev, back: true };
      const { back, ...rest } = prev || {};
      return rest;
    });
  };

  const handleActiveChange = enabled => {
    setForm(prev => ({ ...prev, active: !!enabled }));
  };

  // ADD under handleBackLogoChange + handleActiveChange
  const handlePreventExtentChange = enabled => {
    // Checkbox means “Prevent Extent” → set extent=false when checked, true when unchecked
    setForm(prev => ({ ...prev, extent: enabled ? false : true }));
  };

  const handleSave = () => {
    if (!form) return;

    // Safety net: if duplicate somehow slipped through, auto-suffix.
    const desired = (form.name || '').trim();
    const currentName = (mapping?.name || '').trim();
    const finalName = nameError ? getUniqueName(desired, existingNames, currentName) : desired;

    const next = { ...form, name: finalName };
    if (typeof next.extent === 'undefined') next.extent = true; // default true

    onSave(next);
    onClose();
  };

  const formatPercentage = v => (typeof v === 'number' ? (v * 100).toFixed(1) : '0');
  const parsePercentage = v => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n / 100;
  };
  const formatCoordinate = v => (typeof v === 'number' ? Math.round(v) : v || 0);

  // NEW: helpers for rotation
  const formatRotation = v => (typeof v === 'number' && !Number.isNaN(v) ? Math.round(v) : 0); // NEW
  const parseRotation = v => {
    // NEW
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  if (!mapping || !form) return null;

  const saveDisabled = !!nameError;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Placement</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name || ''}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g., Right Chest"
              className={nameError ? 'border-red-500 focus-visible:ring-red-500' : ''}
              aria-invalid={!!nameError}
              aria-describedby="placement-name-error"
            />
            <div
              id="placement-name-error"
              className={`mt-1 text-xs ${nameError ? 'text-red-600' : 'text-muted-foreground'}`}
            >
              {nameError ? nameError : 'Names must be unique within this product.'}
            </div>
          </div>
          {/* Percent inputs if present, else pixel inputs */}
          {form.xPercent !== undefined ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>X (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formatPercentage(form.xPercent)}
                  onChange={e => update('xPercent', parsePercentage(e.target.value))}
                />
              </div>
              <div>
                <Label>Y (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formatPercentage(form.yPercent)}
                  onChange={e => update('yPercent', parsePercentage(e.target.value))}
                />
              </div>
              <div>
                <Label>Width (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formatPercentage(form.wPercent)}
                  onChange={e => update('wPercent', parsePercentage(e.target.value))}
                />
              </div>
              <div>
                <Label>Height (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formatPercentage(form.hPercent)}
                  onChange={e => update('hPercent', parsePercentage(e.target.value))}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>X (px)</Label>
                <Input
                  type="number"
                  value={formatCoordinate(form.x)}
                  onChange={e => update('x', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Y (px)</Label>
                <Input
                  type="number"
                  value={formatCoordinate(form.y)}
                  onChange={e => update('y', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Width (px)</Label>
                <Input
                  type="number"
                  value={formatCoordinate(form.w)}
                  onChange={e => update('w', parseInt(e.target.value) || 10)}
                />
              </div>
              <div>
                <Label>Height (px)</Label>
                <Input
                  type="number"
                  value={formatCoordinate(form.h)}
                  onChange={e => update('h', parseInt(e.target.value) || 10)}
                />
              </div>
            </div>
          )}
          {/* NEW: Rotation (degrees) */}
          <div className="grid grid-cols-2 gap-4">
            {' '}
            {/* NEW */}
            <div>
              {' '}
              {/* NEW */}
              <Label>Rotation (°)</Label> {/* NEW */}
              <Input
                type="number"
                step="1"
                value={formatRotation(form.rotation)} // NEW
                onChange={e => update('rotation', parseRotation(e.target.value))} // NEW
                placeholder="0"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Rotate overlay inside this box (e.g., 15, -30). {/* NEW */}
              </div>
            </div>
          </div>{' '}
          {/* NEW */}
          
          {/* Active switch */}
          <div>
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.active}
                onChange={e => handleActiveChange(e.target.checked)}
                className="accent-blue-600"
              />
              Active
            </Label>
            <div className="text-xs text-muted-foreground mt-1">
              Only “Active” placements are used by default in generated previews.
            </div>
          </div>
          {/* Back Logo */}
          <div className="mt-2">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.back}
                onChange={e => handleBackLogoChange(e.target.checked)}
                className="accent-blue-600"
              />
              Back Logo Enabled
            </Label>
          </div>
          {/* Prevent Extent */}
          <div className="mt-2">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.extent === false /* default true unless explicitly false */}
                onChange={e => handlePreventExtentChange(e.target.checked)}
                className="accent-blue-600"
              />
              Prevent Area Overflow
            </Label>
            <div className="text-xs text-muted-foreground mt-1">
              Extent defaults to <b>true</b>. Check to force it <b>false</b>.
            </div>
          </div>
    
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveDisabled}
            className={saveDisabled ? 'opacity-60 cursor-not-allowed' : ''}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
