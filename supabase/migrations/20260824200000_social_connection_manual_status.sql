-- Tijdelijke handmatige koppeling: zolang Meta App Review nog niet is
-- goedgekeurd, kan Instagram/Facebook niet via de echte OAuth-flow gekoppeld
-- worden voor klanten die geen tester zijn op de Meta-app. 'manual' is expliciet
-- géén 'active' — de publiceer-flow (social-publish.server.ts::getConnection)
-- gaat alleen door bij status='active' en een access_token, dus een handmatige
-- koppeling kan nooit per ongeluk gebruikt worden om te publiceren.
ALTER TYPE public.social_connection_status ADD VALUE IF NOT EXISTS 'manual';
