import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const LogContext = createContext(null);

export function LogProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const nextId = useRef(0);

  const log = useCallback((text, tone = 'info', detail = '', at = Date.now()) => {
    const entry = { id: nextId.current++, at, text, tone, detail };
    setEntries((current) => {
      const next = (!current.length || entry.at >= current[0].at)
        ? [entry, ...current]
        : [entry, ...current].sort((a, b) => b.at - a.at);
      if (next.length > 80) next.length = 80;
      return next;
    });
  }, []);
  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo(() => ({ entries, log, clear }), [entries, log, clear]);
  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLog() {
  return useContext(LogContext);
}
