# SalesSyncAI Branding Specifications

## Brand Colors

### Primary Colors
- **Deep Blue**: `#1E3A8A` (RGB: 30, 58, 138)
  - Used for primary UI elements, headers, and main brand identity
  - Conveys trust, professionalism, and reliability

- **Vibrant Orange**: `#FB923C` (RGB: 251, 146, 60)
  - Used for accents, call-to-action buttons, and highlights
  - Conveys energy, enthusiasm, and innovation

### Secondary Colors
- **White**: `#FFFFFF` (RGB: 255, 255, 255)
  - Used for backgrounds, text on dark colors, and to create visual space

- **Light Gray**: `#F8FAFC` (RGB: 248, 250, 252)
  - Used for alternate backgrounds and subtle separations

- **Text Gray**: `#374151` (RGB: 55, 65, 81)
  - Used for primary text content

## Typography

- **Primary Font**: Inter (Sans-serif)
  - Weights used: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
  - Clean, modern, and highly readable at all sizes

- **Headings**:
  - Font: Inter
  - Weight: 600 (SemiBold) or 700 (Bold)
  - Color: `#1E3A8A` (Primary Blue) or `#374151` (Text Gray)

- **Body Text**:
  - Font: Inter
  - Weight: 400 (Regular)
  - Color: `#374151` (Text Gray)

## Logo Specifications

### Logo Components
- **Icon**: Concentric circles with blue, orange, and white elements
  - Represents data synchronization, field sales management, and AI integration
  - The circular design symbolizes completeness and continuous improvement

- **Wordmark**: "SalesSyncAI"
  - "SalesSync" in Deep Blue (`#1E3A8A`)
  - "AI" in Vibrant Orange (`#FB923C`)
  - No space between words to emphasize integration

### Logo Variations
1. **Full Logo**: Icon + Wordmark
   - Used for headers, login screens, and primary brand identification
   - SVG format: `/public/logo.svg`

2. **Icon Only**: Circular icon without text
   - Used for favicon, app icons, and small space applications
   - SVG format: `/public/favicon.svg`

3. **Responsive Sizes**:
   - 512px: `/public/logo512.png`
   - 192px: `/public/logo192.png`
   - 64px: `/public/favicon.ico`

## UI Component Styling

### Buttons
- **Primary Button**:
  - Background: `#1E3A8A` (Deep Blue)
  - Text: White
  - Hover: Slightly darker blue
  - Border Radius: 8px

- **Secondary Button**:
  - Background: White
  - Border: `#1E3A8A` (Deep Blue)
  - Text: `#1E3A8A` (Deep Blue)
  - Hover: Light blue background
  - Border Radius: 8px

### Cards
- Background: White
- Border Radius: 12px
- Shadow: Subtle drop shadow
- Padding: 16-24px

### Navigation
- Active Item:
  - Background: `#1E3A8A` (Deep Blue)
  - Text: White
- Inactive Item:
  - Background: Transparent
  - Text: `#374151` (Text Gray)
- Hover: Light gray background

## Brand Voice & Messaging

### Tagline
"Intelligent Field Sales Management"

### Brand Attributes
- Professional
- Innovative
- Reliable
- Data-driven
- User-friendly

### Key Messages
- Streamline field sales operations with AI-powered insights
- Enhance team productivity through intelligent automation
- Make data-driven decisions with comprehensive analytics
- Connect field teams with real-time synchronization

## Implementation Guidelines

1. All new UI components must adhere to these brand specifications
2. Maintain consistent spacing, typography, and color usage across the application
3. Use the SVG versions of logos whenever possible for optimal scaling
4. Ensure all branding elements are responsive and display correctly on all device sizes
5. When introducing new visual elements, ensure they complement the existing brand identity

## File Locations

- Logo SVG: `/frontend/public/logo.svg`
- Favicon SVG: `/frontend/public/favicon.svg`
- Logo PNG (192px): `/frontend/public/logo192.png`
- Logo PNG (512px): `/frontend/public/logo512.png`
- Favicon ICO: `/frontend/public/favicon.ico`
- Brand Specifications: `/docs/branding_specs.md`