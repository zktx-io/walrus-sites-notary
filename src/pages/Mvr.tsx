import { fromBase64 } from '@mysten/sui/utils';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { MvrGitInfo } from '../components/MvrGitInfo';
import { MvrMetaData } from '../components/MvrMetaData';
import { MvrReadMe } from '../components/MvrReadMe';
import { Navbar } from '../components/Navbar';
import { ProvenanceCard } from '../components/ProvenanceCard';
import { getMvrData, MvrData } from '../utils/getMvrData';
import { JsonLPayload, parseJsonl } from '../utils/parseJsonl';
import { truncateMiddle } from '../utils/truncateMiddle';
import { verifyBytecode } from '../utils/verifyBytecode';

export const Mvr = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [loading, setLoading] = useState(true);
  const [provenance, setProvenance] = useState<JsonLPayload | undefined>(
    undefined,
  );
  const [mvrData, setMvrData] = useState<MvrData>({});
  const [isVerified, setIsVerified] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setProvenance(undefined);

    if (!query) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const mvrData = await getMvrData(query);
        setMvrData(mvrData.mvr);
        if (mvrData.provenance && mvrData.digest) {
          const jsonl = parseJsonl(
            new TextDecoder().decode(fromBase64(mvrData.provenance)),
          );
          setProvenance(jsonl);
          const verified = await verifyBytecode(mvrData.digest, jsonl);
          setIsVerified(verified);
        } else {
          setProvenance(undefined);
        }
      } catch {
        setProvenance(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query]);

  return (
    <div className="relative min-h-screen text-white overflow-hidden bg-[#0b0d14]">
      <BackgroundFx />
      <Navbar showInput={true} />

      {query ? (
        <div className="flex justify-center items-center px-4 pt-[88px] pb-12">
          <div className="z-10 max-w-4xl w-full">
            {loading ? (
              <div className="min-h-[calc(100vh-88px)] flex items-center justify-center">
                <p>Loading...</p>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold mb-4 text-center">
                  <div>Verification Result for</div>
                  <div className="text-green-400">
                    {truncateMiddle(query, 20)}
                  </div>
                </h1>

                <ProvenanceCard
                  provenance={provenance}
                  isFullyVerified={isVerified}
                />
                <MvrGitInfo mvrData={mvrData} />
                <MvrMetaData mvrData={mvrData} />
                <MvrReadMe mvrData={mvrData} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0d14] text-white px-4">
          <p className="text-red-500 text-lg font-semibold">
            Missing MVR Name.
          </p>
        </div>
      )}
    </div>
  );
};
