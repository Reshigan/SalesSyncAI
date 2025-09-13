import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export interface TenantRequest extends AuthenticatedRequest {
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}

export const tenantMiddleware = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required for tenant access'
    });
    return;
  }

  // For super admin, tenant can be specified via header
  if (req.user.role === 'SUPER_ADMIN') {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (tenantId) {
      // TODO: Validate tenant exists and attach to request
      req.tenant = {
        id: tenantId,
        name: 'Tenant Name', // This should be fetched from database
        slug: 'tenant-slug'
      };
    }
  } else {
    // For regular users, use their company as tenant
    req.tenant = {
      id: req.user.companyId,
      name: 'Company Name', // This should be fetched from database
      slug: 'company-slug'
    };
  }

  next();
};

export const ensureTenant = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.tenant) {
    res.status(400).json({
      success: false,
      error: 'Tenant context required'
    });
    return;
  }

  next();
};