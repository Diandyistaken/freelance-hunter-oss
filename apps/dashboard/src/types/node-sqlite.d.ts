// Yerleşik node:sqlite (Node 22.5+) için asgari tip bildirimi.
// Projedeki @types/node sürümü bu modülü henüz tanımıyor; kullandığımız
// yüzey kadarını burada bildiriyoruz.
declare module "node:sqlite" {
  interface StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}
