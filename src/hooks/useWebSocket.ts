import { useEffect, useRef, useState } from "react";

export type WebSocketState = "connecting" | "connected" | "disconnected";
export type MessageListener = (msg: MessageEvent) => void;

export type UseWebSocketResult = {
  addMessageListener: (fn: MessageListener) => void,
  removeMessageListener: (fn: MessageListener) => void,
  connected: boolean
};

export default function useWebSocket({url, reconnectDelay=2000}: {url: string, reconnectDelay?: number}): UseWebSocketResult {
  const interval = useRef(null as number | null);
  const ws = useRef(null as WebSocket | null);
  const state = useRef("disconnected" as WebSocketState);
  const listeners = useRef([] as Array<any>);
  const [connected, setConnected] = useState(false);

  const addMessageListener = (fn: MessageListener) => {
    listeners.current.push(fn);
  };

  const removeMessageListener = (fn: MessageListener) => {
    const idx = listeners.current.indexOf(fn);
    if (idx < 0) {
      throw new Error("Provided function is not attached as a listener");
    }
    listeners.current.splice(idx, 1);
  };

  const reconnect = () => {
    ws.current = new WebSocket(url);
    ws.current.onopen = () => {
      state.current = "connected";
      setConnected(true);
    };
    ws.current.onclose = () => {
      state.current = "disconnected";
      setConnected(false);
    };
    ws.current.onmessage = (msg) => {
      listeners.current.forEach((listener) => listener(msg));
    };
    ws.current.onerror = (error) => {
      console.error("WebSocket error: ");
      console.error(error);
    };
  };

  useEffect(() => {
    if (connected) {
      if (interval.current !== null) {
        window.clearInterval(interval.current);
        interval.current = null;
      }
    } else {
      if (interval.current === null) {
        interval.current = window.setInterval(() => {
          if (state.current === "disconnected") {
            state.current = "connecting";
            reconnect();
          }
        }, reconnectDelay);
      }
    }
  }, [connected, reconnectDelay]);
  
  useEffect(() => reconnect(), [url]);
  
  return {
    addMessageListener,
    removeMessageListener,
    connected
  };
}
