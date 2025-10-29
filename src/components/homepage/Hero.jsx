import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '@/components/common/Header';

// [PATCH] Added: tiny animated ellipsis component (cycles 1..3 dots)
function Ellipsis({ active = true, interval = 350 }) {
  const [n, setN] = useState(1); // 1..3
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN(p => (p % 3) + 1), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  // Fixed width so text doesn't shift while dots change
  return (
    <span aria-hidden="true" className="inline-block align-baseline" style={{ width: '3ch' }}>
      {active ? '.'.repeat(n) : ''}
    </span>
  );
}

function Hero() {
  // Tooltip + flow state
  const [showTip, setShowTip] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'uploading' | 'generating'
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const router = typeof window !== 'undefined' ? require('next/router').useRouter() : null;

  // [PATCH] Added: drag-over highlight state
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef(null);

  // Cloudinary IMAGE formats only (as per your reference image)
  const ACCEPT_LABEL =
    'ⓘ Accepted files: PNG, JPG, JPEG, WEBP, BMP, TGA, TIFF, SVG, AVIF, ICO, HEIC, HEIF, GIF';
  const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,.bmp,.tga,.tif,.tiff,.svg,.avif,.ico,.heic,.heif,.gif';

  const triggerChoose = useCallback(() => {
    if (busy) return;
    inputRef.current?.click();
  }, [busy]);

  // Upload via our server route (keeps secrets private)
  const uploadViaServer = useCallback(async file => {
    // UI: start and smoothly reach 50%
    setPhase('uploading');
    setBusy(true);
    setProgress(10);
    const t = setInterval(() => {
      setProgress(p => (p < 50 ? Math.min(50, p + 4) : p));
    }, 120);

    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/upload/logo', { method: 'POST', body: form });
    clearInterval(t);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Upload failed:', txt);
      setBusy(false);
      setPhase('idle');
      setProgress(0);
      throw new Error('Upload failed');
    }
    const json = await res.json();
    console.log('Cloudinary upload result:', json);
    return {
      public_id: json.public_id,
      secure_url: json.secure_url,
      width: json.width, // [PATCH] Added
      height: json.height, // [PATCH] Added
      format: json.format, // [PATCH] Added
      bytes: json.bytes, // [PATCH] Added
    };
  }, []);

  const createCatalog = useCallback(
    async ({ public_id, secure_url, width, height, format, bytes }) => {
      // Run the “second half” while we wait for WP
      setPhase('generating');
      const t = setInterval(() => {
        setProgress(p => (p < 95 ? Math.min(95, p + 2) : p));
      }, 120);

      try {
        // Your existing WP proxy route should accept this payload
        // [PATCH] Updated: send full Cloudinary URL as `catalog_logo`
        const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME; // safe to expose (no secret)
        // Prefer secure_url from our server upload route; fall back to composed URL if needed.
        const catalog_logo =
          (typeof secure_url !== 'undefined' && secure_url) ||
          (cloud && public_id
            ? `https://res.cloudinary.com/${cloud}/image/upload/${public_id}.${format}`
            : '');

        const res = await fetch('/api/wp/create-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_logo,
            public_id,
            width,
            height,
            format,
            bytes,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || 'create-catalog failed');
        }

        setProgress(100);

        // Expect { slug: "some-slug" } or { url: "/some-slug" }
        const slugOrUrl = data?.url || data?.slug || '';
        const path = slugOrUrl?.startsWith('/') ? slugOrUrl : `/${slugOrUrl}`;
        if (path && typeof window !== 'undefined') {
          // [PATCH] Prefetch CRITICAL images (incl. all color variants) + optionally prime ISR first
          const prefetchCritical = async () => {
            try {
              const url = `/api/prefetchProducts/${encodeURIComponent(path.replace(/^\//,''))}?scope=critical&primeIsr=1`;
              await Promise.race([
                fetch(url, {
                  method: 'POST',
                  headers: {
                    // If you secure with a secret, inject from env here for client-initiated calls,
                    // or set PREFETCH_ALLOW_PUBLIC=1 on server and rate-limit per IP for 'critical' scope.
                    // Authorization: `Bearer ${process.env.NEXT_PUBLIC_PREFETCH_PUBLIC_TOKEN || ''}`
                  },
                }),
                new Promise(resolve => setTimeout(resolve, 1200)), // hard cap
              ]);
            } catch {}
          };

          await prefetchCritical();
          // Prefer SPA nav; falls back to hard nav if router is not available
          if (router?.push) router.push(path);
          else window.location.href = path;
        }
      } finally {
        clearInterval(t);
        setBusy(false);
      }
    },
    [router]
  );

  const onFiles = useCallback(
    async files => {
      const file = files?.[0];
      if (!file) return;
      try {
        const { public_id, secure_url, width, height, format, bytes } = await uploadViaServer(file);
        +(await createCatalog({ public_id, secure_url, width, height, format, bytes }));
      } catch (e) {
        console.error(e);
      }
    },
    [uploadViaServer, createCatalog]
  );

  const onDrop = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      setDragOver(false);
      onFiles(e.dataTransfer?.files);
    },
    [busy, onFiles]
  );

  // [PATCH] Updated: highlight drop zone on dragover/enter/leave
  const onDragOver = useCallback(
    e => {
      e.preventDefault();
      if (busy) return;
      setDragOver(true);
    },
    [busy]
  );
  const onDragEnter = useCallback(
    e => {
      e.preventDefault();
      if (busy) return;
      setDragOver(true);
    },
    [busy]
  );
  const onDragLeave = useCallback(e => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <>
      <div className="pt-6 pb-[100px] relative flex flex-col justify-start items-center gap-12 bg-[url('/bg-hero.jpg')] bg-bottom bg-cover h-screen md:min-h-[850px]">
        <Header />

        {/* Full overlay element */}
        <div className="absolute inset-0 w-full h-full z-0">
          <div className="container mx-auto h-full flex items-center justify-between relative">
            <img
              src="/hero-left.png"
              alt="Hero Left"
              className="absolute left-0 bottom-[5%] w-1/3 h-auto"
            />
            <img
              src="/hero-right.png"
              alt="Hero Right"
              className="absolute right-0 bottom-[5%] w-1/3 h-auto"
            />
          </div>
        </div>

        <div className="flex flex-col justify-start items-center gap-4 relative z-1">
          <div className="self-stretch text-center justify-start leading-[1.2]">
            <span className="text-secondary text-[64px] font-bold">Upload </span>
            <span className="text-tertiary text-[64px] font-bold">
              Your Logo. <br />
            </span>
            <span className="text-secondary text-[64px] font-bold">Get Your </span>
            <span className="text-tertiary text-[64px] font-bold">Catalog Instantly.</span>
          </div>
          <div className="text-center justify-start text-[#4b4b4b] text-xl font-normal leading-7">
            Create a catalog with one upload — print products with your logo.
          </div>
        </div>

        <div className="max-w-[1200px] px-5 flex flex-col justify-start items-center gap-10 relative z-1 mt-5">
          <div className="w-full flex flex-col md:flex-row justify-center items-start gap-8">
            {/* Left content (keep your existing copy/image if you had it) */}
            <div className="flex-1 min-w-0" />

            {/* Upload card */}
            <div className="inline-flex flex-col justify-start items-end gap-5 md:min-w-[440px]">
              <div className="upload-wrapper group self-stretch p-[30px] bg-white rounded-[20px] shadow-[8px_-21px_30px_0px_rgba(0,0,0,0.04)] flex flex-col justify-start items-center gap-5">
                {/* Upload area – clickable + droppable */}
                <div
                  // [PATCH] Updated: visual highlight on drag-over + disabled styling while busy + hover effects
                  className={[
                    'upload-drag-wrap',
                    'self-stretch px-6 py-10 rounded-[18px] outline flex flex-col justify-start items-center gap-6 transition-all duration-300',
                    busy
                      ? 'bg-slate-100 opacity-60 cursor-not-allowed pointer-events-none' // [PATCH] Added: disabled visuals
                      : 'bg-primary-100 cursor-pointer group-hover:bg-tertiary/10', // [PATCH] Added: parent hover effect
                    dragOver && !busy
                      ? 'ring-2 ring-tertiary ring-offset-2 ring-offset-white/60 bg-primary-200/70'
                      : '',
                  ].join(' ')}
                  // [PATCH] Added: helpful attributes for state
                  aria-disabled={busy}
                  data-disabled={busy ? 'true' : 'false'}
                  title={busy ? 'Uploading… Please wait' : undefined}
                  onClick={triggerChoose}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                >
                  <div className="flex flex-col justify-start items-center gap-2">
                    <div className="inline-flex justify-start items-center gap-4">
                      <img src="/cloud-up.svg" alt="Upload" className="w-[40px] h-auto" />
                      <div className="text-tertiary text-base font-semibold leading-snug">
                        Drag and drop <br />a logo to upload
                      </div>
                    </div>
                    <div className="text-center text-[#4b4b4b] text-base font-normal leading-snug">
                      or
                    </div>
                    <div className="pt-2 flex flex-col justify-start items-start gap-2.5">
                      <button
                        type="button"
                        data-icon-left="true"
                        data-property-1="Outline Small"
                        className="px-6 py-3 bg-white rounded-[100px] inline-flex justify-center items-center gap-1.5"
                        onClick={e => {
                          e.stopPropagation();
                          triggerChoose();
                        }}
                        disabled={busy}
                      >
                        <img
                          src="/upload.svg"
                          alt="Upload"
                          className="w-[16px] h-auto inline mr-2"
                        />
                        <span className="text-tertiary text-base font-semibold leading-snug">
                          Choose File
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* [PATCH] Added: subtle inline notice when disabled */}
                  {busy && (
                    <div className="text-xs text-slate-600">
                      Upload is disabled while processing…
                    </div>
                  )}

                  {/* Tooltip trigger + content */}
                  <div
                    className="relative text-center text-tertiary text-base font-normal leading-snug"
                    onMouseEnter={() => setShowTip(true)}
                    onMouseLeave={() => setShowTip(false)}
                    onFocus={() => setShowTip(true)}
                    onBlur={() => setShowTip(false)}
                  >
                    <button type="button" className="text-sm mr-1 cloudinary-info">
                      ⓘ
                    </button>
                    Preferred Logo Quality
                    {showTip && (
                      <div className="absolute left-1/2 -translate-x-1/2 mt-2 px-4 py-2 bg-[#1b1449] text-white text-xs rounded-lg shadow-lg w-full z-20">
                        {ACCEPT_LABEL}
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#1b1449]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Button ⇄ Progress UI */}
                {phase === 'idle' ? (
                  <div
                    data-icon-left="false"
                    data-property-1="Default"
                    className="progress-bar-wrap self-stretch px-6 py-4 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] inline-flex justify-center items-center gap-1.5 relative overflow-hidden transition-all duration-300 group-hover:bg-tertiary/90 group-hover:shadow-[4px_4px_15px_0px_rgba(13,0,113,0.25)]"
                  >
                    <button
                      type="button"
                      className="text-white text-base font-semibold leading-snug cursor-pointer relative z-10"
                      onClick={triggerChoose}
                      disabled={busy}
                    >
                      Upload My Logo
                    </button>
                  </div>
                ) : (
                  <div className="self-stretch bg-white rounded-[100px] relative overflow-hidden">
                    {/* [PATCH] Added: Sine wave shimmer effect inside progress bar */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-sine-wave-fast" />

                    <div className="w-full h-[54px] bg-white rounded-full border border-tertiary/20 overflow-hidden px-[4px] py-[4px] relative">
                      <div
                        className="h-full min-w-[150px] bg-tertiary rounded-full transition-[width] duration-300 ease-out flex justify-center items-center relative overflow-hidden"
                        style={{ width: `${progress}%` }}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        {/* [PATCH] Added: Sine wave shimmer effect inside progress bar */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-sine-wave-fast" />

                        <div className="flex align-center relative z-10">
                          <img src="/ai-icon.png" alt="" className="w-5 h-5 relative mr-2" />
                          <span className="text-sm font-medium text-white">
                            {phase === 'uploading' ? 'Uploading' : 'Generating'}
                            {/* [PATCH] Added: animated trailing dots */}
                            <Ellipsis active={phase !== 'idle'} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hidden input */}
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={e => onFiles(e.target.files)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Hero;
