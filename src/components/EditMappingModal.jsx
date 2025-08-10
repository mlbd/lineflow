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
import { useState, useEffect } from 'react';

export default function EditMappingModal({ mapping, open, onClose, onSave }) {
  const [form, setForm] = useState(null);

  // Only update form if mapping is available
  useEffect(() => {
    if (mapping) {
      setForm(mapping);
    }
  }, [mapping]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleBackLogoChange = (enabled) => {
    setForm(prev => {
      // Add 'back: true' if enabled, else remove 'back'
      if (enabled) {
        return { ...prev, back: true };
      } else {
        const { back, ...rest } = prev;
        return rest;
      }
    });
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  // Convert percentage to display value for input
  const formatPercentage = value => {
    if (typeof value === 'number') {
      return (value * 100).toFixed(1);
    }
    return '0';
  };

  // Convert display value to percentage
  const parsePercentage = value => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num / 100;
  };

  const formatCoordinate = value => {
    if (typeof value === 'number') {
      return Math.round(value);
    }
    return value || 0;
  };

  // Don't render modal if mapping is not yet defined
  if (!mapping || !form) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Placement</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={e => update('name', e.target.value)} />
          </div>

          {/* Show percentage inputs if available, otherwise show pixel inputs */}
          {form.xPercent !== undefined ? (
            <>
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
            </>
          ) : (
            <>
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
            </>
          )}

          {/* Back Logo Checkbox */}
          <div>
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
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
