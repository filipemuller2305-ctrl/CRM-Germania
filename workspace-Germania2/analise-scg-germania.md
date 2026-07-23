# ANÁLISE TÉCNICA E ARQUITETURAL — SISTEMA COMERCIAL GERMÂNIA (SCG)

**Papel:** Product Owner & Software Architect  
**Data:** 22/07/2026  
**Base de análise:** Especificação funcional fornecida + Repositório GitHub (CRM-Germania)

---

## 1. DIAGNÓSTICO DO PROJETO ENTREGUE

### 1.1 Stack Técnica Atual
| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5.9 |
| ORM | Drizzle ORM 0.45 + PostgreSQL |
| UI | Tailwind CSS 4 + Lucide Icons |
| Validação | Zod 4 |
| Estado | Server Components (sem state management client) |

### 1.2 Estrutura de Pastas Entregue
```
src/
├── app/
│   ├── api/          → Route Handlers (REST)
│   ├── cross-selling/
│   ├── customer-success/
│   ├── integracao-erp/
│   ├── oportunidades/
│   └── pessoas/
├── components/       → 5 componentes genéricos
├── db/
│   ├── index.ts      → Conexão Drizzle
│   └── schema.ts     → Schema completo (14 tabelas)
└── lib/
    ├── labels.ts     → Dicionário de labels PT-BR
    ├── queries.ts    → Funções de leitura (queries)
    └── utils.ts      → Helpers
```

### 1.3 Veredicto Geral
O projeto é um **protótipofuncional de leitura** (read-heavy). Ele implementa bem a camada de visualização e consultas, mas **não implementa a camada de domínio** — não existem services, regras de negócio, validações de invariantes, automações, nem mutations controladas. É essencialmente um CRUD com views bonitas.

---

## 2. INCONSISTÊNCIAS E LACUNAS IDENTIFICADAS

### 2.1 Inconsistências na Especificação vs. Implementação

| # | Especificação diz | Implementação faz | Gravidade |
|---|---|---|---|
| 1 | "Nunca poderão existir cadastros duplicados" | Não há unique constraint em `document` (CPF/CNPJ) nem lógica de dedup | 🔴 Alta |
| 2 | "O histórico nunca poderá ser apagado" | Tabela `timeline_events` não possui proteção (sem trigger, sem soft-delete policy) | 🔴 Alta |
| 3 | "Toda oportunidade aberta obrigatoriamente possui um Próximo Passo" | Não há validação em mutation — é possível criar oportunidade sem next_step | 🔴 Alta |
| 4 | "Caso a data expire o sistema deverá destacar" | Dashboard mostra atrasados, mas não há alerta ativo (notificação) | 🟡 Média |
| 5 | "Toda atividade poderá gerar um novo Próximo Passo" | Campo `generatedNextStepId` existe mas não há lógica de automação | 🟡 Média |
| 6 | "Após fechamento inicia automaticamente Customer Success" | Não há trigger/service que crie stages de CS ao fechar oportunidade | 🔴 Alta |
| 7 | "O sistema deverá identificar oportunidades de Cross Selling" | Tabela existe mas não há engine de sugestão automática | 🟡 Média |
| 8 | "Integração ERP via API (Agger)" | Apenas stub com `erp_sync_log` — nenhuma chamada real à API | 🟡 Média |
| 9 | "Drag and Drop no Kanban" | Não há biblioteca de DnD instalada (sem dnd-kit, react-beautiful-dnd) | 🟡 Média |
| 10 | "Workspace da Pessoa" com abas completas | Estrutura de rotas existe, mas sem implementação de mutations | 🟡 Média |

### 2.2 Lacunas Arquiteturais

| # | Lacuna | Impacto |
|---|---|---|
| 1 | **Sem camada de Domain/Services** — queries.ts mistura acesso a dados com lógica | Regras de negócio espalhadas, impossível testar isoladamente |
| 2 | **Sem mutations** — nenhuma API route de POST/PATCH/DELETE foi implementada | Sistema é read-only |
| 3 | **Sem autenticação/autorização** — `users` existe mas não há auth | Qualquer pessoa acessa tudo |
| 4 | **Sem validação de entrada** — Zod está instalado mas não é usado em nenhum handler | Dados inconsistentes podem entrar |
| 5 | **Sem event sourcing / domain events** — Timeline é manual | Histórico depende de código lembrar de gravar |
| 6 | **Filtragem em memória** — `getPeopleList` faz filter() em JS após SELECT * | Performance degrades com volume |
| 7 | **Sem paginação** em nenhuma query | Inviável em produção |
| 8 | **Sem transações** — operações multi-tabela sem `db.transaction()` | Risco de dados inconsistentes |
| 9 | **Sem tratamento de erros** — nenhuma try/catch nos handlers | 500 genérico em qualquer falha |
| 10 | **Sem testes** — zero arquivos de teste | Regressão invisível |

### 2.3 Problemas no Modelo de Dados

| # | Problema | Detalhe |
|---|---|---|
| 1 | `opportunities.product` é `text` livre | Deveria referenciar `product_types` — permite inconsistência |
| 2 | `nextSteps.personId` é redundante | Já é derivável via `opportunityId → opportunities.personId` |
| 3 | `activities.opportunityId` é nullable | Atividades sem oportunidade ficam "órfãs" — OK para anotações, mas deveria ser explícito |
| 4 | `documents.url` sem storage definido | Onde ficam os arquivos? S3? Disco? Não especificado |
| 5 | Sem índice em `people.document` | Busca por CPF/CNPJ será full scan |
| 6 | `pipelineStages.order` sem unique por pipeline | Duas etapas podem ter mesma ordem |
| 7 | Sem enum types no PostgreSQL | Status como text livre permite valores inválidos |
| 8 | `customerSuccessStages` não tem `ownerId` | Quem é responsável por cada etapa de CS? |

---

## 3. MODELO DE DOMÍNIO PROPOSTO (CORRIGIDO)

### 3.1 Bounded Contexts (DDD)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SCG — Domínio                                 │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  IDENTIDADE  │  COMERCIAL   │ RELACIONAMENTO│   INTEGRAÇÃO           │
│              │              │               │                        │
│ • Pessoa     │ • Pipeline   │ • Timeline    │ • ERP Sync (Agger)    │
│ • User       │ • Etapa      │ • Atividade   │ • Webhooks            │
│ • Auth       │ • Oportunidade│ • Próximo Passo│ • Import/Export      │
│              │ • Kanban     │ • Customer    │                        │
│              │ • Cross Sell │   Success     │                        │
│              │ • Produto    │ • Documento   │                        │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
```

### 3.2 Entidades e Relacionamentos (ER Corrigido)

```
┌──────────────┐       ┌──────────────────┐       ┌─────────────────┐
│    USER      │       │     PESSOA       │       │  PRODUCT_TYPE   │
├──────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)      │◄──┐   │ id (PK)          │   ┌──►│ id (PK)         │
│ name         │   │   │ name             │   │   │ name (UNIQUE)   │
│ email (UQ)   │   │   │ phone            │   │   │ icon            │
│ role (enum)  │   │   │ whatsapp         │   │   │ cross_sell_rules│
│ is_active    │   │   │ email            │   │   └─────────────────┘
│ created_at   │   │   │ document (UQ)*   │   │
└──────────────┘   │   │ type (PF/PJ)     │   │   ┌─────────────────┐
                   │   │ origin           │   │   │ PERSON_PRODUCT  │
                   │   │ status (enum)    │   │   ├─────────────────┤
                   ├───│ owner_id (FK)    │   ├───│ product_type_id │
                   │   │ notes            │   │   │ person_id (FK)  │
                   │   │ erp_customer_id  │   │   │ policy_number   │
                   │   │ created_at       │   │   │ insurer         │
                   │   │ updated_at       │   │   │ status (enum)   │
                   │   └──────────────────┘   │   │ start_date      │
                   │                          │   │ renewal_date    │
                   │   ┌──────────────────┐   │   │ premium_value   │
                   │   │  OPPORTUNITY     │   │   │ erp_policy_id   │
                   │   ├──────────────────┤   │   │ source (enum)   │
                   ├───│ owner_id (FK)    │   │   │ created_at      │
                   │   │ person_id (FK)   │   │   └─────────────────┘
                   │   │ product_type_id──┼───┘
                   │   │ pipeline_id (FK) │
                   │   │ stage_id (FK)    │       ┌─────────────────┐
                   │   │ estimated_value  │       │ CROSS_SELL_     │
                   │   │ probability      │       │ SUGGESTION      │
                   │   │ origin           │       ├─────────────────┤
                   │   │ status (enum)    │       │ person_id (FK)  │
                   │   │ lost_reason      │       │ product_type_id │
                   │   │ notes            │       │ reason          │
                   │   │ created_at       │       │ status (enum)   │
                   │   │ last_movement_at │       │ opportunity_id? │
                   │   │ closed_at        │       │ created_at      │
                   │   └──────────────────┘       └─────────────────┘
                   │
                   │   ┌──────────────────┐
                   │   │   NEXT_STEP      │
                   │   ├──────────────────┤
                   ├───│ owner_id (FK)    │
                   │   │ opportunity_id   │
                   │   │ description      │
                   │   │ due_date         │
                   │   │ due_time         │
                   │   │ objective        │
                   │   │ status (enum)    │
                   │   │ created_at       │
                   │   │ completed_at     │
                   │   └──────────────────┘
                   │
                   │   ┌──────────────────┐
                   │   │   ACTIVITY       │
                   │   ├──────────────────┤
                   ├───│ owner_id (FK)    │
                   │   │ person_id (FK)   │
                   │   │ opportunity_id?  │
                   │   │ type (enum)      │
                   │   │ description      │
                   │   │ created_at       │
                   │   └──────────────────┘
                   │
                   │   ┌──────────────────┐
                   │   │ TIMELINE_EVENT   │
                   │   ├──────────────────┤
                   │   │ person_id (FK)   │
                   │   │ opportunity_id?  │
                   │   │ actor_id (FK)    │
                   │   │ type (enum)      │
                   │   │ title            │
                   │   │ description      │
                   │   │ metadata (jsonb) │
                   │   │ created_at       │
                   │   │ ⚠️ IMMUTABLE     │
                   │   └──────────────────┘
                   │
                   │   ┌──────────────────┐
                   ├───│ CS_STAGE         │
                       ├──────────────────┤
                       │ person_id (FK)   │
                       │ opportunity_id   │
                       │ owner_id (FK)    │ ← ADICIONADO
                       │ stage (enum)     │
                       │ status (enum)    │
                       │ due_date         │
                       │ completed_at     │
                       │ notes            │
                       └──────────────────┘
```

### 3.3 Regras de Negócio Formalizadas (Invariantes)

```typescript
// ═══════════════════════════════════════════════════════════
// INVARIANTES DO DOMÍNIO — nunca podem ser violadas
// ═══════════════════════════════════════════════════════════

// INV-01: Unicidade de Pessoa
// Nenhuma Pessoa pode ter o mesmo CPF/CNPJ de outra.
// Se document é null, permitir duplicidade (lead sem doc).
UNIQUE(people.document) WHERE document IS NOT NULL

// INV-02: Oportunidade aberta exige Próximo Passo
// Ao criar ou reabrir uma oportunidade, um NextStep pendente
// deve existir em até 0ms (transação atômica).
ASSERT: opportunity.status = 'aberta' 
  → EXISTS(next_step WHERE opportunity_id = opp.id AND status = 'pendente')

// INV-03: Timeline é imutável
// Nenhum UPDATE ou DELETE em timeline_events.
// Implementar via trigger PostgreSQL ou regra a nível de ORM.
REVOKE UPDATE, DELETE ON timeline_events FROM app_role;

// INV-04: Uma oportunidade, uma etapa
// opportunity.stage_id sempre aponta para uma stage do MESMO pipeline.
ASSERT: opportunity.pipeline_id = stage.pipeline_id

// INV-05: Fechamento exige motivo (se perdida)
// Se status muda para 'perdida', lost_reason é obrigatório.
ASSERT: opportunity.status = 'perdida' → lost_reason IS NOT NULL

// INV-06: Fechamento Ganho dispara Customer Success
// Quando opportunity.status muda para 'ganha':
//   → Criar automaticamente 6 CS_Stages (boas_vindas → renovacao_futura)
//   → Gerar timeline_event do tipo 'closed_won'

// INV-07: Atividade pode gerar NextStep
// Ao registrar atividade, se usuário marcar "gerar próximo passo",
// criar NextStep vinculado à mesma oportunidade (transação).

// INV-08: Cross Selling automático
// Quando person_product é criado com status 'ativa':
//   → Verificar matriz de cross-sell (product_type.cross_sell_rules)
//   → Se pessoa NÃO possui o produto sugerido → criar suggestion

// INV-09: Renovação gera oportunidade
// Quando person_product.renewal_date está a ≤ 45 dias:
//   → Se não existe oportunidade aberta para aquele produto/pessoa
//   → Criar oportunidade de renovação automaticamente

// INV-10: Movimentação de etapa gera histórico
// Toda mudança em opportunity.stage_id:
//   → Atualizar last_movement_at
//   → Inserir timeline_event do tipo 'stage_change'
```

---

## 4. ARQUITETURA TÉCNICA PROPOSTA

### 4.1 Visão Geral (C4 — Nível Container)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUÁRIOS                                 │
│   Consultores Comerciais  │  Gestores  │  Admin                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS 16 (App Router)                        │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  UI Layer   │  │  API Routes  │  │  Server Actions (mutations)│ │
│  │  (RSC+CSR)  │  │  (REST/JSON) │  │  (form posts, DnD)       │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              APPLICATION LAYER (Services)                     │ │
│  │                                                               │ │
│  │  PersonService │ OpportunityService │ NextStepService        │ │
│  │  ActivityService │ TimelineService │ CrossSellEngine         │ │
│  │  CustomerSuccessService │ ErpSyncService │ DashboardService   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              DOMAIN LAYER (Entities + Rules)                  │ │
│  │                                                               │ │
│  │  Entities │ Value Objects │ Domain Events │ Invariants        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              INFRASTRUCTURE LAYER                             │ │
│  │                                                               │ │
│  │  Drizzle Repos │ ERP Client (Agger API) │ Event Bus │ Cron   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
     │ PostgreSQL 16│ │  Agger   │ │  Object Storage  │
     │ (Neon/RDS)   │ │  ERP API │ │  (S3/R2 - docs)  │
     └──────────────┘ └──────────┘ └──────────────────┘
```

### 4.2 Estrutura de Pastas Proposta (Clean Architecture adaptada)

```
src/
├── app/                          # Next.js App Router (UI + API)
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── page.tsx              # Dashboard principal
│   │   ├── pessoas/
│   │   │   ├── page.tsx          # Lista
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Workspace da Pessoa
│   │   │       ├── timeline/
│   │   │       ├── oportunidades/
│   │   │       ├── produtos/
│   │   │       └── documentos/
│   │   ├── oportunidades/
│   │   │   ├── page.tsx          # Kanban
│   │   │   └── [id]/page.tsx
│   │   ├── cross-selling/
│   │   ├── customer-success/
│   │   └── integracao-erp/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── people/
│   │   ├── opportunities/
│   │   ├── next-steps/
│   │   ├── activities/
│   │   ├── webhooks/erp/        # Webhook da Agger
│   │   └── cron/                # Jobs agendados
│   └── layout.tsx
│
├── domain/                       # ❤️ Camada de Domínio (zero deps externas)
│   ├── entities/
│   │   ├── person.ts
│   │   ├── opportunity.ts
│   │   ├── next-step.ts
│   │   ├── activity.ts
│   │   ├── person-product.ts
│   │   ├── cross-sell-suggestion.ts
│   │   ├── customer-success-stage.ts
│   │   └── timeline-event.ts
│   ├── value-objects/
│   │   ├── cpf-cnpj.ts          # Validação + formatação
│   │   ├── phone.ts
│   │   ├── money.ts
│   │   └── date-range.ts
│   ├── events/
│   │   ├── opportunity-won.event.ts
│   │   ├── opportunity-lost.event.ts
│   │   ├── stage-changed.event.ts
│   │   ├── next-step-overdue.event.ts
│   │   ├── renewal-approaching.event.ts
│   │   └── cross-sell-detected.event.ts
│   ├── services/                 # Domain Services (regras puras)
│   │   ├── cross-sell-engine.ts
│   │   ├── renewal-detector.ts
│   │   └── opportunity-invariants.ts
│   └── types.ts                  # Enums, unions, interfaces
│
├── application/                  # Use Cases / Application Services
│   ├── person/
│   │   ├── create-person.usecase.ts
│   │   ├── update-person.usecase.ts
│   │   ├── merge-duplicates.usecase.ts
│   │   └── person.schema.ts      # Zod schemas
│   ├── opportunity/
│   │   ├── create-opportunity.usecase.ts
│   │   ├── move-stage.usecase.ts
│   │   ├── close-opportunity.usecase.ts
│   │   └── opportunity.schema.ts
│   ├── next-step/
│   │   ├── create-next-step.usecase.ts
│   │   ├── complete-next-step.usecase.ts
│   │   └── next-step.schema.ts
│   ├── activity/
│   │   ├── register-activity.usecase.ts
│   │   └── activity.schema.ts
│   ├── customer-success/
│   │   ├── initialize-cs.usecase.ts
│   │   └── complete-cs-stage.usecase.ts
│   ├── cross-sell/
│   │   ├── detect-cross-sell.usecase.ts
│   │   └── convert-suggestion.usecase.ts
│   ├── erp-sync/
│   │   ├── sync-clients.usecase.ts
│   │   ├── sync-policies.usecase.ts
│   │   └── agger-client.ts       # HTTP client para Agger API
│   └── dashboard/
│       └── get-dashboard.usecase.ts
│
├── infrastructure/               # Adaptadores externos
│   ├── db/
│   │   ├── index.ts              # Drizzle connection
│   │   ├── schema.ts             # Table definitions
│   │   ├── migrations/           # SQL migrations
│   │   └── repositories/
│   │       ├── person.repository.ts
│   │       ├── opportunity.repository.ts
│   │       ├── next-step.repository.ts
│   │       ├── activity.repository.ts
│   │       ├── timeline.repository.ts
│   │       └── person-product.repository.ts
│   ├── events/
│   │   ├── event-bus.ts          # In-process event emitter
│   │   └── handlers/
│   │       ├── on-opportunity-won.ts    # → cria CS stages
│   │       ├── on-stage-changed.ts      # → timeline event
│   │       └── on-renewal-approaching.ts # → cria oportunidade
│   ├── erp/
│   │   ├── agger-api.ts          # Cliente HTTP real
│   │   └── agger-mapper.ts       # Transforma DTO Agger → Domain
│   ├── storage/
│   │   └── document-storage.ts   # S3 / R2 / local
│   ├── cron/
│   │   ├── renewal-checker.ts    # Roda diariamente
│   │   ├── overdue-detector.ts   # Roda diariamente
│   │   └── cross-sell-scan.ts    # Roda semanalmente
│   └── auth/
│       ├── auth.config.ts        # NextAuth / Better Auth
│       └── middleware.ts
│
├── components/                   # UI Components
│   ├── ui/                       # Design system (Button, Badge, Modal...)
│   ├── kanban/                   # DnD Kanban board
│   ├── timeline/                 # Timeline visual
│   ├── person/                   # Person workspace tabs
│   ├── dashboard/                # Dashboard widgets
│   └── layout/                   # Sidebar, Header, Shell
│
└── lib/
    ├── utils.ts
    └── constants.ts
```

### 4.3 Decisões Arquiteturais (ADRs)

#### ADR-001: Domain Events para Automações
**Contexto:** A spec exige que ações disparem consequências automáticas (fechamento → CS, atividade → next step, produto → cross sell).  
**Decisão:** Usar um Event Bus em processo (EventEmitter tipado). Cada mutation emite eventos; handlers reagem.  
**Alternativa rejeitada:** Triggers no PostgreSQL — dificulta testes e debug.

#### ADR-002: Timeline via Event Sourcing Parcial
**Contexto:** "O histórico nunca poderá ser apagado."  
**Decisão:** Timeline events são escritos exclusivamente por handlers de domain events. A tabela tem permissão `INSERT ONLY` no PostgreSQL (REVOKE UPDATE, DELETE).  
**Consequência:** Garante imutabilidade em nível de banco.

#### ADR-003: Server Actions para Mutations
**Contexto:** Next.js 16 suporta Server Actions maduramente.  
**Decisão:** Mutations via Server Actions (formulários) + API Routes para integrações externas (webhooks, ERP).  
**Benefício:** Menos boilerplate, type-safety end-to-end com Zod.

#### ADR-004: PostgreSQL ENUMs + Check Constraints
**Contexto:** Status como text livre permite valores inválidos.  
**Decisão:** Criar tipos ENUM no PostgreSQL para todos os status. Adicionar CHECK constraints para invariantes.  
**Benefício:** Integridade garantida mesmo se aplicação falhar.

#### ADR-005: Autenticação com NextAuth v5 (Auth.js)
**Contexto:** Sistema multi-usuário com roles (consultor, gestor, admin).  
**Decisão:** NextAuth v5 com provider de credenciais. Sessão JWT. Middleware para proteção de rotas.  
**RBAC:** Consultor vê apenas suas pessoas/oportunidades. Gestor vê tudo. Admin gerencia configuração.

#### ADR-006: Paginação Cursor-based
**Contexto:** Listas podem crescer (pessoas, timeline, atividades).  
**Decisão:** Paginação por cursor (último ID) em todas as listas. UI com infinite scroll.

#### ADR-007: Integração ERP via Webhook + Polling
**Contexto:** Agger pode ou não ter webhooks.  
**Decisão:** Implementar ambos: endpoint `/api/webhooks/erp` para push + cron job de polling a cada 30min como fallback. Dados do ERP são read-only no SCG (source of truth operacional é o ERP).

---

## 5. FLUXOS CRÍTICOS (SEQUÊNCIA)

### 5.1 Fluxo: Criar Oportunidade (com invariante de NextStep)

```
Consultor → UI (Form) → Server Action
  → OpportunityService.create(dto)
    → BEGIN TRANSACTION
      → INSERT opportunity (status='aberta')
      → INSERT next_step (status='pendente', due_date=...)  // OBRIGATÓRIO
      → INSERT timeline_event (type='opportunity_created')
    → COMMIT
    → EMIT OpportunityCreated event
      → Handler: notificar gestor (se valor > threshold)
```

### 5.2 Fluxo: Mover Etapa (Kanban Drag & Drop)

```
Consultor → DnD drop → Server Action moveStage(oppId, newStageId)
  → OpportunityService.moveStage(oppId, newStageId)
    → VALIDATE: stage pertence ao mesmo pipeline
    → BEGIN TRANSACTION
      → UPDATE opportunity SET stage_id, last_movement_at=now()
      → INSERT timeline_event (type='stage_change', metadata={from, to})
    → COMMIT
    → EMIT StageChanged event
      → Handler: se newStage.kind='won' → trigger fechamento
      → Handler: se newStage.kind='lost' → exigir motivo
```

### 5.3 Fluxo: Fechar como Ganha → Customer Success Automático

```
StageChanged event (kind='won')
  → Handler: OnOpportunityWon
    → BEGIN TRANSACTION
      → UPDATE opportunity SET status='ganha', closed_at=now()
      → INSERT customer_success_stage × 6 (com due_dates escalonados)
      → UPDATE person SET status='cliente' (se primeiro produto)
      → INSERT timeline_event (type='closed_won')
    → COMMIT
    → EMIT CustomerSuccessInitialized event
```

### 5.4 Fluxo: Detecção de Cross Selling

```
PersonProduct criado (status='ativa', type='auto')
  → EMIT ProductActivated event
    → Handler: CrossSellEngine.evaluate(personId)
      → SELECT product_types que a pessoa NÃO possui
      → Aplicar regras: Auto → sugere Residencial + Vida
      → INSERT cross_sell_suggestion (status='sugerida')
      → INSERT timeline_event (type='cross_sell')
```

### 5.5 Fluxo: Renovação Automática

```
CRON (diário 06:00)
  → RenewalDetector.check()
    → SELECT person_products WHERE renewal_date BETWEEN today AND today+45d
      AND status='ativa'
      AND NOT EXISTS (oportunidade aberta para mesmo produto/pessoa)
    → Para cada:
      → CREATE opportunity (product=renovação, origin='renovação_automatica')
      → CREATE next_step (due_date=renewal_date - 30d)
      → INSERT timeline_event (type='renewal')
```

---

## 6. MODELO DE DADOS CORRIGIDO (DDL Conceitual)

```sql
-- ═══ ENUMS ═══
CREATE TYPE person_status AS ENUM ('lead', 'ativo', 'cliente', 'inativo');
CREATE TYPE person_type AS ENUM ('PF', 'PJ');
CREATE TYPE opportunity_status AS ENUM ('aberta', 'ganha', 'perdida');
CREATE TYPE next_step_status AS ENUM ('pendente', 'concluido', 'cancelado', 'expirado');
CREATE TYPE activity_type AS ENUM ('ligacao','whatsapp','email','reuniao','visita','mensagem','anotacao');
CREATE TYPE product_status AS ENUM ('ativa','vencida','cancelada','em_cotacao');
CREATE TYPE cross_sell_status AS ENUM ('sugerida','convertida','descartada');
CREATE TYPE cs_stage_type AS ENUM ('boas_vindas','confirmacao_apolice','primeiro_contato','pesquisa_satisfacao','acompanhamento','renovacao_futura');
CREATE TYPE cs_stage_status AS ENUM ('pendente','concluido','cancelado');
CREATE TYPE user_role AS ENUM ('consultor','gestor','admin');

-- ═══ CORE ═══
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role user_role NOT NULL DEFAULT 'consultor',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type person_type NOT NULL DEFAULT 'PF',
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  document TEXT UNIQUE,           -- INV-01: CPF/CNPJ único
  origin TEXT,
  status person_status NOT NULL DEFAULT 'lead',
  owner_id INT REFERENCES users(id),
  notes TEXT,
  erp_customer_id TEXT,           -- ID no Agger
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_document ON people(document);
CREATE INDEX idx_people_owner ON people(owner_id);
CREATE INDEX idx_people_status ON people(status);

-- ═══ PIPELINE ═══
CREATE TABLE pipelines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pipeline_stages (
  id SERIAL PRIMARY KEY,
  pipeline_id INT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'open' CHECK (kind IN ('open','won','lost')),
  color TEXT NOT NULL DEFAULT '#64748b',
  UNIQUE(pipeline_id, "order")   -- INV: ordem única por pipeline
);

-- ═══ PRODUTOS ═══
CREATE TABLE product_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'shield',
  cross_sell_rules JSONB DEFAULT '[]'  -- IDs de produtos sugeridos
);

CREATE TABLE person_products (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  product_type_id INT NOT NULL REFERENCES product_types(id),
  policy_number TEXT,
  insurer TEXT,
  status product_status NOT NULL DEFAULT 'ativa',
  start_date DATE,
  renewal_date DATE,
  premium_value NUMERIC(12,2),
  erp_policy_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','erp')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_person_products_renewal ON person_products(renewal_date) WHERE status = 'ativa';

-- ═══ OPORTUNIDADES ═══
CREATE TABLE opportunities (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  product_type_id INT NOT NULL REFERENCES product_types(id),  -- CORRIGIDO: FK
  pipeline_id INT NOT NULL REFERENCES pipelines(id),
  stage_id INT NOT NULL REFERENCES pipeline_stages(id),
  owner_id INT REFERENCES users(id),
  estimated_value NUMERIC(12,2),
  probability INT NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  origin TEXT,
  status opportunity_status NOT NULL DEFAULT 'aberta',
  lost_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_movement_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  -- INV-04: stage deve pertencer ao pipeline
  CONSTRAINT chk_stage_pipeline CHECK (true)  -- validado via trigger
);
CREATE INDEX idx_opp_status ON opportunities(status);
CREATE INDEX idx_opp_person ON opportunities(person_id);
CREATE INDEX idx_opp_stage ON opportunities(stage_id);

-- ═══ PRÓXIMO PASSO ═══
CREATE TABLE next_steps (
  id SERIAL PRIMARY KEY,
  opportunity_id INT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  owner_id INT REFERENCES users(id),
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  due_time TIME,
  objective TEXT,
  status next_step_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_next_steps_due ON next_steps(due_date) WHERE status = 'pendente';

-- ═══ ATIVIDADES ═══
CREATE TABLE activities (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  opportunity_id INT REFERENCES opportunities(id),
  owner_id INT REFERENCES users(id),
  type activity_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ TIMELINE (IMUTÁVEL) ═══
CREATE TABLE timeline_events (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  opportunity_id INT REFERENCES opportunities(id),
  actor_id INT REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- INV-03: Imutabilidade
REVOKE UPDATE, DELETE ON timeline_events FROM PUBLIC;
CREATE INDEX idx_timeline_person ON timeline_events(person_id, created_at DESC);

-- ═══ CROSS SELLING ═══
CREATE TABLE cross_sell_suggestions (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  product_type_id INT NOT NULL REFERENCES product_types(id),
  reason TEXT,
  status cross_sell_status NOT NULL DEFAULT 'sugerida',
  opportunity_id INT REFERENCES opportunities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ CUSTOMER SUCCESS ═══
CREATE TABLE customer_success_stages (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  opportunity_id INT NOT NULL REFERENCES opportunities(id),
  owner_id INT REFERENCES users(id),          -- ADICIONADO
  stage cs_stage_type NOT NULL,
  status cs_stage_status NOT NULL DEFAULT 'pendente',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ DOCUMENTOS ═══
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  name TEXT NOT NULL,
  mime_type TEXT,
  storage_key TEXT,          -- Chave no S3/R2
  size_bytes INT,
  notes TEXT,
  uploaded_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ ERP SYNC LOG ═══
CREATE TABLE erp_sync_log (
  id SERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  external_id TEXT,
  person_id INT REFERENCES people(id),
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  status TEXT NOT NULL CHECK (status IN ('sucesso','erro','parcial')),
  message TEXT,
  payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7. PLANO DE ENTREGA (ROADMAP)

### Fase 1 — Fundação (Semanas 1-3)
- [ ] Setup de autenticação (NextAuth v5)
- [ ] RBAC (middleware por role)
- [ ] Migração do schema corrigido (Drizzle Kit)
- [ ] Domain layer (entities, value objects, enums)
- [ ] Repositories com paginação
- [ ] CRUD completo de Pessoas (com dedup por CPF/CNPJ)
- [ ] Workspace da Pessoa (abas funcionais)

### Fase 2 — Motor Comercial (Semanas 4-6)
- [ ] Kanban com Drag & Drop (dnd-kit)
- [ ] Mutations de Oportunidade (criar, mover, fechar)
- [ ] Invariante de NextStep obrigatório
- [ ] Registro de Atividades + geração de NextStep
- [ ] Timeline automática via Domain Events
- [ ] Dashboard com dados reais (server-side)

### Fase 3 — Automações (Semanas 7-9)
- [ ] Customer Success automático (ao fechar ganha)
- [ ] Engine de Cross Selling
- [ ] Cron de Renovações (45 dias)
- [ ] Cron de NextSteps expirados (destaque no dashboard)
- [ ] Notificações in-app (sino)

### Fase 4 — Integração ERP (Semanas 10-12)
- [ ] Cliente HTTP para Agger API
- [ ] Sync de Clientes (inbound)
- [ ] Sync de Apólices (inbound)
- [ ] Webhook receiver
- [ ] Tela de monitor de sincronização
- [ ] Resolução de conflitos (ERP tem prioridade operacional)

### Fase 5 — Polish & Produção (Semanas 13-14)
- [ ] Testes (unit + integration)
- [ ] Error boundaries + logging (Sentry)
- [ ] Performance (índices, cache, paginação)
- [ ] Deploy (Vercel + Neon/RDS)
- [ ] Documentação de uso

---

## 8. RECOMENDAÇÕES FINAIS AO PRODUCT OWNER

### O que manter do projeto atual:
✅ Stack técnica (Next.js + Drizzle + Tailwind) — adequada ao escopo  
✅ Modelo de dados base — 80% correto, precisa de ajustes  
✅ Estrutura de rotas/páginas — boa organização  
✅ Labels e enums em PT-BR — boa UX  

### O que refatorar urgentemente:
🔴 Adicionar camada de Domain + Application Services  
🔴 Implementar mutations (hoje é read-only)  
🔴 Adicionar autenticação  
🔴 Implementar Domain Events para automações  
🔴 Corrigir `opportunities.product` para FK em `product_types`  
🔴 Adicionar unique constraint em `people.document`  
🔴 Proteger `timeline_events` contra UPDATE/DELETE  

### O que NÃO fazer:
❌ Não transformar em microserviços — monolito Next.js é suficiente  
❌ Não implementar upload de documentos na Fase 1 — usar link externo  
❌ Não criar app mobile — PWA responsive resolve  
❌ Não construir engine de IA para cross-sell — regras simples bastam no MVP  

---

*Documento elaborado como análise técnico-funcional independente. O projeto entregue é um bom ponto de partida visual e de modelagem, mas requer a implementação completa da camada de domínio e das automações para atender à especificação funcional.*
