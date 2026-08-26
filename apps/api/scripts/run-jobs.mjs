#!/usr/bin/env node
/**
 * Local job worker — polls and processes queued jobs.
 * Usage: DATABASE_URL=... npm run jobs:worker
 */
import { processJobBatch } from '../src/services/jobs/queue.js';
import { scanUpcomingAppointmentReminders } from '../src/services/appointments/reminder-service.js';

const INTERVAL_MS = 30000;

async function tick() {
  const results = await processJobBatch(25);
  const scheduled = await scanUpcomingAppointmentReminders();
  if (results.length || scheduled) {
    console.log(`[jobs] processed=${results.length} reminders_scheduled=${scheduled}`);
  }
}

console.log('Job worker started. Polling every', INTERVAL_MS / 1000, 'seconds');
await tick();
setInterval(() => tick().catch(console.error), INTERVAL_MS);
