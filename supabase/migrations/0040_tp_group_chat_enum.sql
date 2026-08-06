-- New channel type for trainee TP-group chat (Ramy, 2026-08-05: "the TP
-- students will have their own [chat], but they can also message their TP
-- tutor"). Split into its own file/transaction on purpose -- Postgres
-- forbids using a freshly added enum value inside the same transaction
-- that added it, so the actual channel-provisioning logic that inserts
-- rows with type = 'tp_group' lives in the next migration.
alter type public.staff_channel_type add value 'tp_group';
