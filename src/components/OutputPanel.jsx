'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function OutputPanel({ imageUrl, mappings, logoId, setLogoId }) {
  // const [logoId, setLogoId] = useState(defaultLogoId)
  const [generatedUrl, setGeneratedUrl] = useState('')

  const generateUrl = async () => {
    if (!logoId || mappings.length === 0) {
      alert('Add a logo ID and at least one placement area.')
      return
    }

    const imageName = imageUrl.split('/').pop()
    const folder = 'dfuecvdyc' // static for now
    const base = `https://res.cloudinary.com/${folder}/image/upload`

    const img = document.querySelector('img')
    if (!img?.complete) {
      alert('Image not fully loaded yet.')
      return
    }

    const displayW = img.clientWidth
    const displayH = img.clientHeight
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight

    const scaleX = naturalW / displayW
    const scaleY = naturalH / displayH

    const logoSize = await getImageSize(
      `https://res.cloudinary.com/${folder}/image/upload/${logoId}.png`
    )

    const transformations = mappings.map((m) => {
        const x = Math.round(m.x * scaleX)
        const y = Math.round(m.y * scaleY)
        const w = Math.round(m.w * scaleX)
        const h = Math.round(m.h * scaleY)

        // Fit the logo
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

        // Rule: if logo is too small in width or height compared to box, scale up
        const widthRatio = logoW / w;
        const heightRatio = logoH / h;

        const scaleThreshold = 0.6;
        const upscaleFactor = 1.3;

        if (widthRatio < scaleThreshold || heightRatio < scaleThreshold) {
            logoW = Math.round(logoW * upscaleFactor);
            logoH = Math.round(logoH * upscaleFactor);
        }

        // Center logo (even if overflow)
        const logoX = x + Math.round((w - logoW) / 2);
        const logoY = y + Math.round((h - logoH) / 2);

        return [
        `l_one_pixel_tn2oaa,w_${w},h_${h}`,
        `co_rgb:000000,e_colorize,fl_layer_apply,x_${x},y_${y},g_north_west`,
        `l_${logoId},w_${logoW},h_${logoH}`,
        `fl_layer_apply,x_${logoX},y_${logoY},g_north_west`,
      ].join('/')
    })

    const finalUrl = `${base}/${transformations.join('/')}/${imageName}`
    setGeneratedUrl(finalUrl)
  }

  const getImageSize = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = url
    })
  }

  return (
    <div className='p-4'>
      <h2 className="text-lg font-semibold mb-4">Generated Cloudinary URL</h2>
      
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-column gap-2">
          <Input
            placeholder="Logo public ID"
            value={logoId}
            onChange={(e) => setLogoId(e.target.value)}
          />
          <Button className={'cursor-pointer'} onClick={generateUrl}>Generate</Button>
          <Button
            className={'cursor-pointer'}
            variant="secondary"
            onClick={() => window.open(generatedUrl, '_blank')}
            disabled={!generatedUrl}
          >
            Open in New Tab
          </Button>
        </div>

        <Textarea
          className="text-xs font-mono h-40"
          value={generatedUrl}
          readOnly
        />
      </div>
    </div>
  )
}