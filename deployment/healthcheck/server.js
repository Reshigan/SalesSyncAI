/**
 * SalesSync Health Check Service
 * Comprehensive health monitoring for all production services
 */

const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration
const config = {
  services: (process.env.SERVICES || 'backend-1:3000,backend-2:3000,postgres:5432,redis:6379').split(','),
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '30'),
  alertWebhook: process.env.ALERT_WEBHOOK,
  timeout: parseInt(process.env.TIMEOUT || '10000'),
  retries: parseInt(process.env.RETRIES || '3'),
  alertThreshold: parseInt(process.env.ALERT_THRESHOLD || '2') // Consecutive failures before alert
};

// Health status storage
let healthStatus = {
  services: {},
  lastCheck: null,
  overallStatus: 'unknown',
  alerts: [],
  statistics: {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    uptime: process.uptime()
  }
};

// Initialize service status
config.services.forEach(service => {
  const [host, port] = service.split(':');
  healthStatus.services[service] = {
    host,
    port: parseInt(port),
    status: 'unknown',
    lastCheck: null,
    responseTime: null,
    consecutiveFailures: 0,
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    uptime: 0,
    downtime: 0,
    lastError: null
  };
});

/**
 * Check individual service health
 */
async function checkServiceHealth(serviceName) {
  const service = healthStatus.services[serviceName];
  const startTime = Date.now();
  
  try {
    service.totalChecks++;
    
    // Determine check method based on port
    let isHealthy = false;
    let responseTime = 0;
    
    if (service.port === 3000) {
      // HTTP health check for backend services
      const response = await axios.get(`http://${service.host}:${service.port}/health`, {
        timeout: config.timeout
      });
      isHealthy = response.status === 200;
      responseTime = Date.now() - startTime;
    } else if (service.port === 5432) {
      // PostgreSQL health check
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync(`pg_isready -h ${service.host} -p ${service.port}`, { timeout: config.timeout });
        isHealthy = true;
        responseTime = Date.now() - startTime;
      } catch (error) {
        isHealthy = false;
        responseTime = Date.now() - startTime;
      }
    } else if (service.port === 6379) {
      // Redis health check
      const redis = require('redis');
      const client = redis.createClient({
        host: service.host,
        port: service.port,
        connect_timeout: config.timeout,
        command_timeout: config.timeout
      });
      
      try {
        await client.connect();
        const pong = await client.ping();
        isHealthy = pong === 'PONG';
        responseTime = Date.now() - startTime;
        await client.quit();
      } catch (error) {
        isHealthy = false;
        responseTime = Date.now() - startTime;
        try { await client.quit(); } catch (e) {}
      }
    }
    
    // Update service status
    if (isHealthy) {
      service.status = 'healthy';
      service.consecutiveFailures = 0;
      service.successfulChecks++;
      service.uptime += config.checkInterval;
      service.lastError = null;
    } else {
      service.status = 'unhealthy';
      service.consecutiveFailures++;
      service.failedChecks++;
      service.downtime += config.checkInterval;
      service.lastError = 'Health check failed';
    }
    
    service.responseTime = responseTime;
    service.lastCheck = new Date();
    
    // Check if alert should be sent
    if (service.consecutiveFailures >= config.alertThreshold) {
      await sendAlert(serviceName, service);
    }
    
    return isHealthy;
    
  } catch (error) {
    // Handle check failure
    service.status = 'unhealthy';
    service.consecutiveFailures++;
    service.failedChecks++;
    service.downtime += config.checkInterval;
    service.responseTime = Date.now() - startTime;
    service.lastCheck = new Date();
    service.lastError = error.message;
    
    // Check if alert should be sent
    if (service.consecutiveFailures >= config.alertThreshold) {
      await sendAlert(serviceName, service);
    }
    
    return false;
  }
}

/**
 * Check all services health
 */
async function checkAllServices() {
  console.log('Starting health check cycle...');
  
  const startTime = Date.now();
  const results = [];
  
  // Check all services concurrently
  const promises = config.services.map(async (serviceName) => {
    const isHealthy = await checkServiceHealth(serviceName);
    results.push({ service: serviceName, healthy: isHealthy });
    return isHealthy;
  });
  
  const healthResults = await Promise.all(promises);
  
  // Update overall statistics
  healthStatus.statistics.totalChecks++;
  const allHealthy = healthResults.every(result => result);
  
  if (allHealthy) {
    healthStatus.overallStatus = 'healthy';
    healthStatus.statistics.successfulChecks++;
  } else {
    healthStatus.overallStatus = 'unhealthy';
    healthStatus.statistics.failedChecks++;
  }
  
  healthStatus.lastCheck = new Date();
  healthStatus.statistics.uptime = process.uptime();
  
  const checkDuration = Date.now() - startTime;
  console.log(`Health check completed in ${checkDuration}ms. Overall status: ${healthStatus.overallStatus}`);
  
  // Log individual service results
  results.forEach(result => {
    const service = healthStatus.services[result.service];
    console.log(`  ${result.service}: ${service.status} (${service.responseTime}ms)`);
  });
}

/**
 * Send alert for unhealthy service
 */
async function sendAlert(serviceName, service) {
  const alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    service: serviceName,
    status: service.status,
    consecutiveFailures: service.consecutiveFailures,
    lastError: service.lastError,
    responseTime: service.responseTime
  };
  
  // Store alert
  healthStatus.alerts.push(alert);
  if (healthStatus.alerts.length > 100) {
    healthStatus.alerts.shift(); // Keep only last 100 alerts
  }
  
  console.error(`ALERT: Service ${serviceName} is unhealthy (${service.consecutiveFailures} consecutive failures)`);
  
  // Send webhook alert if configured
  if (config.alertWebhook) {
    try {
      await axios.post(config.alertWebhook, {
        text: `🚨 SalesSync Alert: Service ${serviceName} is unhealthy`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Service', value: serviceName, short: true },
            { title: 'Status', value: service.status, short: true },
            { title: 'Consecutive Failures', value: service.consecutiveFailures.toString(), short: true },
            { title: 'Response Time', value: `${service.responseTime}ms`, short: true },
            { title: 'Last Error', value: service.lastError || 'Unknown', short: false }
          ],
          timestamp: alert.timestamp.toISOString()
        }]
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error.message);
    }
  }
}

/**
 * API Routes
 */

// Health status endpoint
app.get('/health', (req, res) => {
  res.json({
    status: healthStatus.overallStatus,
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Detailed status endpoint
app.get('/status', (req, res) => {
  res.json(healthStatus);
});

// Individual service status
app.get('/status/:service', (req, res) => {
  const service = healthStatus.services[req.params.service];
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json(service);
});

// Alerts endpoint
app.get('/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const alerts = healthStatus.alerts.slice(-limit);
  res.json(alerts);
});

// Statistics endpoint
app.get('/statistics', (req, res) => {
  const stats = {
    ...healthStatus.statistics,
    services: Object.keys(healthStatus.services).map(serviceName => {
      const service = healthStatus.services[serviceName];
      return {
        name: serviceName,
        uptime: service.uptime,
        downtime: service.downtime,
        totalChecks: service.totalChecks,
        successfulChecks: service.successfulChecks,
        failedChecks: service.failedChecks,
        successRate: service.totalChecks > 0 ? (service.successfulChecks / service.totalChecks * 100).toFixed(2) : 0,
        averageResponseTime: service.responseTime
      };
    })
  };
  res.json(stats);
});

// Manual health check trigger
app.post('/check', async (req, res) => {
  try {
    await checkAllServices();
    res.json({ message: 'Health check completed', status: healthStatus.overallStatus });
  } catch (error) {
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', (req, res) => {
  let metrics = '';
  
  // Overall metrics
  metrics += `# HELP salessync_health_check_total Total number of health checks performed\n`;
  metrics += `# TYPE salessync_health_check_total counter\n`;
  metrics += `salessync_health_check_total ${healthStatus.statistics.totalChecks}\n\n`;
  
  metrics += `# HELP salessync_health_check_success_total Total number of successful health checks\n`;
  metrics += `# TYPE salessync_health_check_success_total counter\n`;
  metrics += `salessync_health_check_success_total ${healthStatus.statistics.successfulChecks}\n\n`;
  
  metrics += `# HELP salessync_health_check_failure_total Total number of failed health checks\n`;
  metrics += `# TYPE salessync_health_check_failure_total counter\n`;
  metrics += `salessync_health_check_failure_total ${healthStatus.statistics.failedChecks}\n\n`;
  
  // Service-specific metrics
  Object.keys(healthStatus.services).forEach(serviceName => {
    const service = healthStatus.services[serviceName];
    const labels = `service="${serviceName}"`;
    
    metrics += `# HELP salessync_service_status Service health status (1=healthy, 0=unhealthy)\n`;
    metrics += `# TYPE salessync_service_status gauge\n`;
    metrics += `salessync_service_status{${labels}} ${service.status === 'healthy' ? 1 : 0}\n\n`;
    
    metrics += `# HELP salessync_service_response_time_ms Service response time in milliseconds\n`;
    metrics += `# TYPE salessync_service_response_time_ms gauge\n`;
    metrics += `salessync_service_response_time_ms{${labels}} ${service.responseTime || 0}\n\n`;
    
    metrics += `# HELP salessync_service_consecutive_failures Number of consecutive failures\n`;
    metrics += `# TYPE salessync_service_consecutive_failures gauge\n`;
    metrics += `salessync_service_consecutive_failures{${labels}} ${service.consecutiveFailures}\n\n`;
  });
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

/**
 * Start health check service
 */

// Schedule regular health checks
cron.schedule(`*/${config.checkInterval} * * * * *`, () => {
  checkAllServices().catch(error => {
    console.error('Health check error:', error);
  });
});

// Initial health check
setTimeout(() => {
  checkAllServices().catch(error => {
    console.error('Initial health check error:', error);
  });
}, 5000); // Wait 5 seconds for services to start

// Start server
app.listen(PORT, () => {
  console.log(`SalesSync Health Check Service running on port ${PORT}`);
  console.log(`Monitoring services: ${config.services.join(', ')}`);
  console.log(`Check interval: ${config.checkInterval} seconds`);
  console.log(`Alert threshold: ${config.alertThreshold} consecutive failures`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});