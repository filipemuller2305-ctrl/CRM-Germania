import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Usuários internos (consultores comerciais / gestores)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("consultor"), // consultor | gestor | admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Pessoa — entidade central do sistema (nunca "Lead")
// ---------------------------------------------------------------------------
export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  document: text("document"), // CPF/CNPJ
  origin: text("origin"), // Indicação, Site, Redes Sociais, Telefone, etc.
  ownerId: integer("owner_id").references(() => users.id),
  status: text("status").notNull().default("lead"), // lead | ativo | cliente | inativo
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Pipelines e Etapas (Kanban)
// ---------------------------------------------------------------------------
export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id")
    .notNull()
    .references(() => pipelines.id),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  kind: text("kind").notNull().default("open"), // open | won | lost
  color: text("color").notNull().default("#64748b"),
});

// ---------------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------------
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  product: text("product").notNull(),
  pipelineId: integer("pipeline_id")
    .notNull()
    .references(() => pipelines.id),
  stageId: integer("stage_id")
    .notNull()
    .references(() => pipelineStages.id),
  ownerId: integer("owner_id").references(() => users.id),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  probability: integer("probability").notNull().default(50),
  origin: text("origin"),
  status: text("status").notNull().default("aberta"), // aberta | ganha | perdida
  lostReason: text("lost_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastMovementAt: timestamp("last_movement_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

// ---------------------------------------------------------------------------
// Próximo Passo — toda oportunidade aberta deve ter um
// ---------------------------------------------------------------------------
export const nextSteps = pgTable("next_steps", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  description: text("description").notNull(),
  ownerId: integer("owner_id").references(() => users.id),
  dueDate: date("due_date").notNull(),
  dueTime: text("due_time"),
  objective: text("objective"),
  status: text("status").notNull().default("pendente"), // pendente | concluido | cancelado
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ---------------------------------------------------------------------------
// Atividades — ações realizadas pelo consultor
// ---------------------------------------------------------------------------
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  opportunityId: integer("opportunity_id").references(() => opportunities.id),
  type: text("type").notNull(), // ligacao | whatsapp | email | reuniao | visita | mensagem | anotacao
  description: text("description"),
  ownerId: integer("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  generatedNextStepId: integer("generated_next_step_id").references(
    () => nextSteps.id,
  ),
});

// ---------------------------------------------------------------------------
// Timeline — histórico imutável de eventos da Pessoa
// ---------------------------------------------------------------------------
export const timelineEvents = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  opportunityId: integer("opportunity_id").references(() => opportunities.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Catálogo de Produtos
// ---------------------------------------------------------------------------
export const productTypes = pgTable("product_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull().default("shield"),
});

// ---------------------------------------------------------------------------
// Produtos de uma Pessoa (apólices / seguros contratados)
// ---------------------------------------------------------------------------
export const personProducts = pgTable("person_products", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  productTypeId: integer("product_type_id")
    .notNull()
    .references(() => productTypes.id),
  policyNumber: text("policy_number"),
  insurer: text("insurer"),
  status: text("status").notNull().default("ativa"), // ativa | vencida | cancelada | em_cotacao
  startDate: date("start_date"),
  renewalDate: date("renewal_date"),
  premiumValue: numeric("premium_value", { precision: 12, scale: 2 }),
  erpPolicyId: text("erp_policy_id"),
  sourceErp: boolean("source_erp").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Cross Selling
// ---------------------------------------------------------------------------
export const crossSellSuggestions = pgTable("cross_sell_suggestions", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  productTypeId: integer("product_type_id")
    .notNull()
    .references(() => productTypes.id),
  reason: text("reason"),
  status: text("status").notNull().default("sugerida"), // sugerida | convertida | descartada
  opportunityId: integer("opportunity_id").references(() => opportunities.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Customer Success — inicia automaticamente após fechamento de oportunidade
// ---------------------------------------------------------------------------
export const customerSuccessStages = pgTable("customer_success_stages", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  stage: text("stage").notNull(), // boas_vindas | confirmacao_apolice | primeiro_contato | pesquisa_satisfacao | acompanhamento | renovacao_futura
  status: text("status").notNull().default("pendente"), // pendente | concluido | cancelado
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Documentos (metadados — sem upload binário)
// ---------------------------------------------------------------------------
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  name: text("name").notNull(),
  type: text("type"),
  url: text("url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Log de sincronização com o ERP (Agger) — stub de integração
// ---------------------------------------------------------------------------
export const erpSyncLog = pgTable("erp_sync_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(), // pessoa | apolice | proposta
  externalId: text("external_id"),
  personId: integer("person_id").references(() => people.id),
  status: text("status").notNull(), // sucesso | erro
  message: text("message"),
  payload: jsonb("payload"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});
