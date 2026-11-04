-- Aligne les types d'opération de stock sur ceux réellement supportés,
-- puis prépare l'arrivée des ventes.
--
-- Contexte : la base de développement porte une version enrichie de
-- `post_stock_operation` (types `issue` et `inventory`), alors que les migrations
-- du dépôt s'arrêtent aux cinq types d'origine. Cette migration rend les deux
-- mondes compatibles et ajoute `sale`, sans réécrire le corps de la fonction :
-- seules les listes de types autorisées sont ajustées à partir de la définition
-- vivante.

begin;

alter table public.stock_operations drop constraint if exists stock_operations_type_valid;
alter table public.stock_operations add constraint stock_operations_type_valid check (
  operation_type in (
    'opening',
    'receipt',
    'issue',
    'adjustment',
    'inventory',
    'transfer',
    'sale',
    'reversal'
  )
);

do $$
declare
  v_def text;
  v_before text;
begin
  v_def := pg_get_functiondef('public.post_stock_operation(uuid,text,text,text,text,jsonb,uuid)'::regprocedure);
  v_before := v_def;

  -- Une base issue des seules migrations du dépôt ne connaît pas `issue`.
  if position('''issue''' in v_def) = 0 then
    v_def := replace(v_def, '''receipt'', ''adjustment''', '''receipt'', ''issue'', ''adjustment''');
  end if;

  -- Ajout de `sale` dans la liste des types acceptés (liste du contrôle `not in`).
  v_def := replace(v_def, '''transfer'', ''reversal'')', '''transfer'', ''sale'', ''reversal'')');

  if position('''sale''' in v_def) = 0 then
    raise exception 'Patch post_stock_operation impossible : liste des types introuvable';
  end if;

  if v_def <> v_before then
    execute v_def;
  end if;
end $$;

comment on column public.stock_operations.operation_type is
  'opening | receipt | issue | adjustment | inventory | transfer | sale | reversal';

commit;
