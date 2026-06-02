import type { AlbumCacheEntry } from './types.js';

export interface ImmichClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

interface RawImmichAlbum {
  id?: unknown;
  albumName?: unknown;
  assetCount?: unknown;
  albumThumbnailAssetId?: unknown;
}

export class ImmichClient {
  constructor(private readonly config: ImmichClientConfig) {}

  async checkConnection(): Promise<{ ok: boolean; message?: string }> {
    if (!this.config.baseUrl || !this.config.apiKey) {
      return { ok: false, message: 'Immich URL or API key is not configured.' };
    }

    try {
      const response = await this.fetch('/api/users/me');
      if (!response.ok) return { ok: false, message: `Immich returned ${response.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async listAlbums(): Promise<AlbumCacheEntry[]> {
    const response = await this.fetch('/api/albums');
    if (!response.ok) {
      const body = await readBodySafe(response);
      throw new Error(body ? `Immich album list failed: ${response.status} (${body})` : `Immich album list failed: ${response.status}`);
    }

    const data = await response.json() as RawImmichAlbum[];
    const updatedAt = new Date().toISOString();
    return data
      .map((album): AlbumCacheEntry | null => {
        if (typeof album.id !== 'string' || typeof album.albumName !== 'string') return null;
        return {
          id: album.id,
          albumName: album.albumName,
          assetCount: typeof album.assetCount === 'number' ? album.assetCount : undefined,
          thumbnailAssetId: typeof album.albumThumbnailAssetId === 'string' ? album.albumThumbnailAssetId : undefined,
          updatedAt,
        };
      })
      .filter((album): album is AlbumCacheEntry => album !== null);
  }

  private async fetch(path: string): Promise<Response> {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('Immich URL or API key is not configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000);
    try {
      return await fetch(`${this.config.baseUrl}${path}`, {
        headers: {
          Accept: 'application/json',
          'x-api-key': this.config.apiKey,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readBodySafe(response: Response): Promise<string | undefined> {
  try {
    const text = (await response.text()).trim();
    return text ? text.slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

