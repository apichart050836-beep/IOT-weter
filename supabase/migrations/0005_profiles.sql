-- ตาราง profiles: ผูก id ผู้ใช้ (auth.users) เข้ากับอีเมล ให้ query ง่ายจากฝั่งแอป (public schema)
-- ใช้แสดงรายชื่อผู้สมัครในหน้า admin ในอนาคต
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "authenticated read profiles" on profiles
  for select using (auth.role() = 'authenticated');

-- สร้างแถวใน profiles อัตโนมัติทุกครั้งที่มีผู้สมัครสมาชิกใหม่ผ่าน Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill ผู้ใช้ที่สมัครไว้ก่อนมีตารางนี้
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
