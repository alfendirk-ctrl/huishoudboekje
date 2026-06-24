# Huishoudboekje

Persoonlijk huishoudboekje voor Dirk & Shelley.

## Setup

### 1. Supabase instellen

1. Ga naar [supabase.com](https://supabase.com) en maak een gratis account
2. Maak een nieuw project aan (bijv. `huishoudboekje`)
3. Ga naar **SQL Editor** en voer dit uit:

```sql
create table storage (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table storage enable row level security;

create policy "Publiek lezen en schrijven"
  on storage for all
  using (true)
  with check (true);
```

4. Ga naar **Project Settings → API**
5. Kopieer de **Project URL** en de **anon public** key

### 2. GitHub Secrets instellen

Ga in je GitHub repo naar **Settings → Secrets and variables → Actions** en voeg toe:

| Naam | Waarde |
|------|--------|
| `VITE_SUPABASE_URL` | jouw Project URL |
| `VITE_SUPABASE_ANON` | jouw anon public key |

### 3. GitHub Pages instellen

Ga naar **Settings → Pages** en zet:
- Source: **GitHub Actions**

### 4. Lokaal draaien

```bash
cp .env.example .env.local
# Vul je Supabase gegevens in .env.local

npm install
npm run dev
```

De app is dan bereikbaar op `http://localhost:5173/huishoudboekje/`

### 5. Deployen

Push naar `main` — GitHub Actions bouwt en deployt automatisch.

De app wordt beschikbaar op:
`https://alfendirk-ctrl.github.io/huishoudboekje/`
