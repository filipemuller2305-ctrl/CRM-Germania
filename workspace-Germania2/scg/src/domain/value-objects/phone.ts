// ═══════════════════════════════════════════════════════════════════════════
// Value Object: Phone
// Normalização de telefones brasileiros (com DDD)
// ═══════════════════════════════════════════════════════════════════════════

export class Phone {
  private readonly ddd: string;
  private readonly number: string;

  private constructor(ddd: string, number: string) {
    this.ddd = ddd;
    this.number = number;
  }

  static create(input: string): Phone {
    const digits = input.replace(/\D/g, "");

    // Remove código do país se presente
    const clean = digits.startsWith("55") && digits.length > 11
      ? digits.slice(2)
      : digits;

    if (clean.length < 10 || clean.length > 11) {
      throw new PhoneInvalidError(
        `Telefone deve ter 10 ou 11 dígitos (DDD + número). Recebido: ${clean.length}`
      );
    }

    const ddd = clean.slice(0, 2);
    const number = clean.slice(2);

    return new Phone(ddd, number);
  }

  static optional(input: string | null | undefined): Phone | null {
    if (!input || input.trim() === "") return null;
    try {
      return Phone.create(input);
    } catch {
      return null;
    }
  }

  /** Apenas dígitos: 11999998888 */
  get value(): string {
    return `${this.ddd}${this.number}`;
  }

  /** Formatado: (11) 99999-8888 */
  get formatted(): string {
    if (this.number.length === 9) {
      return `(${this.ddd}) ${this.number.slice(0, 5)}-${this.number.slice(5)}`;
    }
    return `(${this.ddd}) ${this.number.slice(0, 4)}-${this.number.slice(4)}`;
  }

  /** Formato para link de WhatsApp: 5511999998888 */
  get whatsappLink(): string {
    return `55${this.value}`;
  }

  get isMobile(): boolean {
    return this.number.length === 9;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.formatted;
  }
}

export class PhoneInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhoneInvalidError";
  }
}
