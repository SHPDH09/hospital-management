/** Public app base URL used for Cashfree return URLs and domain whitelisting. */
export function getAppUrl(): string {
  const raw = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (raw === '*') return 'http://localhost:5173';
  return raw.replace(/\/$/, '');
}

export function getCashfreeWhitelistDomain(): string {
  return getAppUrl();
}

export const CASHFREE_WHITELIST_DASHBOARD_URL = 'https://merchant.cashfree.com/merchants/pg/developers/whitelisting?env=prod';

export function cashfreeWhitelistMeta(env: string) {
  return {
    whitelistDomain: getCashfreeWhitelistDomain(),
    whitelistDashboardUrl: CASHFREE_WHITELIST_DASHBOARD_URL,
    requiresDomainWhitelist: env === 'production',
  };
}
