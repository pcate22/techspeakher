-- 077 : la prise en charge du transport et du logement, dite telle qu'elle est.
-- L'article du Tremplin 2027 laissait croire à une prise en charge prochaine ;
-- les financements sont cherchés, rien n'est acquis. Idempotent : replace()
-- ne trouve plus l'ancienne phrase au second passage.
UPDATE contenus
   SET corps = replace(corps,
     'nous cherchons des financements pour les prendre en charge.',
     'nous cherchons des financements, mais à ce jour, nous ne pouvons pas les prendre en charge.')
 WHERE slug = 'tremplin-2027-devoxx-france'
   AND corps LIKE '%nous cherchons des financements pour les prendre en charge.%';
