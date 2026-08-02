/** Blocking script for <head> — applies light color scheme before hydration. */
export function getThemeInitScript(): string {
  return `(function(){try{var d=document.documentElement;d.classList.remove('dark');d.style.colorScheme='light';}catch(e){}})();`;
}
