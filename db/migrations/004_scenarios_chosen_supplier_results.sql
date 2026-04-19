-- Per-scenario approval + supplier search results
alter table scenarios add column if not exists chosen boolean not null default false;
alter table scenarios add column if not exists supplier_results jsonb;
