export type Clock = () => string;

export const defaultClock: Clock = () => new Date().toISOString();

export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
