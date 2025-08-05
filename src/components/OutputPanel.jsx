'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export default function OutputPanel({ imageUrl, mappings, logoId, setLogoId }) {
  const [overlayUrl, setOverlayUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const getImageSize = useCallback(url => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to load image: ' + url));
      img.src = url;
    });
  }, []);

  // Wrap generateUrls in useCallback!
  const generateUrls = useCallback(async () => {
    if (mappings.length === 0) {
      setOverlayUrl('');
      setLogoUrl('');
      return;
    }

    const imageName = imageUrl.split('/').pop();
    const base = `https://res.cloudinary.com/${cloudName}/image/upload`;

    const img = document.querySelector('img');
    if (!img?.complete) {
      console.warn('Image not fully loaded yet.');
      return;
    }

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    try {
      const overlayTransformations = mappings.map(m => {
        let x, y, w, h;
        if (
          m.xPercent !== undefined &&
          m.yPercent !== undefined &&
          m.wPercent !== undefined &&
          m.hPercent !== undefined
        ) {
          x = Math.round(m.xPercent * naturalW);
          y = Math.round(m.yPercent * naturalH);
          w = Math.round(m.wPercent * naturalW);
          h = Math.round(m.hPercent * naturalH);
        } else {
          const displayW = img.clientWidth;
          const displayH = img.clientHeight;
          const scaleX = naturalW / displayW;
          const scaleY = naturalH / displayH;

          x = Math.round(m.x * scaleX);
          y = Math.round(m.y * scaleY);
          w = Math.round(m.w * scaleX);
          h = Math.round(m.h * scaleY);
        }
        return [
          `l_one_pixel_s4c3vt,w_${w},h_${h}`,
          `co_rgb:000000,e_colorize,fl_layer_apply,x_${x},y_${y},g_north_west`,
        ].join('/');
      });

      const overlayOnlyUrl = `${base}/${overlayTransformations.join('/')}/${imageName}`;
      setOverlayUrl(overlayOnlyUrl);

      if (logoId) {
        const logoSize = await getImageSize(
          `https://res.cloudinary.com/${cloudName}/image/upload/${logoId}.png`
        );

        const logoTransformations = mappings.map(m => {
          let x, y, w, h;
          if (
            m.xPercent !== undefined &&
            m.yPercent !== undefined &&
            m.wPercent !== undefined &&
            m.hPercent !== undefined
          ) {
            x = Math.round(m.xPercent * naturalW);
            y = Math.round(m.yPercent * naturalH);
            w = Math.round(m.wPercent * naturalW);
            h = Math.round(m.hPercent * naturalH);
          } else {
            const displayW = img.clientWidth;
            const displayH = img.clientHeight;
            const scaleX = naturalW / displayW;
            const scaleY = naturalH / displayH;

            x = Math.round(m.x * scaleX);
            y = Math.round(m.y * scaleY);
            w = Math.round(m.w * scaleX);
            h = Math.round(m.h * scaleY);
          }

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

          const widthRatio = logoW / w;
          const heightRatio = logoH / h;

          const scaleThreshold = 0.6;
          const upscaleFactor = 1.3;

          if (widthRatio < scaleThreshold || heightRatio < scaleThreshold) {
            logoW = Math.round(logoW * upscaleFactor);
            logoH = Math.round(logoH * upscaleFactor);
          }

          const logoX = x + Math.round((w - logoW) / 2);
          const logoY = y + Math.round((h - logoH) / 2);

          return [
            `l_one_pixel_s4c3vt,w_${w},h_${h}`,
            `co_rgb:000000,e_colorize,fl_layer_apply,x_${x},y_${y},g_north_west`,
            `l_${logoId},w_${logoW},h_${logoH}`,
            `fl_layer_apply,x_${logoX},y_${logoY},g_north_west`,
          ].join('/');
        });

        const finalLogoUrl = `${base}/${logoTransformations.join('/')}/${imageName}`;
        setLogoUrl(finalLogoUrl);
      } else {
        setLogoUrl('');
      }
    } catch (error) {
      console.error('Error generating URLs:', error);
      setOverlayUrl('');
      setLogoUrl('');
    }
  }, [imageUrl, mappings, logoId, getImageSize]);

  // Now, add generateUrls to effect deps (safe)
  useEffect(() => {
    generateUrls();
  }, [generateUrls]);

  const hasOverlayUrl = overlayUrl && mappings.length > 0;
  const hasLogoUrl = logoUrl && mappings.length > 0 && logoId;

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Generated Cloudinary URL</h2>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-column gap-2">
          <Input
            placeholder="Logo public ID"
            value={logoId}
            onChange={e => setLogoId(e.target.value)}
          />
          <Button
            className={'cursor-pointer'}
            onClick={() => window.open(overlayUrl, '_blank')}
            disabled={!hasOverlayUrl}
          >
            View Overlay Map
          </Button>
          <Button
            className={'cursor-pointer'}
            onClick={() => window.open(logoUrl, '_blank')}
            disabled={!hasLogoUrl}
          >
            Open with Logo in Browser
          </Button>
        </div>
        <Textarea
          className="text-xs font-mono h-40"
          value={`Overlay URL: ${overlayUrl}\n\nLogo URL: ${logoUrl}`}
          readOnly
        />
      </div>
    </div>
  );
}
