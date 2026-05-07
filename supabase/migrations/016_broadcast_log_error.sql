-- 016: Broadcast error tracking
-- Adds error_msg to broadcast_log so failed runs (e.g. expired WHATSAPP_TOKEN)
-- record the failure reason instead of silently logging total_enviados=0
-- with no diagnostic context.

alter table broadcast_log add column if not exists error_msg text;
