/**
 * EDI Integration Service for SalesSync
 * Handles Electronic Data Interchange for pre-order messaging to 3rd parties
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification } from './notification-service';

const prisma = new PrismaClient();

export interface EDIConfiguration {
  id: string;
  companyId: string;
  partnerName: string;
  partnerCode: string;
  connectionType: 'HTTP' | 'HTTPS' | 'FTP' | 'SFTP' | 'AS2' | 'EMAIL';
  endpoint: string;
  authentication: EDIAuthentication;
  messageFormat: 'X12' | 'EDIFACT' | 'XML' | 'JSON' | 'CSV' | 'CUSTOM';
  messageVersion: string;
  mappingRules: EDIMappingRule[];
  scheduleType: 'IMMEDIATE' | 'BATCH' | 'SCHEDULED';
  scheduleInterval?: number; // minutes
  retryAttempts: number;
  timeoutSeconds: number;
  active: boolean;
}

export interface EDIAuthentication {
  type: 'BASIC' | 'BEARER' | 'API_KEY' | 'CERTIFICATE' | 'SSH_KEY';
  credentials: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    certificatePath?: string;
    privateKeyPath?: string;
  };
}

export interface EDIMappingRule {
  sourceField: string;
  targetField: string;
  transformation?: 'UPPERCASE' | 'LOWERCASE' | 'DATE_FORMAT' | 'CURRENCY_FORMAT' | 'CUSTOM';
  customTransformation?: string;
  required: boolean;
  defaultValue?: string;
}

export interface PreOrderEDIData {
  orderId: string;
  orderNumber: string;
  customerId: string;
  agentId: string;
  companyId: string;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  customer: {
    code: string;
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
  };
  items: PreOrderItem[];
  totalAmount: number;
  currency: string;
  paymentTerms?: string;
  specialInstructions?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface PreOrderItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  uom: string; // Unit of Measure
  requestedDate?: Date;
  notes?: string;
}

export interface EDITransmissionResult {
  success: boolean;
  transmissionId: string;
  messageId?: string;
  timestamp: Date;
  responseData?: any;
  error?: string;
  retryCount: number;
}

export interface EDIMessage {
  id: string;
  configurationId: string;
  orderId: string;
  messageType: 'ORDER' | 'ORDER_RESPONSE' | 'SHIPMENT' | 'INVOICE' | 'ACKNOWLEDGMENT';
  direction: 'OUTBOUND' | 'INBOUND';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'ACKNOWLEDGED' | 'ERROR' | 'RETRY';
  messageContent: string;
  transmissionResults: EDITransmissionResult[];
  createdAt: Date;
  processedAt?: Date;
}

/**
 * Send pre-order via EDI to configured partners
 * @param orderData Pre-order data
 * @returns Array of transmission results
 */
export async function sendPreOrderEDI(orderData: PreOrderEDIData): Promise<EDITransmissionResult[]> {
  try {
    // Get EDI configurations for the company
    const configurations = await getActiveEDIConfigurations(orderData.companyId);
    
    if (configurations.length === 0) {
      throw new Error('No active EDI configurations found for company');
    }

    const results: EDITransmissionResult[] = [];

    // Send to each configured partner
    for (const config of configurations) {
      try {
        const result = await sendOrderToPartner(orderData, config);
        results.push(result);

        // Log the transmission
        await logEDIMessage({
          configurationId: config.id,
          orderId: orderData.orderId,
          messageType: 'ORDER',
          direction: 'OUTBOUND',
          status: result.success ? 'SENT' : 'ERROR',
          messageContent: result.responseData?.messageContent || '',
          transmissionResults: [result]
        });

      } catch (error) {
        const errorResult: EDITransmissionResult = {
          success: false,
          transmissionId: uuidv4(),
          timestamp: new Date(),
          error: error.message,
          retryCount: 0
        };
        results.push(errorResult);

        // Log the error
        await logEDIMessage({
          configurationId: config.id,
          orderId: orderData.orderId,
          messageType: 'ORDER',
          direction: 'OUTBOUND',
          status: 'ERROR',
          messageContent: '',
          transmissionResults: [errorResult]
        });
      }
    }

    // Update order status
    await updateOrderEDIStatus(orderData.orderId, results);

    // Send notifications for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      await notifyEDIFailures(orderData, failures);
    }

    return results;

  } catch (error) {
    console.error('EDI transmission error:', error);
    throw error;
  }
}

/**
 * Send order to specific partner
 * @param orderData Order data
 * @param config EDI configuration
 * @returns Transmission result
 */
async function sendOrderToPartner(
  orderData: PreOrderEDIData,
  config: EDIConfiguration
): Promise<EDITransmissionResult> {
  const transmissionId = uuidv4();
  const timestamp = new Date();

  try {
    // Generate EDI message based on format
    const message = await generateEDIMessage(orderData, config);

    // Send message based on connection type
    let responseData: any;
    switch (config.connectionType) {
      case 'HTTP':
      case 'HTTPS':
        responseData = await sendViaHTTP(message, config);
        break;
      case 'FTP':
      case 'SFTP':
        responseData = await sendViaFTP(message, config);
        break;
      case 'AS2':
        responseData = await sendViaAS2(message, config);
        break;
      case 'EMAIL':
        responseData = await sendViaEmail(message, config);
        break;
      default:
        throw new Error(`Unsupported connection type: ${config.connectionType}`);
    }

    return {
      success: true,
      transmissionId,
      messageId: responseData.messageId,
      timestamp,
      responseData,
      retryCount: 0
    };

  } catch (error) {
    return {
      success: false,
      transmissionId,
      timestamp,
      error: error.message,
      retryCount: 0
    };
  }
}

/**
 * Generate EDI message based on format
 * @param orderData Order data
 * @param config EDI configuration
 * @returns Generated message
 */
async function generateEDIMessage(
  orderData: PreOrderEDIData,
  config: EDIConfiguration
): Promise<string> {
  switch (config.messageFormat) {
    case 'X12':
      return generateX12Message(orderData, config);
    case 'EDIFACT':
      return generateEDIFACTMessage(orderData, config);
    case 'XML':
      return generateXMLMessage(orderData, config);
    case 'JSON':
      return generateJSONMessage(orderData, config);
    case 'CSV':
      return generateCSVMessage(orderData, config);
    case 'CUSTOM':
      return generateCustomMessage(orderData, config);
    default:
      throw new Error(`Unsupported message format: ${config.messageFormat}`);
  }
}

/**
 * Generate X12 EDI message (850 Purchase Order)
 * @param orderData Order data
 * @param config EDI configuration
 * @returns X12 message
 */
function generateX12Message(orderData: PreOrderEDIData, config: EDIConfiguration): string {
  const controlNumber = generateControlNumber();
  const date = formatX12Date(orderData.orderDate);
  
  let message = '';
  
  // ISA - Interchange Control Header
  message += `ISA*00*          *00*          *ZZ*${config.partnerCode.padEnd(15)}*ZZ*SALESSYNC      *${date}*${formatX12Time(orderData.orderDate)}*U*00401*${controlNumber}*0*P*>~\n`;
  
  // GS - Functional Group Header
  message += `GS*PO*SALESSYNC*${config.partnerCode}*${date}*${formatX12Time(orderData.orderDate)}*${controlNumber}*X*004010~\n`;
  
  // ST - Transaction Set Header
  message += `ST*850*${controlNumber}~\n`;
  
  // BEG - Beginning Segment for Purchase Order
  message += `BEG*00*SA*${orderData.orderNumber}*${date}~\n`;
  
  // N1 - Name segments for buyer and seller
  message += `N1*BY*${orderData.customer.name}~\n`;
  message += `N3*${orderData.customer.address}~\n`;
  message += `N4*${orderData.customer.city}*${orderData.customer.state}*${orderData.customer.postalCode}~\n`;
  
  // PO1 - Baseline Item Data segments
  orderData.items.forEach((item, index) => {
    message += `PO1*${(index + 1).toString().padStart(6, '0')}*${item.quantity}*${item.uom}*${item.unitPrice.toFixed(2)}**VP*${item.productCode}~\n`;
    message += `PID*F****${item.productName}~\n`;
  });
  
  // CTT - Transaction Totals
  message += `CTT*${orderData.items.length}~\n`;
  
  // SE - Transaction Set Trailer
  const segmentCount = message.split('~').length - 1 + 1; // +1 for SE segment
  message += `SE*${segmentCount}*${controlNumber}~\n`;
  
  // GE - Functional Group Trailer
  message += `GE*1*${controlNumber}~\n`;
  
  // IEA - Interchange Control Trailer
  message += `IEA*1*${controlNumber}~\n`;
  
  return message;
}

/**
 * Generate EDIFACT message (ORDERS)
 * @param orderData Order data
 * @param config EDI configuration
 * @returns EDIFACT message
 */
function generateEDIFACTMessage(orderData: PreOrderEDIData, config: EDIConfiguration): string {
  const messageRef = generateControlNumber();
  const date = formatEDIFACTDate(orderData.orderDate);
  
  let message = '';
  
  // UNH - Message Header
  message += `UNH+${messageRef}+ORDERS:D:03B:UN:EAN008'\n`;
  
  // BGM - Beginning of Message
  message += `BGM+220+${orderData.orderNumber}+9'\n`;
  
  // DTM - Date/Time/Period
  message += `DTM+137:${date}:102'\n`;
  
  // NAD - Name and Address (Buyer)
  message += `NAD+BY+${orderData.customer.code}++${orderData.customer.name}'\n`;
  message += `NAD+BY++${orderData.customer.address}:${orderData.customer.city}:${orderData.customer.postalCode}'\n`;
  
  // Line items
  orderData.items.forEach((item, index) => {
    message += `LIN+${index + 1}++${item.productCode}:VP'\n`;
    message += `IMD+F++:::${item.productName}'\n`;
    message += `QTY+21:${item.quantity}'\n`;
    message += `PRI+AAA:${item.unitPrice}'\n`;
  });
  
  // UNS - Section Control
  message += `UNS+S'\n`;
  
  // CNT - Control Total
  message += `CNT+2:${orderData.items.length}'\n`;
  
  // UNT - Message Trailer
  const segmentCount = message.split('\n').length;
  message += `UNT+${segmentCount}+${messageRef}'\n`;
  
  return message;
}

/**
 * Generate XML message
 * @param orderData Order data
 * @param config EDI configuration
 * @returns XML message
 */
function generateXMLMessage(orderData: PreOrderEDIData, config: EDIConfiguration): string {
  const mappedData = applyMappingRules(orderData, config.mappingRules);
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<PurchaseOrder>\n';
  xml += `  <Header>\n`;
  xml += `    <OrderNumber>${mappedData.orderNumber}</OrderNumber>\n`;
  xml += `    <OrderDate>${mappedData.orderDate}</OrderDate>\n`;
  xml += `    <PartnerCode>${config.partnerCode}</PartnerCode>\n`;
  xml += `    <Priority>${mappedData.priority}</Priority>\n`;
  xml += `  </Header>\n`;
  
  xml += `  <Customer>\n`;
  xml += `    <Code>${mappedData.customer.code}</Code>\n`;
  xml += `    <Name>${mappedData.customer.name}</Name>\n`;
  xml += `    <Address>${mappedData.customer.address}</Address>\n`;
  xml += `    <City>${mappedData.customer.city}</City>\n`;
  xml += `    <State>${mappedData.customer.state}</State>\n`;
  xml += `    <PostalCode>${mappedData.customer.postalCode}</PostalCode>\n`;
  xml += `  </Customer>\n`;
  
  xml += `  <Items>\n`;
  mappedData.items.forEach((item: any) => {
    xml += `    <Item>\n`;
    xml += `      <ProductCode>${item.productCode}</ProductCode>\n`;
    xml += `      <ProductName>${item.productName}</ProductName>\n`;
    xml += `      <Quantity>${item.quantity}</Quantity>\n`;
    xml += `      <UnitPrice>${item.unitPrice}</UnitPrice>\n`;
    xml += `      <TotalPrice>${item.totalPrice}</TotalPrice>\n`;
    xml += `      <UOM>${item.uom}</UOM>\n`;
    xml += `    </Item>\n`;
  });
  xml += `  </Items>\n`;
  
  xml += `  <Summary>\n`;
  xml += `    <TotalAmount>${mappedData.totalAmount}</TotalAmount>\n`;
  xml += `    <Currency>${mappedData.currency}</Currency>\n`;
  xml += `  </Summary>\n`;
  xml += '</PurchaseOrder>\n';
  
  return xml;
}

/**
 * Generate JSON message
 * @param orderData Order data
 * @param config EDI configuration
 * @returns JSON message
 */
function generateJSONMessage(orderData: PreOrderEDIData, config: EDIConfiguration): string {
  const mappedData = applyMappingRules(orderData, config.mappingRules);
  
  const jsonMessage = {
    purchaseOrder: {
      header: {
        orderNumber: mappedData.orderNumber,
        orderDate: mappedData.orderDate,
        partnerCode: config.partnerCode,
        priority: mappedData.priority,
        requestedDeliveryDate: mappedData.requestedDeliveryDate
      },
      customer: mappedData.customer,
      items: mappedData.items,
      summary: {
        totalAmount: mappedData.totalAmount,
        currency: mappedData.currency,
        paymentTerms: mappedData.paymentTerms
      },
      specialInstructions: mappedData.specialInstructions
    }
  };
  
  return JSON.stringify(jsonMessage, null, 2);
}

/**
 * Generate CSV message
 * @param orderData Order data
 * @param config EDI configuration
 * @returns CSV message
 */
function generateCSVMessage(orderData: PreOrderEDIData, config: EDIConfiguration): string {
  const mappedData = applyMappingRules(orderData, config.mappingRules);
  
  let csv = 'OrderNumber,OrderDate,CustomerCode,CustomerName,ProductCode,ProductName,Quantity,UnitPrice,TotalPrice,UOM\n';
  
  mappedData.items.forEach((item: any) => {
    csv += `${mappedData.orderNumber},${mappedData.orderDate},${mappedData.customer.code},${mappedData.customer.name},${item.productCode},${item.productName},${item.quantity},${item.unitPrice},${item.totalPrice},${item.uom}\n`;
  });
  
  return csv;
}

/**
 * Generate custom format message
 * @param orderData Order data
 * @param config EDI configuration
 * @returns Custom message
 */
function generateCustomMessage(orderData: PreOrderEDIData, config: EDIConfiguration): string {
  // This would be implemented based on specific partner requirements
  // For now, return JSON as fallback
  return generateJSONMessage(orderData, config);
}

/**
 * Send message via HTTP/HTTPS
 * @param message Message content
 * @param config EDI configuration
 * @returns Response data
 */
async function sendViaHTTP(message: string, config: EDIConfiguration): Promise<any> {
  const headers: any = {
    'Content-Type': getContentType(config.messageFormat),
    'User-Agent': 'SalesSync-EDI/1.0'
  };

  // Add authentication headers
  switch (config.authentication.type) {
    case 'BASIC':
      const credentials = Buffer.from(
        `${config.authentication.credentials.username}:${config.authentication.credentials.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      break;
    case 'BEARER':
      headers['Authorization'] = `Bearer ${config.authentication.credentials.token}`;
      break;
    case 'API_KEY':
      headers['X-API-Key'] = config.authentication.credentials.apiKey;
      break;
  }

  const response = await axios.post(config.endpoint, message, {
    headers,
    timeout: config.timeoutSeconds * 1000,
    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
  });

  return {
    messageId: response.headers['x-message-id'] || uuidv4(),
    statusCode: response.status,
    responseBody: response.data,
    messageContent: message
  };
}

/**
 * Send message via FTP/SFTP
 * @param message Message content
 * @param config EDI configuration
 * @returns Response data
 */
async function sendViaFTP(message: string, config: EDIConfiguration): Promise<any> {
  // This would require FTP client implementation
  // For now, throw error indicating not implemented
  throw new Error('FTP/SFTP transmission not yet implemented');
}

/**
 * Send message via AS2
 * @param message Message content
 * @param config EDI configuration
 * @returns Response data
 */
async function sendViaAS2(message: string, config: EDIConfiguration): Promise<any> {
  // This would require AS2 client implementation
  // For now, throw error indicating not implemented
  throw new Error('AS2 transmission not yet implemented');
}

/**
 * Send message via Email
 * @param message Message content
 * @param config EDI configuration
 * @returns Response data
 */
async function sendViaEmail(message: string, config: EDIConfiguration): Promise<any> {
  // This would integrate with email service
  // For now, throw error indicating not implemented
  throw new Error('Email transmission not yet implemented');
}

/**
 * Apply mapping rules to transform data
 * @param data Source data
 * @param rules Mapping rules
 * @returns Transformed data
 */
function applyMappingRules(data: any, rules: EDIMappingRule[]): any {
  const result = JSON.parse(JSON.stringify(data)); // Deep clone
  
  rules.forEach(rule => {
    const sourceValue = getNestedValue(data, rule.sourceField);
    let transformedValue = sourceValue;
    
    // Apply transformation
    if (rule.transformation && sourceValue !== undefined) {
      switch (rule.transformation) {
        case 'UPPERCASE':
          transformedValue = String(sourceValue).toUpperCase();
          break;
        case 'LOWERCASE':
          transformedValue = String(sourceValue).toLowerCase();
          break;
        case 'DATE_FORMAT':
          transformedValue = new Date(sourceValue).toISOString().split('T')[0];
          break;
        case 'CURRENCY_FORMAT':
          transformedValue = parseFloat(sourceValue).toFixed(2);
          break;
        case 'CUSTOM':
          // Custom transformation would be implemented here
          break;
      }
    }
    
    // Use default value if source is empty and default is provided
    if ((transformedValue === undefined || transformedValue === null || transformedValue === '') && rule.defaultValue) {
      transformedValue = rule.defaultValue;
    }
    
    // Set the transformed value
    setNestedValue(result, rule.targetField, transformedValue);
  });
  
  return result;
}

// Helper functions

function getActiveEDIConfigurations(companyId: string): Promise<EDIConfiguration[]> {
  return prisma.ediConfiguration.findMany({
    where: {
      companyId,
      active: true
    }
  }) as any;
}

function logEDIMessage(messageData: Partial<EDIMessage>): Promise<any> {
  return prisma.ediMessage.create({
    data: {
      ...messageData,
      id: uuidv4(),
      createdAt: new Date(),
      transmissionResults: JSON.stringify(messageData.transmissionResults || [])
    }
  });
}

async function updateOrderEDIStatus(orderId: string, results: EDITransmissionResult[]): Promise<void> {
  const allSuccessful = results.every(r => r.success);
  const status = allSuccessful ? 'EDI_SENT' : 'EDI_PARTIAL';
  
  await prisma.preOrder.update({
    where: { id: orderId },
    data: {
      ediStatus: status,
      ediTransmissionResults: JSON.stringify(results)
    }
  });
}

async function notifyEDIFailures(orderData: PreOrderEDIData, failures: EDITransmissionResult[]): Promise<void> {
  // Notify relevant users about EDI failures
  const adminUsers = await prisma.user.findMany({
    where: {
      companyId: orderData.companyId,
      role: { in: ['COMPANY_ADMIN', 'MANAGER'] }
    }
  });

  for (const admin of adminUsers) {
    await sendNotification({
      type: 'error',
      recipientId: admin.id,
      title: 'EDI Transmission Failed',
      message: `Pre-order ${orderData.orderNumber} failed to transmit via EDI. ${failures.length} transmission(s) failed.`,
      data: {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        failures: failures.map(f => ({ error: f.error, transmissionId: f.transmissionId }))
      },
      priority: 'HIGH'
    });
  }
}

function generateControlNumber(): string {
  return Date.now().toString().slice(-9);
}

function formatX12Date(date: Date): string {
  return date.toISOString().slice(2, 10).replace(/-/g, '');
}

function formatX12Time(date: Date): string {
  return date.toISOString().slice(11, 19).replace(/:/g, '');
}

function formatEDIFACTDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function getContentType(format: string): string {
  switch (format) {
    case 'XML': return 'application/xml';
    case 'JSON': return 'application/json';
    case 'CSV': return 'text/csv';
    default: return 'text/plain';
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Retry failed EDI transmissions
 * @param messageId EDI message ID
 * @returns Retry result
 */
export async function retryEDITransmission(messageId: string): Promise<EDITransmissionResult> {
  const message = await prisma.ediMessage.findUnique({
    where: { id: messageId },
    include: {
      configuration: true,
      order: true
    }
  });

  if (!message) {
    throw new Error('EDI message not found');
  }

  if (message.status === 'SENT' || message.status === 'DELIVERED') {
    throw new Error('Message already sent successfully');
  }

  // Get the original order data
  const orderData = JSON.parse(message.order.orderData);
  const config = message.configuration;

  // Attempt retransmission
  const result = await sendOrderToPartner(orderData, config);
  
  // Update message with retry result
  const transmissionResults = JSON.parse(message.transmissionResults as string);
  transmissionResults.push(result);

  await prisma.ediMessage.update({
    where: { id: messageId },
    data: {
      status: result.success ? 'SENT' : 'ERROR',
      transmissionResults: JSON.stringify(transmissionResults),
      processedAt: new Date()
    }
  });

  return result;
}

/**
 * Process inbound EDI messages (acknowledgments, responses, etc.)
 * @param messageContent Inbound message content
 * @param configurationId EDI configuration ID
 * @returns Processing result
 */
export async function processInboundEDIMessage(
  messageContent: string,
  configurationId: string
): Promise<{ success: boolean; messageType?: string; orderId?: string; error?: string }> {
  try {
    const config = await prisma.ediConfiguration.findUnique({
      where: { id: configurationId }
    });

    if (!config) {
      throw new Error('EDI configuration not found');
    }

    // Parse message based on format
    let parsedMessage: any;
    switch (config.messageFormat) {
      case 'JSON':
        parsedMessage = JSON.parse(messageContent);
        break;
      case 'XML':
        // Would need XML parser
        throw new Error('XML parsing not implemented');
      case 'X12':
        // Would need X12 parser
        throw new Error('X12 parsing not implemented');
      default:
        throw new Error(`Unsupported inbound format: ${config.messageFormat}`);
    }

    // Determine message type and process accordingly
    const messageType = determineMessageType(parsedMessage, config);
    
    // Log inbound message
    await logEDIMessage({
      configurationId,
      orderId: parsedMessage.orderNumber || '',
      messageType: messageType as any,
      direction: 'INBOUND',
      status: 'DELIVERED',
      messageContent
    });

    return {
      success: true,
      messageType,
      orderId: parsedMessage.orderNumber
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function determineMessageType(message: any, config: EDIConfiguration): string {
  // Logic to determine message type based on content
  if (message.acknowledgment || message.ack) return 'ACKNOWLEDGMENT';
  if (message.orderResponse || message.response) return 'ORDER_RESPONSE';
  if (message.shipment || message.shipping) return 'SHIPMENT';
  if (message.invoice || message.billing) return 'INVOICE';
  return 'UNKNOWN';
}

export default {
  sendPreOrderEDI,
  retryEDITransmission,
  processInboundEDIMessage
};