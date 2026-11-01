/**
 * What Create Map fills in from the picked image.
 *
 * The name started empty. Now it comes from the image's name until the DM
 * types one: "goblin-cave_v2.webp" names the map "goblin cave v2".
 *
 * The size started at 20 × 20 squares whatever the image, so the preview
 * squashed a wide picture into a square. Now the height keeps the image's
 * proportions until the DM types one or applies a detected grid.
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

// Every picture is 10 by 7, so 20 squares wide is 14 high.
class FakeImage {
  naturalWidth = 1000;
  naturalHeight = 700;
  onload: (() => void) | null = null;
  set src(_url: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeAll(() => {
  // The preview draws on a canvas, which the test page does not have.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null, configurable: true });
  vi.stubGlobal('Image', FakeImage);
});

beforeEach(() => {
  vi.mocked(detectMapGrid).mockResolvedValue(null);
});

const open = () => render(<CreateMapModal isOpen campaignId="campaign-1" onClose={vi.fn()} onCreated={vi.fn()} />);
const nameInput = () => screen.getByPlaceholderText('e.g. Tavern Interior, World Map...') as HTMLInputElement;
const slider = (label: string) => screen.getByLabelText(`${label} (grid squares) slider`) as HTMLInputElement;

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

describe('Create Map → the map height', () => {
  it('keeps the image proportions at the width', async () => {
    open();
    await pick('cave');
    expect(slider('Height').value).toBe('14');
    fireEvent.change(slider('Width'), { target: { value: '30' } });
    expect(slider('Height').value).toBe('21');
  });

  it('stays where the DM put it', async () => {
    open();
    fireEvent.change(slider('Height'), { target: { value: '9' } });
    await pick('cave');
    expect(slider('Height').value).toBe('9');
  });

  it('is the detected grid once the DM applies it', async () => {
    vi.mocked(detectMapGrid).mockResolvedValue({ gridSize: 70, width: 24, height: 16, confidence: 0.9 });
    open();
    await pick('cave');
    fireEvent.click(screen.getByText('Apply'));
    expect(slider('Width').value).toBe('24');
    // The image's proportions would make it 17.
    expect(slider('Height').value).toBe('16');
  });
});
