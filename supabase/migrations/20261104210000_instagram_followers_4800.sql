-- Follower von @diehaendlerdetmold: über 4.800 (Stand 04.11.2026, Angabe Louis). Nur Daten.
-- Runde Werte zeigt die Website als „4.800+“; im Admin unter „Instagram“ jederzeit änderbar.
update public.settings
   set instagram_followers = 4800,
       instagram_followers_updated_at = now()
 where id = 1
   and (instagram_followers is null or instagram_followers < 4800);
