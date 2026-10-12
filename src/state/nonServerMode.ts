import { createContext, useContext } from "react";
/** Entry selection only; never creates an account, identity or server session. */
export const NonServerModeContext = createContext<(() => void) | undefined>(undefined);
export const useNonServerMode = () => useContext(NonServerModeContext);
