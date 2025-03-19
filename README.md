# AI3 Download Manager

```bash
download-manager/
├─ prisma/
│  ├─ schema.prisma          # Database schema definition
│  ├─ migrations/            # Generated database migrations
│  └─ seed.js                # Database seeding script
├─ src/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ wallet/
│  │  │  │  ├─ route.ts      # Wallet authentication endpoint
│  │  │  │  └─ verify/
│  │  │  │     └─ route.ts   # JWT verification endpoint
│  │  │  └─ admin/
│  │  │     └─ users/
│  │  │        └─ route.ts   # Admin user management endpoint
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components/
│  │  ├─ Layout.tsx
│  │  └─ ClientProviders.tsx
│  ├─ config/
│  │  ├─ constants.ts
│  │  └─ index.ts
│  ├─ contexts/
│  │  └─ AuthContext.tsx     # Updated to use JWT
│  ├─ lib/
│  │  └─ prisma.ts           # Prisma client
│  ├─ types/
│  │  └─ auth.ts             # Auth types
│  └─ utils/
│     ├─ env.ts              # Environment utilities
│     └─ auth.ts             # JWT utilities
├─ .env
├─ .env.example
└─ next.config.js
```
