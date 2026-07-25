-- ============================================================================
-- PagaMiPana · Reparto por-unidad fiel en tickets
-- Guardamos el reparto unidad-a-unidad de cada línea del ticket, no solo la
-- unión de participantes. Así el desglose y la edición son 100% fieles aunque
-- una línea se reparta de forma desigual (p. ej. 2 cervezas para A y 1 para B).
--
-- `units` es un jsonb con forma string[][] (owners por unidad; length = quantity).
-- Nullable y retrocompatible: los ítems antiguos (units NULL) siguen
-- reconstruyéndose de forma uniforme desde `owner_ids` en el frontend.
-- `owner_ids` se mantiene como unión derivada (compatibilidad / posibles filtros).
-- ============================================================================

alter table public.expense_items add column if not exists units jsonb;

-- ---------------------------------------------------------------------------
-- add_ocr_expense: ahora persiste también `units` de cada línea.
-- ---------------------------------------------------------------------------
create or replace function public.add_ocr_expense(
  p_project_id  uuid,
  p_description text,
  p_amount      numeric,
  p_paid_by     uuid,
  p_shares      jsonb,
  p_items       jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.expenses;
  cur text;
  total_shares numeric;
  sh jsonb;
  it jsonb;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'No autorizado en este proyecto';
  end if;

  select currency into cur from public.projects where id = p_project_id;

  select coalesce(sum((s->>'amount')::numeric), 0) into total_shares
    from jsonb_array_elements(p_shares) s;
  if abs(total_shares - p_amount) > 0.01 then
    raise exception 'Las partes (%) no suman el total (%)', total_shares, p_amount;
  end if;

  insert into public.expenses
    (project_id, description, amount_total, currency, paid_by, split_type, source, created_by)
  values
    (p_project_id, p_description, p_amount, coalesce(cur, 'EUR'), p_paid_by, 'by_item', 'ocr', auth.uid())
  returning * into exp;

  for sh in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, participant_id, amount)
    values (exp.id, (sh->>'participant_id')::uuid, (sh->>'amount')::numeric);
  end loop;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.expense_items (expense_id, description, quantity, unit_price, owner_ids, units)
    values (
      exp.id,
      coalesce(it->>'description', 'Producto'),
      coalesce((it->>'quantity')::numeric, 1),
      coalesce((it->>'unit_price')::numeric, 0),
      coalesce(
        (select array_agg(value::uuid) from jsonb_array_elements_text(it->'owner_ids')),
        '{}'::uuid[]
      ),
      coalesce(it->'units', '[]'::jsonb)
    );
  end loop;

  return exp;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_ocr_expense: idem al editar (regenera líneas con `units`).
-- ---------------------------------------------------------------------------
create or replace function public.update_ocr_expense(
  p_expense_id  uuid,
  p_description text,
  p_amount      numeric,
  p_paid_by     uuid,
  p_shares      jsonb,
  p_items       jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.expenses;
  proj uuid;
  total_shares numeric;
  sh jsonb;
  it jsonb;
begin
  select project_id into proj from public.expenses where id = p_expense_id;
  if proj is null then
    raise exception 'Gasto no encontrado';
  end if;
  if not public.is_project_member(proj) then
    raise exception 'No autorizado en este proyecto';
  end if;

  select coalesce(sum((s->>'amount')::numeric), 0) into total_shares
    from jsonb_array_elements(p_shares) s;
  if abs(total_shares - p_amount) > 0.01 then
    raise exception 'Las partes (%) no suman el total (%)', total_shares, p_amount;
  end if;

  update public.expenses
     set description  = p_description,
         amount_total = p_amount,
         paid_by      = p_paid_by,
         split_type   = 'by_item'
   where id = p_expense_id
   returning * into exp;

  delete from public.expense_shares where expense_id = p_expense_id;
  for sh in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, participant_id, amount)
    values (p_expense_id, (sh->>'participant_id')::uuid, (sh->>'amount')::numeric);
  end loop;

  delete from public.expense_items where expense_id = p_expense_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.expense_items (expense_id, description, quantity, unit_price, owner_ids, units)
    values (
      p_expense_id,
      coalesce(it->>'description', 'Producto'),
      coalesce((it->>'quantity')::numeric, 1),
      coalesce((it->>'unit_price')::numeric, 0),
      coalesce(
        (select array_agg(value::uuid) from jsonb_array_elements_text(it->'owner_ids')),
        '{}'::uuid[]
      ),
      coalesce(it->'units', '[]'::jsonb)
    );
  end loop;

  return exp;
end;
$$;
