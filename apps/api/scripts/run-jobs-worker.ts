import 'dotenv/config';
import { processJobBatch } from '../src/services/jobs/queue';
import { scanUpcomingAppointmentReminders } from '../src/services/appointments/reminder-service';

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
