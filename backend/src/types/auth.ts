import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string;
    permissions: string[];
  };
}

export interface User {
  id: string;
  email: string;
  role: string;
  companyId: string;
  permissions: string[];
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  companyId: string;
  permissions: string[];
}