import { createCard, createStack, isValid, validateProject } from '@ghoststack/domain';
import type { Card, Stack } from '@ghoststack/domain';
import { createMemoryStorage } from '@ghoststack/storage';
import { render, screen, within } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ServicesProvider } from '../../app/services';
import { createTestServices } from '../../test/fakes';
import { StackWorkspace } from './StackWorkspace';

const arbCardTitle = fc.stringMatching(/^[A-Za-z0-9]{1,12}$/);

// A valid Stack whose cardOrder is a random permutation of its cards.
const arbStack: fc.Arbitrary<Stack> = fc
  .array(arbCardTitle, { minLength: 1, maxLength: 8 })
  .chain((titles) => {
    const cards: Card[] = titles.map((title) => {
      const card = createCard(title);
      if (!card.ok) throw new Error('card seed failed');
      return card.value;
    });
    const ids = cards.map((card) => card.cardId);
    return fc
      .shuffledSubarray(ids, { minLength: ids.length, maxLength: ids.length })
      .map((order) => {
        const created = createStack('Quiz');
        if (!created.ok) throw new Error('stack seed failed');
        return {
          ...created.value,
          cards: Object.fromEntries(cards.map((card) => [card.cardId, card])),
          entryCardId: ids[0] ?? '',
          cardOrder: order,
        };
      });
  });

describe('Property 13: Card navigator follows cardOrder', () => {
  /**
   * **Validates: Requirements 13.1**
   */
  it('renders one item per Card with titles in cardOrder order', async () => {
    await fc.assert(
      fc.asyncProperty(arbStack, async (stack) => {
        expect(isValid(validateProject(stack))).toBe(true);
        const storage = createMemoryStorage();
        await storage.saveProject({ stack, assets: {} });
        const view = render(
          <ServicesProvider services={createTestServices({ storage })}>
            <StackWorkspace stackId={stack.stackId} onClose={() => undefined} />
          </ServicesProvider>,
        );
        try {
          const nav = await screen.findByRole('navigation', { name: 'Cards' });
          const items = within(nav).getAllByRole('listitem');
          expect(items.map((item) => item.textContent)).toEqual(
            stack.cardOrder.map((id) => stack.cards[id]?.title),
          );
        } finally {
          view.unmount();
        }
      }),
      { numRuns: 25 },
    );
  });
});
