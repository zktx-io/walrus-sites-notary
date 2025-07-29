import { AlertTriangle, Play, Wrench } from 'lucide-react';
import { useState } from 'react';

const SUPPORTED_TYPES = [
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'u256',
  'Bool',
  'Address',
  'string::String',
];

export const MoveCallForm = ({
  fn,
  onExcute,
  isRunning,
}: {
  fn: { name: string; params: { name: string; type: string }[] };
  onExcute: (params: { type: string; value: string }[]) => void;
  isRunning: boolean;
}) => {
  const [values, setValues] = useState<{ type: string; value: string }[]>([]);

  const handleChange = (index: number, type: string, value: string) => {
    const newValues = [...values];
    newValues[index] = { type, value };
    setValues(newValues);
  };

  const filteredParams = fn.params.filter(
    (p) => p.name !== 'ctx' && p.type !== '&mut TxContext',
  );

  const hasUnsupportedType = filteredParams.some(
    (p) => !SUPPORTED_TYPES.includes(p.type),
  );

  return (
    <div className="p-4 bg-white/10 rounded-md border border-white/10">
      <h3 className="font-medium text-white text-sm flex items-center gap-2 mb-2">
        <Wrench className="w-3 h-3 text-white" />
        {`${fn.name}(${fn.params
          .map((p) => `${p.name}: ${p.type}`)
          .join(', ')})`}
      </h3>

      <table className="w-full text-sm text-left text-gray-300">
        <tbody>
          {filteredParams.map((p, i) => {
            const isSupported = SUPPORTED_TYPES.includes(p.type);
            return (
              <tr key={p.name}>
                <td className="py-1 pr-2 whitespace-nowrap font-medium w-[120px] text-xs align-middle">
                  {p.name}
                </td>
                <td className="py-1 w-full align-middle">
                  <input
                    type="text"
                    value={values[i] ? values[i].value : ''}
                    onChange={(e) => handleChange(i, p.type, e.target.value)}
                    className={`w-full h-8 px-2 py-1 rounded-md text-sm ${
                      isSupported
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                    placeholder={p.type}
                    disabled={!isSupported}
                  />
                  {!isSupported && (
                    <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Unsupported type. This input is disabled.
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end mt-4">
        <button
          onClick={() => onExcute(values)}
          disabled={isRunning || hasUnsupportedType}
          className={`flex items-center gap-1 text-sm px-3 py-1 rounded-md text-white
    ${
      isRunning || hasUnsupportedType
        ? 'bg-green-600 opacity-50'
        : 'bg-green-600 hover:bg-green-700'
    }
  `}
        >
          <Play className="w-4 h-4" />
          Run
        </button>
      </div>
    </div>
  );
};
