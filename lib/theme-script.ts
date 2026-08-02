/** Blocking script for <head> — applies dark class before hydration. */
export function getThemeInitScript(): string {
  return `(function(){try{var d=document.documentElement;d.classList.add('dark');d.style.colorScheme='dark';}catch(e){}})();`;
}
