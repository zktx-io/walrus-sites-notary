import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { OwnedBlob } from '../utils/getSiteResources';

export function ExtendBlobsLauncher({
  resources,
  blobs,
  currentEpoch,
  onExtend,
  sender,
}: {
  resources: { id: string; path: string; blobId: string; blobHash: string }[];
  blobs: Record<string, OwnedBlob>;
  currentEpoch: number;
  onExtend: (opts: {
    sender: string;
    objectIds: string[];
    epochs: number;
  }) => Promise<void>;
  sender: string;
}) {
  const [open, setOpen] = useState(false);
  const [epochs, setEpochs] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    const map = new Map<
      string,
      { blobId: string; objectId?: string; endEpoch?: number | null }
    >();
    for (const r of resources) {
      if (!map.has(r.blobId)) {
        const b = blobs[r.blobId];
        map.set(r.blobId, {
          blobId: r.blobId,
          objectId: b?.objectId,
          endEpoch: b?.endEpoch ?? null,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ra =
        typeof a.endEpoch === 'number'
          ? Math.max(0, a.endEpoch - currentEpoch)
          : Number.POSITIVE_INFINITY;
      const rb =
        typeof b.endEpoch === 'number'
          ? Math.max(0, b.endEpoch - currentEpoch)
          : Number.POSITIVE_INFINITY;
      return ra - rb;
    });
  }, [resources, blobs, currentEpoch]);

  const allSelectable = useMemo(() => items.filter((i) => i.objectId), [items]);
  const selectedIds = allSelectable
    .map((i) => i.objectId!)
    .filter((oid) => selected[oid]);

  const disabled = allSelectable.length === 0;

  const toggle = (oid: string) =>
    setSelected((s) => ({ ...s, [oid]: !s[oid] }));

  const submit = async () => {
    if (!epochs || selectedIds.length === 0) return;
    try {
      setBusy(true);
      await onExtend({ sender, objectIds: selectedIds, epochs });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelected({});
      setEpochs(10);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? 'No extendable blobs found' : 'Extend epochs'}
          className={[
            'text-sm px-2.5 py-1.5 rounded bg-green-600',
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-green-500 cursor-pointer',
          ].join(' ')}
        >
          Extend blobs
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-1001" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1002 w-[min(92vw,700px)] bg-[#0b0d14] border border-white/10 p-4 rounded-xl shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <Dialog.Title className="text-lg font-semibold text-white">
              Extend Blob Epochs
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 hover:bg-white/10 rounded"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="h-[320px] overflow-y-auto rounded border border-white/10">
            <table className="w-full text-sm table-fixed">
              <thead className="text-gray-400 border-b border-white/10 sticky top-0 bg-[#0b0d14]">
                <tr>
                  <th className="text-left py-2 px-3 w-16">Select</th>
                  <th className="text-left py-2 px-3 w-[48%]">Object ID</th>
                  <th className="text-left py-2 px-3 w-[36%]">Blob ID</th>
                  <th className="text-right py-2 px-3 w-[16%]">Epochs</th>
                </tr>
              </thead>
              <tbody>
                {allSelectable.map((it) => {
                  const remaining =
                    typeof it.endEpoch === 'number'
                      ? Math.max(0, it.endEpoch - currentEpoch)
                      : undefined;
                  const oid = it.objectId!;
                  return (
                    <tr key={oid} className="border-b border-white/5">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={!!selected[oid]}
                          onChange={() => toggle(oid)}
                        />
                      </td>

                      <td className="py-2 px-3">
                        <div
                          className="font-mono max-w-[280px] truncate"
                          title={oid}
                        >
                          {oid}
                        </div>
                      </td>

                      <td className="py-2 px-3">
                        <div
                          className="font-mono max-w-[220px] truncate"
                          title={it.blobId}
                        >
                          {it.blobId}
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right">
                        {remaining === undefined ? '-' : `${remaining} lefts`}
                      </td>
                    </tr>
                  );
                })}
                {allSelectable.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">
                      No extendable blobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1" />
            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <span className="shrink-0">Extend</span>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={1}
                    max={999}
                    className="w-28 pr-14 bg-black/30 border border-white/10 rounded px-3 py-1.5 text-white"
                    value={epochs}
                    onChange={(e) => {
                      const n = Math.floor(Number(e.target.value));
                      setEpochs(
                        Number.isFinite(n) ? Math.max(1, Math.min(999, n)) : 1,
                      );
                    }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    aria-label="Epochs to extend"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-gray-400">
                    {'epoch' + (epochs > 1 ? 's' : '')}
                  </span>
                </div>
              </label>

              <button
                className="ml-auto px-3 py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50"
                onClick={submit}
                disabled={busy || selectedIds.length === 0 || epochs < 1}
                title={
                  selectedIds.length === 0
                    ? 'Select at least one blob'
                    : undefined
                }
              >
                {busy ? 'Extending…' : `Extend ${selectedIds.length} blob(s)`}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
