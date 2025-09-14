/**
 * Bluetooth Printer Service for SalesSync Mobile App
 * Handles thermal printer integration for invoice printing
 */

import { Platform, PermissionsAndroid } from 'react-native';
import BluetoothSerial from 'react-native-bluetooth-serial-next';
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
}

export default new BluetoothPrinterService();