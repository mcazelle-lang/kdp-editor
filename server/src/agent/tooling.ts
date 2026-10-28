import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type { z } from 'zod';
import { uid } from '@shared';

type ToolEvent =
  | { type: 'tool'; id: string; name: string; label: string }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; message: string };

/**
 * Outil exécutable par le tool runner : entrée validée par Zod avant run(), diffusée au fil de l'eau
 * (eager_input_streaming), début et fin signalés à l'interface. Une erreur levée revient à Claude en is_error.
 */
export function makeTool<S extends z.ZodType>(
  emit: (e: ToolEvent) => void,
  name: string,
  label: string,
  description: string,
  inputSchema: S,
  run: (input: z.infer<S>) => Promise<unknown> | unknown,
): BetaRunnableTool<z.infer<S>> {
  const tool = betaZodTool({
    name,
    description,
    inputSchema,
    run: async (input, runCtx) => {
      const id = runCtx?.toolUse.id ?? uid('t');
      emit({ type: 'tool', id, name, label });
      try {
        const result = await run(input);
        emit({ type: 'tool_result', id, name, ok: true, message: label });
        return JSON.stringify(result);
      } catch (e) {
        emit({ type: 'tool_result', id, name, ok: false, message: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },
  });
  return Object.assign(tool, { eager_input_streaming: true });
}
