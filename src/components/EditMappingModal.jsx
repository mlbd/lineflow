'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect } from 'react'

export default function EditMappingModal({ mapping, open, onClose, onSave }) {
  const [form, setForm] = useState(null)

  // Only update form if mapping is available
  useEffect(() => {
    if (mapping) {
      setForm(mapping)
    }
  }, [mapping])

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave(form)
    onClose()
  }

  // Don't render modal if mapping is not yet defined
  if (!mapping || !form) return null

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
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>X</Label>
              <Input
                type="number"
                value={form.x}
                onChange={(e) => update('x', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Y</Label>
              <Input
                type="number"
                value={form.y}
                onChange={(e) => update('y', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Width</Label>
              <Input
                type="number"
                value={form.w}
                onChange={(e) => update('w', parseInt(e.target.value) || 10)}
              />
            </div>
            <div>
              <Label>Height</Label>
              <Input
                type="number"
                value={form.h}
                onChange={(e) => update('h', parseInt(e.target.value) || 10)}
              />
            </div>
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
  )
}
