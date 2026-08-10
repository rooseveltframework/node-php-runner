declare module "php" {
    export function run(script: string): string;
    export function runCode(code: string): string;
    export function runWithData(template: string, model?: any): string;
    export function runCodeWithData(code: string, model?: any): string;
    export function __express(template: any, model: any, callback: any): void;
    export function disableRegisterGlobalModel(): void;
    export function enableRegisterGlobalModel(): void;
}
