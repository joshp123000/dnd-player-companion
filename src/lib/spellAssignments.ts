export const alwaysPreparedPatch = (alwaysPrepared: boolean) => alwaysPrepared
  ? { always_prepared: true, is_prepared: true }
  : { always_prepared: false }
