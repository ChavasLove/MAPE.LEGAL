-- 016: Broadcast error tracking
-- Adds error_msg + aborted_reason to broadcast_log so failed runs (e.g. expired
-- WHATSAPP_TOKEN) record the failure reason instead of silently logging
-- total_enviados=0 with no diagnostic context. aborted_reason is a structured
-- enum-like value ('whatsapp_auth' | 'whatsapp_config') consumers can branch
-- on; error_msg holds the human-readable trace for ops triage.

alter table broadcast_log add column if not exists error_msg      text;
alter table broadcast_log add column if not exists aborted_reason text;
