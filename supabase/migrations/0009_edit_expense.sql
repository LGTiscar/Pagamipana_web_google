-- ============================================================================
-- PagaMiPana · Editar gastos
-- RPCs atómicos para actualizar un gasto manual o por ticket (OCR):
-- actualiza la fila + regenera shares (y los ítems, en OCR) en una transacción.
-- Reutiliza la validación de membresía y de que las partes cuadren con el total.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- update_expense: gasto manual (equal | shares | exact | percent)
-- ---------------------------------------------------------------------------
create or replace function public.update_expense(
  p_expense_id  uuid,
  p_description text,
  p_amount      numeric,
  p_paid_by     uuid,
  p_split_type  text,
  p_shares      jsonb default '[]'::jsonb
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
begin
  select project_id into proj from public.expenses where id = p_expense_id;
  if proj is null then
    raise exception 'Gasto no encontrado';
  end if;
  if not public.is_project_member(proj) then
    raise exception 'No autorizado en este proyecto';
  end if;

  select coalesce(sum((s->>'amount')::numeric), 0)
    into total_shares
    from jsonb_array_elements(p_shares) s;
  if abs(total_shares - p_amount) > 0.01 then
    raise exception 'Las partes (%) no suman el total (%)', total_shares, p_amount;
  end if;

  update public.expenses
     set description  = p_description,
         amount_total = p_amount,
         paid_by      = p_paid_by,
         split_type   = coalesce(p_split_type, split_type)
   where id = p_expense_id
   returning * into exp;

  delete from public.expense_shares where expense_id = p_expense_id;
  for sh in select * from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, participant_id, amount)
    values (p_expense_id, (sh->>'participant_id')::uuid, (sh->>'amount')::numeric);
  end loop;

  return exp;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_ocr_expense: gasto por ticket (regenera shares + líneas del ticket)
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
    insert into public.expense_items (expense_id, description, quantity, unit_price, owner_ids)
    values (
      p_expense_id,
      coalesce(it->>'description', 'Producto'),
      coalesce((it->>'quantity')::numeric, 1),
      coalesce((it->>'unit_price')::numeric, 0),
      coalesce(
        (select array_agg(value::uuid) from jsonb_array_elements_text(it->'owner_ids')),
        '{}'::uuid[]
      )
    );
  end loop;

  return exp;
end;
$$;

grant execute on function public.update_expense(uuid, text, numeric, uuid, text, jsonb) to authenticated;
grant execute on function public.update_ocr_expense(uuid, text, numeric, uuid, jsonb, jsonb) to authenticated;
