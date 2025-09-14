/**
 * Advanced PDF Generation Utility for SalesSync
 * Generates professional reports with charts and analytics
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

export interface PDFOptions {
  title: string;
  data: any;
  includeCharts?: boolean;
  template?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3' | 'Letter';
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  branding?: {
    logo?: string;
    companyName?: string;
    address?: string;
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area';
  data: any;
  options?: any;
  width?: number;
  height?: number;
}

export class PDFGenerator {
  private doc: PDFKit.PDFDocument;
  private chartRenderer: ChartJSNodeCanvas;
  private currentY: number = 0;
  private pageWidth: number = 0;
  private pageHeight: number = 0;
  private margins: any;

  constructor(options: PDFOptions) {
    // Initialize PDF document
    this.doc = new PDFDocument({
      size: options.pageSize || 'A4',
      layout: options.orientation || 'portrait',
      margins: options.margins || { top: 50, bottom: 50, left: 50, right: 50 }
    });

    this.margins = options.margins || { top: 50, bottom: 50, left: 50, right: 50 };
    this.pageWidth = this.doc.page.width;
    this.pageHeight = this.doc.page.height;
    this.currentY = this.margins.top;

    // Initialize chart renderer
    this.chartRenderer = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white'
    });
  }

  /**
   * Generate PDF buffer
   */
  async generate(options: PDFOptions): Promise<Buffer> {
    try {
      // Add header
      await this.addHeader(options);

      // Add title
      this.addTitle(options.title);

      // Add content based on template
      switch (options.template) {
        case 'analytics-sales':
          await this.generateSalesReport(options.data);
          break;
        case 'analytics-performance':
          await this.generatePerformanceReport(options.data);
          break;
        case 'analytics-territory':
          await this.generateTerritoryReport(options.data);
          break;
        case 'analytics-comprehensive':
          await this.generateComprehensiveReport(options.data);
          break;
        default:
          await this.generateGenericReport(options.data);
      }

      // Add footer
      this.addFooter();

      // Finalize document
      this.doc.end();

      // Return buffer
      return new Promise((resolve, reject) => {
        const buffers: Buffer[] = [];
        this.doc.on('data', buffers.push.bind(buffers));
        this.doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        this.doc.on('error', reject);
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Add header with branding
   */
  private async addHeader(options: PDFOptions): Promise<void> {
    const branding = options.branding;
    
    if (branding?.logo) {
      try {
        this.doc.image(branding.logo, this.margins.left, this.currentY, { width: 100 });
      } catch (error) {
        console.warn('Logo not found, skipping');
      }
    }

    // Company name
    this.doc
      .fontSize(20)
      .fillColor(branding?.colors?.primary || '#1E3A8A')
      .text(branding?.companyName || 'SalesSync', this.margins.left + 120, this.currentY + 10);

    // Company address
    if (branding?.address) {
      this.doc
        .fontSize(10)
        .fillColor('#666666')
        .text(branding.address, this.margins.left + 120, this.currentY + 35);
    }

    // Report generation date
    this.doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Generated: ${new Date().toLocaleString()}`, this.pageWidth - 200, this.currentY + 10);

    this.currentY += 80;
    this.addSeparator();
  }

  /**
   * Add title
   */
  private addTitle(title: string): void {
    this.doc
      .fontSize(24)
      .fillColor('#1F2937')
      .text(title, this.margins.left, this.currentY, {
        align: 'center',
        width: this.pageWidth - this.margins.left - this.margins.right
      });

    this.currentY += 40;
    this.addSeparator();
  }

  /**
   * Generate sales report
   */
  private async generateSalesReport(data: any): Promise<void> {
    // Executive Summary
    this.addSectionTitle('Executive Summary');
    
    const summaryData = [
      ['Total Revenue', this.formatCurrency(data.sales?.totalRevenue || 0)],
      ['Total Transactions', (data.sales?.totalTransactions || 0).toLocaleString()],
      ['Average Transaction Value', this.formatCurrency(data.sales?.averageTransactionValue || 0)],
      ['Growth Rate', `${(data.sales?.growthRate || 0).toFixed(1)}%`]
    ];

    this.addTable(['Metric', 'Value'], summaryData);

    // Sales Trend Chart
    if (data.sales?.revenueByPeriod && data.sales.revenueByPeriod.length > 0) {
      await this.addChart({
        type: 'line',
        data: {
          labels: data.sales.revenueByPeriod.map((item: any) => 
            new Date(item.date).toLocaleDateString()
          ),
          datasets: [{
            label: 'Revenue',
            data: data.sales.revenueByPeriod.map((item: any) => item.value),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Revenue Trend'
            }
          }
        }
      });
    }

    // Top Products
    if (data.sales?.topProducts && data.sales.topProducts.length > 0) {
      this.addSectionTitle('Top Performing Products');
      
      const productData = data.sales.topProducts.slice(0, 10).map((product: any, index: number) => [
        (index + 1).toString(),
        product.productName,
        product.quantity.toLocaleString(),
        this.formatCurrency(product.revenue)
      ]);

      this.addTable(['Rank', 'Product', 'Quantity Sold', 'Revenue'], productData);
    }

    // Performance Insights
    this.addSectionTitle('Key Insights');
    const insights = this.generateSalesInsights(data);
    insights.forEach(insight => {
      this.addBulletPoint(insight);
    });
  }

  /**
   * Generate performance report
   */
  private async generatePerformanceReport(data: any): Promise<void> {
    // Agent Performance
    this.addSectionTitle('Agent Performance Overview');
    
    if (data.performance?.agentPerformance && data.performance.agentPerformance.length > 0) {
      const agentData = data.performance.agentPerformance.slice(0, 15).map((agent: any) => [
        agent.agentName,
        this.formatCurrency(agent.revenue),
        agent.visits.toString(),
        `${agent.successRate.toFixed(1)}%`,
        agent.ranking.toString()
      ]);

      this.addTable(['Agent', 'Revenue', 'Visits', 'Success Rate', 'Rank'], agentData);
    }

    // Territory Performance Chart
    if (data.performance?.territoryPerformance && data.performance.territoryPerformance.length > 0) {
      await this.addChart({
        type: 'bar',
        data: {
          labels: data.performance.territoryPerformance.map((territory: any) => territory.territory),
          datasets: [{
            label: 'Revenue',
            data: data.performance.territoryPerformance.map((territory: any) => territory.revenue),
            backgroundColor: '#3B82F6',
            borderColor: '#1E40AF',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Territory Performance'
            }
          }
        }
      });
    }

    // KPI Achievement
    if (data.performance?.kpiAchievement && data.performance.kpiAchievement.length > 0) {
      this.addSectionTitle('KPI Achievement');
      
      const kpiData = data.performance.kpiAchievement.map((kpi: any) => [
        kpi.kpi,
        kpi.target.toLocaleString(),
        kpi.actual.toLocaleString(),
        `${kpi.achievement.toFixed(1)}%`
      ]);

      this.addTable(['KPI', 'Target', 'Actual', 'Achievement'], kpiData);
    }
  }

  /**
   * Generate territory report
   */
  private async generateTerritoryReport(data: any): Promise<void> {
    this.addSectionTitle('Territory Analysis');
    
    // Territory overview table and charts would be implemented here
    this.addText('Territory analysis data would be displayed here with detailed breakdowns by region, agent coverage, and performance metrics.');
  }

  /**
   * Generate comprehensive report
   */
  private async generateComprehensiveReport(data: any): Promise<void> {
    // Combine all report sections
    await this.generateSalesReport(data);
    this.addPageBreak();
    await this.generatePerformanceReport(data);
    
    // Add additional sections for comprehensive report
    this.addPageBreak();
    this.addSectionTitle('Predictive Analytics');
    
    if (data.predictions?.salesForecast && data.predictions.salesForecast.length > 0) {
      await this.addChart({
        type: 'line',
        data: {
          labels: data.predictions.salesForecast.map((item: any) => 
            new Date(item.date).toLocaleDateString()
          ),
          datasets: [{
            label: 'Predicted Sales',
            data: data.predictions.salesForecast.map((item: any) => item.predicted),
            borderColor: '#8B5CF6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Sales Forecast'
            }
          }
        }
      });
    }
  }

  /**
   * Generate generic report
   */
  private async generateGenericReport(data: any): Promise<void> {
    this.addSectionTitle('Report Data');
    
    // Convert data to readable format
    const jsonString = JSON.stringify(data, null, 2);
    this.doc
      .fontSize(10)
      .fillColor('#374151')
      .text(jsonString, this.margins.left, this.currentY, {
        width: this.pageWidth - this.margins.left - this.margins.right
      });
  }

  /**
   * Add section title
   */
  private addSectionTitle(title: string): void {
    this.checkPageBreak(30);
    
    this.doc
      .fontSize(16)
      .fillColor('#1F2937')
      .text(title, this.margins.left, this.currentY);

    this.currentY += 25;
    this.addSeparator();
  }

  /**
   * Add table
   */
  private addTable(headers: string[], data: string[][]): void {
    const tableWidth = this.pageWidth - this.margins.left - this.margins.right;
    const columnWidth = tableWidth / headers.length;
    const rowHeight = 25;

    this.checkPageBreak((data.length + 2) * rowHeight);

    // Draw headers
    this.doc
      .fontSize(12)
      .fillColor('#1F2937');

    headers.forEach((header, index) => {
      this.doc
        .rect(this.margins.left + index * columnWidth, this.currentY, columnWidth, rowHeight)
        .fillAndStroke('#F3F4F6', '#E5E7EB')
        .fillColor('#1F2937')
        .text(header, this.margins.left + index * columnWidth + 5, this.currentY + 8, {
          width: columnWidth - 10,
          align: 'left'
        });
    });

    this.currentY += rowHeight;

    // Draw data rows
    this.doc.fontSize(10);
    data.forEach((row, rowIndex) => {
      const fillColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
      
      row.forEach((cell, colIndex) => {
        this.doc
          .rect(this.margins.left + colIndex * columnWidth, this.currentY, columnWidth, rowHeight)
          .fillAndStroke(fillColor, '#E5E7EB')
          .fillColor('#374151')
          .text(cell, this.margins.left + colIndex * columnWidth + 5, this.currentY + 8, {
            width: columnWidth - 10,
            align: colIndex === 0 ? 'left' : 'right'
          });
      });
      
      this.currentY += rowHeight;
    });

    this.currentY += 10;
  }

  /**
   * Add chart
   */
  private async addChart(config: ChartConfig): Promise<void> {
    try {
      const chartBuffer = await this.chartRenderer.renderToBuffer(config);
      
      this.checkPageBreak(300);
      
      this.doc.image(chartBuffer, this.margins.left, this.currentY, {
        width: this.pageWidth - this.margins.left - this.margins.right,
        height: 250
      });

      this.currentY += 270;
    } catch (error) {
      console.error('Chart generation error:', error);
      this.addText('Chart could not be generated');
    }
  }

  /**
   * Add bullet point
   */
  private addBulletPoint(text: string): void {
    this.checkPageBreak(20);
    
    this.doc
      .fontSize(11)
      .fillColor('#374151')
      .text('• ' + text, this.margins.left, this.currentY, {
        width: this.pageWidth - this.margins.left - this.margins.right
      });

    this.currentY += 20;
  }

  /**
   * Add regular text
   */
  private addText(text: string): void {
    this.checkPageBreak(20);
    
    this.doc
      .fontSize(11)
      .fillColor('#374151')
      .text(text, this.margins.left, this.currentY, {
        width: this.pageWidth - this.margins.left - this.margins.right
      });

    this.currentY += 20;
  }

  /**
   * Add separator line
   */
  private addSeparator(): void {
    this.doc
      .moveTo(this.margins.left, this.currentY)
      .lineTo(this.pageWidth - this.margins.right, this.currentY)
      .strokeColor('#E5E7EB')
      .stroke();

    this.currentY += 15;
  }

  /**
   * Add page break
   */
  private addPageBreak(): void {
    this.doc.addPage();
    this.currentY = this.margins.top;
  }

  /**
   * Check if page break is needed
   */
  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - this.margins.bottom) {
      this.addPageBreak();
    }
  }

  /**
   * Add footer
   */
  private addFooter(): void {
    const pageCount = this.doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      this.doc.switchToPage(i);
      
      this.doc
        .fontSize(8)
        .fillColor('#9CA3AF')
        .text(
          `Page ${i + 1} of ${pageCount} | Generated by SalesSync`,
          this.margins.left,
          this.pageHeight - this.margins.bottom + 10,
          {
            width: this.pageWidth - this.margins.left - this.margins.right,
            align: 'center'
          }
        );
    }
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  /**
   * Generate sales insights
   */
  private generateSalesInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.sales?.growthRate > 0) {
      insights.push(`Sales revenue increased by ${data.sales.growthRate.toFixed(1)}% compared to the previous period`);
    } else if (data.sales?.growthRate < 0) {
      insights.push(`Sales revenue decreased by ${Math.abs(data.sales.growthRate).toFixed(1)}% compared to the previous period`);
    }

    if (data.sales?.topProducts && data.sales.topProducts.length > 0) {
      const topProduct = data.sales.topProducts[0];
      insights.push(`${topProduct.productName} is the top-performing product with ${topProduct.quantity} units sold`);
    }

    if (data.sales?.averageTransactionValue) {
      insights.push(`Average transaction value is ${this.formatCurrency(data.sales.averageTransactionValue)}`);
    }

    return insights;
  }
}

/**
 * Main export function
 */
export async function generatePDF(options: PDFOptions): Promise<Buffer> {
  const generator = new PDFGenerator(options);
  return await generator.generate(options);
}