import React from 'react';
import { RgbaColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';

const PopoverPicker = ({ color, onChange, onSave, onCancel }) => {
  return (
    <div className="picker-popup absolute top-[51px] left-[460px]">
      <RgbaColorPicker color={color} onChange={onChange} />
      <div className="popup-actions flex">
        <Button className="w-1/2 rounded-none cursor-pointer" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="w-1/2 rounded-none cursor-pointer" variant="outline" onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default PopoverPicker;
