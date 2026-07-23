# SCG — Sistema Comercial Germânia
## Arquitetura: Domain Layer + Application Services

---

## Estrutura de Arquivos

```
scg/src/
├── domain/                          ← ❤️ Domínio puro (zero dependências externas)
│   ├── index.ts                     ← Barrel export
│   ├── types.ts                     ← Enums, constantes, tipos compartilhados
│   ├── entities/
│   │   ├── person.entity.ts         ← Pessoa (entidade central)
│   │   ├── lead.entity.ts           ← Entrada e qualificação
│   │   ├── opportunity.entity.ts    ← Oportunidade comercial
│   │   ├── next-step.entity.ts      ← Próximo Passo (INV-02)
│   │   ├── activity.entity.ts       ← Atividade do consultor
│   │   ├── person-product.entity.ts ← Produto/Seguro da pessoa
│   │   └── customer-success-stage.entity.ts ← Etapas pós-venda (INV-06)
│   ├── value-objects/
│   │   ├── cpf-cnpj.ts             ← Validação CPF/CNPJ (INV-01)
│   │   ├── phone.ts                ← Normalização de telefone
│   │   └── money.ts                ← Valores monetários (centavos)
│   ├── events/
│   │   └── index.ts                ← Todos os domain events (19 tipos)
│   └── services/
│       ├── cross-sell-engine.ts     ← Motor de sugestões (INV-08)
│       ├── renewal-detector.ts      ← Detecção de renovações (INV-09)
│       └── opportunity-invariants.ts← Validações cruzadas (INV-02,04,05)
│
├── application/                     ← Use Cases (orquestração)
│   ├── index.ts                     ← Barrel export
│   ├── ports.ts                     ← Interfaces de repositórios (contratos)
│   ├── use-cases-factory.ts         ← Factory para Server Actions
│   ├── person/
│   │   └── create-person.usecase.ts
│   ├── lead/
│   │   ├── create-lead.usecase.ts
│   │   └── convert-lead.usecase.ts
│   ├── opportunity/
│   │   ├── create-opportunity.usecase.ts
│   │   └── move-stage.usecase.ts
│   ├── activity/
│   │   └── register-activity.usecase.ts
│   └── next-step/
│       └── complete-next-step.usecase.ts
│
└── infrastructure/                  ← Adaptadores externos
    ├── bootstrap.ts                 ← Inicialização (chamar 1x no startup)
    ├── db/
    │   ├── index.ts                 ← Conexão Drizzle + Pool
    │   ├── schema.ts                ← Schema PostgreSQL completo (ENUMs, índices)
    │   ├── mappers.ts               ← Conversão DB rows ↔ Domain entities
    │   ├── transaction-manager.ts   ← Unidade de trabalho atômica
    │   └── repositories/
    │       ├── index.ts             ← Factory + barrel (getRepositories())
    │       ├── person.repository.ts
    │       ├── lead.repository.ts
    │       ├── opportunity.repository.ts
    │       ├── next-step.repository.ts
    │       ├── activity.repository.ts
    │       ├── person-product.repository.ts
    │       ├── customer-success.repository.ts
    │       ├── timeline.repository.ts   ← INSERT ONLY (INV-03)
    │       ├── cross-sell.repository.ts
    │       ├── pipeline.repository.ts
    │       └── user.repository.ts
    ├── events/
    │   ├── event-bus.ts             ← Barramento de eventos (singleton)
    │   └── handlers/
    │       ├── on-opportunity-won.ts    ← Cria CS stages (INV-06)
    │       ├── on-product-activated.ts  ← Cross sell (INV-08)
    │       └── register-handlers.ts     ← Bootstrap de handlers
    └── cron/
        ├── renewal-checker.ts       ← Cron diário de renovações (INV-09)
        └── overdue-detector.ts      ← Cron diário de atrasados
```

---

## Invariantes Implementadas

| INV | Regra | Onde |
|-----|-------|------|
| 01 | CPF/CNPJ único | `CpfCnpj` VO + `CreatePersonUseCase` |
| 02 | Oportunidade aberta exige NextStep | `ConvertLeadUseCase` + `CreateOpportunityUseCase` + `CompleteNextStepUseCase` |
| 03 | Timeline imutável | `TimelineRepository` (INSERT only) + REVOKE no DDL |
| 04 | Etapa pertence ao pipeline | `OpportunityInvariants.assertStageBelongsToPipeline` |
| 05 | Perdida exige motivo | `Opportunity.moveToStage()` + `MoveStageUseCase` |
| 06 | Ganha → CS automático | `OnOpportunityWonHandler` |
| 07 | Atividade gera NextStep | `RegisterActivityUseCase` (flag generateNextStep) |
| 08 | Produto → Cross Sell | `OnProductActivatedHandler` + `CrossSellEngine` |
| 09 | Renovação → Oportunidade | `RenewalCheckerCron` + `RenewalDetector` |
| 10 | Movimentação → Timeline | `MoveStageUseCase` + todos os use cases |

---

## Como Integrar ao Projeto Next.js

### 1. Copie as pastas para o projeto
```bash
cp -r scg/src/domain       germnia-commercial-system-specification/src/
cp -r scg/src/application  germnia-commercial-system-specification/src/
cp -r scg/src/infrastructure germnia-commercial-system-specification/src/
```

### 2. Crie os repositórios concretos (Drizzle)
Implemente as interfaces de `ports.ts` usando Drizzle ORM. Exemplo:

```typescript
// src/infrastructure/db/repositories/person.repository.ts
import { db } from "@/db";
import { people } from "@/db/schema";
import { Person } from "@/domain/entities/person.entity";
import type { PersonRepository } from "@/application/ports";

export class DrizzlePersonRepository implements PersonRepository {
  async findById(id: number) {
    const rows = await db.select().from(people).where(eq(people.id, id)).limit(1);
    return rows[0] ? Person.reconstitute(mapToDomain(rows[0])) : null;
  }
  // ... demais métodos
}
```

### 3. Registre os event handlers
```typescript
// src/infrastructure/bootstrap.ts
import { registerEventHandlers } from "./events/handlers/register-handlers";

registerEventHandlers({
  customerSuccessRepo: new DrizzleCustomerSuccessRepository(),
  personRepo: new DrizzlePersonRepository(),
  personProductRepo: new DrizzlePersonProductRepository(),
  crossSellRepo: new DrizzleCrossSellRepository(),
  timelineRepo: new DrizzleTimelineRepository(),
});
```

### 4. Crie Server Actions usando os Use Cases
```typescript
// src/app/actions/opportunities.ts
"use server";

import { MoveStageUseCase } from "@/application";
import { getRepositories } from "@/infrastructure/db/repositories";

export async function moveOpportunityStage(input: MoveStageInput) {
  const repos = getRepositories();
  const useCase = new MoveStageUseCase(
    repos.opportunity,
    repos.pipeline,
    repos.timeline
  );
  return useCase.execute(input, getCurrentUserId());
}
```

---

## Fluxo de Eventos (Automações)

```
MoveStage(kind=won)
  → OpportunityWonEvent
    → OnOpportunityWonHandler
      → Cria 6 CS Stages
      → Cliente continua sendo condição derivada de produto ativo
      → Timeline

ProductActivated
  → ProductActivatedEvent
    → OnProductActivatedHandler
      → CrossSellEngine.evaluate()
      → Cria suggestions
      → Timeline

Cron (diário 06:00)
  → RenewalCheckerCron.execute()
    → RenewalDetector.detect()
    → Cria Opportunity + NextStep
    → Timeline
    → RenewalApproachingEvent

Cron (diário 07:00)
  → OverdueDetectorCron.execute()
    → NextStepOverdueEvent × N
    → Dashboard destaca atrasados
```

---

## Próximos Passos para Completar o Sistema

1. **Repositórios Drizzle** — implementar `ports.ts` com queries reais
2. **Server Actions** — expor use cases como actions do Next.js
3. **Autenticação** — NextAuth v5 + middleware RBAC
4. **Kanban DnD** — integrar `@dnd-kit/core` + `moveOpportunityStage` action
5. **Dashboard** — consumir queries existentes + dados de overdue
6. **ERP Agger** — cliente HTTP em `infrastructure/erp/`
7. **Testes** — unit tests para entities + domain services (zero deps!)
