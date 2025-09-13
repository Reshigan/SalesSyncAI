import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string;
    permissions: string[];
  };
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  companyId: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      // Verify user still exists and is active
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.id,
          isActive: true
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true
            }
          }
        }
      });

      if (!user || !user.company.isActive) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
        return;
      }

      // Update last login time
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        permissions: Array.isArray(user.permissions) ? user.permissions as string[] : []
      };

      next();
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Super admin has all permissions
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // If auth fails, continue without user info
    next();
  }
};

// Alias for compatibility
export const authenticateToken = authMiddleware;