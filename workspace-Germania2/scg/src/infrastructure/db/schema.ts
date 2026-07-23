// ═══════════════════════════════════════════════════════════════════════════
// SCG — Database Schema (Drizzle ORM + PostgreSQL)
// Schema corrigido conforme análise arquitetural
// ═══════════════════════════════════════════════════════════════════════════

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  time,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const personStatusEnum = pgEnum("person_status", [
  "lead",
  "ativo",
  "cliente",
  "inativo",
]);

export const personTypeEnum = pgEnum("person_type", ["PF", "PJ"]);

export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "aberta",
  "ganha",
  "perdida",
]);

export const nextStepStatusEnum = pgEnum("next_step_status", [
  "pendente",
  "concluido",
  "cancelado",
  "expirado",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "ligacao",
  "whatsapp",
  "email",
  "reuniao",
  "visita",
  "mensagem",
  "anotacao",
]);

export const productStatusEnum = pgEnum("product_status", [
  "ativa",
  "vencida",
  "cancelada",
  "em_cotacao",
]);

export const crossSellStatusEnum = pgEnum("cross_sell_status", [
  "sugerida",
  "convertida",
  "descartada",
]);

export const csStageTypeEnum = pgEnum("cs_stage_type", [
  "boas_vindas",
  "confirmacao_apolice",
  "primeiro_contato",
  "pesquisa_satisfacao",
  "acompanhamento",
  "renovacao_futura",
]);

export const csStageStatusEnum = pgEnum("cs_stage_status", [
  "pendente",
  "concluido",
  "cancelado",
]);

export const userRoleEnum = pgEnum("user_role", [
  "consultor",
  "gestor",
  "admin",
]);

export const stageKindEnum = pgEnum("stage_kind", ["open", "won", "lost"]);

export const productSourceEnum = pgEnum("product_source", ["manual", "erp"]);

// ─── USERS ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("consultor"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── PEOPLE (entidade central) ───────────────────────────────────────────────

export const people = pgTable(
  "people",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: personTypeEnum("type").notNull().default("PF"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    document: text("document"), // CPF/CNPJ — apenas dígitos (INV-01: unique)
    origin: text("origin"),
    status: personStatusEnum("status").notNull().default("lead"),
    ownerId: integer("owner_id").references(() => users.id),
    notes: text("notes"),
    erpCustomerId: text("erp_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // INV-01: Documento único (permite múltiplos NULLs)
    uniqueIndex("idx_people_document_unique").on(table.document),
    index("idx_people_owner").on(table.ownerId),
    index("idx_people_status").on(table.status),
    index("idx_people_name").on(table.name),
  ]
);

// ─── PIPELINES & STAGES ──────────────────────────────────────────────────────

export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: serial("id").primaryKey(),
    pipelineId: integer("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    order: integer("order").notNull().default(0),
    kind: stageKindEnum("kind").notNull().default("open"),
    color: text("color").notNull().default("#64748b"),
  },
  (table) => [
    // Ordem única por pipeline
    uniqueIndex("idx_stage_pipeline_order").on(table.pipelineId, table.order),
  ]
);

// ─── PRODUCT TYPES ───────────────────────────────────────────────────────────

export const productTypes = pgTable("product_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull().default("shield"),
  crossSellRules: jsonb("cross_sell_rules").$type<number[]>().default([]),
});

// ─── PERSON PRODUCTS (apólices/seguros) ──────────────────────────────────────

export const personProducts = pgTable(
  "person_products",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    productTypeId: integer("product_type_id")
      .notNull()
      .references(() => productTypes.id),
    policyNumber: text("policy_number"),
    insurer: text("insurer"),
    status: productStatusEnum("status").notNull().default("ativa"),
    startDate: date("start_date"),
    renewalDate: date("renewal_date"),
    premiumValue: numeric("premium_value", { precision: 12, scale: 2 }),
    erpPolicyId: text("erp_policy_id"),
    source: productSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pp_person").on(table.personId),
    index("idx_pp_renewal").on(table.renewalDate),
    index("idx_pp_status").on(table.status),
  ]
);

// ─── OPPORTUNITIES ───────────────────────────────────────────────────────────

export const opportunities = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    productTypeId: integer("product_type_id") // CORRIGIDO: FK para product_types
      .notNull()
      .references(() => productTypes.id),
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
    status: opportunityStatusEnum("status").notNull().default("aberta"),
    lostReason: text("lost_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_opp_person").on(table.personId),
    index("idx_opp_status").on(table.status),
    index("idx_opp_stage").on(table.stageId),
    index("idx_opp_pipeline").on(table.pipelineId),
    index("idx_opp_owner").on(table.ownerId),
    index("idx_opp_last_movement").on(table.lastMovementAt),
  ]
);

// ─── NEXT STEPS ──────────────────────────────────────────────────────────────

export const nextSteps = pgTable(
  "next_steps",
  {
    id: serial("id").primaryKey(),
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    ownerId: integer("owner_id").references(() => users.id),
    description: text("description").notNull(),
    dueDate: date("due_date").notNull(),
    dueTime: time("due_time"),
    objective: text("objective"),
    status: nextStepStatusEnum("status").notNull().default("pendente"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ns_opportunity").on(table.opportunityId),
    index("idx_ns_pending_due").on(table.dueDate),
    index("idx_ns_owner").on(table.ownerId),
    index("idx_ns_status").on(table.status),
  ]
);

// ─── ACTIVITIES ──────────────────────────────────────────────────────────────

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    opportunityId: integer("opportunity_id").references(() => opportunities.id),
    ownerId: integer("owner_id").references(() => users.id),
    type: activityTypeEnum("type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_act_person").on(table.personId),
    index("idx_act_opportunity").on(table.opportunityId),
  ]
);

// ─── TIMELINE EVENTS (IMUTÁVEL — INV-03) ────────────────────────────────────

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    opportunityId: integer("opportunity_id").references(() => opportunities.id),
    actorId: integer("actor_id").references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_timeline_person_created").on(table.personId, table.createdAt),
    index("idx_timeline_opportunity").on(table.opportunityId),
  ]
);

// ─── CROSS SELL SUGGESTIONS ──────────────────────────────────────────────────

export const crossSellSuggestions = pgTable(
  "cross_sell_suggestions",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    productTypeId: integer("product_type_id")
      .notNull()
      .references(() => productTypes.id),
    reason: text("reason"),
    status: crossSellStatusEnum("status").notNull().default("sugerida"),
    opportunityId: integer("opportunity_id").references(() => opportunities.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cs_person").on(table.personId),
    index("idx_cs_status").on(table.status),
  ]
);

// ─── CUSTOMER SUCCESS STAGES ─────────────────────────────────────────────────

export const customerSuccessStages = pgTable(
  "customer_success_stages",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    ownerId: integer("owner_id").references(() => users.id), // ADICIONADO
    stage: csStageTypeEnum("stage").notNull(),
    status: csStageStatusEnum("status").notNull().default("pendente"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_css_person").on(table.personId),
    index("idx_css_opportunity").on(table.opportunityId),
    index("idx_css_status").on(table.status),
    index("idx_css_due").on(table.dueDate),
  ]
);

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  name: text("name").notNull(),
  mimeType: text("mime_type"),
  storageKey: text("storage_key"),
  sizeBytes: integer("size_bytes"),
  notes: text("notes"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── ERP SYNC LOG ────────────────────────────────────────────────────────────

export const erpSyncLog = pgTable("erp_sync_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  externalId: text("external_id"),
  personId: integer("person_id").references(() => people.id),
  direction: text("direction").notNull().default("inbound"),
  status: text("status").notNull(),
  message: text("message"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});
