import { fromBase64 } from '@mysten/sui/utils';

export interface JsonLPayload {
  _type: 'https://in-toto.io/Statement/v0.1';
  predicateType: 'https://slsa.dev/provenance/v0.2';
  subject: {
    name: string;
    digest: {
      sha256: string;
    };
  }[];
  predicate: {
    builder: {
      id: string;
    };
    buildType: string;
    invocation: {
      configSource: {
        uri: string;
        digest: {
          sha1: string;
        };
        entryPoint: string;
      };
      parameters?: Record<string, unknown>;
      environment?: {
        github_actor?: string;
        github_actor_id?: string;
        github_base_ref?: string;
        github_event_name?: string;
        github_ref?: string;
        github_repository?: string;
        github_repository_owner?: string;
        github_repository_id?: string;
        github_run_id?: string;
        github_run_number?: string;
        github_sha1?: string;
        [key: string]: unknown;
      };
    };
    metadata?: {
      buildInvocationID?: string;
      completeness?: {
        parameters: boolean;
        environment: boolean;
        materials: boolean;
      };
      reproducible?: boolean;
    };
    materials?: {
      uri: string;
      digest: {
        sha1: string;
      };
    }[];
  };
  signatures: Array<{
    keyid: string;
    sig: string;
  }>;
  tlogEntries?: Array<{
    logIndex: number;
    logID: { keyid: string };
    integratedTime: number;
    [key: string]: unknown;
  }>;
}

export const parseJsonl = (jsonl: string): JsonLPayload => {
  try {
    const parsed = JSON.parse(
      jsonl
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F]+/g, '')
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F]/g, '')
        .trim(),
    );
    const payload = new TextDecoder().decode(
      fromBase64(parsed.dsseEnvelope.payload),
    );
    return {
      ...JSON.parse(payload),
      signatures: parsed.dsseEnvelope.signatures,
      tlogEntries: parsed.verificationMaterial.tlogEntries,
    } as JsonLPayload;
  } catch (error) {
    throw new Error(`Failed to parse JSONL: ${error}`);
  }
};
