import { supabase } from "./supabase";
export function setupVelvetBridge(
  gameId: string,
  iframe: HTMLIFrameElement,
  onBalance: (n: number) => void,
  onError: (s: string) => void,
) {
  let disposed = false;
  let running = false;
  const cache = new Map<string, unknown>();
  const listener = async (event: MessageEvent) => {
    if (
      event.source !== iframe.contentWindow ||
      event.origin !== window.location.origin ||
      event.data?.type !== "VELVET_REQUEST"
    )
      return;
    const { requestId, action, stake, bets, index, version } = event.data;
    if (
      typeof requestId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(requestId) ||
      !["init", "spin", "pick", "deal", "hit", "stand", "double", "split"].includes(action)
    )
      return;
    const reply = (value: object) => {
      if (!disposed)
        iframe.contentWindow?.postMessage(
          { type: "VELVET_RESULT", requestId, ...value },
          window.location.origin,
        );
    };
    if (cache.has(requestId)) {
      reply({ payload: cache.get(requestId) });
      return;
    }
    if (running) {
      reply({ error: "A round is already processing. Please wait." });
      return;
    }
    running = true;
    try {
      let payload: Record<string, unknown> | undefined;
      let failure: unknown;
      // Retry transport failures with the SAME request ID; settlement is idempotent.
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await supabase.functions.invoke("velvet-round", {
          body: { gameId, requestId, action, stake, bets, index, version },
        });
        if (!error) {
          payload = data;
          break;
        }
        failure = error;
        if (error.context instanceof Response) {
          const detail = await error.context.json().catch(() => null);
          throw new Error(detail?.error || "Round rejected");
        }
      }
      if (!payload) throw failure instanceof Error ? failure : new Error("Round unavailable");
      if (payload["error"]) throw new Error(String(payload["error"]));
      cache.set(requestId, payload);
      if (cache.size > 100) cache.delete(cache.keys().next().value!);
      onBalance(Number(payload["balanceAfter"]));
      reply({ payload });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Game service unavailable";
      onError(message);
      reply({ error: message });
    } finally {
      running = false;
    }
  };
  window.addEventListener("message", listener);
  return () => {
    disposed = true;
    window.removeEventListener("message", listener);
  };
}
