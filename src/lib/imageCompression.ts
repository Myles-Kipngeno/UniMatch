/**
 * Client-side image compression utility for UniMatch.
 * Resizes large high-res photos to a max boundary (default 1200x1200)
 * and encodes them to lightweight JPEGs (~150KB-250KB) before uploading to Supabase.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<File> {
  // Skip non-images, animated GIFs, and vector SVGs
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate aspect-ratio scaled dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          return resolve(file)
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height)

        // Export as JPEG blob with compression quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file)
            }
            const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
            const compressedFilename = `${nameWithoutExt}.jpg`
            const compressedFile = new File([blob], compressedFilename, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })

            console.log(
              `[Image Compression] ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) -> ` +
              `${compressedFilename} (${(compressedFile.size / 1024).toFixed(1)} KB)`
            )

            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      }

      img.onerror = () => resolve(file)
    }

    reader.onerror = () => resolve(file)
  })
}
