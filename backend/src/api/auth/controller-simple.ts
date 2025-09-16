import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth';
import { config } from '../../config/config';
import { ValidationError, UnauthorizedError, NotFoundError } from '../../middleware/errorHandler';
import { validateLoginRequest, validateChangePasswordRequest, validateForgotPasswordRequest, validateResetPasswordRequest } from './validation';

const prisma = new PrismaClient();

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { error, value } = validateLoginRequest(req.body);
    if (error) {
      throw new ValidationError('Invalid login data', error.details);
    }

    const { email, password } = value;

    // Find user (simple schema - no company relationship)
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase()
      }
    });

    if (!user) {
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
      role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.secret as string, {
      expiresIn: '24h'
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwt.secret as string,
      { expiresIn: '7d' }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    });

    // Prepare user response (exclude password)
    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: new Date()
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
      
      // Get user info
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId
        }
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Generate new access token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
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
        role: true,
        createdAt: true,
        updatedAt: true
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
      data: { password: hashedPassword, updatedAt: new Date() }
    });

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
        email: email.toLowerCase()
      }
    });

    // Always return success to prevent email enumeration
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

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

      // Update password
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { password: hashedPassword, updatedAt: new Date() }
      });

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      throw new ValidationError('Invalid or expired reset token');
    }
  }
}