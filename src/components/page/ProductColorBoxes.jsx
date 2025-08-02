export default function ProductColorBoxes({ acf }) {
  // Only render if group_type === "Group" and color is non-empty array
  if (acf?.group_type === "Group" && Array.isArray(acf.color) && acf.color.length > 0) {
    return (
      <div className="flex flex-wrap gap-[9px] mb-2 justify-center items-center">
        {acf.color.map((clr, idx) => (
          <div
            key={idx}
            className="w-[25px] h-[25px] rounded-[7px] cursor-pointer shadow-[0_0_0_2px_white,0_0_0_3px_#cccccc]"
            style={{
              background: clr.color_hex_code || "#fff"
            }}
            title={clr.title || ""}
          />
        ))}
      </div>
    );
  }
  // Fallback: single color or no colors
  return (
    <div className="text-sm border text-deepblue rounded-md font-normal bg-deepblue-light mb-2 px-2 py-1 text-center">
     <img src="/info-icon.svg" className="w-[16px] h-[16px] inline-block ml-2" />
      זמין בצבע אחד כבתמונה
    </div>
  );
}
