// ═══════════════════════════════════════════════════════════════════════════
// Domain Entity: Person
// Entidade central do sistema. Representa qualquer pessoa (lead, cliente, etc)
// ═══════════════════════════════════════════════════════════════════════════

import { PersonStatus, PersonType, type Origin } from "../types";
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
  origin: Origin | null;
  status: PersonStatus;
  ownerId: number | null;
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
  origin?: Origin | null;
  ownerId?: number | null;
  notes?: string | null;
  erpCustomerId?: string | null;
}

export class Person {
  private constructor(private props: PersonProps) {}

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  static create(input: CreatePersonInput): Person {
    // Validações de domínio
    if (!input.name || input.name.trim().length < 2) {
      throw new PersonValidationError("Nome deve ter pelo menos 2 caracteres");
    }

    if (input.email && !Person.isValidEmail(input.email)) {
      throw new PersonValidationError(`E-mail inválido: ${input.email}`);
    }

    const person = new Person({
      id: 0, // será atribuído pelo repositório
      name: input.name.trim(),
      type: input.type ?? PersonType.PF,
      phone: Phone.optional(input.phone),
      whatsapp: Phone.optional(input.whatsapp),
      email: input.email?.trim().toLowerCase() || null,
      document: input.document ? CpfCnpj.create(input.document) : null,
      origin: input.origin ?? null,
      status: PersonStatus.LEAD,
      ownerId: input.ownerId ?? null,
      notes: input.notes?.trim() || null,
      erpCustomerId: input.erpCustomerId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return person;
  }

  /** Reconstrói a entidade a partir de dados persistidos (repositório) */
  static reconstitute(props: PersonProps): Person {
    return new Person(props);
  }

  // ─── BEHAVIOR ────────────────────────────────────────────────────────────

  /** Marca como ativo (em atendimento comercial) */
  activate(): void {
    if (this.props.status === PersonStatus.INATIVO) {
      throw new PersonValidationError(
        "Não é possível ativar uma pessoa inativa diretamente. Reative-a primeiro."
      );
    }
    this.props.status = PersonStatus.ATIVO;
    this.props.updatedAt = new Date();
  }

  /** Marca como cliente (tem pelo menos um produto ativo) */
  markAsClient(): void {
    this.props.status = PersonStatus.CLIENTE;
    this.props.updatedAt = new Date();
  }

  /** Marca como inativo */
  deactivate(): void {
    this.props.status = PersonStatus.INATIVO;
    this.props.updatedAt = new Date();
  }

  /** Atualiza dados cadastrais */
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

    if (input.origin !== undefined) {
      this.props.origin = input.origin;
    }

    if (input.ownerId !== undefined) {
      this.props.ownerId = input.ownerId;
    }

    if (input.notes !== undefined) {
      this.props.notes = input.notes?.trim() || null;
    }

    this.props.updatedAt = new Date();
  }

  /** Reatribui responsável comercial */
  reassign(newOwnerId: number): void {
    this.props.ownerId = newOwnerId;
    this.props.updatedAt = new Date();
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  get id(): number { return this.props.id; }
  get name(): string { return this.props.name; }
  get type(): PersonType { return this.props.type; }
  get phone(): Phone | null { return this.props.phone; }
  get whatsapp(): Phone | null { return this.props.whatsapp; }
  get email(): string | null { return this.props.email; }
  get document(): CpfCnpj | null { return this.props.document; }
  get origin(): Origin | null { return this.props.origin; }
  get status(): PersonStatus { return this.props.status; }
  get ownerId(): number | null { return this.props.ownerId; }
  get notes(): string | null { return this.props.notes; }
  get erpCustomerId(): string | null { return this.props.erpCustomerId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get isLead(): boolean { return this.props.status === PersonStatus.LEAD; }
  get isClient(): boolean { return this.props.status === PersonStatus.CLIENTE; }
  get isActive(): boolean { return this.props.status === PersonStatus.ATIVO; }

  get documentValue(): string | null {
    return this.props.document?.value ?? null;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Serializa para persistência (formato do banco) */
  toPersistence() {
    return {
      id: this.props.id || undefined,
      name: this.props.name,
      type: this.props.type,
      phone: this.props.phone?.value ?? null,
      whatsapp: this.props.whatsapp?.value ?? null,
      email: this.props.email,
      document: this.props.document?.value ?? null,
      origin: this.props.origin,
      status: this.props.status,
      ownerId: this.props.ownerId,
      notes: this.props.notes,
      erpCustomerId: this.props.erpCustomerId,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}

// ─── ERROR ───────────────────────────────────────────────────────────────────

export class PersonValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonValidationError";
  }
}
