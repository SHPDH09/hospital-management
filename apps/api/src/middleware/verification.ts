import { Response, NextFunction } from 'express';
import { AuthRequest, PLATFORM_ROLES } from './auth';
import { isAccountActivated } from '../lib/verification-service';

/** Block CRM/referral dashboard until account is verified and activated */
export function requireActivatedAccount(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (PLATFORM_ROLES.includes(req.user.role)) return next();

  isAccountActivated(req.user.userId, req.user.role)
    .then((activated) => {
      if (!activated) {
        return res.status(403).json({
          success: false,
          error: 'Account pending verification. Dashboard access will be enabled after approval.',
          code: 'ACCOUNT_NOT_ACTIVATED',
          redirectTo: '/verification/pending',
        });
      }
      next();
    })
    .catch(next);
}
