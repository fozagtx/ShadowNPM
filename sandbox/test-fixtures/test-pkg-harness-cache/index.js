global.__SHADOWNPM_HARNESS_CACHE_COUNT__ =
  (global.__SHADOWNPM_HARNESS_CACHE_COUNT__ || 0) + 1;

module.exports = {
  loadCount: global.__SHADOWNPM_HARNESS_CACHE_COUNT__,
};
