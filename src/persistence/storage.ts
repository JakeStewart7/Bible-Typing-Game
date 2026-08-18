export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StoredValue<T> = {
  key: string;
  decode: (raw: string) => T | null;
  encode?: (value: T) => string;
};

export class AppStorage {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  read<T>(value: StoredValue<T>, fallback: T): T {
    const raw = this.storage.getItem(value.key);
    if (raw === null) return fallback;
    return value.decode(raw) ?? fallback;
  }

  write<T>(value: StoredValue<T>, data: T): void {
    this.storage.setItem(value.key, value.encode?.(data) ?? JSON.stringify(data));
  }

  remove(value: StoredValue<unknown>): void {
    this.storage.removeItem(value.key);
  }
}

export function decodeJson<T>(validate: (value: unknown) => value is T): (raw: string) => T | null {
  return raw => {
    try {
      const value: unknown = JSON.parse(raw);
      return validate(value) ? value : null;
    } catch {
      return null;
    }
  };
}
