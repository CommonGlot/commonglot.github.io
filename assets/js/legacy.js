/* Redirect pages for legacy URLs such as pages/language.html?iso=haw -> languages/haw/.
   Only [A-Za-z0-9_-] ids are accepted, so the redirect can never leave the site. */
(() => {
  const s = document.currentScript;
  const v = new URLSearchParams(location.search).get(s.dataset.param);
  if (v && /^[\w-]{1,32}$/.test(v)) location.replace(s.dataset.to.replace('{}', encodeURIComponent(v)) + location.hash);
})();
