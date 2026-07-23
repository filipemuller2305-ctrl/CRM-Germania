BEGIN;

ALTER TYPE person_status RENAME TO person_status_legacy;
CREATE TYPE person_status AS ENUM ('ativa', 'inativa');
ALTER TABLE people ALTER COLUMN status DROP DEFAULT;
ALTER TABLE people
  ALTER COLUMN status TYPE person_status
  USING (
    CASE
      WHEN status::text = 'inativo' THEN 'inativa'
      ELSE 'ativa'
    END
  )::person_status;
ALTER TABLE people ALTER COLUMN status SET DEFAULT 'ativa';
DROP TYPE person_status_legacy;

ALTER TABLE people RENAME COLUMN owner_id TO relationship_owner_id;
DROP INDEX IF EXISTS idx_people_owner;
CREATE INDEX idx_people_relationship_owner ON people(relationship_owner_id);
ALTER TABLE people DROP COLUMN origin;

CREATE TYPE lead_status AS ENUM (
  'novo', 'em_qualificacao', 'convertido', 'descartado', 'arquivado'
);
CREATE TYPE contact_source AS ENUM (
  'google', 'instagram', 'facebook', 'indicacao', 'base_clientes',
  'evento', 'prospeccao_ativa', 'outro'
);
CREATE TYPE entry_channel AS ENUM (
  'whatsapp', 'formulario_site', 'telefone', 'email', 'direct_instagram',
  'presencial', 'importacao', 'outro'
);
CREATE TYPE lead_discard_reason AS ENUM (
  'sem_interesse', 'fora_do_perfil', 'contato_invalido', 'duplicado',
  'nao_respondeu', 'outro'
);
CREATE TYPE opportunity_type AS ENUM (
  'novo_negocio', 'renovacao', 'cross_sell', 'demanda_direta'
);

CREATE TABLE leads (
  id serial PRIMARY KEY,
  person_id integer NOT NULL REFERENCES people(id),
  product_type_id integer REFERENCES product_types(id),
  source contact_source NOT NULL,
  channel entry_channel NOT NULL,
  campaign text,
  referred_by_person_id integer REFERENCES people(id),
  source_detail text,
  captured_by_id integer NOT NULL REFERENCES users(id),
  owner_id integer REFERENCES users(id),
  status lead_status NOT NULL DEFAULT 'novo',
  opportunity_id integer,
  discard_reason lead_discard_reason,
  discard_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  qualification_started_at timestamptz,
  qualified_at timestamptz,
  converted_at timestamptz,
  discarded_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT leads_no_self_referral
    CHECK (referred_by_person_id IS NULL OR referred_by_person_id <> person_id),
  CONSTRAINT leads_indication_identified
    CHECK (
      source <> 'indicacao'
      OR referred_by_person_id IS NOT NULL
      OR nullif(btrim(source_detail), '') IS NOT NULL
    )
);
CREATE INDEX idx_leads_person ON leads(person_id);
CREATE INDEX idx_leads_owner_status ON leads(owner_id, status);
CREATE INDEX idx_leads_source_channel ON leads(source, channel);
CREATE UNIQUE INDEX idx_leads_opportunity_unique
  ON leads(opportunity_id) WHERE opportunity_id IS NOT NULL;

ALTER TABLE opportunities
  ADD COLUMN lead_id integer REFERENCES leads(id),
  ADD COLUMN person_product_id integer REFERENCES person_products(id),
  ADD COLUMN cross_sell_suggestion_id integer REFERENCES cross_sell_suggestions(id),
  ADD COLUMN created_by_id integer REFERENCES users(id),
  ADD COLUMN type opportunity_type NOT NULL DEFAULT 'demanda_direta',
  ADD COLUMN source contact_source NOT NULL DEFAULT 'outro',
  ADD COLUMN channel entry_channel NOT NULL DEFAULT 'importacao',
  ADD COLUMN campaign text,
  ADD COLUMN referred_by_person_id integer REFERENCES people(id),
  ADD COLUMN source_detail text,
  ADD COLUMN renewal_key text;

UPDATE opportunities
SET source_detail = COALESCE(nullif(origin, ''), 'Migração do modelo anterior');
ALTER TABLE opportunities DROP COLUMN origin;
ALTER TABLE opportunities ALTER COLUMN type DROP DEFAULT;
ALTER TABLE opportunities ALTER COLUMN source DROP DEFAULT;
ALTER TABLE opportunities ALTER COLUMN channel DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM opportunities WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION
      'Há oportunidades sem responsável. Corrija owner_id antes de concluir a migração.';
  END IF;
END $$;
ALTER TABLE opportunities ALTER COLUMN owner_id SET NOT NULL;

CREATE UNIQUE INDEX idx_opp_lead_unique
  ON opportunities(lead_id) WHERE lead_id IS NOT NULL;
CREATE UNIQUE INDEX idx_opp_renewal_key_unique
  ON opportunities(renewal_key) WHERE renewal_key IS NOT NULL;
CREATE UNIQUE INDEX idx_opp_cross_sell_unique
  ON opportunities(cross_sell_suggestion_id)
  WHERE cross_sell_suggestion_id IS NOT NULL;

ALTER TABLE opportunities
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
  ),
  ADD CONSTRAINT opportunities_no_self_referral CHECK (
    referred_by_person_id IS NULL OR referred_by_person_id <> person_id
  );

ALTER TABLE activities
  ADD COLUMN lead_id integer REFERENCES leads(id),
  ADD CONSTRAINT activities_single_process CHECK (
    NOT (lead_id IS NOT NULL AND opportunity_id IS NOT NULL)
  );
CREATE INDEX idx_act_lead ON activities(lead_id);

ALTER TABLE timeline_events
  ADD COLUMN lead_id integer REFERENCES leads(id);
CREATE INDEX idx_timeline_lead ON timeline_events(lead_id);

ALTER TABLE leads
  ADD CONSTRAINT leads_opportunity_fk
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id);

COMMIT;
