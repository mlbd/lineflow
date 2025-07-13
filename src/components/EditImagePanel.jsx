'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { X, RefreshCw } from 'lucide-react'

// Cache object to store fetched images
const imageCache = new Map()

export default function EditImagePanel({ open, onClose, onSelect }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  
  const observer = useRef()
  const scrollContainerRef = useRef()

  // Generate cache key based on page and cursor
  const generateCacheKey = (pageNum, cursor) => {
    return `page_${pageNum}_cursor_${cursor || 'null'}`
  }

  // Function to fetch images with caching
  const fetchImages = useCallback(async (pageNum = 1, cursor = null, reset = false, forceRefresh = false) => {
    // Prevent multiple simultaneous requests
    if (loading || loadingMore) return
    
    const cacheKey = generateCacheKey(pageNum, cursor)
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh && imageCache.has(cacheKey)) {
      console.log('Using cached data for:', cacheKey)
      const cachedData = imageCache.get(cacheKey)
      
      if (reset) {
        setImages(cachedData.images)
        setHasMore(cachedData.hasMore)
        setNextCursor(cachedData.nextCursor)
        setPage(pageNum)
      } else {
        setImages(prev => [...prev, ...cachedData.images])
        setHasMore(cachedData.hasMore)
        setNextCursor(cachedData.nextCursor)
        setPage(pageNum)
      }
      return
    }
    
    if (reset) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }
    
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '3',
      })
      
      if (cursor) {
        params.append('next_cursor', cursor)
      }
      
      console.log('Fetching from Cloudinary:', cacheKey)
      const response = await fetch(`/api/cloudinary/images?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch images')
      }
      
      const newImages = data.resources || []
      
      // Check if we have more images to load
      const hasMoreImages = newImages.length === 3 && (data.pagination?.has_more !== false)
      const newNextCursor = data.pagination?.next_cursor || null
      
      // Cache the fetched data immediately
      imageCache.set(cacheKey, {
        images: newImages,
        hasMore: hasMoreImages,
        nextCursor: newNextCursor,
        timestamp: Date.now()
      })
      
      if (reset) {
        setImages(newImages)
      } else {
        setImages(prev => [...prev, ...newImages])
      }
      
      setHasMore(hasMoreImages)
      setNextCursor(newNextCursor)
      setPage(pageNum)
      
    } catch (err) {
      setError(err.message)
      console.error('Error fetching images:', err)
      if (reset) {
        setImages([])
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Function to clear cache and refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    
    // Clear all cache
    imageCache.clear()
    console.log('Cache cleared')
    
    // Reset state
    setImages([])
    setPage(1)
    setNextCursor(null)
    setHasMore(true)
    setError(null)
    setLoading(false)
    setLoadingMore(false)
    
    // Fetch fresh data
    fetchImages(1, null, true, true).finally(() => {
      setRefreshing(false)
    })
  }, [fetchImages])

  // Load initial images when panel opens
  useEffect(() => {
    if (open) {
      // Reset state when opening
      setImages([])
      setPage(1)
      setNextCursor(null)
      setHasMore(true)
      setError(null)
      setLoading(false)
      setLoadingMore(false)
      
      fetchImages(1, null, true)
    }
  }, [open, fetchImages])

  // Intersection Observer callback for infinite scroll
  const lastImageElementRef = useCallback(node => {
    if (loading || loadingMore || !hasMore) return
    if (observer.current) observer.current.disconnect()
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        console.log('Loading more images...') // Debug log
        fetchImages(page + 1, nextCursor)
      }
    }, {
      threshold: 0.5, // Trigger when 50% of element is visible
      rootMargin: '20px' // Trigger 20px before element comes into view
    })
    
    if (node) observer.current.observe(node)
  }, [loading, loadingMore, hasMore, page, nextCursor, fetchImages])

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect()
    }
  }, [])

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-[300px] bg-white shadow-lg z-50 border-r transform transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Choose Image</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh images"
          >
            <RefreshCw 
              size={18} 
              className={`${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <Input placeholder="Search (not functional yet)" />
      </div>

      {/* Cache info for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b">
          Cache entries: {imageCache.size}
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        className="px-4 space-y-2 overflow-y-auto h-[calc(100vh-150px)]"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            Error: {error}
          </div>
        ) : images.length === 0 ? (
          <div className="text-sm text-muted-foreground">No images found.</div>
        ) : (
          <>
            {images.map((img, index) => (
              <div
                key={img.public_id}
                ref={index === images.length - 1 ? lastImageElementRef : null}
                onClick={() => {
                  onSelect(img.url)
                  onClose()
                }}
                className="cursor-pointer border rounded hover:bg-muted transition"
              >
                <img
                  src={img.url}
                  alt={img.public_id}
                  className="w-full h-auto rounded"
                  loading="lazy"
                />
              </div>
            ))}
            
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
              </div>
            )}
            
            {/* End of results indicator */}
            {!hasMore && images.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No more images
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Image count footer */}
      {images.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-4 py-2 border-t">
          <div className="text-xs text-muted-foreground text-center">
            Showing {images.length} images
          </div>
        </div>
      )}
    </div>
  )
}