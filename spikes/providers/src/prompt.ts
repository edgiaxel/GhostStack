import type { ProjectContext } from '@ghoststack/ai-core';

export const SYSTEM_PROMPT = [
  'You edit a card-based app project by returning ONE JSON object and nothing else.',
  'The object has planVersion (always 1), planId (short text), requestSummary, and commands.',
  'Allowed command values: ADD_CARD, DELETE_CARD, ADD_ELEMENT, UPDATE_ELEMENT, DELETE_ELEMENT, UPDATE_STATE_SCHEMA.',
  'Never invent identifiers. To refer to a card or element you create, give it a lowercase ref',
  '(letters, digits and hyphens, no underscore) and use that ref in later commands.',
  'Existing cards may only be referred to by the cardId values in the context.',
  'Element types: text, button, input, image, shape, line, each with the matching properties.',
  'Use at most 20 commands. Do not include any text outside the JSON object.',
].join(' ');

/** The user message: the permitted project context plus the creator's request. */
export const userMessage = (context: ProjectContext, prompt: string): string =>
  `Project context (JSON):\n${JSON.stringify(context)}\n\nRequest:\n${prompt}`;
