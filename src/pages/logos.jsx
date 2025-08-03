'use client';

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, ShoppingCart, RefreshCw, Database, Cloud } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import PopoverPicker from '@/components/PopoverPicker';
import { Button } from '@/components/ui/button';
import LazyLoadImage from '@/components/LazyLoadImage';
import ImageModal from '@/components/ImageModal';

// Toggle this variable to enable/disable Cloudinary fetching
const ENABLE_CLOUDINARY = true;

export default function LogosPage() {
  const [pageData, setPageData] = useState(null);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overayColor, setOverayColor] = useState('#000000');
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState('');
  const [stats, setStats] = useState(null);
  const [regeneratingImages, setRegeneratingImages] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(null);

  const [viewWithOverlay, setViewWithOverlay] = useState(false);
  const [color, setColor] = useState({ r: 0, g: 0, b: 0, a: 0.5 });
  const [tempColor, setTempColor] = useState(color);
  const [showPicker, setShowPicker] = useState(false);

  // Function to handle image click
  const handleImageClick = logo => {
    const idx = logos.findIndex(l => l.public_id === logo.public_id);
    setModalImageIndex(idx);
    setModalOpen(true);
  };

  // Function to close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setModalImage({ src: '', alt: '', title: '' });
  };

  const handleTogglePicker = () => {
    if (showPicker) {
      setShowPicker(false);
    } else {
      setTempColor(color);
      setShowPicker(true);
    }
  };

  const handleSaveColor = async () => {
    setColor(tempColor);
    localStorage.setItem('overlay_color', JSON.stringify(tempColor));
    setShowPicker(false);

    // Regenerate images without reloading the page
    await regenerateImages(viewWithOverlay, tempColor);
  };

  const handleCancelColor = () => {
    setShowPicker(false);
  };

  const handleOverlayToggle = async checked => {
    setViewWithOverlay(checked);
    localStorage.setItem('view_with_overlay', checked);

    // Regenerate images without reloading the page
    await regenerateImages(checked, color);
  };

  const regenerateImages = async (overlayEnabled, colorValue) => {
    if (!pageData || !logos.length) return;

    setRegeneratingImages(true);

    try {
      // Generate new thumbnail URLs for all logos
      const updatedLogos = await Promise.all(
        logos.map(async logo => {
          const thumbnailUrl = await generateThumbnailUrl(
            pageData,
            logo,
            overlayEnabled,
            colorValue
          );
          return {
            ...logo,
            thumbnailUrl,
            // Add a cache-busting parameter to force image reload
            imageKey: Date.now() + Math.random(),
          };
        })
      );

      setLogos(updatedLogos);
    } catch (err) {
      console.error('Error regenerating images:', err);
      setError('Failed to regenerate images');
    } finally {
      setRegeneratingImages(false);
    }
  };

  const handleRefreshCache = async () => {
    setRefreshing(true);
    try {
      // Clear cache first
      const deleteResponse = await fetch('/api/cloudinary/logos', {
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to clear cache');
      }

      // Fetch fresh data from Cloudinary
      const response = await fetch('/api/cloudinary/logos?refresh=true');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to refresh cache');
      }

      // Update logos with fresh data
      if (pageData) {
        const logosWithThumbnails = await Promise.all(
          result.logos.map(async (logo, i) => {
            const thumbnailUrl = await generateThumbnailUrl(pageData, logo, viewWithOverlay, color);
            return {
              ...logo,
              thumbnailUrl,
              title: `Item ${i + 1}`,
              price: generateRandomPrice(),
              imageKey: Date.now() + Math.random(),
            };
          })
        );

        setLogos(logosWithThumbnails);
        setDataSource(result.source);
        setStats(result.stats);
      }

      alert('Cache refreshed successfully!');
    } catch (err) {
      console.error('Error refreshing cache:', err);
      alert('Failed to refresh cache: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const parseColor = storedColor => {
    try {
      if (!storedColor) return { r: 0, g: 0, b: 0, a: 0.5 };

      const parsed = JSON.parse(storedColor);

      if (typeof parsed === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(parsed)) {
        const hex = parsed.replace('#', '');
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return { r, g, b, a: 1 };
      }

      if (parsed && typeof parsed === 'object' && 'r' in parsed && 'g' in parsed && 'b' in parsed) {
        return {
          r: parsed.r,
          g: parsed.g,
          b: parsed.b,
          a: typeof parsed.a === 'number' ? parsed.a : 1,
        };
      }

      return { r: 0, g: 0, b: 0, a: 0.5 };
    } catch (err) {
      return { r: 0, g: 0, b: 0, a: 0.5 };
    }
  };

  const generateMockLogos = data => {
    const mockLogos = [];
    for (let i = 0; i < 6; i++) {
      mockLogos.push({
        public_id: `mock_logo_${i}`,
        thumbnailUrl: data.imageUrl,
        title: `Mock Item ${i + 1}`,
        price: generateRandomPrice(),
        imageKey: Date.now() + Math.random(),
      });
    }
    return mockLogos;
  };

  const getImageSize = url => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.src = url;
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
    });
  };

  // ✅ FIX: Wrap fetchLogos in useCallback, add as effect dep!
  const fetchLogos = useCallback(async (data, overlay, color) => {
    try {
      setLoading(true);

      if (!ENABLE_CLOUDINARY) {
        console.log('Cloudinary disabled - using mock data');
        const mockLogos = generateMockLogos(data);
        setLogos(mockLogos);
        setDataSource('mock');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/cloudinary/logos');
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to fetch logos');

      setDataSource(result.source);
      setStats(result.stats);

      const logosWithThumbnails = await Promise.all(
        result.logos.map(async (logo, i) => {
          const thumbnailUrl = await generateThumbnailUrl(data, logo, overlay, color);
          return {
            ...logo,
            thumbnailUrl,
            title: `Item ${i + 1}`,
            price: generateRandomPrice(),
            imageKey: Date.now() + Math.random(),
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
  }, []);

  const ASPECT_DIFF_THRESHOLD = 0.3;
  const SCALE_UP_FACTOR = 1.3;

  function getOrientation(w, h) {
    const aspect = w / h;
    if (aspect >= 1.2) return 'horizontal';
    if (aspect <= 0.8) return 'vertical';
    return 'square';
  }

  const generateThumbnailUrl = async (data, logo, overlayEnabled, color) => {
    if (!ENABLE_CLOUDINARY) return data.imageUrl;

    const { imageUrl, mappings } = data;
    const folder = 'dfuecvdyc';
    const base = `https://res.cloudinary.com/${folder}/image/upload`;
    const imageName = imageUrl.split('/').pop();

    const { public_id, width: logoWidth, height: logoHeight } = logo;

    try {
      const baseSize = await getImageSize(imageUrl);
      const naturalW = baseSize.width;
      const naturalH = baseSize.height;

      const transformations = mappings.map(m => {
        const x = Math.round(m.xPercent * naturalW);
        const y = Math.round(m.yPercent * naturalH);
        const w = Math.round(m.wPercent * naturalW);
        const h = Math.round(m.hPercent * naturalH);

        const logoOrientation = getOrientation(logoWidth, logoHeight);
        const boxOrientation = getOrientation(w, h);

        const logoAspect = logoWidth / logoHeight;
        const boxAspect = w / h;

        let fitW, fitH;
        if (logoAspect >= boxAspect) {
          fitW = w;
          fitH = Math.round(w / logoAspect);
        } else {
          fitH = h;
          fitW = Math.round(h * logoAspect);
        }

        let doScaleUp = logoOrientation !== boxOrientation;
        const aspectDiff = Math.abs(logoAspect - boxAspect) / Math.max(logoAspect, boxAspect);
        if (doScaleUp && aspectDiff > ASPECT_DIFF_THRESHOLD) {
          fitW = Math.round(fitW * SCALE_UP_FACTOR);
          fitH = Math.round(fitH * SCALE_UP_FACTOR);
        }

        const logoX = x + Math.round((w - fitW) / 2);
        const logoY = y + Math.round((h - fitH) / 2);

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
            `l_${public_id},c_pad,w_${fitW},h_${fitH},g_center,b_auto`,
            `fl_layer_apply,x_${logoX},y_${logoY},g_north_west`,
          ].join('/');
        } else {
          return [
            `l_${public_id},c_pad,w_${fitW},h_${fitH},g_center,b_auto`,
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
    const color = hexColor.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  const generateRandomPrice = () => {
    const min = 29;
    const max = 54;
    const minPrice = min + Math.random() * (max - min);
    const maxPrice = minPrice + Math.random() * (max - minPrice);
    return `${minPrice.toFixed(2)}₪ - ${maxPrice.toFixed(2)}₪`;
  };

  // ✅ FIX: useEffect with fetchLogos as dep
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
  }, [fetchLogos]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading logos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
    );
  }

  const textColor = getContrastTextColor(overayColor);

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
          <div className="max-w-[1000px] mx-auto px-6 py-4">
            <div className="flex justify-between items-center relative">
              <Link
                href="/"
                className="text-sm text-gray-600 hover:text-black flex items-center gap-2"
              >
                <ArrowLeft size={18} /> Back to Editor
              </Link>

              <div className="flex items-center gap-4">
                {/* Data Source Indicator */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {dataSource === 'database' && <Database size={14} />}
                  {dataSource === 'cloudinary' && <Cloud size={14} />}
                  {dataSource === 'mock' && <span>📝</span>}
                  <span>
                    {dataSource === 'database'
                      ? 'From Cache'
                      : dataSource === 'cloudinary'
                        ? 'From Cloudinary'
                        : dataSource === 'mock'
                          ? 'Mock Data'
                          : 'Unknown'}
                  </span>
                </div>

                {/* Cache Refresh Button */}
                {ENABLE_CLOUDINARY && (
                  <Button
                    onClick={handleRefreshCache}
                    disabled={refreshing}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Refreshing...' : 'Refresh Cache'}
                  </Button>
                )}

                {/* Cloudinary Status */}
                <div className="text-xs text-gray-500">
                  Cloudinary: {ENABLE_CLOUDINARY ? 'ON' : 'OFF'}
                </div>

                {/* Overlay Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">View with Overlay</span>
                  <Switch
                    checked={viewWithOverlay}
                    onCheckedChange={handleOverlayToggle}
                    disabled={regeneratingImages}
                  />
                </div>

                {/* Color Picker */}
                {viewWithOverlay && (
                  <>
                    <button
                      onClick={handleTogglePicker}
                      disabled={regeneratingImages}
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
                        cursor: regeneratingImages ? 'not-allowed' : 'pointer',
                        opacity: regeneratingImages ? 0.5 : 1,
                      }}
                    >
                      {regeneratingImages ? 'Updating...' : 'Pick Color'}
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

            {/* Database Stats */}
            {stats && (
              <div className="mt-2 text-xs text-gray-500">
                Database: {stats.total_logos} logos cached
                {stats.latest_update && (
                  <span className="ml-2">
                    • Last updated: {new Date(stats.latest_update).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Regenerating Images Indicator */}
            {regeneratingImages && (
              <div className="mt-2 text-xs text-blue-600 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" />
                Regenerating images...
              </div>
            )}
          </div>
        </div>

        <div className="pt-[60px] pb-[50px] block text-center">
          <h2 className="text-3xl font-bold">Logo Gallery - MiniSite Demo Example</h2>
          <p className="text-gray-600 mt-2">
            Showing {logos.length} logos from{' '}
            {dataSource === 'database' ? 'cached data' : 'live data'}
          </p>
        </div>

        <div className="max-w-[1000px] mx-auto px-6 pt-8 pb-[60px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {logos.map(logo => (
            <div key={logo.public_id} className="bg-white rounded shadow">
              <div
                className="bg-gray-100 m-0 cursor-pointer"
                onClick={() => handleImageClick(logo)}
              >
                <LazyLoadImage
                  key={logo.imageKey}
                  src={logo.thumbnailUrl}
                  alt={logo.title}
                  className="w-full h-auto block hover:opacity-90 transition-opacity"
                  aspectRatio="auto"
                />
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

        {/* Image Modal */}
        <ImageModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          logos={logos}
          currentIndex={modalImageIndex ?? 0}
          onPrev={() => setModalImageIndex(i => (i > 0 ? i - 1 : i))}
          onNext={() => setModalImageIndex(i => (i < logos.length - 1 ? i + 1 : i))}
        />
      </div>
    </>
  );
}
