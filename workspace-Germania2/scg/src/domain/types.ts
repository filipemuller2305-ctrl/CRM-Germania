// ═══════════════════════════════════════════════════════════════════════════
// SCG — SISTEMA COMERCIAL GERMÂNIA
// Domain Layer: Types, Enums & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const PersonStatus = {
  LEAD: "lead",
  ATIVO: "ativo",
  CLIENTE: "cliente",
  INATIVO: "inativo",
} as const;
export type PersonStatus = (typeof PersonStatus)[keyof typeof PersonStatus];

export const PersonType = {
  PF: "PF",
  PJ: "PJ",
} as const;
export type PersonType = (typeof PersonType)[keyof typeof PersonType];

export const OpportunityStatus = {
  ABERTA: "aberta",
  GANHA: "ganha",
  PERDIDA: "perdida",
} as const;
export type OpportunityStatus =
  (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const NextStepStatus = {
  PENDENTE: "pendente",
  CONCLUIDO: "concluido",
  CANCELADO: "cancelado",
  EXPIRADO: "expirado",
} as const;
export type NextStepStatus =
  (typeof NextStepStatus)[keyof typeof NextStepStatus];

export const ActivityType = {
  LIGACAO: "ligacao",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  REUNIAO: "reuniao",
  VISITA: "visita",
  MENSAGEM: "mensagem",
  ANOTACAO: "anotacao",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const ProductStatus = {
  ATIVA: "ativa",
  VENCIDA: "vencida",
  CANCELADA: "cancelada",
  EM_COTACAO: "em_cotacao",
} as const;
export type ProductStatus =
  (typeof ProductStatus)[keyof typeof ProductStatus];

export const CrossSellStatus = {
  SUGERIDA: "sugerida",
  CONVERTIDA: "convertida",
  DESCARTADA: "descartada",
} as const;
export type CrossSellStatus =
  (typeof CrossSellStatus)[keyof typeof CrossSellStatus];

export const CustomerSuccessStageType = {
  BOAS_VINDAS: "boas_vindas",
  CONFIRMACAO_APOLICE: "confirmacao_apolice",
  PRIMEIRO_CONTATO: "primeiro_contato",
  PESQUISA_SATISFACAO: "pesquisa_satisfacao",
  ACOMPANHAMENTO: "acompanhamento",
  RENOVACAO_FUTURA: "renovacao_futura",
} as const;
export type CustomerSuccessStageType =
  (typeof CustomerSuccessStageType)[keyof typeof CustomerSuccessStageType];

export const CustomerSuccessStageStatus = {
  PENDENTE: "pendente",
  CONCLUIDO: "concluido",
  CANCELADO: "cancelado",
} as const;
export type CustomerSuccessStageStatus =
  (typeof CustomerSuccessStageStatus)[keyof typeof CustomerSuccessStageStatus];

export const UserRole = {
  CONSULTOR: "consultor",
  GESTOR: "gestor",
  ADMIN: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const StageKind = {
  OPEN: "open",
  WON: "won",
  LOST: "lost",
} as const;
export type StageKind = (typeof StageKind)[keyof typeof StageKind];

export const ProductSource = {
  MANUAL: "manual",
  ERP: "erp",
} as const;
export type ProductSource = (typeof ProductSource)[keyof typeof ProductSource];

// ─── TIMELINE EVENT TYPES ────────────────────────────────────────────────────

export const TimelineEventType = {
  PERSON_CREATED: "person_created",
  PERSON_UPDATED: "person_updated",
  OPPORTUNITY_CREATED: "opportunity_created",
  STAGE_CHANGE: "stage_change",
  NEXT_STEP_CREATED: "next_step_created",
  NEXT_STEP_DONE: "next_step_done",
  NEXT_STEP_OVERDUE: "next_step_overdue",
  ACTIVITY_REGISTERED: "activity_registered",
  PROPOSAL_SENT: "proposal_sent",
  FOLLOW_UP: "follow_up",
  CLOSED_WON: "closed_won",
  CLOSED_LOST: "closed_lost",
  RENEWAL: "renewal",
  CROSS_SELL: "cross_sell",
  CUSTOMER_SUCCESS: "customer_success",
  PRODUCT_ADDED: "product_added",
  ERP_SYNC: "erp_sync",
  DOCUMENT_ADDED: "document_added",
} as const;
export type TimelineEventType =
  (typeof TimelineEventType)[keyof typeof TimelineEventType];

// ─── ORIGIN OPTIONS ──────────────────────────────────────────────────────────

export const OriginOptions = [
  "Indicação",
  "Site",
  "Redes Sociais",
  "Telefone",
  "Loja Física",
  "Evento",
  "Renovação Automática",
  "Cross Selling",
  "Outro",
] as const;
export type Origin = (typeof OriginOptions)[number];

// ─── CUSTOMER SUCCESS STAGE ORDER ────────────────────────────────────────────

export const CS_STAGE_ORDER: CustomerSuccessStageType[] = [
  CustomerSuccessStageType.BOAS_VINDAS,
  CustomerSuccessStageType.CONFIRMACAO_APOLICE,
  CustomerSuccessStageType.PRIMEIRO_CONTATO,
  CustomerSuccessStageType.PESQUISA_SATISFACAO,
  CustomerSuccessStageType.ACOMPANHAMENTO,
  CustomerSuccessStageType.RENOVACAO_FUTURA,
];

/** Offsets em dias a partir do fechamento para cada etapa de CS */
export const CS_STAGE_DUE_OFFSETS: Record<CustomerSuccessStageType, number> = {
  [CustomerSuccessStageType.BOAS_VINDAS]: 1,
  [CustomerSuccessStageType.CONFIRMACAO_APOLICE]: 3,
  [CustomerSuccessStageType.PRIMEIRO_CONTATO]: 7,
  [CustomerSuccessStageType.PESQUISA_SATISFACAO]: 15,
  [CustomerSuccessStageType.ACOMPANHAMENTO]: 30,
  [CustomerSuccessStageType.RENOVACAO_FUTURA]: 300, // ~10 meses (antes da renovação)
};
