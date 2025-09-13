import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { AuthenticatedRequest } from '../../middleware/auth';
import { config } from '../../config/config';
import { ValidationError, UnauthorizedError, NotFoundError } from '../../middleware/errorHandler';
import { validateLoginRequest, validateChangePasswordRequest, validateForgotPasswordRequest, validateResetPasswordRequest } from './validation';

const prisma = new PrismaClient();
const redis = createClient({ url: config.redis.url });

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { error, value } = validateLoginRequest(req.body);
    if (error) {
      throw new ValidationError('Invalid login data', error.details);
    }

    const { email, password } = value;

    // Find user with company info
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        isActive: true
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            subscriptionTier: true
          }
        }
      }
    });

    if (!user || !user.company.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      permissions: Array.isArray(user.permissions) ? user.permissions as string[] : []
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.secret as string, {
      expiresIn: '24h'
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.secret as string,
      { expiresIn: '7d' }
    );

    // Store refresh token in Redis (disabled for now)
    // await redis.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Prepare user response (exclude password)
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      profile: user.profile,
      company: user.company,
      lastLoginAt: new Date(),
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      data: {
        user: userResponse,
        token: accessToken,
        refreshToken: refreshToken
      }
    });
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as { userId: string };
      
      // Check if refresh token exists in Redis
      const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Get user info
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId,
          isActive: true
        },
        include: {
          company: {
            select: {
              isActive: true
            }
          }
        }
      });

      if (!user || !user.company.isActive) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Generate new access token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        permissions: Array.isArray(user.permissions) ? user.permissions as string[] : []
      };

      const newAccessToken = jwt.sign(tokenPayload, config.jwt.secret as string, {
        expiresIn: '24h'
      });

      res.json({
        success: true,
        data: {
          token: newAccessToken
        }
      });
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Remove refresh token from Redis
    await redis.del(`refresh_token:${req.user.id}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        permissions: true,
        profile: true,
        lastLoginAt: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionTier: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: user
    });
  }

  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { error, value } = validateChangePasswordRequest(req.body);
    if (error) {
      throw new ValidationError('Invalid password change data', error.details);
    }

    const { currentPassword, newPassword } = value;

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Invalidate all refresh tokens for this user
    await redis.del(`refresh_token:${user.id}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { error, value } = validateForgotPasswordRequest(req.body);
    if (error) {
      throw new ValidationError('Invalid email', error.details);
    }

    const { email } = value;

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        isActive: true
      }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
      return;
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // Store reset token in Redis with 1 hour expiry
    await redis.setEx(`password_reset:${user.id}`, 3600, resetToken);

    // TODO: Send email with reset link
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { error, value } = validateResetPasswordRequest(req.body);
    if (error) {
      throw new ValidationError('Invalid reset password data', error.details);
    }

    const { token, newPassword } = value;

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { 
        userId: string; 
        type: string; 
      };

      if (decoded.type !== 'password_reset') {
        throw new ValidationError('Invalid reset token');
      }

      // Check if token exists in Redis
      const storedToken = await redis.get(`password_reset:${decoded.userId}`);
      if (storedToken !== token) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

      // Update password
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { password: hashedPassword }
      });

      // Remove reset token
      await redis.del(`password_reset:${decoded.userId}`);

      // Invalidate all refresh tokens
      await redis.del(`refresh_token:${decoded.userId}`);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      throw new ValidationError('Invalid or expired reset token');
    }
  }
}