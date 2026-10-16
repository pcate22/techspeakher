# Migrations — mode d'emploi

**La référence opérationnelle est `db/sync-to-latest.sql`** : idempotent, il
amène n'importe quelle base (vierge, prod, preview, partiellement migrée) à
l'état exact de `db/schema.sql` — y compris les renommages de tables ET de
leurs contraintes/séquences/index. C'est lui qu'on exécute dans l'éditeur SQL
Neon ; le test `src/__tests__/db-schema-drift.test.ts` garantit qu'il reste
aligné sur `schema.sql`.

Les fichiers `NNN_*.sql` sont l'**historique** : ils documentent chaque
changement et ont déjà tourné en prod. Ne pas les modifier après coup.

⚠️ **Numéros 010/011/012 en double** (branches parallèles main/Tremplin,
fusionnées en juillet 2026). Si tu rejoues les migrations une à une plutôt que
le sync (déconseillé), l'ordre SÛR est :

1. `010_profil_liens_cfp`, `010_tremplin`
2. `011_moissonneur_cfp` **avant** `011_rename_tables` (il cible la table
   `talks`, renommée ensuite)
3. `012_profil_localisation`, `012_tremplin_edition_publique`
4. `013`…`016` dans l'ordre

Note : `011_rename_tables` ne renomme ni l'index unique du moissonneur ni les
contraintes/séquences — seul `sync-to-latest.sql` fait le renommage complet.
