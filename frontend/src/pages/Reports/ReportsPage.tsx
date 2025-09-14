import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Assessment,
  GetApp,
  DateRange,
  TrendingUp,
  ShoppingCart,
  People,
  Campaign,
  LocationOn,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import toast from 'react-hot-toast';

import LoadingSpinner from '../../components/Common/LoadingSpinner';
import StatCard from '../../components/Common/StatCard';
import { reportingService, SalesReport } from '../../services/apiService';

const reportTypes = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'visits', label: 'Visits Report' },
  { value: 'campaigns', label: 'Campaigns Report' },
  { value: 'agents', label: 'Agent Performance' },
];

const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('sales');
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const stats = await reportingService.getDashboardStats();
      setDashboardStats(stats);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);
      
      if (reportType === 'sales') {
        const report = await reportingService.getSalesReport(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        setSalesReport(report);
      } else {
        toast.success(`${reportTypes.find(r => r.value === reportType)?.label} report generation coming soon`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    try {
      const blob = await reportingService.exportReport(
        reportType,
        'pdf',
        {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Report exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export report');
    }
  };

  if (loading && !dashboardStats) {
    return <LoadingSpinner message="Loading reports..." />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Reports & Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive reporting and business intelligence dashboard
          </Typography>
        </Box>

        {/* Dashboard Stats */}
        {dashboardStats && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Sales"
                value={`R ${dashboardStats.totalSales.value.toLocaleString('en-ZA')}`}
                change={{
                  value: dashboardStats.totalSales.change,
                  type: dashboardStats.totalSales.changeType,
                  label: 'vs last month',
                }}
                icon={<ShoppingCart />}
                color="#4caf50"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Campaigns"
                value={dashboardStats.activeCampaigns.value}
                change={{
                  value: dashboardStats.activeCampaigns.change,
                  type: dashboardStats.activeCampaigns.changeType,
                  label: 'vs last month',
                }}
                icon={<Campaign />}
                color="#2196f3"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Visits Completed"
                value={dashboardStats.visitsCompleted.value}
                change={{
                  value: dashboardStats.visitsCompleted.change,
                  type: dashboardStats.visitsCompleted.changeType,
                  label: 'vs last month',
                }}
                icon={<LocationOn />}
                color="#ff9800"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Agents"
                value={dashboardStats.activeAgents.value}
                change={{
                  value: dashboardStats.activeAgents.change,
                  type: dashboardStats.activeAgents.changeType,
                  label: 'vs last month',
                }}
                icon={<People />}
                color="#9c27b0"
              />
            </Grid>
          </Grid>
        )}

        {/* Report Generation */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Generate Reports
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Report Type"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  {reportTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={generateReport}
                    disabled={loading}
                    startIcon={<Assessment />}
                    fullWidth
                  >
                    Generate
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={exportReport}
                    disabled={loading}
                    startIcon={<GetApp />}
                  >
                    Export
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Sales Report Results */}
        {salesReport && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Sales Report ({salesReport.period})
              </Typography>
              
              {/* Summary Stats */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                      R {salesReport.totalRevenue.toLocaleString('en-ZA')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Revenue
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="secondary" sx={{ fontWeight: 700 }}>
                      {salesReport.totalOrders}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Orders
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                      R {salesReport.averageOrderValue.toLocaleString('en-ZA')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Average Order Value
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Top Products */}
              <Typography variant="h6" sx={{ mb: 2 }}>
                Top Products
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Quantity Sold</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesReport.topProducts.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell>{product.productName}</TableCell>
                        <TableCell align="right">{product.quantity}</TableCell>
                        <TableCell align="right">R {product.revenue.toLocaleString('en-ZA')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Sales by Agent */}
              <Typography variant="h6" sx={{ mb: 2 }}>
                Sales by Agent
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Agent</TableCell>
                      <TableCell align="right">Orders</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">Performance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesReport.salesByAgent.map((agent, index) => (
                      <TableRow key={index}>
                        <TableCell>{agent.agentName}</TableCell>
                        <TableCell align="right">{agent.orders}</TableCell>
                        <TableCell align="right">R {agent.revenue.toLocaleString('en-ZA')}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={agent.revenue > salesReport.averageOrderValue * agent.orders ? 'Above Average' : 'Below Average'}
                            size="small"
                            color={agent.revenue > salesReport.averageOrderValue * agent.orders ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LoadingSpinner message="Generating report..." />
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default ReportsPage;