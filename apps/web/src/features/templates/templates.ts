import type { ActionNode } from '@ghoststack/shared-contracts';
import { bin, buildWith, lit, st } from './build';
import type { StackBuilder, TemplateDefinition, TemplateInput } from './build';

const TITLE = { x: 80, y: 60, width: 1120, height: 70 };
const BODY = { x: 80, y: 150, width: 1120, height: 110 };
const heading = { fontSize: 40, fontWeight: 'bold' } as const;
const body = { fontSize: 22 } as const;
const button = (x: number, y: number, width = 260) => ({ x, y, width, height: 56 });

function blank(input: TemplateInput) {
  return buildWith(input, () => undefined);
}

function quiz(input: TemplateInput) {
  return buildWith(input, (b) => {
    const start = b.card('Start', true);
    const question = b.card('Question');
    const correct = b.card('Correct');
    const retry = b.card('Try again');

    b.element(start, 'text', 'Title', TITLE, { text: 'Branching quiz', ...heading });
    b.element(start, 'text', 'Intro', BODY, {
      text: 'Answer one question. Your answer decides which card comes next.',
      ...body,
    });
    const begin = b.element(start, 'button', 'Begin button', button(80, 300), { text: 'Begin' });
    b.behavior(start, begin, 'element.click', [{ type: 'navigate', cardId: question }]);

    b.element(question, 'text', 'Question', TITLE, {
      text: 'Which city is the capital of France?',
      ...heading,
    });
    const right = b.element(question, 'button', 'Right answer', button(80, 200), { text: 'Paris' });
    const wrong = b.element(question, 'button', 'Wrong answer', button(80, 280), { text: 'Lyon' });
    b.behavior(question, right, 'element.click', [{ type: 'navigate', cardId: correct }]);
    b.behavior(question, wrong, 'element.click', [{ type: 'navigate', cardId: retry }]);

    b.element(correct, 'text', 'Result', TITLE, { text: 'Correct. Paris is the capital.', ...heading });
    const again = b.element(correct, 'button', 'Play again', button(80, 200), { text: 'Play again' });
    b.behavior(correct, again, 'element.click', [{ type: 'navigate', cardId: start }]);

    b.element(retry, 'text', 'Result', TITLE, { text: 'Not quite.', ...heading });
    const back = b.element(retry, 'button', 'Try again button', button(80, 200), { text: 'Try again' });
    b.behavior(retry, back, 'element.click', [{ type: 'navigate', cardId: question }]);
  });
}

function guide(input: TemplateInput) {
  return buildWith(input, (b) => {
    const welcome = b.card('Welcome', true);
    const one = b.card('Step 1');
    const two = b.card('Step 2');
    const done = b.card('Done');
    const steps: [string, string, string][] = [
      [welcome, 'Welcome', 'This guide has two steps. Use the buttons to move between them.'],
      [one, 'Step 1', 'Describe the first thing the reader should do.'],
      [two, 'Step 2', 'Describe the second thing the reader should do.'],
      [done, 'Done', 'You reached the end.'],
    ];
    steps.forEach(([cardId, title, text], i) => {
      b.element(cardId, 'text', 'Title', TITLE, { text: title, ...heading });
      b.element(cardId, 'text', 'Text', BODY, { text, ...body });
      if (i > 0) {
        const prev = b.element(cardId, 'button', 'Back button', button(80, 300, 160), { text: 'Back' });
        b.behavior(cardId, prev, 'element.click', [{ type: 'prevCard' }]);
      }
      if (i < steps.length - 1) {
        const next = b.element(cardId, 'button', 'Next button', button(i > 0 ? 260 : 80, 300, 160), {
          text: i === 0 ? 'Start' : 'Next',
        });
        b.behavior(cardId, next, 'element.click', [{ type: 'nextCard' }]);
      } else {
        const again = b.element(cardId, 'button', 'Start over', button(260, 300, 200), {
          text: 'Start over',
        });
        b.behavior(cardId, again, 'element.click', [{ type: 'navigate', cardId: welcome }]);
      }
    });
  });
}

/** Rewrites the shown list: a placeholder when empty, else one item per line. */
function refresh(listElement: string, key: string, placeholder: string): ActionNode {
  return {
    type: 'if',
    condition: bin('==', { kind: 'listLength', key }, lit(0)),
    then: [{ type: 'setText', elementId: listElement, value: lit(placeholder) }],
    else: [{ type: 'setText', elementId: listElement, value: { kind: 'listJoin', key, separator: '\n' } }],
  };
}

interface ListCard {
  cardId: string;
  title: string;
  /** List variable. */
  key: string;
  /** String variable that receives what the creator types. */
  draftKey: string;
  placeholder: string;
  inputPlaceholder: string;
  addLabel: string;
}

/** A card with an input, add, remove-last and clear buttons and a text that shows the list. */
function listCard(b: StackBuilder, c: ListCard): void {
  b.element(c.cardId, 'text', 'Title', TITLE, { text: c.title, ...heading });
  b.element(
    c.cardId,
    'input',
    'New entry',
    { x: 80, y: 150, width: 520, height: 48 },
    {
      placeholder: c.inputPlaceholder,
      stateKey: c.draftKey,
      fontSize: 18,
    },
  );
  const add = b.element(c.cardId, 'button', 'Add button', button(620, 146, 200), { text: c.addLabel });
  const shown = b.element(
    c.cardId,
    'text',
    'List',
    { x: 80, y: 230, width: 520, height: 380 },
    {
      text: c.placeholder,
      fontSize: 22,
    },
  );
  const removeLast = b.element(c.cardId, 'button', 'Remove last button', button(620, 230, 200), {
    text: 'Remove last',
  });
  const clear = b.element(c.cardId, 'button', 'Clear button', button(620, 306, 200), { text: 'Clear all' });
  const show = refresh(shown, c.key, c.placeholder);
  b.behavior(c.cardId, undefined, 'card.enter', [show]);
  b.behavior(c.cardId, add, 'element.click', [
    {
      type: 'if',
      condition: bin('!=', st(c.draftKey), lit('')),
      then: [{ type: 'listAdd', key: c.key, value: st(c.draftKey) }, show],
      else: [],
    },
  ]);
  b.behavior(c.cardId, removeLast, 'element.click', [
    {
      type: 'if',
      condition: bin('!=', { kind: 'listLength', key: c.key }, lit(0)),
      then: [
        {
          type: 'listRemove',
          key: c.key,
          index: bin('-', { kind: 'listLength', key: c.key }, lit(1)),
        },
        show,
      ],
      else: [],
    },
  ]);
  b.behavior(c.cardId, clear, 'element.click', [{ type: 'listClear', key: c.key }, show]);
}

function inventory(input: TemplateInput) {
  return buildWith(input, (b) => {
    const card = b.card('Inventory', true);
    b.state({
      items: { type: 'list', initial: [] },
      newItem: { type: 'string', initial: '' },
    });
    listCard(b, {
      cardId: card,
      title: 'Inventory',
      key: 'items',
      draftKey: 'newItem',
      placeholder: 'No items yet.',
      inputPlaceholder: 'Item name',
      addLabel: 'Add item',
    });
  });
}

function recipes(input: TemplateInput) {
  return buildWith(input, (b) => {
    const collection = b.card('Recipes', true);
    const ingredients = b.card('Ingredients');
    b.state({
      recipes: { type: 'list', initial: [] },
      newRecipe: { type: 'string', initial: '' },
      ingredients: { type: 'list', initial: [] },
      newIngredient: { type: 'string', initial: '' },
    });
    listCard(b, {
      cardId: collection,
      title: 'Recipe collection',
      key: 'recipes',
      draftKey: 'newRecipe',
      placeholder: 'No recipes yet.',
      inputPlaceholder: 'Recipe name',
      addLabel: 'Add recipe',
    });
    const toIngredients = b.element(collection, 'button', 'Ingredients button', button(620, 382, 200), {
      text: 'Ingredients',
    });
    b.behavior(collection, toIngredients, 'element.click', [{ type: 'navigate', cardId: ingredients }]);
    listCard(b, {
      cardId: ingredients,
      title: 'Ingredients',
      key: 'ingredients',
      draftKey: 'newIngredient',
      placeholder: 'No ingredients yet.',
      inputPlaceholder: 'Ingredient',
      addLabel: 'Add ingredient',
    });
    const toRecipes = b.element(ingredients, 'button', 'Recipes button', button(620, 382, 200), {
      text: 'Back to recipes',
    });
    b.behavior(ingredients, toRecipes, 'element.click', [{ type: 'navigate', cardId: collection }]);
  });
}

export const TEMPLATES: readonly TemplateDefinition[] = [
  { id: 'blank', name: 'Blank', description: 'One empty card.', build: blank },
  {
    id: 'quiz',
    name: 'Branching quiz',
    description: 'A start card, a question, and a right or wrong result.',
    build: quiz,
  },
  {
    id: 'recipes',
    name: 'Recipe collection',
    description: 'Add and remove recipes and ingredients in two lists.',
    build: recipes,
  },
  {
    id: 'inventory',
    name: 'Inventory list',
    description: 'Type an item, add it to a list, remove the last one.',
    build: inventory,
  },
  {
    id: 'guide',
    name: 'Interactive guide',
    description: 'Four cards with Back and Next buttons.',
    build: guide,
  },
];

export function findTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
