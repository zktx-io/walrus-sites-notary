// src/config/loadSiteConfig.ts

interface SiteConfig {
  network: 'mainnet' | 'testnet';
  owner: string;
  site_name: string;
  metadata?: {
    link: string;
    image_url: string;
    name: string;
    description: string;
    project_url: string;
    creator: string;
  };
  epochs: number;
  path: string;
  gas_budget: number;
  write_retry_limit: number;
  object_id: string;
}

let cachedConfig: SiteConfig | null = null;

export const loadSiteConfig = async (): Promise<SiteConfig | null> => {
  try {
    if (cachedConfig) return cachedConfig;

    const res = await fetch('/.well-known/site.config.json');
    if (!res.ok) {
      return null;
    }
    cachedConfig = await res.json();
    return cachedConfig;
  } catch {
    return null;
  }
};
