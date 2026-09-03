declare module "php" {
    /** A data model to render a template against. Its keys become variables the template can read. */
    type Model = Record<string, unknown>;

    /** Runs a PHP script and returns what it printed. */
    export function run(script: string): string;

    /** Runs PHP source held in a string and returns what it printed. */
    export function runCode(code: string): string;

    /** Runs a PHP script against a model and returns what it printed. */
    export function runWithData(template: string, model?: Model): string;

    /** Runs PHP source held in a string against a model and returns what it printed. */
    export function runCodeWithData(code: string, model?: Model): string;

    /** The Express view engine. Pass it to `app.engine('php', php.__express)`. */
    export function __express(
        template: string,
        model: Model,
        callback: (error: Error | null, markup?: string) => void
    ): void;

    /** Stops a model's keys becoming variables the template can read. */
    export function disableRegisterGlobalModel(): void;

    /** Lets a model's keys become variables the template can read, which is the default. */
    export function enableRegisterGlobalModel(): void;

    /** Changes how the PHP worker processes are run. Stops any that are already running. */
    export function configureWorkers(options: {
        /** How many PHP processes to keep. Defaults to four, or one per core where there are fewer. */
        size?: number;
        /** Whether PHP rechecks a template on disk before reusing its compiled form. Defaults to true. */
        validateTimestamps?: boolean;
        /** Whether to send a template only the parts of the model it reads. Defaults to true. */
        trimModel?: boolean;
        /** How much memory one render may use before PHP stops it. Defaults to '256M'. */
        memoryLimit?: string;
        /** Whether to use worker processes at all. Defaults to true. */
        enabled?: boolean;
    }): void;

    /** Stops the PHP worker processes. The next render starts them again. */
    export function stopWorkers(): void;
}
