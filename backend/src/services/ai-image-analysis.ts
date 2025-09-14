/**
 * AI Image Analysis Service for SalesSync
 * Handles brand recognition, share-of-voice calculation, and image quality analysis
 */

import * as tf from '@tensorflow/tfjs-node';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ImageAnalysisOptions {
  type: 'brand_analysis' | 'quality_check' | 'shelf_analysis' | 'asset_audit';
  companyId: string;
  brandIds?: string[];
  productIds?: string[];
}

export interface BrandAnalysisResult {
  brandVisibility: number; // 0-100 percentage
  shelfShare: number; // 0-100 percentage
  competitorPresence: CompetitorBrand[];
  qualityScore: number; // 0-100
  recommendations: string[];
  detectedProducts: DetectedProduct[];
  shelfAnalysis: ShelfAnalysis;
}

export interface CompetitorBrand {
  name: string;
  confidence: number;
  boundingBox: BoundingBox;
  shelfShare: number;
}

export interface DetectedProduct {
  productId?: string;
  name: string;
  confidence: number;
  boundingBox: BoundingBox;
  quantity: number;
  placement: 'eye_level' | 'top_shelf' | 'bottom_shelf' | 'end_cap';
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShelfAnalysis {
  totalShelfSpace: number;
  brandShelfSpace: number;
  competitorShelfSpace: number;
  emptySpace: number;
  shelfLevels: ShelfLevel[];
}

export interface ShelfLevel {
  level: number;
  height: 'eye_level' | 'top_shelf' | 'bottom_shelf';
  products: DetectedProduct[];
  brandShare: number;
}

export interface QualityAnalysis {
  overallScore: number;
  lighting: number;
  focus: number;
  composition: number;
  brandVisibility: number;
  issues: string[];
  suggestions: string[];
}

/**
 * Analyze image for brand presence and shelf share
 * @param imageBuffer Image buffer
 * @param options Analysis options
 * @returns Brand analysis result
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  options: ImageAnalysisOptions
): Promise<BrandAnalysisResult> {
  try {
    // Load company brands and products
    const brands = await loadCompanyBrands(options.companyId);
    const products = await loadCompanyProducts(options.companyId);
    
    // Preprocess image
    const processedImage = await preprocessImage(imageBuffer);
    
    // Perform different types of analysis
    switch (options.type) {
      case 'brand_analysis':
        return await performBrandAnalysis(processedImage, brands, products);
      case 'shelf_analysis':
        return await performShelfAnalysis(processedImage, brands, products);
      case 'quality_check':
        const qualityResult = await performQualityAnalysis(processedImage);
        return convertQualityToBrandResult(qualityResult);
      case 'asset_audit':
        return await performAssetAudit(processedImage, brands);
      default:
        throw new Error('Invalid analysis type');
    }
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Failed to analyze image');
  }
}

/**
 * Preprocess image for AI analysis
 * @param imageBuffer Original image buffer
 * @returns Preprocessed image tensor
 */
async function preprocessImage(imageBuffer: Buffer): Promise<tf.Tensor> {
  // Resize and normalize image
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  // Resize to standard size for analysis
  const resized = await image
    .resize(640, 480, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer();
  
  // Convert to tensor
  const tensor = tf.tensor3d(
    new Uint8Array(resized),
    [480, 640, 3],
    'int32'
  );
  
  // Normalize to [0, 1]
  return tensor.div(255.0);
}

/**
 * Perform brand analysis on image
 * @param imageTensor Preprocessed image tensor
 * @param brands Company brands
 * @param products Company products
 * @returns Brand analysis result
 */
async function performBrandAnalysis(
  imageTensor: tf.Tensor,
  brands: any[],
  products: any[]
): Promise<BrandAnalysisResult> {
  // Mock implementation - in production, use trained models
  const mockResult: BrandAnalysisResult = {
    brandVisibility: Math.random() * 100,
    shelfShare: Math.random() * 100,
    competitorPresence: [
      {
        name: 'Competitor A',
        confidence: 0.85,
        boundingBox: { x: 100, y: 150, width: 200, height: 100 },
        shelfShare: 25
      }
    ],
    qualityScore: 85,
    recommendations: [
      'Improve product placement at eye level',
      'Increase brand signage visibility',
      'Consider end-cap placement for key products'
    ],
    detectedProducts: [
      {
        name: products[0]?.name || 'Product A',
        confidence: 0.92,
        boundingBox: { x: 50, y: 100, width: 150, height: 80 },
        quantity: 3,
        placement: 'eye_level'
      }
    ],
    shelfAnalysis: {
      totalShelfSpace: 1000,
      brandShelfSpace: 350,
      competitorShelfSpace: 500,
      emptySpace: 150,
      shelfLevels: [
        {
          level: 1,
          height: 'eye_level',
          products: [],
          brandShare: 40
        }
      ]
    }
  };
  
  // Dispose tensor
  imageTensor.dispose();
  
  return mockResult;
}

/**
 * Perform detailed shelf analysis
 * @param imageTensor Preprocessed image tensor
 * @param brands Company brands
 * @param products Company products
 * @returns Shelf analysis result
 */
async function performShelfAnalysis(
  imageTensor: tf.Tensor,
  brands: any[],
  products: any[]
): Promise<BrandAnalysisResult> {
  // Advanced shelf analysis implementation
  const shelfLevels = await detectShelfLevels(imageTensor);
  const detectedProducts = await detectProductsOnShelves(imageTensor, products);
  const competitors = await detectCompetitorBrands(imageTensor);
  
  const totalShelfSpace = shelfLevels.reduce((sum, level) => sum + level.products.length * 100, 0);
  const brandShelfSpace = detectedProducts.reduce((sum, product) => sum + 100, 0);
  const competitorShelfSpace = competitors.reduce((sum, comp) => sum + comp.shelfShare, 0);
  
  const result: BrandAnalysisResult = {
    brandVisibility: (brandShelfSpace / totalShelfSpace) * 100,
    shelfShare: (brandShelfSpace / (brandShelfSpace + competitorShelfSpace)) * 100,
    competitorPresence: competitors,
    qualityScore: await calculateImageQuality(imageTensor),
    recommendations: generateRecommendations(detectedProducts, competitors),
    detectedProducts,
    shelfAnalysis: {
      totalShelfSpace,
      brandShelfSpace,
      competitorShelfSpace,
      emptySpace: totalShelfSpace - brandShelfSpace - competitorShelfSpace,
      shelfLevels
    }
  };
  
  imageTensor.dispose();
  return result;
}

/**
 * Perform image quality analysis
 * @param imageTensor Preprocessed image tensor
 * @returns Quality analysis result
 */
async function performQualityAnalysis(imageTensor: tf.Tensor): Promise<QualityAnalysis> {
  // Calculate various quality metrics
  const lighting = await calculateLightingScore(imageTensor);
  const focus = await calculateFocusScore(imageTensor);
  const composition = await calculateCompositionScore(imageTensor);
  const brandVisibility = await calculateBrandVisibilityScore(imageTensor);
  
  const overallScore = (lighting + focus + composition + brandVisibility) / 4;
  
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  if (lighting < 60) {
    issues.push('Poor lighting conditions');
    suggestions.push('Improve lighting or use flash');
  }
  
  if (focus < 70) {
    issues.push('Image appears blurry');
    suggestions.push('Hold camera steady and ensure proper focus');
  }
  
  if (composition < 50) {
    issues.push('Poor composition');
    suggestions.push('Center the subject and follow rule of thirds');
  }
  
  if (brandVisibility < 60) {
    issues.push('Brand elements not clearly visible');
    suggestions.push('Get closer to brand elements or adjust angle');
  }
  
  return {
    overallScore,
    lighting,
    focus,
    composition,
    brandVisibility,
    issues,
    suggestions
  };
}

/**
 * Perform asset audit analysis
 * @param imageTensor Preprocessed image tensor
 * @param brands Company brands
 * @returns Asset audit result
 */
async function performAssetAudit(
  imageTensor: tf.Tensor,
  brands: any[]
): Promise<BrandAnalysisResult> {
  // Detect company assets in the image
  const detectedAssets = await detectBrandAssets(imageTensor, brands);
  
  const result: BrandAnalysisResult = {
    brandVisibility: detectedAssets.length > 0 ? 80 : 20,
    shelfShare: 0, // Not applicable for asset audit
    competitorPresence: [],
    qualityScore: await calculateImageQuality(imageTensor),
    recommendations: generateAssetRecommendations(detectedAssets),
    detectedProducts: [], // Assets, not products
    shelfAnalysis: {
      totalShelfSpace: 0,
      brandShelfSpace: 0,
      competitorShelfSpace: 0,
      emptySpace: 0,
      shelfLevels: []
    }
  };
  
  imageTensor.dispose();
  return result;
}

/**
 * Load company brands from database
 * @param companyId Company ID
 * @returns Array of brands
 */
async function loadCompanyBrands(companyId: string): Promise<any[]> {
  return await prisma.brand.findMany({
    where: { companyId },
    include: {
      products: true
    }
  });
}

/**
 * Load company products from database
 * @param companyId Company ID
 * @returns Array of products
 */
async function loadCompanyProducts(companyId: string): Promise<any[]> {
  return await prisma.product.findMany({
    where: { companyId }
  });
}

/**
 * Detect shelf levels in image
 * @param imageTensor Image tensor
 * @returns Array of shelf levels
 */
async function detectShelfLevels(imageTensor: tf.Tensor): Promise<ShelfLevel[]> {
  // Mock implementation - in production, use computer vision
  return [
    {
      level: 1,
      height: 'top_shelf',
      products: [],
      brandShare: 20
    },
    {
      level: 2,
      height: 'eye_level',
      products: [],
      brandShare: 60
    },
    {
      level: 3,
      height: 'bottom_shelf',
      products: [],
      brandShare: 30
    }
  ];
}

/**
 * Detect products on shelves
 * @param imageTensor Image tensor
 * @param products Company products
 * @returns Array of detected products
 */
async function detectProductsOnShelves(
  imageTensor: tf.Tensor,
  products: any[]
): Promise<DetectedProduct[]> {
  // Mock implementation
  return products.slice(0, 3).map((product, index) => ({
    productId: product.id,
    name: product.name,
    confidence: 0.8 + Math.random() * 0.2,
    boundingBox: {
      x: 50 + index * 100,
      y: 100 + index * 50,
      width: 80,
      height: 120
    },
    quantity: Math.floor(Math.random() * 5) + 1,
    placement: index === 1 ? 'eye_level' : index === 0 ? 'top_shelf' : 'bottom_shelf'
  }));
}

/**
 * Detect competitor brands
 * @param imageTensor Image tensor
 * @returns Array of competitor brands
 */
async function detectCompetitorBrands(imageTensor: tf.Tensor): Promise<CompetitorBrand[]> {
  // Mock implementation
  const competitors = ['Competitor A', 'Competitor B', 'Competitor C'];
  
  return competitors.slice(0, Math.floor(Math.random() * 3) + 1).map((name, index) => ({
    name,
    confidence: 0.7 + Math.random() * 0.3,
    boundingBox: {
      x: 200 + index * 120,
      y: 80 + index * 40,
      width: 100,
      height: 80
    },
    shelfShare: Math.random() * 40
  }));
}

/**
 * Calculate lighting score
 * @param imageTensor Image tensor
 * @returns Lighting score (0-100)
 */
async function calculateLightingScore(imageTensor: tf.Tensor): Promise<number> {
  // Calculate average brightness and contrast
  const mean = tf.mean(imageTensor);
  const meanValue = await mean.data();
  mean.dispose();
  
  // Convert to score (0-100)
  const brightness = meanValue[0] * 100;
  
  // Optimal brightness is around 50-70%
  if (brightness >= 40 && brightness <= 80) {
    return Math.min(100, brightness + 20);
  } else if (brightness < 40) {
    return brightness * 1.5; // Too dark
  } else {
    return Math.max(0, 120 - brightness); // Too bright
  }
}

/**
 * Calculate focus score
 * @param imageTensor Image tensor
 * @returns Focus score (0-100)
 */
async function calculateFocusScore(imageTensor: tf.Tensor): Promise<number> {
  // Calculate image sharpness using Laplacian variance
  // Mock implementation
  return 70 + Math.random() * 30;
}

/**
 * Calculate composition score
 * @param imageTensor Image tensor
 * @returns Composition score (0-100)
 */
async function calculateCompositionScore(imageTensor: tf.Tensor): Promise<number> {
  // Analyze composition using rule of thirds, symmetry, etc.
  // Mock implementation
  return 60 + Math.random() * 40;
}

/**
 * Calculate brand visibility score
 * @param imageTensor Image tensor
 * @returns Brand visibility score (0-100)
 */
async function calculateBrandVisibilityScore(imageTensor: tf.Tensor): Promise<number> {
  // Analyze how visible brand elements are
  // Mock implementation
  return 65 + Math.random() * 35;
}

/**
 * Calculate overall image quality
 * @param imageTensor Image tensor
 * @returns Quality score (0-100)
 */
async function calculateImageQuality(imageTensor: tf.Tensor): Promise<number> {
  const lighting = await calculateLightingScore(imageTensor);
  const focus = await calculateFocusScore(imageTensor);
  const composition = await calculateCompositionScore(imageTensor);
  
  return (lighting + focus + composition) / 3;
}

/**
 * Detect brand assets in image
 * @param imageTensor Image tensor
 * @param brands Company brands
 * @returns Array of detected assets
 */
async function detectBrandAssets(imageTensor: tf.Tensor, brands: any[]): Promise<any[]> {
  // Mock implementation for asset detection
  return [
    {
      type: 'refrigerator',
      brand: brands[0]?.name || 'Brand A',
      condition: 'good',
      confidence: 0.9
    }
  ];
}

/**
 * Generate recommendations based on analysis
 * @param products Detected products
 * @param competitors Detected competitors
 * @returns Array of recommendations
 */
function generateRecommendations(
  products: DetectedProduct[],
  competitors: CompetitorBrand[]
): string[] {
  const recommendations: string[] = [];
  
  // Analyze product placement
  const eyeLevelProducts = products.filter(p => p.placement === 'eye_level');
  if (eyeLevelProducts.length === 0) {
    recommendations.push('Move products to eye level for better visibility');
  }
  
  // Analyze competitor presence
  if (competitors.length > products.length) {
    recommendations.push('Increase brand presence to compete with competitors');
  }
  
  // Analyze shelf share
  const totalCompetitorShare = competitors.reduce((sum, c) => sum + c.shelfShare, 0);
  if (totalCompetitorShare > 60) {
    recommendations.push('Negotiate for more shelf space allocation');
  }
  
  return recommendations;
}

/**
 * Generate asset-specific recommendations
 * @param assets Detected assets
 * @returns Array of recommendations
 */
function generateAssetRecommendations(assets: any[]): string[] {
  const recommendations: string[] = [];
  
  if (assets.length === 0) {
    recommendations.push('No brand assets detected - consider installing brand materials');
  } else {
    assets.forEach(asset => {
      if (asset.condition !== 'good') {
        recommendations.push(`${asset.type} needs maintenance or replacement`);
      }
    });
  }
  
  return recommendations;
}

/**
 * Convert quality analysis to brand result format
 * @param qualityResult Quality analysis result
 * @returns Brand analysis result
 */
function convertQualityToBrandResult(qualityResult: QualityAnalysis): BrandAnalysisResult {
  return {
    brandVisibility: qualityResult.brandVisibility,
    shelfShare: 0,
    competitorPresence: [],
    qualityScore: qualityResult.overallScore,
    recommendations: qualityResult.suggestions,
    detectedProducts: [],
    shelfAnalysis: {
      totalShelfSpace: 0,
      brandShelfSpace: 0,
      competitorShelfSpace: 0,
      emptySpace: 0,
      shelfLevels: []
    }
  };
}

/**
 * Batch analyze multiple images
 * @param imageBuffers Array of image buffers
 * @param options Analysis options
 * @returns Array of analysis results
 */
export async function batchAnalyzeImages(
  imageBuffers: Buffer[],
  options: ImageAnalysisOptions
): Promise<BrandAnalysisResult[]> {
  const results: BrandAnalysisResult[] = [];
  
  for (const imageBuffer of imageBuffers) {
    try {
      const result = await analyzeImage(imageBuffer, options);
      results.push(result);
    } catch (error) {
      console.error('Batch analysis error:', error);
      // Continue with other images
    }
  }
  
  return results;
}

/**
 * Compare images for changes over time
 * @param beforeImage Previous image
 * @param afterImage Current image
 * @param options Analysis options
 * @returns Comparison result
 */
export async function compareImages(
  beforeImage: Buffer,
  afterImage: Buffer,
  options: ImageAnalysisOptions
): Promise<{
  before: BrandAnalysisResult;
  after: BrandAnalysisResult;
  changes: {
    brandVisibilityChange: number;
    shelfShareChange: number;
    newCompetitors: string[];
    removedCompetitors: string[];
    recommendations: string[];
  };
}> {
  const beforeResult = await analyzeImage(beforeImage, options);
  const afterResult = await analyzeImage(afterImage, options);
  
  const changes = {
    brandVisibilityChange: afterResult.brandVisibility - beforeResult.brandVisibility,
    shelfShareChange: afterResult.shelfShare - beforeResult.shelfShare,
    newCompetitors: afterResult.competitorPresence
      .filter(after => !beforeResult.competitorPresence.find(before => before.name === after.name))
      .map(comp => comp.name),
    removedCompetitors: beforeResult.competitorPresence
      .filter(before => !afterResult.competitorPresence.find(after => after.name === before.name))
      .map(comp => comp.name),
    recommendations: generateComparisonRecommendations(beforeResult, afterResult)
  };
  
  return {
    before: beforeResult,
    after: afterResult,
    changes
  };
}

/**
 * Generate recommendations based on image comparison
 * @param before Previous analysis result
 * @param after Current analysis result
 * @returns Array of recommendations
 */
function generateComparisonRecommendations(
  before: BrandAnalysisResult,
  after: BrandAnalysisResult
): string[] {
  const recommendations: string[] = [];
  
  const visibilityChange = after.brandVisibility - before.brandVisibility;
  const shelfShareChange = after.shelfShare - before.shelfShare;
  
  if (visibilityChange < -10) {
    recommendations.push('Brand visibility has decreased significantly - investigate causes');
  } else if (visibilityChange > 10) {
    recommendations.push('Brand visibility has improved - maintain current strategies');
  }
  
  if (shelfShareChange < -5) {
    recommendations.push('Shelf share has decreased - negotiate with retailer');
  } else if (shelfShareChange > 5) {
    recommendations.push('Shelf share has increased - capitalize on this improvement');
  }
  
  return recommendations;
}

export default {
  analyzeImage,
  batchAnalyzeImages,
  compareImages
};