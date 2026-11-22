-- PixelForge multi Google Drive accounts. Preserve the existing pixelForge-owner token row.
alter table public.google_drive_oauth_tokens
  drop constraint if exists google_drive_oauth_tokens_id_check;
alter table public.google_drive_oauth_tokens
  add column if not exists account_email text,
  add column if not exists display_name text;
-- Existing owner row remains valid and is displayed as the default account.
update public.google_drive_oauth_tokens
set display_name = coalesce(display_name, 'Owner Google Drive')
where id = 'pixelForge-owner';
