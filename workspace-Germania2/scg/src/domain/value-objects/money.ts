// ═══════════════════════════════════════════════════════════════════════════
// Value Object: Money
// Representa valores monetários em BRL (armazenados em centavos)
// ═══════════════════════════════════════════════════════════════════════════

export class Money {
  /** Valor em centavos (integer) para evitar problemas de ponto flutuante */
  private readonly cents: number;

  private constructor(cents: number) {
    this.cents = Math.round(cents);
  }

  /** Cria a partir de reais (ex: 1500.50 → 150050 centavos) */
  static fromReais(value: number): Money {
    if (isNaN(value) || !isFinite(value)) {
      throw new MoneyInvalidError("Valor monetário inválido");
    }
    if (value < 0) {
      throw new MoneyInvalidError("Valor monetário não pode ser negativo");
    }
    return new Money(Math.round(value * 100));
  }

  /** Cria a partir de string "1500.50" ou "1.500,50" (formato BR) */
  static fromString(input: string): Money {
    // Normaliza formato brasileiro: remove pontos de milhar, troca vírgula
    let normalized = input.trim();

    // Se tem vírgula, é formato BR (1.500,50)
    if (normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    }

    const value = parseFloat(normalized);
    if (isNaN(value)) {
      throw new MoneyInvalidError(`Não foi possível parsear valor: "${input}"`);
    }
    return Money.fromReais(value);
  }

  static optional(input: number | string | null | undefined): Money | null {
    if (input === null || input === undefined || input === "") return null;
    if (typeof input === "string" && input.trim() === "") return null;
    try {
      return typeof input === "string"
        ? Money.fromString(input)
        : Money.fromReais(input);
    } catch {
      return null;
    }
  }

  static zero(): Money {
    return new Money(0);
  }

  // ─── GETTERS ─────────────────────────────────────────────────────────────

  /** Valor em reais (float) — para exibição */
  get reais(): number {
    return this.cents / 100;
  }

  /** Valor em centavos (integer) — para armazenamento */
  get value(): number {
    return this.cents;
  }

  /** Formatado: R$ 1.500,50 */
  get formatted(): string {
    return this.cents.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  get isZero(): boolean {
    return this.cents === 0;
  }

  // ─── OPERATIONS ──────────────────────────────────────────────────────────

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor));
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toString(): string {
    return this.formatted;
  }
}

export class MoneyInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInvalidError";
  }
}
