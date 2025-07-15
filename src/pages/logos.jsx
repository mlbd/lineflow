'use client';

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import PopoverPicker from '@/components/PopoverPicker';
import { Button } from '@/components/ui/button';

// Toggle this variable to enable/disable Cloudinary fetching
const ENABLE_CLOUDINARY = false;

export default function LogosPage() {
  const [pageData, setPageData] = useState(null);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overayColor, setOverayColor] = useState('#000000');

  const [viewWithOverlay, setViewWithOverlay] = useState(false);
  const [color, setColor] = useState({ r: 0, g: 0, b: 0, a: 0.5 });
  const [tempColor, setTempColor] = useState(color);
  const [showPicker, setShowPicker] = useState(false);

  const handleTogglePicker = () => {
    if (showPicker) {
      // If picker is open, close it
      setShowPicker(false);
    } else {
      // If picker is closed, open it
      setTempColor(color);
      setShowPicker(true);
    }
  };

  const handleSaveColor = () => {
    setColor(tempColor);
    localStorage.setItem('overlay_color', JSON.stringify(tempColor));
    setShowPicker(false);
    window.location.reload();
  };

  const handleCancelColor = () => {
    setShowPicker(false);
  };

  useEffect(() => {
    try {
      const storedData = localStorage.getItem('logo_page_data');
      const storedOverlay = localStorage.getItem('view_with_overlay') === 'true';
      const storedColor = localStorage.getItem('overlay_color');

      if (storedData) {
        const parsedData = JSON.parse(storedData);
        const colorValue = parseColor(storedColor);

        setPageData(parsedData);
        setViewWithOverlay(storedOverlay);
        setColor(colorValue);
        fetchLogos(parsedData, storedOverlay, colorValue);
      } else {
        setError('No data found. Please go back and configure your image and placements.');
        setLoading(false);
      }
    } catch (err) {
      console.warn('Error loading from localStorage:', err);
      setError('Corrupted data in storage.');
      setLoading(false);
    }
  }, []);

  const parseColor = storedColor => {
    try {
      if (!storedColor) return { r: 0, g: 0, b: 0, a: 0.5 };

      const parsed = JSON.parse(storedColor);

      if (typeof parsed === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(parsed)) {
        // Convert HEX to RGBA
        const hex = parsed.replace('#', '');
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return { r, g, b, a: 1 };
      }

      // Validate it's RGBA
      if (parsed && typeof parsed === 'object' && 'r' in parsed && 'g' in parsed && 'b' in parsed) {
        return {
          r: parsed.r,
          g: parsed.g,
          b: parsed.b,
          a: typeof parsed.a === 'number' ? parsed.a : 1,
        };
      }

      // Default fallback
      return { r: 0, g: 0, b: 0, a: 0.5 };
    } catch (err) {
      return { r: 0, g: 0, b: 0, a: 0.5 };
    }
  };

  // Mock data for development when Cloudinary is disabled
  const generateMockLogos = data => {
    const mockLogos = [];
    for (let i = 0; i < 6; i++) {
      mockLogos.push({
        public_id: `mock_logo_${i}`,
        thumbnailUrl: data.imageUrl, // Use original image URL
        title: `Mock Item ${i + 1}`,
        price: generateRandomPrice(),
      });
    }
    return mockLogos;
  };

  const getImageSize = url => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
    });
  };

  const fetchLogos = async (data, overlay, color) => {
    try {
      setLoading(true);

      if (!ENABLE_CLOUDINARY) {
        // Use mock data when Cloudinary is disabled
        console.log('Cloudinary disabled - using mock data');
        const mockLogos = generateMockLogos(data);
        setLogos(mockLogos);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/cloudinary/logos');
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to fetch logos');

      const logosWithThumbnails = await Promise.all(
        result.logos.map(async (logo, i) => {
          const thumbnailUrl = await generateThumbnailUrl(data, logo.public_id, overlay, color);
          return {
            ...logo,
            thumbnailUrl,
            title: `Item ${i + 1}`,
            price: generateRandomPrice(),
          };
        })
      );

      setLogos(logosWithThumbnails);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch logos');
    } finally {
      setLoading(false);
    }
  };

  const generateThumbnailUrl = async (data, logoId, overlayEnabled, color) => {
    if (!ENABLE_CLOUDINARY) {
      // Return original image URL when Cloudinary is disabled
      return data.imageUrl;
    }

    const { imageUrl, mappings } = data;
    const folder = 'dfuecvdyc';
    const base = `https://res.cloudinary.com/${folder}/image/upload`;
    const imageName = imageUrl.split('/').pop();

    try {
      const baseSize = await getImageSize(imageUrl);
      const logoSize = await getImageSize(`${base}/${logoId}.png`);
      const naturalW = baseSize.width;
      const naturalH = baseSize.height;

      const transformations = mappings.map(m => {
        const x = Math.round(m.xPercent * naturalW);
        const y = Math.round(m.yPercent * naturalH);
        const w = Math.round(m.wPercent * naturalW);
        const h = Math.round(m.hPercent * naturalH);

        const logoAspect = logoSize.width / logoSize.height;
        const boxAspect = w / h;
        let logoW, logoH;

        if (logoAspect > boxAspect) {
          logoW = w;
          logoH = Math.round(w / logoAspect);
        } else {
          logoH = h;
          logoW = Math.round(h * logoAspect);
        }

        const logoX = x + Math.round((w - logoW) / 2);
        const logoY = y + Math.round((h - logoH) / 2);

        if (overlayEnabled) {
          const r = color.r.toString(16).padStart(2, '0');
          const g = color.g.toString(16).padStart(2, '0');
          const b = color.b.toString(16).padStart(2, '0');
          const hexColor = `${r}${g}${b}`;
          const opacity = Math.round((color.a ?? 1) * 100);
          setOverayColor(hexColor);

          return [
            `l_one_pixel_tn2oaa,w_${w},h_${h}`,
            `co_rgb:${hexColor},e_colorize:100,o_${opacity},fl_layer_apply,x_${x},y_${y},g_north_west`,
            `l_${logoId},w_${logoW},h_${logoH}`,
            `fl_layer_apply,x_${logoX},y_${logoY},g_north_west`,
          ].join('/');
        } else {
          return [
            `l_${logoId},w_${logoW},h_${logoH}`,
            `fl_layer_apply,x_${logoX},y_${logoY},g_north_west`,
          ].join('/');
        }
      });

      return `${base}/${transformations.join('/')}/${imageName}`;
    } catch (err) {
      console.error('Thumbnail generation failed:', err);
      return imageUrl;
    }
  };

  function getContrastTextColor(hexColor) {
    // Remove "#" if present
    const color = hexColor.replace('#', '');

    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for light backgrounds, white for dark backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  const generateRandomPrice = () => {
    const min = 29;
    const max = 54;
    const minPrice = min + Math.random() * (max - min);
    const maxPrice = minPrice + Math.random() * (max - minPrice);
    return `${minPrice.toFixed(2)}₪ - ${maxPrice.toFixed(2)}₪`;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading logos...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
    );
  }

  console.log('overayColor:', overayColor);
  const textColor = getContrastTextColor(overayColor);
  console.log('textColor:', textColor);

  return (
    <>
      <Head>
        <title>Logo Gallery - Custom Product Designs</title>
        <meta
          name="description"
          content="Browse our collection of custom logo designs for your products."
        />
      </Head>

      <div className="min-h-screen bg-gray-100">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-[1000px] mx-auto px-6 py-4 flex justify-between items-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-black flex items-center gap-2"
            >
              <ArrowLeft size={18} /> Back to Editor
            </Link>
            <div className="flex items-center gap-4 relative">
              {/* Show Cloudinary status */}
              <div className="text-xs text-gray-500">
                Cloudinary: {ENABLE_CLOUDINARY ? 'ON' : 'OFF'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">View with Overlay</span>
                <Switch
                  checked={viewWithOverlay}
                  onCheckedChange={checked => {
                    setViewWithOverlay(checked);
                    localStorage.setItem('view_with_overlay', checked);
                    window.location.reload();
                  }}
                />
              </div>
              {viewWithOverlay && (
                <>
                  <button
                    onClick={handleTogglePicker}
                    style={{
                      backgroundColor: overayColor.startsWith('#')
                        ? overayColor
                        : `#${overayColor}`,
                      color: textColor.startsWith('#') ? textColor : `#${textColor}`,
                      border: `1px solid ${textColor.startsWith('#') ? textColor : `#${textColor}`}`,
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      borderRadius: '8px',
                      height: '36px',
                      lineHeight: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    Pick Color
                  </button>
                  {showPicker && (
                    <PopoverPicker
                      color={tempColor}
                      onChange={setTempColor}
                      onSave={handleSaveColor}
                      onCancel={handleCancelColor}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pt-[60px] pb-[50px] block text-center">
            <h2 className='text-3xl font-bold'>Logo Gallery - MiniSite Demo Example</h2>
        </div>

        <div className="max-w-[1000px] mx-auto px-6 pt-8 pb-[60px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {logos.map(logo => (
            <div key={logo.public_id} className="bg-white rounded shadow">
              <div className=" bg-gray-100 m-0">
                <img src={logo.thumbnailUrl} alt={logo.title} className="w-full h-auto block" />
              </div>
              <div className="py-8 px-4 text-center">
                <h3 className="font-semibold mb-1">{logo.title}</h3>
                <p className="text-blue-600 font-bold mb-3">{logo.price}</p>
                <Button
                  variant={'default'}
                  onClick={() => alert(`Added ${logo.title} to cart!`)}
                  className="inline-block"
                >
                  <ShoppingCart size={18} className="inline-block mr-1" /> Add to Cart
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
