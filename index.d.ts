declare module "php" {
    export async function __express(template: any, model: any, callback: any): Promise<any>;
    export function disableRegisterGlobalModel(): void;
    export function enableRegisterGlobalModel(): void;
}
