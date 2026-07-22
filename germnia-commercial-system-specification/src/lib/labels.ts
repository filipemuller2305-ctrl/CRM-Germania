export const personStatusLabels: Record<string, string> = {
  lead: "Lead",
  ativo: "Em atendimento",
  cliente: "Cliente",
  inativo: "Inativo",
};

export const personStatusColors: Record<string, string> = {
  lead: "bg-amber-100 text-amber-800 ring-amber-600/20",
  ativo: "bg-sky-100 text-sky-800 ring-sky-600/20",
  cliente: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  inativo: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const activityTypeLabels: Record<string, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  visita: "Visita",
  mensagem: "Mensagem",
  anotacao: "Anotação",
};

export const activityTypeIcons: Record<string, string> = {
  ligacao: "Phone",
  whatsapp: "MessageCircle",
  email: "Mail",
  reuniao: "Users",
  visita: "MapPin",
  mensagem: "MessageSquare",
  anotacao: "StickyNote",
};

export const timelineTypeLabels: Record<string, string> = {
  person_created: "Pessoa cadastrada",
  ligacao: "Ligação realizada",
  whatsapp: "WhatsApp enviado",
  email: "E-mail enviado",
  reuniao: "Reunião",
  visita: "Visita",
  mensagem: "Mensagem",
  anotacao: "Anotação",
  proposal_sent: "Proposta enviada",
  follow_up: "Follow-up",
  stage_change: "Mudança de etapa",
  next_step_created: "Próximo passo definido",
  next_step_done: "Próximo passo concluído",
  opportunity_created: "Oportunidade criada",
  closed_won: "Fechamento (Ganha)",
  closed_lost: "Fechamento (Perdida)",
  renewal: "Renovação",
  cross_sell: "Cross Selling",
  customer_success: "Customer Success",
  product_added: "Produto adicionado",
  erp_sync: "Sincronização ERP",
  document_added: "Documento adicionado",
};

export const opportunityStatusLabels: Record<string, string> = {
  aberta: "Aberta",
  ganha: "Ganha",
  perdida: "Perdida",
};

export const nextStepStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const crossSellStatusLabels: Record<string, string> = {
  sugerida: "Sugerida",
  convertida: "Convertida",
  descartada: "Descartada",
};

export const customerSuccessStageLabels: Record<string, string> = {
  boas_vindas: "Boas-vindas",
  confirmacao_apolice: "Confirmação da apólice",
  primeiro_contato: "Primeiro contato",
  pesquisa_satisfacao: "Pesquisa de satisfação",
  acompanhamento: "Acompanhamento",
  renovacao_futura: "Renovação futura",
};

export const customerSuccessStageOrder = [
  "boas_vindas",
  "confirmacao_apolice",
  "primeiro_contato",
  "pesquisa_satisfacao",
  "acompanhamento",
  "renovacao_futura",
];

export const productStatusLabels: Record<string, string> = {
  ativa: "Ativa",
  vencida: "Vencida",
  cancelada: "Cancelada",
  em_cotacao: "Em cotação",
};

export const originOptions = [
  "Indicação",
  "Site",
  "Redes Sociais",
  "Telefone",
  "Loja Física",
  "Evento",
  "Outro",
];
