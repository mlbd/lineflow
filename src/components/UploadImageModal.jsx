import React, { useState, useRef } from 'react'
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

const UploadImageModal = ({ open, onClose, onSelect }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef(null)

  const validateImageFile = (file) => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file (JPG, PNG, GIF, WebP, etc.)'
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return 'Image file size must be less than 10MB'
    }
    
    return null
  }

  const uploadToCloudinary = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('/api/cloudinary/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`)
    }
  }

  const handleFileUpload = async (file) => {
    setError(null)
    setSuccess(false)
    setUploadedImage(null)

    // Validate file
    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsUploading(true)

    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(file)
      
      setUploadedImage({
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        filename: file.name
      })
      
      setSuccess(true)
    } catch (error) {
      console.error('Upload error:', error)
      setError(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleUseAs = (type) => {
    if (uploadedImage) {
      if (type === 'background') {
        onSelect(uploadedImage.url, 'background')
      } else if (type === 'logo') {
        onSelect(uploadedImage.public_id, 'logo')
      }
      handleClose()
    }
  }

  const handleClose = () => {
    setIsDragging(false)
    setIsUploading(false)
    setUploadedImage(null)
    setError(null)
    setSuccess(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Upload Image</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Drag and drop an image here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-500 hover:text-blue-600 underline"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-gray-400">
                  Supports JPG, PNG, GIF, WebP (max 10MB)
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Success Message & Options */}
          {success && uploadedImage && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-600">
                  Image uploaded successfully!
                </p>
              </div>

              {/* Image Preview */}
              <div className="border rounded-lg p-4">
                <img
                  src={uploadedImage.url}
                  alt="Uploaded"
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <p className="text-sm text-gray-600">
                  {uploadedImage.filename} ({Math.round(uploadedImage.bytes / 1024)}KB)
                </p>
              </div>

              {/* Use As Options */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  How would you like to use this image?
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleUseAs('background')}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                  >
                    Use as Background
                  </button>
                  <button
                    onClick={() => handleUseAs('logo')}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                  >
                    Use as Logo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploadImageModal