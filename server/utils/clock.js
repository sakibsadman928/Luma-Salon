// Injectable clock. Production always uses the real time; tests may override it.
let override = null;
export const now = () => (override ? override() : new Date());
export const setClock = (fn) => { override = fn; };
export const resetClock = () => { override = null; };
