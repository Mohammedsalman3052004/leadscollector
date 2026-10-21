-- OPTIONAL: run the delivery/retry job every minute from inside Supabase.
-- 1) Dashboard -> Database -> Extensions: enable pg_cron and pg_net.
-- 2) Replace YOUR-DOMAIN and YOUR_CRON_SECRET, then run this in the SQL editor.
select cron.schedule(
  'lc-deliver', '* * * * *',
  $$ select net.http_post(
       url := 'https://YOUR-DOMAIN/api/jobs/deliver',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json')
     ) $$);
select cron.schedule(
  'lc-cleanup', '30 3 * * *',
  $$ select net.http_post(
       url := 'https://YOUR-DOMAIN/api/jobs/cleanup',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET', 'Content-Type', 'application/json')
     ) $$);
-- To remove: select cron.unschedule('lc-deliver'); select cron.unschedule('lc-cleanup');
