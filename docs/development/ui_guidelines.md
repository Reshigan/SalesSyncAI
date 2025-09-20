# SalesSyncAI UI Development Guidelines

## Overview

This document provides guidelines for maintaining consistent UI development across the SalesSyncAI platform. Following these guidelines ensures a cohesive user experience and simplifies future maintenance.

## Component Structure

### Layout Components

All layout components should be placed in the `/src/components/Layout` directory:

- `Sidebar.tsx`: Main navigation sidebar
- `PageHeader.tsx`: Standard page header with title and actions
- `PageContainer.tsx`: Wrapper for page content with consistent padding
- `DataCard.tsx`: Standard card component for displaying data sections

### Page Structure

Each page should follow this structure:

```tsx
import React from 'react';
import { PageContainer } from '../../components/Layout/PageContainer';
import { PageHeader } from '../../components/Layout/PageHeader';
import { DataCard } from '../../components/Layout/DataCard';

const ExamplePage: React.FC = () => {
  return (
    <PageContainer>
      <PageHeader 
        title="Page Title" 
        subtitle="Optional subtitle description"
        actions={[/* Action buttons */]} 
      />
      
      <DataCard title="Section Title">
        {/* Card content */}
      </DataCard>
      
      {/* Additional components */}
    </PageContainer>
  );
};

export default ExamplePage;
```

## Styling Guidelines

### MUI Theme

All styling should use the Material-UI theme system. The theme is defined in `/src/theme/index.ts` and includes our brand colors and typography.

```tsx
// Example of using theme
import { useTheme } from '@mui/material/styles';

const Component = () => {
  const theme = useTheme();
  
  return (
    <Box sx={{ 
      backgroundColor: theme.palette.primary.main,
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius
    }}>
      Content
    </Box>
  );
};
```

### Color Usage

- Primary actions: `primary.main` (#1E3A8A)
- Secondary/accent elements: `secondary.main` (#FB923C)
- Backgrounds: `background.default` (white) or `background.paper` (light gray)
- Text: `text.primary` (#374151) for main text, `text.secondary` for less important text

### Spacing

Use the theme spacing function for consistent spacing:

```tsx
// Good
<Box sx={{ padding: theme.spacing(2) }}>

// Bad
<Box sx={{ padding: '16px' }}>
```

Standard spacing scale:
- 1 = 8px
- 2 = 16px
- 3 = 24px
- 4 = 32px
- 5 = 40px

## Form Components

### Input Fields

Use the standard MUI TextField component with our custom styling:

```tsx
<TextField
  label="Field Label"
  placeholder="Enter value"
  fullWidth
  variant="outlined"
  size="medium"
  sx={{
    mb: 2,
    '& .MuiOutlinedInput-root': {
      borderRadius: 1
    }
  }}
/>
```

### Buttons

Primary buttons:
```tsx
<Button 
  variant="contained" 
  color="primary"
  startIcon={<AddIcon />}
>
  Create New
</Button>
```

Secondary buttons:
```tsx
<Button 
  variant="outlined" 
  color="primary"
>
  Cancel
</Button>
```

Text buttons:
```tsx
<Button 
  variant="text" 
  color="primary"
>
  View Details
</Button>
```

## Data Display

### Tables

Use MUI DataGrid for complex data tables:

```tsx
import { DataGrid } from '@mui/x-data-grid';

const columns = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'name', headerName: 'Name', width: 150 },
  // Additional columns
];

<DataGrid
  rows={rows}
  columns={columns}
  pageSize={10}
  checkboxSelection
  disableSelectionOnClick
  sx={{
    border: 'none',
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: 'background.paper',
    }
  }}
/>
```

### Charts

Use Recharts for data visualization:

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="#1E3A8A" />
  </BarChart>
</ResponsiveContainer>
```

## Icons

Use Material Icons for consistency:

```tsx
import { Dashboard, People, Settings } from '@mui/icons-material';

<Dashboard color="primary" />
```

## Responsive Design

- Use MUI's Grid system for responsive layouts
- Use the `useMediaQuery` hook for conditional rendering based on screen size
- Test all components on mobile, tablet, and desktop viewports

```tsx
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const Component = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <Box sx={{ 
      padding: isMobile ? theme.spacing(1) : theme.spacing(3)
    }}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </Box>
  );
};
```

## Loading States

Use Skeleton components for loading states:

```tsx
import { Skeleton } from '@mui/material';

{isLoading ? (
  <Skeleton variant="rectangular" width="100%" height={200} />
) : (
  <ActualContent />
)}
```

## Error Handling

Use toast notifications for errors:

```tsx
import { toast } from 'react-toastify';

try {
  // Operation
} catch (error) {
  toast.error('An error occurred: ' + error.message);
}
```

## Git Workflow

1. Create feature branches from `main`
2. Use descriptive branch names: `feature/user-management`, `fix/login-issue`
3. Make small, focused commits with clear messages
4. Create pull requests with detailed descriptions
5. Ensure all tests pass before merging
6. Delete branches after merging

## Code Quality

- Use TypeScript for all new components
- Add proper type definitions for props and state
- Use functional components with hooks instead of class components
- Add comments for complex logic
- Follow the ESLint configuration

## Upcoming Modules

The following modules are planned for development:

### Trade Marketing Module
- Campaign management
- Marketing materials distribution
- Brand visibility tracking
- Competitor analysis

### Trade Promotion Module
- Promotion planning
- Budget allocation
- ROI tracking
- Promotion effectiveness analysis

### Events Module
- Event planning and scheduling
- Attendee management
- Resource allocation
- Post-event analysis

These modules should follow all UI guidelines established in this document to maintain consistency across the application.