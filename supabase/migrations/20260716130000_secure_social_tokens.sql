-- OAuth-tokens mogen nooit naar de browser. Kolom-privileges zorgen dat
-- authenticated-gebruikers de gevoelige kolommen (access_token,
-- refresh_token, meta met page-tokens) niet kunnen selecteren; alle
-- schrijf-/leesacties met tokens lopen via de server (service_role).
revoke select, insert, update, delete on public.social_connections from authenticated;

grant select (
  id,
  client_id,
  platform,
  account_id,
  account_username,
  follower_count,
  status,
  connected_at,
  connected_by,
  connection_id,
  postiz_integration_id,
  token_expires_at,
  created_at,
  updated_at
) on public.social_connections to authenticated;

grant all on public.social_connections to service_role;
