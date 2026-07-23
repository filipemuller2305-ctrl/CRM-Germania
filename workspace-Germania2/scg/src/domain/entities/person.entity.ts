// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Person
// Cadastro permanente de uma pessoa física ou jurídica.
// Não representa Lead, negociação ou condição de cliente.
// ═══════════════════════════════════════════════════════════════════════════

import { PersonStatus, PersonType } from "../types";
import { CpfCnpj } from "../value-objects/cpf-cnpj";
import { Phone } from "../value-objects/phone";

export interface PersonProps {
  id: number;
  name: string;
  type: PersonType;
  phone: Phone | null;
  whatsapp: Phone | null;
  email: string | null;
  document: CpfCnpj | null;
  status: PersonStatus;
  relationshipOwnerId: number | null;
  notes: string | null;
  erpCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePersonInput {
  name: string;
  type?: PersonType;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  document?: string | null;
  relationshipOwnerId?: number | null;
  notes?: string | null;
  erpCustomerId?: string | null;
}

export class Person {
  private constructor(private props: PersonProps) {}

  static create(input: CreatePersonInput): Person {
    if (!input.name || input.name.trim().length < 2) {
      throw new PersonValidationError("Nome deve ter pelo menos 2 caracteres");
    }
    if (input.email && !Person.isValidEmail(input.email)) {
      throw new PersonValidationError(`E-mail inválido: ${input.email}`);
    }
    Person.assertOptionalPositiveId(
      input.relationshipOwnerId,
      "Responsável pelo relacionamento"
    );

    return new Person({
      id: 0,
      name: input.name.trim(),
      type: input.type ?? PersonType.PF,
      phone: Phone.optional(input.phone),
      whatsapp: Phone.optional(input.whatsapp),
      email: input.email?.trim().toLowerCase() || null,
      document: input.document ? CpfCnpj.create(input.document) : null,
      status: PersonStatus.ATIVA,
      relationshipOwnerId: input.relationshipOwnerId ?? null,
      notes: input.notes?.trim() || null,
      erpCustomerId: input.erpCustomerId?.trim() || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: PersonProps): Person {
    return new Person(props);
  }

  deactivate(): void {
    this.props.status = PersonStatus.INATIVA;
    this.touch();
  }

  reactivate(): void {
    this.props.status = PersonStatus.ATIVA;
    this.touch();
  }

  update(input: Partial<CreatePersonInput>): void {
    if (input.name !== undefined) {
      if (input.name.trim().length < 2) {
        throw new PersonValidationError("Nome deve ter pelo menos 2 caracteres");
      }
      this.props.name = input.name.trim();
    }
    if (input.phone !== undefined) {
      this.props.phone = Phone.optional(input.phone);
    }
    if (input.whatsapp !== undefined) {
      this.props.whatsapp = Phone.optional(input.whatsapp);
    }
    if (input.email !== undefined) {
      if (input.email && !Person.isValidEmail(input.email)) {
        throw new PersonValidationError(`E-mail inválido: ${input.email}`);
      }
      this.props.email = input.email?.trim().toLowerCase() || null;
    }
    if (input.document !== undefined) {
      this.props.document = input.document
        ? CpfCnpj.create(input.document)
        : null;
    }
    if (input.relationshipOwnerId !== undefined) {
      Person.assertOptionalPositiveId(
        input.relationshipOwnerId,
        "Responsável pelo relacionamento"
      );
      this.props.relationshipOwnerId = input.relationshipOwnerId;
    }
    if (input.notes !== undefined) {
      this.props.notes = input.notes?.trim() || null;
    }
    if (input.erpCustomerId !== undefined) {
      this.props.erpCustomerId = input.erpCustomerId?.trim() || null;
    }
    this.touch();
  }

  reassignRelationshipOwner(newOwnerId: number | null): void {
    Person.assertOptionalPositiveId(newOwnerId, "Responsável pelo relacionamento");
    this.props.relationshipOwnerId = newOwnerId;
    this.touch();
  }

  get id(): number { return this.props.id; }
  get name(): string { return this.props.name; }
  get type(): PersonType { return this.props.type; }
  get phone(): Phone | null { return this.props.phone; }
  get whatsapp(): Phone | null { return this.props.whatsapp; }
  get email(): string | null { return this.props.email; }
  get document(): CpfCnpj | null { return this.props.document; }
  get status(): PersonStatus { return this.props.status; }
  get relationshipOwnerId(): number | null {
    return this.props.relationshipOwnerId;
  }
  get notes(): string | null { return this.props.notes; }
  get erpCustomerId(): string | null { return this.props.erpCustomerId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get isActive(): boolean { return this.props.status === PersonStatus.ATIVA; }
  get documentValue(): string | null { return this.props.document?.value ?? null; }

  toPersistence() {
    return {
      id: this.props.id || undefined,
      name: this.props.name,
      type: this.props.type,
      phone: this.props.phone?.value ?? null,
      whatsapp: this.props.whatsapp?.value ?? null,
      email: this.props.email,
      document: this.props.document?.value ?? null,
      status: this.props.status,
      relationshipOwnerId: this.props.relationshipOwnerId,
      notes: this.props.notes,
      erpCustomerId: this.props.erpCustomerId,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private static assertOptionalPositiveId(
    value: number | null | undefined,
    field: string
  ): void {
    if (value !== null && value !== undefined && value <= 0) {
      throw new PersonValidationError(`${field} deve ser um ID válido`);
    }
  }
}

export class PersonValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonValidationError";
  }
}
