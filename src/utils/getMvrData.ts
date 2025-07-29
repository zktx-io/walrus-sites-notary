import { fromBase64 } from '@mysten/sui/utils';

export interface MvrData {
  git_info?: {
    path: string;
    repository_url: string;
    tag: string;
  };
  metadata?: {
    contact?: string;
    description?: string;
    documentation_url?: string;
    homepage_url?: string;
    icon_url?: string;
  };
  package_info?: {
    id: string;
    git_table_id: string;
    default_name?: string;
    metadata: { [key: string]: string | undefined };
  };
}

const joinChunks = (prefix: string, metadata: Record<string, string>) => {
  const chunks = Object.entries(metadata)
    .filter(([key]) => key.startsWith(prefix))
    .sort(([a], [b]) => {
      const aIndex = parseInt(a.split('_')[1], 10);
      const bIndex = parseInt(b.split('_')[1], 10);
      return aIndex - bIndex;
    })
    .map(([, value]) => value);

  return chunks.length > 0 ? chunks.join('') : undefined;
};

export const getMvrData = async (
  name: string,
): Promise<{
  mvr: MvrData;
  packageAddress: string;
  provenance?: string;
  params?: {
    [pkg: string]: { name: string; params: { name: string; type: string }[] }[];
  };
  digest?: string;
}> => {
  const response = await fetch(
    `https://mainnet.mvr.mystenlabs.com/v1/names/${name}`,
    {
      method: 'GET',
    },
  );
  const json = await response.json();
  const packageAddress = json.package_address;

  const provenance = joinChunks(
    'prov_jsonl_',
    json.package_info.metadata || {},
  );
  const params = joinChunks('prov_params_', json.package_info.metadata || {});
  const metadata: MvrData['metadata'] = Object.fromEntries(
    Object.entries(json.metadata || {}).map(([k, v]) => [
      k,
      typeof v === 'string' ? v : String(v),
    ]),
  );

  const cleaned: MvrData = {
    git_info: json.git_info,
    metadata,
    package_info: json.package_info,
  };

  return {
    mvr: cleaned,
    provenance,
    params: params
      ? JSON.parse(new TextDecoder().decode(fromBase64(params)))
      : undefined,
    digest: json.package_info.metadata.prov_tx || undefined,
    packageAddress,
  };
};
