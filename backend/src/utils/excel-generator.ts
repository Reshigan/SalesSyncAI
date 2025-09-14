/**
 * Advanced Excel Generation Utility for SalesSync
 * Generates professional Excel reports with charts and formatting
 */

import ExcelJS from 'exceljs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

export interface ExcelOptions {
  title: string;
  data: any;
  includeCharts?: boolean;
  template?: string;
  branding?: {
    companyName?: string;
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

export interface ExcelChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: any;
  options?: any;
  position?: {
    row: number;
    col: number;
  };
}

export class ExcelGenerator {
  private workbook: ExcelJS.Workbook;
  private chartRenderer: ChartJSNodeCanvas;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'SalesSync';
    this.workbook.lastModifiedBy = 'SalesSync';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();

    // Initialize chart renderer
    this.chartRenderer = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white'
    });
  }

  /**
   * Generate Excel buffer
   */
  async generate(options: ExcelOptions): Promise<Buffer> {
    try {
      // Generate worksheets based on template
      switch (options.template) {
        case 'analytics-sales':
          await this.generateSalesWorkbook(options);
          break;
        case 'analytics-performance':
          await this.generatePerformanceWorkbook(options);
          break;
        case 'analytics-territory':
          await this.generateTerritoryWorkbook(options);
          break;
        case 'analytics-comprehensive':
          await this.generateComprehensiveWorkbook(options);
          break;
        default:
          await this.generateGenericWorkbook(options);
      }

      // Return buffer
      return Buffer.from(await this.workbook.xlsx.writeBuffer());

    } catch (error) {
      console.error('Excel generation error:', error);
      throw error;
    }
  }

  /**
   * Generate sales workbook
   */
  private async generateSalesWorkbook(options: ExcelOptions): Promise<void> {
    const data = options.data;

    // Summary Sheet
    const summarySheet = this.workbook.addWorksheet('Sales Summary');
    await this.setupSummarySheet(summarySheet, data, options);

    // Detailed Sales Data
    const detailsSheet = this.workbook.addWorksheet('Sales Details');
    await this.setupSalesDetailsSheet(detailsSheet, data);

    // Top Products
    if (data.sales?.topProducts && data.sales.topProducts.length > 0) {
      const productsSheet = this.workbook.addWorksheet('Top Products');
      await this.setupTopProductsSheet(productsSheet, data.sales.topProducts);
    }

    // Revenue Trend
    if (data.sales?.revenueByPeriod && data.sales.revenueByPeriod.length > 0) {
      const trendSheet = this.workbook.addWorksheet('Revenue Trend');
      await this.setupRevenueTrendSheet(trendSheet, data.sales.revenueByPeriod, options.includeCharts);
    }
  }

  /**
   * Generate performance workbook
   */
  private async generatePerformanceWorkbook(options: ExcelOptions): Promise<void> {
    const data = options.data;

    // Performance Summary
    const summarySheet = this.workbook.addWorksheet('Performance Summary');
    await this.setupPerformanceSummarySheet(summarySheet, data, options);

    // Agent Performance
    if (data.performance?.agentPerformance && data.performance.agentPerformance.length > 0) {
      const agentSheet = this.workbook.addWorksheet('Agent Performance');
      await this.setupAgentPerformanceSheet(agentSheet, data.performance.agentPerformance);
    }

    // Territory Performance
    if (data.performance?.territoryPerformance && data.performance.territoryPerformance.length > 0) {
      const territorySheet = this.workbook.addWorksheet('Territory Performance');
      await this.setupTerritoryPerformanceSheet(territorySheet, data.performance.territoryPerformance);
    }

    // KPI Achievement
    if (data.performance?.kpiAchievement && data.performance.kpiAchievement.length > 0) {
      const kpiSheet = this.workbook.addWorksheet('KPI Achievement');
      await this.setupKPISheet(kpiSheet, data.performance.kpiAchievement);
    }
  }

  /**
   * Generate territory workbook
   */
  private async generateTerritoryWorkbook(options: ExcelOptions): Promise<void> {
    const data = options.data;

    // Territory Overview
    const overviewSheet = this.workbook.addWorksheet('Territory Overview');
    await this.setupTerritoryOverviewSheet(overviewSheet, data, options);

    // Territory Details would be implemented here
  }

  /**
   * Generate comprehensive workbook
   */
  private async generateComprehensiveWorkbook(options: ExcelOptions): Promise<void> {
    // Combine all workbook types
    await this.generateSalesWorkbook(options);
    await this.generatePerformanceWorkbook(options);

    // Add additional comprehensive sheets
    const data = options.data;

    // Executive Dashboard
    const dashboardSheet = this.workbook.addWorksheet('Executive Dashboard');
    await this.setupExecutiveDashboard(dashboardSheet, data, options);

    // Predictive Analytics
    if (data.predictions) {
      const predictiveSheet = this.workbook.addWorksheet('Predictive Analytics');
      await this.setupPredictiveSheet(predictiveSheet, data.predictions);
    }
  }

  /**
   * Generate generic workbook
   */
  private async generateGenericWorkbook(options: ExcelOptions): Promise<void> {
    const dataSheet = this.workbook.addWorksheet('Data');
    
    // Add title
    this.addTitle(dataSheet, options.title, 1, 1);

    // Add data as JSON
    const jsonString = JSON.stringify(options.data, null, 2);
    dataSheet.getCell('A3').value = jsonString;
    dataSheet.getCell('A3').alignment = { vertical: 'top', wrapText: true };
  }

  /**
   * Setup summary sheet
   */
  private async setupSummarySheet(sheet: ExcelJS.Worksheet, data: any, options: ExcelOptions): Promise<void> {
    // Add title
    this.addTitle(sheet, 'Sales Summary Report', 1, 1);
    this.addSubtitle(sheet, `Generated: ${new Date().toLocaleString()}`, 2, 1);

    // Key metrics
    let row = 4;
    this.addSectionHeader(sheet, 'Key Metrics', row, 1);
    row += 2;

    const metrics = [
      ['Total Revenue', this.formatCurrency(data.sales?.totalRevenue || 0)],
      ['Total Transactions', (data.sales?.totalTransactions || 0).toLocaleString()],
      ['Average Transaction Value', this.formatCurrency(data.sales?.averageTransactionValue || 0)],
      ['Growth Rate', `${(data.sales?.growthRate || 0).toFixed(1)}%`]
    ];

    metrics.forEach(([label, value]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      this.styleMetricRow(sheet, row);
      row++;
    });

    // Format columns
    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 20;
  }

  /**
   * Setup sales details sheet
   */
  private async setupSalesDetailsSheet(sheet: ExcelJS.Worksheet, data: any): Promise<void> {
    this.addTitle(sheet, 'Sales Details', 1, 1);

    // Headers
    const headers = ['Date', 'Agent', 'Customer', 'Product', 'Quantity', 'Unit Price', 'Total Amount'];
    let row = 3;

    headers.forEach((header, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = header;
      this.styleHeader(cell);
    });

    row++;

    // Sample data (in production, would use actual sales data)
    const sampleSales = [
      ['2024-01-15', 'John Smith', 'ABC Store', 'Product A', 10, 25.00, 250.00],
      ['2024-01-15', 'Jane Doe', 'XYZ Shop', 'Product B', 5, 50.00, 250.00],
      ['2024-01-16', 'Bob Johnson', 'DEF Market', 'Product C', 8, 30.00, 240.00]
    ];

    sampleSales.forEach(saleData => {
      saleData.forEach((value, index) => {
        const cell = sheet.getCell(row, index + 1);
        cell.value = value;
        if (index >= 4) { // Numeric columns
          cell.numFmt = index === 5 || index === 6 ? '"R"#,##0.00' : '#,##0';
        }
      });
      row++;
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  /**
   * Setup top products sheet
   */
  private async setupTopProductsSheet(sheet: ExcelJS.Worksheet, products: any[]): Promise<void> {
    this.addTitle(sheet, 'Top Performing Products', 1, 1);

    // Headers
    const headers = ['Rank', 'Product Name', 'Quantity Sold', 'Revenue', 'Market Share'];
    let row = 3;

    headers.forEach((header, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = header;
      this.styleHeader(cell);
    });

    row++;

    // Product data
    products.slice(0, 20).forEach((product, index) => {
      sheet.getCell(row, 1).value = index + 1;
      sheet.getCell(row, 2).value = product.productName;
      sheet.getCell(row, 3).value = product.quantity;
      sheet.getCell(row, 4).value = product.revenue;
      sheet.getCell(row, 5).value = `${((product.revenue / products.reduce((sum: number, p: any) => sum + p.revenue, 0)) * 100).toFixed(1)}%`;

      // Format numeric columns
      sheet.getCell(row, 3).numFmt = '#,##0';
      sheet.getCell(row, 4).numFmt = '"R"#,##0.00';

      row++;
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 18;
    });
  }

  /**
   * Setup revenue trend sheet
   */
  private async setupRevenueTrendSheet(sheet: ExcelJS.Worksheet, trendData: any[], includeCharts?: boolean): Promise<void> {
    this.addTitle(sheet, 'Revenue Trend Analysis', 1, 1);

    // Headers
    const headers = ['Date', 'Revenue', 'Transactions', 'Average Value'];
    let row = 3;

    headers.forEach((header, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = header;
      this.styleHeader(cell);
    });

    row++;

    // Trend data
    trendData.forEach(item => {
      sheet.getCell(row, 1).value = new Date(item.date);
      sheet.getCell(row, 2).value = item.value;
      sheet.getCell(row, 3).value = item.count;
      sheet.getCell(row, 4).value = item.count > 0 ? item.value / item.count : 0;

      // Format columns
      sheet.getCell(row, 1).numFmt = 'dd/mm/yyyy';
      sheet.getCell(row, 2).numFmt = '"R"#,##0.00';
      sheet.getCell(row, 3).numFmt = '#,##0';
      sheet.getCell(row, 4).numFmt = '"R"#,##0.00';

      row++;
    });

    // Add chart if requested
    if (includeCharts) {
      await this.addChart(sheet, {
        type: 'line',
        data: {
          labels: trendData.map(item => new Date(item.date).toLocaleDateString()),
          datasets: [{
            label: 'Revenue',
            data: trendData.map(item => item.value),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)'
          }]
        }
      }, { row: row + 2, col: 1 });
    }

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  /**
   * Setup agent performance sheet
   */
  private async setupAgentPerformanceSheet(sheet: ExcelJS.Worksheet, agents: any[]): Promise<void> {
    this.addTitle(sheet, 'Agent Performance Analysis', 1, 1);

    // Headers
    const headers = ['Rank', 'Agent Name', 'Revenue', 'Visits', 'Success Rate', 'Avg. Transaction', 'Performance Score'];
    let row = 3;

    headers.forEach((header, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = header;
      this.styleHeader(cell);
    });

    row++;

    // Agent data
    agents.forEach((agent, index) => {
      sheet.getCell(row, 1).value = agent.ranking || index + 1;
      sheet.getCell(row, 2).value = agent.agentName;
      sheet.getCell(row, 3).value = agent.revenue;
      sheet.getCell(row, 4).value = agent.visits;
      sheet.getCell(row, 5).value = agent.successRate / 100; // Convert to decimal for percentage format
      sheet.getCell(row, 6).value = agent.visits > 0 ? agent.revenue / agent.visits : 0;
      sheet.getCell(row, 7).value = this.calculatePerformanceScore(agent);

      // Format columns
      sheet.getCell(row, 3).numFmt = '"R"#,##0.00';
      sheet.getCell(row, 4).numFmt = '#,##0';
      sheet.getCell(row, 5).numFmt = '0.0%';
      sheet.getCell(row, 6).numFmt = '"R"#,##0.00';
      sheet.getCell(row, 7).numFmt = '0.0';

      // Color code performance
      const performanceScore = this.calculatePerformanceScore(agent);
      if (performanceScore >= 8) {
        sheet.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      } else if (performanceScore >= 6) {
        sheet.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
      } else {
        sheet.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
      }

      row++;
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 18;
    });
  }

  /**
   * Setup executive dashboard
   */
  private async setupExecutiveDashboard(sheet: ExcelJS.Worksheet, data: any, options: ExcelOptions): Promise<void> {
    this.addTitle(sheet, 'Executive Dashboard', 1, 1);
    this.addSubtitle(sheet, options.branding?.companyName || 'SalesSync', 2, 1);

    let row = 4;

    // Key Performance Indicators
    this.addSectionHeader(sheet, 'Key Performance Indicators', row, 1);
    row += 2;

    const kpis = [
      ['Total Revenue', this.formatCurrency(data.sales?.totalRevenue || 0), 'vs. Target', '85%'],
      ['Active Agents', (data.performance?.agentPerformance?.length || 0).toString(), 'Utilization', '92%'],
      ['Customer Visits', (data.visits?.totalVisits || 0).toString(), 'Success Rate', `${(data.visits?.successRate || 0).toFixed(1)}%`],
      ['Market Coverage', '75%', 'Growth Rate', `${(data.sales?.growthRate || 0).toFixed(1)}%`]
    ];

    kpis.forEach(([metric, value, subMetric, subValue]) => {
      sheet.getCell(row, 1).value = metric;
      sheet.getCell(row, 2).value = value;
      sheet.getCell(row, 3).value = subMetric;
      sheet.getCell(row, 4).value = subValue;
      
      this.styleKPIRow(sheet, row);
      row++;
    });

    // Format dashboard
    sheet.getColumn('A').width = 20;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 15;
  }

  /**
   * Add chart to worksheet
   */
  private async addChart(sheet: ExcelJS.Worksheet, config: ExcelChartConfig, position: { row: number; col: number }): Promise<void> {
    try {
      const chartBuffer = await this.chartRenderer.renderToBuffer(config);
      
      // Add chart as image
      const imageId = this.workbook.addImage({
        buffer: chartBuffer as any,
        extension: 'png',
      });

      sheet.addImage(imageId, {
        tl: { col: position.col - 1, row: position.row - 1 },
        ext: { width: 600, height: 300 }
      });

    } catch (error) {
      console.error('Chart generation error:', error);
      sheet.getCell(position.row, position.col).value = 'Chart could not be generated';
    }
  }

  /**
   * Styling helper methods
   */
  private addTitle(sheet: ExcelJS.Worksheet, title: string, row: number, col: number): void {
    const cell = sheet.getCell(row, col);
    cell.value = title;
    cell.font = { size: 18, bold: true, color: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  }

  private addSubtitle(sheet: ExcelJS.Worksheet, subtitle: string, row: number, col: number): void {
    const cell = sheet.getCell(row, col);
    cell.value = subtitle;
    cell.font = { size: 12, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  }

  private addSectionHeader(sheet: ExcelJS.Worksheet, header: string, row: number, col: number): void {
    const cell = sheet.getCell(row, col);
    cell.value = header;
    cell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    };
  }

  private styleHeader(cell: ExcelJS.Cell): void {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
  }

  private styleMetricRow(sheet: ExcelJS.Worksheet, row: number): void {
    ['A', 'B'].forEach(col => {
      const cell = sheet.getCell(`${col}${row}`);
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      if (col === 'A') {
        cell.font = { bold: true };
      } else {
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  private styleKPIRow(sheet: ExcelJS.Worksheet, row: number): void {
    ['A', 'B', 'C', 'D'].forEach(col => {
      const cell = sheet.getCell(`${col}${row}`);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      
      if (col === 'A' || col === 'C') {
        cell.font = { bold: true };
      } else {
        cell.alignment = { horizontal: 'center' };
        cell.font = { size: 12, bold: true };
      }
    });
  }

  /**
   * Helper methods
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  private calculatePerformanceScore(agent: any): number {
    // Simple performance scoring algorithm
    const revenueScore = Math.min(10, (agent.revenue / 10000) * 5); // Max 5 points for revenue
    const visitScore = Math.min(3, (agent.visits / 50) * 3); // Max 3 points for visits
    const successScore = (agent.successRate / 100) * 2; // Max 2 points for success rate
    
    return Math.round((revenueScore + visitScore + successScore) * 10) / 10;
  }

  // Placeholder methods for sheets not fully implemented
  private async setupPerformanceSummarySheet(sheet: ExcelJS.Worksheet, data: any, options: ExcelOptions): Promise<void> {
    this.addTitle(sheet, 'Performance Summary', 1, 1);
    sheet.getCell('A3').value = 'Performance summary data would be displayed here';
  }

  private async setupTerritoryPerformanceSheet(sheet: ExcelJS.Worksheet, territories: any[]): Promise<void> {
    this.addTitle(sheet, 'Territory Performance', 1, 1);
    sheet.getCell('A3').value = 'Territory performance data would be displayed here';
  }

  private async setupKPISheet(sheet: ExcelJS.Worksheet, kpis: any[]): Promise<void> {
    this.addTitle(sheet, 'KPI Achievement', 1, 1);
    sheet.getCell('A3').value = 'KPI achievement data would be displayed here';
  }

  private async setupTerritoryOverviewSheet(sheet: ExcelJS.Worksheet, data: any, options: ExcelOptions): Promise<void> {
    this.addTitle(sheet, 'Territory Overview', 1, 1);
    sheet.getCell('A3').value = 'Territory overview data would be displayed here';
  }

  private async setupPredictiveSheet(sheet: ExcelJS.Worksheet, predictions: any): Promise<void> {
    this.addTitle(sheet, 'Predictive Analytics', 1, 1);
    sheet.getCell('A3').value = 'Predictive analytics data would be displayed here';
  }
}

/**
 * Main export function
 */
export async function generateExcel(options: ExcelOptions): Promise<Buffer> {
  const generator = new ExcelGenerator();
  return await generator.generate(options);
}