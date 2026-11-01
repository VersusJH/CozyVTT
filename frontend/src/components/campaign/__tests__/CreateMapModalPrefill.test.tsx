/**
 * What Create Map fills in from the picked image.
 *
 * The name started empty. Now it comes from the image's name until the DM
 * types one: "goblin-cave_v2.webp" names the map "goblin cave v2".
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Asset } from '@/types';
import { detectMapGrid } from '@/utils/detectMapGrid';

vi.mock('@/services/api', () => {
  const client = { getAssetUrl: (id: string) => `/api/assets/maps/${id}` };
  return { api: client, default: client };
});
vi.mock('@/services/map.service', () => ({ default: { createMap: vi.fn() } }));
vi.mock('@/utils/detectMapGrid', () => ({ detectMapGrid: vi.fn() }));
vi.mock('@/components/assets/AssetPicker', () => ({
  default: ({ label, onSelect }: { label: string; onSelect: (a: Asset | null) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect({ id: 'cave', name: 'goblin-cave_v2.webp' } as Asset)}>{`Pick cave as ${label}`}</button>
      <button type="button" onClick={() => onSelect({ id: 'crypt', name: 'Old Crypt' } as Asset)}>{`Pick crypt as ${label}`}</button>
    </div>
  ),
}));

import CreateMapModal from '../CreateMapModal';

beforeAll(() => {
  // The preview draws on a canvas, which the test page does not have.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null, configurable: true });
});

beforeEach(() => {
  vi.mocked(detectMapGrid).mockResolvedValue(null);
});

const open = () => render(<CreateMapModal isOpen campaignId="campaign-1" onClose={vi.fn()} onCreated={vi.fn()} />);
const nameInput = () => screen.getByPlaceholderText('e.g. Tavern Interior, World Map...') as HTMLInputElement;

// Picks the map image and waits until the dialog has read it.
const pick = async (image: 'cave' | 'crypt') => {
  fireEvent.click(screen.getByText(`Pick ${image} as Map Image`));
  await waitFor(() => expect(screen.queryByText('Analysing…')).toBeNull());
};

describe('Create Map → the map name', () => {
  it('is the image name, without its extension and with dashes and underscores as spaces', async () => {
    open();
    await pick('cave');
    expect(nameInput().value).toBe('goblin cave v2');
  });

  it('follows the image while the DM has not changed it', async () => {
    open();
    await pick('cave');
    await pick('crypt');
    expect(nameInput().value).toBe('Old Crypt');
  });

  it('is never replaced once the DM has typed one', async () => {
    open();
    fireEvent.change(nameInput(), { target: { value: 'The Drowned Crown' } });
    await pick('cave');
    expect(nameInput().value).toBe('The Drowned Crown');
  });
});
