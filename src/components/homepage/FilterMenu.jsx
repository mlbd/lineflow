import { useRef, useEffect, useState } from 'react';

export default function FilterMenu({
  selectedCategory,
  setSelectedCategory,
  allCategories,
  categoryName,
}) {
  const [backgroundStyle, setBackgroundStyle] = useState({});
  const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
  const menuRef = useRef(null);
  const buttonRefs = useRef({});

  const menuItems = [
    { value: 'all', label: 'Show All' },
    ...(allCategories || []).map(cat => ({ value: cat, label: categoryName(cat) })),
  ];

  const updateBackgroundPosition = buttonElement => {
    if (!menuRef.current || !buttonElement) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const buttonRect = buttonElement.getBoundingClientRect();

    setBackgroundStyle({
      left: buttonRect.left - menuRect.left,
      width: buttonRect.width,
      height: buttonRect.height,
    });
    setIsBackgroundVisible(true);
  };

  const handleMouseEnter = value => {
    const buttonElement = buttonRefs.current[value];
    if (buttonElement) {
      updateBackgroundPosition(buttonElement);
    }
  };

  const handleMouseLeave = () => {
    // Move background back to selected category when mouse leaves
    const activeButton = buttonRefs.current[selectedCategory];
    if (activeButton) {
      updateBackgroundPosition(activeButton);
    }
  };

  const handleClick = value => {
    setSelectedCategory(value);
    const buttonElement = buttonRefs.current[value];
    if (buttonElement) {
      updateBackgroundPosition(buttonElement);
    }
  };

  // Initialize background position on the active item
  useEffect(() => {
    const activeButton = buttonRefs.current[selectedCategory];
    if (activeButton) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        updateBackgroundPosition(activeButton);
      }, 50);
    }
  }, [selectedCategory, allCategories]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const activeButton = buttonRefs.current[selectedCategory];
      if (activeButton) {
        updateBackgroundPosition(activeButton);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedCategory]);

  return (
    <div className="mb-10 flex flex-wrap gap-2 items-center justify-start">
      <div
        ref={menuRef}
        className="relative flex flex-wrap gap-2 items-center justify-center bg-primary-100 p-[10px] rounded-[100px]"
        onMouseLeave={handleMouseLeave}
      >
        {/* Moving Background */}
        <div
          className={`absolute bg-white rounded-[100px] transition-all duration-300 ease-out pointer-events-none ${
            isBackgroundVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            left: `${backgroundStyle.left}px`,
            width: `${backgroundStyle.width}px`,
            height: `${backgroundStyle.height}px`,
            top: `10px`,
          }}
        />

        {/* Menu Items */}
        {menuItems.map(({ value, label }) => {
          const isActive = selectedCategory === value;
          return (
            <button
              key={value}
              ref={el => {
                buttonRefs.current[value] = el;
              }}
              onClick={() => handleClick(value)}
              onMouseEnter={() => handleMouseEnter(value)}
              className={`
                relative z-10 transition-colors duration-300 cursor-pointer px-6 py-3 text-base font-semibold rounded-[100px]
                ${isActive ? 'text-tertiary' : 'text-grey-500 hover:text-gray-700'}
              `}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
