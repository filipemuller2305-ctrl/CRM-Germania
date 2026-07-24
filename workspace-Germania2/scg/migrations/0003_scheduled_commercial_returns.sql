-- Valores novos precisam ser confirmados antes de serem usados no restante da
-- migration em versões do PostgreSQL que não permitem uso imediato no mesmo
-- bloco transacional.
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'recuperacao';
ALTER TYPE opportunity_status ADD VALUE IF NOT EXISTS 'cancelada';

BEGIN;

CREATE TYPE opportunity_close_outcome AS ENUM (
  'renovou_outra_corretora',
  'renovou_direto_banco_seguradora',
  'contratou_protecao_veicular',
  'nao_renovou_seguro',
  'nao_foi_possivel_concluir',
  'cancelamento_erro_duplicidade'
);

CREATE TYPE opportunity_loss_reason AS ENUM (
  'preco',
  'cobertura',
  'condicao_pagamento',
  'relacionamento_outra_empresa',
  'nao_respondeu',
  'desistiu',
  'vendeu_ou_nao_possui_bem',
  'risco_recusado',
  'documentacao_incompleta',
  'outro'
);

CREATE TYPE scheduled_commercial_return_status AS ENUM (
  'pendente',
  'processado',
  'cancelado'
);

ALTER TABLE opportunities
  ADD COLUMN recovery_key text,
  ADD COLUMN close_outcome opportunity_close_outcome,
  ADD COLUMN loss_reason opportunity_loss_reason,
  ADD COLUMN close_notes text,
  ADD COLUMN next_expiration_date date;

-- Preserva encerramentos legados sem inventar uma classificação comercial.
UPDATE opportunities
SET
  close_outcome = 'nao_foi_possivel_concluir',
  loss_reason = 'outro',
  close_notes = COALESCE(NULLIF(BTRIM(lost_reason), ''), 'Encerramento migrado')
WHERE status = 'perdida';

ALTER TABLE opportunities DROP COLUMN lost_reason;

CREATE UNIQUE INDEX idx_opp_recovery_key_unique
  ON opportunities(recovery_key)
  WHERE recovery_key IS NOT NULL;

ALTER TABLE opportunities
  DROP CONSTRAINT opportunities_origin_consistency,
  ADD CONSTRAINT opportunities_origin_consistency CHECK (
    (lead_id IS NULL OR type = 'novo_negocio')
    AND (
      type <> 'renovacao'
      OR (person_product_id IS NOT NULL AND renewal_key IS NOT NULL)
    )
    AND (
      type = 'renovacao'
      OR (person_product_id IS NULL AND renewal_key IS NULL)
    )
    AND (type <> 'recuperacao' OR recovery_key IS NOT NULL)
    AND (type = 'recuperacao' OR recovery_key IS NULL)
  ),
  ADD CONSTRAINT opportunities_close_details_consistency CHECK (
    (
      status = 'perdida'
      AND close_outcome IS NOT NULL
      AND loss_reason IS NOT NULL
      AND NULLIF(BTRIM(close_notes), '') IS NOT NULL
    ) OR (
      status = 'cancelada'
      AND close_outcome = 'cancelamento_erro_duplicidade'
      AND loss_reason IS NULL
      AND NULLIF(BTRIM(close_notes), '') IS NOT NULL
    ) OR status IN ('aberta', 'ganha')
  ),
  ADD CONSTRAINT opportunities_external_expiration_required CHECK (
    close_outcome NOT IN (
      'renovou_outra_corretora',
      'renovou_direto_banco_seguradora',
      'contratou_protecao_veicular'
    )
    OR next_expiration_date IS NOT NULL
  );

CREATE TABLE scheduled_commercial_returns (
  id serial PRIMARY KEY,
  person_id integer NOT NULL REFERENCES people(id),
  source_opportunity_id integer NOT NULL REFERENCES opportunities(id),
  created_opportunity_id integer REFERENCES opportunities(id),
  product_type_id integer NOT NULL REFERENCES product_types(id),
  owner_id integer NOT NULL REFERENCES users(id),
  close_outcome opportunity_close_outcome NOT NULL,
  next_expiration_date date NOT NULL,
  scheduled_for date NOT NULL,
  notes text NOT NULL,
  status scheduled_commercial_return_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT scheduled_return_external_outcome CHECK (
    close_outcome IN (
      'renovou_outra_corretora',
      'renovou_direto_banco_seguradora',
      'contratou_protecao_veicular'
    )
  ),
  CONSTRAINT scheduled_return_45_days_before CHECK (
    scheduled_for = next_expiration_date - 45
  ),
  CONSTRAINT scheduled_return_notes_required CHECK (
    NULLIF(BTRIM(notes), '') IS NOT NULL
  )
);

CREATE UNIQUE INDEX idx_commercial_return_source_unique
  ON scheduled_commercial_returns(source_opportunity_id);
CREATE UNIQUE INDEX idx_commercial_return_created_opportunity_unique
  ON scheduled_commercial_returns(created_opportunity_id)
  WHERE created_opportunity_id IS NOT NULL;
CREATE INDEX idx_commercial_return_due
  ON scheduled_commercial_returns(status, scheduled_for);
CREATE INDEX idx_commercial_return_person
  ON scheduled_commercial_returns(person_id);

COMMIT;
