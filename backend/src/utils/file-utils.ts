/**
 * File Utilities for SalesSync
 * Handles image compression, S3 uploads, and file processing
 */

import AWS from 'aws-sdk';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

export interface ImageCompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface S3UploadOptions {
  bucket: string;
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  fileInfo?: {
    size: number;
    type: string;
    dimensions?: { width: number; height: number };
  };
}

/**
 * Compress and optimize image
 * @param imageBuffer Original image buffer
 * @param options Compression options
 * @returns Compressed image buffer
 */
export async function compressImage(
  imageBuffer: Buffer,
  options: ImageCompressionOptions = {}
): Promise<Buffer> {
  const {
    quality = 80,
    maxWidth = 1920,
    maxHeight = 1080,
    format = 'jpeg'
  } = options;

  try {
    let sharpInstance = sharp(imageBuffer);

    // Get image metadata
    const metadata = await sharpInstance.metadata();

    // Resize if necessary
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
    }

    // Apply compression based on format
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ compressionLevel: 9 });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Upload file to S3
 * @param fileBuffer File buffer
 * @param options Upload options
 * @returns S3 object URL
 */
export async function uploadToS3(
  fileBuffer: Buffer,
  options: S3UploadOptions
): Promise<string> {
  try {
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: options.bucket,
      Key: options.key,
      Body: fileBuffer,
      ContentType: options.contentType,
      Metadata: options.metadata || {},
      ServerSideEncryption: 'AES256'
    };

    const result = await s3.upload(uploadParams).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Validate uploaded file
 * @param file File data
 * @param allowedTypes Allowed MIME types
 * @param maxSize Maximum file size in bytes
 * @returns Validation result
 */
export async function validateFile(
  file: { buffer: Buffer; mimetype: string; size: number },
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp'],
  maxSize: number = 10 * 1024 * 1024 // 10MB
): Promise<FileValidationResult> {
  const errors: string[] = [];

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
  }

  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // For images, get dimensions
  let dimensions: { width: number; height: number } | undefined;
  if (file.mimetype.startsWith('image/')) {
    try {
      const metadata = await sharp(file.buffer).metadata();
      dimensions = {
        width: metadata.width || 0,
        height: metadata.height || 0
      };

      // Check minimum dimensions
      if (dimensions.width < 100 || dimensions.height < 100) {
        errors.push('Image dimensions too small (minimum 100x100 pixels)');
      }
    } catch (error) {
      errors.push('Invalid image file');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    fileInfo: {
      size: file.size,
      type: file.mimetype,
      dimensions
    }
  };
}

/**
 * Generate unique filename
 * @param originalName Original filename
 * @param prefix Optional prefix
 * @returns Unique filename
 */
export function generateUniqueFilename(originalName: string, prefix?: string): string {
  const ext = path.extname(originalName);
  const uuid = uuidv4();
  const timestamp = Date.now();
  
  return prefix 
    ? `${prefix}-${timestamp}-${uuid}${ext}`
    : `${timestamp}-${uuid}${ext}`;
}

/**
 * Create thumbnail from image
 * @param imageBuffer Original image buffer
 * @param size Thumbnail size (width and height)
 * @returns Thumbnail buffer
 */
export async function createThumbnail(
  imageBuffer: Buffer,
  size: number = 200
): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.error('Thumbnail creation error:', error);
    throw new Error('Failed to create thumbnail');
  }
}

/**
 * Extract EXIF data from image
 * @param imageBuffer Image buffer
 * @returns EXIF data
 */
export async function extractExifData(imageBuffer: Buffer): Promise<any> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasProfile: metadata.hasProfile,
      hasAlpha: metadata.hasAlpha,
      exif: metadata.exif,
      icc: metadata.icc,
      iptc: metadata.iptc,
      xmp: metadata.xmp
    };
  } catch (error) {
    console.error('EXIF extraction error:', error);
    return null;
  }
}

/**
 * Watermark image
 * @param imageBuffer Original image buffer
 * @param watermarkText Watermark text
 * @returns Watermarked image buffer
 */
export async function addWatermark(
  imageBuffer: Buffer,
  watermarkText: string
): Promise<Buffer> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    
    // Create watermark SVG
    const watermarkSvg = `
      <svg width="${width}" height="${height}">
        <text x="50%" y="95%" 
              font-family="Arial, sans-serif" 
              font-size="${Math.max(width * 0.03, 20)}" 
              fill="rgba(255,255,255,0.7)" 
              text-anchor="middle"
              dominant-baseline="middle">
          ${watermarkText}
        </text>
      </svg>
    `;

    return await image
      .composite([{
        input: Buffer.from(watermarkSvg),
        gravity: 'southeast'
      }])
      .toBuffer();
  } catch (error) {
    console.error('Watermark error:', error);
    throw new Error('Failed to add watermark');
  }
}

/**
 * Convert image to different format
 * @param imageBuffer Original image buffer
 * @param format Target format
 * @param quality Quality (for lossy formats)
 * @returns Converted image buffer
 */
export async function convertImageFormat(
  imageBuffer: Buffer,
  format: 'jpeg' | 'png' | 'webp',
  quality: number = 80
): Promise<Buffer> {
  try {
    let sharpInstance = sharp(imageBuffer);

    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png();
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    console.error('Format conversion error:', error);
    throw new Error('Failed to convert image format');
  }
}

/**
 * Batch process images
 * @param images Array of image buffers
 * @param operations Array of operations to apply
 * @returns Processed images
 */
export async function batchProcessImages(
  images: Buffer[],
  operations: {
    compress?: ImageCompressionOptions;
    thumbnail?: { size: number };
    watermark?: { text: string };
    convert?: { format: 'jpeg' | 'png' | 'webp'; quality?: number };
  }
): Promise<Buffer[]> {
  const processed: Buffer[] = [];

  for (const imageBuffer of images) {
    let processedImage = imageBuffer;

    // Apply compression
    if (operations.compress) {
      processedImage = await compressImage(processedImage, operations.compress);
    }

    // Create thumbnail
    if (operations.thumbnail) {
      processedImage = await createThumbnail(processedImage, operations.thumbnail.size);
    }

    // Add watermark
    if (operations.watermark) {
      processedImage = await addWatermark(processedImage, operations.watermark.text);
    }

    // Convert format
    if (operations.convert) {
      processedImage = await convertImageFormat(
        processedImage,
        operations.convert.format,
        operations.convert.quality
      );
    }

    processed.push(processedImage);
  }

  return processed;
}

/**
 * Save file locally (for development/testing)
 * @param fileBuffer File buffer
 * @param filename Filename
 * @param directory Directory to save in
 * @returns File path
 */
export async function saveFileLocally(
  fileBuffer: Buffer,
  filename: string,
  directory: string = './uploads'
): Promise<string> {
  try {
    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const filePath = path.join(directory, filename);
    fs.writeFileSync(filePath, fileBuffer);
    
    return filePath;
  } catch (error) {
    console.error('Local file save error:', error);
    throw new Error('Failed to save file locally');
  }
}

/**
 * Delete file from S3
 * @param bucket S3 bucket name
 * @param key S3 object key
 * @returns Success status
 */
export async function deleteFromS3(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
}

/**
 * Get file from S3
 * @param bucket S3 bucket name
 * @param key S3 object key
 * @returns File buffer
 */
export async function getFromS3(bucket: string, key: string): Promise<Buffer> {
  try {
    const result = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    return result.Body as Buffer;
  } catch (error) {
    console.error('S3 get error:', error);
    throw new Error('Failed to get file from S3');
  }
}

/**
 * Generate signed URL for S3 object
 * @param bucket S3 bucket name
 * @param key S3 object key
 * @param expiresIn Expiration time in seconds
 * @returns Signed URL
 */
export function generateSignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600
): string {
  return s3.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: key,
    Expires: expiresIn
  });
}

export default {
  compressImage,
  uploadToS3,
  validateFile,
  generateUniqueFilename,
  createThumbnail,
  extractExifData,
  addWatermark,
  convertImageFormat,
  batchProcessImages,
  saveFileLocally,
  deleteFromS3,
  getFromS3,
  generateSignedUrl
};