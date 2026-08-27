import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from '../lib/response';
import { resolveOrganizationId } from './auth';
import {
  canAccessModule,
  crmPathToModule,
  getSubscriptionAccessForOrg,
  isBasicModule,
} from '../lib/subscription-access';

/** Enforce subscription-based module access on CRM API routes. */
export async function subscriptionGuard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const orgId = await resolveOrganizationId(req);
    if (!orgId) return next();

    const relativePath = req.path.replace(/^\//, '');
    const module = crmPathToModule(relativePath);

    // Subscription & support always reachable.
    if (module === 'subscription' || module === 'support') return next();

    const access = await getSubscriptionAccessForOrg(orgId);
    if (canAccessModule(access, module)) {
      // Basic tier: allow reads on basic modules, block writes on premium paths.
      if (access.accessLevel === 'basic' && !isBasicModule(module)) {
        throw new AppError(access.bannerMessage || 'Subscription expired. Please upgrade to access this feature.', 403);
      }
      if (access.accessLevel === 'basic' && isBasicModule(module) && req.method !== 'GET' && req.method !== 'HEAD' && module !== 'support') {
        if (module !== 'subscription') {
          throw new AppError('This action is locked. Please subscribe to a plan to continue.', 403);
        }
      }
      return next();
    }

    throw new AppError(access.bannerMessage || 'Subscription expired. Please subscribe to a plan and continue.', 403);
  } catch (err) {
    next(err);
  }
}
