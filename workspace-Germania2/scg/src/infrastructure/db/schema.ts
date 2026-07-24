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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const personStatusEnum = pgEnum("person_status", [
  "ativa",
  "inativa",
]);

export const personTypeEnum = pgEnum("person_type", ["PF", "PJ"]);

export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "aberta",
  "ganha",
  "perdida",
  "cancelada",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "novo",
  "em_qualificacao",
  "convertido",
  "descartado",
  "arquivado",
]);

export const contactSourceEnum = pgEnum("contact_source", [
  "google",
  "instagram",
  "facebook",
  "indicacao",
  "base_clientes",
  "evento",
  "prospeccao_ativa",
  "outro",
]);

export const entryChannelEnum = pgEnum("entry_channel", [
  "whatsapp",
  "formulario_site",
  "telefone",
  "email",
  "direct_instagram",
  "presencial",
  "importacao",
  "outro",
]);

export const leadDiscardReasonEnum = pgEnum("lead_discard_reason", [
  "sem_interesse",
  "fora_do_perfil",
  "contato_invalido",
  "duplicado",
  "nao_respondeu",
  "outro",
]);

export const opportunityTypeEnum = pgEnum("opportunity_type", [
  "novo_negocio",
  "renovacao",
  "recuperacao",
  "cross_sell",
  "demanda_direta",
]);

export const opportunityCloseOutcomeEnum = pgEnum(
  "opportunity_close_outcome",
  [
    "renovou_outra_corretora",
    "renovou_direto_banco_seguradora",
    "contratou_protecao_veicular",
    "nao_renovou_seguro",
    "nao_foi_possivel_concluir",
    "cancelamento_erro_duplicidade",
  ]
);

export const opportunityLossReasonEnum = pgEnum("opportunity_loss_reason", [
  "preco",
  "cobertura",
  "condicao_pagamento",
  "relacionamento_outra_empresa",
  "nao_respondeu",
  "desistiu",
  "vendeu_ou_nao_possui_bem",
  "risco_recusado",
  "documentacao_incompleta",
  "outro",
]);

export const scheduledCommercialReturnStatusEnum = pgEnum(
  "scheduled_commercial_return_status",
  ["pendente", "processado", "cancelado"]
);

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
    status: personStatusEnum("status").notNull().default("ativa"),
    relationshipOwnerId: integer("relationship_owner_id").references(
      () => users.id
    ),
    notes: text("notes"),
    erpCustomerId: text("erp_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // INV-01: Documento único (permite múltiplos NULLs)
    uniqueIndex("idx_people_document_unique").on(table.document),
    index("idx_people_relationship_owner").on(table.relationshipOwnerId),
    index("idx_people_status").on(table.status),
    index("idx_people_name").on(table.name),
  ]
);

// ─── LEADS ──────────────────────────────────────────────────────────────────

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    productTypeId: integer("product_type_id").references(() => productTypes.id),
    source: contactSourceEnum("source").notNull(),
    channel: entryChannelEnum("channel").notNull(),
    campaign: text("campaign"),
    referredByPersonId: integer("referred_by_person_id").references(
      () => people.id
    ),
    sourceDetail: text("source_detail"),
    capturedById: integer("captured_by_id")
      .notNull()
      .references(() => users.id),
    ownerId: integer("owner_id").references(() => users.id),
    status: leadStatusEnum("status").notNull().default("novo"),
    // A relação inversa é protegida por UNIQUE(opportunities.lead_id).
    // Mantemos o ID aqui para leitura rápida e auditoria da conversão.
    opportunityId: integer("opportunity_id"),
    discardReason: leadDiscardReasonEnum("discard_reason"),
    discardNotes: text("discard_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    qualificationStartedAt: timestamp("qualification_started_at", {
      withTimezone: true,
    }),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_leads_person").on(table.personId),
    index("idx_leads_owner_status").on(table.ownerId, table.status),
    index("idx_leads_source_channel").on(table.source, table.channel),
    uniqueIndex("idx_leads_opportunity_unique").on(table.opportunityId),
    check(
      "leads_no_self_referral",
      sql`${table.referredByPersonId} IS NULL OR ${table.referredByPersonId} <> ${table.personId}`
    ),
    check(
      "leads_indication_identified",
      sql`${table.source} <> 'indicacao' OR ${table.referredByPersonId} IS NOT NULL OR nullif(btrim(${table.sourceDetail}), '') IS NOT NULL`
    ),
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
    leadId: integer("lead_id").references(() => leads.id),
    personProductId: integer("person_product_id").references(
      () => personProducts.id
    ),
    crossSellSuggestionId: integer("cross_sell_suggestion_id"),
    productTypeId: integer("product_type_id") // CORRIGIDO: FK para product_types
      .notNull()
      .references(() => productTypes.id),
    pipelineId: integer("pipeline_id")
      .notNull()
      .references(() => pipelines.id),
    stageId: integer("stage_id")
      .notNull()
      .references(() => pipelineStages.id),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id),
    createdById: integer("created_by_id").references(() => users.id),
    type: opportunityTypeEnum("type").notNull(),
    estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
    probability: integer("probability").notNull().default(50),
    source: contactSourceEnum("source").notNull(),
    channel: entryChannelEnum("channel").notNull(),
    campaign: text("campaign"),
    referredByPersonId: integer("referred_by_person_id").references(
      () => people.id
    ),
    sourceDetail: text("source_detail"),
    renewalKey: text("renewal_key"),
    recoveryKey: text("recovery_key"),
    status: opportunityStatusEnum("status").notNull().default("aberta"),
    closeOutcome: opportunityCloseOutcomeEnum("close_outcome"),
    lossReason: opportunityLossReasonEnum("loss_reason"),
    closeNotes: text("close_notes"),
    nextExpirationDate: date("next_expiration_date"),
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
    uniqueIndex("idx_opp_lead_unique").on(table.leadId),
    uniqueIndex("idx_opp_renewal_key_unique").on(table.renewalKey),
    uniqueIndex("idx_opp_recovery_key_unique").on(table.recoveryKey),
    uniqueIndex("idx_opp_cross_sell_unique").on(table.crossSellSuggestionId),
    check(
      "opportunities_origin_consistency",
      sql`(${table.leadId} IS NULL OR ${table.type} = 'novo_negocio')
        AND (${table.type} <> 'renovacao' OR (${table.personProductId} IS NOT NULL AND ${table.renewalKey} IS NOT NULL))
        AND (${table.type} = 'renovacao' OR (${table.personProductId} IS NULL AND ${table.renewalKey} IS NULL))
        AND (${table.type} <> 'recuperacao' OR ${table.recoveryKey} IS NOT NULL)
        AND (${table.type} = 'recuperacao' OR ${table.recoveryKey} IS NULL)`
    ),
    check(
      "opportunities_no_self_referral",
      sql`${table.referredByPersonId} IS NULL OR ${table.referredByPersonId} <> ${table.personId}`
    ),
    check(
      "opportunities_close_details_consistency",
      sql`(
          ${table.status} = 'perdida'
          AND ${table.closeOutcome} IS NOT NULL
          AND ${table.lossReason} IS NOT NULL
          AND nullif(btrim(${table.closeNotes}), '') IS NOT NULL
        ) OR (
          ${table.status} = 'cancelada'
          AND ${table.closeOutcome} = 'cancelamento_erro_duplicidade'
          AND ${table.lossReason} IS NULL
          AND nullif(btrim(${table.closeNotes}), '') IS NOT NULL
        ) OR ${table.status} IN ('aberta', 'ganha')`
    ),
    check(
      "opportunities_external_expiration_required",
      sql`${table.closeOutcome} NOT IN (
          'renovou_outra_corretora',
          'renovou_direto_banco_seguradora',
          'contratou_protecao_veicular'
        ) OR ${table.nextExpirationDate} IS NOT NULL`
    ),
  ]
);

// ─── SCHEDULED COMMERCIAL RETURNS ───────────────────────────────────────────

export const scheduledCommercialReturns = pgTable(
  "scheduled_commercial_returns",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    sourceOpportunityId: integer("source_opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    createdOpportunityId: integer("created_opportunity_id").references(
      () => opportunities.id
    ),
    productTypeId: integer("product_type_id")
      .notNull()
      .references(() => productTypes.id),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id),
    closeOutcome: opportunityCloseOutcomeEnum("close_outcome").notNull(),
    nextExpirationDate: date("next_expiration_date").notNull(),
    scheduledFor: date("scheduled_for").notNull(),
    notes: text("notes").notNull(),
    status: scheduledCommercialReturnStatusEnum("status")
      .notNull()
      .default("pendente"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_commercial_return_source_unique").on(
      table.sourceOpportunityId
    ),
    uniqueIndex("idx_commercial_return_created_opportunity_unique").on(
      table.createdOpportunityId
    ),
    index("idx_commercial_return_due").on(table.status, table.scheduledFor),
    index("idx_commercial_return_person").on(table.personId),
    check(
      "scheduled_return_external_outcome",
      sql`${table.closeOutcome} IN (
        'renovou_outra_corretora',
        'renovou_direto_banco_seguradora',
        'contratou_protecao_veicular'
      )`
    ),
    check(
      "scheduled_return_45_days_before",
      sql`${table.scheduledFor} = ${table.nextExpirationDate} - 45`
    ),
    check(
      "scheduled_return_notes_required",
      sql`nullif(btrim(${table.notes}), '') IS NOT NULL`
    ),
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
    leadId: integer("lead_id").references(() => leads.id),
    opportunityId: integer("opportunity_id").references(() => opportunities.id),
    ownerId: integer("owner_id").references(() => users.id),
    type: activityTypeEnum("type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_act_person").on(table.personId),
    index("idx_act_lead").on(table.leadId),
    index("idx_act_opportunity").on(table.opportunityId),
    check(
      "activities_single_process",
      sql`NOT (${table.leadId} IS NOT NULL AND ${table.opportunityId} IS NOT NULL)`
    ),
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
    leadId: integer("lead_id").references(() => leads.id),
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
    index("idx_timeline_lead").on(table.leadId),
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
