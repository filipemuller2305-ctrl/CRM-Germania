import assert from "node:assert/strict";
import test from "node:test";
import { Activity } from "../src/domain/entities/activity.entity";
import { Lead } from "../src/domain/entities/lead.entity";
import { Opportunity } from "../src/domain/entities/opportunity.entity";
import { Person } from "../src/domain/entities/person.entity";
import { RenewalDetector } from "../src/domain/services/renewal-detector";
import {
  ActivityType,
  ContactSource,
  EntryChannel,
  LeadStatus,
  OpportunityStatus,
  OpportunityType,
  PersonStatus,
  ProductStatus,
} from "../src/domain/types";

const attribution = {
  source: ContactSource.GOOGLE,
  channel: EntryChannel.WHATSAPP,
  campaign: "Google Ads Auto",
  referredByPersonId: null,
  sourceDetail: null,
};

test("Pessoa nasce ativa e não carrega estado de Lead", () => {
  const person = Person.create({ name: "Maria Germania" });
  assert.equal(person.status, PersonStatus.ATIVA);
  assert.equal("origin" in person.toPersistence(), false);
});

test("Lead sem responsável permanece novo", () => {
  const lead = Lead.create({
    personId: 1,
    source: ContactSource.GOOGLE,
    channel: EntryChannel.WHATSAPP,
    capturedById: 2,
  });
  assert.equal(lead.status, LeadStatus.NOVO);
  assert.equal(lead.ownerId, null);
});

test("Lead atribuído entra em qualificação", () => {
  const lead = Lead.create({
    personId: 1,
    productTypeId: 7,
    source: ContactSource.INSTAGRAM,
    channel: EntryChannel.DIRECT_INSTAGRAM,
    capturedById: 2,
    ownerId: 3,
  });
  assert.equal(lead.status, LeadStatus.EM_QUALIFICACAO);
  assert.ok(lead.qualificationStartedAt);
});

test("Indicação exige identificação do indicador", () => {
  assert.throws(
    () =>
      Lead.create({
        personId: 1,
        source: ContactSource.INDICACAO,
        channel: EntryChannel.WHATSAPP,
        capturedById: 2,
      }),
    /Indicação exige/
  );
});

test("Lead só converte com responsável e produto", () => {
  const lead = Lead.create({
    personId: 1,
    source: ContactSource.GOOGLE,
    channel: EntryChannel.WHATSAPP,
    capturedById: 2,
  });
  assert.throws(() => lead.convert(10), /responsável/);
  lead.startQualification(3);
  assert.throws(() => lead.convert(10), /Produto/);
  lead.setProductInterest(7);
  lead.convert(10);
  assert.equal(lead.status, LeadStatus.CONVERTIDO);
  assert.equal(lead.opportunityId, 10);
});

test("Renovação exige apólice e chave do ciclo", () => {
  assert.throws(
    () =>
      Opportunity.create({
        personId: 1,
        productTypeId: 7,
        pipelineId: 1,
        stageId: 1,
        ownerId: 2,
        type: OpportunityType.RENOVACAO,
        attribution,
      }),
    /produto\/apólice/
  );
});

test("Fechamento ganho atualiza etapa e status juntos", () => {
  const opportunity = Opportunity.create({
    personId: 1,
    productTypeId: 7,
    pipelineId: 1,
    stageId: 1,
    ownerId: 2,
    type: OpportunityType.DEMANDA_DIRETA,
    attribution,
  });
  opportunity.moveToStage(9, "won");
  assert.equal(opportunity.stageId, 9);
  assert.equal(opportunity.status, OpportunityStatus.GANHA);
  assert.equal(opportunity.probability, 100);
});

test("Atividade não mistura Lead e Oportunidade", () => {
  assert.throws(
    () =>
      Activity.create({
        personId: 1,
        leadId: 2,
        opportunityId: 3,
        type: ActivityType.LIGACAO,
      }),
    /simultaneamente/
  );
});

test("Detector não recria um ciclo de renovação encerrado", () => {
  const detector = new RenewalDetector();
  const renewalDate = new Date("2026-08-15T12:00:00-03:00");
  const key = RenewalDetector.buildRenewalKey(55, renewalDate);
  const candidates = detector.detect(
    [
      {
        personProductId: 55,
        personId: 1,
        personName: "Cliente",
        productTypeId: 7,
        productTypeName: "Auto",
        renewalDate,
        status: ProductStatus.ATIVA,
        ownerId: 2,
      },
    ],
    [{ renewalKey: key }],
    new Date("2026-07-23T12:00:00-03:00")
  );
  assert.deepEqual(candidates, []);
});
