const PLACEHOLDER_PATTERN = /YOUR_|CHANGE_ME|placeholder/i;

const DEFAULT_HOST = 'database-1.cluster-covwo0uikrnc.us-east-1.rds.amazonaws.com';
const DEFAULT_HOST_READ = 'database-1.cluster-ro-covwo0uikrnc.us-east-1.rds.amazonaws.com';

function isUsableUrl(url?: string | null): url is string {
  return Boolean(url && !PLACEHOLDER_PATTERN.test(url));
}

function buildPostgresUrl(host: string): string | undefined {
  const password = process.env.DB_PASSWORD || process.env.RDS_PASSWORD || process.env.POSTGRES_PASSWORD;
  if (!password || PLACEHOLDER_PATTERN.test(password)) return undefined;

  const user = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
  const name = process.env.DB_NAME || process.env.POSTGRES_DATABASE || 'postgres';
  const port = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432';
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${name}?schema=public&sslmode=require`;
}

function pickDirectUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  return candidates.find(isUsableUrl);
}

export function resolveDatabaseUrl(): string | undefined {
  const direct = pickDirectUrl();
  if (direct) return direct;

  return buildPostgresUrl(process.env.DB_HOST || DEFAULT_HOST);
}

export function resolveDatabaseReadUrl(): string | undefined {
  if (isUsableUrl(process.env.DATABASE_URL_READ)) {
    return process.env.DATABASE_URL_READ;
  }

  return buildPostgresUrl(process.env.DB_HOST_READ || DEFAULT_HOST_READ);
}

export function ensureDatabaseEnv(): void {
  const databaseUrl = resolveDatabaseUrl();
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }

  const databaseReadUrl = resolveDatabaseReadUrl();
  if (databaseReadUrl) {
    process.env.DATABASE_URL_READ = databaseReadUrl;
  }
}
