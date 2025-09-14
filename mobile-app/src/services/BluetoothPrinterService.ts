/**
 * Advanced Bluetooth Printer Service for SalesSync Mobile App
 * Handles thermal printer integration for invoice printing with enhanced features
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import BluetoothSerial from 'react-native-bluetooth-serial-next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

export interface PrinterDevice {
  id: string;
  name: string;
  address: string;
  connected: boolean;
  class?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  customer: {
    name: string;
    address?: string;
    phone?: string;
  };
  agent: {
    name: string;
    id: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT';
  cashReceived?: number;
  change?: number;
  notes?: string;
}

export interface InvoiceItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PrintOptions {
  paperWidth: 58 | 80; // mm
  fontSize: 'small' | 'medium' | 'large';
  alignment: 'left' | 'center' | 'right';
  copies: number;
  cutPaper: boolean;
  openDrawer: boolean;
}

export interface PrintResult {
  success: boolean;
  error?: string;
  printTime?: Date;
}

class BluetoothPrinterService {
  private connectedDevice: PrinterDevice | null = null;
  private isConnecting = false;
  private isPrinting = false;
  private printQueue: any[] = [];
  private printHistory: any[] = [];
  private printerSettings: any = {
    autoReconnect: true,
    printTimeout: 30000,
    retryAttempts: 3
  };

  /**
   * Initialize Bluetooth service
   */
  async initialize(): Promise<boolean> {
    try {
      // Request Bluetooth permissions on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          throw new Error('Bluetooth permissions not granted');
        }
      }

      // Enable Bluetooth if not enabled
      const isEnabled = await BluetoothSerial.isEnabled();
      if (!isEnabled) {
        await BluetoothSerial.enable();
      }

      return true;
    } catch (error) {
      console.error('Bluetooth initialization error:', error);
      return false;
    }
  }

  /**
   * Scan for available Bluetooth devices
   */
  async scanForDevices(): Promise<PrinterDevice[]> {
    try {
      await this.initialize();

      // Get paired devices
      const pairedDevices = await BluetoothSerial.list();
      
      // Start discovery for new devices
      const discoveredDevices = await BluetoothSerial.discoverUnpairedDevices();

      // Combine and filter for printer devices
      const allDevices = [...pairedDevices, ...discoveredDevices];
      
      return allDevices
        .filter(device => this.isPrinterDevice(device))
        .map(device => ({
          id: device.id,
          name: device.name,
          address: device.address,
          connected: false,
          class: device.class
        }));

    } catch (error) {
      console.error('Device scan error:', error);
      return [];
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connectToPrinter(device: PrinterDevice): Promise<boolean> {
    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    try {
      // Disconnect from current device if connected
      if (this.connectedDevice) {
        await this.disconnect();
      }

      // Connect to the new device
      await BluetoothSerial.connect(device.address);
      
      this.connectedDevice = { ...device, connected: true };
      this.isConnecting = false;

      // Test connection with a simple command
      await this.sendCommand(this.getInitCommand());

      return true;

    } catch (error) {
      console.error('Printer connection error:', error);
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Disconnect from current printer
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.connectedDevice) {
        await BluetoothSerial.disconnect();
        this.connectedDevice = null;
      }
      return true;
    } catch (error) {
      console.error('Printer disconnection error:', error);
      return false;
    }
  }

  /**
   * Check if connected to a printer
   */
  isConnected(): boolean {
    return this.connectedDevice !== null && this.connectedDevice.connected;
  }

  /**
   * Get connected device info
   */
  getConnectedDevice(): PrinterDevice | null {
    return this.connectedDevice;
  }

  /**
   * Print invoice
   */
  async printInvoice(
    invoiceData: InvoiceData,
    options: Partial<PrintOptions> = {}
  ): Promise<PrintResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'No printer connected'
      };
    }

    try {
      const printOptions: PrintOptions = {
        paperWidth: 80,
        fontSize: 'medium',
        alignment: 'left',
        copies: 1,
        cutPaper: true,
        openDrawer: false,
        ...options
      };

      // Generate print commands
      const commands = this.generateInvoiceCommands(invoiceData, printOptions);

      // Send commands to printer
      for (const command of commands) {
        await this.sendCommand(command);
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        success: true,
        printTime: new Date()
      };

    } catch (error) {
      console.error('Print error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Print receipt
   */
  async printReceipt(
    invoiceData: InvoiceData,
    options: Partial<PrintOptions> = {}
  ): Promise<PrintResult> {
    // Receipt is similar to invoice but with different formatting
    const receiptOptions: PrintOptions = {
      paperWidth: 58,
      fontSize: 'small',
      alignment: 'center',
      copies: 1,
      cutPaper: true,
      openDrawer: false,
      ...options
    };

    return this.printInvoice(invoiceData, receiptOptions);
  }

  /**
   * Test printer connection
   */
  async testPrint(): Promise<PrintResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'No printer connected'
      };
    }

    try {
      const commands = [
        this.getInitCommand(),
        this.getAlignCommand('center'),
        this.getFontSizeCommand('large'),
        Buffer.from('SalesSync Test Print\n\n', 'utf8'),
        this.getFontSizeCommand('medium'),
        Buffer.from('Printer: ' + (this.connectedDevice?.name || 'Unknown') + '\n', 'utf8'),
        Buffer.from('Time: ' + new Date().toLocaleString() + '\n\n', 'utf8'),
        this.getAlignCommand('center'),
        Buffer.from('Test Successful!\n\n\n', 'utf8'),
        this.getCutCommand()
      ];

      for (const command of commands) {
        await this.sendCommand(command);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        success: true,
        printTime: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate invoice print commands
   */
  private generateInvoiceCommands(
    invoiceData: InvoiceData,
    options: PrintOptions
  ): Buffer[] {
    const commands: Buffer[] = [];

    // Initialize printer
    commands.push(this.getInitCommand());

    // Header
    commands.push(this.getAlignCommand('center'));
    commands.push(this.getFontSizeCommand('large'));
    commands.push(Buffer.from('SALES INVOICE\n', 'utf8'));
    commands.push(this.getFontSizeCommand('medium'));
    commands.push(Buffer.from('SalesSync\n', 'utf8'));
    commands.push(Buffer.from(this.getSeparatorLine(options.paperWidth) + '\n', 'utf8'));

    // Invoice details
    commands.push(this.getAlignCommand('left'));
    commands.push(this.getFontSizeCommand(options.fontSize));
    commands.push(Buffer.from(`Invoice #: ${invoiceData.invoiceNumber}\n`, 'utf8'));
    commands.push(Buffer.from(`Date: ${invoiceData.date.toLocaleDateString()}\n`, 'utf8'));
    commands.push(Buffer.from(`Time: ${invoiceData.date.toLocaleTimeString()}\n\n`, 'utf8'));

    // Customer details
    commands.push(Buffer.from('BILL TO:\n', 'utf8'));
    commands.push(Buffer.from(`${invoiceData.customer.name}\n`, 'utf8'));
    if (invoiceData.customer.address) {
      commands.push(Buffer.from(`${invoiceData.customer.address}\n`, 'utf8'));
    }
    if (invoiceData.customer.phone) {
      commands.push(Buffer.from(`Tel: ${invoiceData.customer.phone}\n`, 'utf8'));
    }
    commands.push(Buffer.from('\n', 'utf8'));

    // Agent details
    commands.push(Buffer.from(`Agent: ${invoiceData.agent.name}\n`, 'utf8'));
    commands.push(Buffer.from(`ID: ${invoiceData.agent.id}\n\n`, 'utf8'));

    // Items header
    commands.push(Buffer.from(this.getSeparatorLine(options.paperWidth) + '\n', 'utf8'));
    commands.push(Buffer.from(this.formatItemHeader(options.paperWidth), 'utf8'));
    commands.push(Buffer.from(this.getSeparatorLine(options.paperWidth) + '\n', 'utf8'));

    // Items
    for (const item of invoiceData.items) {
      commands.push(Buffer.from(this.formatItem(item, options.paperWidth), 'utf8'));
    }

    // Totals
    commands.push(Buffer.from(this.getSeparatorLine(options.paperWidth) + '\n', 'utf8'));
    commands.push(Buffer.from(this.formatTotal('Subtotal', invoiceData.subtotal, options.paperWidth), 'utf8'));
    
    if (invoiceData.tax && invoiceData.tax > 0) {
      commands.push(Buffer.from(this.formatTotal('Tax', invoiceData.tax, options.paperWidth), 'utf8'));
    }
    
    if (invoiceData.discount && invoiceData.discount > 0) {
      commands.push(Buffer.from(this.formatTotal('Discount', -invoiceData.discount, options.paperWidth), 'utf8'));
    }

    commands.push(Buffer.from(this.getSeparatorLine(options.paperWidth) + '\n', 'utf8'));
    commands.push(this.getFontSizeCommand('large'));
    commands.push(Buffer.from(this.formatTotal('TOTAL', invoiceData.total, options.paperWidth), 'utf8'));
    commands.push(this.getFontSizeCommand(options.fontSize));

    // Payment details
    commands.push(Buffer.from('\n', 'utf8'));
    commands.push(Buffer.from(`Payment Method: ${invoiceData.paymentMethod}\n`, 'utf8'));
    
    if (invoiceData.paymentMethod === 'CASH' && invoiceData.cashReceived) {
      commands.push(Buffer.from(`Cash Received: ${this.formatCurrency(invoiceData.cashReceived)}\n`, 'utf8'));
      if (invoiceData.change && invoiceData.change > 0) {
        commands.push(Buffer.from(`Change: ${this.formatCurrency(invoiceData.change)}\n`, 'utf8'));
      }
    }

    // Notes
    if (invoiceData.notes) {
      commands.push(Buffer.from('\n', 'utf8'));
      commands.push(Buffer.from(`Notes: ${invoiceData.notes}\n`, 'utf8'));
    }

    // Footer
    commands.push(Buffer.from('\n', 'utf8'));
    commands.push(this.getAlignCommand('center'));
    commands.push(Buffer.from('Thank you for your business!\n', 'utf8'));
    commands.push(Buffer.from('Powered by SalesSync\n\n\n', 'utf8'));

    // Cut paper if requested
    if (options.cutPaper) {
      commands.push(this.getCutCommand());
    }

    // Open cash drawer if requested
    if (options.openDrawer) {
      commands.push(this.getDrawerCommand());
    }

    return commands;
  }

  /**
   * Send command to printer
   */
  private async sendCommand(command: Buffer): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Printer not connected');
    }

    await BluetoothSerial.write(command);
  }

  /**
   * Check if device is likely a printer
   */
  private isPrinterDevice(device: any): boolean {
    const printerKeywords = [
      'printer', 'print', 'pos', 'thermal', 'receipt',
      'epson', 'star', 'citizen', 'bixolon', 'sewoo'
    ];

    const deviceName = device.name?.toLowerCase() || '';
    return printerKeywords.some(keyword => deviceName.includes(keyword));
  }

  /**
   * Get printer initialization command
   */
  private getInitCommand(): Buffer {
    return Buffer.from([0x1B, 0x40]); // ESC @
  }

  /**
   * Get alignment command
   */
  private getAlignCommand(alignment: 'left' | 'center' | 'right'): Buffer {
    const alignmentCodes = {
      left: 0x00,
      center: 0x01,
      right: 0x02
    };
    return Buffer.from([0x1B, 0x61, alignmentCodes[alignment]]);
  }

  /**
   * Get font size command
   */
  private getFontSizeCommand(size: 'small' | 'medium' | 'large'): Buffer {
    const sizeCodes = {
      small: [0x1B, 0x21, 0x00],
      medium: [0x1B, 0x21, 0x10],
      large: [0x1B, 0x21, 0x30]
    };
    return Buffer.from(sizeCodes[size]);
  }

  /**
   * Get paper cut command
   */
  private getCutCommand(): Buffer {
    return Buffer.from([0x1D, 0x56, 0x00]); // GS V 0
  }

  /**
   * Get cash drawer open command
   */
  private getDrawerCommand(): Buffer {
    return Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]); // ESC p 0 25 250
  }

  /**
   * Format item for printing
   */
  private formatItem(item: InvoiceItem, paperWidth: number): string {
    const maxNameLength = paperWidth === 58 ? 20 : 30;
    const name = item.name.length > maxNameLength 
      ? item.name.substring(0, maxNameLength - 3) + '...'
      : item.name;

    const qtyPrice = `${item.quantity} x ${this.formatCurrency(item.unitPrice)}`;
    const total = this.formatCurrency(item.total);

    if (paperWidth === 58) {
      return `${name}\n  ${qtyPrice.padEnd(20)}${total.padStart(10)}\n`;
    } else {
      return `${name.padEnd(30)}${qtyPrice.padEnd(15)}${total.padStart(10)}\n`;
    }
  }

  /**
   * Format item header
   */
  private formatItemHeader(paperWidth: number): string {
    if (paperWidth === 58) {
      return 'Item\n  Qty x Price      Total\n';
    } else {
      return 'Item                          Qty x Price    Total\n';
    }
  }

  /**
   * Format total line
   */
  private formatTotal(label: string, amount: number, paperWidth: number): string {
    const formattedAmount = this.formatCurrency(amount);
    const maxLabelLength = paperWidth === 58 ? 20 : 35;
    
    return `${label.padEnd(maxLabelLength)}${formattedAmount.padStart(15)}\n`;
  }

  /**
   * Get separator line
   */
  private getSeparatorLine(paperWidth: number): string {
    return '-'.repeat(paperWidth === 58 ? 32 : 48);
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number): string {
    return `R ${amount.toFixed(2)}`;
  }

  /**
   * Add print job to queue
   */
  async addToQueue(printJob: any): Promise<void> {
    this.printQueue.push({
      ...printJob,
      id: Date.now().toString(),
      timestamp: new Date(),
      status: 'queued'
    });
    
    await this.processPrintQueue();
  }

  /**
   * Process print queue
   */
  private async processPrintQueue(): Promise<void> {
    if (this.isPrinting || this.printQueue.length === 0) {
      return;
    }

    const job = this.printQueue.shift();
    if (!job) return;

    try {
      this.isPrinting = true;
      job.status = 'printing';

      let result: PrintResult;
      switch (job.type) {
        case 'invoice':
          result = await this.printInvoice(job.data, job.options);
          break;
        case 'receipt':
          result = await this.printReceipt(job.data, job.options);
          break;
        case 'test':
          result = await this.testPrint();
          break;
        default:
          result = { success: false, error: 'Unknown print job type' };
      }

      job.status = result.success ? 'completed' : 'failed';
      job.result = result;
      
      // Add to history
      this.printHistory.push(job);
      await this.savePrintHistory();

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      this.printHistory.push(job);
    } finally {
      this.isPrinting = false;
      // Process next job in queue
      if (this.printQueue.length > 0) {
        setTimeout(() => this.processPrintQueue(), 1000);
      }
    }
  }

  /**
   * Get print queue status
   */
  getPrintQueueStatus(): any {
    return {
      queueLength: this.printQueue.length,
      isPrinting: this.isPrinting,
      currentJob: this.isPrinting ? this.printQueue[0] : null,
      history: this.printHistory.slice(-10) // Last 10 jobs
    };
  }

  /**
   * Clear print queue
   */
  clearPrintQueue(): void {
    this.printQueue = [];
  }

  /**
   * Save print history to storage
   */
  private async savePrintHistory(): Promise<void> {
    try {
      // Keep only last 100 print jobs
      if (this.printHistory.length > 100) {
        this.printHistory = this.printHistory.slice(-100);
      }
      
      await AsyncStorage.setItem('printHistory', JSON.stringify(this.printHistory));
    } catch (error) {
      console.error('Save print history error:', error);
    }
  }

  /**
   * Load print history from storage
   */
  async loadPrintHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('printHistory');
      if (stored) {
        this.printHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Load print history error:', error);
    }
  }

  /**
   * Get print statistics
   */
  async getPrintStatistics(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayJobs = this.printHistory.filter(job => 
      new Date(job.timestamp) >= today
    );

    const successfulJobs = this.printHistory.filter(job => 
      job.status === 'completed'
    );

    return {
      totalJobs: this.printHistory.length,
      todayJobs: todayJobs.length,
      successfulJobs: successfulJobs.length,
      failedJobs: this.printHistory.length - successfulJobs.length,
      successRate: this.printHistory.length > 0 
        ? (successfulJobs.length / this.printHistory.length) * 100 
        : 0,
      connectedDevice: this.connectedDevice,
      queueLength: this.printQueue.length
    };
  }

  /**
   * Print daily sales summary
   */
  async printDailySummary(salesData: any): Promise<PrintResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'No printer connected'
      };
    }

    try {
      const commands: Buffer[] = [];

      // Initialize printer
      commands.push(this.getInitCommand());
      commands.push(this.getAlignCommand('center'));
      commands.push(this.getFontSizeCommand('large'));
      commands.push(Buffer.from('DAILY SALES SUMMARY\n', 'utf8'));
      commands.push(this.getFontSizeCommand('medium'));
      commands.push(Buffer.from('SalesSync\n', 'utf8'));
      commands.push(Buffer.from(this.getSeparatorLine(80) + '\n', 'utf8'));

      // Summary details
      commands.push(this.getAlignCommand('left'));
      commands.push(Buffer.from(`Date: ${new Date().toLocaleDateString()}\n`, 'utf8'));
      commands.push(Buffer.from(`Agent: ${salesData.agentName}\n`, 'utf8'));
      commands.push(Buffer.from(`Territory: ${salesData.territory || 'N/A'}\n\n`, 'utf8'));

      // Sales metrics
      commands.push(Buffer.from('SALES METRICS:\n', 'utf8'));
      commands.push(Buffer.from(`Total Sales: ${this.formatCurrency(salesData.totalSales)}\n`, 'utf8'));
      commands.push(Buffer.from(`Total Transactions: ${salesData.transactionCount}\n`, 'utf8'));
      commands.push(Buffer.from(`Average Transaction: ${this.formatCurrency(salesData.averageTransaction)}\n`, 'utf8'));
      commands.push(Buffer.from(`Cash Sales: ${this.formatCurrency(salesData.cashSales)}\n`, 'utf8'));
      commands.push(Buffer.from(`Card Sales: ${this.formatCurrency(salesData.cardSales)}\n`, 'utf8'));
      commands.push(Buffer.from(`Credit Sales: ${this.formatCurrency(salesData.creditSales)}\n\n`, 'utf8'));

      // Visit metrics
      commands.push(Buffer.from('VISIT METRICS:\n', 'utf8'));
      commands.push(Buffer.from(`Planned Visits: ${salesData.plannedVisits}\n`, 'utf8'));
      commands.push(Buffer.from(`Completed Visits: ${salesData.completedVisits}\n`, 'utf8'));
      commands.push(Buffer.from(`Success Rate: ${salesData.visitSuccessRate}%\n`, 'utf8'));
      commands.push(Buffer.from(`Average Visit Duration: ${salesData.avgVisitDuration} min\n\n`, 'utf8'));

      // Top products
      if (salesData.topProducts && salesData.topProducts.length > 0) {
        commands.push(Buffer.from('TOP PRODUCTS:\n', 'utf8'));
        salesData.topProducts.slice(0, 5).forEach((product: any, index: number) => {
          commands.push(Buffer.from(`${index + 1}. ${product.name} - ${product.quantity} units\n`, 'utf8'));
        });
        commands.push(Buffer.from('\n', 'utf8'));
      }

      // Footer
      commands.push(this.getAlignCommand('center'));
      commands.push(Buffer.from('Generated by SalesSync\n', 'utf8'));
      commands.push(Buffer.from(`${new Date().toLocaleString()}\n\n\n`, 'utf8'));
      commands.push(this.getCutCommand());

      // Send commands to printer
      for (const command of commands) {
        await this.sendCommand(command);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        success: true,
        printTime: new Date()
      };

    } catch (error) {
      console.error('Print daily summary error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Print barcode
   */
  async printBarcode(data: string, type: 'CODE128' | 'CODE39' | 'EAN13' = 'CODE128'): Promise<PrintResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'No printer connected'
      };
    }

    try {
      const commands: Buffer[] = [];
      
      commands.push(this.getInitCommand());
      commands.push(this.getAlignCommand('center'));
      
      // Set barcode height
      commands.push(Buffer.from([0x1D, 0x68, 0x64])); // Height = 100 dots
      
      // Set barcode width
      commands.push(Buffer.from([0x1D, 0x77, 0x02])); // Width = 2
      
      // Print barcode
      let barcodeCommand: number[];
      switch (type) {
        case 'CODE128':
          barcodeCommand = [0x1D, 0x6B, 0x49];
          break;
        case 'CODE39':
          barcodeCommand = [0x1D, 0x6B, 0x04];
          break;
        case 'EAN13':
          barcodeCommand = [0x1D, 0x6B, 0x02];
          break;
        default:
          barcodeCommand = [0x1D, 0x6B, 0x49];
      }
      
      commands.push(Buffer.from(barcodeCommand));
      commands.push(Buffer.from(data.length.toString())); // Data length
      commands.push(Buffer.from(data, 'ascii')); // Barcode data
      
      commands.push(Buffer.from('\n\n', 'utf8'));
      commands.push(Buffer.from(data + '\n\n\n', 'utf8')); // Human readable
      commands.push(this.getCutCommand());

      // Send commands
      for (const command of commands) {
        await this.sendCommand(command);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        success: true,
        printTime: new Date()
      };

    } catch (error) {
      console.error('Print barcode error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Auto-reconnect to last connected device
   */
  async autoReconnect(): Promise<boolean> {
    if (!this.printerSettings.autoReconnect) {
      return false;
    }

    try {
      const lastDevice = await AsyncStorage.getItem('lastConnectedPrinter');
      if (lastDevice) {
        const device = JSON.parse(lastDevice);
        return await this.connectToPrinter(device);
      }
    } catch (error) {
      console.error('Auto-reconnect error:', error);
    }
    
    return false;
  }

  /**
   * Save last connected device
   */
  private async saveLastConnectedDevice(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await AsyncStorage.setItem('lastConnectedPrinter', JSON.stringify(this.connectedDevice));
      } catch (error) {
        console.error('Save last connected device error:', error);
      }
    }
  }

  /**
   * Update printer settings
   */
  async updateSettings(settings: any): Promise<void> {
    this.printerSettings = { ...this.printerSettings, ...settings };
    try {
      await AsyncStorage.setItem('printerSettings', JSON.stringify(this.printerSettings));
    } catch (error) {
      console.error('Update printer settings error:', error);
    }
  }

  /**
   * Get printer settings
   */
  getSettings(): any {
    return { ...this.printerSettings };
  }

  /**
   * Enhanced connect method with auto-save
   */
  async connectToPrinterEnhanced(device: PrinterDevice): Promise<boolean> {
    const success = await this.connectToPrinter(device);
    if (success) {
      await this.saveLastConnectedDevice();
    }
    return success;
  }
}

export default new BluetoothPrinterService();