import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  TextField,
  MenuItem,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Card,
  CardContent,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  ShoppingCart,
  Person,
  Business,
  CalendarToday,
  AttachMoney,
  Receipt,
  LocalShipping,
  CheckCircle,
  Cancel,
  Pending,
} from '@mui/icons-material';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import DataTable, { Column, Action } from '../../components/Common/DataTable';
import FormDialog from '../../components/Common/FormDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import StatCard from '../../components/Common/StatCard';
import { 
  orderService, 
  customerService, 
  productService,
  Order, 
  Customer, 
  Product,
  CreateOrderRequest 
} from '../../services/apiService';

const orderSchema = yup.object({
  customerId: yup
    .string()
    .required('Customer is required'),
  items: yup
    .array()
    .of(
      yup.object({
        productId: yup.string().required('Product is required'),
        quantity: yup.number().min(1, 'Quantity must be at least 1').required('Quantity is required'),
        unitPrice: yup.number().min(0, 'Price must be positive').required('Price is required'),
      })
    )
    .min(1, 'At least one item is required')
    .required('Items are required'),
  paymentMethod: yup.string().notRequired(),
  deliveryDate: yup.string().notRequired(),
  notes: yup.string().notRequired(),
});

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'credit', label: 'Credit' },
];

const SalesPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateOrderRequest>({
    resolver: yupResolver(orderSchema) as any,
    defaultValues: {
      customerId: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0 }],
      paymentMethod: 'cash',
      deliveryDate: '',
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  const columns: Column[] = [
    {
      id: 'orderNumber',
      label: 'Order #',
      minWidth: 120,
      format: (value: string) => (
        <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
          {value}
        </Typography>
      ),
    },
    {
      id: 'customer',
      label: 'Customer',
      minWidth: 200,
      format: (value: any, row: Order) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}>
            <Business fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {row.customer.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.customer.address}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'agent',
      label: 'Agent',
      minWidth: 150,
      format: (value: any, row: Order) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'secondary.main', mr: 1, width: 24, height: 24 }}>
            <Person fontSize="small" />
          </Avatar>
          <Typography variant="body2">
            {row.agent.firstName} {row.agent.lastName}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'total',
      label: 'Total',
      minWidth: 120,
      align: 'right',
      format: (value: number) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          R {value.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      format: (value: string) => {
        const getStatusConfig = (status: string) => {
          switch (status) {
            case 'pending':
              return { color: 'warning' as const, label: 'Pending', icon: <Pending fontSize="small" /> };
            case 'confirmed':
              return { color: 'info' as const, label: 'Confirmed', icon: <CheckCircle fontSize="small" /> };
            case 'processing':
              return { color: 'primary' as const, label: 'Processing', icon: <Receipt fontSize="small" /> };
            case 'shipped':
              return { color: 'secondary' as const, label: 'Shipped', icon: <LocalShipping fontSize="small" /> };
            case 'delivered':
              return { color: 'success' as const, label: 'Delivered', icon: <CheckCircle fontSize="small" /> };
            case 'cancelled':
              return { color: 'error' as const, label: 'Cancelled', icon: <Cancel fontSize="small" /> };
            default:
              return { color: 'default' as const, label: status, icon: null };
          }
        };
        
        const config = getStatusConfig(value);
        return (
          <Chip
            label={config.label}
            size="small"
            color={config.color}
            variant="filled"
            {...(config.icon && { icon: config.icon })}
          />
        );
      },
    },
    {
      id: 'paymentStatus',
      label: 'Payment',
      minWidth: 100,
      format: (value: string) => {
        const getPaymentConfig = (status: string) => {
          switch (status) {
            case 'pending':
              return { color: 'warning' as const, label: 'Pending' };
            case 'paid':
              return { color: 'success' as const, label: 'Paid' };
            case 'failed':
              return { color: 'error' as const, label: 'Failed' };
            case 'refunded':
              return { color: 'info' as const, label: 'Refunded' };
            default:
              return { color: 'default' as const, label: status };
          }
        };
        
        const config = getPaymentConfig(value);
        return (
          <Chip
            label={config.label}
            size="small"
            color={config.color}
            variant="outlined"
          />
        );
      },
    },
    {
      id: 'createdAt',
      label: 'Created',
      minWidth: 120,
      format: (value: string) => {
        const date = new Date(value);
        return (
          <Typography variant="body2">
            {date.toLocaleDateString()}
          </Typography>
        );
      },
    },
  ];

  const actions: Action[] = [
    {
      label: 'View Details',
      icon: <Visibility />,
      onClick: handleViewOrder,
    },
    {
      label: 'Edit',
      icon: <Edit />,
      onClick: handleEditOrder,
      disabled: (row: Order) => ['delivered', 'cancelled'].includes(row.status),
    },
    {
      label: 'Cancel',
      icon: <Cancel />,
      onClick: handleCancelOrder,
      color: 'error',
      disabled: (row: Order) => ['delivered', 'cancelled'].includes(row.status),
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, customersData, productsData] = await Promise.all([
        orderService.getOrders(),
        customerService.getCustomers(),
        productService.getProducts(),
      ]);
      setOrders(ordersData);
      setCustomers(customersData);
      setProducts(productsData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrder = () => {
    setIsEdit(false);
    setSelectedOrder(null);
    reset({
      customerId: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0 }],
      paymentMethod: 'cash',
      deliveryDate: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  function handleEditOrder(order: Order) {
    setIsEdit(true);
    setSelectedOrder(order);
    reset({
      customerId: order.customer.id,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      paymentMethod: order.paymentMethod || 'cash',
      deliveryDate: order.deliveryDate ? order.deliveryDate.slice(0, 10) : '',
      notes: order.notes || '',
    });
    setDialogOpen(true);
  }

  function handleViewOrder(order: Order) {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  }

  function handleCancelOrder(order: Order) {
    setSelectedOrder(order);
    setConfirmDialogOpen(true);
  }

  const onSubmit = async (data: CreateOrderRequest) => {
    try {
      setSubmitting(true);
      
      if (isEdit && selectedOrder) {
        await orderService.updateOrder(selectedOrder.id, data);
        toast.success('Order updated successfully');
      } else {
        await orderService.createOrder(data);
        toast.success('Order created successfully');
      }
      
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrder) return;

    try {
      setSubmitting(true);
      await orderService.cancelOrder(selectedOrder.id, 'Cancelled by user');
      toast.success('Order cancelled successfully');
      setConfirmDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel order');
    } finally {
      setSubmitting(false);
    }
  };

  const addOrderItem = () => {
    append({ productId: '', quantity: 1, unitPrice: 0 });
  };

  const removeOrderItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const calculateTotal = () => {
    return watchedItems.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);
  };

  const getOrderStats = () => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const confirmed = orders.filter(o => o.status === 'confirmed').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

    return { total, pending, confirmed, delivered, totalRevenue };
  };

  const stats = getOrderStats();

  if (loading) {
    return <LoadingSpinner message="Loading sales data..." />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Sales Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track sales performance, manage orders, and analyze revenue
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
          onClick={handleAddOrder}
        >
          Create Order
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Orders"
            value={stats.total}
            icon={<ShoppingCart />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<Pending />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Confirmed"
            value={stats.confirmed}
            icon={<CheckCircle />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Delivered"
            value={stats.delivered}
            icon={<LocalShipping />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Revenue"
            value={`R ${stats.totalRevenue.toLocaleString('en-ZA')}`}
            icon={<AttachMoney />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      <DataTable
        columns={columns}
        data={orders}
        actions={actions}
        searchable
        exportable
        refreshable
        onRefresh={loadData}
        emptyMessage="No orders found"
      />

      {/* Add/Edit Order Dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={isEdit ? 'Edit Order' : 'Create New Order'}
        subtitle={isEdit ? 'Update order information' : 'Create a new sales order'}
        onSubmit={handleSubmit(onSubmit)}
        loading={submitting}
        submitLabel={isEdit ? 'Update Order' : 'Create Order'}
        maxWidth="lg"
      >
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.customerId}>
              <InputLabel>Customer</InputLabel>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Customer"
                    startAdornment={<Business sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    {customers.map((customer) => (
                      <MenuItem key={customer.id} value={customer.id}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {customer.address}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Controller
                name="paymentMethod"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Payment Method"
                    startAdornment={<AttachMoney sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method.value} value={method.value}>
                        {method.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="deliveryDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Delivery Date"
                  type="date"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    startAdornment: <CalendarToday sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Order Total"
              value={`R ${calculateTotal().toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`}
              InputProps={{
                readOnly: true,
                startAdornment: <AttachMoney sx={{ mr: 1, color: 'action.active' }} />,
              }}
              sx={{ '& .MuiInputBase-input': { fontWeight: 600 } }}
            />
          </Grid>

          {/* Order Items */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Order Items
            </Typography>
            <Card variant="outlined">
              <CardContent>
                {fields.map((field, index) => (
                  <Box key={field.id} sx={{ mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth error={!!errors.items?.[index]?.productId}>
                          <InputLabel>Product</InputLabel>
                          <Controller
                            name={`items.${index}.productId`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                {...field}
                                label="Product"
                                onChange={(e) => {
                                  field.onChange(e);
                                  const product = products.find(p => p.id === e.target.value);
                                  if (product) {
                                    // Auto-fill unit price
                                    reset({
                                      ...watch(),
                                      items: watch('items').map((item, i) => 
                                        i === index ? { ...item, unitPrice: product.price } : item
                                      )
                                    });
                                  }
                                }}
                              >
                                {products.map((product) => (
                                  <MenuItem key={product.id} value={product.id}>
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {product.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        R {product.price.toFixed(2)} - Stock: {product.stock}
                                      </Typography>
                                    </Box>
                                  </MenuItem>
                                ))}
                              </Select>
                            )}
                          />
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Controller
                          name={`items.${index}.quantity`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label="Quantity"
                              type="number"
                              inputProps={{ min: 1 }}
                              error={!!errors.items?.[index]?.quantity}
                              helperText={errors.items?.[index]?.quantity?.message}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Controller
                          name={`items.${index}.unitPrice`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label="Unit Price"
                              type="number"
                              inputProps={{ min: 0, step: 0.01 }}
                              error={!!errors.items?.[index]?.unitPrice}
                              helperText={errors.items?.[index]?.unitPrice?.message}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            R {((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unitPrice || 0)).toFixed(2)}
                          </Typography>
                          <IconButton
                            onClick={() => removeOrderItem(index)}
                            disabled={fields.length === 1}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </Grid>
                    </Grid>
                    {index < fields.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))}
                <Button
                  onClick={addOrderItem}
                  startIcon={<Add />}
                  variant="outlined"
                  size="small"
                >
                  Add Item
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                />
              )}
            />
          </Grid>
        </Grid>
      </FormDialog>

      {/* View Order Dialog */}
      <FormDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        title="Order Details"
        subtitle={`Order #${selectedOrder?.orderNumber}`}
        maxWidth="md"
        actions={
          <Button onClick={() => setViewDialogOpen(false)} variant="contained">
            Close
          </Button>
        }
      >
        {selectedOrder && (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Customer</Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {selectedOrder.customer.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOrder.customer.address}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Agent</Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {selectedOrder.agent.firstName} {selectedOrder.agent.lastName}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Status</Typography>
              <Chip
                label={selectedOrder.status}
                size="small"
                color="primary"
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary">Payment Status</Typography>
              <Chip
                label={selectedOrder.paymentStatus}
                size="small"
                color="secondary"
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                Order Items
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">R {item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">R {item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} sx={{ fontWeight: 600 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        R {selectedOrder.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {selectedOrder.notes && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                <Typography variant="body2">{selectedOrder.notes}</Typography>
              </Grid>
            )}
          </Grid>
        )}
      </FormDialog>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Order"
        message={`Are you sure you want to cancel order #${selectedOrder?.orderNumber}? This action cannot be undone.`}
        type="error"
        confirmLabel="Cancel Order"
        loading={submitting}
      />
    </Box>
  );
};

export default SalesPage;