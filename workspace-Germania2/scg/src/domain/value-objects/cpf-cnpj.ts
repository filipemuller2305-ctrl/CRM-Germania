// ═══════════════════════════════════════════════════════════════════════════
// Value Object: CPF/CNPJ
// Validação, formatação e normalização de documentos brasileiros
// ═══════════════════════════════════════════════════════════════════════════

export class CpfCnpj {
  private readonly raw: string; // apenas dígitos

  private constructor(raw: string) {
    this.raw = raw;
  }

  // ─── FACTORY ─────────────────────────────────────────────────────────────

  static create(input: string): CpfCnpj {
    const digits = input.replace(/\D/g, "");

    if (digits.length !== 11 && digits.length !== 14) {
      throw new CpfCnpjInvalidError(
        `Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos. Recebido: ${digits.length}`
      );
    }

    if (digits.length === 11 && !CpfCnpj.validateCpf(digits)) {
      throw new CpfCnpjInvalidError("CPF inválido (dígito verificador)");
    }

    if (digits.length === 14 && !CpfCnpj.validateCnpj(digits)) {
      throw new CpfCnpjInvalidError("CNPJ inválido (dígito verificador)");
    }

    return new CpfCnpj(digits);
  }

  /** Cria sem validação (para dados vindos do ERP que já foram validados) */
  static fromErp(input: string): CpfCnpj {
    const digits = input.replace(/\D/g, "");
    return new CpfCnpj(digits);
  }

  /** Retorna null se input for vazio ou inválido (para campos opcionais) */
  static optional(input: string | null | undefined): CpfCnpj | null {
    if (!input || input.trim() === "") return null;
    try {
      return CpfCnpj.create(input);
    } catch {
      return null;
    }
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  /** Apenas dígitos (para armazenar no banco e comparar) */
  get value(): string {
    return this.raw;
  }

  /** Formatado: 000.000.000-00 ou 00.000.000/0000-00 */
  get formatted(): string {
    if (this.isCpf) {
      return this.raw.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
      );
    }
    return this.raw.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }

  get isCpf(): boolean {
    return this.raw.length === 11;
  }

  get isCnpj(): boolean {
    return this.raw.length === 14;
  }

  // ─── VALIDATION ──────────────────────────────────────────────────────────

  private static validateCpf(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== parseInt(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== parseInt(cpf[10])) return false;

    return true;
  }

  private static validateCnpj(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const calcCheck = (base: string, weights: number[]): number => {
      let sum = 0;
      for (let i = 0; i < base.length; i++) {
        sum += parseInt(base[i]) * weights[i];
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const d1 = calcCheck(cnpj.slice(0, 12), w1);
    const d2 = calcCheck(cnpj.slice(0, 12) + d1, w2);

    return parseInt(cnpj[12]) === d1 && parseInt(cnpj[13]) === d2;
  }

  // ─── COMPARISON ──────────────────────────────────────────────────────────

  equals(other: CpfCnpj): boolean {
    return this.raw === other.raw;
  }

  toString(): string {
    return this.formatted;
  }
}

// ─── ERROR ───────────────────────────────────────────────────────────────────

export class CpfCnpjInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CpfCnpjInvalidError";
  }
}
