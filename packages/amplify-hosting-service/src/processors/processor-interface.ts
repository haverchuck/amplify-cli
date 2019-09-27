export interface Processor {
    publish: () => Promise<void>,
    configure: () => Promise<void>,
    status: () => Promise<void>,
    remove: (input: string) => void,
    console: () => Promise<void>
}